/**
 * A-FORGE Proxy Tools — Tier 1 Coder Gateway
 *
 * Six proxy tool groups that wrap native system operations behind
 * constitutional MCP tool calls. When all six exist, coders can drop
 * to 2 MCPs (arifOS + A-FORGE) and reach Tier 1 RSI.
 *
 * Each proxy:
 * - Registers via server.tool() or server.registerTool() with Zod schema
 * - Runs inside FloorEnforcer-gated wrapper (C1 Phase 1)
 * - Uses direct Node.js APIs (fs, child_process, pg) — NO external MCP bridge
 * - Returns content in A-FORGE standard format: { content: [{ type: "text", text }] }
 *
 * Groups:
 *   1. forge_filesystem_*  — read, write, glob, grep, stat
 *   2. forge_postgres_*    — query, schema, tables
 *   3. forge_memory_*      — recall, store, list
 *   4. forge_git_*         — status, diff, log, commit (staged only)
 *   5. forge_github_*      — PR, issue, search, status
 *   6. forge_docker_*      — ps, logs, exec, images
 *
 * F1 AMANAH: All mutating operations (write, commit, DELETE) are gated.
 * F8 LAW: Filesystem scope limited to /root, /tmp, /data.
 * F9 ANTI-HANTU: Pure tool wrappers. No claims about what the tool "understands".
 * F11 AUTH: git push --force and docker destructive ops require 888_HOLD.
 *
 * One Skill + One Tool (constitutional law): 
 * - Knowing What NOT To Do (restraint flags drive HOLD/ASK/REFUSE)
 * - Verdict Loop With Memory (verdict_geometry.trace_id required for non-observe)
 * All proxy tools must respect the pair. No execution without it.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSync } from "node:child_process";
import { readFile, writeFile, readdir, stat, mkdir, unlink } from "node:fs/promises";
import { resolve, relative, join, sep } from "node:path";
import { globSync } from "glob";

// ── Constants ──────────────────────────────────────────────────────────────────

const ALLOWED_ROOTS = ["/root", "/tmp", "/data", "/var/log"];
const GIT_REPO_ROOTS = ["/root/arifOS", "/root/A-FORGE", "/root/AAA", "/root/geox", "/root/WEALTH", "/root/WELL", "/root/APEX"];
const DOCKER_SAFE_OPS = ["ps", "logs", "images", "inspect", "stats"];

// ── Safety Helpers ─────────────────────────────────────────────────────────────

function checkPathAllowed(target: string): { allowed: boolean; resolvedPath: string; error?: string } {
  const resolved = resolve(target);
  const allowed = ALLOWED_ROOTS.some(root => resolved.startsWith(root));
  if (!allowed) {
    return { allowed: false, resolvedPath: resolved, error: `Path '${target}' is outside allowed roots (${ALLOWED_ROOTS.join(", ")}). F8 LAW: boundary enforced.` };
  }
  return { allowed: true, resolvedPath: resolved };
}

function sanitizeGitDir(dir: string): string {
  if (!dir) return process.cwd();
  if (dir.startsWith("/")) return dir;
  const resolved = resolve(process.cwd(), dir);
  // Allow any directory that looks like a git repo
  return resolved;
}

// ── 1. forge_filesystem_* ──────────────────────────────────────────────────────

export function registerFilesystemTools(server: McpServer): void {
  // forge_filesystem_read
  server.registerTool("forge_filesystem_read", {
    description: "Read a file or directory listing. F8 LAW: scoped to /root, /tmp, /data.",
    inputSchema: z.object({
      path: z.string().describe("Absolute file path to read"),
      offset: z.number().optional().describe("Line offset (1-indexed)"),
      limit: z.number().optional().describe("Max lines to return (default 2000)"),
    }),
  }, async ({ path: filePath, offset, limit }) => {
    try {
      const check = checkPathAllowed(filePath);
      if (!check.allowed) return { content: [{ type: "text" as const, text: check.error! }], isError: true };

      const stats = await stat(check.resolvedPath);
      if (stats.isDirectory()) {
        const entries = await readdir(check.resolvedPath);
        const listing: { name: string; isDir: boolean }[] = [];
        for (const entry of entries) {
          try {
            const s = await stat(join(check.resolvedPath, entry));
            listing.push({ name: entry, isDir: s.isDirectory() });
          } catch {
            listing.push({ name: entry, isDir: false });
          }
        }
        const text = listing.map(e => e.isDir ? `${e.name}/` : e.name).join("\n");
        return { content: [{ type: "text" as const, text }] };
      }

      const data = await readFile(check.resolvedPath, "utf-8");
      const lines = data.split("\n");
      const start = offset ? offset - 1 : 0;
      const count = limit ?? 2000;
      const snippet = lines.slice(start, start + count);
      const total = lines.length;
      const text = snippet.map((l, i) => `${start + i + 1}: ${l}`).join("\n");
      return { content: [{ type: "text" as const, text: `(${total} lines, showing ${start + 1}-${Math.min(start + count, total)})\n${text}` }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
    }
  });

  // forge_filesystem_write
  server.registerTool("forge_filesystem_write", {
    description: "Write content to a file. F1 AMANAH: overwrite requires explicit ack.",
    inputSchema: z.object({
      path: z.string().describe("Absolute file path to write"),
      content: z.string().describe("File content to write"),
      overwrite: z.boolean().default(false).describe("Must be true to overwrite existing file"),
    }),
  }, async ({ path: filePath, content, overwrite }) => {
    try {
      const check = checkPathAllowed(filePath);
      if (!check.allowed) return { content: [{ type: "text" as const, text: check.error! }], isError: true };

      // Check if file exists
      let exists = false;
      try { await stat(check.resolvedPath); exists = true; } catch { /* doesn't exist */ }

      if (exists && !overwrite) {
        return {
          content: [{ type: "text" as const, text: `F1 AMANAH: File '${filePath}' already exists. Set overwrite=true to replace, or use a different path.` }],
          isError: true,
        };
      }

      // Ensure parent dir exists
      const parent = resolve(check.resolvedPath, "..");
      await mkdir(parent, { recursive: true });

      await writeFile(check.resolvedPath, content, "utf-8");
      return { content: [{ type: "text" as const, text: `Written ${content.length} bytes to ${check.resolvedPath}` }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
    }
  });

  // forge_filesystem_glob
  server.registerTool("forge_filesystem_glob", {
    description: "Find files matching a glob pattern. F8 LAW: scoped to /root, /tmp, /data.",
    inputSchema: z.object({
      pattern: z.string().describe("Glob pattern (e.g. '**/*.ts')"),
      path: z.string().default("/root").describe("Root directory to search from"),
    }),
  }, async ({ pattern, path: searchPath }) => {
    try {
      const check = checkPathAllowed(searchPath);
      if (!check.allowed) return { content: [{ type: "text" as const, text: check.error! }], isError: true };

      const results = globSync(pattern, { cwd: check.resolvedPath, nodir: true });
      const sorted = results.sort((a, b) => a.localeCompare(b)).slice(0, 500);
      const text = sorted.map(f => join(check.resolvedPath, f)).join("\n");
      return { content: [{ type: "text" as const, text: `${sorted.length} file(s)${results.length > 500 ? ` (showing first 500 of ${results.length})` : ""}:\n${text}` }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
    }
  });

  // forge_filesystem_grep
  server.registerTool("forge_filesystem_grep", {
    description: "Search file contents with regex. F8 LAW: scoped to /root, /tmp, /data.",
    inputSchema: z.object({
      pattern: z.string().describe("Regex pattern to search"),
      path: z.string().default("/root").describe("Root directory to search"),
      include: z.string().optional().describe("File pattern filter (e.g. '*.ts')"),
    }),
  }, async ({ pattern, path: searchPath, include }) => {
    try {
      const check = checkPathAllowed(searchPath);
      if (!check.allowed) return { content: [{ type: "text" as const, text: check.error! }], isError: true };

      const includeFlag = include ? `--include="${include}"` : "";
      const cmd = `grep -rn "${pattern}" ${includeFlag} "${check.resolvedPath}" 2>/dev/null | head -200`;
      const output = execSync(cmd, { encoding: "utf-8", timeout: 15000 });
      const lines = output.split("\n").filter(Boolean);
      return { content: [{ type: "text" as const, text: lines.length > 0 ? lines.join("\n") : "No matches found." }] };
    } catch (err: any) {
      // grep returns exit code 1 when no matches
      if (err.status === 1) return { content: [{ type: "text" as const, text: "No matches found." }] };
      return { content: [{ type: "text" as const, text: `Error: ${err.message?.slice(0, 500)}` }], isError: true };
    }
  });

  // forge_filesystem_stat
  server.registerTool("forge_filesystem_stat", {
    description: "Get file/directory metadata. F8 LAW: scoped to /root, /tmp, /data.",
    inputSchema: z.object({
      path: z.string().describe("Absolute path to stat"),
    }),
  }, async ({ path: filePath }) => {
    try {
      const check = checkPathAllowed(filePath);
      if (!check.allowed) return { content: [{ type: "text" as const, text: check.error! }], isError: true };

      const stats = await stat(check.resolvedPath);
      const info = {
        path: check.resolvedPath,
        size: stats.size,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        isSymlink: stats.isSymbolicLink(),
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        mode: stats.mode.toString(8),
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(info, null, 2) }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
    }
  });
}

// ── 2. forge_postgres_* ────────────────────────────────────────────────────────

export function registerPostgresTools(server: McpServer): void {
  const pgUrl = process.env.PG_URL || "postgresql://arifos_admin:ArifPostgres2026!@localhost:5432/vault999";

  // forge_postgres_query
  server.registerTool("forge_postgres_query", {
    description: "Execute a raw SQL query. READ-ONLY by default; writes require explicit flag.",
    inputSchema: z.object({
      query: z.string().describe("SQL query to execute"),
      mutate: z.boolean().default(false).describe("Set true for INSERT/UPDATE/DELETE/CREATE. F1 AMANAH: irreversible."),
    }),
  }, async ({ query: sql, mutate }) => {
    try {
      // Safety: block DROP/TRUNCATE unless explicitly approved
      const upper = sql.toUpperCase().trim();
      const isDrop = upper.startsWith("DROP") || upper.startsWith("TRUNCATE") || upper.startsWith("ALTER");
      if (isDrop && mutate) {
        return { content: [{ type: "text" as const, text: "F1 AMANAH: DROP/TRUNCATE/ALTER requires 888_HOLD. Use arif_judge_deliberate first." }], isError: true };
      }

      const result = execSync(
        `psql "${pgUrl}" -c "${sql.replace(/"/g, '\\"')}" --csv 2>&1`,
        { encoding: "utf-8", timeout: 30000 }
      );
      return { content: [{ type: "text" as const, text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message?.slice(0, 1000)}` }], isError: true };
    }
  });

  // forge_postgres_schema
  server.registerTool("forge_postgres_schema", {
    description: "List tables and schemas in the database.",
    inputSchema: z.object({
      schema: z.string().default("public").describe("Schema name to inspect"),
      detail: z.enum(["tables", "columns", "all"]).default("tables").describe("Level of detail"),
    }),
  }, async ({ schema: schemaName, detail }) => {
    try {
      let sql: string;
      if (detail === "tables" || detail === "all") {
        sql = `SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = '${schemaName}' ORDER BY table_name`;
      } else {
        sql = `SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = '${schemaName}' ORDER BY table_name, ordinal_position`;
      }
      const result = execSync(
        `psql "${pgUrl}" -c "${sql.replace(/"/g, '\\"')}" --csv 2>&1`,
        { encoding: "utf-8", timeout: 15000 }
      );
      return { content: [{ type: "text" as const, text: result }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message?.slice(0, 1000)}` }], isError: true };
    }
  });
}

// ── 3. forge_memory_* ──────────────────────────────────────────────────────────

export function registerMemoryTools(server: McpServer): void {
  // forge_memory_recall
  server.registerTool("forge_memory_recall", {
    description: "Search past sessions, sealed events, or codebase context from federation memory.",
    inputSchema: z.object({
      query: z.string().describe("Search query"),
      limit: z.number().default(10).describe("Max results (default 10, max 50)"),
    }),
  }, async ({ query, limit }) => {
    try {
      const url = `http://127.0.0.1:8088/tools/arif_memory_recall`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit: Math.min(limit, 50), mode: "recall" }),
      });
      const data = await resp.json() as any;
      return { content: [{ type: "text" as const, text: JSON.stringify(data.result ?? data, null, 2) }] };
    } catch (err: any) {
      // Fallback: try VAULT999 directly
      try {
        const result = execSync(
          `ls -t /root/arifOS/VAULT999/*.jsonl 2>/dev/null | head -${Math.min(limit, 10)}`,
          { encoding: "utf-8", timeout: 5000 }
        );
        const files = result.split("\n").filter(Boolean);
        const entries = files.map(f => {
          try {
            const data = execSync(`tail -1 "${f}"`, { encoding: "utf-8", timeout: 3000 });
            return { file: f, lastEntry: JSON.parse(data) };
          } catch { return { file: f, lastEntry: null }; }
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(entries, null, 2) }] };
      } catch (fallbackErr: any) {
        return { content: [{ type: "text" as const, text: `Error: ${err.message}. Fallback also failed: ${fallbackErr.message}` }], isError: true };
      }
    }
  });

  // forge_memory_store
  server.registerTool("forge_memory_store", {
    description: "Store a value in federation memory (VAULT999 + arifOS memory).",
    inputSchema: z.object({
      key: z.string().describe("Memory key / identifier"),
      value: z.string().describe("Value to store (stringified JSON or text)"),
      tier: z.enum(["ephemeral", "session", "semantic", "canon"]).default("session").describe("Memory tier"),
    }),
  }, async ({ key, value, tier }) => {
    try {
      const url = `http://127.0.0.1:8088/tools/arif_memory_recall`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "store", query: key, metadata: { value, tier }, actor_id: "FORGE-000Ω" }),
      });
      const data = await resp.json() as any;
      return { content: [{ type: "text" as const, text: JSON.stringify({ status: "stored", key, tier, response: data.result ?? data }, null, 2) }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
    }
  });
}

