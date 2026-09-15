/**
 * A-FORGE P1 Gateway Tools
 *
 * Internalizes external MCPs and raw APIs behind kernel-governed A-FORGE
 * tools. Every call returns a standard envelope with request_id and
 * receipt_id. MUTATE-class GitHub tools are gated by the MCP ingress lease
 * gate (core.ts) because they are classified as IRREVERSIBLE /
 * EXECUTE_HIGH_IMPACT.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import { z } from "zod";
import { JSDOM } from "jsdom";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { randomUUID } from "node:crypto";
import { mkdir, appendFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

// FLAME client for search result synthesis
import {
  type TaskContext,
  type PageContext,
  checkBrowserSentinel,
  browserSentinelErrorResponse,
} from "../../domain/governance/browserInjectionSentinel.js";

// ── Configuration ─────────────────────────────────────────────────────────────

const PLAYWRIGHT_MCP_URL = process.env.PLAYWRIGHT_MCP_URL ?? "http://localhost:8931/mcp";
const MINIMAX_MCP_URL = process.env.MINIMAX_MCP_URL ?? "http://localhost:18091/mcp";
const NETDATA_URL = process.env.NETDATA_URL ?? "http://localhost:19999";
const CONTEXT7_MCP_URL = process.env.CONTEXT7_MCP_URL ?? "https://mcp.context7.com/mcp";
const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY ?? process.env.BRAVE_API_KEY ?? "";
const SEARXNG_URL = (process.env.SEARXNG_URL ?? "http://127.0.0.1:8080").replace(/\/+$/, "");
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "";

const RECEIPT_LOG = "/root/A-FORGE/data/gateway_receipts.jsonl";

// ── Receipts ──────────────────────────────────────────────────────────────────

async function recordReceipt(meta: Record<string, unknown>): Promise<string> {
  const receipt_id = randomUUID();
  const entry = {
    receipt_id,
    timestamp: new Date().toISOString(),
    ...meta,
  };
  try {
    await mkdir(resolve(RECEIPT_LOG, ".."), { recursive: true });
    await appendFile(RECEIPT_LOG, JSON.stringify(entry) + "\n");
  } catch (e) {
    // Receipt logging is best-effort; do not block the gateway response.
    process.stderr.write(`[gateway] receipt logging failed: ${e}\n`);
  }
  return receipt_id;
}

// ── Generic MCP HTTP client ───────────────────────────────────────────────────

async function callHttpMcp(url: string, tool: string, args: Record<string, unknown>): Promise<unknown> {
  const client = new Client(
    { name: "A-FORGE-gateway", version: "0.1.0" },
    { capabilities: {} },
  );
  const transport = new StreamableHTTPClientTransport(new URL(url));
  try {
    await client.connect(transport);
    const res = (await client.callTool({ name: tool, arguments: args })) as {
      content?: Array<{ type?: string; text?: string; data?: string }>;
    };
    const text = res.content?.[0]?.text ?? res.content?.[0]?.data;
    if (typeof text === "string") {
      try { return JSON.parse(text); }
      catch { return text; }
    }
    return res;
  } finally {
    await transport.close();
  }
}

// ── Brave Search helpers ──────────────────────────────────────────────────────

interface BraveResult {
  title: string;
  url: string;
  description?: string;
  age?: string;
}

async function braveWebSearch(query: string, count: number, freshness: string, safesearch: string): Promise<{ ok: boolean; results: BraveResult[]; error?: string }> {
  if (!BRAVE_API_KEY) {
    return { ok: false, results: [], error: "BRAVE_SEARCH_API_KEY not configured" };
  }
  try {
    const params = new URLSearchParams({ q: query, count: String(Math.min(count, 20)) });
    if (freshness && freshness !== "any") params.set("freshness", freshness);
    if (safesearch) params.set("safesearch", safesearch);
    const resp = await fetch(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": BRAVE_API_KEY,
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      return { ok: false, results: [], error: `Brave API ${resp.status}: ${body.slice(0, 200)}` };
    }
    const data = (await resp.json()) as { web?: { results?: BraveResult[] } };
    const results = (data.web?.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      description: r.description ?? "",
      age: r.age,
    }));
    return { ok: true, results };
  } catch (err: any) {
    return { ok: false, results: [], error: `Brave search failed: ${err?.message ?? String(err)}` };
  }
}

/** Local SearXNG — same box, not agent-supplied URL (SSRF does not apply). */
async function searxngWebSearch(
  query: string,
  count: number,
): Promise<{ ok: boolean; results: BraveResult[]; error?: string }> {
  try {
    const params = new URLSearchParams({ q: query, format: "json", pageno: "1" });
    const resp = await fetch(`${SEARXNG_URL}/search?${params.toString()}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!resp.ok) {
      return { ok: false, results: [], error: `SearXNG HTTP ${resp.status}` };
    }
    const data = (await resp.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string; publishedDate?: string }>;
      unresponsive_engines?: unknown;
    };
    const results = (data.results ?? []).slice(0, Math.max(1, count)).map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      description: r.content ?? "",
      age: r.publishedDate,
    }));
    return { ok: true, results };
  } catch (err: any) {
    return { ok: false, results: [], error: `SearXNG failed: ${err?.message ?? String(err)}` };
  }
}

async function webSearchWithFallback(
  query: string,
  count: number,
  freshness: string,
  safesearch: string,
): Promise<{ ok: boolean; results: BraveResult[]; error?: string; provider: string }> {
  const brave = await braveWebSearch(query, count, freshness, safesearch);
  if (brave.ok && brave.results.length > 0) {
    return { ...brave, provider: "brave" };
  }
  const local = await searxngWebSearch(query, count);
  if (local.ok) {
    return { ...local, provider: "searxng", error: brave.ok ? undefined : brave.error };
  }
  return {
    ok: false,
    results: [],
    provider: "none",
    error: `Brave: ${brave.error ?? "empty"}; SearXNG: ${local.error ?? "empty"}`,
  };
}

// ── Context7 docs lookup ──────────────────────────────────────────────────────

async function context7Lookup(query: string, _corpus: string, maxResults: number): Promise<{ ok: boolean; results: any[]; error?: string }> {
  try {
    const res = await callHttpMcp(CONTEXT7_MCP_URL, "search", { query, limit: maxResults }) as any;
    if (res && typeof res === "object") {
      const results = Array.isArray(res.results) ? res.results : Array.isArray(res) ? res : [];
      return { ok: true, results };
    }
    return { ok: false, results: [], error: "context7 returned unexpected shape" };
  } catch (err: any) {
    return { ok: false, results: [], error: `context7 unreachable: ${err?.message ?? String(err)}` };
  }
}

// ── GitHub REST helpers ───────────────────────────────────────────────────────

const GITHUB_API = "https://api.github.com";

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (GITHUB_TOKEN) h.Authorization = `Bearer ${GITHUB_TOKEN}`;
  return h;
}

async function ghGet(path: string): Promise<any> {
  const resp = await fetch(`${GITHUB_API}${path}`, { headers: ghHeaders() });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`GitHub ${resp.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function ghPost(path: string, body: unknown): Promise<any> {
  const resp = await fetch(`${GITHUB_API}${path}`, {
    method: "POST",
    headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`GitHub ${resp.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

// ── Netdata helpers ───────────────────────────────────────────────────────────

async function netdataAlarms(status: string): Promise<any[]> {
  const resp = await fetch(`${NETDATA_URL}/api/v1/alarms?${status === "all" ? "" : `active=${status === "raised" ? "true" : "false"}`}`);
  if (!resp.ok) throw new Error(`Netdata ${resp.status}`);
  const data = (await resp.json()) as { alarms?: Record<string, any> };
  const alarms = Object.values(data.alarms ?? {});
  if (status === "warning") return alarms.filter((a: any) => a.status === "WARNING");
  if (status === "critical") return alarms.filter((a: any) => a.status === "CRITICAL");
  if (status === "clear") return alarms.filter((a: any) => a.status === "CLEAR");
  return alarms;
}

async function netdataData(chart: string, after: number | null, before: number | null, points: number): Promise<{ labels: string[]; data: number[][] }> {
  const params = new URLSearchParams({ chart, points: String(points), format: "json" });
  if (after) params.set("after", String(after));
  if (before) params.set("before", String(before));
  if (!after && !before) params.set("after", "-300");
  const resp = await fetch(`${NETDATA_URL}/api/v1/data?${params.toString()}`);
  if (!resp.ok) throw new Error(`Netdata ${resp.status}`);
  return (await resp.json()) as { labels: string[]; data: number[][] };
}

// ── Response helper ───────────────────────────────────────────────────────────

function gatewayResponse(request_id: string, payload: Record<string, unknown>, receiptMeta: Record<string, unknown>) {
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({ request_id, ...payload }, null, 2),
    }],
    isError: false,
    _receiptPromise: recordReceipt({ request_id, ...receiptMeta }),
  };
}

function gatewayError(request_id: string, error: string, receiptMeta: Record<string, unknown>) {
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({ request_id, error }, null, 2),
    }],
    isError: true,
    _receiptPromise: recordReceipt({ request_id, error, ...receiptMeta }),
  };
}

// ── Handlers: Research & Search ───────────────────────────────────────────────

export async function handleForgeResearch(args: any) {
  const { query, depth, sources, time_horizon, max_results, include_citations, request_id } = args;
  const receiptMeta = { tool: "forge_research", query, depth, sources };

  const search = await webSearchWithFallback(query, max_results ?? 10, time_horizon ?? "any", "moderate");
  if (!search.ok) {
    return gatewayError(request_id, `Research fallback: ${search.error}. Returning low-confidence answer.`, receiptMeta);
  }

  const results = search.results.slice(0, max_results ?? 10);
  const citations = include_citations !== false
    ? results.map((r) => ({ title: r.title, url: r.url, source: search.provider, date: r.age ?? null }))
    : [];
  const answer = results.map((r) => `- ${r.title}: ${r.description ?? ""}`).join("\n") || "No grounded results.";
  const confidence = results.length > 5 ? "high" : results.length > 0 ? "medium" : "low";
  const gaps = results.length === 0 ? ["No web results returned"] : [];

  const receipt_id = await recordReceipt({ ...receiptMeta, provider: search.provider, result_count: results.length });
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({ request_id, answer, citations, confidence, gaps, receipt_id }, null, 2),
    }],
  };
}

export async function handleForgeSearch(args: any) {
  const reqId = args.request_id || `req-${Date.now().toString(36)}`;
  const source = (args.source || "web").toLowerCase();
  const query = args.query;
  const count = args.count ?? args.max_results ?? 10;
  const freshness = args.freshness ?? args.time_horizon ?? "any";
  const safesearch = args.safesearch ?? "moderate";
  const synthesize = !!args.synthesize;
  const receiptMeta = { tool: "forge_search", query, source, count, freshness };

  // 1. Research mode
  if (source === "research") {
    return handleForgeResearch({ ...args, request_id: reqId, max_results: count });
  }

  // 2. Docs mode (Context7)
  if (source === "docs") {
    const corpus = args.corpus ?? "all";
    const lookup = await context7Lookup(query, corpus, count);
    const results = lookup.ok ? lookup.results : [];
    const gaps = lookup.ok ? [] : [lookup.error ?? "context7 index unavailable"];
    const receipt_id = await recordReceipt({ ...receiptMeta, provider: "context7", result_count: results.length });
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          request_id: reqId,
          source: "docs",
          corpus,
          results,
          gaps,
          receipt_id,
          _epistemic: {
            output_class: "DOMAIN_COMPUTATION",
            authority_claim: "ADVISORY",
            evidence_source: "CONTEXT7",
          },
        }, null, 2),
      }],
    };
  }

  // 3. All sources (Web + Docs combined)
  if (source === "all") {
    const [webRes, docsRes] = await Promise.allSettled([
      webSearchWithFallback(query, count, freshness, safesearch),
      context7Lookup(query, "all", 5),
    ]);

    const webResults = webRes.status === "fulfilled" && webRes.value.ok
      ? webRes.value.results.map((r) => ({ title: r.title, url: r.url, snippet: r.description ?? "", source: "web" }))
      : [];
    const docResults = docsRes.status === "fulfilled" && docsRes.value.ok
      ? docsRes.value.results.map((r: any) => ({ title: r.title ?? r.uri, url: r.uri, snippet: r.content ?? "", source: "docs" }))
      : [];

    const combined = [...webResults, ...docResults];
    const receipt_id = await recordReceipt({ ...receiptMeta, provider: "brave+context7", result_count: combined.length });
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          request_id: reqId,
          source: "all",
          results: combined,
          receipt_id,
          _epistemic: {
            output_class: "DOMAIN_COMPUTATION",
            authority_claim: "ADVISORY",
            evidence_source: "MULTI_SOURCE",
          },
        }, null, 2),
      }],
    };
  }

  // 4. Default: Web search (Brave, fail-over to local SearXNG)
  const search = await webSearchWithFallback(query, count, freshness, safesearch);
  if (!search.ok) {
    return gatewayError(reqId, `Search failed: ${search.error}`, receiptMeta);
  }
  const results = search.results.map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.description ?? "",
    date: r.age ?? null,
  }));
  const receipt_id = await recordReceipt({ ...receiptMeta, provider: search.provider, result_count: results.length });

  // FLAME synthesis (optional)
  let flame: any = null;
  if (synthesize && results.length > 0) {
    try {
      const { flameSynthesizeSearch } = await import("../../tools/flameClient.js");
      flame = await flameSynthesizeSearch(query, results, search.provider);
    } catch (e: any) {
      console.warn(`[forge_search] FLAME synthesis unavailable: ${e.message ?? e}`);
    }
  }

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        request_id: reqId,
        source: "web",
        results,
        provider: search.provider,
        receipt_id,
        _epistemic: {
          output_class: "DOMAIN_COMPUTATION",
          authority_claim: "ADVISORY",
          evidence_source: search.provider.toUpperCase(),
        },
        ...(flame ? {
          flame_synthesis: {
            content: flame.synthesis,
            ok: flame.ok,
            model: flame.model,
            latency_ms: flame.latency_ms,
            authority: "ADVISORY",
            provenance: flame.provenance,
          },
        } : {}),
      }, null, 2),
    }],
  };
}

export async function handleForgeDocsLookup(args: any) {
  const { query, corpus, max_results, request_id } = args;
  const receiptMeta = { tool: "forge_docs_lookup", query, corpus };
  const lookup = await context7Lookup(query, corpus ?? "all", max_results ?? 5);
  const results = lookup.ok ? lookup.results : [];
  const gaps = lookup.ok ? [] : [lookup.error ?? "context7 index unavailable"];
  const receipt_id = await recordReceipt({ ...receiptMeta, provider: "context7", result_count: results.length, gaps });
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({ request_id, results, receipt_id }, null, 2),
    }],
  };
}

// ── Browser context schemas (two-context architecture) ───────────────────────

const TaskContextSchema = z.object({
  task: z.string().min(1).describe("Original agent task / user instruction (CONTEXT B authority)"),
  expected_outcome: z.string().optional().describe("Expected outcome after the action completes"),
  source: z.enum(["agent", "user", "kernel"]).optional().describe("Source of the task authority"),
});

const PageContextSchema = z.object({
  url: z.string().describe("URL of the page that prompted this action"),
  origin_domain: z.string().describe("Domain of the page origin"),
  snippet: z.string().optional().describe("Page text / selector context that suggested the action"),
});

// ── Handlers: Browser ─────────────────────────────────────────────────────────

export async function handleForgeBrowserNavigate(args: any) {
  const { url, request_id, task_context, page_context } = args;
  const sentinel = checkBrowserSentinel({
    tool_name: "forge_browser_navigate",
    url,
    task_context: task_context as TaskContext | undefined,
    page_context: page_context as PageContext | undefined,
  });
  if (sentinel.severity !== "SEAL") {
    return browserSentinelErrorResponse(request_id, sentinel);
  }
  try {
    const res = (await callHttpMcp(PLAYWRIGHT_MCP_URL, "browser_navigate", { url })) as any;
    const text = typeof res === "string" ? res : res?.content?.[0]?.text ?? "";
    // Fail-closed: check if response contains error indicators
    const isError = text.includes("Error:") || text.includes("error:") || text.includes("Target page, context or browser has been closed");
    if (isError) {
      return gatewayError(request_id, `browser_navigate failed: ${text.slice(0, 300)}`, { tool: "forge_browser_navigate", url });
    }
    const receipt_id = await recordReceipt({ tool: "forge_browser_navigate", url, task_context: task_context?.task, page_origin: page_context?.origin_domain });
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          request_id,
          url,
          title: "",
          status: 200,
          receipt_id,
          raw: text.slice(0, 500),
          origin_domain: page_context?.origin_domain ?? null,
          page_authority_tier: page_context ? "untrusted_evidence" : "task_directed",
          task_aligned: true,
        }, null, 2),
      }],
    };
  } catch (err: any) {
    return gatewayError(request_id, `browser_navigate failed: ${err?.message ?? String(err)}`, { tool: "forge_browser_navigate", url });
  }
}

export async function handleForgeBrowserClick(args: any) {
  const { selector, button, request_id, task_context, page_context } = args;
  const sentinel = checkBrowserSentinel({
    tool_name: "forge_browser_click",
    selector,
    task_context: task_context as TaskContext | undefined,
    page_context: page_context as PageContext | undefined,
  });
  if (sentinel.severity !== "SEAL") {
    return browserSentinelErrorResponse(request_id, sentinel);
  }
  try {
    await callHttpMcp(PLAYWRIGHT_MCP_URL, "browser_click", { target: selector, button: button ?? "left" });
    const receipt_id = await recordReceipt({ tool: "forge_browser_click", selector, button, task_context: task_context?.task, page_origin: page_context?.origin_domain });
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ request_id, clicked: true, new_url: null, receipt_id }, null, 2),
      }],
    };
  } catch (err: any) {
    return gatewayError(request_id, `browser_click failed: ${err?.message ?? String(err)}`, { tool: "forge_browser_click", selector });
  }
}

export async function handleForgeBrowserType(args: any) {
  const { selector, text, submit, request_id, task_context, page_context } = args;
  const sentinel = checkBrowserSentinel({
    tool_name: "forge_browser_type",
    selector,
    text,
    task_context: task_context as TaskContext | undefined,
    page_context: page_context as PageContext | undefined,
  });
  if (sentinel.severity !== "SEAL") {
    return browserSentinelErrorResponse(request_id, sentinel);
  }
  try {
    await callHttpMcp(PLAYWRIGHT_MCP_URL, "browser_type", { target: selector, text, submit: submit ?? false });
    const receipt_id = await recordReceipt({ tool: "forge_browser_type", selector, submitted: submit ?? false, text_length: text.length, task_context: task_context?.task, page_origin: page_context?.origin_domain });
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ request_id, typed: true, submitted: submit ?? false, receipt_id }, null, 2),
      }],
    };
  } catch (err: any) {
    return gatewayError(request_id, `browser_type failed: ${err?.message ?? String(err)}`, { tool: "forge_browser_type", selector });
  }
}

export async function handleForgeBrowserScreenshot(args: any) {
  const { selector, full_page, request_id, task_context, page_context } = args;
  const sentinel = checkBrowserSentinel({
    tool_name: "forge_browser_screenshot",
    selector,
    task_context: task_context as TaskContext | undefined,
    page_context: page_context as PageContext | undefined,
  });
  if (sentinel.severity !== "SEAL") {
    return browserSentinelErrorResponse(request_id, sentinel);
  }
  try {
    const res = (await callHttpMcp(PLAYWRIGHT_MCP_URL, "browser_take_screenshot", {
      type: "png",
      fullPage: full_page ?? false,
      ...(selector ? { target: selector } : {}),
    })) as any;
    const text = typeof res === "string" ? res : res?.content?.[0]?.text ?? "";
    const receipt_id = await recordReceipt({ tool: "forge_browser_screenshot", selector, full_page, task_context: task_context?.task, page_origin: page_context?.origin_domain });
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ request_id, image_base64: text, mime_type: "image/png", receipt_id }, null, 2),
      }],
    };
  } catch (err: any) {
    return gatewayError(request_id, `browser_screenshot failed: ${err?.message ?? String(err)}`, { tool: "forge_browser_screenshot", selector });
  }
}

export async function handleForgeBrowserExtractText(args: any) {
  const { selector, max_chars, request_id, task_context, page_context } = args;
  const sentinel = checkBrowserSentinel({
    tool_name: "forge_browser_extract_text",
    selector,
    task_context: task_context as TaskContext | undefined,
    page_context: page_context as PageContext | undefined,
  });
  if (sentinel.severity !== "SEAL") {
    return browserSentinelErrorResponse(request_id, sentinel);
  }
  try {
    const res = (await callHttpMcp(PLAYWRIGHT_MCP_URL, "browser_snapshot", selector ? { target: selector } : {})) as any;
    const text = typeof res === "string" ? res : res?.content?.[0]?.text ?? "";
    const receipt_id = await recordReceipt({ tool: "forge_browser_extract_text", selector, text_length: text.length, task_context: task_context?.task, page_origin: page_context?.origin_domain });
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ request_id, text: text.slice(0, max_chars ?? 50000), element_count: 0, receipt_id }, null, 2),
      }],
    };
  } catch (err: any) {
    return gatewayError(request_id, `browser_extract_text failed: ${err?.message ?? String(err)}`, { tool: "forge_browser_extract_text", selector });
  }
}

export async function handleForgeBrowserEvaluateJs(args: any) {
  const { script, request_id, task_context, page_context } = args;
  const sentinel = checkBrowserSentinel({
    tool_name: "forge_browser_evaluate_js",
    script,
    task_context: task_context as TaskContext | undefined,
    page_context: page_context as PageContext | undefined,
  });
  if (sentinel.severity !== "SEAL") {
    return browserSentinelErrorResponse(request_id, sentinel);
  }
  try {
    const res = (await callHttpMcp(PLAYWRIGHT_MCP_URL, "browser_evaluate", { function: script })) as any;
    const result = typeof res === "string" ? res : res?.content?.[0]?.text ?? res;
    const receipt_id = await recordReceipt({ tool: "forge_browser_evaluate_js", script_hash: randomUUID(), task_context: task_context?.task, page_origin: page_context?.origin_domain });
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ request_id, result, receipt_id }, null, 2),
      }],
    };
  } catch (err: any) {
    return gatewayError(request_id, `browser_evaluate_js failed: ${err?.message ?? String(err)}`, { tool: "forge_browser_evaluate_js" });
  }
}

// ── SSRF Guard ──────────────────────────────────────────────────────────────

const BLOCKED_HOSTS = new Set([
  "localhost", "localhost.", "0.0.0.0",
  "metadata.google.internal", "metadata.azure.internal",
  "169.254.169.254", "metadata.google.internal.",
]);

const PRIVATE_CIDRS: Array<[number, number, number]> = [
  [0x7F000000, 0xFF000000, 8],   // 127.0.0.0/8
  [0x0A000000, 0xFF000000, 8],   // 10.0.0.0/8
  [0xAC100000, 0xFFF00000, 12],  // 172.16.0.0/12
  [0xC0A80000, 0xFFFF0000, 16],  // 192.168.0.0/16
  [0xA9FE0000, 0xFFFF0000, 16],  // 169.254.0.0/16
  [0x64400000, 0xFFC00000, 10],  // 100.64.0.0/10 (CGNAT)
];

function ip4ToInt(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isPrivateOrReserved(ip: string): boolean {
  // IPv6 loopback and private ranges
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return true;
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true; // ULA
  if (ip.startsWith("fe80")) return true; // link-local
  if (ip === "0.0.0.0") return true;

  const intIp = ip4ToInt(ip);
  if (intIp === null) return false; // IPv6 non-mapped — skip for now
  for (const [network, mask] of PRIVATE_CIDRS) {
    if ((intIp & mask) === (network & mask)) return true;
  }
  return false;
}

async function ssrfGuard(rawUrl: string): Promise<{ ok: boolean; error?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: "INVALID_URL" };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: `SSRF_BLOCKED: scheme ${parsed.protocol} not allowed` };
  }
  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(hostname)) {
    return { ok: false, error: `SSRF_BLOCKED: host ${hostname} is blocked` };
  }
  const port = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === "https:" ? 443 : 80);
  if (port !== 80 && port !== 443) {
    return { ok: false, error: `SSRF_BLOCKED: port ${port} not allowed (only 80/443)` };
  }
  // DNS resolution check — block private/loopback IPs
  try {
    const { lookup } = await import("node:dns/promises");
    const results = await lookup(hostname, { all: true, family: 0 });
    for (const r of results) {
      if (isPrivateOrReserved(r.address)) {
        return { ok: false, error: `SSRF_BLOCKED: ${hostname} resolves to private IP ${r.address}` };
      }
    }
  } catch {
    // DNS failure — let the fetch/browser handle it (could be transient)
  }
  return { ok: true };
}

// ── SPA Shell Detection ─────────────────────────────────────────────────────

function isSpaShell(html: string, statusCode: number): boolean {
  if (statusCode === 404 || statusCode === 403) {
    // 404 on a known section might be SPA client-side routing
    const hasAppShell = /id=["'](?:root|app|__next|__nuxt|main)["']/i.test(html);
    const hasLoading = /loading|spinner|skeleton/i.test(html);
    if (hasAppShell && hasLoading) return true;
  }
  if (statusCode !== 200) return false;

  const textContent = html.replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();

  // Very little visible content despite 200 response
  if (textContent.length < 500 && html.length > 5000) return true;

  // Empty app containers
  const appShellMatch = html.match(/<(?:div|main|section)\s+id=["'](?:root|app|__next|__nuxt|main)["'][^>]*>\s*<\/(?:div|main|section)>/i);
  if (appShellMatch) return true;

  return false;
}

// ── Epistemic Reflex Guard ─────────────────────────────────────────────────
// SCAR REPEAT #1 (2026-09-04 + 2026-09-14): agents claim "X runs on Y"
// without probing. This guard forces the response to separate OBSERVED facts
// from INFERRED claims, so downstream agents cannot silently upgrade
// web-scraped text into infrastructure assertions.
//
// Rule: web content is OBS (observed from page text). Infrastructure claims
// (which host, which port, which service) are DER at best — the page says
// "we host on AWS" but reality may differ. Never upgrade DER to OBS.

interface EpistemicClaim {
  text: string;
  label: "OBS" | "DER" | "INT" | "SPEC";
  source: string;
  confidence: number;
}

function epistemicGuard(content: string, url: string): {
  claims: EpistemicClaim[];
  reflex_warning: string | null;
} {
  const claims: EpistemicClaim[] = [];
  let reflexWarning: string | null = null;

  // Detect infrastructure/location claims in extracted text
  const infraPatterns = [
    { pattern: /runs?\s+on\s+(KVM\d+|server|host|VPS|AWS|Azure|GCP)/gi, label: "DER" as const, reason: "infrastructure_location" },
    { pattern: /hosted?\s+(?:on|at|in)\s+(\S+)/gi, label: "DER" as const, reason: "hosting_claim" },
    { pattern: /port\s+(\d{2,5})/gi, label: "DER" as const, reason: "port_reference" },
    { pattern: /(?:deployed|migrat(?:ed|ing))\s+to\s+(\S+)/gi, label: "DER" as const, reason: "deployment_claim" },
    { pattern: /(?:live|running|active)\s+(?:on|at)\s+(\S+)/gi, label: "DER" as const, reason: "runtime_claim" },
  ];

  for (const { pattern, label, reason } of infraPatterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      claims.push({
        text: match[0],
        label,
        source: `page_text:${url}`,
        confidence: 0.3, // web page claims about infrastructure are low-confidence
      });
    }
  }

  // If infrastructure claims detected, add reflex warning
  if (claims.length > 0) {
    reflexWarning = [
      "REFLEX_GUARD: This content contains infrastructure/location claims.",
      "Web page text is OBSERVED (what the page says), NOT VERIFIED (what reality is).",
      "Before asserting: X runs on Y / X is hosted at Y / X uses port Z —",
      "you MUST probe live state: `hostname`, `systemctl is-active <svc>`, `ss -tlnp | grep <port>`.",
      "SCAR REPEAT #1: memory exists since 2026-09-04. Apply it.",
    ].join(" ");
  }

  return { claims, reflex_warning: reflexWarning };
}

/**
 * Table-aware HTML extraction (2026-09-15).
 *
 * WHY: the static path reduced HTML with `.replace(/<[^>]+>/g, " ")`, which
 * flattens every <table> into whitespace-separated soup — row/column
 * association was destroyed before the agent ever saw it. Callers had to
 * re-derive structure by guessing. This helper reads the DOM and returns
 * real tables so structure survives to the consumer.
 *
 * Contract (ADDITIVE — `content.text` is unchanged for existing consumers):
 *   tables: [{ index, caption, headers, rows, markdown, row_count, col_count }]
 *
 * F2 TRUTH: values are OBSERVED as rendered in the served markup, not VERIFIED.
 * Uses jsdom, already an A-FORGE dependency. No new deps, no network.
 */
export function extractHtmlTables(
  html: string,
  opts: { maxTables?: number; maxRows?: number; maxCols?: number } = {},
): Array<Record<string, unknown>> {
  const maxTables = opts.maxTables ?? 20;
  const maxRows = opts.maxRows ?? 500;
  const maxCols = opts.maxCols ?? 50;

  let dom: JSDOM;
  try {
    dom = new JSDOM(html);
  } catch {
    return []; // malformed HTML must never fail the extraction
  }

  const doc = dom.window.document;
  // Layout/script tables are almost never the payload the agent wants.
  const tableEls = Array.from(doc.querySelectorAll("table")).filter((t) => {
    if (t.closest("nav, header, footer")) return false;
    return t.querySelectorAll("tr").length > 0;
  });

  const cellText = (cell: Element | null): string => {
    if (!cell) return "";
    // <br> is a token boundary, not glue: "extracted<br>January" must not
    // collapse to "extractedJanuary". Clone first (never mutate the source DOM).
    const clone = cell.cloneNode(true) as Element;
    clone.querySelectorAll("br").forEach((b) => b.replaceWith(" "));
    const t = (clone.textContent ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return t;
  };

  const escapePipe = (s: string): string => s.replace(/\|/g, "\\|");

  const tables: Array<Record<string, unknown>> = [];

  for (let i = 0; i < Math.min(tableEls.length, maxTables); i++) {
    const el = tableEls[i];
    const rowEls = Array.from(el.querySelectorAll("tr")).slice(0, maxRows);
    if (rowEls.length === 0) continue;

    const grid: string[][] = rowEls.map((r) =>
      Array.from(r.querySelectorAll("th,td"))
        .slice(0, maxCols)
        .map((c) => cellText(c)),
    );

    // Header detection: explicit <th> in the first row, or a <thead>.
    const firstRowHasTh = Array.from(rowEls[0].querySelectorAll("th")).length > 0;
    const inThead = !!rowEls[0].closest("thead");
    const hasHeader = firstRowHasTh || inThead;

    const headers = hasHeader ? grid[0] : [];
    const bodyRows = hasHeader ? grid.slice(1) : grid;

    const colCount = Math.max(...grid.map((r) => r.length), 0);

    // Markdown rendering — the "tables as structured JSON alongside markdown"
    // expectation recorded in the Hermes skill.
    let markdown = "";
    if (colCount > 0) {
      const head = hasHeader
        ? headers
        : Array.from({ length: colCount }, (_, c) => `col_${c + 1}`);
      markdown += `| ${head.map((h) => escapePipe(h)).join(" | ")} |\n`;
      markdown += `| ${head.map(() => "---").join(" | ")} |\n`;
      for (const row of bodyRows) {
        const padded = Array.from({ length: colCount }, (_, c) => escapePipe(row[c] ?? ""));
        markdown += `| ${padded.join(" | ")} |\n`;
      }
    }

    tables.push({
      index: i,
      caption: cellText(el.querySelector("caption")) || null,
      headers,
      rows: bodyRows,
      row_count: bodyRows.length,
      col_count: colCount,
      markdown: markdown.trim(),
      has_header: hasHeader,
      // F2 TRUTH: merged cells are NOT expanded into a resolved grid — the row
      // array preserves document order, so a rowspan/colspan table will show
      // fewer cells in some rows. Flagged so consumers do not silently treat
      // position as a reliable column index.
      merged_cells_present: el.querySelectorAll("[rowspan], [colspan]").length > 0,
    });
  }

  return tables;
}

export async function handleForgeWebExtract(args: any) {
  const { url, render, max_chars, timeout_ms, actions, cookies, headers: customHeaders, download, request_id } = args;
  const effectiveMaxChars = Math.min(max_chars ?? 50000, 200000);
  const effectiveTimeout = Math.min(timeout_ms ?? 30000, 120000);
  const renderMode = render ?? "auto";

  // SSRF guard
  const ssrf = await ssrfGuard(url);
  if (!ssrf.ok) {
    return gatewayError(request_id, ssrf.error!, { tool: "forge_web_extract", url, reason: "ssrf_blocked" });
  }

  // Build headers — merge custom headers with defaults
  const fetchHeaders: Record<string, string> = {
    "User-Agent": "A-FORGE/1.0 (arifOS Federation; +https://arif-fazil.com)",
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
    ...customHeaders,
  };

  // Build cookie header if provided
  if (cookies?.length) {
    fetchHeaders["Cookie"] = cookies.map((c: any) => `${c.name}=${c.value}`).join("; ");
  }

  // ── Download mode ──
  if (download) {
    try {
      const dlDir = "/root/forge-downloads";
      await mkdir(dlDir, { recursive: true });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), effectiveTimeout);
      const resp = await fetch(url, { signal: controller.signal, headers: fetchHeaders, redirect: "follow" });
      clearTimeout(timer);
      if (!resp.ok) {
        return gatewayError(request_id, `Download failed: HTTP ${resp.status}`, { tool: "forge_web_extract", url, route: "download" });
      }
      const buffer = Buffer.from(await resp.arrayBuffer());
      const urlPath = new URL(url).pathname;
      const filename = urlPath.split("/").pop() || `download-${Date.now()}`;
      const filePath = `${dlDir}/${filename}`;
      const { writeFile } = await import("node:fs/promises");
      await writeFile(filePath, buffer);
      const receipt_id = await recordReceipt({ tool: "forge_web_extract", url, route: "download", file: filePath, size: buffer.length });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            request_id, status: "ok", route: "download",
            file: filePath, size: buffer.length, content_type: resp.headers.get("content-type"),
            receipt_id,
          }, null, 2),
        }],
      };
    } catch (err: any) {
      return gatewayError(request_id, `Download failed: ${err?.message ?? String(err)}`, { tool: "forge_web_extract", url, route: "download" });
    }
  }

  // ── Step 1: Try static fetch ──
  let staticResult: { html: string; status: number; finalUrl: string; title: string } | null = null;
  let staticError: string | null = null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(effectiveTimeout, 15000));
    const resp = await fetch(url, { signal: controller.signal, redirect: "follow", headers: fetchHeaders });
    clearTimeout(timer);
    const html = await resp.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    staticResult = { html, status: resp.status, finalUrl: resp.url, title: titleMatch?.[1]?.trim() ?? "" };
  } catch (err: any) {
    staticError = err?.message ?? String(err);
  }

  // ── Step 2: Decide if we need browser rendering ──
  const hasActions = actions?.length > 0;
  const needsRender = renderMode === "always" || hasActions
    || (renderMode === "auto" && staticResult && isSpaShell(staticResult.html, staticResult.status))
    || (renderMode === "auto" && staticError !== null);

  // ── Step 2a: If static fetch worked and no render needed ──
  if (staticResult && !needsRender) {
    const text = staticResult.html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
      .replace(/\s+/g, " ").trim();

    const tables = extractHtmlTables(staticResult.html);
    const receipt_id = await recordReceipt({ tool: "forge_web_extract", url, route: "static_fetch", spa_detected: false, text_length: text.length, tables: tables.length });
    const guard = epistemicGuard(text, url);
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          request_id, status: "ok", route: "static_fetch",
          source: { requested_url: url, final_url: staticResult.finalUrl, title: staticResult.title, retrieved_at: new Date().toISOString() },
          content: {
            text: text.slice(0, effectiveMaxChars),
            truncated: text.length > effectiveMaxChars,
            content_length: text.length,
            // ADDITIVE: structured tables so row/column association survives.
            tables: tables.length > 0 ? tables : undefined,
            tables_count: tables.length,
          },
          diagnostics: { spa_detected: false, browser_used: false, tables_extracted: tables.length },
          epistemic_guard: guard.claims.length > 0 ? { claims: guard.claims, warning: guard.reflex_warning } : undefined,
          receipt_id,
        }, null, 2),
      }],
    };
  }

  // ── Step 3: Browser rendering via Playwright (full capability) ──
  if (needsRender) {
    try {
      // Set cookies if provided
      if (cookies?.length) {
        try {
          await callHttpMcp(PLAYWRIGHT_MCP_URL, "browser_navigate", { url: "about:blank" });
          for (const cookie of cookies) {
            await callHttpMcp(PLAYWRIGHT_MCP_URL, "browser_evaluate", {
              function: `document.cookie = "${cookie.name}=${cookie.value}; domain=${cookie.domain || new URL(url).hostname}; path=${cookie.path || "/"}"`,
            });
          }
        } catch { /* cookie setup best-effort */ }
      }

      // Navigate
      await callHttpMcp(PLAYWRIGHT_MCP_URL, "browser_navigate", { url });

      // Wait for page to settle
      try { await callHttpMcp(PLAYWRIGHT_MCP_URL, "browser_wait_for", { time: 3 }); } catch { /* best-effort */ }

      // Execute browser actions if provided
      const actionResults: any[] = [];
      if (hasActions) {
        for (const action of actions) {
          try {
            switch (action.type) {
              case "click":
                await callHttpMcp(PLAYWRIGHT_MCP_URL, "browser_click", { target: action.selector, button: "left" });
                actionResults.push({ type: "click", selector: action.selector, success: true });
                break;
              case "type":
                await callHttpMcp(PLAYWRIGHT_MCP_URL, "browser_type", { target: action.selector, text: action.value || "" });
                actionResults.push({ type: "type", selector: action.selector, success: true });
                break;
              case "select":
                await callHttpMcp(PLAYWRIGHT_MCP_URL, "browser_select_option", { target: action.selector, value: action.value });
                actionResults.push({ type: "select", selector: action.selector, success: true });
                break;
              case "wait":
                await callHttpMcp(PLAYWRIGHT_MCP_URL, "browser_wait_for", { time: (action.wait_ms || 1000) / 1000 });
                actionResults.push({ type: "wait", ms: action.wait_ms, success: true });
                break;
              case "scroll":
                await callHttpMcp(PLAYWRIGHT_MCP_URL, "browser_evaluate", { function: `window.scrollBy(0, ${action.value || 500})` });
                actionResults.push({ type: "scroll", success: true });
                break;
              case "screenshot":
                const ss = await callHttpMcp(PLAYWRIGHT_MCP_URL, "browser_take_screenshot", { type: "png" }) as any;
                const ssText = typeof ss === "string" ? ss : ss?.content?.[0]?.text ?? "";
                actionResults.push({ type: "screenshot", data: ssText.slice(0, 1000), success: true });
                break;
              case "download":
                // Navigate to download URL
                await callHttpMcp(PLAYWRIGHT_MCP_URL, "browser_navigate", { url: action.value || url });
                actionResults.push({ type: "download", url: action.value, success: true });
                break;
            }
          } catch (actErr: any) {
            actionResults.push({ type: action.type, success: false, error: actErr?.message ?? String(actErr) });
          }
          // Brief pause between actions
          try { await callHttpMcp(PLAYWRIGHT_MCP_URL, "browser_wait_for", { time: 0.5 }); } catch { /* */ }
        }
      }

      // Extract text — try evaluate first (works with all browser types), fallback to snapshot
      let rawText = "";
      try {
        const evalRes = await callHttpMcp(PLAYWRIGHT_MCP_URL, "browser_evaluate", {
          function: `(() => {
            const clone = document.body.cloneNode(true);
            clone.querySelectorAll('script,style,noscript,svg').forEach(el => el.remove());
            return clone.innerText || clone.textContent || '';
          })()`,
        }) as any;
        rawText = typeof evalRes === "string" ? evalRes : evalRes?.content?.[0]?.text ?? evalRes?.result ?? "";
      } catch {
        // Fallback to snapshot
        try {
          const snapshotRes = await callHttpMcp(PLAYWRIGHT_MCP_URL, "browser_snapshot", {}) as any;
          rawText = typeof snapshotRes === "string" ? snapshotRes : snapshotRes?.content?.[0]?.text ?? "";
        } catch { /* both failed */ }
      }

      const title = staticResult?.title ?? "";
      const receipt_id = await recordReceipt({ tool: "forge_web_extract", url, route: "browser_render", spa_detected: true, actions: actionResults.length, text_length: rawText.length });
      const guard = epistemicGuard(rawText, url);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            request_id, status: "ok", route: "browser_render",
            source: { requested_url: url, final_url: url, title, retrieved_at: new Date().toISOString() },
            content: { text: rawText.slice(0, effectiveMaxChars), truncated: rawText.length > effectiveMaxChars, content_length: rawText.length },
            actions: actionResults.length > 0 ? actionResults : undefined,
            diagnostics: { spa_detected: true, browser_used: true, actions_executed: actionResults.length },
            epistemic_guard: guard.claims.length > 0 ? { claims: guard.claims, warning: guard.reflex_warning } : undefined,
            receipt_id,
          }, null, 2),
        }],
      };
    } catch (err: any) {
      const errMsg = err?.message ?? String(err);
      const isUnavailable = errMsg.includes("ECONNREFUSED") || errMsg.includes("fetch failed");

      if (staticResult) {
        const fallbackText = staticResult.html
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

        const receipt_id = await recordReceipt({ tool: "forge_web_extract", url, route: "static_fallback", browser_error: errMsg });
        const fallbackTables = extractHtmlTables(staticResult.html);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              request_id, status: "partial", route: "static_fallback",
              source: { requested_url: url, final_url: staticResult.finalUrl, title: staticResult.title, retrieved_at: new Date().toISOString() },
              content: {
                text: fallbackText.slice(0, effectiveMaxChars),
                truncated: fallbackText.length > effectiveMaxChars,
                content_length: fallbackText.length,
                // ADDITIVE: structured tables so row/column association survives.
                tables: fallbackTables.length > 0 ? fallbackTables : undefined,
                tables_count: fallbackTables.length,
              },
              diagnostics: { spa_detected: true, browser_used: false, browser_error: isUnavailable ? "BROWSER_UNAVAILABLE" : errMsg, tables_extracted: fallbackTables.length },
              receipt_id,
            }, null, 2),
          }],
        };
      }
      return gatewayError(request_id, isUnavailable ? "BROWSER_UNAVAILABLE" : `browser_render failed: ${errMsg.slice(0, 200)}`, { tool: "forge_web_extract", url, route: "browser_render" });
    }
  }

  // ── Step 4: Static fetch failed ──
  return gatewayError(request_id, `fetch failed: ${staticError ?? "unknown"}`, { tool: "forge_web_extract", url, route: "static_fetch" });
}

// ── Handlers: GitHub ──────────────────────────────────────────────────────────

export async function handleForgeGitHubSearchCode(args: any) {
  const { q, per_page, page, request_id } = args;
  try {
    const data = await ghGet(`/search/code?q=${encodeURIComponent(q)}&per_page=${per_page ?? 30}&page=${page ?? 1}`);
    const items = (data.items ?? []).map((i: any) => ({
      repo: i.repository?.full_name,
      path: i.path,
      url: i.html_url,
      snippet: i.text_matches?.[0]?.fragment ?? "",
    }));
    const receipt_id = await recordReceipt({ tool: "forge_github_search_code", query: q, count: items.length });
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ request_id, total_count: data.total_count ?? 0, items, receipt_id }, null, 2),
      }],
    };
  } catch (err: any) {
    return gatewayError(request_id, `GitHub search code failed: ${err?.message ?? String(err)}`, { tool: "forge_github_search_code", query: q });
  }
}

export async function handleForgeGitHubSearchRepos(args: any) {
  const { q, per_page, page, request_id } = args;
  try {
    const data = await ghGet(`/search/repositories?q=${encodeURIComponent(q)}&per_page=${per_page ?? 30}&page=${page ?? 1}`);
    const items = (data.items ?? []).map((i: any) => ({
      full_name: i.full_name,
      description: i.description ?? "",
      url: i.html_url,
      stars: i.stargazers_count ?? 0,
    }));
    const receipt_id = await recordReceipt({ tool: "forge_github_search_repos", query: q, count: items.length });
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ request_id, total_count: data.total_count ?? 0, items, receipt_id }, null, 2),
      }],
    };
  } catch (err: any) {
    return gatewayError(request_id, `GitHub search repos failed: ${err?.message ?? String(err)}`, { tool: "forge_github_search_repos", query: q });
  }
}

export async function handleForgeGitHubGetFile(args: any) {
  const { owner, repo, path, branch, request_id } = args;
  try {
    const data = await ghGet(`/repos/${owner}/${repo}/contents/${path}?ref=${branch ?? "main"}`);
    const content = typeof data.content === "string" ? Buffer.from(data.content, "base64").toString("utf-8") : "";
    const receipt_id = await recordReceipt({ tool: "forge_github_get_file", owner, repo, path, branch });
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ request_id, content, sha: data.sha, size: data.size, encoding: "utf-8", receipt_id }, null, 2),
      }],
    };
  } catch (err: any) {
    return gatewayError(request_id, `GitHub get file failed: ${err?.message ?? String(err)}`, { tool: "forge_github_get_file", owner, repo, path });
  }
}

export async function handleForgeGitHubCreateOrUpdateFile(args: any) {
  const { owner, repo, path, branch, content, message, sha, create_pr, pr_base, request_id } = args;
  try {
    const body: any = {
      message,
      content: Buffer.from(content).toString("base64"),
      branch,
      ...(sha ? { sha } : {}),
    };
    const fileRes = await ghPut(`/repos/${owner}/${repo}/contents/${path}`, body);
    let pr_url: string | null = null;
    if (create_pr !== false) {
      const pr = await ghPost(`/repos/${owner}/${repo}/pulls`, {
        title: message,
        body: `Auto-created by A-FORGE gateway`,
        head: branch,
        base: pr_base ?? "main",
        draft: true,
      });
      pr_url = pr.html_url ?? null;
    }
    const receipt_id = await recordReceipt({ tool: "forge_github_create_or_update_file", owner, repo, path, branch, pr_url });
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ request_id, commit_sha: fileRes.commit?.sha ?? null, pr_url, file_sha: fileRes.content?.sha ?? "", receipt_id }, null, 2),
      }],
    };
  } catch (err: any) {
    return gatewayError(request_id, `GitHub create/update file failed: ${err?.message ?? String(err)}`, { tool: "forge_github_create_or_update_file", owner, repo, path });
  }
}

export async function handleForgeGitHubCreateIssue(args: any) {
  const { owner, repo, title, body, labels, assignees, request_id } = args;
  try {
    const issue = await ghPost(`/repos/${owner}/${repo}/issues`, {
      title,
      body,
      ...(labels ? { labels } : {}),
      ...(assignees ? { assignees } : {}),
    });
    const receipt_id = await recordReceipt({ tool: "forge_github_create_issue", owner, repo, issue_number: issue.number });
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ request_id, issue_number: issue.number, issue_url: issue.html_url, receipt_id }, null, 2),
      }],
    };
  } catch (err: any) {
    return gatewayError(request_id, `GitHub create issue failed: ${err?.message ?? String(err)}`, { tool: "forge_github_create_issue", owner, repo, title });
  }
}

export async function handleForgeGitHubCreatePullRequest(args: any) {
  const { owner, repo, title, body, head, base, draft, request_id } = args;
  try {
    const pr = await ghPost(`/repos/${owner}/${repo}/pulls`, {
      title,
      body,
      head,
      base: base ?? "main",
      draft: draft ?? true,
    });
    const receipt_id = await recordReceipt({ tool: "forge_github_create_pull_request", owner, repo, pr_number: pr.number, head, base });
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ request_id, pr_number: pr.number, pr_url: pr.html_url, receipt_id }, null, 2),
      }],
    };
  } catch (err: any) {
    return gatewayError(request_id, `GitHub create PR failed: ${err?.message ?? String(err)}`, { tool: "forge_github_create_pull_request", owner, repo, head, base });
  }
}

async function ghPut(path: string, body: unknown): Promise<any> {
  const resp = await fetch(`${GITHUB_API}${path}`, {
    method: "PUT",
    headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`GitHub ${resp.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

// ── Handler: Git Worktree (local physics sensor) ─────────────────────────────

async function runGit(args: string[], cwd: string): Promise<string> {
  return execFileSync("git", args, {
    encoding: "utf-8",
    cwd,
    timeout: 10000,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function gitDirExists(p: string): boolean {
  try { return existsSync(p); } catch { return false; }
}

export async function handleForgeWorktree(args: any) {
  const { cwd, request_id } = args;
  const workdir = cwd ?? process.cwd();

  try {
    // 1. Current branch
    const branch = await runGit(["branch", "--show-current"], workdir);

    // 2. Ahead/behind vs tracking remote
    let ahead = 0, behind = 0, upstream: string | null = null;
    try {
      const upstreamRef = (await runGit(["rev-parse", "--abbrev-ref", "@{upstream}"], workdir)).trim();
      if (upstreamRef) {
        upstream = upstreamRef;
        ahead  = parseInt((await runGit(["rev-list", "--count", `${upstreamRef}..${branch.trim()}`], workdir)).trim() || "0");
        behind = parseInt((await runGit(["rev-list", "--count", `${branch.trim()}..${upstreamRef}`], workdir)).trim() || "0");
      }
    } catch { /* no upstream */ }

    // 3. Porcelain status — single shot for all dirty signals
    const status = await runGit(["status", "--porcelain=v1"], workdir);
    const staged: string[] = [], unstaged: string[] = [], untracked: string[] = [], ignored: string[] = [];

    for (const line of status.split("\n").filter(Boolean)) {
      if (line.startsWith("warning:")) continue;
      const [idx, wksp, ...rest] = line;
      const file = rest.join("").replace(/^"(.*)"$/, "$1"); // unquote
      if (idx === "?" && wksp === "?") untracked.push(file);
      else if (idx === "!" && wksp === "!") ignored.push(file);
      else if (idx !== " " && idx !== "?") staged.push(file);
      else if (wksp !== " " && wksp !== "?") unstaged.push(file);
    }

    // 4. Stash list
    const stashOut = await runGit(["stash", "list"], workdir);
    const stash_list = stashOut.split("\n").filter(Boolean).map((line) => {
      const m = line.match(/^(stash@\{(\d+)\}): (.*)$/);
      return m ? { ref: m[1], index: parseInt(m[2]), message: m[3].trim() } : null;
    }).filter(Boolean);

    // 5. Diff summary
    const diffSummary: { file: string; change: string }[] = [];
    try {
      const diffOut = await runGit(["diff", "--stat", "--summary"], workdir);
      diffSummary.push(...diffOut.split("\n")
        .filter((l) => l.includes("|"))
        .map((l) => { const p = l.trim().split("|"); return { file: p[0].trim(), change: p[1].trim() }; }));
    } catch { /* no diff */ }

    // 6. In-progress operations
    const gitDir = (await runGit(["rev-parse", "--git-dir"], workdir)).trim();
    const in_progress_ops: string[] = [];
    if (gitDir) {
      if (gitDirExists(join(gitDir, "rebase-merge")) || gitDirExists(join(gitDir, "rebase-apply"))) in_progress_ops.push("rebase");
      if (gitDirExists(join(gitDir, "MERGE_HEAD"))) in_progress_ops.push("merge");
      if (gitDirExists(join(gitDir, "CHERRY_PICK_HEAD"))) in_progress_ops.push("cherry-pick");
      if (gitDirExists(join(gitDir, "BISECT_LOG"))) in_progress_ops.push("bisect");
      if (gitDirExists(join(gitDir, "REVERT_HEAD"))) in_progress_ops.push("revert");
    }

    // 7. Conflicts
    const conflicts: string[] = [];
    if (in_progress_ops.includes("merge") || in_progress_ops.includes("rebase")) {
      const conflictOut = await runGit(["diff", "--name-only", "--diff-filter=U"], workdir);
      conflicts.push(...conflictOut.split("\n").filter(Boolean));
    }

    // 8. Blast radius assessment
    let blast_radius = "low", blast_reason = "clean";
    if (conflicts.length > 0)          { blast_radius = "critical"; blast_reason = "conflicts_unresolved"; }
    else if (in_progress_ops.some((op) => ["rebase","cherry-pick","revert"].includes(op))) { blast_radius = "high"; blast_reason = "in_progress_operation"; }
    else if (staged.length + unstaged.length + untracked.length > 0) { blast_radius = "medium"; blast_reason = "uncommitted_changes"; }

    // 9. Recommendations (OBSERVE — never mutate)
    const recommendations: string[] = [];
    if (conflicts.length > 0)                        recommendations.push("resolve_conflicts");
    if (in_progress_ops.includes("rebase"))           recommendations.push("abort_rebase");
    if (in_progress_ops.includes("merge"))             recommendations.push("abort_merge");
    if (stash_list.length > 0)                       recommendations.push("inspect_stash");
    if (staged.length > 0)                           recommendations.push("review_staged");
    if (unstaged.length > 0)                         recommendations.push("review_unstaged");
    if (untracked.length > 0)                        recommendations.push("consider_gitignore");

    const receipt_id = await recordReceipt({
      tool: "forge_worktree", cwd: workdir, branch: branch.trim(),
      blast_radius, staged_count: staged.length, unstaged_count: unstaged.length,
    });

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          request_id, workdir, branch: branch.trim() || null, ahead, behind, upstream,
          staged_files: staged, unstaged_files: unstaged, untracked_files: untracked, ignored_files: ignored,
          stash_list, diff_summary: diffSummary, conflicts, in_progress_ops,
          blast_radius, blast_reason, recommendations,
          is_dirty: staged.length + unstaged.length + untracked.length + conflicts.length > 0,
          scope: "local_only", receipt_id,
        }, null, 2),
      }],
    };
  } catch (err: any) {
    return gatewayError(request_id, `worktree failed: ${err?.message ?? String(err)}`, { tool: "forge_worktree", cwd: workdir });
  }
}

// ── Handlers: Netdata ─────────────────────────────────────────────────────────

export async function handleForgeNetdataAlarms(args: any) {
  const { host, status, request_id } = args;
  try {
    const alarms = await netdataAlarms(status ?? "raised");
    const receipt_id = await recordReceipt({ tool: "forge_netdata_alarms", host, alarm_count: alarms.length });
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ request_id, alarms, receipt_id }, null, 2),
      }],
    };
  } catch (err: any) {
    return gatewayError(request_id, `Netdata alarms failed: ${err?.message ?? String(err)}`, { tool: "forge_netdata_alarms", host });
  }
}

export async function handleForgeNetdataMetrics(args: any) {
  const { host, chart, after, before, points, request_id } = args;
  try {
    const data = await netdataData(chart, after ?? null, before ?? null, points ?? 100);
    const receipt_id = await recordReceipt({ tool: "forge_netdata_metrics", host, chart, points: data.data.length });
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ request_id, chart, labels: data.labels, data: data.data, receipt_id }, null, 2),
      }],
    };
  } catch (err: any) {
    return gatewayError(request_id, `Netdata metrics failed: ${err?.message ?? String(err)}`, { tool: "forge_netdata_metrics", host, chart });
  }
}

