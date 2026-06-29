import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSync } from "node:child_process";
import { readFile, writeFile, readdir, stat, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { globSync } from "glob";

const ALLOWED_ROOTS = ["/root", "/tmp", "/data", "/var/log"];

// ── APEX: Landauer Thermodynamic Cost ────────────────────────────────────────
// Per-byte Landauer cost at room temperature (293K).
// kT * ln(2) ≈ 4.05e-21 J per bit erased irreversibly.
// Cost formula: bits_written * kT * ln(2) joules.
// 1 byte = 8 bits. 1 KB ≈ 3.24e-17 J. 1 MB ≈ 3.24e-14 J.
const K_BOLTZMANN = 1.380649e-23;   // J/K
const ROOM_TEMP_K = 293.15;          // ~20°C
const LANDALER_BITS = K_BOLTZMANN * ROOM_TEMP_K * Math.log(2); // ≈ 2.78e-23 J/bit

function landauerCostBytes(bytes: number): number {
  if (bytes <= 0) return 0;
  return (bytes * 8 * LANDALER_BITS);
}

function landauerCostHuman(bytes: number): string {
  const j = landauerCostBytes(bytes);
  if (j < 1e-18) return `${(j * 1e21).toFixed(2)} zJ`;
  if (j < 1e-15) return `${(j * 1e18).toFixed(2)} aJ`;
  if (j < 1e-12) return `${(j * 1e15).toFixed(2)} fJ`;
  return `${(j * 1e12).toFixed(2)} pJ`;
}

function text(content: unknown, isError = false) {
  const body = typeof content === "string" ? content : JSON.stringify(content, null, 2);
  return { content: [{ type: "text" as const, text: body }], isError };
}

function checkPathAllowed(target: string): { allowed: boolean; resolvedPath: string; error?: string } {
  const resolvedPath = resolve(target);
  const allowed = ALLOWED_ROOTS.some((root) => resolvedPath === root || resolvedPath.startsWith(`${root}/`));
  if (!allowed) {
    return {
      allowed: false,
      resolvedPath,
      error: `Path '${target}' is outside allowed roots (${ALLOWED_ROOTS.join(", ")}). F8 LAW: boundary enforced.`,
    };
  }
  return { allowed: true, resolvedPath };
}

function gitExec(repo: string, args: string): string {
  const repoDir = repo ? resolve(repo) : process.cwd();
  execSync(`git -C "${repoDir}" rev-parse --git-dir 2>/dev/null`, { encoding: "utf-8", timeout: 5000 });
  return execSync(`git -C "${repoDir}" ${args}`, { encoding: "utf-8", timeout: 30000 });
}

function ghAuthHeader(): string {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
  return token ? `-H "Authorization: token ${token}"` : "";
}

export function registerFilesystemTools(server: McpServer): void {
  server.registerTool("forge_filesystem", {
    description: "Canonical filesystem primitive. Modes: read, write, glob, grep, stat. F8 scoped to /root, /tmp, /data, /var/log.",
    inputSchema: z.object({
      mode: z.enum(["read", "write", "glob", "grep", "stat"]),
      path: z.string().default("/root"),
      content: z.string().optional(),
      overwrite: z.boolean().default(false),
      pattern: z.string().optional(),
      include: z.string().optional(),
      offset: z.number().optional(),
      limit: z.number().optional(),
    }),
  }, async ({ mode, path: inputPath, content, overwrite, pattern, include, offset, limit }) => {
    try {
      const check = checkPathAllowed(inputPath);
      if (!check.allowed) return text(check.error!, true);

      if (mode === "read") {
        const stats = await stat(check.resolvedPath);
        if (stats.isDirectory()) {
          const entries = await readdir(check.resolvedPath);
          const listing: string[] = [];
          for (const entry of entries) {
            try {
              const s = await stat(join(check.resolvedPath, entry));
              listing.push(s.isDirectory() ? `${entry}/` : entry);
            } catch {
              listing.push(entry);
            }
          }
          return text(listing.join("\n"));
        }
        const data = await readFile(check.resolvedPath, "utf-8");
        const lines = data.split("\n");
        const start = offset ? offset - 1 : 0;
        const count = limit ?? 2000;
        const snippet = lines.slice(start, start + count).map((line, idx) => `${start + idx + 1}: ${line}`);
        return text(`(${lines.length} lines, showing ${start + 1}-${Math.min(start + count, lines.length)})\n${snippet.join("\n")}`);
      }

      if (mode === "write") {
        if (content === undefined) return text("content is required for mode=write", true);
        let exists = false;
        try { await stat(check.resolvedPath); exists = true; } catch { /* absent */ }
        if (exists && !overwrite) return text(`F1 AMANAH: File '${inputPath}' exists. Set overwrite=true to replace.`, true);
        await mkdir(resolve(check.resolvedPath, ".."), { recursive: true });
        await writeFile(check.resolvedPath, content, "utf-8");
        const byteCount = Buffer.byteLength(content, "utf-8");
        const thermoJ = landauerCostBytes(byteCount);
        return text({
          status: "written",
          path: check.resolvedPath,
          bytes: byteCount,
          landauer_joules: thermoJ,
          landauer_human: landauerCostHuman(byteCount),
          // APEX Stream 3: thermodynamic cost metadata
          apex_theory: {
            epistemic_label: "OBS",
            confidence: 1.0,
            confidence_label: "OBS",
            mesa_signal: false,
            thermodynamic_band: "LOW",
          },
        });
      }

      if (mode === "glob") {
        if (!pattern) return text("pattern is required for mode=glob", true);
        const results = globSync(pattern, { cwd: check.resolvedPath, nodir: true });
        const sorted = results.sort((a, b) => a.localeCompare(b)).slice(0, 500).map((p) => join(check.resolvedPath, p));
        return text({ count: sorted.length, truncated: results.length > sorted.length, files: sorted });
      }

      if (mode === "grep") {
        if (!pattern) return text("pattern is required for mode=grep", true);
        const includeFlag = include ? `--include="${include}"` : "";
        try {
          const output = execSync(`grep -rn "${pattern}" ${includeFlag} "${check.resolvedPath}" 2>/dev/null | head -200`, { encoding: "utf-8", timeout: 15000 });
          return text(output.trim() || "No matches found.");
        } catch (err: any) {
          if (err.status === 1) return text("No matches found.");
          return text(`Error: ${err.message?.slice(0, 500)}`, true);
        }
      }

      const stats = await stat(check.resolvedPath);
      return text({
        path: check.resolvedPath,
        size: stats.size,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        isSymlink: stats.isSymbolicLink(),
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        mode: stats.mode.toString(8),
      });
    } catch (err: any) {
      return text(`Error: ${err.message}`, true);
    }
  });
}

export function registerPostgresTools(server: McpServer): void {
  const pgUrl = process.env.PG_URL || process.env.DATABASE_URL || "postgresql://arifos_admin:ArifPostgres2026!@localhost:5432/vault999";
  server.registerTool("forge_postgres", {
    description: "Canonical Postgres primitive. Modes: query, schema. Writes require mutate=true and remain floor-gated.",
    inputSchema: z.object({
      mode: z.enum(["query", "schema"]),
      query: z.string().optional(),
      mutate: z.boolean().default(false),
      schema: z.string().default("public"),
      detail: z.enum(["tables", "columns", "all"]).default("tables"),
    }),
  }, async ({ mode, query, mutate, schema, detail }) => {
    try {
      let sql: string;
      if (mode === "query") {
        if (!query) return text("query is required for mode=query", true);
        const upper = query.toUpperCase().trim();
        const isMutation = /^(INSERT|UPDATE|DELETE|CREATE|DROP|TRUNCATE|ALTER)\b/.test(upper);
        if (isMutation && !mutate) return text("F1 AMANAH: SQL mutation requires mutate=true and upstream governance lease.", true);
        if (/^(DROP|TRUNCATE|ALTER)\b/.test(upper)) return text("F1 AMANAH: DROP/TRUNCATE/ALTER requires 888_HOLD. Use arif_judge_deliberate first.", true);
        sql = query;
      } else if (detail === "columns") {
        sql = `SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = '${schema}' ORDER BY table_name, ordinal_position`;
      } else {
        sql = `SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = '${schema}' ORDER BY table_name`;
      }
      const output = execSync(`psql "${pgUrl}" -c "${sql.replace(/"/g, '\\"')}" --csv 2>&1`, { encoding: "utf-8", timeout: 30000 });
      return text(output);
    } catch (err: any) {
      return text(`Error: ${err.message?.slice(0, 1000)}`, true);
    }
  });
}

export function registerMemoryTools(server: McpServer): void {
  server.registerTool("forge_memory", {
    description: "Canonical memory primitive. Modes: recall. Reads VAULT999 local files, then vault999-api fallback.",
    inputSchema: z.object({
      mode: z.enum(["recall"]).default("recall"),
      query: z.string(),
      limit: z.number().default(10),
    }),
  }, async ({ query, limit }) => {
    try {
      const safeLimit = Math.min(limit, 50);
      const result = execSync(`ls -t /root/arifOS/VAULT999/*.jsonl 2>/dev/null | head -${safeLimit}`, { encoding: "utf-8", timeout: 5000 });
      const files = result.split("\n").filter(Boolean);
      const entries: Array<Record<string, unknown>> = [];
      const queryLower = query.toLowerCase();
      for (const f of files) {
        try {
          const content = execSync(`tail -20 "${f}"`, { encoding: "utf-8", timeout: 3000 });
          for (const line of content.split("\n").filter(Boolean)) {
            try {
              const entry = JSON.parse(line);
              if (queryLower === "*" || JSON.stringify(entry).toLowerCase().includes(queryLower)) entries.push({ file: f, entry });
              if (entries.length >= safeLimit) break;
            } catch { /* skip */ }
          }
          if (entries.length >= safeLimit) break;
        } catch { /* skip */ }
      }
      if (entries.length > 0) return text({ status: "ok", query, count: entries.length, results: entries });
      try {
        const resp = await fetch(`http://127.0.0.1:8100/api/vault/search?q=${encodeURIComponent(query)}&limit=${safeLimit}`, { signal: AbortSignal.timeout(5000) });
        return text(await resp.json());
      } catch {
        return text({ status: "ok", query, count: 0, results: [], note: "No matches in VAULT999 local files; vault999-api unavailable" });
      }
    } catch (err: any) {
      return text(`Error: ${err.message}`, true);
    }
  });
}

export function registerGitTools(server: McpServer): void {
  server.registerTool("forge_git", {
    description: "Canonical git primitive. Modes: status, diff, log, commit. Mutating modes are floor-gated by A-FORGE MCP ingress.",
    inputSchema: z.object({
      mode: z.enum(["status", "diff", "log", "commit"]),
      repo: z.string().default("/root/arifOS"),
      staged: z.boolean().default(false),
      limit: z.number().default(200),
      count: z.number().default(10),
      message: z.string().optional(),
      files: z.array(z.string()).optional(),
      push: z.boolean().default(false),
    }),
  }, async ({ mode, repo, staged, limit, count, message, files, push }) => {
    try {
      if (mode === "status") {
        const branch = gitExec(repo, "rev-parse --abbrev-ref HEAD").trim();
        const status = gitExec(repo, "status --short");
        return text(`Branch: ${branch}\n${status || "(clean)"}`);
      }
      if (mode === "diff") {
        const diffOutput = gitExec(repo, `diff ${staged ? "--cached" : ""} --unified=3`).split("\n").slice(0, limit).join("\n") || "(no diff)";
        const diffBytes = Buffer.byteLength(diffOutput, "utf-8");
        return text({
          diff: diffOutput,
          bytes: diffBytes,
          landauer_joules: landauerCostBytes(diffBytes),
          landauer_human: landauerCostHuman(diffBytes),
          apex_theory: {
            epistemic_label: "DER",
            confidence: 1.0,
            confidence_label: "OBS",
            mesa_signal: false,
            thermodynamic_band: "LOW",
          },
        });
      }
      if (mode === "log") return text(gitExec(repo, `log --oneline -${Math.min(count, 50)}`));
      if (!message) return text("message is required for mode=commit", true);
      if (files && files.length > 0) gitExec(repo, `add ${files.map((f) => `"${f}"`).join(" ")}`);
      else gitExec(repo, "add -A");
      const output = gitExec(repo, `commit -m "${message.replace(/"/g, '\\"')}"`);
      const msgBytes = Buffer.byteLength(message, "utf-8");
      const thermoJ = landauerCostBytes(msgBytes);
      if (push) return text("F1 AMANAH: push requires separate judge/lease path; commit created but push refused.", true);
      return text({
        commit: output,
        message_bytes: msgBytes,
        landauer_joules: thermoJ,
        landauer_human: landauerCostHuman(msgBytes),
        apex_theory: {
          epistemic_label: "OBS",
          confidence: 1.0,
          confidence_label: "OBS",
          mesa_signal: false,
          thermodynamic_band: "LOW",
        },
      });
    } catch (err: any) {
      return text(`Error: ${err.message}`, true);
    }
  });
}

export function registerGitHubTools(server: McpServer): void {
  server.registerTool("forge_github", {
    description: "Canonical GitHub primitive. Modes: search, pr. Use type for search variants instead of separate tools.",
    inputSchema: z.object({
      mode: z.enum(["search", "pr"]),
      query: z.string().optional(),
      type: z.enum(["repositories", "code", "issues", "prs"]).default("repositories"),
      limit: z.number().default(10),
      repo: z.string().optional(),
      action: z.enum(["list", "get", "create"]).default("list"),
      pr_number: z.number().optional(),
      title: z.string().optional(),
      body: z.string().optional(),
      head: z.string().optional(),
      base: z.string().default("main"),
      state: z.enum(["open", "closed", "all"]).default("open"),
    }),
  }, async ({ mode, query, type, limit, repo, action, pr_number, title, body, head, base, state }) => {
    try {
      // TODO: BYPASS RISK — this uses raw execSync for curl. Shell injection via repo/payload.
      // Migrate to forge_shell for governed execution + ArifSeal audit.
      // See: forge_work/shell-terminal-wiring.md
      const auth = ghAuthHeader();
      if (mode === "search") {
        if (!query) return text("query is required for mode=search", true);
        let url: string;
        if (type === "repositories") url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=${limit}&sort=stars`;
        else if (type === "code") url = `https://api.github.com/search/code?q=${encodeURIComponent(query)}&per_page=${limit}`;
        else if (type === "issues") url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}+type:issue&per_page=${limit}`;
        else url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}+type:pr&per_page=${limit}`;
        const data = JSON.parse(execSync(`curl -s ${auth} "${url}"`, { encoding: "utf-8", timeout: 15000 }));
        const items = (data.items || []).slice(0, limit).map((i: any) => ({
          name: i.full_name || i.repository?.full_name,
          url: i.html_url,
          description: i.description,
          stars: i.stargazers_count,
          language: i.language,
        }));
        return text({ total: data.total_count, returned: items.length, items });
      }
      if (!repo) return text("repo is required for mode=pr", true);
      if (action === "list") {
        const prs = JSON.parse(execSync(`curl -s ${auth} "https://api.github.com/repos/${repo}/pulls?state=${state}&per_page=10"`, { encoding: "utf-8", timeout: 15000 }))
          .map((p: any) => ({ number: p.number, title: p.title, state: p.state, user: p.user?.login, url: p.html_url }));
        return text(prs);
      }
      if (action === "get") {
        if (!pr_number) return text("pr_number required for action=get", true);
        const pr = JSON.parse(execSync(`curl -s ${auth} "https://api.github.com/repos/${repo}/pulls/${pr_number}"`, { encoding: "utf-8", timeout: 15000 }));
        return text({ number: pr.number, title: pr.title, state: pr.state, body: pr.body?.slice(0, 2000), user: pr.user?.login, url: pr.html_url });
      }
      if (!title || !head) return text("title and head required for action=create", true);
      const payload = JSON.stringify({ title, body: body || "", head, base });
      const pr = JSON.parse(execSync(`curl -s -X POST ${auth} "https://api.github.com/repos/${repo}/pulls" -d '${payload.replace(/'/g, "'\\''")}'`, { encoding: "utf-8", timeout: 15000 }));
      return text({ number: pr.number, title: pr.title, url: pr.html_url, state: pr.state });
    } catch (err: any) {
      return text(`Error: ${err.message?.slice(0, 500)}`, true);
    }
  });
}