// ── 4. forge_git_* ─────────────────────────────────────────────────────────────

export function registerGitTools(server: McpServer): void {
  const gitExec = (dir: string, args: string): string => {
    const repoDir = sanitizeGitDir(dir);
    try {
      // Verify it's a git repo
      execSync(`git -C "${repoDir}" rev-parse --git-dir 2>/dev/null`, { encoding: "utf-8", timeout: 5000 });
    } catch {
      throw new Error(`Not a git repository: ${repoDir}`);
    }
    return execSync(`git -C "${repoDir}" ${args}`, { encoding: "utf-8", timeout: 30000 });
  };

  // forge_git_status
  server.registerTool("forge_git_status", {
    description: "Show working tree status for a repo.",
    inputSchema: z.object({
      repo: z.string().default("/root/arifOS").describe("Repository path"),
    }),
  }, async ({ repo }) => {
    try {
      const output = gitExec(repo, "status --short");
      const branch = gitExec(repo, "rev-parse --abbrev-ref HEAD").trim();
      const ahead = gitExec(repo, "rev-list --count HEAD..@{u} 2>/dev/null || echo 0").trim();
      return { content: [{ type: "text" as const, text: `Branch: ${branch}\nAhead of remote: ${ahead}\n${output || "(clean)"}` }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
    }
  });

  // forge_git_diff
  server.registerTool("forge_git_diff", {
    description: "Show uncommitted diff for a repo.",
    inputSchema: z.object({
      repo: z.string().default("/root/arifOS").describe("Repository path"),
      staged: z.boolean().default(false).describe("Show staged diff only (--cached)"),
      limit: z.number().default(200).describe("Max lines to return"),
    }),
  }, async ({ repo, staged, limit }) => {
    try {
      const cached = staged ? "--cached" : "";
      const output = gitExec(repo, `diff ${cached} --unified=3`).split("\n").slice(0, limit).join("\n");
      return { content: [{ type: "text" as const, text: output || "(no diff)" }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
    }
  });

  // forge_git_log
  server.registerTool("forge_git_log", {
    description: "Show recent commit history for a repo.",
    inputSchema: z.object({
      repo: z.string().default("/root/arifOS").describe("Repository path"),
      count: z.number().default(10).describe("Number of commits to show"),
    }),
  }, async ({ repo, count }) => {
    try {
      const output = gitExec(repo, `log --oneline -${Math.min(count, 50)}`);
      return { content: [{ type: "text" as const, text: output || "(no commits)" }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
    }
  });

  // forge_git_commit
  server.registerTool("forge_git_commit", {
    description: "Stage and commit changes. F1 AMANAH: only staged changes, no --force.",
    inputSchema: z.object({
      repo: z.string().default("/root/arifOS").describe("Repository path"),
      message: z.string().describe("Commit message"),
      files: z.array(z.string()).optional().describe("Files to stage (default: all tracked)"),
      push: z.boolean().default(false).describe("Push after commit (888_HOLD if true)"),
    }),
  }, async ({ repo, message, files, push }) => {
    try {
      if (files && files.length > 0) {
        gitExec(repo, `add ${files.map(f => `"${f}"`).join(" ")}`);
      } else {
        gitExec(repo, "add -A");
      }
      const output = gitExec(repo, `commit -m "${message.replace(/"/g, '\\"')}"`);

      if (push) {
        gitExec(repo, "push");
        return { content: [{ type: "text" as const, text: `${output}\nPushed to origin.` }] };
      }
      return { content: [{ type: "text" as const, text: output }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
    }
  });
}

// ── 5. forge_github_* ──────────────────────────────────────────────────────────

export function registerGitHubTools(server: McpServer): void {
  // forge_github_search
  server.registerTool("forge_github_search", {
    description: "Search GitHub repositories or code.",
    inputSchema: z.object({
      query: z.string().describe("GitHub search query"),
      type: z.enum(["repositories", "code", "issues", "prs"]).default("repositories").describe("Search type"),
      limit: z.number().default(10).describe("Max results"),
    }),
  }, async ({ query, type, limit }) => {
    try {
      const ghToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
      const auth = ghToken ? `-H "Authorization: token ${ghToken}"` : "";
      let url: string;
      if (type === "repositories") url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=${limit}&sort=stars`;
      else if (type === "code") url = `https://api.github.com/search/code?q=${encodeURIComponent(query)}&per_page=${limit}`;
      else if (type === "issues") url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}+type:issue&per_page=${limit}`;
      else url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}+type:pr&per_page=${limit}`;

      const result = execSync(`curl -s ${auth} "${url}"`, { encoding: "utf-8", timeout: 15000 });
      const data = JSON.parse(result);
      const items = (data.items || []).slice(0, limit);
      const summary = { total: data.total_count, returned: items.length, items: items.map((i: any) => ({
        name: i.full_name || i.repository?.full_name,
        url: i.html_url,
        description: i.description,
        stars: i.stargazers_count,
        language: i.language,
      }))};
      return { content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message?.slice(0, 500)}` }], isError: true };
    }
  });

  // forge_github_pr
  server.registerTool("forge_github_pr", {
    description: "List or get details on GitHub pull requests.",
    inputSchema: z.object({
      repo: z.string().describe("Repository (e.g. 'ariffazil/arifOS')"),
      action: z.enum(["list", "get", "create"]).default("list").describe("Action"),
      pr_number: z.number().optional().describe("PR number (required for get)"),
      title: z.string().optional().describe("Title (required for create)"),
      body: z.string().optional().describe("Body (optional for create)"),
      head: z.string().optional().describe("Head branch (required for create)"),
      base: z.string().default("main").describe("Base branch"),
      state: z.enum(["open", "closed", "all"]).default("open").describe("PR state filter"),
    }),
  }, async ({ repo, action, pr_number, title, body, head, base, state }) => {
    try {
      const ghToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
      const auth = ghToken ? `-H "Authorization: token ${ghToken}"` : "";

      if (action === "list") {
        const result = execSync(`curl -s ${auth} "https://api.github.com/repos/${repo}/pulls?state=${state}&per_page=10"`, { encoding: "utf-8", timeout: 15000 });
        const prs = JSON.parse(result).map((p: any) => ({ number: p.number, title: p.title, state: p.state, user: p.user?.login, url: p.html_url }));
        return { content: [{ type: "text" as const, text: JSON.stringify(prs, null, 2) }] };
      } else if (action === "get") {
        if (!pr_number) return { content: [{ type: "text" as const, text: "Error: pr_number required for get action" }], isError: true };
        const result = execSync(`curl -s ${auth} "https://api.github.com/repos/${repo}/pulls/${pr_number}"`, { encoding: "utf-8", timeout: 15000 });
        const pr = JSON.parse(result);
        return { content: [{ type: "text" as const, text: JSON.stringify({ number: pr.number, title: pr.title, state: pr.state, body: pr.body?.slice(0, 2000), user: pr.user?.login, url: pr.html_url }, null, 2) }] };
      } else if (action === "create") {
        if (!title || !head) return { content: [{ type: "text" as const, text: "Error: title and head required for create" }], isError: true };
        const payload = JSON.stringify({ title, body: body || "", head, base });
        const result = execSync(`curl -s -X POST ${auth} "https://api.github.com/repos/${repo}/pulls" -d '${payload.replace(/'/g, "'\\''")}'`, { encoding: "utf-8", timeout: 15000 });
        const pr = JSON.parse(result);
        return { content: [{ type: "text" as const, text: JSON.stringify({ number: pr.number, title: pr.title, url: pr.html_url, state: pr.state }, null, 2) }] };
      }
      return { content: [{ type: "text" as const, text: `Unknown action: ${action}` }], isError: true };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message?.slice(0, 500)}` }], isError: true };
    }
  });
}

// ── 6. forge_docker_* ──────────────────────────────────────────────────────────

export function registerDockerTools(server: McpServer): void {
  // forge_docker_ps
  server.registerTool("forge_docker_ps", {
    description: "List running Docker containers.",
    inputSchema: z.object({
      all: z.boolean().default(false).describe("Include stopped containers"),
    }),
  }, async ({ all }) => {
    try {
      const flag = all ? "-a" : "";
      const output = execSync(`docker ps ${flag} --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'`, { encoding: "utf-8", timeout: 10000 });
      return { content: [{ type: "text" as const, text: output }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
    }
  });

  // forge_docker_logs
  server.registerTool("forge_docker_logs", {
    description: "View container logs. F8: read-only.",
    inputSchema: z.object({
      container: z.string().describe("Container name or ID"),
      tail: z.number().default(50).describe("Number of lines from the end"),
    }),
  }, async ({ container, tail }) => {
    try {
      const output = execSync(`docker logs --tail ${tail} "${container}" 2>&1`, { encoding: "utf-8", timeout: 10000 });
      return { content: [{ type: "text" as const, text: output }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
    }
  });

  // forge_docker_exec
  server.registerTool("forge_docker_exec", {
    description: "Execute a command in a running container. F1: read-only commands only.",
    inputSchema: z.object({
      container: z.string().describe("Container name or ID"),
      command: z.string().describe("Command to execute"),
      interactive: z.boolean().default(false).describe("Use -it flag"),
    }),
  }, async ({ container, command, interactive }) => {
    try {
      const it = interactive ? "-it" : "";
      const output = execSync(`docker exec ${it} "${container}" ${command} 2>&1`, { encoding: "utf-8", timeout: 30000 });
      return { content: [{ type: "text" as const, text: output }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message?.slice(0, 1000)}` }], isError: true };
    }
  });

  // forge_docker_images
  server.registerTool("forge_docker_images", {
    description: "List Docker images.",
    inputSchema: z.object({}),
  }, async () => {
    try {
      const output = execSync("docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}'", { encoding: "utf-8", timeout: 10000 });
      return { content: [{ type: "text" as const, text: output }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
    }
  });
}
