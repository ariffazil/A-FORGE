/**
 * flameClient.ts — FLAME HTTP client for A-FORGE TypeScript handlers.
 *
 * Bridges A-FORGE MCP tools to FLAME free-loop inference mesh at :18901.
 * Pattern: identical to GEOX/arifOS flame_client.py but in TypeScript.
 *
 * Usage:
 *   import { flameSynthesizeSearch } from "../tools/flameClient.js";
 *   const synthesis = await flameSynthesizeSearch(query, results);
 *   if (synthesis.ok) { use(synthesis.content); }
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given.
 */

const FLAME_API_BASE = "http://127.0.0.1:18901";
const TIMEOUT_MS = 8_000;
const MAX_BODY_CHARS = 8_000;

interface FlameResult {
  ok: boolean;
  content: string;
  model?: string;
  provider?: string;
  latency_ms?: number;
  authority: string;
  error?: string;
}

/**
 * Post a prompt to FLAME's summarize endpoint with task-class routing.
 * Built-in fetch (Node 22+) — no external deps.
 */
async function flamePost(
  text: string,
  taskType: string,
  callerId: string = "aforge"
): Promise<FlameResult> {
  const payload = {
    text: text.slice(0, MAX_BODY_CHARS),
    task_type: taskType,
    caller_id: callerId,
    sensitivity: "PUBLIC",
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const resp = await fetch(`${FLAME_API_BASE}/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await resp.json();
    if (data?.ok && data?.content) {
      return {
        ok: true,
        content: data.content,
        model: data.model ?? "unknown",
        provider: data.provider ?? "unknown",
        latency_ms: data.latency_ms ?? 0,
        authority: "ADVISORY",
      };
    }
    return { ok: false, content: "", authority: "ADVISORY", error: "FLAME empty response" };
  } catch (err: any) {
    return {
      ok: false,
      content: "",
      authority: "ADVISORY",
      error: err.name === "AbortError" ? "FLAME timeout" : `FLAME error: ${err.message ?? err}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Synthesize Brave search results via FLAME (task_class="extract").
 * Graceful degradation: returns raw snippets on FLAME failure.
 */
export async function flameSynthesizeSearch(
  query: string,
  results: Array<{ title: string; url: string; snippet: string }>,
  sourceEngine: string = "brave"
): Promise<FlameResult & { synthesis?: string; provenance?: any }> {
  if (!results || results.length === 0) {
    return { ok: false, content: "", authority: "ADVISORY", error: "No results to synthesize" };
  }

  const contextLines = results.slice(0, 15).map(
    (r, i) => `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    Content: ${(r.snippet ?? "").slice(0, 500)}`
  );
  const prompt = [
    "You are a search result synthesizer for A-FORGE execution engine.",
    "Extract and summarize facts only from the provided search results.",
    "Do not add external knowledge. Do not inject opinions.",
    "",
    `Search Query: ${query.slice(0, 500)}`,
    "",
    `Search Results (${results.length} items):`,
    ...contextLines,
    "",
    "Synthesize a concise, factual summary covering: key findings, points of agreement, contradictions if any.",
  ].join("\n");

  const flame = await flamePost(prompt, "extract", "aforge_forge_search");
  if (flame.ok) {
    return {
      ...flame,
      synthesis: flame.content,
      provenance: {
        engine: sourceEngine,
        model: flame.model,
        provider: flame.provider,
        latency_ms: flame.latency_ms,
        authority: "ADVISORY",
      },
    };
  }

  // Graceful degradation: return raw snippets
  const rawSnippets = results
    .slice(0, 10)
    .map((r) => `- ${r.title}: ${(r.snippet ?? "").slice(0, 300)}`)
    .join("\n");
  return {
    ok: false,
    content: `[FLAME unavailable — raw search results]\n${rawSnippets}`,
    synthesis: `[FLAME unavailable — raw search results]\n${rawSnippets}`,
    authority: "ADVISORY",
    error: flame.error,
    provenance: { engine: sourceEngine, note: "FLAME synthesis failed — raw fallback" },
  };
}

/**
 * Diagnose error/log trace via FLAME (task_class="classify").
 */
export async function flameDiagnose(errorTrace: string): Promise<FlameResult> {
  const prompt = `Diagnose this error:\n\n${errorTrace.slice(0, 3000)}`;
  return flamePost(prompt, "classify", "aforge_forge_diagnose");
}

/**
 * Summarize via FLAME (task_class="summarize").
 */
export async function flameSummarize(text: string): Promise<FlameResult> {
  return flamePost(text.slice(0, MAX_BODY_CHARS), "summarize", "aforge_forge_summarize");
}

/**
 * Draft an execution plan via FLAME — ADVISORY only (task_class="draft_plan").
 * F1 AMANAH: Draft only. Plan must pass arif_judge before execution.
 */
export async function flameDraftPlan(intent: string, context: string = ""): Promise<FlameResult> {
  const prompt = [
    `Intent: ${intent.slice(0, 1500)}`,
    context ? `Context: ${context.slice(0, 1500)}` : "",
    "",
    "Produce a structured execution plan with: steps, risks, reversibility check per step.",
  ]
    .filter(Boolean)
    .join("\n");
  return flamePost(prompt, "draft_plan", "aforge_forge_plan");
}
