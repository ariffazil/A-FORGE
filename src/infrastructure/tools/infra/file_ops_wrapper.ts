/**
 * INFRA TOOL: file_ops_wrapper.ts
 * ================================
 * Forged: 2026-06-14 by FORGE (000Ω)
 * Risk bands:
 *   file_ops.readFile / listDir / findFiles → OBSERVE, FULL_AUTO
 *   file_ops.writeFile / mkdir / copyFile      → MUTATE, APPROVE_ONLY
 *   file_ops.moveFile                          → MUTATE, HUMAN_ONLY
 *   file_ops.deleteFile                        → BLOCKED
 * 
 * Bounded to /root workspace. No operations outside workspace.
 * F1 AMANAH: backup before overwrite. Never delete — move to trash.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  requireMutationApproval,
  resolveWorkspacePath,
} from "./safety.js";
import { writePending, complete } from "./receiptClient.js";

const WORKSPACE_ROOT = '/root';
const TRASH_DIR = '/tmp/forge_trash';
const MAX_READ_BYTES = 100_000;

// Ensure trash exists
try { fs.mkdirSync(TRASH_DIR, { recursive: true }); } catch {}

// ─── SAFETY ───────────────────────────────────────────────────────

function safePath(filePath: string): string {
  return resolveWorkspacePath(filePath, WORKSPACE_ROOT);
}

interface FileOpResult {
  success: boolean;
  path?: string;
  src?: string;
  dest?: string;
  action?: string;
  backup?: string;
  error?: string;
  gated?: boolean;
  riskBand?: string;
}

async function hold(action: string, target: string, lease_id?: string): Promise<FileOpResult | null> {
  const gate = await requireMutationApproval(`file_ops.${action}`, target, lease_id);
  if (gate.allowed) return null;
  return {
    success: false,
    path: target,
    action,
    error: gate.error,
    gated: true,
    riskBand: action === "move" ? "HUMAN_ONLY" : "APPROVE_ONLY",
  };
}

// ─── READ ─────────────────────────────────────────────────────────

export async function readFile(filePath: string, maxBytes: number = MAX_READ_BYTES): Promise<string> {
  const resolved = safePath(filePath);
  if (!fs.existsSync(resolved)) return `[FILE NOT FOUND: ${filePath}]`;
  
  const stat = fs.statSync(resolved);
  if (stat.size > maxBytes) {
    return `[FILE TOO LARGE: ${filePath} — ${(stat.size / 1024).toFixed(1)}KB exceeds ${(maxBytes / 1024).toFixed(1)}KB limit. Use offset/limit to read chunks.]`;
  }
  
  return fs.readFileSync(resolved, 'utf-8');
}

export async function listDir(dirPath: string): Promise<string[]> {
  const resolved = safePath(dirPath);
  if (!fs.existsSync(resolved)) return [];
  if (!fs.statSync(resolved).isDirectory()) return [`[NOT A DIRECTORY: ${dirPath}]`];
  
  const entries = fs.readdirSync(resolved, { withFileTypes: true });
  return entries.map(e => `${e.isDirectory() ? '📁' : '📄'} ${e.name}${e.isDirectory() ? '/' : ''}`);
}

export async function findFiles(pattern: string, root: string = WORKSPACE_ROOT): Promise<string[]> {
  const resolved = safePath(root);
  if (!fs.existsSync(resolved)) return [];
  
  const results: string[] = [];
  const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'), 'i');
  
  function walk(dir: string, depth: number = 0) {
    if (depth > 4) return;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (full.includes('node_modules') || full.includes('.git/') || full.includes('.secrets')) continue;
        if (regex.test(entry.name)) results.push(full);
        if (entry.isDirectory()) walk(full, depth + 1);
      }
    } catch {}
  }
  
  walk(resolved);
  return results.slice(0, 200);
}

// ─── WRITE (GATED) ────────────────────────────────────────────────

export async function writeFile(
  filePath: string,
  content: string,
  ackOverwrite: boolean = false,
  lease_id?: string,
): Promise<FileOpResult> {
  const resolved = safePath(filePath);
  const gate = await hold('write', resolved, lease_id);
  if (gate) return gate;

  if (fs.existsSync(resolved) && !ackOverwrite) {
    return { success: false, path: filePath, action: 'write',
             error: `File exists. Set ackOverwrite=true to proceed. F1 AMANAH: backup will be created.` };
  }

  // F1 AMANAH: backup before overwrite
  let backup: string | undefined;
  if (fs.existsSync(resolved)) {
    backup = `${TRASH_DIR}/${path.basename(resolved)}.${Date.now()}.bak`;
    fs.copyFileSync(resolved, backup);
  }

  // Doctrine §3.5: log BEFORE the action (DB = reality)
  const receipt_id = await writePending({
    source_system: "local_fs",
    source_subdomain: "a-forge:file_ops",
    action_type: "file_write",
    target: resolved,
    parameters: {
      size_bytes: Buffer.byteLength(content, 'utf-8'),
      ackOverwrite,
      lease_id: lease_id ?? null,
      path_from: filePath,
    },
    risk_tier: 2,
    floor_refs: ["F1", "F11"],
    ack_irreversible: fs.existsSync(resolved),
    actor_id: "a-forge:file_ops",
    metadata: { action: "file_write", backup: backup ?? null },
  });

  try {
    fs.writeFileSync(resolved, content, 'utf-8');
    if (receipt_id) {
      await complete({ receipt_id, result: "success", external_reference: backup ?? null });
    }
    return { success: true, path: filePath, action: 'write', backup };
  } catch (e: any) {
    if (receipt_id) {
      await complete({ receipt_id, result: "failure", error_message: e?.message ?? String(e) });
    }
    return { success: false, path: filePath, action: 'write', error: e?.message ?? String(e) };
  }
}

export async function mkdir(dirPath: string, lease_id?: string): Promise<FileOpResult> {
  const resolved = safePath(dirPath);
  const gate = await hold('mkdir', resolved, lease_id);
  if (gate) return gate;

  const receipt_id = await writePending({
    source_system: "local_fs",
    source_subdomain: "a-forge:file_ops",
    action_type: "mkdir",
    target: resolved,
    parameters: { lease_id: lease_id ?? null, path_from: dirPath },
    risk_tier: 1,
    floor_refs: ["F11"],
    actor_id: "a-forge:file_ops",
    metadata: { action: "mkdir" },
  });

  try {
    fs.mkdirSync(resolved, { recursive: true });
    if (receipt_id) {
      await complete({ receipt_id, result: "success" });
    }
    return { success: true, path: dirPath };
  } catch (e: any) {
    if (receipt_id) {
      await complete({ receipt_id, result: "failure", error_message: e?.message ?? String(e) });
    }
    return { success: false, path: dirPath, error: e?.message ?? String(e) };
  }
}

export async function copyFile(src: string, dest: string, lease_id?: string): Promise<FileOpResult> {
  const srcPath = safePath(src);
  const destPath = safePath(dest);
  const gate = await hold('copy', destPath, lease_id);
  if (gate) return { ...gate, src, dest };
  if (!fs.existsSync(srcPath)) return { success: false, src, dest, error: 'Source not found' };

  const receipt_id = await writePending({
    source_system: "local_fs",
    source_subdomain: "a-forge:file_ops",
    action_type: "file_copy",
    target: `${srcPath} -> ${destPath}`,
    parameters: { src_path: srcPath, dest_path: destPath, lease_id: lease_id ?? null },
    risk_tier: 1,
    floor_refs: ["F11"],
    actor_id: "a-forge:file_ops",
    metadata: { action: "file_copy" },
  });

  try {
    fs.copyFileSync(srcPath, destPath);
    if (receipt_id) {
      await complete({ receipt_id, result: "success" });
    }
    return { success: true, src, dest };
  } catch (e: any) {
    if (receipt_id) {
      await complete({ receipt_id, result: "failure", error_message: e?.message ?? String(e) });
    }
    return { success: false, src, dest, error: e?.message ?? String(e) };
  }
}

export async function moveFile(src: string, dest: string, lease_id?: string): Promise<FileOpResult> {
  const srcPath = safePath(src);
  const destPath = safePath(dest);
  const gate = await hold('move', `${srcPath} -> ${destPath}`, lease_id);
  if (gate) return { ...gate, src, dest };
  if (!fs.existsSync(srcPath)) return { success: false, src, dest, error: 'Source not found' };

  const receipt_id = await writePending({
    source_system: "local_fs",
    source_subdomain: "a-forge:file_ops",
    action_type: "file_move",
    target: `${srcPath} -> ${destPath}`,
    parameters: { src_path: srcPath, dest_path: destPath, lease_id: lease_id ?? null },
    risk_tier: 2,
    floor_refs: ["F1", "F11"],
    ack_irreversible: true,
    actor_id: "a-forge:file_ops",
    metadata: { action: "file_move", risk: "HUMAN_ONLY" },
  });

  try {
    fs.renameSync(srcPath, destPath);
    if (receipt_id) {
      await complete({ receipt_id, result: "success" });
    }
    return { success: true, src, dest };
  } catch (e: any) {
    if (receipt_id) {
      await complete({ receipt_id, result: "failure", error_message: e?.message ?? String(e) });
    }
    return { success: false, src, dest, error: e?.message ?? String(e) };
  }
}

// deleteFile is BLOCKED per F1 AMANAH. Use moveFile to trash instead.
export async function deleteFile(_filePath: string): Promise<{ success: boolean; error: string }> {
  return { success: false, error: 'BLOCKED: F1 AMANAH — use moveFile to /tmp/forge_trash instead. Nothing is truly deleted.' };
}

export const fileOpsWrapper = {
  readFile, listDir, findFiles,
  writeFile, mkdir, copyFile, moveFile,
  delete: deleteFile,
};
export default fileOpsWrapper;
