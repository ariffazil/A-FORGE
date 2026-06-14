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
  type ApprovalLease,
} from "./safety.js";

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

function hold(action: string, target: string, lease?: ApprovalLease): FileOpResult | null {
  const gate = requireMutationApproval(`file_ops.${action}`, target, lease);
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
  approvalLease?: ApprovalLease,
): Promise<FileOpResult> {
  const resolved = safePath(filePath);
  const gate = hold('write', resolved, approvalLease);
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
  
  fs.writeFileSync(resolved, content, 'utf-8');
  return { success: true, path: filePath, action: 'write', backup };
}

export async function mkdir(dirPath: string, approvalLease?: ApprovalLease): Promise<FileOpResult> {
  const resolved = safePath(dirPath);
  const gate = hold('mkdir', resolved, approvalLease);
  if (gate) return gate;
  fs.mkdirSync(resolved, { recursive: true });
  return { success: true, path: dirPath };
}

export async function copyFile(src: string, dest: string, approvalLease?: ApprovalLease): Promise<FileOpResult> {
  const srcPath = safePath(src);
  const destPath = safePath(dest);
  const gate = hold('copy', destPath, approvalLease);
  if (gate) return { ...gate, src, dest };
  if (!fs.existsSync(srcPath)) return { success: false, src, dest, error: 'Source not found' };
  fs.copyFileSync(srcPath, destPath);
  return { success: true, src, dest };
}

export async function moveFile(src: string, dest: string, approvalLease?: ApprovalLease): Promise<FileOpResult> {
  const srcPath = safePath(src);
  const destPath = safePath(dest);
  const gate = hold('move', `${srcPath} -> ${destPath}`, approvalLease);
  if (gate) return { ...gate, src, dest };
  if (!fs.existsSync(srcPath)) return { success: false, src, dest, error: 'Source not found' };
  fs.renameSync(srcPath, destPath);
  return { success: true, src, dest };
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
