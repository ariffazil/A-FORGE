/**
 * document_ingest — A-FORGE Document Intelligence Tool
 * ======================================================
 * Phase 1 MVP. Layout-first document processing with bounding-box provenance.
 *
 * Architecture (from chunkr Eureka Insights):
 *   1. Layout-first, not text-first — structure analysis BEFORE text extraction
 *   2. Semantic chunk = document boundary — respect sections/tables/figures
 *   3. Bounding-box provenance — every element traceable to source coordinates
 *   4. Document intelligence as SERVICE, not library
 *   5. Structured typed output — not "best effort markdown"
 *
 * Modes:
 *   analyze   — Layout analysis only. Return structure tree. No text.
 *   extract   — Full pipeline: layout + text + structured JSON with bbox.
 *   chunk     — Extract then semantic chunk for RAG.
 *   compare   — Diff two documents (version comparison).
 *
 * Integration Points:
 *   Telegram PDF → Hermes → document_ingest(extract) → structured JSON
 *                                                    ├→ AAA knowledge graph
 *                                                    ├→ GEOX well report parser
 *                                                    ├→ WEALTH financial statement parser
 *                                                    └→ VAULT999 document index
 *
 * Constitutional:
 *   F1  AMANAH    — read-only. No mutation. blast_radius=LOW.
 *   F2  TRUTH     — bounding-box provenance on every element.
 *   F11 AUDIT     — sha256(source) + per-element coordinates.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given.
 */

import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENGINE_SCRIPT = resolve(
  __dirname,
  "../../infrastructure/tools/document_ingest.py",
);

function runEngine(args: string): { ok: boolean; data: any; error?: string } {
  try {
    const cmd = `/usr/bin/python3 ${ENGINE_SCRIPT} ${args}`;
    const stdout = execSync(cmd, {
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024, // 10MB
      encoding: "utf-8",
    });
    const parsed = JSON.parse(stdout);
    if (parsed.error) {
      return { ok: false, data: null, error: parsed.error };
    }
    return { ok: true, data: parsed };
  } catch (err: any) {
    // Try to extract error from stderr or stdout if it's JSON
    if (err.stdout) {
      try {
        const parsed = JSON.parse(err.stdout);
        if (parsed.error) return { ok: false, data: null, error: parsed.error };
      } catch {}
    }
    return {
      ok: false,
      data: null,
      error: err.stderr || err.message || "Unknown engine error",
    };
  }
}

export function registerDocumentIngestTool(server: McpServer): void {
  server.tool(
    "document_ingest",
    `Document intelligence engine — layout-first parsing with bounding-box provenance.

Modes:
  analyze  — Layout analysis only. Return structure tree with element types and positions.
  extract  — Full pipeline: layout + text extraction + structured JSON with bbox coordinates.
  chunk    — Extract then semantic chunk for RAG consumption (strategies: semantic, section, page).
  compare  — Diff two documents (structural + text similarity).

Output: Structured JSON with typed elements (paragraph, table, image), bounding boxes, page numbers,
and SHA-256 provenance hash. Every claim traceable to source coordinates — VAULT999-compatible.

Integration: Telegram PDF → Hermes → document_ingest → structured JSON → AAA/GEOX/WEALTH/VAULT999.

Blast radius: LOW (read-only, no side effects). Reversibility: FULL.`,

    {
      file_path: z
        .string()
        .describe("Absolute path to the document file (PDF, image, or text)"),
      mode: z
        .enum(["analyze", "extract", "chunk", "compare"])
        .default("extract")
        .describe("Processing mode: analyze (structure only), extract (full pipeline), chunk (RAG-ready), compare (diff two docs)"),
      pages: z
        .string()
        .optional()
        .describe("Page range, e.g. '0-5' or single page '3'"),
      ocr: z
        .boolean()
        .default(false)
        .describe("Enable Tesseract OCR for scanned/image-based pages (eng+msa)"),
      chunk_strategy: z
        .enum(["semantic", "section", "page"])
        .default("semantic")
        .describe("Chunk strategy for 'chunk' mode: semantic (heading-aware), section (paragraph-boundary), page"),
      chunk_size: z
        .number()
        .optional()
        .default(1200)
        .describe("Maximum chunk size in characters (chunk mode)"),
      overlap: z
        .number()
        .optional()
        .default(200)
        .describe("Chunk overlap in characters (chunk mode)"),
      compare_with: z
        .string()
        .optional()
        .describe("Second file path for 'compare' mode"),
      output_format: z
        .enum(["json", "jsonl"])
        .default("json")
        .describe("Output format: json (single object) or jsonl (one JSON per line, for streaming chunks)"),
    },

    async (args) => {
      const filePath = String(args.file_path ?? "");

      // F1 AMANAH: validate file exists and is readable
      if (!filePath || !existsSync(filePath)) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: `File not found or not accessible: ${filePath}`,
                verdict: "VOID",
                floor: "F1",
              }),
            },
          ],
          isError: true,
        };
      }

      // Build CLI args
      const cliParts: string[] = [`"${filePath}"`, `--mode ${args.mode}`];

      if (args.pages) cliParts.push(`--pages ${args.pages}`);
      if (args.ocr) cliParts.push("--ocr");
      if (args.mode === "chunk" && args.chunk_strategy)
        cliParts.push(`--strategy ${args.chunk_strategy}`);
      if (args.chunk_size) cliParts.push(`--chunk-size ${args.chunk_size}`);
      if (args.overlap) cliParts.push(`--overlap ${args.overlap}`);
      if (args.mode === "compare" && args.compare_with)
        cliParts.push(`--compare-with "${args.compare_with}"`);
      if (args.output_format) cliParts.push(`--output ${args.output_format}`);

      const cliArgs = cliParts.join(" ");

      const result = runEngine(cliArgs);

      if (!result.ok) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: result.error,
                file: filePath,
                mode: args.mode,
              }),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text:
              args.output_format === "jsonl"
                ? JSON.stringify(result.data)
                : JSON.stringify(result.data, null, 2),
          },
        ],
      };
    },
  );
}
