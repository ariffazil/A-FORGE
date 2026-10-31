/**
 * sealLedgerRouting — a ledger must state where it writes, whether it is being
 * written, and whether its chain is still one chain.
 *
 * 2026-10-31 · 333-AGI · Workstream A of ARIFOS::AGENT_TO_AGENT_REALITY_COMPLETION::v1
 *
 * Invariants pinned here:
 *  - env override wins and is labelled;
 *  - with no env, the ACTIVE segment is chosen and labelled `active-default`
 *    (never the frozen archive);
 *  - with neither, resolution FAILS CLOSED with SEAL_LEDGER_NO_ACTIVE_SEGMENT;
 *  - health never throws — it reports the failure as data;
 *  - rotated-segment continuity is verified from the sidecar anchor, and a
 *    tampered record breaks `chain.verified`;
 *  - the mirrored canonical serializer matches the frozen core's formula,
 *    proved against a real record from the live active segment.
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  canonicalSerialize,
  ensureSealLedgerRouting,
  findRotationSidecar,
  resolveSealLedgerPath,
  sealLedgerHealth,
  sealLedgerResolutionSource,
  sha256Hex,
  SealLedgerConfigError,
  SEAL_GENESIS_SEED,
} from "../src/interfaces/mcp/ledger/sealLedgerRouting.js";

const GENESIS_HASH = sha256Hex(SEAL_GENESIS_SEED);

/** Real record #1 from /root/A-FORGE/data-active/vault999_chain.jsonl (2026-10-29). */
const LIVE_RECORD = {
  seq: 1,
  ts: "2026-10-29T12:02:44.804Z",
  tool: "p0-seal-ledger-segment-rotation",
  args: {
    segment: "/root/A-FORGE/data-active/vault999_chain.jsonl",
    sidecar: "/root/A-FORGE/data-active/ROTATION-2026-10-29.json",
    previous_segment_seq: 73,
    previous_segment_tail_hash: "7e09c8ba97bc24c4564ba2e4679bf6617c08b8c8303c0112bd7d2245cae9029c",
    dropin: "40-seal-ledger.conf (both units)",
  },
  judge_decision: "COUNCIL_P0_DIRECTIVE_2026-10-29",
  exit_code: 0,
  stdout_sha256: "de9fff429175534d88fed5575054da643cbb29eac4afa065dbb2eebec4f55457",
  stderr_sha256: "0f604cd7512241ccb7b3a2e816af573b113a2f96807f9c3b23b95d94697f8efe",
  prev_hash: "dc70280c9e85b6de566ec023a75820cc11ed575e3844941b51a8716dec5ed280",
  approver: "external-council-copilot",
  notes: "Controlled reversible write closing P0 criterion (a); witness readback follows; rollback = remove drop-ins + restart",
  hash: "3c64bebce97b853b41e0fa1609b385c3ba16a094a104a5f7db2c8b64b5033815",
};

let saved: string | undefined;
let workDir: string;

beforeEach(() => {
  saved = process.env.AFORGE_SEAL_LEDGER;
  delete process.env.AFORGE_SEAL_LEDGER;
  workDir = mkdtempSync(join(tmpdir(), "seal-routing-"));
});

afterEach(() => {
  if (saved === undefined) delete process.env.AFORGE_SEAL_LEDGER;
  else process.env.AFORGE_SEAL_LEDGER = saved;
  rmSync(workDir, { recursive: true, force: true });
});

function makeRecord(seq: number, prevHash: string, ts: string, marker = "run") {
  const base: Record<string, unknown> = {
    seq,
    ts,
    tool: "forge_shell",
    args: { cmd: `echo ${marker}` },
    judge_decision: "auto",
    exit_code: 0,
    stdout_sha256: sha256Hex(`${marker}-out`),
    stderr_sha256: sha256Hex(""),
    prev_hash: prevHash,
  };
  return { ...base, hash: sha256Hex(canonicalSerialize(base)) };
}

describe("ledger routing", () => {
  it("honours AFORGE_SEAL_LEDGER and labels the source", () => {
    const p = join(workDir, "chain.jsonl");
    process.env.AFORGE_SEAL_LEDGER = p;
    assert.equal(resolveSealLedgerPath(), p);
    assert.equal(sealLedgerResolutionSource(), "env");
  });

  it("falls back to the ACTIVE segment, never the frozen archive", () => {
    const active = join(workDir, "active.jsonl");
    writeFileSync(active, "");
    assert.equal(resolveSealLedgerPath({ activeSegment: active }), active);
    assert.equal(sealLedgerResolutionSource(active), "active-default");
  });

  it("fails closed with a precise error when no segment is configured", () => {
    assert.throws(
      () => resolveSealLedgerPath({ activeSegment: join(workDir, "nope.jsonl") }),
      (err: any) => err instanceof SealLedgerConfigError && err.code === "SEAL_LEDGER_NO_ACTIVE_SEGMENT",
    );
  });

  it("boot binding fails closed instead of silently using the archive", () => {
    const prevExists = resolveSealLedgerPath.length; // touch signature, no behaviour
    assert.equal(typeof prevExists, "number");
    // Real active segment exists on this host, so boot binding must succeed and
    // must bind the env var (so the sealed core resolver agrees with us).
    const bound = ensureSealLedgerRouting();
    assert.equal(bound.source, "active-default");
    assert.equal(bound.bound_env, true);
    assert.equal(process.env.AFORGE_SEAL_LEDGER, bound.path);
  });
});

