import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { mkdir, rm } from "node:fs/promises";
import { FileVaultClient, type VaultSealRecord } from "../src/vault/VaultClient.js";
import { FileTicketStore, resetTicketStore } from "../src/approval/TicketStore.js";
import { runCliCommand } from "../src/cli/commands.js";
import type { AgentProfile } from "../src/types/agent.js";
import type { LlmProvider } from "../src/llm/LlmProvider.js";
import type { RuntimeConfig } from "../src/config/RuntimeConfig.js";

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = resolve(tmpdir(), `operator-console-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  await mkdir(dir, { recursive: true });
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function mockRuntimeConfig(): RuntimeConfig {
  return {
    provider: { kind: "mock", model: "mock", baseUrl: "", timeoutMs: 1000 },
    featureFlags: { ENABLE_DANGEROUS_TOOLS: false, ENABLE_BACKGROUND_JOBS: false, ENABLE_EXPERIMENTAL_TOOLS: false },
    toolPolicy: { commandTimeoutMs: 1000, maxFileBytes: 1024, allowedCommandPrefixes: [], blockedCommandPatterns: [] },
    apiPricing: { inputCostPerMillionTokens: 0, outputCostPerMillionTokens: 0 },
    memoryPath: resolve(tmpdir(), "mock-memory.json"),
    scoreboardPath: resolve(tmpdir(), "mock-scoreboard.json"),
    runMetricsDir: resolve(tmpdir(), "mock-metrics"),
    trustLocalVps: false,
    defaultMode: "external_safe_mode",
  };
}

function mockEngineFactory(_profile: AgentProfile) {
  return {} as any;
}

function mockProviderFactory() {
  return {} as any;
}

test("FileVaultClient query filters by sessionId, verdict, since, until, limit", async () => {
  await withTempDir(async (dir) => {
    const vaultPath = resolve(dir, "vault.jsonl");
    const client = new FileVaultClient(vaultPath);

    const baseRecord: VaultSealRecord = {
      sealId: "s1",
      sessionId: "sess-a",
      verdict: "SEAL",
      hashofinput: "h1",
      telemetrysnapshot: { dS: 0, peace2: 1, psi_le: 1, W3: 0, G: 0 },
      floors_triggered: [],
      irreversibilityacknowledged: false,
      timestamp: "2026-04-10T10:00:00.000Z",
      task: "t1",
      finalText: "f1",
      turnCount: 1,
      profileName: "p1",
    };

    await client.seal({ ...baseRecord, sealId: "s1", sessionId: "sess-a", verdict: "SEAL", timestamp: "2026-04-10T10:00:00.000Z" });
    await client.seal({ ...baseRecord, sealId: "s2", sessionId: "sess-a", verdict: "HOLD", timestamp: "2026-04-11T10:00:00.000Z" });
    await client.seal({ ...baseRecord, sealId: "s3", sessionId: "sess-b", verdict: "VOID", timestamp: "2026-04-12T10:00:00.000Z" });

    const all = await client.query();
    assert.equal(all.length, 3);

    const bySession = await client.query({ sessionId: "sess-a" });
    assert.equal(bySession.length, 2);

    const byVerdict = await client.query({ verdict: "HOLD" });
    assert.equal(byVerdict.length, 1);
    assert.equal(byVerdict[0]!.sealId, "s2");

    const sinceQuery = await client.query({ since: "2026-04-11T00:00:00.000Z" });
    assert.equal(sinceQuery.length, 2);

    const untilQuery = await client.query({ until: "2026-04-11T00:00:00.000Z" });
    assert.equal(untilQuery.length, 1);
    assert.equal(untilQuery[0]!.sealId, "s1");

    const limited = await client.query({ limit: 2 });
    assert.equal(limited.length, 2);
    // newest first
    assert.equal(limited[0]!.sealId, "s3");
    assert.equal(limited[1]!.sealId, "s2");
  });
});

test("FileVaultClient findById returns correct record", async () => {
  await withTempDir(async (dir) => {
    const vaultPath = resolve(dir, "vault.jsonl");
    const client = new FileVaultClient(vaultPath);

    const baseRecord: VaultSealRecord = {
      sealId: "s1",
      sessionId: "sess-a",
      verdict: "SEAL",
      hashofinput: "h1",
      telemetrysnapshot: { dS: 0, peace2: 1, psi_le: 1, W3: 0, G: 0 },
      floors_triggered: [],
      irreversibilityacknowledged: false,
      timestamp: "2026-04-10T10:00:00.000Z",
      task: "t1",
      finalText: "f1",
      turnCount: 1,
      profileName: "p1",
    };

    await client.seal(baseRecord);
    const found = await client.findById("s1");
    assert.ok(found);
    assert.equal(found!.sealId, "s1");

    const missing = await client.findById("s99");
    assert.equal(missing, undefined);
  });
});

test("TicketStore query deduplicates and filters correctly", async () => {
  await withTempDir(async (dir) => {
    const ticketPath = resolve(dir, "tickets.jsonl");
    const store = new FileTicketStore({ filePath: ticketPath });

    await store.createTicket({
      ticketId: "t1",
      sessionId: "sess-1",
      status: "PENDING",
      riskLevel: "high",
      intentModel: "execution",
      floorsTriggered: ["F13"],
      prompt: "p1",
      planSummary: "ps1",
      telemetrySnapshot: { dS: 0, peace2: 1, psi_le: 1, W3: 0, G: 0 },
      createdAt: "2026-04-10T10:00:00.000Z",
    });

    await store.createTicket({
      ticketId: "t2",
      sessionId: "sess-2",
      status: "APPROVED",
      riskLevel: "medium",
      intentModel: "advisory",
      floorsTriggered: ["F7"],
      prompt: "p2",
      planSummary: "ps2",
      telemetrySnapshot: { dS: 0, peace2: 1, psi_le: 1, W3: 0, G: 0 },
      createdAt: "2026-04-10T11:00:00.000Z",
    });

    // update t1
    await store.updateTicket("t1", { status: "DISPATCHED" });

    const pending = await store.query({ status: "PENDING" });
    assert.equal(pending.length, 0);

    const dispatched = await store.query({ status: "DISPATCHED" });
    assert.equal(dispatched.length, 1);
    assert.equal(dispatched[0]!.ticketId, "t1");

    const high = await store.query({ riskLevel: "high" });
    assert.equal(high.length, 1);

    const sess1 = await store.query({ sessionId: "sess-1" });
    assert.equal(sess1.length, 1);

    const all = await store.query();
    assert.equal(all.length, 2);
    // newest first
    assert.equal(all[0]!.ticketId, "t2");
    assert.equal(all[1]!.ticketId, "t1");
  });
});

test("CLI operator approvals queries tickets via HOME override", async () => {
  await withTempDir(async (dir) => {
    const originalHome = process.env.HOME;
    process.env.HOME = dir;
    resetTicketStore();
    try {
      const store = new FileTicketStore();
      await store.createTicket({
        ticketId: "t1",
        sessionId: "sess-1",
        status: "PENDING",
        riskLevel: "high",
        intentModel: "execution",
        floorsTriggered: ["F13"],
        prompt: "p1",
        planSummary: "ps1",
        telemetrySnapshot: { dS: 0, peace2: 1, psi_le: 1, W3: 0, G: 0 },
        createdAt: "2026-04-10T10:00:00.000Z",
      });

      const output = await runCliCommand("operator", { cmd: "approvals", status: "PENDING" }, mockEngineFactory, mockProviderFactory, mockRuntimeConfig());
      const parsed = JSON.parse(output);
      assert.equal(parsed.ok, true);
      assert.equal(parsed.count, 1);
      assert.equal(parsed.tickets[0].ticketId, "t1");
    } finally {
      process.env.HOME = originalHome;
    }
  });
});

test("CLI operator vault queries seals via HOME override", async () => {
  await withTempDir(async (dir) => {
    const originalHome = process.env.HOME;
    process.env.HOME = dir;
    resetTicketStore();
    try {
      const client = new FileVaultClient();
      const baseRecord: VaultSealRecord = {
        sealId: "s1",
        sessionId: "sess-v",
        verdict: "HOLD",
        hashofinput: "h1",
        telemetrysnapshot: { dS: 0, peace2: 1, psi_le: 1, W3: 0, G: 0 },
        floors_triggered: ["F13"],
        irreversibilityacknowledged: false,
        timestamp: "2026-04-10T10:00:00.000Z",
        task: "t1",
        finalText: "f1",
        turnCount: 1,
        profileName: "p1",
      };
      await client.seal(baseRecord);

      const output = await runCliCommand("operator", { cmd: "vault", verdict: "HOLD", sessionId: "sess-v" }, mockEngineFactory, mockProviderFactory, mockRuntimeConfig());
      const parsed = JSON.parse(output);
      assert.equal(parsed.ok, true);
      assert.equal(parsed.count, 1);
      assert.equal(parsed.records[0].sealId, "s1");
    } finally {
      process.env.HOME = originalHome;
    }
  });
});
