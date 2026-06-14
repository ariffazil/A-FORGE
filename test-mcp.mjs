// A-FORGE MCP Surface Test
// Uses official MCP SDK client to connect
// Run: node /tmp/aforge-mcp-test.mjs

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function main() {
  const url = "http://127.0.0.1:7072/mcp";
  console.log(`Connecting to ${url}...`);

  const transport = new StreamableHTTPClientTransport(new URL(url));
  const client = new Client(
    { name: "forge-audit", version: "1.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log("✅ INIT SEAL: Connected");

  // List tools
  const result = await client.listTools();
  if (result.tools) {
    console.log(`\n✅ TOOLS LIST SEAL: ${result.tools.length} tools`);

    // Group by category
    const cats = {};
    for (const t of result.tools) {
      const prefix = t.name.split("_").slice(0, 2).join("_");
      if (!cats[prefix]) cats[prefix] = [];
      cats[prefix].push(t.name);
    }
    for (const [cat, tools] of Object.entries(cats).sort()) {
      console.log(`  ${cat}: ${tools.length} tools`);
    }

    // Show Phase 1 tools specifically
    const phase1 = result.tools.filter(t =>
      t.name.startsWith("forge_agent_") ||
      t.name.startsWith("forge_lease_") ||
      t.name === "forge_registry_status" ||
      t.name === "forge_shell_dryrun" ||
      t.name === "forge_log_tail" ||
      t.name.startsWith("forge_job_")
    );
    console.log(`\n✅ PHASE 1 TOOLS: ${phase1.length}`);
    phase1.forEach(t => console.log(`  ✓ ${t.name}`));
  }

  // Test forge_registry_status
  console.log("\n=== Testing forge_registry_status ===");
  try {
    const reg = await client.callTool({ name: "forge_registry_status", arguments: {} });
    const text = reg.content?.[0]?.text || "no text";
    const parsed = JSON.parse(text);
    console.log(`  Status: ${parsed.status}`);
    console.log(`  Tools declared: ${parsed.tool_count}`);
    console.log(`  Service: ${parsed.service}`);
  } catch (e) {
    console.log(`  Tool call error: ${e.message || e}`);
  }

  // Test forge_agent_register
  console.log("\n=== Testing forge_agent_register ===");
  try {
    const reg = await client.callTool({
      name: "forge_agent_register",
      arguments: {
        agent_id: "forge-audit-001",
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
    const text = reg.content?.[0]?.text || "no text";
    console.log(`  Result: ${text.substring(0, 200)}`);
  } catch (e) {
    console.log(`  Register error: ${e.message || e}`);
  }

  // Test forge_agent_status
  console.log("\n=== Testing forge_agent_status ===");
  try {
    const st = await client.callTool({ name: "forge_agent_status", arguments: { agent_id: "forge-audit-001" } });
    const text = st.content?.[0]?.text || "no text";
    console.log(`  Result: ${text.substring(0, 200)}`);
  } catch (e) {
    console.log(`  Status error: ${e.message || e}`);
  }

  // Test forge_lease_request
  console.log("\n=== Testing forge_lease_request ===");
  try {
    const lease = await client.callTool({
      name: "forge_lease_request",
      arguments: {
        agent_id: "forge-audit-001",
        scope: ["forge_filesystem_read", "forge_git_status", "forge_shell_dryrun"],
        max_action_class: "MUTATE",
        ttl_seconds: 300
      }
    });
    const text = lease.content?.[0]?.text || "no text";
    console.log(`  Result: ${text.substring(0, 300)}`);
  } catch (e) {
    console.log(`  Lease error: ${e.message || e}`);
  }

  console.log("\n✅ ALL TESTS COMPLETE — A-FORGE MCP SURFACE SEAL");
  await transport.close();
}

main().catch(e => {
  console.error("FATAL:", e.message || e);
  process.exit(1);
});
