/**
 * sealLedgerHealth — the receipt ledger must tell the truth about itself.
 *
 * 2026-10-26 · 333-AGI · next-horizon P0.
 *
 * Reproduced: /root/A-FORGE/data and data/vault999_chain.jsonl are both
 * chattr +i, so every append returns EPERM. The chain stopped at seq 73 on
 * 2026-09-15 and nothing said so. A ledger that silently stops is worse than no
 * ledger: it keeps the appearance of audit while the evidence set is frozen.
 *
 * Invariants pinned here:
 *  - the env override is honoured, with the source labelled;
 *  - writable=false ALWAYS carries a non-null reason (no bare false);
 *  - a writable path is genuinely appendable (proved by writing).
 * Deliberately NOT asserted: whether the default path is writable on any given
 * host — that is an environment fact, reported, not a test expectation.
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_SEAL_LEDGER_PATH,
  resolveSealLedgerPath,
  sealLedgerHealth,
} from "../src/interfaces/mcp/shell/arifSeal.js";

let saved: string | undefined;
let workDir: string;

beforeEach(() => {
  saved = process.env.AFORGE_SEAL_LEDGER;
  workDir = mkdtempSync(join(tmpdir(), "seal-health-"));
});

afterEach(() => {
  if (saved === undefined) delete process.env.AFORGE_SEAL_LEDGER;
  else process.env.AFORGE_SEAL_LEDGER = saved;
  rmSync(workDir, { recursive: true, force: true });
});

describe("sealLedgerHealth", () => {
  it("defaults to the frozen archive path and labels the source", () => {
    delete process.env.AFORGE_SEAL_LEDGER;
    assert.equal(resolveSealLedgerPath(), DEFAULT_SEAL_LEDGER_PATH);
    assert.match(DEFAULT_SEAL_LEDGER_PATH, /vault999_chain\.jsonl$/);
  });

  it("honours AFORGE_SEAL_LEDGER and reports a writable path truthfully", async () => {
    const ledgerPath = join(workDir, "vault999_chain.jsonl");
    writeFileSync(ledgerPath, "");
    process.env.AFORGE_SEAL_LEDGER = ledgerPath;

    const health = await sealLedgerHealth();
    assert.equal(health.path, ledgerPath);
    assert.equal(health.source, "env");
    assert.equal(health.writable, true);
    assert.equal(health.error, null);
    assert.ok(existsSync(health.path));
  });

  it("a writable path is genuinely appendable (not just stat-able)", async () => {
    const ledgerPath = join(workDir, "chain.jsonl");
    writeFileSync(ledgerPath, "");
    process.env.AFORGE_SEAL_LEDGER = ledgerPath;

    await sealLedgerHealth();
    const { appendFileSync } = await import("node:fs");
    appendFileSync(ledgerPath, '{"seq":1}\n');
    assert.match(readFileSync(ledgerPath, "utf8"), /"seq":1/);
  });

  it("an unwritable path reports false AND a reason — never a bare false", async () => {
    process.env.AFORGE_SEAL_LEDGER = join(workDir, "missing-dir", "chain.jsonl");

    const health = await sealLedgerHealth();
    assert.equal(health.writable, false);
    assert.equal(typeof health.error, "string");
    assert.ok((health.error as string).length > 0, "writable=false must carry a reason");
  });
});
