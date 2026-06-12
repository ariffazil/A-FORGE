/**
 * A-FORGE — Repo Steward Routes (Ω — 2026-06-07)
 *
 * 4 read-only endpoints for repo organization observation:
 *  - GET /api/sot-validator       : federation-wide SOT drift (arifOS /inspector/sot + per-organ tool counts)
 *  - GET /api/registry-trinity    : reconcile 4 tool_registry.json files (canonical / v2-roadmap / archive / mirror)
 *  - GET /api/repo-entropy        : per-repo entropy signals (.md, .bak, .tmp, dirty, unpushed, branch, last-commit-age)
 *  - GET /api/steward-suggest     : non-executing plan from WORKFLOW_REPO_STEWARD.md + live entropy
 *
 * Authority: A-FORGE observes. arifOS judges. Returns 200 always (verdict in body).
 * Pattern: federation-probe (parallel fan-out + timeout + GREEN/YELLOW/RED verdict).
 *
 * 7 sovereign repos (not a monorepo): arifOS, A-FORGE, AAA, geox, WEALTH, WELL, APEX.
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { readFileSync, existsSync, statSync } from "fs";
import { execSync } from "child_process";
import { createHash } from "crypto";
import * as http from "http";

// ─── Federation repo atlas (canonical, matches federation-probe topology) ───

interface RepoEntry {
  name: string;
  path: string;
  remote: string; // expected remote shorthand (lowercase, no .git)
  primary_branch: string;
}

const REPO_ATLAS: RepoEntry[] = [
  { name: "arifOS",  path: (process.env.ARIFOS_HOME || "/root") + "/arifOS", remote: "ariffazil/arifos",  primary_branch: "main" },
  { name: "A-FORGE", path: "/root/A-FORGE", remote: "ariffazil/a-forge", primary_branch: "main" },
  { name: "AAA",     path: (process.env.ARIFOS_HOME || "/root") + "/AAA",     remote: "ariffazil/aaa",     primary_branch: "main" },
  { name: "geox",    path: (process.env.ARIFOS_HOME || "/root") + "/geox",    remote: "ariffazil/geox",    primary_branch: "main" },
  { name: "WEALTH",  path: (process.env.ARIFOS_HOME || "/root") + "/WEALTH",  remote: "ariffazil/wealth",  primary_branch: "main" },
  { name: "WELL",    path: (process.env.ARIFOS_HOME || "/root") + "/WELL",    remote: "ariffazil/well",    primary_branch: "main" },
  { name: "APEX",    path: "/root/APEX",    remote: "ariffazil/apex",    primary_branch: "apex" },
];

// ─── Small helpers (sync, local, fast — all reads are <50ms) ───

function safeExec(cmd: string, cwd: string, timeoutMs = 5000): string {
  try {
    return execSync(cmd, { cwd, encoding: "utf8", timeout: timeoutMs, stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

// safeCount: counts non-empty lines of command output (use for `git status --short`, `git log`).
function safeCount(cmd: string, cwd: string): number {
  const out = safeExec(cmd, cwd);
  if (!out) return 0;
  return out.split("\n").filter((l) => l.trim()).length;
}

// countOne: parses the FIRST line of command output as a number (use for `... | wc -l` or `wc -c`).
function countOne(cmd: string, cwd: string): number {
  const out = safeExec(cmd, cwd);
  if (!out) return 0;
  const first = out.split("\n").find((l) => l.trim());
  if (!first) return 0;
  const n = parseInt(first.trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

function sha256(buf: string | Buffer): string {
  return createHash("sha256").update(buf).digest("hex").slice(0, 16);
}

function httpGetJson(url: string, timeoutMs = 3000): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    const start = Date.now();
    let settled = false;
    const finish = (status: number, body: any) => {
      if (settled) return;
      settled = true;
      resolve({ status, body });
    };
    try {
      const req = http.get(url, { timeout: timeoutMs }, (r) => {
        let buf = "";
        r.setEncoding("utf8");
        r.on("data", (c) => (buf += c));
        r.on("end", () => {
          let parsed: any = buf;
          try { parsed = JSON.parse(buf); } catch { /* keep raw */ }
          finish(r.statusCode ?? 0, parsed);
        });
      });
      req.on("timeout", () => { req.destroy(new Error("timeout")); });
      req.on("error", () => finish(0, null));
      req.setTimeout(timeoutMs);
    } catch {
      finish(0, null);
    }
  });
}

