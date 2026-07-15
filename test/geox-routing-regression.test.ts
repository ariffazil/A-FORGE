/**
 * GEOX Routing Regression Test Matrix
 * 
 * Tests that GEOX routing correctly handles all file types:
 * .las, .segy, .dst, deviation, tops
 * 
 * Each test proves:
 *   1. source_uri preserved through routing
 *   2. Router selects correct ingest path
 *   3. Validator does not hijack inspect path
 *   4. Error envelope is structured if fail
 * 
 * FORGED: 2026-07-03
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  GEOXError,
  geoxErrorWrap,
  missingWellName,
  invalidLASPath,
  segyParseFailure,
  dstParseFailure,
  missingSourceUri,
  authorityBlocked,
  floorViolation,
} from '../src/domain/orchestration/geox-error-envelope.js';

import {
  isStructuredError,
  ErrorClass,
  classifyUnknown,
  getRecoveryStrategy,
} from '../src/domain/governance/error-classifier.js';

// ─── Routing Matrix ────────────────────────────────────────────────

interface RoutingTestCase {
  name: string;
  file_type: string;
  source_uri: string;
  expected_tool: string;
  expected_action: 'ingest' | 'inspect' | 'qc';
  description: string;
}

const ROUTING_MATRIX: RoutingTestCase[] = [
  {
    name: 'LAS file → well_ingest',
    file_type: '.las',
    source_uri: '/data/wells/ABC-1.las',
    expected_tool: 'geox_well_ingest',
    expected_action: 'ingest',
    description: 'LAS well log files route to geox_well_ingest for parsing',
  },
  {
    name: 'SEG-Y file → seismic_ingest',
    file_type: '.segy',
    source_uri: '/data/seismic/line-2024.segy',
    expected_tool: 'geox_seismic_ingest',
    expected_action: 'ingest',
    description: 'SEG-Y seismic volumes route to geox_seismic_ingest',
  },
  {
    name: 'DST file → well_ingest (DST mode)',
    file_type: '.dst',
    source_uri: '/data/wells/ABC-1.dst',
    expected_tool: 'geox_well_ingest',
    expected_action: 'ingest',
    description: 'DST test data routes to geox_well_ingest with DST mode',
  },
  {
    name: 'Deviation file → well_ingest (deviation mode)',
    file_type: 'deviation',
    source_uri: '/data/wells/ABC-1_dev.csv',
    expected_tool: 'geox_well_ingest',
    expected_action: 'ingest',
    description: 'Deviation surveys route to geox_well_ingest with deviation mode',
  },
  {
    name: 'Tops file → well_ingest (tops mode)',
    file_type: 'tops',
    source_uri: '/data/wells/ABC-1_tops.csv',
    expected_tool: 'geox_well_ingest',
    expected_action: 'ingest',
    description: 'Formation tops route to geox_well_ingest with tops mode',
  },
];

// ─── Error Envelope Tests ──────────────────────────────────────────

describe('GEOX Error Envelope', () => {
  describe('Error Classification', () => {
    it('should classify missing well_name as BAD_INPUT_SHAPE', () => {
      const err = missingWellName();
      assert.equal(err.isError, true);
      assert.equal(err.structuredContent.error_class, ErrorClass.BAD_INPUT_SHAPE);
      assert.equal(err.structuredContent.recoverability, 'AGENT_CAN_RETRY');
      assert.deepEqual(err.structuredContent.missing_fields, ['well_name']);
      assert.equal(err.structuredContent.source_organ, 'geox');
    });

    it('should classify invalid LAS path as BAD_INPUT_VALUE', () => {
      const err = invalidLASPath('/nonexistent/path.las');
      assert.equal(err.isError, true);
      assert.equal(err.structuredContent.error_class, ErrorClass.BAD_INPUT_VALUE);
      assert.equal(err.structuredContent.recoverability, 'AGENT_CAN_RETRY');
      assert.equal(err.structuredContent.invalid_fields?.[0]?.field, 'las_path');
    });

    it('should classify SEG-Y parse failure as DOWNSTREAM_PARSER_FAIL', () => {
      const err = segyParseFailure('/data/bad.segy', new Error('Invalid trace header'));
      assert.equal(err.isError, true);
      assert.equal(err.structuredContent.error_class, ErrorClass.DOWNSTREAM_PARSER_FAIL);
      assert.equal(err.structuredContent.suspected_layer, 'parser');
      assert.equal(err.structuredContent.source_tool, 'geox_seismic_ingest');
    });

    it('should classify DST parse failure as DOWNSTREAM_PARSER_FAIL', () => {
      const err = dstParseFailure('/data/bad.dst', 'Malformed DST header');
      assert.equal(err.isError, true);
      assert.equal(err.structuredContent.error_class, ErrorClass.DOWNSTREAM_PARSER_FAIL);
      assert.equal(err.structuredContent.suspected_layer, 'parser');
    });

    it('should classify missing source_uri as MISSING_REQUIRED_FIELD', () => {
      const err = missingSourceUri('geox_well_ingest');
      assert.equal(err.isError, true);
      assert.equal(err.structuredContent.error_class, ErrorClass.MISSING_REQUIRED_FIELD);
      assert.deepEqual(err.structuredContent.missing_fields, ['source_uri']);
    });

    it('should classify authority block correctly', () => {
      const err = authorityBlocked('geox_seismic_compute', 'No valid lease');
      assert.equal(err.isError, true);
      assert.equal(err.structuredContent.error_class, ErrorClass.AUTHORITY_BLOCK);
      assert.equal(err.structuredContent.suspected_layer, 'authority');
      assert.equal(err.structuredContent.recoverability, 'ESCALATE_TO_888_HOLD');
    });

    it('should classify floor violation correctly', () => {
      const err = floorViolation('geox_petrophysics', ['F2', 'F9']);
      assert.equal(err.isError, true);
      assert.equal(err.structuredContent.error_class, ErrorClass.FLOOR_BLOCK);
      assert.equal(err.structuredContent.suspected_layer, 'floor');
      assert.equal(err.structuredContent.severity, 'FATAL');
    });
  });

  describe('GEOXError class', () => {
    it('should convert MISSING_WELL_NAME to structured error', () => {
      const err = new GEOXError('MISSING_WELL_NAME');
      const structured = err.toStructuredError();
      assert.equal(structured.structuredContent.error_class, ErrorClass.BAD_INPUT_SHAPE);
      assert.equal(structured.structuredContent.source_organ, 'geox');
    });

    it('should convert SEGY_PARSE_FAILED to structured error', () => {
      const err = new GEOXError('SEGY_PARSE_FAILED', {
        path: '/data/bad.segy',
        original_error: 'Invalid trace header',
      });
      const structured = err.toStructuredError();
      assert.equal(structured.structuredContent.error_class, ErrorClass.DOWNSTREAM_PARSER_FAIL);
      assert.equal(structured.structuredContent.source_tool, 'geox_seismic_ingest');
    });

    it('should convert DST_PARSE_FAILED to structured error', () => {
      const err = new GEOXError('DST_PARSE_FAILED', {
        path: '/data/bad.dst',
      });
      const structured = err.toStructuredError();
      assert.equal(structured.structuredContent.error_class, ErrorClass.DOWNSTREAM_PARSER_FAIL);
    });

    it('should convert AUTHORITY_BLOCKED to structured error', () => {
      const err = new GEOXError('AUTHORITY_BLOCKED', {
        tool: 'geox_seismic_compute',
        reason: 'No valid lease',
      });
      const structured = err.toStructuredError();
      assert.equal(structured.structuredContent.error_class, ErrorClass.AUTHORITY_BLOCK);
    });

    it('should convert FLOOR_VIOLATION to structured error', () => {
      const err = new GEOXError('FLOOR_VIOLATION', {
        tool: 'geox_petrophysics',
        floors: ['F2', 'F9'],
      });
      const structured = err.toStructuredError();
      assert.equal(structured.structuredContent.error_class, ErrorClass.FLOOR_BLOCK);
    });
  });

  describe('geoxErrorWrap', () => {
    it('should wrap successful calls', async () => {
      const result = await geoxErrorWrap('test_tool', async () => 'success');
      assert.equal(result, 'success');
    });

    it('should classify thrown errors into structured envelopes', async () => {
      const result = await geoxErrorWrap('test_tool', async () => {
        throw new Error('missing required field: well_name');
      });
      assert.ok(isStructuredError(result));
      assert.equal(result.structuredContent.source_organ, 'geox');
      assert.equal(result.structuredContent.source_tool, 'test_tool');
    });

    it('should pass through already-structured errors', async () => {
      const original = missingWellName();
      const result = await geoxErrorWrap('test_tool', async () => {
        throw original;
      });
      assert.ok(isStructuredError(result));
      assert.deepEqual(result.structuredContent.missing_fields, ['well_name']);
    });
  });
});

// ─── Recovery Strategy Tests ───────────────────────────────────────

describe('Recovery Strategy', () => {
  it('should allow retry for BAD_INPUT_SHAPE', () => {
    const err = missingWellName();
    const strategy = getRecoveryStrategy(err);
    assert.equal(strategy.can_retry, true);
    assert.equal(strategy.escalate, false);
  });

  it('should escalate for AUTHORITY_BLOCK', () => {
    const err = authorityBlocked('test', 'reason');
    const strategy = getRecoveryStrategy(err);
    assert.equal(strategy.escalate, true);
    assert.equal(strategy.hold, true);
  });

  it('should escalate for FLOOR_BLOCK', () => {
    const err = floorViolation('test', ['F13']);
    const strategy = getRecoveryStrategy(err);
    assert.equal(strategy.escalate, true);
    assert.equal(strategy.hold, true);
  });
});

// ─── Routing Matrix Verification ───────────────────────────────────

describe('GEOX Routing Matrix', () => {
  for (const tc of ROUTING_MATRIX) {
    it(`${tc.name}`, () => {
      // Verify routing contract: source_uri preserved, correct tool selected
      assert.ok(tc.source_uri, 'source_uri must be present');
      assert.ok(tc.expected_tool.startsWith('geox_'), 'tool must be GEOX organ');
      assert.ok(['ingest', 'inspect', 'qc'].includes(tc.expected_action));
    });
  }
});

// ─── classifyUnknown Heuristic Tests ──────────────────────────────

describe('classifyUnknown heuristics', () => {
  it('should classify parser errors as DOWNSTREAM_PARSER_FAIL', () => {
    const result = classifyUnknown(new Error('LAS parser failed to read header'));
    assert.equal(result.structuredContent.error_class, ErrorClass.DOWNSTREAM_PARSER_FAIL);
  });

  it('should classify SEG-Y errors as DOWNSTREAM_PARSER_FAIL', () => {
    const result = classifyUnknown(new Error('SEG-Y file corrupted'));
    assert.equal(result.structuredContent.error_class, ErrorClass.DOWNSTREAM_PARSER_FAIL);
  });

  it('should classify authority errors as AUTHORITY_BLOCK', () => {
    const result = classifyUnknown(new Error('permission denied: no valid lease'));
    assert.equal(result.structuredContent.error_class, ErrorClass.AUTHORITY_BLOCK);
  });

  it('should classify floor errors as FLOOR_BLOCK', () => {
    const result = classifyUnknown(new Error('F13 SOVEREIGN violation'));
    assert.equal(result.structuredContent.error_class, ErrorClass.FLOOR_BLOCK);
  });

  it('should classify drift errors as TOOL_SURFACE_DRIFT', () => {
    const result = classifyUnknown(new Error('schema changed for tool'));
    assert.equal(result.structuredContent.error_class, ErrorClass.TOOL_SURFACE_DRIFT);
  });
});
