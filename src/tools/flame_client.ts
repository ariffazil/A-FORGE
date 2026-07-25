/**
 * flame_client — FLAME Free-Loop HTTP Client for A-FORGE
 * ═══════════════════════════════════════════════════════════════
 *
 * Lightweight TypeScript client for FLAME API (:18901).
 * Duplicated per F1 AMANAH — tight coupling between organs is forbidden.
 *
 * Architectural rules (Arif-ratified 2026-07-25):
 *   1. Strict timeout (8s) — never hang A-FORGE waiting for FLAME
 *   2. Graceful degradation — return raw context on failure, never crash
 *   3. Stateless request — self-contained payload per call
 *   4. ADVISORY authority — output tagged for F2 truth verification
 *
 * Task classes:
 *   - "extract"    → forge_search (code parsing, result extraction)
 *   - "classify"   → forge_diagnose (error classification)
 *   - "summarize"  → forge_summarize (code/log summarization)
 *   - "draft_plan" → forge_plan (advisory planning drafts)
 *
 * Usage:
 *   import { flameSynthesize, flameClassify, flameExtract } from "./flame_client";
 *
 *   const result = await flameExtract("search results here", "forge_search");
 *   // Returns: { ok, content, raw, provenance }
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given.
 */

const FLAME_BASE = "http://127.0.0.1:18901";
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_BODY_CHARS = 8_000;

interface FlameResponse {
  ok: boolean;
  content: string;
  raw: string;
  provenance: {
    source: string;
    authority: "ADVISORY";
    model?: string;
    provider?: string;
    latency_ms?: number;
    note?: string;
  };
}

/**
 * Internal POST to FLAME API.
 * Graceful degradation: returns { ok: false } on any failure.
 */
async function _flamePost(
  endpoint: string,
  payload: Record<string, unknown>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Record<string, unknown> | null> {
  const url = `${FLAME_BASE}${endpoint}`;
  const body = JSON.stringify(payload);

  if (body.length > MAX_BODY_CHARS * 4) {
    console.warn(`[flame_client] payload too large (${body.length} bytes)`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Caller-Id": "a-forge" },
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      // FLAME returns 400 even when ok=true if "error" key exists
      try {
        const result = await resp.json();
        if (result?.ok) return result;
      } catch { /* ignore parse error */ }
      console.warn(`[flame_client] HTTP ${resp.status} on ${endpoint}`);
      return null;
    }

    return await resp.json();
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      console.warn(`[flame_client] timeout (${timeoutMs}ms) on ${endpoint}`);
    } else {
      console.warn(`[flame_client] error on ${endpoint}: ${err}`);
    }
    return null;
  }
}

/**
 * Synthesize/extract key info from a block of text via FLAME.
 * Used by forge_search to summarize search results.
 */
export async function flameExtract(
  text: string,
  callerId = "a-forge",
): Promise<FlameResponse> {
  const raw = text.length > MAX_BODY_CHARS
    ? text.slice(0, MAX_BODY_CHARS) + "..."
    : text;

  const payload = {
    prompt: `Extract key facts from the following content:\n\n${raw}`,
    system: "Extract and summarize facts only. Do not add external knowledge. Do not inject opinions. Structure output as key findings with sources.",
    max_tokens: 1024,
    temperature: 0.2,
    task_class: "extract",
    caller_id: callerId,
    sensitivity: "PUBLIC",
  };

  const result = await _flamePost("/completions", payload);

  if (result?.ok && typeof result.content === "string") {
    let content = result.content as string;
    // Strip think tags
    content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    return {
      ok: true,
      content,
      raw,
      provenance: {
        source: "FLAME",
        authority: "ADVISORY",
        model: result.model as string | undefined,
        provider: result.provider as string | undefined,
        latency_ms: result.latency_ms as number | undefined,
        note: "FLAME output is advisory — not constitutional judgment",
      },
    };
  }

  return {
    ok: false,
    content: "",
    raw,
    provenance: {
      source: "raw",
      authority: "ADVISORY",
      note: "FLAME unavailable — raw context returned",
    },
  };
}

/**
 * Classify text into categories via FLAME.
 * Used by forge_diagnose for error/stack trace classification.
 */
export async function flameClassify(
  text: string,
  categories: string[] = ["error", "warning", "info"],
  callerId = "a-forge",
): Promise<FlameResponse> {
  const raw = text.length > MAX_BODY_CHARS
    ? text.slice(0, MAX_BODY_CHARS) + "..."
    : text;

  const payload = {
    text: raw,
    categories: categories.join(","),
    task_class: "classify",
    caller_id: callerId,
    sensitivity: "PUBLIC",
  };

  const result = await _flamePost("/classify", payload);

  if (result?.ok && typeof result.content === "string") {
    let content = result.content as string;
    content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    return {
      ok: true,
      content,
      raw,
      provenance: {
        source: "FLAME",
        authority: "ADVISORY",
        model: result.model as string | undefined,
        provider: result.provider as string | undefined,
        latency_ms: result.latency_ms as number | undefined,
      },
    };
  }

  return {
    ok: false,
    content: "",
    raw,
    provenance: {
      source: "raw",
      authority: "ADVISORY",
      note: "FLAME unavailable — raw context returned",
    },
  };
}

/**
 * Generate a structured content summary via FLAME.
 * Used by forge_summarize for code/log/document summarization.
 */
export async function flameSummarize(
  text: string,
  callerId = "a-forge",
): Promise<FlameResponse> {
  const raw = text.length > MAX_BODY_CHARS
    ? text.slice(0, MAX_BODY_CHARS) + "..."
    : text;

  const payload = {
    text: raw,
    task_class: "summarize",
    caller_id: callerId,
    sensitivity: "PUBLIC",
  };

  const result = await _flamePost("/summarize", payload);

  if (result?.ok && typeof result.content === "string") {
    let content = result.content as string;
    content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    return {
      ok: true,
      content,
      raw,
      provenance: {
        source: "FLAME",
        authority: "ADVISORY",
        model: result.model as string | undefined,
        provider: result.provider as string | undefined,
        latency_ms: result.latency_ms as number | undefined,
      },
    };
  }

  return {
    ok: false,
    content: "",
    raw,
    provenance: {
      source: "raw",
      authority: "ADVISORY",
      note: "FLAME unavailable — raw context returned",
    },
  };
}