// ─── Per-organ tool count extraction ───
//
// arifOS:    /inspector/sot    → {verdict, live_count, main_count}
// WEALTH:    /health           → {public_surface_count, runtime_surface_count}
// WELL:      /health           → {tool_count}
// GEOX:      /health           → no count field; fallback to /mcp tools/list (Streamable HTTP initialize)
//
// We probe in parallel and degrade gracefully.

interface OrganSot {
  organ: string;
  url: string;
  reachable: boolean;
  live_count?: number;
  registry_count?: number;
  verdict: "SEAL" | "SABAR" | "VOID" | "DOWN" | "UNKNOWN";
  raw_keys?: string[];
  latency_ms: number;
  source: string;
}

async function probeArifOS(): Promise<OrganSot> {
  const t0 = Date.now();
  const r = await httpGetJson("http://127.0.0.1:8088/inspector/sot");
  if (r.status !== 200 || !r.body) {
    return { organ: "arifOS", url: ":8088/inspector/sot", reachable: false, verdict: "DOWN", latency_ms: Date.now() - t0, source: "arifOS" };
  }
  const b = r.body;
  return {
    organ: "arifOS",
    url: ":8088/inspector/sot",
    reachable: true,
    live_count: b.live_count,
    registry_count: b.main_count,
    verdict: b.verdict || "UNKNOWN",
    raw_keys: Object.keys(b),
    latency_ms: Date.now() - t0,
    source: b.sot_source || "github:ariffazil/arifOS/main",
  };
}

async function probeSimple(organ: string, port: number, countKeys: string[]): Promise<OrganSot> {
  const t0 = Date.now();
  const r = await httpGetJson(`http://127.0.0.1:${port}/health`);
  if (r.status !== 200 || !r.body) {
    return { organ, url: `:${port}/health`, reachable: false, verdict: "DOWN", latency_ms: Date.now() - t0, source: organ };
  }
  const b = r.body;
  let live: number | undefined;
  for (const k of countKeys) {
    if (typeof b[k] === "number") { live = b[k]; break; }
  }
  return {
    organ,
    url: `:${port}/health`,
    reachable: true,
    live_count: live,
    verdict: live !== undefined ? "SEAL" : "UNKNOWN",
    raw_keys: Object.keys(b),
    latency_ms: Date.now() - t0,
    source: organ,
  };
}

// ─── /api/sot-validator ───
//
// Fans out to arifOS /inspector/sot + WEALTH/WELL/GEOX /health. Returns
// per-organ counts and an aggregate verdict. Pure observation — arifOS
// remains the only adjudicator.
//
// Verdict rules:
//   GREEN  : all 4 organs reachable AND all counts non-zero
//   YELLOW : 1 organ DOWN or count=0
//   RED    : 2+ organs DOWN

async function handleSotValidator(_req: Request, res: Response) {
  const [arifOS, WEALTH, WELL, GEOX] = await Promise.all([
    probeArifOS(),
    probeSimple("WEALTH", 18082, ["public_surface_count", "runtime_surface_count"]),
    probeSimple("WELL",   18083, ["tool_count"]),
    probeSimple("GEOX",   8081,  ["tool_count", "surface_size", "registry_size"]),
  ]);
  const organs: OrganSot[] = [arifOS, WEALTH, WELL, GEOX];
  const down = organs.filter((o) => !o.reachable).length;
  // zero = explicitly 0 (drift); undefined = organ healthy but doesn't expose a count key (informational, not drift)
  const zero = organs.filter((o) => o.reachable && o.live_count === 0).length;
  const noCountKey = organs.filter((o) => o.reachable && o.live_count === undefined).length;
  const verdict = down >= 2 ? "RED" : (down === 1 || zero >= 1) ? "YELLOW" : "GREEN";
  res.json({
    ok: verdict === "GREEN",
    service: "A-FORGE",
    endpoint: "/api/sot-validator",
    timestamp: new Date().toISOString(),
    verdict,
    organs,
    summary: {
      total: organs.length,
      reachable: organs.length - down,
      down,
      zero_count: zero,
      no_count_key: noCountKey,
    },
    note: "A-FORGE observes only. arifOS adjudicts. no_count_key (e.g. GEOX) means the organ is healthy but its /health endpoint does not expose a numeric tool count — informational, not drift. zero_count means the organ reports 0 tools, which IS drift.",
  });
}

