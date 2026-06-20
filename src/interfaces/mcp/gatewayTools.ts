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
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { randomUUID } from "node:crypto";
import { mkdir, appendFile } from "node:fs/promises";
import { resolve } from "node:path";
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
const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY ?? "";
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

  const search = await braveWebSearch(query, max_results ?? 10, time_horizon ?? "any", "moderate");
  if (!search.ok) {
    return gatewayError(request_id, `Research fallback: ${search.error}. Returning low-confidence answer.`, receiptMeta);
  }

  const results = search.results.slice(0, max_results ?? 10);
  const citations = include_citations !== false
    ? results.map((r) => ({ title: r.title, url: r.url, source: "brave", date: r.age ?? null }))
    : [];
  const answer = results.map((r) => `- ${r.title}: ${r.description ?? ""}`).join("\n") || "No grounded results.";
  const confidence = results.length > 5 ? "high" : results.length > 0 ? "medium" : "low";
  const gaps = results.length === 0 ? ["No web results returned"] : [];

  const receipt_id = await recordReceipt({ ...receiptMeta, provider: "brave", result_count: results.length });
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({ request_id, answer, citations, confidence, gaps, receipt_id }, null, 2),
    }],
  };
}

export async function handleForgeSearch(args: any) {
  const { query, count, freshness, safesearch, request_id } = args;
  const receiptMeta = { tool: "forge_search", query, count, freshness };
  const search = await braveWebSearch(query, count ?? 10, freshness ?? "any", safesearch ?? "moderate");
  if (!search.ok) {
    return gatewayError(request_id, `Search failed: ${search.error}`, receiptMeta);
  }
  const results = search.results.map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.description ?? "",
    date: r.age ?? null,
  }));
  const receipt_id = await recordReceipt({ ...receiptMeta, provider: "brave", result_count: results.length });
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({ request_id, results, provider: "brave", receipt_id }, null, 2),
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
  server.tool("forge_research", "Governed research across web sources. OBSERVE-class.", {
    query: z.string().max(500).describe("Research query"),
    depth: z.enum(["quick", "standard", "deep"]).default("standard").describe("Research depth"),
    sources: z.array(z.enum(["web", "news", "academic", "docs", "all"])).default(["all"]).describe("Source filters"),
    time_horizon: z.enum(["any", "day", "week", "month", "year"]).default("any").describe("Time horizon"),
    max_results: z.number().min(1).max(50).default(10).describe("Max results"),
    include_citations: z.boolean().default(true).describe("Include citations"),
    request_id: z.string().describe("Caller request ID"),
  }, handleForgeResearch);

  server.tool("forge_search", "Governed web search via Brave. OBSERVE-class.", {
    query: z.string().max(400).describe("Search query"),
    count: z.number().min(1).max(20).default(10).describe("Result count"),
    freshness: z.enum(["any", "day", "week", "month", "year"]).default("any").describe("Freshness"),
    safesearch: z.enum(["off", "moderate", "strict"]).default("moderate").describe("SafeSearch"),
    request_id: z.string().describe("Caller request ID"),
  }, handleForgeSearch);

  server.tool("forge_docs_lookup", "Governed docs lookup via Context7. OBSERVE-class.", {
    query: z.string().describe("Docs query"),
    corpus: z.enum(["arifos", "geox", "wealth", "well", "aforge", "cloudflare", "workers", "all"]).default("all").describe("Corpus"),
    max_results: z.number().min(1).max(20).default(5).describe("Max results"),
    request_id: z.string().describe("Caller request ID"),
  }, handleForgeDocsLookup);

  // Browser
  server.tool("forge_browser_navigate", "Navigate browser to URL. OBSERVE-class.", {
    url: z.string().describe("URL to navigate to"),
    wait_until: z.enum(["load", "domcontentloaded", "networkidle"]).default("networkidle").describe("Wait condition"),
    timeout_ms: z.number().min(1000).max(30000).default(15000).describe("Timeout ms"),
    request_id: z.string().describe("Caller request ID"),
    task_context: TaskContextSchema.optional().describe("Trusted agent task authority (CONTEXT B)"),
    page_context: PageContextSchema.optional().describe("Untrusted page evidence (CONTEXT A)"),
  }, handleForgeBrowserNavigate);

  server.tool("forge_browser_click", "Click a browser element. OBSERVE-class.", {
    selector: z.string().describe("Element selector"),
    button: z.enum(["left", "right", "middle"]).default("left").describe("Mouse button"),
    request_id: z.string().describe("Caller request ID"),
    task_context: TaskContextSchema.optional().describe("Trusted agent task authority (CONTEXT B)"),
    page_context: PageContextSchema.optional().describe("Untrusted page evidence (CONTEXT A)"),
  }, handleForgeBrowserClick);

  server.tool("forge_browser_type", "Type text into a browser element. OBSERVE-class.", {
    selector: z.string().describe("Element selector"),
    text: z.string().max(1000).describe("Text to type"),
    submit: z.boolean().default(false).describe("Submit after typing"),
    request_id: z.string().describe("Caller request ID"),
    task_context: TaskContextSchema.optional().describe("Trusted agent task authority (CONTEXT B)"),
    page_context: PageContextSchema.optional().describe("Untrusted page evidence (CONTEXT A)"),
  }, handleForgeBrowserType);

  server.tool("forge_browser_screenshot", "Take a browser screenshot. OBSERVE-class.", {
    selector: z.string().optional().describe("Element selector (omit for full page)"),
    full_page: z.boolean().default(false).describe("Full page screenshot"),
    request_id: z.string().describe("Caller request ID"),
    task_context: TaskContextSchema.optional().describe("Trusted agent task authority (CONTEXT B)"),
    page_context: PageContextSchema.optional().describe("Untrusted page evidence (CONTEXT A)"),
  }, handleForgeBrowserScreenshot);

  server.tool("forge_browser_extract_text", "Extract text from browser page. OBSERVE-class.", {
    selector: z.string().optional().describe("Element selector (omit for body)"),
    max_chars: z.number().default(50000).describe("Max characters"),
    request_id: z.string().describe("Caller request ID"),
    task_context: TaskContextSchema.optional().describe("Trusted agent task authority (CONTEXT B)"),
    page_context: PageContextSchema.optional().describe("Untrusted page evidence (CONTEXT A)"),
  }, handleForgeBrowserExtractText);

  server.tool("forge_browser_evaluate_js", "Evaluate JS in browser context. OBSERVE-class.", {
    script: z.string().max(2000).describe("JavaScript to evaluate"),
    request_id: z.string().describe("Caller request ID"),
    task_context: TaskContextSchema.optional().describe("Trusted agent task authority (CONTEXT B)"),
    page_context: PageContextSchema.optional().describe("Untrusted page evidence (CONTEXT A)"),
  }, handleForgeBrowserEvaluateJs);

  // GitHub
  server.tool("forge_github_search_code", "Search GitHub code. OBSERVE-class.", {
    q: z.string().describe("GitHub code search query"),
    per_page: z.number().min(1).max(100).default(30).describe("Results per page"),
    page: z.number().default(1).describe("Page"),
    request_id: z.string().describe("Caller request ID"),
  }, handleForgeGitHubSearchCode);

  server.tool("forge_github_search_repos", "Search GitHub repositories. OBSERVE-class.", {
    q: z.string().describe("Repository search query"),
    per_page: z.number().min(1).max(100).default(30).describe("Results per page"),
    page: z.number().default(1).describe("Page"),
    request_id: z.string().describe("Caller request ID"),
  }, handleForgeGitHubSearchRepos);

  server.tool("forge_github_get_file", "Read a file from GitHub. OBSERVE-class.", {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    path: z.string().describe("File path"),
    branch: z.string().default("main").describe("Branch"),
    request_id: z.string().describe("Caller request ID"),
  }, handleForgeGitHubGetFile);

  server.tool("forge_github_create_or_update_file", "Create or update a file on GitHub. MUTATE — lease required.", {
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

  server.tool("forge_github_create_issue", "Create a GitHub issue. MUTATE — lease required.", {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    title: z.string().describe("Issue title"),
    body: z.string().describe("Issue body"),
    labels: z.array(z.string()).optional().describe("Labels"),
    assignees: z.array(z.string()).optional().describe("Assignees"),
    request_id: z.string().describe("Caller request ID"),
    lease_id: z.string().describe("Kernel-issued lease ID"),
  }, handleForgeGitHubCreateIssue);

  server.tool("forge_github_create_pull_request", "Create a GitHub pull request. MUTATE — lease required.", {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    title: z.string().describe("PR title"),
    body: z.string().describe("PR body"),
    head: z.string().describe("Head branch"),
    base: z.string().default("main").describe("Base branch"),
    draft: z.boolean().default(true).describe("Draft PR"),
    request_id: z.string().describe("Caller request ID"),
    lease_id: z.string().describe("Kernel-issued lease ID"),
  }, handleForgeGitHubCreatePullRequest);

  // Netdata
  server.tool("forge_netdata_alarms", "Read Netdata alarms. OBSERVE-class.", {
    host: z.string().default("localhost").describe("Netdata host"),
    status: z.enum(["all", "raised", "clear", "warning", "critical"]).default("raised").describe("Alarm status filter"),
    request_id: z.string().describe("Caller request ID"),
  }, handleForgeNetdataAlarms);

  server.tool("forge_netdata_metrics", "Read Netdata chart data. OBSERVE-class.", {
    host: z.string().default("localhost").describe("Netdata host"),
    chart: z.string().describe("Chart name"),
    after: z.number().optional().describe("Unix timestamp start"),
    before: z.number().optional().describe("Unix timestamp end"),
    points: z.number().default(100).describe("Data points"),
    request_id: z.string().describe("Caller request ID"),
  }, handleForgeNetdataMetrics);

  // MiniMax
  server.tool("forge_minimax_search", "Search the web via MiniMax. OBSERVE-class.", {
    query: z.string().max(400).describe("Search query"),
    max_results: z.number().min(1).max(20).default(10).describe("Max results"),
    request_id: z.string().describe("Caller request ID"),
  }, handleForgeMinimaxSearch);
}
