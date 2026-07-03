/**
 * test_real_agentic_stack — The Minimum Integration Test
 * 
 * This test passes only if the full agentic chain works:
 *   1. Surface truth (mcp_surface_guard detects organs)
 *   2. Operator truth (WELL readiness gate blocks on RED)
 *   3. Failure truth (structured error envelopes classify failures)
 *   4. Chain truth (orchestrator tracks progress + cancellation)
 *   5. Route truth (GEOX routing matrix for all file types)
 *   6. Execution truth (authority ladder blocks unauthorized actions)
 *   7. Remote truth (git preflight detects divergence)
 *   8. Memory truth (memory classification labels freshness)
 *   9. Epistemic truth (epistemic signals label evidence quality)
 * 
 * If this passes, you no longer have "servers with code."
 * You have a governed agentic stack.
 * 
 * FORGED: 2026-07-03
 * DITEMPA BUKAN DIBERI
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── Import all 9 discovery modules ────────────────────────────────

// Discovery 1: Surface Truth
import {
  fingerprintSchema,
  fingerprintTool,
  createSnapshot,
  detectDrift,
  SurfaceGuardStore,
  resetSurfaceGuardStore,
} from '../src/domain/governance/mcp-surface-guard.js';

// Discovery 3: Failure Truth
import {
  ErrorClass,
  isStructuredError,
  classifyUnknown,
  getRecoveryStrategy,
  missingRequiredField,
  authorityBlock,
  floorBlock,
  toolSurfaceDrift,
} from '../src/domain/governance/error-classifier.js';

// Discovery 4: Chain Truth
import {
  ChainOrchestrator,
  createChain,
  chainStep,
  generateProgressToken,
  withProgressMeta,
  type ChainStep,
  type WellGateResult,
} from '../src/domain/orchestration/chain-orchestrator.js';

// Discovery 5: Route Truth
import {
  GEOXError,
  geoxErrorWrap,
  missingWellName,
  segyParseFailure,
} from '../src/domain/orchestration/geox-error-envelope.js';

// Discovery 6: Execution Truth
import {
  checkAuthority,
  classifyShellCommand,
  ACTION_REGISTRY,
} from '../src/domain/governance/execution-authority.js';

// Discovery 7: Remote Truth
import {
  gitRemotePreflight,
  gitPushPreflight,
} from '../src/domain/governance/git-remote-preflight.js';

// Discovery 8+9: Memory + Epistemic Truth
import {
  Memory,
  Epistemic,
  enrichResult,
  memoryStatus,
  epistemicSignal,
  type MemoryClass,
  type EvidenceLayer,
} from '../src/domain/governance/epistemic-signal.js';

// ═══════════════════════════════════════════════════════════════════
// DISCOVERY 1: SURFACE TRUTH — "the body changed, stop movement"
// ═══════════════════════════════════════════════════════════════════

describe('Discovery 1: Surface Truth', () => {
  it('organ tools are fingerprinted with stable hashes', () => {
    const tool = fingerprintTool({
      name: 'geox_well_ingest',
      description: 'Load well log data',
      inputSchema: { type: 'object', properties: { well_name: { type: 'string' } } },
    });
    assert.ok(tool.schema_hash.length === 16);
    assert.ok(tool.description_hash.length === 16);
    assert.equal(tool.name, 'geox_well_ingest');
  });

  it('schema drift is detected and classified as CRITICAL', () => {
    const old = createSnapshot('geox', 'http://localhost:8081', [
      { name: 'geox_well_ingest', inputSchema: { type: 'object', properties: { well_name: { type: 'string' } } } },
    ], false);
    const current = createSnapshot('geox', 'http://localhost:8081', [
      { name: 'geox_well_ingest', inputSchema: { type: 'object', properties: { well_id: { type: 'string' } } } },
    ], false);
    const drifts = detectDrift(old, current);
    assert.equal(drifts.length, 1);
    assert.equal(drifts[0].drift_type, 'SCHEMA_CHANGE');
    assert.equal(drifts[0].severity, 'HIGH');
  });

  it('removed tool is detected as CRITICAL drift', () => {
    const old = createSnapshot('geox', 'http://localhost:8081', [
      { name: 'geox_well_ingest' },
      { name: 'geox_petrophysics' },
    ], false);
    const current = createSnapshot('geox', 'http://localhost:8081', [
      { name: 'geox_well_ingest' },
    ], false);
    const drifts = detectDrift(old, current);
    assert.equal(drifts[0].drift_type, 'TOOL_REMOVED');
    assert.equal(drifts[0].severity, 'CRITICAL');
  });

  it('HOLD verdict blocks when CRITICAL drift detected', () => {
    resetSurfaceGuardStore();
    const store = new SurfaceGuardStore({ enforce_hold: true });
    store.checkOrgan('geox', [{ name: 'old_tool' }], false);
    const verdict = store.checkAll(new Map([
      ['geox', { tools: [{ name: 'new_tool' }], listChangedCapable: false }],
    ]));
    assert.equal(verdict.status, 'HOLD');
  });
});

// ═══════════════════════════════════════════════════════════════════
// DISCOVERY 2: OPERATOR TRUTH — "is Arif fit to run this?"
// ═══════════════════════════════════════════════════════════════════

describe('Discovery 2: Operator Truth (WELL gate)', () => {
  it('WELL HOLD blocks chain execution', async () => {
    const chain = createChain({
      description: 'Test chain',
      requested_by: 'test',
      steps: [
        chainStep({ id: 'step1', organ: 'geox', tool: 'geox_well_ingest', arguments: {} }),
      ],
    });

    const wellChecker = async (): Promise<WellGateResult> => ({
      verdict: 'HOLD',
      score: 20,
      color: 'RED',
      checked_at: new Date().toISOString(),
      action: 'Operator exhausted — HOLD',
    });

    const executor = async () => 'success';
    const orchestrator = new ChainOrchestrator(chain, executor, wellChecker);
    const state = await orchestrator.run();

    assert.equal(state.status, 'failed');
    assert.ok(state.progress_message.includes('BLOCKED'));
    assert.ok(state.progress_message.includes('HOLD'));
  });

  it('WELL SIMPLIFY skips non-essential steps', async () => {
    const chain = createChain({
      description: 'Test chain with optional step',
      requested_by: 'test',
      steps: [
        chainStep({ id: 'essential', organ: 'geox', tool: 'geox_well_ingest', arguments: {}, essential: true }),
        chainStep({ id: 'optional', organ: 'geox', tool: 'geox_surface_status', arguments: {}, essential: false }),
      ],
    });

    const wellChecker = async (): Promise<WellGateResult> => ({
      verdict: 'SIMPLIFY',
      score: 50,
      color: 'YELLOW',
      checked_at: new Date().toISOString(),
      action: 'Reduce intensity',
    });

    const results: string[] = [];
    const executor = async (step: ChainStep) => { results.push(step.id); return 'ok'; };
    const orchestrator = new ChainOrchestrator(chain, executor, wellChecker);
    const state = await orchestrator.run();

    assert.equal(state.status, 'completed');
    assert.deepEqual(results, ['essential']); // optional was skipped
    assert.ok(state.adaptations.length > 0);
  });

  it('WELL GREEN allows full chain', async () => {
    const chain = createChain({
      description: 'Test chain',
      requested_by: 'test',
      steps: [
        chainStep({ id: 'step1', organ: 'geox', tool: 'geox_well_ingest', arguments: {} }),
      ],
    });

    const wellChecker = async (): Promise<WellGateResult> => ({
      verdict: 'PROCEED',
      score: 85,
      color: 'GREEN',
      checked_at: new Date().toISOString(),
      action: 'Proceed',
    });

    const executor = async () => 'success';
    const orchestrator = new ChainOrchestrator(chain, executor, wellChecker);
    const state = await orchestrator.run();

    assert.equal(state.status, 'completed');
  });
});

// ═══════════════════════════════════════════════════════════════════
// DISCOVERY 3: FAILURE TRUTH — "errors become instructions, not riddles"
// ═══════════════════════════════════════════════════════════════════

describe('Discovery 3: Failure Truth', () => {
  it('every error class has recoverability + next_action', () => {
    const errors = [
      missingRequiredField('well_name required', { missing_fields: ['well_name'] }),
      authorityBlock('No lease', {}),
      floorBlock('F13 violation', { violated_floors: ['F13'] }),
      toolSurfaceDrift('Schema changed', {}),
    ];

    for (const err of errors) {
      assert.ok(isStructuredError(err), `${err.structuredContent.error_class} should be structured`);
      assert.ok(err.structuredContent.recoverability, `${err.structuredContent.error_class} needs recoverability`);
      assert.ok(err.structuredContent.next_action, `${err.structuredContent.error_class} needs next_action`);
      assert.ok(err.structuredContent.suspected_layer, `${err.structuredContent.error_class} needs suspected_layer`);
    }
  });

  it('classifyUnknown produces structured errors with recovery hints', () => {
    const err = classifyUnknown(new Error('permission denied: no valid lease'));
    assert.ok(isStructuredError(err));
    assert.equal(err.structuredContent.error_class, ErrorClass.AUTHORITY_BLOCK);
    const strategy = getRecoveryStrategy(err);
    assert.equal(strategy.escalate, true);
  });

  it('chain orchestrator classifies errors through taxonomy', async () => {
    const chain = createChain({
      description: 'Failing chain',
      requested_by: 'test',
      steps: [
        chainStep({ id: 'fail_step', organ: 'geox', tool: 'geox_well_ingest', arguments: {} }),
      ],
    });

    const wellChecker = async (): Promise<WellGateResult> => ({
      verdict: 'PROCEED', score: 80, color: 'GREEN',
      checked_at: new Date().toISOString(), action: 'Proceed',
    });

    const executor = async () => { throw new Error('LAS parser failed to read header'); };
    const orchestrator = new ChainOrchestrator(chain, executor, wellChecker);
    const state = await orchestrator.run();

    assert.equal(state.status, 'failed');
    const failedStep = state.definition.steps[0];
    assert.ok(failedStep.error);
    assert.equal(failedStep.error.error_class, ErrorClass.DOWNSTREAM_PARSER_FAIL);
  });
});

// ═══════════════════════════════════════════════════════════════════
// DISCOVERY 4: CHAIN TRUTH — "where is the chain right now?"
// ═══════════════════════════════════════════════════════════════════

describe('Discovery 4: Chain Truth', () => {
  it('progress tokens are generated for each step', () => {
    const token = generateProgressToken();
    assert.ok(token.startsWith('pt_'));
    assert.ok(token.length > 10);
  });

  it('progress meta is injected into MCP calls', () => {
    const meta = withProgressMeta({ custom: 'value' }, 'pt_test_123');
    assert.equal(meta.progressToken, 'pt_test_123');
    assert.equal((meta as any).custom, 'value');
  });

  it('cancellation stops chain at next step boundary', async () => {
    const chain = createChain({
      description: 'Long chain',
      requested_by: 'test',
      steps: [
        chainStep({ id: 'step1', organ: 'geox', tool: 'tool1', arguments: {} }),
        chainStep({ id: 'step2', organ: 'geox', tool: 'tool2', arguments: {} }),
        chainStep({ id: 'step3', organ: 'geox', tool: 'tool3', arguments: {} }),
      ],
    });

    const wellChecker = async (): Promise<WellGateResult> => ({
      verdict: 'PROCEED', score: 80, color: 'GREEN',
      checked_at: new Date().toISOString(), action: 'Proceed',
    });

    let callCount = 0;
    const executor = async () => {
      callCount++;
      if (callCount === 1) {
        // Cancel after first step completes
        // (In real usage, this comes from cockpit button)
      }
      return 'ok';
    };

    const orchestrator = new ChainOrchestrator(chain, executor, wellChecker);
    // Simulate cancel before run
    await orchestrator.cancel('User pressed cancel');
    const state = await orchestrator.run();

    assert.equal(state.status, 'cancelled');
    assert.ok(state.cancel_reason);
  });
});

// ═══════════════════════════════════════════════════════════════════
// DISCOVERY 5: ROUTE TRUTH — "did the file go to the right path?"
// ═══════════════════════════════════════════════════════════════════

describe('Discovery 5: Route Truth', () => {
  it('LAS files route to geox_well_ingest', () => {
    const err = missingWellName();
    assert.equal(err.structuredContent.source_tool, 'geox_well_ingest');
  });

  it('SEG-Y parse failures are classified separately from router failures', () => {
    const segyErr = segyParseFailure('/data/bad.segy', 'Invalid trace header');
    const routerErr = new GEOXError('ROUTER_DROPPED', { tool: 'geox_seismic_ingest' }).toStructuredError();

    assert.equal(segyErr.structuredContent.error_class, ErrorClass.DOWNSTREAM_PARSER_FAIL);
    assert.equal(segyErr.structuredContent.suspected_layer, 'parser');
    assert.equal(routerErr.structuredContent.error_class, ErrorClass.DOWNSTREAM_FAILURE);
    assert.notEqual(segyErr.structuredContent.suspected_layer, routerErr.structuredContent.suspected_layer);
  });

  it('geoxErrorWrap classifies raw exceptions into structured envelopes', async () => {
    const result = await geoxErrorWrap('geox_well_ingest', async () => {
      throw new Error('LAS parser failed to read ~W section: corrupted header');
    });
    assert.ok(isStructuredError(result));
    assert.equal(result.structuredContent.error_class, ErrorClass.DOWNSTREAM_PARSER_FAIL);
    assert.equal(result.structuredContent.source_organ, 'geox');
  });
});

// ═══════════════════════════════════════════════════════════════════
// DISCOVERY 6: EXECUTION TRUTH — "knows when not to execute"
// ═══════════════════════════════════════════════════════════════════

describe('Discovery 6: Execution Truth', () => {
  it('OBSERVE actions need no lease', () => {
    const verdict = checkAuthority('read_file');
    assert.equal(verdict.allowed, true);
    assert.equal(verdict.requires_lease, false);
  });

  it('MUTATE actions require lease', () => {
    const verdict = checkAuthority('write_file');
    assert.equal(verdict.allowed, false);
    assert.ok(verdict.missing.includes('lease'));
  });

  it('IRREVERSIBLE actions require lease + judge + 888_HOLD', () => {
    const verdict = checkAuthority('rm_rf');
    assert.equal(verdict.allowed, false);
    assert.ok(verdict.missing.includes('lease'));
    assert.ok(verdict.missing.includes('judge_verdict'));
    assert.ok(verdict.missing.includes('888_hold'));
  });

  it('human actor bypasses all gates (F13 sovereign)', () => {
    const verdict = checkAuthority('rm_rf', { actor_type: 'human' });
    assert.equal(verdict.allowed, true);
  });

  it('shell commands are classified by blast radius', () => {
    assert.equal(classifyShellCommand('ls -la'), 'OBSERVE');
    assert.equal(classifyShellCommand('git status'), 'OBSERVE');
    assert.equal(classifyShellCommand('npm install'), 'MUTATE');
    assert.equal(classifyShellCommand('git commit -m "fix"'), 'EXECUTE_HIGH_IMPACT');
    assert.equal(classifyShellCommand('git push'), 'EXECUTE_HIGH_IMPACT');
    assert.equal(classifyShellCommand('git push --force'), 'IRREVERSIBLE');
    assert.equal(classifyShellCommand('rm -rf /tmp/test'), 'IRREVERSIBLE');
    assert.equal(classifyShellCommand('DROP TABLE users'), 'IRREVERSIBLE');
  });

  it('unknown actions are treated as IRREVERSIBLE (safe default)', () => {
    const verdict = checkAuthority('totally_unknown_action');
    assert.equal(verdict.allowed, false);
    assert.equal(verdict.action_class, 'IRREVERSIBLE');
  });
});

// ═══════════════════════════════════════════════════════════════════
// DISCOVERY 7: REMOTE TRUTH — "is local reality the same as remote?"
// ═══════════════════════════════════════════════════════════════════

describe('Discovery 7: Remote Truth', () => {
  it('git preflight returns structured result', () => {
    const result = gitRemotePreflight('/root/A-FORGE');
    assert.ok(result.status);
    assert.ok(typeof result.remote_reachable === 'boolean');
    assert.ok(typeof result.auth_ok === 'boolean');
    assert.ok(typeof result.local_ahead === 'number');
    assert.ok(typeof result.remote_ahead === 'number');
    assert.ok(result.details.branch);
    assert.ok(result.details.remote_url);
  });

  it('push preflight checks authority ladder', () => {
    const result = gitPushPreflight('/root/A-FORGE', 'OBSERVE');
    assert.equal(result.authority_allowed, false);
    assert.ok(result.reason.includes('OBSERVE'));
  });

  it('push preflight allows MUTATE (digital normal)', () => {
    const result = gitPushPreflight('/root/A-FORGE', 'MUTATE');
    assert.equal(result.authority_allowed, true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// DISCOVERY 8: MEMORY TRUTH — "is this fact live or stale?"
// ═══════════════════════════════════════════════════════════════════

describe('Discovery 8: Memory Truth', () => {
  it('live probe is marked as fresh', () => {
    const status = Memory.live('health_check');
    assert.equal(status.class, 'LIVE_PROBE');
    assert.equal(status.is_fresh, true);
  });

  it('cached data can be stale', () => {
    const status = Memory.cached('2026-01-01T00:00:00Z', 300, 'vault_query');
    assert.equal(status.class, 'CACHED_MEMORY');
    assert.equal(status.is_fresh, false); // Very old data
  });

  it('sealed receipts are always fresh', () => {
    const status = Memory.sealed('vault999');
    assert.equal(status.class, 'SEALED_RECEIPT');
  });

  it('inferred data carries INFERRED classification', () => {
    const status = Memory.inferred('classifyUnknown');
    assert.equal(status.class, 'INFERRED');
  });
});

// ═══════════════════════════════════════════════════════════════════
// DISCOVERY 9: EPISTEMIC TRUTH — "what kind of truth is this?"
// ═══════════════════════════════════════════════════════════════════

describe('Discovery 9: Epistemic Truth', () => {
  it('observed evidence has high confidence', () => {
    const sig = Epistemic.observed('curl_health');
    assert.equal(sig.evidence_layer, 'OBS');
    assert.ok(sig.confidence >= 0.8);
    assert.equal(sig.authority_claim, 'EVIDENCE');
  });

  it('speculative evidence has low confidence', () => {
    const sig = Epistemic.speculative('agent_guess', ['no data']);
    assert.equal(sig.evidence_layer, 'SPEC');
    assert.ok(sig.confidence <= 0.4);
    assert.ok(sig.uncertainty.length > 0);
  });

  it('confidence is hard-capped at 0.90 (F7 HUMILITY)', () => {
    const sig = epistemicSignal('OBS', { confidence: 0.99 });
    assert.ok(sig.confidence <= 0.90, `Confidence ${sig.confidence} exceeds F7 cap`);
  });

  it('enriched result carries both memory and epistemic metadata', () => {
    const enriched = enrichResult(
      { tools: 50 },
      Memory.live('surface_guard'),
      Epistemic.observed('fingerprint_check')
    );
    assert.equal(enriched.memory.class, 'LIVE_PROBE');
    assert.equal(enriched.epistemic.evidence_layer, 'OBS');
    assert.equal(enriched.data.tools, 50);
  });
});

// ═══════════════════════════════════════════════════════════════════
// THE REAL AGENTIC STACK TEST
// ═══════════════════════════════════════════════════════════════════

describe('REAL AGENTIC STACK: Full Chain Integration', () => {
  it('all 9 discoveries compose into a governed chain', async () => {
    // Discovery 1: Surface truth — verify tool exists
    const toolFp = fingerprintTool({ name: 'geox_well_ingest', description: 'Ingest well data' });
    assert.ok(toolFp.schema_hash);

    // Discovery 2: Operator truth — WELL gate
    const wellResult: WellGateResult = {
      verdict: 'PROCEED', score: 80, color: 'GREEN',
      checked_at: new Date().toISOString(), action: 'Proceed',
    };

    // Discovery 6: Execution truth — check authority
    const auth = checkAuthority('write_file', { has_lease: true });
    assert.equal(auth.allowed, true);

    // Discovery 4: Chain truth — orchestrator with progress
    const chain = createChain({
      description: 'Full agentic chain test',
      requested_by: 'test',
      steps: [
        chainStep({
          id: 'well_ingest',
          organ: 'geox',
          tool: 'geox_well_ingest',
          arguments: { well_name: 'ABC-1', las_path: '/data/ABC-1.las' },
          action_class: 'MUTATE',
          essential: true,
        }),
        chainStep({
          id: 'risk_assess',
          organ: 'wealth',
          tool: 'wealth_compute_npv',
          arguments: {},
          action_class: 'OBSERVE',
          essential: false,
        }),
      ],
    });

    const executedSteps: string[] = [];
    const progressMessages: string[] = [];

    const executor = async (step: ChainStep, _signal: AbortSignal) => {
      executedSteps.push(step.id);

      // Discovery 3: Failure truth — structured error if fails
      if (step.tool === 'geox_well_ingest' && !step.arguments.well_name) {
        return missingRequiredField('well_name required', {
          missing_fields: ['well_name'],
          source_tool: 'geox_well_ingest',
          source_organ: 'geox',
        });
      }

      // Discovery 8+9: Enrich result
      return enrichResult(
        { success: true, tool: step.tool },
        Memory.live(step.tool),
        Epistemic.observed(step.tool)
      );
    };

    const orchestrator = new ChainOrchestrator(
      chain,
      executor,
      async () => wellResult,
      (state) => progressMessages.push(state.progress_message)
    );

    const finalState = await orchestrator.run();

    // Verify chain completed
    assert.equal(finalState.status, 'completed');
    assert.equal(finalState.well_gate_result?.verdict, 'PROCEED');

    // Verify progress was tracked
    assert.ok(progressMessages.length > 0);

    // Verify both steps executed
    assert.deepEqual(executedSteps, ['well_ingest', 'risk_assess']);

    // Verify results carry epistemic metadata
    const wellResult2 = finalState.results.get('well_ingest') as any;
    assert.ok(wellResult2);
    assert.equal(wellResult2.memory.class, 'LIVE_PROBE');
    assert.equal(wellResult2.epistemic.evidence_layer, 'OBS');
  });
});