// ─── /api/registry-trinity ───
//
// Reconciles the 4 tool_registry.json files in arifOS + APEX:
//   1. arifOS/arifosmcp/tool_registry.json                      (current, canonical, 13 tools)
//   2. arifOS/arifosmcp/tool_registry_v2.json                   (working roadmap, 79 tools with state machine)
//   3. arifOS/arifosmcp/archive/legacy/tool_registry_v2.json    (historical archive, 91 tools)
//   4. arifOS/APEX/ASF1/tool_registry.json                      (APEX mirror, 13 tools)
//
// Each gets: path, size, sha256[16], tool_count, exists, role, state_distribution (v2 only).
//
// Drift detection: if v2.archive's "LIVE" count != canonical's count → SOT_MISMATCH.

const REGISTRY_FILES: { path: string; role: string; label: string }[] = [
  { path: "/root/arifOS/arifosmcp/tool_registry.json",                   role: "canonical",       label: "Current canonical surface — source of truth for live" },
  { path: "/root/arifOS/arifosmcp/tool_registry_v2.json",                role: "working_roadmap", label: "v2 working registry — LIVE/HOLD/FORGED state machine, larger working set" },
  { path: "/root/arifOS/arifosmcp/archive/legacy/tool_registry_v2.json", role: "archive_history", label: "Historical archive — pre-Phoenix-72 registry, kept for audit only" },
  { path: "/root/arifOS/APEX/ASF1/tool_registry.json",                   role: "mirror",          label: "APEX mirror — should match canonical" },
];

interface RegistryReport {
  path: string;
  role: string;
  label: string;
  exists: boolean;
  size_bytes: number;
  sha256_16: string;
  tool_count: number;
  state_distribution?: Record<string, number>;
}

function readRegistry(entry: { path: string; role: string; label: string }): RegistryReport {
  if (!existsSync(entry.path)) {
    return { path: entry.path, role: entry.role, label: entry.label, exists: false, size_bytes: 0, sha256_16: "", tool_count: 0 };
  }
  let buf: string;
  try { buf = readFileSync(entry.path, "utf8"); } catch { buf = ""; }
  let count = 0;
  let dist: Record<string, number> | undefined;
  try {
    const j = JSON.parse(buf);
    let tools: any[];
    if (Array.isArray(j)) {
      tools = j;
    } else if (Array.isArray(j?.tools)) {
      tools = j.tools;
    } else if (j?.tools && typeof j.tools === "object") {
      // tools is a dict keyed by tool name (canonical + APEX mirror format)
      tools = Object.values(j.tools);
    } else {
      tools = [];
    }
    count = tools.length;
    if (entry.role === "working_roadmap" || entry.role === "archive_history") {
      dist = {};
      for (const t of tools) {
        const s = (t && (t.state || t.status)) ? String(t.state || t.status).toUpperCase() : "UNKNOWN";
        dist[s] = (dist[s] || 0) + 1;
      }
    }
  } catch { /* keep count=0 */ }
  return {
    path: entry.path,
    role: entry.role,
    label: entry.label,
    exists: true,
    size_bytes: buf.length,
    sha256_16: buf ? sha256(buf) : "",
    tool_count: count,
    state_distribution: dist,
  };
}

function handleRegistryTrinity(_req: Request, res: Response) {
  const reports = REGISTRY_FILES.map(readRegistry);
  const canonical = reports.find((r) => r.role === "canonical")!;
  const v2Live = reports.find((r) => r.role === "working_roadmap")?.state_distribution?.LIVE ?? 0;
  const archiveLive = reports.find((r) => r.role === "archive_history")?.state_distribution?.LIVE ?? 0;
  const mirror = reports.find((r) => r.role === "mirror")!;

  // Drift detection
  const mismatches: string[] = [];
  if (canonical.exists && v2Live > 0 && v2Live !== canonical.tool_count) {
    mismatches.push(`v2.LIVE=${v2Live} != canonical=${canonical.tool_count}`);
  }
  if (canonical.exists && mirror.exists && canonical.sha256_16 !== mirror.sha256_16 && mirror.tool_count !== canonical.tool_count) {
    mismatches.push(`mirror.tool_count=${mirror.tool_count} != canonical=${canonical.tool_count}`);
  }
  if (archiveLive > 0 && archiveLive !== canonical.tool_count) {
    mismatches.push(`archive.LIVE=${archiveLive} != canonical=${canonical.tool_count}`);
  }

  const verdict = mismatches.length === 0 ? "GREEN" : (mismatches.length === 1 ? "YELLOW" : "RED");

  res.json({
    ok: verdict === "GREEN",
    service: "A-FORGE",
    endpoint: "/api/registry-trinity",
    timestamp: new Date().toISOString(),
    verdict,
    registries: reports,
    drift: {
      canonical_live: canonical.tool_count,
      v2_live: v2Live,
      archive_live: archiveLive,
      mirror_count: mirror.tool_count,
      mismatches,
    },
    note: mismatches.length === 0
      ? "All 4 registries are consistent (or in expected state-machine form). No drift."
      : "Drift detected between registry roles. Most common cause: retired/queued tools not yet promoted to archive. Recommended action: /api/steward-suggest.",
  });
}

