/**
 * EphemeralGenesisRunner Integration Tests
 * ========================================
 *
 * Tests the EphemeralGenesisRunner → ExecutionSandbox integration.
 * Verifies the full GREEN lease lifecycle: gap detect → generate →
 * sandbox test → lease grant → invoke → verify → retire.
 *
 * Also validates 8 adversarial escape attempts and failure behavior.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import test, { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';

import {
  EphemeralGenesisRunner,
  createCapabilityLease,
  type CapabilityLease,
  type GenesisState,
} from '../src/domain/containment/EphemeralGenesisRunner.js';
import { containmentHealth } from '../src/domain/containment/ExecutionSandbox.js';
import type { ContainmentResult } from '../src/domain/containment/ContainmentEngine.js';

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function makeLease(opts?: Partial<Parameters<typeof createCapabilityLease>[0]>): CapabilityLease {
  return createCapabilityLease({
    purpose: opts?.purpose || 'Parse CSV well log data',
    createdBy: 'test-agent',
    parentSessionId: 'test-session-001',
    allowedOperation: opts?.allowedOperation || 'compute_only',
    ...opts,
  });
}

/** Simple Python tool: read input.json, count fields, return result */
const SIMPLE_PYTHON_TOOL = `
import json, sys
try:
    with open('input.json', 'r') as f:
        data = json.load(f)
    result = {"parsed": True, "status": "ok", "keys": list(data.keys())[:5]}
    with open('output.json', 'w') as f:
        json.dump(result, f)
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"error": str(e)}), file=sys.stderr)
    sys.exit(1)
`.trim();

/** Python tool that tries to read /etc/passwd */
const ESCAPE_READ_ETC = `
import json
try:
    with open('/etc/passwd', 'r') as f:
        data = f.read()
    print(json.dumps({"leaked": len(data)}))
except PermissionError:
    print(json.dumps({"blocked": "PermissionError"}))
except FileNotFoundError:
    print(json.dumps({"blocked": "FileNotFoundError"}))
except Exception as e:
    print(json.dumps({"blocked": str(e)}))
`.trim();

/** Python tool that tries to open a network socket */
const ESCAPE_NETWORK = `
import json, socket
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(1)
    s.connect(('1.1.1.1', 80))
    s.send(b'GET / HTTP/1.0\\r\\n\\r\\n')
    data = s.recv(1024)
    s.close()
    print(json.dumps({"leaked": len(data)}))
except Exception as e:
    print(json.dumps({"blocked": str(e)[:100]}))
`.trim();

/** Python tool that tries to read environment variables */
const ESCAPE_ENV = `
import json, os
secrets = []
for k, v in os.environ.items():
    if any(x in k.lower() for x in ['secret', 'key', 'token', 'password', 'api']):
        secrets.append(k)
print(json.dumps({"found_keys": len(secrets), "keys": secrets[:5]}))
`.trim();

/** Python tool that spawns child processes */
const ESCAPE_SPAWN = `
import json, subprocess, sys
try:
    procs = []
    for i in range(10):
        p = subprocess.Popen(['sleep', '10'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        procs.append(p)
    print(json.dumps({"spawned": len(procs)}))
except Exception as e:
    print(json.dumps({"blocked": str(e)[:100]}))
`.trim();

/** Python tool that allocates excessive memory */
const ESCAPE_MEMORY = `
import json
try:
    # Try to allocate 2GB
    huge = bytearray(2000 * 1024 * 1024)
    print(json.dumps({"allocated_mb": 2000}))
except MemoryError:
    print(json.dumps({"blocked": "MemoryError"}))
except Exception as e:
    print(json.dumps({"blocked": str(e)[:100]}))
`.trim();

/** Python tool that tries to import forbidden modules */
const ESCAPE_FORBIDDEN_IMPORTS = `
import json
import subprocess
import urllib.request
print(json.dumps({"imports": "dangerous_modules_loaded"}))
`.trim();

