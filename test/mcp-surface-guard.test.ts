/**
 * MCP Surface Guard Test — Drift Detection & Federation Runner
 * 
 * Tests:
 *   1. Schema fingerprinting stability
 *   2. Drift detection (added, removed, changed tools)
 *   3. Required tool checking
 *   4. TTL / freshness
 *   5. Federation runner contract
 * 
 * FORGED: 2026-07-03
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  fingerprintSchema,
  fingerprintDescription,
  fingerprintTool,
  createSnapshot,
  detectDrift,
  checkToolCall,
  SurfaceGuardStore,
  getSurfaceGuardStore,
  resetSurfaceGuardStore,
  DEFAULT_CONFIG,
  type MCPToolFromList,
  type OrganSurfaceSnapshot,
} from '../src/domain/governance/mcp-surface-guard.js';

// ─── Fingerprinting ────────────────────────────────────────────────

describe('Schema Fingerprinting', () => {
  it('should produce stable hashes for identical schemas', () => {
    const schema = { type: 'object', properties: { x: { type: 'string' } } };
    const h1 = fingerprintSchema(schema);
    const h2 = fingerprintSchema(schema);
    assert.equal(h1, h2);
    assert.equal(h1.length, 16); // Truncated SHA-256
  });

  it('should produce different hashes for different schemas', () => {
    const s1 = { type: 'object', properties: { x: { type: 'string' } } };
    const s2 = { type: 'object', properties: { y: { type: 'number' } } };
    assert.notEqual(fingerprintSchema(s1), fingerprintSchema(s2));
  });

  it('should handle undefined schema', () => {
    assert.equal(fingerprintSchema(undefined), 'no_schema');
  });

  it('should produce stable description hashes', () => {
    const d1 = fingerprintDescription('test description');
    const d2 = fingerprintDescription('test description');
    assert.equal(d1, d2);
  });

  it('should handle undefined description', () => {
    assert.equal(fingerprintDescription(undefined), 'no_description');
  });
});

// ─── Drift Detection ───────────────────────────────────────────────

describe('Drift Detection', () => {
  const makeTool = (name: string, desc: string = 'desc'): MCPToolFromList => ({
    name,
    description: desc,
    inputSchema: { type: 'object', properties: {} },
  });

  it('should detect no drift for identical snapshots', () => {
    const tools = [makeTool('a'), makeTool('b')];
    const s1 = createSnapshot('test', 'http://localhost:1234', tools, false);
    const s2 = createSnapshot('test', 'http://localhost:1234', tools, false);
    const drifts = detectDrift(s1, s2);
    assert.equal(drifts.length, 0);
  });

  it('should detect TOOL_REMOVED', () => {
    const s1 = createSnapshot('test', 'http://localhost:1234', [makeTool('a'), makeTool('b')], false);
    const s2 = createSnapshot('test', 'http://localhost:1234', [makeTool('a')], false);
    const drifts = detectDrift(s1, s2);
    assert.equal(drifts.length, 1);
    assert.equal(drifts[0].drift_type, 'TOOL_REMOVED');
    assert.equal(drifts[0].tool_name, 'b');
    assert.equal(drifts[0].severity, 'CRITICAL');
  });

  it('should detect TOOL_ADDED', () => {
    const s1 = createSnapshot('test', 'http://localhost:1234', [makeTool('a')], false);
    const s2 = createSnapshot('test', 'http://localhost:1234', [makeTool('a'), makeTool('b')], false);
    const drifts = detectDrift(s1, s2);
    assert.equal(drifts.length, 1);
    assert.equal(drifts[0].drift_type, 'TOOL_ADDED');
    assert.equal(drifts[0].tool_name, 'b');
    assert.equal(drifts[0].severity, 'MEDIUM');
  });

  it('should detect SCHEMA_CHANGE', () => {
    const tool1 = { name: 'a', description: 'desc', inputSchema: { type: 'object', properties: { x: { type: 'string' } } } };
    const tool2 = { name: 'a', description: 'desc', inputSchema: { type: 'object', properties: { y: { type: 'number' } } } };
    const s1 = createSnapshot('test', 'http://localhost:1234', [tool1], false);
    const s2 = createSnapshot('test', 'http://localhost:1234', [tool2], false);
    const drifts = detectDrift(s1, s2);
    assert.equal(drifts.length, 1);
    assert.equal(drifts[0].drift_type, 'SCHEMA_CHANGE');
    assert.equal(drifts[0].severity, 'HIGH');
  });

  it('should detect DESCRIPTION_CHANGE', () => {
    const tool1 = { name: 'a', description: 'old desc', inputSchema: { type: 'object' } };
    const tool2 = { name: 'a', description: 'new desc', inputSchema: { type: 'object' } };
    const s1 = createSnapshot('test', 'http://localhost:1234', [tool1], false);
    const s2 = createSnapshot('test', 'http://localhost:1234', [tool2], false);
    const drifts = detectDrift(s1, s2);
    assert.equal(drifts.length, 1);
    assert.equal(drifts[0].drift_type, 'DESCRIPTION_CHANGE');
    assert.equal(drifts[0].severity, 'LOW');
  });
});

// ─── Surface Guard Store ───────────────────────────────────────────

describe('SurfaceGuardStore', () => {
  it('should pin and retrieve snapshots', () => {
    resetSurfaceGuardStore();
    const store = getSurfaceGuardStore();
    const tools: MCPToolFromList[] = [{ name: 'test_tool', description: 'test' }];
    const snap = createSnapshot('test', 'http://localhost:1234', tools, false);
    store.pin('test', snap);
    const retrieved = store.getPinned('test');
    assert.ok(retrieved);
    assert.equal(retrieved.tool_count, 1);
  });

  it('should check organ and detect drift on second call', () => {
    resetSurfaceGuardStore();
    const store = getSurfaceGuardStore();

    // First call — pins snapshot, no drift
    const tools1: MCPToolFromList[] = [{ name: 'tool_a', description: 'desc' }];
    const drifts1 = store.checkOrgan('test', tools1, false);
    assert.equal(drifts1.length, 0);

    // Second call with removed tool — should detect drift
    const tools2: MCPToolFromList[] = [];
    const drifts2 = store.checkOrgan('test', tools2, false);
    assert.equal(drifts2.length, 1);
    assert.equal(drifts2[0].drift_type, 'TOOL_REMOVED');
  });

  it('should respect TTL for freshness', () => {
    resetSurfaceGuardStore();
    const store = getSurfaceGuardStore({ snapshot_ttl_ms: 1000 });
    const tools: MCPToolFromList[] = [{ name: 'tool', description: 'desc' }];
    store.checkOrgan('test', tools, false);
    assert.ok(store.isFresh('test'));
  });
});

// ─── checkToolCall ─────────────────────────────────────────────────

describe('checkToolCall', () => {
  it('should return null when schema matches', () => {
    const tool = fingerprintTool({ name: 'a', description: 'd', inputSchema: { type: 'object' } });
    const result = checkToolCall(tool, { name: 'a', inputSchema: { type: 'object' } });
    assert.equal(result, null);
  });

  it('should return DriftEvent when schema changes', () => {
    const tool = fingerprintTool({ name: 'a', description: 'd', inputSchema: { type: 'object', properties: { x: { type: 'string' } } } });
    const result = checkToolCall(tool, { name: 'a', inputSchema: { type: 'object', properties: { y: { type: 'number' } } } });
    assert.ok(result);
    assert.equal(result.drift_type, 'SCHEMA_CHANGE');
    assert.equal(result.severity, 'HIGH');
  });
});
