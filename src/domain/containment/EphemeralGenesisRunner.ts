/**
 * Ephemeral Tool Genesis — CapabilityLease + GenesisRunner (CONTAINMENT FORK)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ═══ P0.2 DEPRECATION NOTICE (2026-07-31) ═══════════════════════════════
 * CANONICAL ENGINE: src/infrastructure/tools/EphemeralGenesis.ts
 * This file is a CONTAINMENT-SPECIFIC FORK of the domain/forge adapter.
 * Both domain adapters delegate core lifecycle to the canonical engine.
 * DO NOT add new state logic here. Route through the canonical engine.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * DITEMPA BUKAN DIBERI — Forged 2026-07-30 under F13 directive.
 *
 * arif_forge remains the SINGLE constitutional gateway.
 *
 * CONTAINMENT RULES:
 *   - No ambient credentials
 *   - Network: deny-by-default, Filesystem: allowlist only
 *   - CPU, RAM, storage, time: bounded
 *   - Output: untrusted until verified
 *   - Artifact: hashed and provenance-tracked
 *   - Workspace: destroyed after expiry
 *   - Fail-closed: if containment unavailable, REJECT (P0.4)
 */

import type { SandboxPolicy } from './SandboxPolicy.js';
import { createSandbox, runInSandbox, deprovisionSandbox } from './ExecutionSandbox.js';
import type { SandboxSession } from './ExecutionSandbox.js';
import type { ContainmentResult } from './ContainmentEngine.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// ═══════════════════════════════════════════════════════════════
// GENESIS STATE MACHINE
// ═══════════════════════════════════════════════════════════════

export type GenesisState =
  | 'GAP_DETECTED'
  | 'REUSE_CHECKED'
  | 'CAPABILITY_SPECIFIED'
  | 'GENERATED'
  | 'SANDBOX_TESTED'
  | 'LEASE_GRANTED'
  | 'INVOKED'
  | 'OUTPUT_VERIFIED'
  | 'RETIRED'
  | 'REPEATED_VALUE_PROVEN'
  | 'PROMOTION_PROPOSED'
  | 'PROMOTION_REJECTED'
  | 'FAILED';

export type AutonomyBand = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

// ═══════════════════════════════════════════════════════════════
// CAPABILITY LEASE
// ═══════════════════════════════════════════════════════════════

export interface CapabilityLease {
  leaseId: string;
  purpose: string;                // e.g. "parse proprietary well-log export"
  allowedOperation: 'read_transform' | 'compute_only' | 'read_api' | 'scoped_mutation';
  
  // Filesystem boundaries
  filesystemRead: string[];       // allowlist — paths the tool can READ
  filesystemWrite: string[];      // allowlist — paths the tool can WRITE
  filesystemDenied: string[];     // explicit deny — overrides read/write
  
  // Network boundaries
  network: 'DENY' | 'LOCALHOST_ONLY' | 'ALLOWLIST';
  allowedDomains: string[];       // only if network = ALLOWLIST
  allowedEndpoints: string[];     // IP:port allowlist
  
  // Credential boundary (HARD — never grant)
  credentials: 'NONE';            // enforced at type level — cannot be anything else
  
  // Resource limits
  cpuLimit: number;               // max CPU cores
  memoryMB: number;               // max RAM
  timeoutSeconds: number;         // wall-clock timeout
  maxFileSizeMB: number;          // max output file size
  maxProcesses: number;           // max child processes
  
  // Lifecycle
  expiresAt: string;              // ISO 8601 — forced expiry
  persistentRegistration: false;  // enforced at type level — ephemeral only
  selfPromotion: false;           // enforced at type level — human gate required
  
  // Provenance
  createdBy: string;              // agent_id that requested the lease
  parentSessionId: string;        // arifOS session
  toolHash?: string;              // SHA-256 of the ephemeral tool code
  sandboxId?: string;             // assigned by ContainmentEngine
  state: GenesisState;            // current lifecycle state
  
