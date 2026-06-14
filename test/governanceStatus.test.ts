/**
 * governance-status endpoint tests
 * 
 * F2 TRUTH: The /api/governance-status endpoint must return live floor data.
 * F9 ANTI-HANTU: Must never return fabricated floor verdicts.
 * F1 AMANAH: Endpoint is read-only — no mutation paths.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.AFORGE_TEST_URL ?? 'http://127.0.0.1:7071';

describe('GET /api/governance-status', () => {
  it('returns ok:true with floors array', async () => {
    const res = await fetch(`${BASE}/api/governance-status`);
    assert.equal(res.status, 200);
    const data = await res.json() as any;
    assert.equal(data.ok, true);
    assert.ok(Array.isArray(data.floors), 'floors must be an array');
    assert.ok(data.floors.length >= 8, 'must have at least 8 floors');
  });

  it('every floor entry has required fields', async () => {
    const res = await fetch(`${BASE}/api/governance-status`);
    const data = await res.json() as any;
    for (const floor of data.floors) {
      assert.ok(floor.floor, `floor.floor must exist: ${JSON.stringify(floor)}`);
      assert.ok(floor.name, `floor.name must exist: ${JSON.stringify(floor)}`);
      assert.ok(['clear','violation','unknown'].includes(floor.status),
        `floor.status must be clear/violation/unknown: ${floor.status}`);
      assert.ok(floor.source, `floor.source must exist: ${JSON.stringify(floor)}`);
      assert.ok(typeof floor.staleness_seconds === 'number',
        `floor.staleness_seconds must be number: ${JSON.stringify(floor)}`);
    }
  });

  it('includes F13 SOVEREIGN floor', async () => {
    const res = await fetch(`${BASE}/api/governance-status`);
    const data = await res.json() as any;
    const f13 = data.floors.find((f: any) => f.floor === 'F13');
    assert.ok(f13, 'F13 SOVEREIGN must be present');
    assert.equal(f13.name, 'SOVEREIGN');
  });

  it('has epoch_id and timestamp', async () => {
    const res = await fetch(`${BASE}/api/governance-status`);
    const data = await res.json() as any;
    assert.ok(data.epoch_id, 'epoch_id must exist');
    assert.ok(data.timestamp, 'timestamp must exist');
    assert.ok(data.note, 'advisory note must exist');
  });

  it('advisory note contains arifOS reference', async () => {
    const res = await fetch(`${BASE}/api/governance-status`);
    const data = await res.json() as any;
    assert.ok(
      data.note.toLowerCase().includes('arifos'),
      'note must reference arifOS as the true judge'
    );
  });
});
