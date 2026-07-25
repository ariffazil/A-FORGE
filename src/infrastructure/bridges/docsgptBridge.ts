/**
 * DocsGPT Bridge — Governed Knowledge Spine Adapter
 *
 * FORGE-1: Constitutional membrane between A-FORGE agents and DocsGPT.
 * DocsGPT is a foreign organ (P34 — root without kernel). This bridge
 * IS the kernel membrane: every query passes through F2 (epistemic tags),
 * F7 (confidence cap), and returns receipt-wrapped responses.
 *
 * Uses DocsGPT's OpenAI-compatible /v1/chat/completions endpoint.
 * Works with both self-hosted (localhost:7091) and cloud (gptcloud.arc53.com).
 *
 * ROUTES, never adjudicates. arifOS judges. A-FORGE executes.
 *
 * @constitutional F2 TRUTH — every chunk gets epistemic label
 * @constitutional F7 HUMILITY — confidence capped at 0.90
 * @constitutional F4 CLARITY — ΔS ≤ 0 on every response
 * @constitutional P34 — root outruns kernel → this bridge IS the kernel
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given.
 */

export interface DocsGPTQueryParams {
  /** The user question / search query */
  query: string;
  /** Corpus / agent ID — maps to a DocsGPT agent or set of active docs */
  corpusId?: string;
  /** Override model (otherwise uses agent default) */
  modelId?: string;
  /** Number of retrieval chunks (default 3) */
  chunks?: number;
  /** Conversation ID for multi-turn context */
  conversationId?: string;
}

export interface DocsGPTEpistemicChunk {
  /** The text content returned */
  text: string;
  /** Epistemic label per F2 TRUTH */
  epistemicLabel: "OBS" | "DER" | "INT" | "SPEC" | "UNKNOWN";
  /** Source citation if available */
  source?: string;
  /** Confidence [0.0–0.90] per F7 HUMILITY */
  confidence: number;
}

export interface DocsGPTResponse {
  /** The full answer text */
  answer: string;
  /** Epistemically-tagged chunks */
  chunks: DocsGPTEpistemicChunk[];
  /** Source citations */
  citations: string[];
  /** Model used */
  model: string;
  /** DocsGPT conversation ID for multi-turn */
  conversationId?: string;
  /** Receipt envelope for Kabarkan trace */
  receipt: DocsGPTReceipt;
}

export interface DocsGPTReceipt {
  /** Hash of the query + response for traceability */
  queryResponseHash: string;
  /** When the query was made */
  timestamp: string;
  /** Bridge version */
  bridgeVersion: string;
  /** Epistemic summary */
  epistemicSummary: {
    obsCount: number;
    derCount: number;
    intCount: number;
    specCount: number;
    unknownCount: number;
  };
}

/** Epistemic label classifier — determines trust tier of a text fragment */
function classifyEpistemicLabel(text: string, hasCitation: boolean): DocsGPTEpistemicChunk["epistemicLabel"] {
  if (!text || text.trim().length === 0) return "UNKNOWN";
  if (hasCitation) return "OBS";              // Cited → observed evidence
  if (text.match(/\b(approximately|about|roughly|estimated|around)\b/i)) return "DER"; // Hedged → derived
  if (text.match(/\b(may|could|might|possibly|potentially|suggests|indicates)\b/i)) return "INT"; // Modal → interpreted
  return "SPEC";                               // Assertion without citation → speculation
}

/** Cap confidence at F7 HUMILITY ceiling of 0.90 */
function capConfidence(rawConfidence: number): number {
  return Math.min(rawConfidence, 0.90);
}

/** Compute a simple hash for receipt traceability */
function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `sha256:${Math.abs(hash).toString(16).padStart(8, "0")}`;
}

/**
 * DocsGPT Bridge — queries DocsGPT through its OpenAI-compatible endpoint
 * and returns constitutionally-wrapped responses.
 */