// ─── /api/repo-entropy ───
//
// For each of 7 sovereign repos, compute:
//   - branch, HEAD (short), dirty_count, unpushed_count
//   - md_count, bak_count, tmp_count (excl. node_modules / .git / venv / __pycache__ / dist / coverage / node_modules / data)
//   - last_commit_age_days, last_commit_ts
//   - size_mb (working tree only, no .git)
//
// Returns per-repo rows + aggregate entropy score.

const ENTROPY_EXCLUDES = [
  "*/node_modules/*",
  "*/.git/*",
  "*/venv/*",
  "*/.venv/*",
  "*/__pycache__/*",
  "*/dist/*",
  "*/coverage/*",
  "*/data/*",
  "*/.opencode/*",
  "*/.ruff_cache/*",
  "*/.pytest_cache/*",
  "*/.cache/*",
];

function findCount(repoPath: string, name: string): number {
  const excludeArgs = ENTROPY_EXCLUDES.map((p) => `-not -path "${p}"`).join(" ");
  return countOne(`find . -name "${name}" ${excludeArgs} -type f 2>/dev/null | wc -l`, repoPath);
}

function entropyForRepo(entry: RepoEntry): any {
  if (!existsSync(entry.path)) {
    return { repo: entry.name, path: entry.path, exists: false };
  }
  const branch = safeExec("git rev-parse --abbrev-ref HEAD 2>/dev/null", entry.path) || "?";
  const head   = safeExec("git rev-parse --short HEAD 2>/dev/null", entry.path) || "?";
  const dirty  = safeCount("git status --short 2>/dev/null", entry.path);
  const unpushed = safeCount("git log --oneline '@{u}..HEAD' 2>/dev/null", entry.path);
  const lastTs = safeExec("git log -1 --format=%ct 2>/dev/null", entry.path);
  const lastCommitAgeDays = lastTs ? Math.floor((Date.now() / 1000 - Number(lastTs)) / 86400) : null;
  const mdCount  = findCount(entry.path, "*.md");
  const bakCount = findCount(entry.path, "*.bak");
  const tmpCount = findCount(entry.path, "*.tmp");

  let sizeMb = 0;
  try {
    const s = statSync(entry.path);
    sizeMb = 0; // working tree size requires du; skip for speed — use `du -sm --exclude`
    const du = safeExec(`du -sm --exclude=.git --exclude=node_modules --exclude=venv --exclude=.venv --exclude=__pycache__ --exclude=dist --exclude=coverage --exclude=data . 2>/dev/null | cut -f1`, entry.path);
    sizeMb = du ? Number(du) : 0;
  } catch { /* keep 0 */ }

  return {
    repo: entry.name,
    path: entry.path,
    exists: true,
    branch,
    head,
    dirty,
    unpushed,
    last_commit_age_days: lastCommitAgeDays,
    md_count: mdCount,
    bak_count: bakCount,
    tmp_count: tmpCount,
    size_mb: sizeMb,
    primary_branch_match: branch === entry.primary_branch,
  };
}

function handleRepoEntropy(_req: Request, res: Response) {
  const rows = REPO_ATLAS.map(entropyForRepo);
  const totals = rows.reduce((acc: any, r: any) => ({
    dirty:    acc.dirty    + (r.dirty ?? 0),
    unpushed: acc.unpushed + (r.unpushed ?? 0),
    md:       acc.md       + (r.md_count ?? 0),
    bak:      acc.bak      + (r.bak_count ?? 0),
    tmp:      acc.tmp      + (r.tmp_count ?? 0),
    size_mb:  acc.size_mb  + (r.size_mb ?? 0),
  }), { dirty: 0, unpushed: 0, md: 0, bak: 0, tmp: 0, size_mb: 0 });

  // Entropy score: weighted sum, capped at 100
  const score = Math.min(100,
    totals.dirty    * 2  +
    totals.unpushed * 3  +
    totals.bak      * 1  +
    totals.tmp      * 1
  );
  const verdict = score >= 30 ? "RED" : score >= 10 ? "YELLOW" : "GREEN";

  res.json({
    ok: verdict !== "RED",
    service: "A-FORGE",
    endpoint: "/api/repo-entropy",
    timestamp: new Date().toISOString(),
    verdict,
    entropy_score: score,
    repos: rows,
    totals,
    note: "Weighted entropy: dirty×2 + unpushed×3 + bak×1 + tmp×1. Cross-organ md_count is informational (AAA is the doc-heavy organ by design).",
  });
}

