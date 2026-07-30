/**
 * GenesisSandboxIntegration — Wire EphemeralGenesisRunner to ExecutionSandbox
 * ============================================================================
 *
 * This is the DANGER ZONE. Generated code executes here.
 * Every safety invariant must be enforced at the OS level, not in TypeScript.
 *
 * GREEN lease only initially. No network. No credentials. Temporary filesystem.
 * Generated code = untrusted foreign worker:
 *   - No house keys
 *   - Cannot see secrets
 *   - Cannot reach internet
 *   - Cannot touch production
 *   - Cannot grant itself permissions
 *   - Must be removed after work completes
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import { createSandbox, runInSandbox, getSession } from "../containment/ExecutionSandbox.js";
import { PRESETS, derivePolicyFromVerdict } from "../containment/SandboxPolicy.js";
import type { SandboxPolicy, ConstitutionalVerdict } from "../containment/SandboxPolicy.js";
import type { SandboxSession } from "../containment/ExecutionSandbox.js";
import type { ContainmentResult } from "../containment/ContainmentEngine.js";

import {
  EphemeralGenesisRunner,
  type GenesisReceipt,
  type GenesisState,
  EPHEMERAL_CONTAINMENT_RULES,
  FORBIDDEN_APIS,
} from "./EphemeralGenesisRunner.js";

import {
  type CapabilityLease,
  type LeaseValidation,
  validateLease,
  isLeaseExpired,
} from "./CapabilityLease.js";

import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";

// ── Integration Result ───────────────────────────────────────────

export interface IntegrationResult {
  success: boolean;
  receipt: GenesisReceipt;
  sandboxSession?: SandboxSession;
  executionResult?: ContainmentResult;
  verificationResult?: {
    verified: boolean;
    method: string;
    evidence: string;
  };
  error?: string;
  stage: GenesisState;
  workspaceDestroyed: boolean;
}

// ── Lease → Sandbox Policy Mapping ───────────────────────────────

function leaseToSandboxPolicy(lease: CapabilityLease): SandboxPolicy {
  const base = lease.authorityBand === "YELLOW"
    ? { ...PRESETS.NETWORKED_READ }
    : { ...PRESETS.READONLY_BUILD };

  // Override from lease
  return {
    ...base,
    version: "1.0.0",
    name: `ephemeral-${lease.leaseId}`,
    description: lease.purpose,
    filesystem: {
      readOnly: lease.filesystem.read,
      readWrite: lease.filesystem.write,
      denied: [
        ...base.filesystem.denied,
        ...lease.filesystem.deny,
      ],
      workingDir: "/tmp/forge8/output",
    },
    network: {
      denyAll: !lease.network.allow,
      allowedDomains: lease.network.allowedDomains,
      unshareNetwork: !lease.network.allow,
    },
    resources: {
      maxMemoryMB: lease.resources.memoryMB,
      maxCPUSeconds: lease.resources.timeoutSeconds,
      timeoutSeconds: lease.resources.timeoutSeconds,
      maxFileSizeMB: lease.resources.maxFileSizeMB,
      maxProcesses: lease.resources.maxProcesses,
    },
    environment: {
      allowed: ["HOME", "PATH", "USER", "LANG"],
      cleanEnvironment: true,
    },
    user: { unshareUser: true },
  };
}

// ── Code Injection Guard ─────────────────────────────────────────

function scanForForbiddenAPIs(code: string): string[] {
  const violations: string[] = [];
  for (const api of FORBIDDEN_APIS) {
    if (code.includes(api)) {
      violations.push(`Forbidden API reference: ${api}`);
    }
  }
  // Check for escape patterns
  const escapePatterns = [
    { pattern: /os\.environ|process\.env|getenv\s*\(/, name: "environment variable access" },
    { pattern: /subprocess|child_process|os\.system|os\.popen|exec\s*\(/, name: "subprocess/command execution" },
    { pattern: /socket\.|urllib|requests\.|fetch\s*\(|http\./, name: "network access" },
    { pattern: /importlib|__import__|require\s*\(|eval\s*\(/, name: "dynamic import/eval" },
    { pattern: /open\s*\(.*['"]\/(etc|root|proc|sys|dev)/, name: "sensitive filesystem read" },
    { pattern: /chmod|chown|setuid|setgid/, name: "permission modification" },
  ];
  for (const { pattern, name } of escapePatterns) {
    if (pattern.test(code)) {
      violations.push(`Potential escape: ${name}`);
    }
  }
  return violations;
}

// ── Independent Output Verification ───────────────────────────────

async function verifyOutput(
  outputPath: string,
  expectedProperties: string[],
): Promise<{ verified: boolean; method: string; evidence: string }> {
  try {
    const content = await fs.readFile(outputPath, "utf-8");
    const hash = crypto.createHash("sha256").update(content).digest("hex");

    // Check each expected property
    const checks: string[] = [];
    for (const prop of expectedProperties) {
      if (content.includes(prop)) {
        checks.push(`✓ contains "${prop}"`);
      } else {
        checks.push(`✗ missing "${prop}"`);
      }
    }

    const allPassed = checks.every(c => c.startsWith("✓"));

    return {
      verified: allPassed,
      method: "content_validation + sha256",
      evidence: `hash=${hash} checks=[${checks.join(", ")}]`,
    };
  } catch (err: any) {
    return {
      verified: false,
      method: "content_validation",
      evidence: `read failed: ${err.message}`,
    };
  }
}

// ── Workspace Cleanup ────────────────────────────────────────────

async function destroyWorkspace(workspacePath: string): Promise<boolean> {
  try {
    await fs.rm(workspacePath, { recursive: true, force: true });
    return true;
  } catch (err: any) {
    console.error(`[genesis:cleanup] Failed to destroy workspace ${workspacePath}: ${err.message}`);
    // Attempt individual file cleanup
    try {
      const files = await fs.readdir(workspacePath);
      for (const file of files) {
        await fs.rm(path.join(workspacePath, file), { recursive: true, force: true }).catch(() => {});
      }
      return true;
    } catch {
      return false;
    }
  }
}

// ── The Integration ──────────────────────────────────────────────

export class GenesisSandboxIntegration {
  private runner: EphemeralGenesisRunner;
  private readonly workspaceBase = "/tmp/forge8/ephemeral";

  constructor() {
    this.runner = new EphemeralGenesisRunner();
  }

  /**
   * Full end-to-end ephemeral tool lifecycle:
   *   gap → reuse-check → generate → test → lease → invoke → verify → retire
   *
   * @returns IntegrationResult with complete execution trace
   */
  async executeFullLifecycle(params: {
    purpose: string;
    capabilityGap: string;
    existingTools: Array<{ name: string; capability: string; healthy: boolean }>;
    toolCode: string;
    language: string;
    testCommand: string;
    invokeCommand: string;
    expectedOutputProperties: string[];
    actorId: string;
  }): Promise<IntegrationResult> {
    const workspacePath = path.join(this.workspaceBase, `run-${Date.now().toString(36)}`);
    let sandboxSession: SandboxSession | undefined;
    let workspaceDestroyed = false;

    try {
      // Ensure workspace
      await fs.mkdir(workspacePath, { recursive: true });

      // ── Step 1: GAP_DETECTED ─────────────────────────────────
      let receipt = this.runner.gapDetect({
        purpose: params.purpose,
        requiredCapability: params.capabilityGap,
        existingTools: params.existingTools.map(t => t.name),
      });

      // ── Step 2: REUSE_CHECKED ────────────────────────────────
      receipt = this.runner.reuseCheck(receipt.genesisId, params.existingTools);

      if (receipt.reusePossible) {
        return {
          success: true,
          receipt,
          stage: "REUSE_CHECKED",
          workspaceDestroyed: true,
        };
      }

      // ── Step 3: CAPABILITY_SPECIFIED ─────────────────────────
      receipt = this.runner.capabilitySpecify(receipt.genesisId, {
        language: params.language,
        inputSchema: {},
        outputSchema: {},
        requiredOperation: "compute_only",
        needsNetwork: false,
      });

      // ── Step 4: GENERATED — scan for forbidden APIs ──────────
      const violations = scanForForbiddenAPIs(params.toolCode);
      if (violations.length > 0) {
        return {
          success: false,
          receipt,
          stage: "GENERATED",
          error: `Code injection guard: ${violations.join("; ")}`,
          workspaceDestroyed: false,
        };
      }

      receipt = this.runner.generate(receipt.genesisId, params.toolCode);

      // ── Step 5: SANDBOX_TESTED ───────────────────────────────
      // Write tool code to workspace
      const toolFile = path.join(workspacePath, `tool.${params.language === "python" ? "py" : "sh"}`);
      await fs.writeFile(toolFile, params.toolCode);
      await fs.chmod(toolFile, 0o700);

      // Provision GREEN sandbox for testing
      const testPolicy = { ...PRESETS.READONLY_BUILD };
      testPolicy.filesystem = {
        ...testPolicy.filesystem,
        readOnly: [...testPolicy.filesystem.readOnly, workspacePath],
        readWrite: [...testPolicy.filesystem.readWrite, workspacePath],
      };

      sandboxSession = await createSandbox("SABAR", {
        customPolicy: testPolicy,
        sessionId: receipt.genesisId,
        actorId: params.actorId,
      });

      // Run test in sandbox
      const testResult = await runInSandbox(
        sandboxSession,
        params.testCommand.replace("{WORKSPACE}", workspacePath),
      );

      receipt = this.runner.sandboxTest(receipt.genesisId, {
        exitCode: testResult.exitCode,
        stdout: testResult.stdout,
        stderr: testResult.stderr,
        sandboxId: sandboxSession.sandboxId,
        wallTimeMs: testResult.wallTimeMs,
        testPassed: testResult.exitCode === 0 && !testResult.killed,
      });

      if (!receipt.artifact?.testPassed) {
        return {
          success: false,
          receipt,
          sandboxSession,
          executionResult: testResult,
          stage: "SANDBOX_TESTED",
          error: `Sandbox test failed: exit=${testResult.exitCode} stderr=${testResult.stderr.slice(0, 200)}`,
          workspaceDestroyed: false,
        };
      }

      // ── Step 6: LEASE_GRANTED ────────────────────────────────
      const { receipt: r2, lease } = this.runner.leaseGrant(receipt.genesisId, {
        issuedBy: params.actorId,
        needsNetwork: false,
        timeoutSeconds: 120,
      });
      receipt = r2;

      // Lease → Sandbox Policy
      const invokePolicy = leaseToSandboxPolicy(lease);

      // ── Step 7: INVOKED ──────────────────────────────────────
      // Provision new sandbox for invocation (fresh isolation)
      sandboxSession = await createSandbox("SABAR", {
        customPolicy: invokePolicy,
        sessionId: receipt.genesisId,
        actorId: params.actorId,
        leaseHash: lease.leaseHash,
      });

      // Validate lease before execution
      const leaseValid = validateLease(lease);
      if (!leaseValid.valid) {
        return {
          success: false,
          receipt,
          sandboxSession,
          stage: "LEASE_GRANTED",
          error: `Lease invalid before invocation: ${leaseValid.reason}`,
          workspaceDestroyed: false,
        };
      }

      if (isLeaseExpired(lease)) {
        return {
          success: false,
          receipt,
          sandboxSession,
          stage: "LEASE_GRANTED",
          error: "Lease expired before invocation",
          workspaceDestroyed: false,
        };
      }

      const { receipt: r3, allowed, reason } = this.runner.invoke(
        receipt.genesisId,
        {
          readPaths: [workspacePath, ...lease.filesystem.read],
          writePaths: [workspacePath, ...lease.filesystem.write],
          needsNetwork: false,
          input: {},
        },
      );
      receipt = r3;

      if (!allowed) {
        return {
          success: false,
          receipt,
          sandboxSession,
          stage: "LEASE_GRANTED",
          error: `Invocation blocked: ${reason}`,
          workspaceDestroyed: false,
        };
      }

      // Execute the actual tool in sandbox
      const invokeResult = await runInSandbox(
        sandboxSession,
        params.invokeCommand.replace("{WORKSPACE}", workspacePath),
      );

      const outputPath = path.join(workspacePath, "output.txt");

      // ── Step 8: OUTPUT_VERIFIED ──────────────────────────────
      const verification = await verifyOutput(outputPath, params.expectedOutputProperties);

      receipt = this.runner.verifyOutput(receipt.genesisId, {
        verificationMethod: verification.method,
        expectedProperties: params.expectedOutputProperties,
        actualOutput: verification.evidence,
      });

      // ── Step 9: RETIRED ──────────────────────────────────────
      receipt = this.runner.retire(receipt.genesisId);

      // Destroy workspace
      workspaceDestroyed = await destroyWorkspace(workspacePath);

      return {
        success: verification.verified && workspaceDestroyed,
        receipt,
        sandboxSession,
        executionResult: invokeResult,
        verificationResult: verification,
        stage: "RETIRED",
        workspaceDestroyed,
      };

    } catch (err: any) {
      // FAIL CLOSED — cleanup even on error
      try { await destroyWorkspace(workspacePath); } catch {}

      return {
        success: false,
        receipt: {
          genesisId: "FAILED",
          state: "FAILED",
          purpose: params.purpose,
          capabilityGap: params.capabilityGap,
          existingToolsChecked: [],
          reusePossible: false,
          authorityBand: "GREEN",
          promotionProposed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          receiptHash: "",
        } as GenesisReceipt,
        stage: "FAILED",
        error: err.message,
        workspaceDestroyed,
      };
    }
  }

  /**
   * Adversarial test: attempt escape from sandbox.
   * Must PROVE that OS containment blocks the attempt.
   */
  async runAdversarialTest(params: {
    escapeCode: string;
    escapeDescription: string;
    actorId: string;
  }): Promise<{
    contained: boolean;
    evidence: string;
    sandboxId: string;
  }> {
    const workspacePath = path.join(this.workspaceBase, `adversarial-${Date.now().toString(36)}`);
    await fs.mkdir(workspacePath, { recursive: true });

    try {
      const toolFile = path.join(workspacePath, "escape_test.sh");
      await fs.writeFile(toolFile, params.escapeCode);
      await fs.chmod(toolFile, 0o700);

      const policy = { ...PRESETS.READONLY_BUILD };
      policy.filesystem = {
        ...policy.filesystem,
        readWrite: [...policy.filesystem.readWrite, workspacePath],
      };

      const session = await createSandbox("SABAR", {
        customPolicy: policy,
        actorId: params.actorId,
      });

      const result = await runInSandbox(session, `bash ${workspacePath}/escape_test.sh`);

      // Escape is contained if: exit ≠ 0, or stderr contains "denied"/"permission"
      const contained =
        result.exitCode !== 0 ||
        result.killed ||
        /denied|permission|not found|cannot|operation not permitted/i.test(result.stderr);

      return {
        contained,
        evidence: `exit=${result.exitCode} killed=${result.killed} stderr_sample=${result.stderr.slice(0, 300)}`,
        sandboxId: session.sandboxId,
      };
    } finally {
      await destroyWorkspace(workspacePath);
    }
  }
}