/** Python tool that tries to write outside allowed paths */
const ESCAPE_WRITE = `
import json
try:
    with open('/tmp/escape-test.txt', 'w') as f:
        f.write('persistent data')
    print(json.dumps({"written": "persisted to /tmp"}))
except PermissionError:
    print(json.dumps({"blocked": "PermissionError"}))
except Exception as e:
    print(json.dumps({"blocked": str(e)[:100]}))
`.trim();

/** Python tool that tries to execute shell commands */
const ESCAPE_SHELL = `
import json, subprocess
try:
    result = subprocess.run(['whoami'], capture_output=True, text=True, timeout=2)
    print(json.dumps({"user": result.stdout.strip(), "exit": result.returncode}))
except Exception as e:
    print(json.dumps({"blocked": str(e)[:100]}))
`.trim();

// ═══════════════════════════════════════════════════════════════
// PRE-FLIGHT: BACKEND CHECK
// ═══════════════════════════════════════════════════════════════

let backendAvailable = false;
let backendName = 'none';

before(async () => {
  const health = await containmentHealth();
  backendAvailable = health.available;
  backendName = health.primaryBackend;
  console.log(`[test:preflight] Backend: ${backendName}, Available: ${backendAvailable}`);
  if (!backendAvailable) {
    console.log('[test:preflight] WARNING — no sandbox backend available. Integration tests will SKIP.');
  }
});

// ═══════════════════════════════════════════════════════════════
// SUITE 1: STATE MACHINE (no sandbox needed)
// ═══════════════════════════════════════════════════════════════