// ─── /api/steward-suggest ───
//
// Reads /root/A-FORGE/WORKFLOWS/WORKFLOW_REPO_STEWARD.md + live entropy data,
// produces a non-executing forge plan. No mutations. Caller (human or 888_HOLD
// approver) decides whether to execute.

function readWorkflowRef(): { workflow_ref: string; exists: boolean; sha256_16: string; first_40_lines: string[] } {
  const p = "/root/A-FORGE/WORKFLOWS/WORKFLOW_REPO_STEWARD.md";
  if (!existsSync(p)) {
    return { workflow_ref: p, exists: false, sha256_16: "", first_40_lines: [] };
  }
  const buf = readFileSync(p, "utf8");
  return {
    workflow_ref: p,
    exists: true,
    sha256_16: sha256(buf),
    first_40_lines: buf.split("\n").slice(0, 40),
  };
}

function buildSuggestions(rows: any[]): any[] {
  const suggestions: any[] = [];
  for (const r of rows) {
    if (!r.exists) {
      suggestions.push({ repo: r.repo, action: "ABSENT", reason: "path missing", reversible: "n/a", risk: "investigate" });
      continue;
    }
    if (r.dirty > 0) {
      suggestions.push({ repo: r.repo, action: "REVIEW_DIRTY", reason: `${r.dirty} uncommitted changes`, reversible: "git stash / git diff", risk: "low" });
    }
    if (r.unpushed > 0) {
      suggestions.push({ repo: r.repo, action: "REVIEW_UNPUSHED", reason: `${r.unpushed} commits ahead of origin`, reversible: "git push / git reset", risk: "low (after review)" });
    }
    if (r.bak_count > 0) {
      suggestions.push({ repo: r.repo, action: "PRUNE_BAK", reason: `${r.bak_count} *.bak files (age check required for VAULT999/daemon/state)`, reversible: "git checkout -- <file>", risk: "low (after F1 review of which)" });
    }
    if (r.tmp_count > 0) {
      suggestions.push({ repo: r.repo, action: "PRUNE_TMP", reason: `${r.tmp_count} *.tmp files`, reversible: "rm -i", risk: "low" });
    }
    if (r.last_commit_age_days !== null && r.last_commit_age_days > 60) {
      suggestions.push({ repo: r.repo, action: "CHECK_STALENESS", reason: `last commit ${r.last_commit_age_days} days ago`, reversible: "n/a", risk: "investigate" });
    }
    if (!r.primary_branch_match) {
      suggestions.push({ repo: r.repo, action: "BRANCH_DRIFT", reason: `on '${r.branch}', expected '${r.primary_branch}'`, reversible: "git checkout main", risk: "medium" });
    }
  }
  return suggestions;
}

async function handleStewardSuggest(_req: Request, res: Response) {
  // Internal entropy snapshot (don't recurse via HTTP — re-compute inline)
  const rows = REPO_ATLAS.map(entropyForRepo);
  const suggestions = buildSuggestions(rows);

  // Workflow reference (read-only, not executed)
  const wf = readWorkflowRef();

  // Cross-check: also pull live registry trinity state
  const canonical = readRegistry(REGISTRY_FILES[0]);

  const verdict = suggestions.length === 0 ? "GREEN" : suggestions.length <= 3 ? "YELLOW" : "RED";

  res.json({
    ok: verdict !== "RED",
    service: "A-FORGE",
    endpoint: "/api/steward-suggest",
    timestamp: new Date().toISOString(),
    verdict,
    workflow: wf,
    canonical_registry: {
      path: canonical.path,
      sha256_16: canonical.sha256_16,
      tool_count: canonical.tool_count,
    },
    entropy_snapshot_at: new Date().toISOString(),
    suggested_actions: suggestions,
    note: "Non-executing plan. A-FORGE does not auto-execute. Caller (F13 / 888_HOLD) decides. Each action carries reversible + risk metadata for human review.",
  });
}

// ─── Router export ───

export function createRepoStewardRouter(): Router {
  const router = Router();
  router.get("/sot-validator",    handleSotValidator);
  router.get("/registry-trinity", handleRegistryTrinity);
  router.get("/repo-entropy",     handleRepoEntropy);
  router.get("/steward-suggest",  handleStewardSuggest);
  return router;
}
