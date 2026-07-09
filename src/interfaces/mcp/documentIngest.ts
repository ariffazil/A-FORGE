/**
 * forge_document_ingest — A-FORGE Document Intelligence Tool
 * ======================================================
 * Phase 1 MVP. Layout-first document processing with bounding-box provenance.
 *
 * 2026-07-09 fixes:
 *   - Multi-format: text/json/md/source via native path (not only PDF/pymupdf)
 *   - PrivateTmp-safe: stage host-inaccessible paths into A-FORGE data dir
 *   - spawnSync argv (no shell quoting bugs); engine path multi-candidate
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given.
 */

import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  accessSync,
  constants,
  copyFileSync,
  mkdirSync,
  writeFileSync,
  realpathSync,
} from "node:fs";
import { resolve, dirname, basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));

const STAGING_DIR = process.env.AFORGE_DOC_STAGING || "/root/A-FORGE/data/document-ingest-staging";

function resolveEngineScript(): string {
  const candidates = [
    resolve(__dirname, "../../infrastructure/tools/document_ingest.py"),
    resolve(__dirname, "../../../src/infrastructure/tools/document_ingest.py"),
    "/root/A-FORGE/src/infrastructure/tools/document_ingest.py",
    "/root/A-FORGE/dist/src/infrastructure/tools/document_ingest.py",
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0];
}

const ENGINE_SCRIPT = resolveEngineScript();

function ensureStagingDir(): void {
  try {
    mkdirSync(STAGING_DIR, { recursive: true });
  } catch {
    /* best effort */
  }
}

/**
 * Make file readable inside the a-forge-mcp service namespace.
 * PrivateTmp=true hides host /tmp — stage into ReadWritePaths when needed.
 * Also supports content_base64 when path is outside the membrane.
 */
function materializeReadablePath(
  filePath: string,
  contentBase64?: string,
): { path: string; staged: boolean; error?: string } {
  ensureStagingDir();

  if (contentBase64) {
    try {
      const buf = Buffer.from(contentBase64, "base64");
      const ext = extname(filePath || "") || ".bin";
      const stagedPath = join(STAGING_DIR, `upload-${randomUUID()}${ext}`);
      writeFileSync(stagedPath, buf);
      return { path: stagedPath, staged: true };
    } catch (e: any) {
      return { path: filePath, staged: false, error: `content_base64 decode failed: ${e.message}` };
    }
  }

  if (!filePath) {
    return { path: "", staged: false, error: "file_path required (or content_base64)" };
  }

  // Direct access (works for /root, /root/A-FORGE under ProtectHome=read-only)
  try {
    if (existsSync(filePath)) {
      accessSync(filePath, constants.R_OK);
      return { path: realpathSync(filePath), staged: false };
    }
  } catch {
    /* fall through to staging attempts */
  }

  // Already staged under our data dir
  const stagedGuess = join(STAGING_DIR, basename(filePath));
  try {
    if (existsSync(stagedGuess)) {
      accessSync(stagedGuess, constants.R_OK);
      return { path: realpathSync(stagedGuess), staged: true };
    }
  } catch {
    /* continue */
  }

  // Try copy from path (may fail if PrivateTmp isolation)
  try {
    if (existsSync(filePath)) {
      const dest = join(STAGING_DIR, `${randomUUID()}-${basename(filePath)}`);
      copyFileSync(filePath, dest);
      return { path: dest, staged: true };
    }
  } catch (e: any) {
    return {
      path: filePath,
      staged: false,
      error:
        `File not accessible in service FS namespace: ${filePath} (${e.message}). ` +
        `Host /tmp is PrivateTmp-isolated — place under /root or /root/A-FORGE, or pass content_base64.`,
    };
  }

  return {
    path: filePath,
    staged: false,
    error:
      `File not found or not accessible: ${filePath}. ` +
      `Place under /root or /root/A-FORGE (not host /tmp), or pass content_base64.`,
  };
}

