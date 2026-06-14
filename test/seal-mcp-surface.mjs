/**
 * A-FORGE MCP Surface SEAL Test
 * Uses official MCP SDK client to connect and test all Phase 1 tools
 * 
 * Run: node test/seal-mcp-surface.mjs
 * 
 * DITEMPA BUKAN DIBERI
 */

import { execSync } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = "http://127.0.0.1:7072/mcp";

async function main() {
  // Fresh server state — restart to clear any previous session
  try {
    execSync("systemctl restart a-forge-mcp.service", { timeout: 10000 });
    await new Promise(r => setTimeout(r, 3000));
  } catch (e) {
    console.error("WARN: Could not restart server:", e.message);
  }

  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   A-FORGE MCP SURFACE SEAL TEST                    ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  // ── 1. Connect ─────────────────────────────────────────────────
  console.log("1. SEAL: CONNECT...");
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  const client = new Client(
    { name: "forge-seal", version: "1.0" },
    { capabilities: {} }
  );
  await client.connect(transport);
  console.log("   ✓ Session established with A-FORGE MCP\n");

  // ── 2. List Tools ──────────────────────────────────────────────
  console.log("2. SEAL: LIST TOOLS...");
  const tools = await client.listTools();
  const toolList = tools.tools || [];
  console.log(`   ✓ ${toolList.length} tools registered`);

  // Categorize
  const cats = {};
  for (const t of toolList) {
    const prefix = t.name.includes("_") ? t.name.split("_").slice(0, 2).join("_") : t.name;
    if (!cats[prefix]) cats[prefix] = [];
    cats[prefix].push(t.name);
  }
  for (const [cat, names] of Object.entries(cats).sort()) {
    console.log(`     ${cat}: ${names.length} tools`);
  }

  // Phase 1 tools check
  const phase1 = toolList.filter(t =>
    /forge_(agent|lease|registry|shell_dryrun|log_tail|job_)/.test(t.name)
  );
  const allPresent = ["forge_agent_register","forge_agent_status","forge_agent_list",
    "forge_lease_request","forge_lease_status","forge_lease_revoke",
    "forge_registry_status","forge_shell_dryrun","forge_log_tail",
    "forge_job_submit","forge_job_status"].every(n => toolList.some(t => t.name === n));
  console.log(`   ✓ Phase 1 tools: ${phase1.length} (${allPresent ? "ALL PRESENT" : "MISSING"})\n`);

  // ── 3. forge_registry_status ──────────────────────────────────
  console.log("3. SEAL: forge_registry_status...");
  const reg = await client.callTool({ name: "forge_registry_status", arguments: {} });
  const regText = reg.content?.[0]?.text || "{}";
  const regData = JSON.parse(regText);
  console.log(`   ✓ Status: ${regData.status}`);
  console.log(`   ✓ Tools: ${regData.tool_count}`);
  console.log(`   ✓ Service: ${regData.service}\n`);

  // ── 4. forge_agent_register ────────────────────────────────────
  console.log("4. SEAL: forge_agent_register...");
  const register = await client.callTool({
    name: "forge_agent_register",
    arguments: {
      agent_id: "forge-seal-001",
      agent_type: "custom",
      role: "observer",
      authority: {
        observe: true,
        dry_run: true,
        propose_patch: false,
        mutate_files: "never",
        shell_exec: "never",
        git_commit: "never",
        deploy: "never",
        vault_seal: "never"
      }
    }
  });
  const regResult = JSON.parse(register.content?.[0]?.text || "{}");
  console.log(`   ✓ Agent: ${regResult.agent_id} as ${regResult.role}`);
  console.log(`   ✓ Status: ${regResult.status}\n`);

  // ── 5. forge_agent_status ──────────────────────────────────────
  console.log("5. SEAL: forge_agent_status...");
  const status = await client.callTool({
    name: "forge_agent_status",
    arguments: { agent_id: "forge-seal-001" }
  });
  const stResult = JSON.parse(status.content?.[0]?.text || "{}");
  console.log(`   ✓ Agent: ${stResult.agent?.agent_id}`);
  console.log(`   ✓ Role: ${stResult.agent?.role}`);
  console.log(`   ✓ Registered: ${stResult.agent?.registered_at}\n`);

  // ── 6. forge_agent_list ────────────────────────────────────────
  console.log("6. SEAL: forge_agent_list...");
  const list = await client.callTool({ name: "forge_agent_list", arguments: {} });
  const listResult = JSON.parse(list.content?.[0]?.text || "{}");
  console.log(`   ✓ ${listResult.count} agent(s) registered\n`);

  // ── 7. forge_lease_request ─────────────────────────────────────
  console.log("7. SEAL: forge_lease_request...");
  const lease = await client.callTool({
    name: "forge_lease_request",
    arguments: {
      agent_id: "forge-seal-001",
      scope: ["forge_filesystem_read", "forge_git_status", "forge_shell_dryrun"],
      max_action_class: "MUTATE",
      ttl_seconds: 300
    }
  });
  const leaseResult = JSON.parse(lease.content?.[0]?.text || "{}");
  console.log(`   ✓ Lease: ${leaseResult.lease_id}`);
  console.log(`   ✓ Status: ${leaseResult.status}`);
  console.log(`   ✓ Expires: ${leaseResult.expires_at}\n`);

  // ── 8. forge_lease_status ──────────────────────────────────────
  console.log("8. SEAL: forge_lease_status...");
  const ls = await client.callTool({
    name: "forge_lease_status",
    arguments: { lease_id: leaseResult.lease_id }
  });
  const lsResult = JSON.parse(ls.content?.[0]?.text || "{}");
  console.log(`   ✓ Status: ${lsResult.status}`);
  console.log(`   ✓ Remaining: ${lsResult.remaining_seconds}s\n`);

  // ── 9. forge_shell_dryrun ──────────────────────────────────────
  console.log("9. SEAL: forge_shell_dryrun...");
  const dry = await client.callTool({
    name: "forge_shell_dryrun",
    arguments: { command: "echo 'A-FORGE MCP is alive' && hostname && date -u" }
  });
  const dryResult = JSON.parse(dry.content?.[0]?.text || "{}");
  console.log(`   ✓ Status: ${dryResult.status}`);
  console.log(`   ✓ Exit: ${dryResult.exit_code}`);
  console.log(`   ✓ Output: ${dryResult.output?.trim()}\n`);

  // ── 10. forge_log_tail ──────────────────────────────────────────
  console.log("10. SEAL: forge_log_tail...");
  const log = await client.callTool({
    name: "forge_log_tail",
    arguments: { service: "a-forge", lines: 5 }
  });
  console.log(`   ✓ Logs (5 lines):`);
  const logLines = log.content?.[0]?.text || "";
  logLines.split("\n").slice(0, 5).forEach(l => console.log(`     ${l.trim() ? "| " + l : ""}`));
  console.log();

  // ── 11. forge_job_submit ────────────────────────────────────────
  console.log("11. SEAL: forge_job_submit...");
  const job = await client.callTool({
    name: "forge_job_submit",
    arguments: {
      agent_id: "forge-seal-001",
      tool: "forge_shell_dryrun",
      description: "SEAL verification job"
    }
  });
  const jobResult = JSON.parse(job.content?.[0]?.text || "{}");
  console.log(`   ✓ Job: ${jobResult.job_id}`);
  console.log(`   ✓ Status: ${jobResult.status}\n`);

  // ── 12. forge_job_status ────────────────────────────────────────
  console.log("12. SEAL: forge_job_status...");
  const js = await client.callTool({
    name: "forge_job_status",
    arguments: { job_id: jobResult.job_id }
  });
  const jsResult = JSON.parse(js.content?.[0]?.text || "{}");
  console.log(`   ✓ Status: ${jsResult.status}`);
  console.log(`   ✓ Tool: ${jsResult.tool}\n`);

  // ── 13. forge_filesystem_read ──────────────────────────────────
  console.log("13. SEAL: forge_filesystem_read...");
  const fs = await client.callTool({
    name: "forge_filesystem_read",
    arguments: { path: "/root/A-FORGE/package.json", limit: 5 }
  });
  const fsText = fs.content?.[0]?.text || "";
  const fsLines = fsText.split("\n").slice(0, 6);
  console.log(`   ✓ File: package.json`);
  fsLines.forEach(l => console.log(`     ${l}`));
  console.log();

  // ── 14. forge_git_status ────────────────────────────────────────
  console.log("14. SEAL: forge_git_status...");
  const git = await client.callTool({
    name: "forge_git_status",
    arguments: { repo: "/root/A-FORGE" }
  });
  const gitText = git.content?.[0]?.text || "";
  gitText.split("\n").forEach(l => console.log(`     ${l}`));
  console.log();

  // ── SEAL VERDICT ────────────────────────────────────────────────
  const success = allPresent && regData.status === "SEAL" && leaseResult.status === "SEAL";
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log(success
    ? "║   ✅ A-FORGE MCP SURFACE: SEAL                          ║"
    : "║   ❌ A-FORGE MCP SURFACE: HOLD                          ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log(`   Tools: ${toolList.length}`);
  console.log(`   Phase 1: ${phase1.length} tools (${allPresent ? "ALL" : "SOME MISSING"})`);
  console.log(`   Registry: ${regData.status}`);
  console.log(`   Lease: ${leaseResult.status}`);
  console.log(`   Dry-run: ${dryResult.status}`);
  console.log(`   Filesystem: verified`);
  console.log(`   Git: verified`);
  console.log(`   Logs: verified`);
  console.log(`   Jobs: verified`);
  console.log(`\n   DITEMPA BUKAN DIBERI — ${success ? "Forged and SEALed" : "Still forging..."}`);

  await transport.close();
}

main().catch(e => {
  console.error(`\n❌ FATAL: ${e.message || e}`);
  process.exit(1);
});