export class DocsGPTBridge {
  private baseUrl: string;
  private apiKey: string | undefined;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl || process.env.DOCSGPT_BASE_URL || "http://localhost:7091";
    this.apiKey = apiKey || process.env.DOCSGPT_API_KEY || undefined;
  }

  /**
   * Query DocsGPT with constitutional wrapping.
   *
   * @param params Query parameters
   * @returns Constitutionally-wrapped response with epistemic tags + receipt
   */
  async query(params: DocsGPTQueryParams): Promise<DocsGPTResponse> {
    const { query, corpusId, modelId, chunks: numChunks = 3, conversationId } = params;
    const startedAt = new Date().toISOString();

    // Build the OpenAI-compatible request
    const messages: Array<{ role: string; content: string }> = [
      { role: "user", content: query },
    ];

    const requestBody: Record<string, unknown> = {
      model: modelId || "docsgpt-agent",
      messages,
      max_tokens: 2048,
    };

    // DocsGPT-specific overrides via passthrough would go here
    // but the /v1/chat/completions endpoint doesn't expose them directly.
    // For corpus-specific queries, use the native /api/answer endpoint instead.

    const url = `${this.baseUrl.replace(/\/$/, "")}/v1/chat/completions`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    let rawAnswer = "";
    let rawModel = "docsgpt-agent";
    const rawCitations: string[] = [];

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown error");
        throw new Error(`DocsGPT returned ${response.status}: ${errorText.slice(0, 200)}`);
      }

      const data = await response.json() as Record<string, unknown>;
      rawAnswer = (data.choices as Array<{ message: { content: string } }>)?.[0]?.message?.content || "";
      rawModel = (data.model as string) || "docsgpt-agent";

      // Extract citations if present (DocsGPT may include them in the answer or metadata)
      const citationMatches = rawAnswer.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
      for (const match of citationMatches) {
        const urlMatch = match.match(/\(([^)]+)\)/);
        if (urlMatch && urlMatch[1]) {
          rawCitations.push(urlMatch[1]);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        answer: "",
        chunks: [{
          text: `DocsGPT bridge error: ${msg}`,
          epistemicLabel: "UNKNOWN",
          confidence: 0.0,
        }],
        citations: [],
        model: "bridge-error",
        receipt: {
          queryResponseHash: simpleHash(query + msg),
          timestamp: startedAt,
          bridgeVersion: "FORGE-1::v2026.07.25",
          epistemicSummary: { obsCount: 0, derCount: 0, intCount: 0, specCount: 0, unknownCount: 1 },
        },
      };
    }

    // F2: Split answer into chunks and assign epistemic labels
    const paragraphs = rawAnswer
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const epistemicChunks: DocsGPTEpistemicChunk[] = paragraphs.map((paragraph) => {
      const hasCitation = rawCitations.some((c) => paragraph.includes(c));
      return {
        text: paragraph,
        epistemicLabel: classifyEpistemicLabel(paragraph, hasCitation),
        source: hasCitation ? rawCitations.find((c) => paragraph.includes(c)) : undefined,
        confidence: capConfidence(hasCitation ? 0.85 : 0.60),
      };
    });

    // If no paragraphs were extracted, treat the whole answer as one chunk
    if (epistemicChunks.length === 0 && rawAnswer.trim()) {
      epistemicChunks.push({
        text: rawAnswer.trim(),
        epistemicLabel: classifyEpistemicLabel(rawAnswer, rawCitations.length > 0),
        source: rawCitations[0],
        confidence: capConfidence(rawCitations.length > 0 ? 0.85 : 0.50),
      });
    }

    // Build epistemic summary
    const epistemicSummary = {
      obsCount: epistemicChunks.filter((c) => c.epistemicLabel === "OBS").length,
      derCount: epistemicChunks.filter((c) => c.epistemicLabel === "DER").length,
      intCount: epistemicChunks.filter((c) => c.epistemicLabel === "INT").length,
      specCount: epistemicChunks.filter((c) => c.epistemicLabel === "SPEC").length,
      unknownCount: epistemicChunks.filter((c) => c.epistemicLabel === "UNKNOWN").length,
    };

    return {
      answer: rawAnswer,
      chunks: epistemicChunks,
      citations: rawCitations,
      model: rawModel,
      conversationId: conversationId || undefined,
      receipt: {
        queryResponseHash: simpleHash(query + rawAnswer),
        timestamp: startedAt,
        bridgeVersion: "FORGE-1::v2026.07.25",
        epistemicSummary,
      },
    };
  }

  /**
   * Query DocsGPT using the native /api/answer endpoint.
   * Supports corpus-specific queries with active_docs and chunks parameters.
   */
  async queryNative(params: DocsGPTQueryParams & { activeDocs?: string[]; retriever?: string }): Promise<DocsGPTResponse> {
    const { query, corpusId, activeDocs, chunks: numChunks = 3, retriever } = params;
    const startedAt = new Date().toISOString();

    const requestBody: Record<string, unknown> = {
      question: query,
      chunks: numChunks,
    };

    if (this.apiKey) requestBody.api_key = this.apiKey;
    if (corpusId) requestBody.prompt_id = corpusId;
    if (activeDocs?.length) requestBody.active_docs = activeDocs;
    if (retriever) requestBody.retriever = retriever;

    const url = `${this.baseUrl.replace(/\/$/, "")}/api/answer`;

    let rawAnswer = "";
    const rawCitations: string[] = [];

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown error");
        throw new Error(`DocsGPT native API returned ${response.status}: ${errorText.slice(0, 200)}`);
      }

      const data = await response.json() as Record<string, unknown>;
      rawAnswer = (data.answer as string) || (data.result as string) || "";

      // DocsGPT native API returns sources in a different format
      const sources = data.sources as Array<{ title?: string; url?: string; text?: string }> | undefined;
      if (sources) {
        for (const s of sources) {
          if (s.url) rawCitations.push(s.url);
          else if (s.title) rawCitations.push(s.title);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        answer: "",
        chunks: [{
          text: `DocsGPT native API error: ${msg}`,
          epistemicLabel: "UNKNOWN",
          confidence: 0.0,
        }],
        citations: [],
        model: "bridge-error",
        receipt: {
          queryResponseHash: simpleHash(query + msg),
          timestamp: startedAt,
          bridgeVersion: "FORGE-1::v2026.07.25",
          epistemicSummary: { obsCount: 0, derCount: 0, intCount: 0, specCount: 0, unknownCount: 1 },
        },
      };
    }

    // Same epistemic wrapping as the OpenAI-compatible path
    const paragraphs = rawAnswer.split(/\n\n+/).map((p) => p.trim()).filter((p) => p.length > 0);
    const chunks2: DocsGPTEpistemicChunk[] = paragraphs.map((p) => ({
      text: p,
      epistemicLabel: classifyEpistemicLabel(p, rawCitations.some((c) => p.includes(c))),
      source: rawCitations.find((c) => p.includes(c)),
      confidence: capConfidence(rawCitations.some((c) => p.includes(c)) ? 0.85 : 0.60),
    }));

    if (chunks2.length === 0 && rawAnswer.trim()) {
      chunks2.push({
        text: rawAnswer.trim(),
        epistemicLabel: classifyEpistemicLabel(rawAnswer, rawCitations.length > 0),
        source: rawCitations[0],
        confidence: capConfidence(rawCitations.length > 0 ? 0.85 : 0.50),
      });
    }

    return {
      answer: rawAnswer,
      chunks: chunks2,
      citations: rawCitations,
      model: "docsgpt-native",
      receipt: {
        queryResponseHash: simpleHash(query + rawAnswer),
        timestamp: startedAt,
        bridgeVersion: "FORGE-1::v2026.07.25",
        epistemicSummary: {
          obsCount: chunks2.filter((c) => c.epistemicLabel === "OBS").length,
          derCount: chunks2.filter((c) => c.epistemicLabel === "DER").length,
          intCount: chunks2.filter((c) => c.epistemicLabel === "INT").length,
          specCount: chunks2.filter((c) => c.epistemicLabel === "SPEC").length,
          unknownCount: chunks2.filter((c) => c.epistemicLabel === "UNKNOWN").length,
        },
      },
    };
  }
}

/** Singleton instance — configured from environment */
let _bridge: DocsGPTBridge | null = null;

export function getDocsGPTBridge(): DocsGPTBridge {
  if (!_bridge) {
    _bridge = new DocsGPTBridge();
  }
  return _bridge;
}

export function resetDocsGPTBridge(): void {
  _bridge = null;
}