function runEngine(argv: string[]): { ok: boolean; data: any; error?: string } {
  try {
    const result = spawnSync("/usr/bin/python3", [ENGINE_SCRIPT, ...argv], {
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
      encoding: "utf-8",
      env: {
        ...process.env,
        TMPDIR: STAGING_DIR,
        AFORGE_DOC_STAGING: STAGING_DIR,
        PYTHONUNBUFFERED: "1",
      },
      cwd: "/root/A-FORGE",
    });

    const stdout = (result.stdout || "").trim();
    const stderr = (result.stderr || "").trim();

    if (stdout) {
      // Engine may emit pretty-printed multi-line JSON — parse full stdout first.
      // jsonl mode: one object per line (take as array if multiple).
      try {
        const parsed = JSON.parse(stdout);
        if (parsed && typeof parsed === "object" && parsed.error) {
          return { ok: false, data: null, error: parsed.error };
        }
        return { ok: true, data: parsed };
      } catch {
        /* try jsonl / last object */
      }
      try {
        const lines = stdout.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.length > 1) {
          const objs = lines.map((l) => JSON.parse(l));
          return { ok: true, data: objs.length === 1 ? objs[0] : objs };
        }
        const parsed = JSON.parse(lines[lines.length - 1] || stdout);
        if (parsed.error) return { ok: false, data: null, error: parsed.error };
        return { ok: true, data: parsed };
      } catch (pe: any) {
        if (result.status === 0) {
          return {
            ok: false,
            data: null,
            error: `JSON parse failed: ${pe.message}; stdout head: ${stdout.slice(0, 200)}`,
          };
        }
      }
    }

    if (result.error) {
      return { ok: false, data: null, error: String(result.error.message || result.error) };
    }
    if (result.status !== 0) {
      return {
        ok: false,
        data: null,
        error: stderr || stdout || `engine exit ${result.status}`,
      };
    }
    return { ok: false, data: null, error: "Empty engine output" };
  } catch (err: any) {
    return {
      ok: false,
      data: null,
      error: err.stderr || err.message || "Unknown engine error",
    };
  }
}

export function registerDocumentIngestTool(server: McpServer): void {
  server.tool(
    "forge_document_ingest",
    `Document intelligence engine — layout-first parsing with bounding-box provenance.

Modes:
  analyze  — Layout analysis only. Return structure tree with element types and positions.
  extract  — Full pipeline: layout + text extraction + structured JSON with bbox coordinates.
  chunk    — Extract then semantic chunk for RAG consumption (strategies: semantic, section, page).
  compare  — Diff two documents (structural + text similarity).

Formats: PDF + images (pymupdf/OCR) AND text/json/md/yaml/source (native text pipeline).
Paths: prefer /root or /root/A-FORGE. Host /tmp is PrivateTmp-isolated — use content_base64 or stage under A-FORGE data.

Blast radius: LOW (read-only). Reversibility: FULL.`,

    {
      file_path: z
        .string()
        .optional()
        .describe("Absolute path to the document (prefer /root or /root/A-FORGE)"),
      content_base64: z
        .string()
        .optional()
        .describe("Optional base64 file bytes when path is outside service FS (e.g. host /tmp)"),
      mode: z
        .enum(["analyze", "extract", "chunk", "compare"])
        .default("extract")
        .describe("Processing mode"),
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
        .describe("Chunk strategy for 'chunk' mode"),
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
        .describe("Output format"),
    },

    async (args) => {
      const filePath = String(args.file_path ?? "");
      const contentB64 = typeof args.content_base64 === "string" ? args.content_base64 : undefined;

      const material = materializeReadablePath(filePath, contentB64);
      if (material.error || !material.path) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: material.error || "file_path required",
                verdict: "VOID",
                floor: "F1",
                hint: "Use path under /root|/root/A-FORGE, or content_base64",
              }),
            },
          ],
          isError: true,
        };
      }

      const argv: string[] = [material.path, "--mode", String(args.mode ?? "extract")];

      if (args.pages) argv.push("--pages", String(args.pages));
      if (args.ocr) argv.push("--ocr");
      if (args.mode === "chunk" && args.chunk_strategy) {
        argv.push("--strategy", String(args.chunk_strategy));
      }
      if (args.chunk_size) argv.push("--chunk-size", String(args.chunk_size));
      if (args.overlap) argv.push("--overlap", String(args.overlap));
      if (args.mode === "compare" && args.compare_with) {
        const other = materializeReadablePath(String(args.compare_with));
        if (other.error || !other.path) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: `compare_with: ${other.error}` }),
              },
            ],
            isError: true,
          };
        }
        argv.push("--compare-with", other.path);
      }
      if (args.output_format) argv.push("--output", String(args.output_format));

      const result = runEngine(argv);

      if (!result.ok) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: result.error,
                file: material.path,
                original_path: filePath || null,
                staged: material.staged,
                mode: args.mode,
                engine: ENGINE_SCRIPT,
              }),
            },
          ],
          isError: true,
        };
      }

      // Annotate original path if staged
      if (result.data && typeof result.data === "object" && material.staged) {
        result.data.original_path = filePath || null;
        result.data.staged_path = material.path;
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
