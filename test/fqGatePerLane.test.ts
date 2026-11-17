/**
 * FQ Gate — Per-Lane Doctrine Tests (doctrine dipinda 2026-10-18, selari enjin):
 *
 *   "Lane FQ sendiri < 0.5 atau held=true → LANE ITU sahaja HOLD;
 *    lane lain terus jalan. Rollup = pemantauan, bukan gerbang."
 *
 * Covers the exact defect class where the global rollup blocked a healthy
 * lane's seal (FQ_GATE on global FQ while the lane itself was metabolically
 * fine) — and the conservative fallback where an UNATTRIBUTED mutation keeps
 * the legacy global gate (MUTATE path is not widened without identity).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gateToolByFq } from '../src/domain/forge/check_verdict.js';

const GLOBAL_LOW = 0.2; // rollup below threshold — the sibling-seal scenario

function mockArifFlow(perActor: Record<string, unknown>): void {
  (globalThis as Record<string, unknown>).fetch = async () => ({
    ok: true,
    json: async () => ({
      fq: {
        quotient: GLOBAL_LOW,
        verdict: 'CAUTION',
        execute_count: 45,
        verify_count: 20,
        per_actor: perActor,
      },
    }),
  });
}

test('healthy lane proceeds while global rollup is low (rollup = monitoring)', async () => {
  mockArifFlow({
    'lane-healthy': { held: false, throttled: false, quotient: 1.5, verdict: 'OPTIMAL', diagnosis: 'BALANCED' },
  });
  const r = await gateToolByFq('MUTATE', 'forge_shell', 'lane-healthy');
  assert.equal(r.allowed, true, 'healthy lane must not be gated by the global rollup');
  assert.match(r.fq!.reason, /monitoring only/);
});

test('held lane holds alone — healthy lane beside it keeps working', async () => {
  mockArifFlow({
    'lane-held': { held: true, throttled: false, quotient: 0.0, verdict: 'UNKNOWN', diagnosis: 'EXECUTION DOMINANCE' },
    'lane-ok': { held: false, throttled: false, quotient: 1.2, verdict: 'OPTIMAL', diagnosis: 'BALANCED' },
  });
  const blocked = await gateToolByFq('MUTATE', 'forge_shell', 'lane-held');
  assert.equal(blocked.allowed, false, 'held lane must hold');
  const open = await gateToolByFq('MUTATE', 'forge_shell', 'lane-ok');
  assert.equal(open.allowed, true, 'neighbouring lane must continue');
});

test('lane FQ < 0.50 holds even when the engine has not flagged held', async () => {
  mockArifFlow({
    'lane-lowfq': { held: false, throttled: false, quotient: 0.3, verdict: 'FLOWING', diagnosis: 'BALANCED' },
  });
  const r = await gateToolByFq('EXECUTE_REVERSIBLE', 'forge_shell', 'lane-lowfq');
  assert.equal(r.allowed, false);
  assert.match(r.fq!.reason, /Lane FQ=/);
});

test('unattributed MUTATE keeps the conservative global gate (path NOT widened)', async () => {
  mockArifFlow({});
  const r = await gateToolByFq('MUTATE', 'forge_shell');
  assert.equal(r.allowed, false, 'no-actor mutation must fall back to the legacy global gate');
});

test('OBSERVE-class exempt from metabolic gating', async () => {
  mockArifFlow({});
  const r = await gateToolByFq('OBSERVE', 'forge_observe', 'lane-any');
  assert.equal(r.allowed, true);
});

test('case/whitespace variance cannot escape a held lane (888 D1)', async () => {
  mockArifFlow({
    'lane-held': { held: true, throttled: false, quotient: 0.0, verdict: 'UNKNOWN', diagnosis: 'EXECUTION DOMINANCE' },
  });
  const r = await gateToolByFq('MUTATE', 'forge_shell', '  Lane-HELD ');
  assert.equal(r.allowed, false, 'canonicalization must defeat case-variance evasion of a held lane');
});

test('unmeasured lane falls back to the global gate and says so (888 D3)', async () => {
  mockArifFlow({
    'lane-ghost': { held: false, throttled: false, quotient: null, verdict: 'UNKNOWN', diagnosis: 'no data' },
  });
  const r = await gateToolByFq('MUTATE', 'forge_shell', 'lane-ghost');
  assert.equal(r.allowed, false, 'global fallback (0.2) must hold an unmeasured lane');
  assert.equal(r.fq!.lane_measured, false, 'receipt must not launder the rollup as a lane measurement');
  assert.match(r.fq!.reason, /UNMEASURED/);
});
