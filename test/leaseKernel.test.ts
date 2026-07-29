/**
 * Lease Kernel Validation Tests
 *
 * Red-team tests for ADR-001 Phase 2: A-FORGE must never trust its local
 * `activeLeases` cache for authorization. Every non-OBSERVE action must be
 * live-validated against the arifOS canonical lease registry.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { validateLeaseForTool } from "../src/interfaces/mcp/forgeTools.js";
import { requireMutationApproval } from "../src/infrastructure/tools/infra/safety.js";

let mockServer: ReturnType<typeof createServer> | null = null;
let mockUrl: string = "";

test.beforeEach(() => {
  delete process.env.ARIFOS_KERNEL_URL;
});

function startMockServer(handler: (req: any) => Promise<{ status?: number; body: any }>): Promise<string> {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      let body = "";
      req.on("data", (c: string) => (body += c));
      req.on("end", async () => {
        let parsed = {};
        try { parsed = JSON.parse(body); } catch { /* empty */ }
        try {
          const result = await handler({ url: req.url, body: parsed });
          res.writeHead(result.status ?? 200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result.body));
        } catch (e: any) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      mockUrl = `http://127.0.0.1:${port}`;
      mockServer = server;
      resolve(mockUrl);
    });
  });
}

test.afterEach(async () => {
  if (mockServer) {
    await new Promise<void>((resolve) => mockServer!.close(() => resolve()));
    mockServer = null;
  }
  delete process.env.ARIFOS_MCP_URL;
});

test("OBSERVE actions pass without a lease_id", async () => {
  const result = await validateLeaseForTool(undefined, "forge_search", "OBSERVE");
  assert.equal(result.ok, true);
});

test("non-OBSERVE actions require a lease_id", async () => {
  const result = await validateLeaseForTool(undefined, "forge_filesystem_write", "EXECUTE_REVERSIBLE");
  assert.equal(result.ok, false);
  assert.equal(result.gate, "LEASE_REQUIRED");
});

test("valid kernel lease permits action within scope and class", async () => {
  await startMockServer(() => Promise.resolve({
    body: {
      result: {
        lease: {
          lease_id: "lease-valid-001",
          actor_id: "agent-1",
          scope: ["forge_filesystem_write"],
          max_action_class: "EXECUTE_REVERSIBLE",
          issued_at: new Date(Date.now() - 60000).toISOString(),
          expires_at: new Date(Date.now() + 60000).toISOString(),
          forbidden: [],
          revoked: false,
          verdict_geometry: { trace_id: "trace-valid-lease" },
        },
      },
    },
  }));
  process.env.ARIFOS_MCP_URL = mockUrl;
  const result = await validateLeaseForTool("lease-valid-001", "forge_filesystem_write", "EXECUTE_REVERSIBLE");
  assert.equal(result.ok, true);
  assert.equal(result.lease.lease_id, "lease-valid-001");
});

test("revoked lease is rejected even if local cache says active", async () => {
  let calls = 0;
  await startMockServer(() => {
    calls++;
    const revoked = calls > 1;
    return Promise.resolve({
      body: {
        result: {
          lease: {
            lease_id: "lease-revoked-001",
            actor_id: "agent-1",
            scope: ["*"],
            max_action_class: "IRREVERSIBLE",
            issued_at: new Date(Date.now() - 60000).toISOString(),
            expires_at: new Date(Date.now() + 60000).toISOString(),
            forbidden: [],
            revoked,
            verdict_geometry: { trace_id: "trace-revocation-check" },
          },
        },
      },
    });
  });
  process.env.ARIFOS_MCP_URL = mockUrl;
  // First call populates the local diagnostic cache with an active lease.
  const first = await validateLeaseForTool("lease-revoked-001", "forge_github_create_issue", "EXECUTE_HIGH_IMPACT");
  assert.equal(first.ok, true);

  // Second call must live-check the kernel and reject the now-revoked lease.
  const second = await validateLeaseForTool("lease-revoked-001", "forge_github_create_issue", "EXECUTE_HIGH_IMPACT");
  assert.equal(second.ok, false);
  assert.equal(second.gate, "LEASE_REVOKED");
});

test("kernel unreachable fails closed for non-OBSERVE actions", async () => {
  process.env.ARIFOS_MCP_URL = "http://127.0.0.1:1";
  const result = await validateLeaseForTool("lease-any", "forge_filesystem_write", "EXECUTE_REVERSIBLE");
  assert.equal(result.ok, false);
  assert.equal(result.gate, "LEASE_KERNEL_UNREACHABLE");
});

test("lease class exceeded is rejected", async () => {
  await startMockServer(() => Promise.resolve({
    body: {
      result: {
        lease: {
          lease_id: "lease-low-001",
          actor_id: "agent-1",
          scope: ["*"],
          max_action_class: "OBSERVE",
          issued_at: new Date(Date.now() - 60000).toISOString(),
          expires_at: new Date(Date.now() + 60000).toISOString(),
          forbidden: [],
          revoked: false,
        },
      },
    },
  }));
  process.env.ARIFOS_MCP_URL = mockUrl;
  const result = await validateLeaseForTool("lease-low-001", "forge_filesystem_write", "EXECUTE_REVERSIBLE");
  assert.equal(result.ok, false);
  assert.equal(result.gate, "LEASE_CLASS_EXCEEDED");
});

test("tool outside lease scope is rejected", async () => {
  await startMockServer(() => Promise.resolve({
    body: {
      result: {
        lease: {
          lease_id: "lease-scope-001",
          actor_id: "agent-1",
          scope: ["forge_search"],
          max_action_class: "EXECUTE_REVERSIBLE",
          issued_at: new Date(Date.now() - 60000).toISOString(),
          expires_at: new Date(Date.now() + 60000).toISOString(),
          forbidden: [],
          revoked: false,
        },
      },
    },
  }));
  process.env.ARIFOS_MCP_URL = mockUrl;
  const result = await validateLeaseForTool("lease-scope-001", "forge_filesystem_write", "EXECUTE_REVERSIBLE");
  assert.equal(result.ok, false);
  assert.equal(result.gate, "LEASE_SCOPE_DENIED");
});

test("requireMutationApproval fails closed when kernel unreachable", async () => {
  process.env.ARIFOS_MCP_URL = "http://127.0.0.1:1";
  const result = await requireMutationApproval("file_ops.write", "/root/test.txt", "lease-any");
  assert.equal(result.allowed, false);
  assert.match(result.error ?? "", /888_HOLD/);
});