// ── Handler: MiniMax search ───────────────────────────────────────────────────

export async function handleForgeMinimaxSearch(args: any) {
  const { query, max_results, request_id } = args;
  try {
    const res = (await callHttpMcp(MINIMAX_MCP_URL, "web_search", { query })) as any;
    const text = typeof res === "string" ? res : res?.content?.[0]?.text ?? "";
    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch { /* raw text */ }
    const organic = (parsed.organic ?? []).slice(0, max_results ?? 10).map((r: any) => ({
      title: r.title ?? "",
      url: r.link ?? r.url ?? "",
      snippet: r.snippet ?? "",
    }));
    const receipt_id = await recordReceipt({ tool: "forge_minimax_search", query, result_count: organic.length });
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ request_id, results: organic, provider: "minimax", receipt_id }, null, 2),
      }],
    };
  } catch (err: any) {
    return gatewayError(request_id, `MiniMax search failed: ${err?.message ?? String(err)}`, { tool: "forge_minimax_search", query });
  }
}

// ── Registration ──────────────────────────────────────────────────────────────

export function registerGatewayTools(server: McpServer): void {
  // Research & Search
  // forge_research — REMOVED 2026-09-16. Redundant: forge_search(source=research) dispatches to same handler.
  // Handler retained — used by forge_search dispatch.
  // server.tool("forge_research", "Governed research across web sources.", {
  //   query: z.string().max(500).describe("Research query"),
  //   depth: z.enum(["quick", "standard", "deep"]).default("standard").describe("Research depth"),
  //   sources: z.array(z.enum(["web", "news", "academic", "docs", "all"])).default(["all"]).describe("Source filters"),
  //   time_horizon: z.enum(["any", "day", "week", "month", "year"]).default("any").describe("Time horizon"),
  //   max_results: z.number().min(1).max(50).default(10).describe("Max results"),
  //   include_citations: z.boolean().default(true).describe("Include citations"),
  //   request_id: z.string().describe("Caller request ID"),
  // }, handleForgeResearch);

  server.tool("forge_search", "Unified governed search across web (Brave), documentation (Context7), and deep research with provenance and epistemic labels.", {
    query: z.string().max(500).describe("Search or research query"),
    source: z.enum(["web", "docs", "research", "all"]).default("web").describe("Search source: 'web' (Brave), 'docs' (Context7 library docs), 'research' (deep synthesis), 'all' (multi-source)"),
    count: z.number().min(1).max(50).default(10).describe("Result count"),
    corpus: z.enum(["arifos", "geox", "wealth", "well", "aforge", "cloudflare", "workers", "all"]).default("all").describe("Corpus filter when source is 'docs'"),
    freshness: z.enum(["any", "day", "week", "month", "year"]).default("any").describe("Freshness horizon"),
    safesearch: z.enum(["off", "moderate", "strict"]).default("moderate").describe("SafeSearch mode"),
    synthesize: z.boolean().default(false).describe("Synthesize results (legacy FLAME lane decommissioned 2026-09-04; falls back to raw results)"),
    request_id: z.string().optional().describe("Optional caller request ID for audit tracing"),
  }, handleForgeSearch);

  // forge_docs_lookup — REMOVED 2026-09-16. Redundant: forge_search(source=docs) dispatches to same context7Lookup.
  // Handler retained — used by forge_search dispatch.
  // server.tool("forge_docs_lookup", "Governed docs lookup via Context7.", {
  //   query: z.string().describe("Docs query"),
  //   corpus: z.enum(["arifos", "geox", "wealth", "well", "aforge", "cloudflare", "workers", "all"]).default("all").describe("Corpus"),
  //   max_results: z.number().min(1).max(20).default(5).describe("Max results"),
  //   request_id: z.string().describe("Caller request ID"),
  // }, handleForgeDocsLookup);

  // Browser
  server.tool("forge_browser_navigate", "Navigate browser to URL.", {
    url: z.string().describe("URL to navigate to"),
    wait_until: z.enum(["load", "domcontentloaded", "networkidle"]).default("networkidle").describe("Wait condition"),
    timeout_ms: z.number().min(1000).max(30000).default(15000).describe("Timeout ms"),
    request_id: z.string().describe("Caller request ID"),
    task_context: TaskContextSchema.optional().describe("Trusted agent task authority (CONTEXT B)"),
    page_context: PageContextSchema.optional().describe("Untrusted page evidence (CONTEXT A)"),
  }, handleForgeBrowserNavigate);

  server.tool("forge_browser_click", "Click a browser element.", {
    selector: z.string().describe("Element selector"),
    button: z.enum(["left", "right", "middle"]).default("left").describe("Mouse button"),
    request_id: z.string().describe("Caller request ID"),
    task_context: TaskContextSchema.optional().describe("Trusted agent task authority (CONTEXT B)"),
    page_context: PageContextSchema.optional().describe("Untrusted page evidence (CONTEXT A)"),
  }, handleForgeBrowserClick);

  server.tool("forge_browser_type", "Type text into a browser element.", {
    selector: z.string().describe("Element selector"),
    text: z.string().max(1000).describe("Text to type"),
    submit: z.boolean().default(false).describe("Submit after typing"),
    request_id: z.string().describe("Caller request ID"),
    task_context: TaskContextSchema.optional().describe("Trusted agent task authority (CONTEXT B)"),
    page_context: PageContextSchema.optional().describe("Untrusted page evidence (CONTEXT A)"),
  }, handleForgeBrowserType);

  server.tool("forge_browser_screenshot", "Take a browser screenshot.", {
    selector: z.string().optional().describe("Element selector (omit for full page)"),
    full_page: z.boolean().default(false).describe("Full page screenshot"),
    request_id: z.string().describe("Caller request ID"),
    task_context: TaskContextSchema.optional().describe("Trusted agent task authority (CONTEXT B)"),
    page_context: PageContextSchema.optional().describe("Untrusted page evidence (CONTEXT A)"),
  }, handleForgeBrowserScreenshot);

  server.tool("forge_browser_extract_text", "Extract text from browser page.", {
    selector: z.string().optional().describe("Element selector (omit for body)"),
    max_chars: z.number().default(50000).describe("Max characters"),
    request_id: z.string().describe("Caller request ID"),
    task_context: TaskContextSchema.optional().describe("Trusted agent task authority (CONTEXT B)"),
    page_context: PageContextSchema.optional().describe("Untrusted page evidence (CONTEXT A)"),
  }, handleForgeBrowserExtractText);

  server.tool("forge_browser_evaluate_js", "Evaluate JS in browser context.", {
    script: z.string().max(2000).describe("JavaScript to evaluate"),
    request_id: z.string().describe("Caller request ID"),
    task_context: TaskContextSchema.optional().describe("Trusted agent task authority (CONTEXT B)"),
    page_context: PageContextSchema.optional().describe("Untrusted page evidence (CONTEXT A)"),
  }, handleForgeBrowserEvaluateJs);

  // ── GitHub — search/repos collapsed into forge_github(mode='search', type='code'|'repositories') — 2026-07-31 entropy sweep ──
  // forge_github_search_code + forge_github_search_repos were thin wrappers.
  // Canonical: forge_github(mode='search', type='code'|'repositories')
  // Reduction: 2 tools → 0 (already covered by forge_github). ΔS = −2.

  server.tool("forge_github_get_file", "Read a file from GitHub.", {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    path: z.string().describe("File path"),
    branch: z.string().default("main").describe("Branch"),
    request_id: z.string().describe("Caller request ID"),
  }, handleForgeGitHubGetFile);

  server.tool("forge_github_create_or_update_file", "Create or update a file on GitHub.", {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    path: z.string().describe("File path"),
    branch: z.string().describe("Branch"),
    content: z.string().describe("Base64-encoded file content"),
    message: z.string().describe("Commit message"),
    sha: z.string().optional().describe("Existing blob SHA for updates"),
    create_pr: z.boolean().default(true).describe("Create a PR"),
    pr_base: z.string().default("main").describe("PR base branch"),
    request_id: z.string().describe("Caller request ID"),
    lease_id: z.string().describe("Kernel-issued lease ID"),
  }, handleForgeGitHubCreateOrUpdateFile);

  server.tool("forge_github_create_issue", "Create a GitHub issue.", {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    title: z.string().describe("Issue title"),
    body: z.string().describe("Issue body"),
    labels: z.array(z.string()).optional().describe("Labels"),
    assignees: z.array(z.string()).optional().describe("Assignees"),
    request_id: z.string().describe("Caller request ID"),
    lease_id: z.string().describe("Kernel-issued lease ID"),
  }, handleForgeGitHubCreateIssue);

  // ── forge_github_create_pull_request collapsed into forge_github(mode='pr',action='create') — 2026-07-31 ──
  // Reduction: 1 tool → 0. ΔS = −1.

  // Worktree
  server.tool("forge_worktree", "Local git physics sensor — reports branch, dirty state, stash, conflicts, and blast radius.", {
    cwd: z.string().optional().describe("Working directory (defaults to process cwd)"),
    request_id: z.string().describe("Caller request ID"),
  }, handleForgeWorktree);

  // Netdata
  server.tool("forge_netdata_alarms", "Read Netdata alarms.", {
    host: z.string().default("localhost").describe("Netdata host"),
    status: z.enum(["all", "raised", "clear", "warning", "critical"]).default("raised").describe("Alarm status filter"),
    request_id: z.string().describe("Caller request ID"),
  }, handleForgeNetdataAlarms);

  server.tool("forge_netdata_metrics", "Read Netdata chart data.", {
    host: z.string().default("localhost").describe("Netdata host"),
    chart: z.string().describe("Chart name"),
    after: z.number().optional().describe("Unix timestamp start"),
    before: z.number().optional().describe("Unix timestamp end"),
    points: z.number().default(100).describe("Data points"),
    request_id: z.string().describe("Caller request ID"),
  }, handleForgeNetdataMetrics);

  // MiniMax — REMOVED 2026-09-16 (ENT-001). Declared DELETED in toolDedupe.ts:88.
  // MiniMax backend deprecated; use forge_search(source=brave).
  // server.tool("forge_minimax_search", "Search the web via MiniMax.", {
  //   query: z.string().max(400).describe("Search query"),
  //   max_results: z.number().min(1).max(20).default(10).describe("Max results"),
  //   request_id: z.string().describe("Caller request ID"),
  // }, handleForgeMinimaxSearch);

  // ── Universal Web Extract (2026-09-14) — Full agentic web capability ──
  // Static fetch → SPA detection → Playwright render. Browser actions, auth,
  // downloads. DITEMPA BUKAN DIBERI — agents deserve full web capability.
  server.tool("forge_web_extract", "Full-capability agentic web extraction — auto-SPA-rendering, browser actions, authenticated sessions, downloads. All agents. DITEMPA BUKAN DIBERI.", {
    url: z.string().describe("URL to extract content from"),
    render: z.enum(["auto", "never", "always"]).default("auto").describe("Rendering mode: auto=detect SPA, never=static only, always=browser render"),
    max_chars: z.number().min(100).max(200000).default(50000).describe("Max characters to return"),
    timeout_ms: z.number().min(1000).max(120000).default(30000).describe("Total timeout in ms"),
    // Browser actions — click, type, scroll, wait, download, screenshot
    actions: z.array(z.object({
      type: z.enum(["click", "type", "select", "wait", "scroll", "download", "screenshot"]),
      selector: z.string().optional().describe("CSS selector for the target element"),
      value: z.string().optional().describe("Value for type/select actions or URL for download"),
      wait_ms: z.number().optional().describe("Wait time in ms"),
    })).optional().describe("Browser actions to perform after navigation"),
    // Auth support
    cookies: z.array(z.object({
      name: z.string(),
      value: z.string(),
      domain: z.string().optional(),
      path: z.string().optional(),
    })).optional().describe("Cookies to set before navigation"),
    headers: z.record(z.string()).optional().describe("Additional HTTP headers for the request"),
    download: z.boolean().default(false).describe("Download URL content to /tmp/forge-downloads/"),
    request_id: z.string().describe("Caller request ID"),
  }, handleForgeWebExtract);
}
