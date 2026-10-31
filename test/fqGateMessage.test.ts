/**
 * fqGateMessage.test.ts — diagnostic-message contract (message-only change, 2026-10-25).
 * READY TO INSTALL at /root/A-FORGE/test/fqGateMessage.test.ts once the
 * F13 bounded-maintenance thaw covers test/ (currently chattr +i).
 *
 * Contract enforced here:
 *  1. DECISION INVARIANCE — for identical probe input, {permitted, verdict, fq}
 *     is byte-identical across the patch. Table pinned from the PRE-patch dist
 *     baseline run 2026-10-25T01:2xZ (see baseline-pre.json in this package).
 *  2. MESSAGE TRUTH — the reason names the rollup method and the binding actor,
 *     and labels pooled counts "NOT the gated input".
 *  3. The old misleading line ("Agents must verify to raise FQ...") is gone.
 *
 * Cache note: probeFq caches per module instance; each fixture loads a fresh
 * module via cache-busting dynamic import (same technique as the baseline harness).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const MODULE = '../src/domain/forge/check_verdict.js';
const ROLLUP = 'minimum_gated_harmonic_mean';

type FqPayload = Record<string, unknown> | null;

function mockFq(payload: FqPayload): void {
  if (payload === null) {
    (globalThis as Record<string, unknown>).fetch = async () => { throw new Error('ECONNREFUSED'); };
    return;
  }
  (globalThis as Record<string, unknown>).fetch = async () => ({
    ok: true,
    json: async () => ({ fq: payload }),
  });
}

async function freshGate(): Promise<(action: string) => Promise<{ permitted: boolean; verdict: string; fq: number; reason: string }>> {
  const mod = await import(`${MODULE}?fx=${Math.random()}`) as {
    checkFqGate: (a: string) => Promise<{ permitted: boolean; verdict: string; fq: number; reason: string }>;
  };
  return mod.checkFqGate;
}

const actor = (q: number, e: number, v: number) => ({ quotient: q, execute: e, verify: v, held: false, throttled: false, verdict: 'FLOWING' });

const FIXTURES: Array<[string, string, FqPayload, { permitted: boolean; verdict: string; fq: number }]> = [
  ['F1 q=0.49 -> HOLD', 'MUTATE',
    { quotient: 0.49, verdict: 'STUCK', execute_count: 25, verify_count: 7, rollup_formula: ROLLUP, metric_frame: { sample_size: 100 }, per_actor: { 'hermes-asi': { quotient: 0.49, execute: 25, verify: 7, held: true, throttled: true, verdict: 'STUCK' } } },
    { permitted: false, verdict: 'STUCK', fq: 0.49 }],
  ['F2 q=0.50 -> pass (boundary)', 'MUTATE',
    { quotient: 0.50, verdict: 'FLOWING', execute_count: 10, verify_count: 10, rollup_formula: ROLLUP, metric_frame: { sample_size: 100 }, per_actor: { 'lane-a': actor(0.5, 10, 10) } },
    { permitted: true, verdict: 'FLOWING', fq: 0.5 }],
  ['F3 q=0.51 -> pass', 'MUTATE',
    { quotient: 0.51, verdict: 'FLOWING', execute_count: 10, verify_count: 11, rollup_formula: ROLLUP, metric_frame: { sample_size: 100 }, per_actor: { 'lane-a': actor(0.51, 10, 11) } },
    { permitted: true, verdict: 'FLOWING', fq: 0.51 }],
  ['F4 null -> fail-closed 0.0', 'MUTATE',
    { quotient: null, verdict: 'UNKNOWN', execute_count: 0, verify_count: 0, per_actor: {} },
    { permitted: false, verdict: 'UNKNOWN', fq: 0 }],
  ['F5 unreachable -> HOLD', 'MUTATE', null,
    { permitted: false, verdict: 'UNREACHABLE', fq: 0 }],
  ['F6 OBSERVE -> exempt', 'OBSERVE',
    { quotient: 0.10, verdict: 'STUCK', execute_count: 99, verify_count: 1, per_actor: {} },
    { permitted: true, verdict: 'EXEMPT', fq: -1 }],
];

for (const [name, action, payload, expected] of FIXTURES) {
  test(`decision-invariance: ${name}`, async () => {
    mockFq(payload);
    const checkFqGate = await freshGate();
    const r = await checkFqGate(action);
    assert.equal(r.permitted, expected.permitted, 'permitted must be invariant');
    assert.equal(r.verdict, expected.verdict, 'verdict must be invariant');
    assert.equal(r.fq, expected.fq, 'fq must be invariant');
  });
}

test('message truth (HOLD): names rollup + binding actor + labels pooled counts', async () => {
  mockFq(FIXTURES[0][2]);
  const checkFqGate = await freshGate();
  const r = await checkFqGate('MUTATE');
  assert.match(r.reason, /rollup=minimum_gated_harmonic_mean/);
  assert.match(r.reason, /binding actor=hermes-asi@0\.490/);
  assert.match(r.reason, /NOT the gated input/);
  assert.doesNotMatch(r.reason, /Agents must verify to raise FQ/, 'old misleading instruction must be gone');
});

test('message truth (pass): same provenance on the pass branch', async () => {
  mockFq(FIXTURES[1][2]);
  const checkFqGate = await freshGate();
  const r = await checkFqGate('MUTATE');
  assert.match(r.reason, /rollup=minimum_gated_harmonic_mean/);
  assert.match(r.reason, /binding actor=lane-a@0\.500/);
  assert.match(r.reason, /NOT the gated input/);
});

test('synthetic actors never named as binding actor', async () => {
  mockFq({
    quotient: 0.30, verdict: 'STUCK', execute_count: 5, verify_count: 1,
    rollup_formula: ROLLUP,
    per_actor: { 'attacker': actor(0.01, 99, 0), 'lane-real': actor(0.30, 5, 1) },
  });
  const checkFqGate = await freshGate();
  const r = await checkFqGate('MUTATE');
  assert.match(r.reason, /binding actor=lane-real@0\.300/);
  assert.doesNotMatch(r.reason, /binding actor=attacker/);
});