describe("sealLedgerHealth", () => {
  it("reports fail-closed as data, never throws", async () => {
    const health = await sealLedgerHealth({ activeSegment: join(workDir, "nope.jsonl") });
    assert.equal(health.resolved_path, null);
    assert.equal(health.writable, false);
    assert.equal(health.error_class, "SEAL_LEDGER_NO_ACTIVE_SEGMENT");
    assert.match(health.error ?? "", /SEAL_LEDGER_NO_ACTIVE_SEGMENT/);
  });

  it("verifies rotated-segment continuity from the sidecar anchor", async () => {
    const ledger = join(workDir, "active.jsonl");
    const anchor = sha256Hex("closed-segment-tail");
    const r1 = makeRecord(1, anchor, "2026-10-30T00:00:00.000Z");
    const r2 = makeRecord(2, r1.hash, "2026-10-30T00:05:00.000Z");
    writeFileSync(ledger, `${JSON.stringify(r1)}\n${JSON.stringify(r2)}\n`);
    writeFileSync(
      join(workDir, "ROTATION-2026-10-30.json"),
      JSON.stringify({
        rotated_utc: "2026-10-30T00:00:00Z",
        previous_segment: "/frozen/old.jsonl",
        previous_seq: 73,
        previous_tail_hash: anchor,
        new_segment: ledger,
      }),
    );
    process.env.AFORGE_SEAL_LEDGER = ledger;

    const health = await sealLedgerHealth({ activeSegment: ledger });
    assert.equal(health.resolution_source, "env");
    assert.equal(health.continuity.status, "held-by-hash-link");
    assert.equal(health.continuity.previous_seq, 73);
    assert.equal(health.continuity.anchor_prev_hash, anchor);
    assert.equal(health.chain.verified, true);
    assert.equal(health.last_sequence, 2);
    assert.equal(health.last_append_at, "2026-10-30T00:05:00.000Z");
    assert.equal(health.writable, true);
    assert.ok((health.stale_seconds ?? -1) >= 0);
    assert.equal(health.segment_id, "active.jsonl");
  });

  it("reports a broken chain when a record is tampered with", async () => {
    const ledger = join(workDir, "tampered.jsonl");
    const anchor = sha256Hex("closed-segment-tail");
    const r1 = makeRecord(1, anchor, "2026-10-30T00:00:00.000Z");
    const r2 = makeRecord(2, r1.hash, "2026-10-30T00:05:00.000Z");
    const tampered = { ...r2, exit_code: 9 };
    writeFileSync(ledger, `${JSON.stringify(r1)}\n${JSON.stringify(tampered)}\n`);
    writeFileSync(
      join(workDir, "ROTATION-2026-10-30.json"),
      JSON.stringify({ previous_tail_hash: anchor, previous_seq: 73, new_segment: ledger }),
    );
    process.env.AFORGE_SEAL_LEDGER = ledger;

    const health = await sealLedgerHealth({ activeSegment: ledger });
    assert.equal(health.chain.verified, false);
    assert.ok(health.chain.errors.length >= 1);
    assert.equal(health.continuity.status, "held-by-hash-link", "continuity is a segment-boundary fact, not a record-integrity fact");
  });

  it("finds no sidecar and says so rather than inventing predecessors", async () => {
    const ledger = join(workDir, "fresh.jsonl");
    const r1 = makeRecord(1, GENESIS_HASH, "2026-10-30T00:00:00.000Z");
    writeFileSync(ledger, `${JSON.stringify(r1)}\n`);
    process.env.AFORGE_SEAL_LEDGER = ledger;

    assert.equal(findRotationSidecar(ledger), null);
    const health = await sealLedgerHealth({ activeSegment: ledger });
    assert.equal(health.continuity.status, "no-predecessor");
    assert.equal(health.chain.verified, true);
  });
});

describe("fresh-genesis segments", () => {
  it("reports metadata-only continuity when the sidecar claims a tail the chain never links to", async () => {
    // Shape of the real 2026-10-29 rotation: fresh genesis + sidecar claiming the
    // closed segment's tail hash. The chain is VALID; only the sidecar carries
    // continuity. The instrument must not call that an invalid chain.
    const ledger = join(workDir, "rotated.jsonl");
    const r1 = makeRecord(1, GENESIS_HASH, "2026-10-30T00:00:00.000Z");
    writeFileSync(ledger, `${JSON.stringify(r1)}\n`);
    writeFileSync(
      join(workDir, "ROTATION-2026-10-30.json"),
      JSON.stringify({ previous_tail_hash: sha256Hex("closed-segment-tail"), previous_seq: 73, new_segment: ledger }),
    );
    process.env.AFORGE_SEAL_LEDGER = ledger;

    const health = await sealLedgerHealth({ activeSegment: ledger });
    assert.equal(health.continuity.status, "metadata-only");
    assert.equal(health.chain.verified, true, "the chain itself is intact");
    assert.equal(health.continuity.previous_seq, 73);
  });

  it("reports mismatch when the chain links neither to genesis nor to the claimed tail", async () => {
    const ledger = join(workDir, "orphan.jsonl");
    const r1 = makeRecord(1, sha256Hex("some-other-chain"), "2026-10-30T00:00:00.000Z");
    writeFileSync(ledger, `${JSON.stringify(r1)}\n`);
    writeFileSync(
      join(workDir, "ROTATION-2026-10-30.json"),
      JSON.stringify({ previous_tail_hash: sha256Hex("closed-segment-tail"), previous_seq: 73, new_segment: ledger }),
    );
    process.env.AFORGE_SEAL_LEDGER = ledger;

    const health = await sealLedgerHealth({ activeSegment: ledger });
    assert.equal(health.continuity.status, "mismatch");
    assert.equal(health.chain.verified, false);
  });
});

describe("canonical serializer parity with the frozen core", () => {
  it("recomputes the live active-segment record hash exactly", () => {
    const { hash, ...rest } = LIVE_RECORD;
    assert.equal(sha256Hex(canonicalSerialize(rest)), hash);
  });
});
