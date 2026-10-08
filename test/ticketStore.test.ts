import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { FileTicketStore } from "../src/application/approval/TicketStore.js";

// FileTicketStore is REPLACED by constitutional governance (arifOS :8088).
// The export remains as an alias of ConstitutionTicketStore: every ticket it
// mints carries the constitution_gate status and the arifOS gate attribution.
// Legacy PENDING→APPROVED lifecycle semantics no longer exist on this path.
test("FileTicketStore is replaced by the constitution gate (arifOS :8088)", async () => {
  const store = new FileTicketStore({ filePath: resolve(tmpdir(), `tickets-${Date.now()}.jsonl`) });
  await store.initialize();

  const ticket = await store.createTicket({
    ticketId: "t1",
    sessionId: "s1",
    status: "PENDING", // legacy param — must be overridden, never trusted
    riskLevel: "high",
    intentModel: "execution",
    domain: "infra",
    floorsTriggered: ["F13"],
    prompt: "drop db",
    planSummary: "drop the database",
    telemetrySnapshot: { dS: 0.1, peace2: 0.9, psi_le: 0.95, W3: 0.8, G: 0.75 },
    createdAt: new Date().toISOString(),
  });

  assert.equal(ticket.status, "constitution_gate");
  assert.equal((ticket as Record<string, unknown>).decidedBy, "arifOS:8088");

  const found = await store.findById("t1");
  assert.equal(found?.status, "constitution_gate");

  const updated = await store.updateTicket("t1", { status: "APPROVED", decision: "APPROVE", humanId: "h1" });
  // updates are accepted but the gate attribution is preserved
  assert.ok(updated);
});