export function registerDockerTools(server: McpServer): void {
  // TODO: BYPASS RISK — forge_docker uses raw execSync with no input validation.
  // container/command fields allow arbitrary shell injection.
  // Migrate to docker_wrapper.ts (governed) + forge_shell for execution.
  // See: forge_work/shell-terminal-wiring.md
  server.registerTool("forge_docker", {
    description: "Canonical Docker primitive. Modes: ps, logs, exec, images. Destructive operations stay out of this read/exec surface.",
    inputSchema: z.object({
      mode: z.enum(["ps", "logs", "exec", "images"]),
      all: z.boolean().default(false),
      container: z.string().optional(),
      command: z.string().optional(),
      interactive: z.boolean().default(false),
      tail: z.number().default(50),
    }),
  }, async ({ mode, all, container, command, interactive, tail }) => {
    try {
      if (mode === "ps") return text(execSync(`docker ps ${all ? "-a" : ""} --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'`, { encoding: "utf-8", timeout: 10000 }));
      if (mode === "images") return text(execSync("docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}'", { encoding: "utf-8", timeout: 10000 }));
      if (!container) return text("container is required for mode=logs or mode=exec", true);
      if (mode === "logs") return text(execSync(`docker logs --tail ${tail} "${container}" 2>&1`, { encoding: "utf-8", timeout: 10000 }));
      if (!command) return text("command is required for mode=exec", true);
      return text(execSync(`docker exec ${interactive ? "-it" : ""} "${container}" ${command} 2>&1`, { encoding: "utf-8", timeout: 30000 }));
    } catch (err: any) {
      return text(`Error: ${err.message?.slice(0, 1000)}`, true);
    }
  });
}