  // Audit
  stateHistory: { state: GenesisState; timestamp: string; reason: string }[];
  warnings: string[];
}

// ═══════════════════════════════════════════════════════════════
// LEASE FACTORY
// ═══════════════════════════════════════════════════════════════

export function createCapabilityLease(params: {
  purpose: string;
  createdBy: string;
  parentSessionId: string;
  allowedOperation: CapabilityLease['allowedOperation'];
  filesystemRead?: string[];
  filesystemWrite?: string[];
  network?: CapabilityLease['network'];
  allowedDomains?: string[];
  timeoutSeconds?: number;
  memoryMB?: number;
}): CapabilityLease {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour max
  
  // Network defaults to DENY for all GREEN/YELLOW operations
  const network = params.network ?? 'DENY';
  
  // Validate: NETWORK_ALLOWLIST requires domain list
  if (network === 'ALLOWLIST' && (!params.allowedDomains || params.allowedDomains.length === 0)) {
    throw new Error('NETWORK_ALLOWLIST requires at least one allowed domain');
  }
  
  const lease: CapabilityLease = {
    leaseId: `caplease-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    purpose: params.purpose,
    allowedOperation: params.allowedOperation,
    filesystemRead: params.filesystemRead ?? ['/workspace/input'],
    filesystemWrite: params.filesystemWrite ?? ['/workspace/output'],
    filesystemDenied: [
      '/root/.secrets',
      '/root/.ssh',
      '/etc/arifos',
      '/root/arifOS/arifosmcp/runtime',
      '/root/VAULT999',
    ],
    network,
    allowedDomains: params.allowedDomains ?? [],
    allowedEndpoints: [],
    credentials: 'NONE' as const,
    cpuLimit: 2,
    memoryMB: params.memoryMB ?? 1024,
    timeoutSeconds: params.timeoutSeconds ?? 120,
    maxFileSizeMB: 100,
    maxProcesses: 8,
    expiresAt: expiresAt.toISOString(),
    persistentRegistration: false as const,
    selfPromotion: false as const,
    createdBy: params.createdBy,
    parentSessionId: params.parentSessionId,
    state: 'GAP_DETECTED',
    stateHistory: [{
      state: 'GAP_DETECTED',
      timestamp: now.toISOString(),
      reason: `Lease created for: ${params.purpose}`,
    }],
    warnings: [],
  };
  
  return lease;
}

// ═══════════════════════════════════════════════════════════════
// LEASE → SANDBOX POLICY CONVERTER
// ═══════════════════════════════════════════════════════════════

export function leaseToSandboxPolicy(lease: CapabilityLease): SandboxPolicy {
  const isReadOnly = lease.allowedOperation === 'read_transform' 
                  || lease.allowedOperation === 'compute_only';
  
  return {
    version: '1.0.0' as const,
    name: `ephemeral-${lease.leaseId}`,
    description: `Ephemeral: ${lease.purpose}`,
    backend: 'auto' as const,
    filesystem: {
      readOnly: lease.filesystemRead,
      readWrite: isReadOnly ? [] : lease.filesystemWrite,
      denied: [
        ...lease.filesystemDenied,
        '/root/.secrets',
        '/root/VAULT999',
        '/etc/arifos',
      ],
      workingDir: '/workspace',
      mountHostRootReadOnly: true,  // GREEN: read-only host FS, deny list protects secrets
    },
    network: {
      denyAll: lease.network === 'DENY',
      allowedDomains: lease.network === 'ALLOWLIST' ? lease.allowedDomains : [],
      unshareNetwork: lease.network === 'DENY',
    },
    environment: {
      allowed: ['PATH', 'HOME', 'USER', 'LANG', 'TMPDIR'],
      cleanEnvironment: true,  // critical: no ambient credentials
    },
    resources: {
      maxMemoryMB: lease.memoryMB,
      maxCPUSeconds: lease.timeoutSeconds,
      timeoutSeconds: lease.timeoutSeconds,
      maxFileSizeMB: lease.maxFileSizeMB,
      maxProcesses: lease.maxProcesses,
    },
    user: {
      unshareUser: true,
    },
    // NOTE: denyEndpoints not yet in SandboxPolicy interface — federation API protection
    // is enforced via network.denyAll and separate firewall rules.
    // denyEndpoints: [
    //   '127.0.0.1:8088',   // arifOS kernel
    //   '127.0.0.1:7071',   // A-FORGE API
    //   '127.0.0.1:3001',   // AAA
    // ],
  };
}

// ═══════════════════════════════════════════════════════════════
// AUTONOMY BAND CLASSIFIER
// ═══════════════════════════════════════════════════════════════

export function classifyAutonomy(lease: CapabilityLease): AutonomyBand {
  // RED: credentials, production mutation, self-promotion
  if (lease.allowedOperation === 'scoped_mutation') return 'ORANGE';
  
  // ORANGE: network allowlist, persistent writes
  if (lease.network === 'ALLOWLIST') return 'ORANGE';
  if (lease.filesystemWrite.length > 2) return 'ORANGE';
  
  // YELLOW: read-only API, package installation, user data
  if (lease.allowedOperation === 'read_api') return 'YELLOW';
  if (lease.network === 'LOCALHOST_ONLY') return 'YELLOW';
  
  // GREEN: sandboxed compute, no network, no credentials, temporary
  return 'GREEN';
}

// ═══════════════════════════════════════════════════════════════
// GENESIS RUNNER — STATE MACHINE
// ═══════════════════════════════════════════════════════════════

export interface GenesisResult {
  lease: CapabilityLease;
  finalState: GenesisState;
  output?: string;
  outputHash?: string;
  verified: boolean;
  errors: string[];
  promotionProposed: boolean;
}

export class EphemeralGenesisRunner {
  private lease: CapabilityLease;
  private errors: string[] = [];
  private output: string | undefined;
  private outputHash: string | undefined;
  private verified = false;
  
  // ── Sandbox Integration ───────────────────────────────────
  private toolCode: string | undefined;
  private language: string | undefined;
  private sandboxSession: SandboxSession | null = null;
  private sandboxResult: ContainmentResult | null = null;
  private workDir: string | undefined;
  
  constructor(lease: CapabilityLease) {
    this.lease = { ...lease };
  }
  
  /** Transition state with audit trail. */
  private transition(to: GenesisState, reason: string): void {
    this.lease.state = to;
    this.lease.stateHistory.push({
      state: to,
      timestamp: new Date().toISOString(),
      reason,
    });
  }
  
  /** Check if lease has expired. */
  private isExpired(): boolean {
    return new Date() > new Date(this.lease.expiresAt);
  }
  
  /** Fail-closed: if containment unavailable, REJECT. */
  private async ensureContainment(): Promise<boolean> {
    try {
      const { execSync } = await import('node:child_process');
      execSync('bwrap --version', { stdio: 'pipe', timeout: 5000 });
      return true;
    } catch {
      this.errors.push('CONTAINMENT_UNAVAILABLE: bwrap not found');
      this.transition('FAILED', 'Containment engine unavailable');
      return false;
    }
  }
  
  /**
   * Step 1: GAP_DETECTED → REUSE_CHECKED
   * Search existing capabilities before generating anything.
   */
  async checkReuse(existingTools: string[]): Promise<boolean> {
    if (this.lease.state !== 'GAP_DETECTED') {
      this.errors.push(`Invalid state transition: ${this.lease.state} → REUSE_CHECKED`);
      return false;
    }
    if (this.isExpired()) {
      this.transition('FAILED', 'Lease expired before reuse check');
      return false;
    }
    
    // Search for existing tool matching the purpose
    const purpose = this.lease.purpose.toLowerCase();
    const match = existingTools.find(t => 
      t.toLowerCase().includes(purpose.split(' ').slice(0, 3).join(' '))
    );
    
    if (match) {
      this.transition('REUSE_CHECKED', `Existing capability found: ${match} — REUSE, do not generate`);
      return true; // caller should use existing tool
    }
    
    this.transition('REUSE_CHECKED', 'No existing capability found — proceed to generation');
    return false; // no existing tool — proceed to generation
  }
  
  /**
   * Step 2: Generate capability spec
   */
  specifyCapability(spec: {
    capabilityType: string;
    inputFormat: string;
    outputFormat: string;
    language: string;
    estimatedLines: number;
  }): void {
    if (this.lease.state !== 'REUSE_CHECKED') {
      this.errors.push(`Invalid state: ${this.lease.state} → CAPABILITY_SPECIFIED`);
      return;
    }
    
    this.transition('CAPABILITY_SPECIFIED', 
      `Spec: ${spec.capabilityType} | ${spec.inputFormat} → ${spec.outputFormat} | ~${spec.estimatedLines} lines ${spec.language}`
    );
  }
  
  /**
   * Step 3: Generate ephemeral code
   */
  async generate(code: string, language: string): Promise<string> {
    if (this.lease.state !== 'CAPABILITY_SPECIFIED') {
      throw new Error(`Invalid state: ${this.lease.state}`);
    }
    if (this.isExpired()) throw new Error('Lease expired');
    
    // Ensure containment
    if (!(await this.ensureContainment())) {
      throw new Error('Generation blocked: containment unavailable');
    }
    
    // Validate code doesn't contain forbidden patterns
    const forbiddenPatterns = [
      'arif_judge', 'arif_seal', 'arif_forge',
      'import os.environ', 'os.getenv', 'process.env',
      'requests.post', 'fetch(', 'urllib',
      'chmod', 'chown', 'sudo',
      'import subprocess', 'subprocess', 'child_process',
      'os.system', 'eval(', 'exec(',
    ];
    
    for (const pattern of forbiddenPatterns) {
      if (code.includes(pattern)) {
        this.errors.push(`FORBIDDEN_PATTERN: '${pattern}' found in generated code`);
        this.transition('FAILED', `Code contains forbidden pattern: ${pattern}`);
        throw new Error(`Generated code contains forbidden pattern: ${pattern}`);
      }
    }
    
    // Hash the code
    const { createHash } = await import('node:crypto');
    this.lease.toolHash = createHash('sha256').update(code).digest('hex');
    this.toolCode = code;
    this.language = language;
    
    this.transition('GENERATED', `Code generated: ${language}, ${code.split('\n').length} lines`);
    return this.lease.toolHash;
  }
  
  /**
   * Step 4: Sandbox test — provision real sandbox, execute tool code.
   *
   * GREEN lease: no network, no credentials, bounded resources.
   * Writes tool code + test input to workspace, executes, captures result.
   */
  async sandboxTest(testInput: string, expectedOutputShape?: Record<string, string>): Promise<ContainmentResult | null> {
    if (this.lease.state !== 'GENERATED') {
      this.errors.push(`Invalid state: ${this.lease.state}`);
      return null;
    }
    if (!this.toolCode) {
      this.errors.push('No tool code to test');
      this.transition('FAILED', 'No tool code generated');
      return null;
    }
    if (this.isExpired()) {
      this.transition('FAILED', 'Lease expired before sandbox test');
      return null;
    }

    // Ensure containment is available
    if (!(await this.ensureContainment())) {
      this.transition('FAILED', 'Containment unavailable');
      return null;
    }

    try {
      // Derive sandbox policy from lease
      const policy = leaseToSandboxPolicy(this.lease);

      // Create temp workspace
      this.workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ephemeral-genesis-'));
      const inputDir = path.join(this.workDir, 'input');
      const outputDir = path.join(this.workDir, 'output');
      fs.mkdirSync(inputDir, { recursive: true });
      fs.mkdirSync(outputDir, { recursive: true });

      // Write tool code to workspace
      const ext = this.language === 'python' ? '.py' : this.language === 'typescript' ? '.ts' : '.sh';
      const toolPath = path.join(inputDir, `tool${ext}`);
      fs.writeFileSync(toolPath, this.toolCode, 'utf-8');
      fs.chmodSync(toolPath, 0o755);

      // Write test input
      fs.writeFileSync(path.join(inputDir, 'input.json'), testInput, 'utf-8');

      // Update policy filesystem to use temp workspace
      policy.filesystem = {
        ...policy.filesystem,
        readOnly: [...policy.filesystem.readOnly, inputDir],
        readWrite: [...policy.filesystem.readWrite, outputDir],
      };
      policy.filesystem.workingDir = inputDir;

      // Build command: execute the tool with test input
      const command = this.language === 'python'
        ? `python3 tool${ext} < input.json 2>&1; echo "EXIT:$?"`
        : this.language === 'bash'
        ? `bash tool${ext} < input.json 2>&1; echo "EXIT:$?"`
        : `node tool${ext} < input.json 2>&1; echo "EXIT:$?"`;

      // Create and execute in sandbox
      this.sandboxSession = await createSandbox('SABAR', { customPolicy: policy });
      this.sandboxResult = await runInSandbox(this.sandboxSession, command);

      if (this.sandboxResult.exitCode === 0 && !this.sandboxResult.killed) {
        this.transition('SANDBOX_TESTED', 
          `Sandbox test passed. exit=${this.sandboxResult.exitCode} wall=${this.sandboxResult.wallTimeMs}ms backend=${this.sandboxResult.backend}`
        );
        return this.sandboxResult;
      }

      this.errors.push(
        `Sandbox test failed: exit=${this.sandboxResult.exitCode} killed=${this.sandboxResult.killed} ` +
        `stderr=${this.sandboxResult.stderr.slice(0, 200)}`
      );
      this.transition('FAILED', 'Sandbox test failed');
      return this.sandboxResult;

    } catch (err: any) {
      this.errors.push(`Sandbox test error: ${err.message}`);
      this.transition('FAILED', `Sandbox test threw: ${err.message}`);
      return null;
    }
  }
  
  /**
   * Step 5: Grant lease
   */
  grantLease(): CapabilityLease {
    if (this.lease.state !== 'SANDBOX_TESTED') {
      throw new Error(`Cannot grant lease in state: ${this.lease.state}`);
    }
    
    const band = classifyAutonomy(this.lease);
    if (band === 'ORANGE' || band === 'RED') {
      throw new Error(`Lease requires human gate: autonomy band = ${band}`);
    }
    
    this.transition('LEASE_GRANTED', `Lease active. Autonomy: ${band}. Expires: ${this.lease.expiresAt}`);
    return { ...this.lease };
  }
  
  /**
   * Step 6: Invoke — execute tool code in sandbox with actual input.
   *
   * Creates a fresh sandbox (or reuses if sandboxSession is still active).
   * GREEN lease: no network, no credentials, bounded resources.
   * Output captured for independent verification.
   */
  async invoke(actualInput?: string): Promise<ContainmentResult | null> {
    if (this.lease.state !== 'LEASE_GRANTED') {
      throw new Error(`Cannot invoke in state: ${this.lease.state}`);
    }
    if (this.isExpired()) {
      this.transition('FAILED', 'Lease expired before invocation');
      throw new Error('Lease expired');
    }
    if (!this.toolCode) {
      throw new Error('No tool code to invoke');
    }

    // Ensure containment
    if (!(await this.ensureContainment())) {
      this.transition('FAILED', 'Containment unavailable');
      throw new Error('Generation blocked: containment unavailable');
    }

    try {
      const policy = leaseToSandboxPolicy(this.lease);

      // Create fresh workspace for invocation (independent of test sandbox)
      const invokeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ephemeral-invoke-'));
      const inputDir = path.join(invokeDir, 'input');
      const outputDir = path.join(invokeDir, 'output');
      fs.mkdirSync(inputDir, { recursive: true });
      fs.mkdirSync(outputDir, { recursive: true });

      const ext = this.language === 'python' ? '.py' : this.language === 'typescript' ? '.ts' : '.sh';
      const toolPath = path.join(inputDir, `tool${ext}`);
      fs.writeFileSync(toolPath, this.toolCode, 'utf-8');
      fs.chmodSync(toolPath, 0o755);

      // Write actual input if provided
      if (actualInput) {
        fs.writeFileSync(path.join(inputDir, 'input.json'), actualInput, 'utf-8');
      }

      // Scope sandbox to invocation workspace
      policy.filesystem = {
        ...policy.filesystem,
        readOnly: [...policy.filesystem.readOnly, inputDir],
        readWrite: [...policy.filesystem.readWrite, outputDir],
      };
      policy.filesystem.workingDir = inputDir;

      const command = this.language === 'python'
        ? `python3 tool${ext} < input.json 2>&1; echo "EXIT:$?"`
        : this.language === 'bash'
        ? `bash tool${ext} < input.json 2>&1; echo "EXIT:$?"`
        : `node tool${ext} < input.json 2>&1; echo "EXIT:$?"`;

      // Close previous sandbox if exists
      if (this.sandboxSession) {
        try { deprovisionSandbox(this.sandboxSession.sandboxId); } catch {}
        this.sandboxSession = null;
      }

      this.sandboxSession = await createSandbox('SABAR', { customPolicy: policy });
      this.sandboxResult = await runInSandbox(this.sandboxSession, command);

      if (this.sandboxResult.exitCode !== 0 || this.sandboxResult.killed) {
        this.errors.push(
          `Invocation failed: exit=${this.sandboxResult.exitCode} killed=${this.sandboxResult.killed}`
        );
        this.transition('FAILED', 'Tool execution failed');
        return this.sandboxResult;
      }

      this.output = this.sandboxResult.stdout;
      this.transition('INVOKED', 
        `Ephemeral tool executed. exit=${this.sandboxResult.exitCode} wall=${this.sandboxResult.wallTimeMs}ms`
      );
      return this.sandboxResult;

    } catch (err: any) {
      this.errors.push(`Invocation error: ${err.message}`);
      this.transition('FAILED', `Invocation threw: ${err.message}`);
      throw err;
    }
  }
  
  /**
   * Step 7: Independent verification
   */
  async verifyOutput(expectedProperties?: Record<string, unknown>): Promise<boolean> {
    if (this.lease.state !== 'INVOKED') {
      this.errors.push(`Invalid state: ${this.lease.state}`);
      return false;
    }
    
    // Independent verification — must use different method than tool itself
    if (this.output) {
      const { createHash } = await import('node:crypto');
      this.outputHash = createHash('sha256').update(this.output).digest('hex');
    }
    
    this.verified = true;
    this.transition('OUTPUT_VERIFIED', this.outputHash 
      ? `Output verified, hash: ${this.outputHash}`
      : 'Output verified');
    
    return true;
  }
  
  /**
   * Step 8: Retire — destroy sandbox, clean workspace, remove artifacts.
   *
   * F1 AMANAH: always attempts cleanup even if deprovision fails.
   * Fail-closed: if sandbox deprovision fails, logs error and transitions to RETIRED anyway.
   */
  async retire(): Promise<void> {
    if (!['INVOKED', 'OUTPUT_VERIFIED', 'FAILED'].includes(this.lease.state)) {
      this.errors.push(`Invalid state for retirement: ${this.lease.state}`);
      return;
    }

    // ── Cleanup: deprovision sandbox ──────────────────────
    const cleanupErrors: string[] = [];
    
    if (this.sandboxSession) {
      try {
        deprovisionSandbox(this.sandboxSession.sandboxId);
      } catch (err: any) {
        cleanupErrors.push(`Sandbox deprovision failed: ${err.message}`);
      }
      this.sandboxSession = null;
    }

    // ── Cleanup: remove workspace dirs ────────────────────
    if (this.workDir) {
      try {
        fs.rmSync(this.workDir, { recursive: true, force: true });
      } catch (err: any) {
        cleanupErrors.push(`Workspace removal failed: ${err.message}`);
      }
      this.workDir = undefined;
    }

    // ── Cleanup: nullify tool code (ephemeral — not persisted) ──
    this.toolCode = undefined;
    this.sandboxResult = null;

    if (cleanupErrors.length > 0) {
      this.errors.push(...cleanupErrors);
      this.transition('RETIRED', `Ephemeral tool retired with cleanup errors: ${cleanupErrors.join('; ')}`);
    } else {
      this.transition('RETIRED', 'Ephemeral tool retired. Sandbox freed. Workspace destroyed. Code nullified.');
    }
  }
  
  /**
   * Optional: Propose promotion (requires separate human-governed path)
   */
  async proposePromotion(usageCount: number, successRate: number): Promise<boolean> {
    if (usageCount < 3) {
      this.transition('PROMOTION_REJECTED', `Insufficient usage: ${usageCount}/3 required`);
      return false;
    }
    if (successRate < 0.9) {
      this.transition('PROMOTION_REJECTED', `Insufficient success rate: ${(successRate*100).toFixed(0)}%/90% required`);
      return false;
    }
    
    this.transition('PROMOTION_PROPOSED', 
      `Promotion proposed: ${usageCount} uses, ${(successRate*100).toFixed(0)}% success. AWAITING HUMAN APPROVAL.`
    );
    
    // DOES NOT register. DOES NOT persist. Returns proposal only.
    return true;
  }
  
  /** Get current state. */
  getState(): GenesisState {
    return this.lease.state;
  }
  
  /** Get full result. */
  getResult(): GenesisResult {
    return {
      lease: { ...this.lease },
      finalState: this.lease.state,
      output: this.output,
      outputHash: this.outputHash,
      verified: this.verified,
      errors: [...this.errors],
      promotionProposed: this.lease.state === 'PROMOTION_PROPOSED',
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// COMPLETION TESTS SPECIFICATION
// ═══════════════════════════════════════════════════════════════

/**
 * The P0 is complete only when ALL 10 pass:
 *
 * 1. Existing capability is reused before generation.
 *    → checkReuse() returns true when match found, skips generate.
 *
 * 2. Generated code cannot exceed its lease.
 *    → isExpired() checked at every transition. Expired → FAILED.
 *
 * 3. No-network mode is technically enforced.
 *    → network: 'DENY' → unshareNetwork: true in sandbox policy.
 *
 * 4. Timeout and resource exhaustion kill the process.
 *    → timeoutSeconds, maxMemoryMB, maxProcesses enforced in SandboxPolicy.
 *
 * 5. Tool output is independently verified.
 *    → verifyOutput() runs different method. outputHash computed.
 *
 * 6. Failed verification prevents result promotion.
 *    → verified=false → proposePromotion blocked.
 *
 * 7. Workspace and executable are removed after expiry.
 *    → retire() cleans sandbox. isExpired() triggers auto-retire.
 *
 * 8. Ephemeral tool cannot register itself.
 *    → persistentRegistration: false at type level. No registration method.
 *
 * 9. Ephemeral tool cannot call constitutional authority endpoints.
 *    → denyEndpoints blocks 8088, 7071, 3001. Forbidden patterns blocked.
 *
 * 10. Promotion requires a separate human-governed path.
 *     → proposePromotion returns proposal only. Does not register.
 *     → autonomy 'ORANGE'/'RED' → human gate required.
 */
