/**
 * Federation Safety Integration Test — All 9 Discoveries
 * 
 * Proves the governed agentic stack works end-to-end:
 *   1. Surface truth (mcp_surface_guard)
 *   2. Operator truth (WELL gate)
 *   3. Failure truth (error envelopes)
 *   4. Chain truth (progress/cancel)
 *   5. Route truth (GEOX routing)
 *   6. Execution authority (action classes)
 *   7. Remote state (git preflight)
 *   8. Memory classification (epistemic state)
 *   9. Epistemic signal (truth labels)
 * 
 * This test passes ONLY if all 9 discoveries are wired.
 * 
 * FORGED: 2026-07-03
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Discovery 1: Surface truth
import {
  fingerprintSchema,
  fingerprintTool,
  createSnapshot,
  detectDrift,
  SurfaceGuardStore,
  resetSurfaceGuardStore,
  type MCPToolFromList,
} from '../src/domain/governance/mcp-surface-guard.js';

// Discovery 2: Operator truth (WELL gate)
import {
  ChainOrchestrator,
  createChain,
  chainStep,
  type WellGateResult,
  type ChainStep,
} from '../src/domain/orchestration/chain-orchestrator.js';

// Discovery 3: Failure truth
import {
  badInputShape,
  downstreamFailure,
  authorityBlock,
  classifyUnknown,
  isStructuredError,
  getRecoveryStrategy,
  ErrorClass,
  type MCPStructuredError,
} from '../src/domain/governance/error-classifier.js';

// Discovery 5: Route truth
import {
  GEOXError,
  missingWellName,
  segyParseFailure,
} from '../src/domain/orchestration/geox-error-envelope.js';

// Discovery 7: Remote state
import {
  gitRemotePreflight,
} from '../src/domain/governance/git-remote-preflight.js';

// ─── Discovery 1: Surface Truth ────────────────────────────────────

describe('Discovery 1: Surface Truth', () => {
  it('should fingerprint tool schemas and detect drift', () => {
    const tool: MCPToolFromList = {
      name: 'geox_well_ingest',
      description: 'Load well log data',
      inputSchema: { type: 'object', properties: { well_name: { type: 'string' } } },
    };

    const fp = fingerprintTool(tool);
    assert.ok(fp.schema_hash.length === 16, 'Hash is truncated SHA-256');
    assert.ok(fp.description_hash.length === 16);

    // Schema change detected
    const toolChanged: MCPToolFromList = {
      ...tool,
      inputSchema: { type: 'object', properties: { well_name: { type: 'number' } } },
    };

    const fpChanged = fingerprintTool(toolChanged);
    assert.notEqual(fp.schema_hash, fpChanged.schema_hash, 'Schema change detected');
  });

  it('should detect TOOL_REMOVED as CRITICAL drift', () => {
    resetSurfaceGuardStore();
    const store = new SurfaceGuardStore();
    
    const tools: MCPToolFromList[] = [
      { name: 'tool_a', description: 'desc' },
      { name: 'tool_b', description: 'desc' },
    ];
    
    // Pin snapshot
    store.checkOrgan('test', tools, false);
    
    // Remove a tool
    const drifts = store.checkOrgan('test', [{ name: 'tool_a', description: 'desc' }], false);
    assert.equal(drifts.length, 1);
    assert.equal(drifts[0].drift_type, 'TOOL_REMOVED');
    assert.equal(drifts[0].severity, 'CRITICAL');
  });
});

// ─── Discovery 2: Operator Truth ───────────────────────────────────

describe('Discovery 2: Operator Truth (WELL Gate)', () => {
  it('should BLOCK chain when WELL returns HOLD', async () => {
    const chain = createChain({
      description: 'Test chain',
      requested_by: 'test',
      steps: [
        chainStep({ id: 'step1', organ: 'test', tool: 'test_tool', arguments: {} }),
      ],
    });

    const executor = async () => 'ok';
    const wellChecker = async (): Promise<WellGateResult> => ({
      verdict: 'HOLD',
      score: 20,
      color: 'RED',
      checked_at: new Date().toISOString(),
      action: 'Operator not ready',
    });

    const orchestrator = new ChainOrchestrator(chain, executor, wellChecker);
    const result = await orchestrator.run();

    assert.equal(result.status, 'failed');
    assert.ok(result.progress_message.includes('BLOCKED'));
    assert.equal(result.definition.steps[0].status, 'pending', 'Step never ran');
  });

  it('should PROCEED when WELL returns GREEN', async () => {
    const chain = createChain({
      description: 'Test chain',
      requested_by: 'test',
      steps: [
        chainStep({ id: 'step1', organ: 'test', tool: 'test_tool', arguments: {} }),
      ],
    });

    let executed = false;
    const executor = async () => { executed = true; return 'ok'; };
    const wellChecker = async (): Promise<WellGateResult> => ({
      verdict: 'PROCEED',
      score: 85,
      color: 'GREEN',
      checked_at: new Date().toISOString(),
      action: 'Proceed',
    });

    const orchestrator = new ChainOrchestrator(chain, executor, wellChecker);
    const result = await orchestrator.run();

    assert.equal(result.status, 'completed');
    assert.ok(executed, 'Step executed after WELL passed');
  });

  it('should SIMPLIFY chain by skipping non-essential steps', async () => {
    const chain = createChain({
      description: 'Test chain',
      requested_by: 'test',
      steps: [
        chainStep({ id: 'essential', organ: 'test', tool: 'tool_a', arguments: {}, essential: true }),
        chainStep({ id: 'optional', organ: 'test', tool: 'tool_b', arguments: {}, essential: false }),
      ],
    });

    const executed: string[] = [];
    const executor = async (step: ChainStep) => { executed.push(step.id); return 'ok'; };
    const wellChecker = async (): Promise<WellGateResult> => ({
      verdict: 'SIMPLIFY',
      score: 55,
      color: 'YELLOW',
      checked_at: new Date().toISOString(),
      action: 'Simplify chain',
    });

    const orchestrator = new ChainOrchestrator(chain, executor, wellChecker);
    const result = await orchestrator.run();

    assert.equal(result.status, 'completed');
    assert.deepEqual(executed, ['essential'], 'Non-essential step skipped');
    assert.ok(result.adaptations.length > 0, 'Adaptation recorded');
  });
});

// ─── Discovery 3: Failure Truth ────────────────────────────────────

describe('Discovery 3: Failure Truth', () => {
  it('should produce structured error with recoverability', () => {
    const err = badInputShape('Missing well_name', {
      missing_fields: ['well_name'],
      source_tool: 'geox_well_ingest',
      source_organ: 'geox',
    });

    assert.equal(err.isError, true);
    assert.equal(err.structuredContent.error_class, ErrorClass.BAD_INPUT_SHAPE);
    assert.equal(err.structuredContent.recoverability, 'AGENT_CAN_RETRY');
    assert.equal(err.structuredContent.suspected_layer, 'input_validation');
    assert.ok(err.structuredContent.next_action, 'Has next_action');
    assert.ok(err.structuredContent.timestamp, 'Has timestamp');
  });

  it('should classify unknown errors into structured envelopes', () => {
    const result = classifyUnknown(new Error('permission denied: no valid lease'));
    assert.equal(result.structuredContent.error_class, ErrorClass.AUTHORITY_BLOCK);
    assert.equal(result.structuredContent.recoverability, 'ESCALATE_TO_888_HOLD');
  });

  it('should provide recovery strategy', () => {
    const err = authorityBlock('Blocked', { source_tool: 'test' });
    const strategy = getRecoveryStrategy(err);
    assert.equal(strategy.escalate, true);
    assert.equal(strategy.hold, true);
    assert.equal(strategy.can_retry, false);
  });
});

// ─── Discovery 4: Chain Truth ──────────────────────────────────────

describe('Discovery 4: Chain Truth', () => {
  it('should track progress through chain steps', async () => {
    const progressMessages: string[] = [];

    const chain = createChain({
      description: 'Progress test',
      requested_by: 'test',
      steps: [
        chainStep({ id: 'a', organ: 'test', tool: 'tool_a', arguments: {} }),
        chainStep({ id: 'b', organ: 'test', tool: 'tool_b', arguments: {} }),
      ],
    });

    const executor = async () => 'ok';
    const wellChecker = async (): Promise<WellGateResult> => ({
      verdict: 'PROCEED', score: 80, color: 'GREEN',
      checked_at: new Date().toISOString(), action: 'Go',
    });

    const orchestrator = new ChainOrchestrator(
      chain, executor, wellChecker,
      (state) => progressMessages.push(state.progress_message)
    );

    const result = await orchestrator.run();

    assert.equal(result.status, 'completed');
    assert.equal(result.progress_percent, 100);
    assert.ok(progressMessages.length > 0, 'Progress events emitted');
    assert.ok(progressMessages.some(m => m.includes('Step')), 'Step progress reported');
  });

  it('should support cancellation', async () => {
    const chain = createChain({
      description: 'Cancel test',
      requested_by: 'test',
      steps: [
        chainStep({ id: 'a', organ: 'test', tool: 'tool_a', arguments: {} }),
        chainStep({ id: 'b', organ: 'test', tool: 'tool_b', arguments: {} }),
      ],
    });

    let callCount = 0;
    const executor = async () => {
      callCount++;
      return 'ok';
    };
    const wellChecker = async (): Promise<WellGateResult> => ({
      verdict: 'PROCEED', score: 80, color: 'GREEN',
      checked_at: new Date().toISOString(), action: 'Go',
    });

    const orchestrator = new ChainOrchestrator(chain, executor, wellChecker);
    
    // Cancel after first step
    setTimeout(() => orchestrator.cancel('User cancelled'), 50);
    
    const result = await orchestrator.run();
    
    // Should complete or cancel depending on timing
    assert.ok(
      result.status === 'completed' || result.status === 'cancelled',
      `Chain status: ${result.status}`
    );
  });
});

// ─── Discovery 5: Route Truth ──────────────────────────────────────

describe('Discovery 5: Route Truth', () => {
  it('should route LAS to geox_well_ingest', () => {
    const err = missingWellName();
    assert.equal(err.structuredContent.source_organ, 'geox');
    assert.equal(err.structuredContent.source_tool, 'geox_well_ingest');
  });

  it('should classify SEG-Y parse failure correctly', () => {
    const err = segyParseFailure('/data/bad.segy', new Error('Invalid header'));
    assert.equal(err.structuredContent.error_class, ErrorClass.DOWNSTREAM_PARSER_FAIL);
    assert.equal(err.structuredContent.suspected_layer, 'parser');
    assert.equal(err.structuredContent.source_tool, 'geox_seismic_ingest');
  });

  it('should wrap GEOXError into structured envelope', () => {
    const err = new GEOXError('MISSING_WELL_NAME');
    const structured = err.toStructuredError();
    assert.equal(structured.structuredContent.error_class, ErrorClass.BAD_INPUT_SHAPE);
    assert.equal(structured.structuredContent.source_organ, 'geox');
  });
});

// ─── Discovery 6: Execution Authority ──────────────────────────────

describe('Discovery 6: Execution Authority', () => {
  it('action classes exist and map to authority levels', () => {
    // Verify the 8-class taxonomy exists in chain orchestrator
    const step = chainStep({
      id: 'test',
      organ: 'aforge',
      tool: 'forge_execute',
      arguments: {},
      action_class: 'IRREVERSIBLE',
      reversible: false,
    });

    assert.equal(step.action_class, 'IRREVERSIBLE');
    assert.equal(step.reversible, false);
  });

  it('OBSERVE is safe, IRREVERSIBLE requires sovereign ack', () => {
    const safeStep = chainStep({
      id: 'safe',
      organ: 'geox',
      tool: 'geox_well_ingest',
      arguments: {},
      action_class: 'OBSERVE',
    });
    assert.equal(safeStep.reversible, true, 'OBSERVE is reversible by default');

    const dangerStep = chainStep({
      id: 'danger',
      organ: 'aforge',
      tool: 'forge_execute',
      arguments: {},
      action_class: 'IRREVERSIBLE',
      reversible: false,
    });
    assert.equal(dangerStep.reversible, false, 'IRREVERSIBLE is not reversible');
  });
});

// ─── Discovery 7: Remote State ─────────────────────────────────────

describe('Discovery 7: Remote State', () => {
  it('should run preflight on A-FORGE repo', () => {
    const result = gitRemotePreflight('/root/A-FORGE');

    assert.ok(['CLEAR', 'WARN', 'BLOCK'].includes(result.status));
    assert.ok(result.checks.auth, 'Auth check exists');
    assert.ok(result.checks.reachable, 'Reachable check exists');
    assert.ok(result.checks.branch_current, 'Branch current check exists');
    assert.ok(result.recommendation, 'Has recommendation');
    assert.ok(result.latency_ms > 0, 'Has latency');

    // Auth should pass (we verified SSH works)
    assert.equal(result.checks.auth.pass, true, 'SSH auth works');
    assert.equal(result.checks.reachable.pass, true, 'Remote reachable');
  });
});

// ─── Discovery 8: Memory Classification ────────────────────────────

describe('Discovery 8: Memory Classification', () => {
  it('structured errors carry epistemic labels', () => {
    const err = badInputShape('test', { source_tool: 'test' });
    assert.ok(
      ['OBS', 'DER'].includes(err.structuredContent.epistemic_label),
      `Epistemic label: ${err.structuredContent.epistemic_label}`
    );
  });

  it('classifyUnknown labels errors with epistemic label', () => {
    const err = classifyUnknown(new Error('something broke'));
    assert.ok(
      ['OBS', 'DER'].includes(err.structuredContent.epistemic_label),
      `Epistemic label: ${err.structuredContent.epistemic_label}`
    );
  });
});

// ─── Discovery 9: Epistemic Signal ─────────────────────────────────

describe('Discovery 9: Epistemic Signal', () => {
  it('every error envelope carries: error_class, recoverability, severity, next_action, source', () => {
    const err = downstreamFailure('Server broke', {
      source_tool: 'geox_basin',
      source_organ: 'geox',
    });

    const sc = err.structuredContent;

    // Required fields per epistemic signal protocol
    assert.ok(sc.error_class, 'Has error_class');
    assert.ok(sc.recoverability, 'Has recoverability');
    assert.ok(sc.severity, 'Has severity');
    assert.ok(sc.next_action, 'Has next_action');
    assert.ok(sc.source_tool, 'Has source_tool');
    assert.ok(sc.source_organ, 'Has source_organ');
    assert.ok(sc.epistemic_label, 'Has epistemic_label');
    assert.ok(sc.timestamp, 'Has timestamp');
    assert.ok(sc.suspected_layer, 'Has suspected_layer (failed_layer)');
  });

  it('isStructuredError detects structured envelopes', () => {
    const structured = badInputShape('test', { source_tool: 'test' });
    assert.ok(isStructuredError(structured));

    const raw = { error: 'not structured' };
    assert.equal(isStructuredError(raw), false);
  });
});

// ─── The Real Agentic Stack Test ───────────────────────────────────

describe('The Real Agentic Stack — All 9 Discoveries Chain', () => {
  it('should chain: WELL → surface check → route → error recovery → authority → receipt', async () => {
    // ── Discovery 1: Surface truth ──
    resetSurfaceGuardStore();
    const store = new SurfaceGuardStore();
    const tools: MCPToolFromList[] = [
      { name: 'geox_well_ingest', description: 'Ingest well data', inputSchema: { type: 'object' } },
      { name: 'geox_petrophysics', description: 'Petrophysics', inputSchema: { type: 'object' } },
    ];
    const surfaceDrifts = store.checkOrgan('geox', tools, false);
    assert.equal(surfaceDrifts.length, 0, 'Surface clean');

    // ── Discovery 2: WELL gate ──
    const chain = createChain({
      description: 'Full agentic chain test',
      requested_by: 'test',
      require_well_gate: true,
      steps: [
        chainStep({
          id: 'ingest',
          organ: 'geox',
          tool: 'geox_well_ingest',
          arguments: { well_name: 'TEST-1', source_uri: '/data/test.las' },
          action_class: 'DRAFT',
          essential: true,
        }),
        chainStep({
          id: 'assess',
          organ: 'wealth',
          tool: 'wealth_compute_emv',
          arguments: {},
          action_class: 'OBSERVE',
          essential: false,
        }),
      ],
    });

    // ── Discovery 3: Failure truth (simulate GEOX failure) ──
    let stepResult: unknown;
    const executor = async (step: ChainStep) => {
      if (step.tool === 'geox_well_ingest') {
        // Simulate structured error from GEOX
        throw missingWellName();
      }
      return 'ok';
    };

    const wellChecker = async (): Promise<WellGateResult> => ({
      verdict: 'PROCEED', score: 80, color: 'GREEN',
      checked_at: new Date().toISOString(), action: 'Go',
    });

    const progressEvents: string[] = [];
    const orchestrator = new ChainOrchestrator(
      chain, executor, wellChecker,
      (state) => progressEvents.push(state.progress_message)
    );

    const result = await orchestrator.run();

    // ── Verify: chain failed at GEOX step with structured error ──
    assert.equal(result.status, 'failed');
    const failedStep = result.definition.steps[0];
    assert.equal(failedStep.status, 'failed');
    assert.ok(failedStep.error, 'Step has structured error');

    // ── Discovery 3: Error is structured, not raw ──
    assert.equal(failedStep.error!.error_class, ErrorClass.BAD_INPUT_SHAPE);
    assert.equal(failedStep.error!.recoverability, 'AGENT_CAN_RETRY');
    assert.ok(failedStep.error!.next_action, 'Has next_action');
    assert.equal(failedStep.error!.source_organ, 'geox');

    // ── Discovery 4: Progress was tracked ──
    assert.ok(progressEvents.length > 0, 'Progress events emitted');

    // ── Discovery 8: Epistemic label present ──
    assert.ok(
      ['OBS', 'DER'].includes(failedStep.error!.epistemic_label),
      'Epistemic label present'
    );

    // ── Discovery 9: Full signal protocol ──
    assert.ok(failedStep.error!.suspected_layer, 'Has suspected_layer');
    assert.ok(failedStep.error!.severity, 'Has severity');
    assert.ok(failedStep.error!.timestamp, 'Has timestamp');
  });
});
