import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { FileTicketStore } from "../src/approval/TicketStore.js";

test("TicketStore lifecycle: create, query, update, replay", async () => {
  const store = new FileTicketStore({ filePath: resolve(tmpdir(), `tickets-${Date.now()}.jsonl`) });
  await store.initialize();

  const ticket = await store.createTicket({
    ticketId: "t1",
    sessionId: "s1",
    status: "PENDING",
    riskLevel: "high",
    intentModel: "execution",
    domain: "infra",
    floorsTriggered: ["F13"],
    prompt: "drop db",
    planSummary: "drop the database",
    telemetrySnapshot: { dS: 0.1, peace2: 0.9, psi_le: 0.95, W3: 0.8, G: 0.75 },
    createdAt: new Date().toISOString(),
  });

  assert.equal(ticket.status, "PENDING");
  assert.ok(ticket.expiresAt);

  const found = await store.findById("t1");
  assert.equal(found?.status, "PENDING");

  await store.updateTicket("t1", { status: "APPROVED", decision: "APPROVE", humanId: "h1" });
  const approved = await store.findById("t1");
  assert.equal(approved?.status, "APPROVED");

  const open = await store.countOpen();
  assert.equal(open, 0);

  const all = await store.query({ sessionId: "s1" });
  assert.equal(all.length, 1); // query deduplicates to latest state per ticketId
});