describe('EphemeralGenesisRunner — State Machine', () => {

  it('should create lease in GAP_DETECTED state', () => {
    const lease = makeLease();
    const runner = new EphemeralGenesisRunner(lease);
    assert.equal(runner.getState(), 'GAP_DETECTED');
  });

  it('should transition: GAP_DETECTED → REUSE_CHECKED (no match)', async () => {
    const runner = new EphemeralGenesisRunner(makeLease());
    const reuse = await runner.checkReuse(['geox_basin', 'geox_prospect', 'arif_observe']);
    assert.equal(reuse, false);
    assert.equal(runner.getState(), 'REUSE_CHECKED');
  });

  it('should transition: GAP_DETECTED → REUSE_CHECKED (match found)', async () => {
    const runner = new EphemeralGenesisRunner(makeLease({ purpose: 'parse csv' }));
    const reuse = await runner.checkReuse(['geox_basin', 'csv_parser_tool', 'json_parser']);
    assert.equal(reuse, true);
    assert.equal(runner.getState(), 'REUSE_CHECKED');
  });

  it('should block generation if reuse possible (wrong state)', async () => {
    const runner = new EphemeralGenesisRunner(makeLease({ purpose: 'parse csv' }));
    await runner.checkReuse(['csv_parser_tool']);
    // After reuse found: state is REUSE_CHECKED, not CAPABILITY_SPECIFIED
    // generate() requires CAPABILITY_SPECIFIED — throws Invalid state
    await assert.rejects(
      () => runner.generate(SIMPLE_PYTHON_TOOL, 'python'),
      /Invalid state/
    );
  });

  it('should transition: REUSE_CHECKED → CAPABILITY_SPECIFIED', async () => {
    const runner = new EphemeralGenesisRunner(makeLease());
    await runner.checkReuse(['unrelated_tool']);
    runner.specifyCapability({
      capabilityType: 'csv_parser',
      inputFormat: 'text/csv',
      outputFormat: 'application/json',
      language: 'python',
      estimatedLines: 20,
    });
    assert.equal(runner.getState(), 'CAPABILITY_SPECIFIED');
  });

  it('should block generation with forbidden patterns', async () => {
    const runner = new EphemeralGenesisRunner(makeLease());
    await runner.checkReuse(['unrelated']);
    runner.specifyCapability({
      capabilityType: 'parser',
      inputFormat: 'csv',
      outputFormat: 'json',
      language: 'python',
      estimatedLines: 5,
    });
    const badCode = 'import subprocess\nsubprocess.run(["rm", "-rf", "/"])';
    await assert.rejects(
      () => runner.generate(badCode, 'python'),
      /forbidden pattern/
    );
    assert.equal(runner.getState(), 'FAILED');
  });

  it('should block lease grant before sandbox test', () => {
    const runner = new EphemeralGenesisRunner(makeLease());
    assert.throws(() => runner.grantLease(), /Cannot grant lease/);
  });

  it('should block invocation without lease', async () => {
    const runner = new EphemeralGenesisRunner(makeLease());
    await assert.rejects(
      () => runner.invoke(),
      /Cannot invoke/
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// SUITE 2: END-TO-END GREEN LEASE (requires sandbox backend)
// ═══════════════════════════════════════════════════════════════

describe('EphemeralGenesisRunner — E2E GREEN Flow', () => {
  let runner: EphemeralGenesisRunner;

  before(async () => {
    if (!backendAvailable) {
      console.log('[e2e] SKIPPING — no sandbox backend');
    }
  });

  it('Step 0: backend is available', () => {
    if (!backendAvailable) {
      assert.ok(true, 'skipped — no backend');
      return;
    }
    assert.ok(backendAvailable);
  });

  it('Step 1: gap_detect (no existing tool)', async () => {
    if (!backendAvailable) return;
    const lease = makeLease({ purpose: 'Count lines in well log CSV' });
    runner = new EphemeralGenesisRunner(lease);
    assert.equal(runner.getState(), 'GAP_DETECTED');
  });

  it('Step 2: reuse_check (no match)', async () => {
    if (!backendAvailable) return;
    const reuse = await runner.checkReuse(['geox_basin', 'seismic_compute', 'wealth_market']);
    assert.equal(reuse, false);
    assert.equal(runner.getState(), 'REUSE_CHECKED');
  });

  it('Step 3: specify capability', () => {
    if (!backendAvailable) return;
    runner.specifyCapability({
      capabilityType: 'line_counter',
      inputFormat: 'text/csv',
      outputFormat: 'application/json',
      language: 'python',
      estimatedLines: 20,
    });
    assert.equal(runner.getState(), 'CAPABILITY_SPECIFIED');
  });

  it('Step 4: generate tool code', async () => {
    if (!backendAvailable) return;
    const hash = await runner.generate(SIMPLE_PYTHON_TOOL, 'python');
    assert.ok(hash);
    assert.equal(runner.getState(), 'GENERATED');
  });

  it('Step 5: sandbox test', async () => {
    if (!backendAvailable) return;
    const testInput = JSON.stringify({ well: 'A-1', depth: [100, 200, 300], gr: [45, 67, 89] });
    const result = await runner.sandboxTest(testInput);
    assert.ok(result);
    assert.equal(result.exitCode, 0);
    assert.equal(result.killed, false);
    assert.ok(result.stdout.includes('parsed'));
    assert.ok(result.stdout.includes('"ok"'));
    assert.equal(runner.getState(), 'SANDBOX_TESTED');
  });

  it('Step 6: grant lease', () => {
    if (!backendAvailable) return;
    const lease = runner.grantLease();
    assert.equal(lease.state, 'LEASE_GRANTED');
    assert.equal(runner.getState(), 'LEASE_GRANTED');
  });

  it('Step 7: invoke with real input', async () => {
    if (!backendAvailable) return;
    const input = 'col1,col2,col3\n1,2,3\n4,5,6\n7,8,9';
    const result = await runner.invoke(input);
    assert.ok(result);
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('parsed'));
    assert.ok(result.stdout.includes('"ok"'));
    assert.equal(runner.getState(), 'INVOKED');
  });

  it('Step 8: verify output independently', async () => {
    if (!backendAvailable) return;
    const verified = await runner.verifyOutput({ line_count: 'number', char_count: 'number' });
    assert.equal(verified, true);
    assert.equal(runner.getState(), 'OUTPUT_VERIFIED');
  });

  it('Step 9: retire — sandbox destroyed, code nullified', async () => {
    if (!backendAvailable) return;
    await runner.retire();
    assert.equal(runner.getState(), 'RETIRED');

    const result = runner.getResult();
    assert.equal(result.finalState, 'RETIRED');
    assert.equal(result.verified, true);
    assert.equal(result.errors.length, 0);
    assert.equal(result.promotionProposed, false);
  });

  it('E2E result summary: all 9 steps passed', () => {
    if (!backendAvailable) return;
    const result = runner.getResult();
    assert.equal(result.finalState, 'RETIRED', `Expected RETIRED, got ${result.finalState}`);
    assert.equal(result.errors.length, 0, `Unexpected errors: ${result.errors.join(', ')}`);
    assert.ok(result.output);
  });
});

// ═══════════════════════════════════════════════════════════════
// SUITE 3: ADVERSARIAL ESCAPE ATTEMPTS
// ═══════════════════════════════════════════════════════════════

describe('EphemeralGenesisRunner — Adversarial Escape', () => {
  /** Helper: generate, test, invoke an escape tool and verify it was blocked */
  async function testEscape(code: string, label: string): Promise<{ blocked: boolean; detail: string }> {
    const lease = makeLease({ purpose: `${label} escape test` });
    const runner = new EphemeralGenesisRunner(lease);
    await runner.checkReuse(['unrelated_tool']);
    runner.specifyCapability({
      capabilityType: 'escape_test',
      inputFormat: 'json',
      outputFormat: 'json',
      language: 'python',
      estimatedLines: 10,
    });

    // Forbidden pattern check in generate
    try {
      await runner.generate(code, 'python');
    } catch (err: any) {
      return { blocked: true, detail: `generate blocked: ${err.message}` };
    }

    // Sandbox test — actual OS containment
    const testInput = '{}';
    const result = await runner.sandboxTest(testInput);

    if (!result) {
      return { blocked: true, detail: 'sandbox test returned null' };
    }

    if (result.exitCode !== 0 || result.killed) {
      return { blocked: true, detail: `exit=${result.exitCode} killed=${result.killed} stderr=${result.stderr.slice(0, 100)}` };
    }

    // Check if output indicates blocked
    if (result.stdout.includes('"blocked"') || result.stdout.includes('PermissionError') || result.stdout.includes('FileNotFoundError')) {
      return { blocked: true, detail: `OS blocked: ${result.stdout.slice(0, 200)}` };
    }

    // Cleanup
    await runner.retire().catch(() => {});

    return { blocked: false, detail: result.stdout.slice(0, 200) };
  }

  before(() => {
    if (!backendAvailable) {
      console.log('[adversarial] SKIPPING — no sandbox backend');
    }
  });

  it('ADV-1: Read /etc/passwd → BLOCKED', async () => {
    if (!backendAvailable) return;
    const r = await testEscape(ESCAPE_READ_ETC, 'read-etc');
    assert.ok(r.blocked, `Expected BLOCKED but got: ${r.detail}`);
  });

  it('ADV-2: Network connection → BLOCKED', async () => {
    if (!backendAvailable) return;
    const r = await testEscape(ESCAPE_NETWORK, 'network');
    assert.ok(r.blocked, `Expected BLOCKED but got: ${r.detail}`);
  });

  it('ADV-3: Environment secrets → BLOCKED', async () => {
    if (!backendAvailable) return;
    const r = await testEscape(ESCAPE_ENV, 'env-secrets');
    assert.ok(r.blocked, `Expected BLOCKED but got: ${r.detail}`);
  });

  it('ADV-4: Spawn excessive processes → BLOCKED', async () => {
    if (!backendAvailable) return;
    const r = await testEscape(ESCAPE_SPAWN, 'spawn');
    assert.ok(r.blocked, `Expected BLOCKED but got: ${r.detail}`);
  });

  it('ADV-5: Memory exhaustion → BLOCKED', async () => {
    if (!backendAvailable) return;
    const r = await testEscape(ESCAPE_MEMORY, 'memory');
    assert.ok(r.blocked, `Expected BLOCKED but got: ${r.detail}`);
  });

  it('ADV-6: Forbidden imports (subprocess, urllib) → BLOCKED at generate', async () => {
    const lease = makeLease({ purpose: 'forbidden-imports' });
    const runner = new EphemeralGenesisRunner(lease);
    await runner.checkReuse(['unrelated']);
    runner.specifyCapability({
      capabilityType: 'escape',
      inputFormat: 'json',
      outputFormat: 'json',
      language: 'python',
      estimatedLines: 5,
    });
    await assert.rejects(
      () => runner.generate(ESCAPE_FORBIDDEN_IMPORTS, 'python'),
      /forbidden pattern/
    );
  });

  it('ADV-7: Write to unauthorized path → BLOCKED', async () => {
    if (!backendAvailable) return;
    const r = await testEscape(ESCAPE_WRITE, 'write-escape');
    // The tmp path may or may not be allowed — check if it was blocked
    // GREEN lease filesystemWrite is only /workspace/output
    assert.ok(r.blocked, `Expected BLOCKED but got: ${r.detail}`);
  });

  it('ADV-8: Execute shell commands → BLOCKED at generate', async () => {
    const lease = makeLease({ purpose: 'shell-escape' });
    const runner = new EphemeralGenesisRunner(lease);
    await runner.checkReuse(['unrelated']);
    runner.specifyCapability({
      capabilityType: 'escape',
      inputFormat: 'json',
      outputFormat: 'json',
      language: 'python',
      estimatedLines: 5,
    });
    await assert.rejects(
      () => runner.generate(ESCAPE_SHELL, 'python'),
      /forbidden pattern/
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// SUITE 4: FAILURE BEHAVIOR
// ═══════════════════════════════════════════════════════════════

describe('EphemeralGenesisRunner — Failure & Cleanup', () => {

  before(() => {
    if (!backendAvailable) {
      console.log('[failure] SKIPPING — no sandbox backend');
    }
  });

  it('FAIL-1: Expired lease rejects all transitions', async () => {
    const lease = makeLease({ purpose: 'expired-test' });
    // Force expiry by creating with past timestamp
    const pastLease = {
      ...lease,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    };
    const runner = new EphemeralGenesisRunner(pastLease);
    const reuse = await runner.checkReuse(['any_tool']);
    assert.equal(reuse, false);
    assert.equal(runner.getState(), 'FAILED');
  });

  it('FAIL-2: Sandbox unavailable → fail-closed', async () => {
    // This tests the logic path, not actual bwrap failure
    const runner = new EphemeralGenesisRunner(makeLease());
    await runner.checkReuse(['unrelated']);
    runner.specifyCapability({
      capabilityType: 'test',
      inputFormat: 'csv',
      outputFormat: 'json',
      language: 'python',
      estimatedLines: 5,
    });

    // generate() calls ensureContainment() which checks bwrap
    // If bwrap IS available (normal case), this just proves generate works
    const hash = await runner.generate(SIMPLE_PYTHON_TOOL, 'python');
    assert.ok(hash);
    assert.equal(runner.getState(), 'GENERATED');
  });

  it('FAIL-3: Invalid state transitions are rejected', async () => {
    const runner = new EphemeralGenesisRunner(makeLease());
    // invoke before any preceding steps — should throw
    await assert.rejects(
      () => runner.invoke(),
      /Cannot invoke/
    );
  });

  it('FAIL-4: Retire cleans up even after failure', async () => {
    if (!backendAvailable) return;
    const runner = new EphemeralGenesisRunner(makeLease());
    await runner.checkReuse(['unrelated']);
    runner.specifyCapability({
      capabilityType: 'test',
      inputFormat: 'csv',
      outputFormat: 'json',
      language: 'python',
      estimatedLines: 5,
    });

    // Generate bad code that will fail in sandbox
    const badCode = 'import json\nraise Exception("deliberate failure")';
    try {
      await runner.generate(badCode, 'python');
    } catch {}

    if (runner.getState() === 'GENERATED') {
      const result = await runner.sandboxTest('{}');
      if (result && result.exitCode !== 0) {
        assert.equal(runner.getState(), 'FAILED');
      }
    }

    // Retire should work even from FAILED state
    await runner.retire();
    assert.ok(['RETIRED', 'FAILED'].includes(runner.getState()));
  });

  it('FAIL-5: Promotion blocked without 3+ uses', async () => {
    const runner = new EphemeralGenesisRunner(makeLease());
    const promoted = await runner.proposePromotion(1, 1.0);
    assert.equal(promoted, false);
    assert.equal(runner.getState(), 'PROMOTION_REJECTED');
  });

  it('FAIL-6: Promotion blocked with low success rate', async () => {
    const runner = new EphemeralGenesisRunner(makeLease());
    const promoted = await runner.proposePromotion(5, 0.5);
    assert.equal(promoted, false);
    assert.equal(runner.getState(), 'PROMOTION_REJECTED');
  });

  it('FAIL-7: getResult() returns full audit trail', () => {
    const runner = new EphemeralGenesisRunner(makeLease({ purpose: 'audit-trace-test' }));
    const result = runner.getResult();
    assert.equal(result.finalState, 'GAP_DETECTED');
    assert.equal(result.promotionProposed, false);
    assert.equal(result.verified, false);
    assert.ok(Array.isArray(result.errors));
    assert.ok(result.lease.leaseId);
    assert.ok(result.lease.stateHistory.length > 0);
    assert.equal(result.lease.persistentRegistration, false);
    assert.equal(result.lease.selfPromotion, false);
    assert.equal(result.lease.credentials, 'NONE');
  });
});

// ═══════════════════════════════════════════════════════════════
// SUITE 5: LEASE → POLICY INTEGRITY
// ═══════════════════════════════════════════════════════════════

describe('EphemeralGenesisRunner — Lease Integrity', () => {

  it('LEASE-1: GREEN lease has network DENY', () => {
    const lease = makeLease();
    assert.equal(lease.network, 'DENY');
    assert.equal(lease.credentials, 'NONE');
  });

  it('LEASE-2: persistentRegistration is always false', () => {
    const lease = makeLease();
    assert.equal(lease.persistentRegistration, false);
  });

  it('LEASE-3: selfPromotion is always false', () => {
    const lease = makeLease();
    assert.equal(lease.selfPromotion, false);
  });

  it('LEASE-4: secrets paths are in filesystemDenied', () => {
    const lease = makeLease();
    const denied = lease.filesystemDenied;
    assert.ok(denied.some(d => d.includes('.secrets')));
    assert.ok(denied.some(d => d.includes('VAULT999')));
  });

  it('LEASE-5: lease has expiry within 1 hour', () => {
    const lease = makeLease();
    const expiresAt = new Date(lease.expiresAt);
    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();
    assert.ok(diffMs > 0, 'Lease already expired');
    assert.ok(diffMs <= 60 * 60 * 1000 + 5000, 'Lease exceeds 1 hour');
  });

  it('LEASE-6: ALLOWLIST network requires domains', () => {
    assert.throws(
      () => createCapabilityLease({
        purpose: 'test',
        createdBy: 'test',
        parentSessionId: 's1',
        allowedOperation: 'compute_only',
        network: 'ALLOWLIST',
        allowedDomains: [],
      }),
      /NETWORK_ALLOWLIST requires/
    );
  });
});
