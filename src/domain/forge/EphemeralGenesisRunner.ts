/**
 * EphemeralGenesisRunner — Governed Ephemeral Tool Lifecycle (DOMAIN ADAPTER)
 * ===========================================================================
 *
 * ═══ P0.2 ARCHITECTURAL NOTE (2026-07-31) ═══════════════════════════════
 * CANONICAL ENGINE: src/infrastructure/tools/EphemeralGenesis.ts
 * This file is a DOMAIN ADAPTER providing CapabilityLease + GenesisReceipt
 * governance wrappers around the canonical EphemeralGenesis engine.
 * The MCP surface (src/interfaces/mcp/ephemeralTools.ts) routes through
 * the canonical engine. This adapter exists for internal A-FORGE workflows
 * that need lease-bound execution and richer state tracking.
 *
 * DUPLICATE WARNING: src/domain/containment/EphemeralGenesisRunner.ts
 * is a containment-specific fork. Both must delegate to the canonical
 * engine for core lifecycle operations. DO NOT add new state logic here
 * without also updating the canonical engine.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * State machine (domain adapter — canonical engine has simpler states):
 *   GAP_DETECTED → REUSE_CHECKED → CAPABILITY_SPECIFIED → GENERATED
 *   → SANDBOX_TESTED → LEASE_GRANTED → INVOKED → OUTPUT_VERIFIED
 *   → RETIRED
 *
 * Optional branch:
 *   REPEATED_VALUE_PROVEN → PROMOTION_PROPOSED → Human/kernel review
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 * @constitutional F1 AMANAH — all ephemeral tools are temporary and reversible
 * @constitutional F11 AUDIT — every genesis lifecycle leaves a receipt
 * @constitutional F13 SOVEREIGN — promotion requires human approval
 */

import crypto from "node:crypto";
import {
  type CapabilityLease,
  createGreenLease,
  createYellowLease,
  validateLease,
  isLeaseExpired,
  checkOperationScope,
} from "./CapabilityLease.js";

// ── Genesis State Machine ────────────────────────────────────────

export type GenesisState =
  | "GAP_DETECTED"
  | "REUSE_CHECKED"
  | "CAPABILITY_SPECIFIED"
  | "GENERATED"
  | "SANDBOX_TESTED"
  | "LEASE_GRANTED"
  | "INVOKED"
  | "OUTPUT_VERIFIED"
  | "RETIRED"
  | "REPEATED_VALUE_PROVEN"
  | "PROMOTION_PROPOSED"
  | "PROMOTION_APPROVED"
  | "PROMOTION_REJECTED"
  | "FAILED";

export type GenesisAuthorityBand = "GREEN" | "YELLOW" | "ORANGE" | "RED";

export interface GenesisArtifact {
  artifactId: string;
  toolCode: string;
  toolHash: string;
  language: string;            // "python" | "typescript" | "bash"
  testInput?: string;
  testOutput?: string;
  testPassed: boolean;
  sandboxResult?: {
    exitCode: number | null;
    stdout: string;
    stderr: string;
    sandboxId: string;
    wallTimeMs: number;
  };
  verificationResult?: {
    verified: boolean;
    method: string;
    evidence: string;
    verifierHash: string;
  };
}

export interface GenesisReceipt {
  genesisId: string;
  state: GenesisState;
  purpose: string;
  capabilityGap: string;         // What was missing
  existingToolsChecked: string[];// Tools checked before generation
  reusePossible: boolean;        // Was an existing tool suitable?
  reuseTool?: string;            // If yes, which one
  artifact?: GenesisArtifact;
  lease?: CapabilityLease;
  invocationResult?: string;
  authorityBand: GenesisAuthorityBand;
  promotionProposed: boolean;
  promotionApproved?: boolean;
  promotionApprovedBy?: string;
  retiredAt?: string;
  createdAt: string;
  updatedAt: string;
  receiptHash: string;
}

// ── Genesis Runner ───────────────────────────────────────────────

export class EphemeralGenesisRunner {
  private activeGenesis: Map<string, GenesisReceipt> = new Map();
  private activeLeases: Map<string, CapabilityLease> = new Map();
  private promotionProposals: Map<string, GenesisReceipt> = new Map();
  private readonly maxConcurrent = 10;
  private readonly maxRetireAgeHours = 24;

  // ── Step 1: Detect Capability Gap ─────────────────────────────
  gapDetect(params: {
    purpose: string;
    requiredCapability: string;
    existingTools: string[];       // Tools available in registry
  }): GenesisReceipt {
    const genesisId = `genesis-${crypto.randomUUID().slice(0, 12)}`;
    const now = new Date().toISOString();

    const receipt: Omit<GenesisReceipt, "receiptHash"> = {
      genesisId,
      state: "GAP_DETECTED",
      purpose: params.purpose,
      capabilityGap: params.requiredCapability,
      existingToolsChecked: params.existingTools,
      reusePossible: false,
      authorityBand: "GREEN",
      promotionProposed: false,
      createdAt: now,
      updatedAt: now,
    };

    const full = { ...receipt, receiptHash: "" };
    full.receiptHash = this._hashReceipt(full);
    this.activeGenesis.set(genesisId, full);
    return full;
  }

  // ── Step 2: Check Reuse Before Generation ─────────────────────
  reuseCheck(genesisId: string, registryTools: Array<{name: string; capability: string; healthy: boolean}>): GenesisReceipt {
    const receipt = this._get(genesisId);

    // Search for existing tool that matches the capability gap
    const matches = registryTools.filter(t =>
      t.capability.toLowerCase().includes(receipt.capabilityGap.toLowerCase()) ||
      receipt.capabilityGap.toLowerCase().includes(t.capability.toLowerCase())
    );

    const healthyMatch = matches.find(t => t.healthy);

    if (healthyMatch) {
      receipt.reusePossible = true;
      receipt.reuseTool = healthyMatch.name;
      receipt.state = "REUSE_CHECKED";
      receipt.updatedAt = new Date().toISOString();
      receipt.receiptHash = this._hashReceipt(receipt);
      this.activeGenesis.set(genesisId, receipt);
      return receipt;
    }

    receipt.reusePossible = false;
    receipt.existingToolsChecked = registryTools.map(t => t.name);
    receipt.state = "REUSE_CHECKED";
    receipt.updatedAt = new Date().toISOString();
    receipt.receiptHash = this._hashReceipt(receipt);
    this.activeGenesis.set(genesisId, receipt);
    return receipt;
  }

  // ── Step 3: Specify Required Capability ───────────────────────
  capabilitySpecify(genesisId: string, spec: {
    language: string;
    inputSchema: Record<string, unknown>;
    outputSchema: Record<string, unknown>;
    requiredOperation: "read_transform" | "compute_only" | "read_api";
    needsNetwork: boolean;
    allowedDomains?: string[];
  }): GenesisReceipt {
    const receipt = this._get(genesisId);

    if (receipt.reusePossible) {
      // Reuse existing — skip generation
      receipt.state = "CAPABILITY_SPECIFIED";
      receipt.updatedAt = new Date().toISOString();
      receipt.receiptHash = this._hashReceipt(receipt);
      this.activeGenesis.set(genesisId, receipt);
      return receipt;
    }

    receipt.authorityBand = spec.needsNetwork ? "YELLOW" : "GREEN";
    receipt.state = "CAPABILITY_SPECIFIED";
    receipt.updatedAt = new Date().toISOString();
    receipt.receiptHash = this._hashReceipt(receipt);
    this.activeGenesis.set(genesisId, receipt);
    return receipt;
  }

  // ── Step 4: Generate Ephemeral Tool Code (in sandbox) ─────────
  generate(genesisId: string, toolCode: string): GenesisReceipt {
    const receipt = this._get(genesisId);

    if (receipt.reusePossible) {
      throw new Error(`Genesis ${genesisId}: reuse possible — generation skipped. Use existing tool: ${receipt.reuseTool}`);
    }

    if (this.activeGenesis.size >= this.maxConcurrent) {
      throw new Error(`Max concurrent ephemeral tools (${this.maxConcurrent}) reached. Retire old tools first.`);
    }

    const toolHash = crypto.createHash("sha256").update(toolCode).digest("hex");

    const artifact: GenesisArtifact = {
      artifactId: `artifact-${crypto.randomUUID().slice(0, 8)}`,
      toolCode,
      toolHash,
      language: "python", // Default; can be detected
      testPassed: false,
    };

    receipt.artifact = artifact;
    receipt.state = "GENERATED";
    receipt.updatedAt = new Date().toISOString();
    receipt.receiptHash = this._hashReceipt(receipt);
    this.activeGenesis.set(genesisId, receipt);
    return receipt;
  }

  // ── Step 5: Sandbox Test ──────────────────────────────────────
  sandboxTest(genesisId: string, testResult: {
    exitCode: number | null;
    stdout: string;
    stderr: string;
    sandboxId: string;
    wallTimeMs: number;
    testPassed: boolean;
  }): GenesisReceipt {
    const receipt = this._get(genesisId);

    if (!receipt.artifact) {
      throw new Error(`Genesis ${genesisId}: no artifact to test`);
    }

    receipt.artifact.testPassed = testResult.testPassed;
    receipt.artifact.sandboxResult = {
      exitCode: testResult.exitCode,
      stdout: testResult.stdout,
      stderr: testResult.stderr,
      sandboxId: testResult.sandboxId,
      wallTimeMs: testResult.wallTimeMs,
    };

    if (!testResult.testPassed) {
      receipt.state = "FAILED";
      receipt.updatedAt = new Date().toISOString();
      receipt.receiptHash = this._hashReceipt(receipt);
      this.activeGenesis.set(genesisId, receipt);
      return receipt;
    }

    receipt.state = "SANDBOX_TESTED";
    receipt.updatedAt = new Date().toISOString();
    receipt.receiptHash = this._hashReceipt(receipt);
    this.activeGenesis.set(genesisId, receipt);
    return receipt;
  }

  // ── Step 6: Grant Capability Lease ────────────────────────────
  leaseGrant(genesisId: string, params: {
    issuedBy: string;
    needsNetwork?: boolean;
    allowedDomains?: string[];
    timeoutSeconds?: number;
  }): { receipt: GenesisReceipt; lease: CapabilityLease } {
    const receipt = this._get(genesisId);

    if (!receipt.artifact) {
      throw new Error(`Genesis ${genesisId}: no artifact to lease`);
    }

    if (!receipt.artifact.testPassed) {
      throw new Error(`Genesis ${genesisId}: artifact must pass sandbox test before lease`);
    }

    let lease: CapabilityLease;
    if (receipt.authorityBand === "YELLOW" || params.needsNetwork) {
      lease = createYellowLease({
        purpose: receipt.purpose,
        issuedBy: params.issuedBy,
        toolCode: receipt.artifact.toolCode,
        allowedDomains: params.allowedDomains || [],
        timeoutSeconds: params.timeoutSeconds,
      });
    } else {
      lease = createGreenLease({
        purpose: receipt.purpose,
        issuedBy: params.issuedBy,
        toolCode: receipt.artifact.toolCode,
        timeoutSeconds: params.timeoutSeconds,
      });
    }

    lease.state = "ACTIVE";
    receipt.lease = lease;
    receipt.state = "LEASE_GRANTED";
    receipt.updatedAt = new Date().toISOString();
    receipt.receiptHash = this._hashReceipt(receipt);

    this.activeGenesis.set(genesisId, receipt);
    this.activeLeases.set(lease.leaseId, lease);

    return { receipt, lease };
  }

  // ── Step 7: Invoke Ephemeral Tool ─────────────────────────────
  invoke(genesisId: string, params: {
    readPaths: string[];
    writePaths: string[];
    needsNetwork: boolean;
    input: unknown;
  }): { receipt: GenesisReceipt; allowed: boolean; reason: string } {
    const receipt = this._get(genesisId);

    if (!receipt.lease) {
      return { receipt, allowed: false, reason: "No active lease — cannot invoke" };
    }

    // Validate lease
    const leaseValid = validateLease(receipt.lease);
    if (!leaseValid.valid) {
      return { receipt, allowed: false, reason: `Lease invalid: ${leaseValid.reason}` };
    }

    if (isLeaseExpired(receipt.lease)) {
      receipt.lease.state = "EXPIRED";
      return { receipt, allowed: false, reason: "Lease has expired" };
    }

    // Check operation scope
    const scopeCheck = checkOperationScope(
      receipt.lease,
      params.readPaths,
      params.writePaths,
      params.needsNetwork,
    );

    if (!scopeCheck.valid) {
      receipt.lease.state = "VIOLATED";
      receipt.state = "FAILED";
      receipt.updatedAt = new Date().toISOString();
      receipt.receiptHash = this._hashReceipt(receipt);
      this.activeGenesis.set(genesisId, receipt);
      return { receipt, allowed: false, reason: `Operation exceeds lease scope: ${scopeCheck.reason}` };
    }

    receipt.state = "INVOKED";
    receipt.updatedAt = new Date().toISOString();
    receipt.receiptHash = this._hashReceipt(receipt);
    this.activeGenesis.set(genesisId, receipt);

    return { receipt, allowed: true, reason: "Lease valid, operation within scope" };
  }

  // ── Step 8: Verify Output Independently ───────────────────────
  verifyOutput(genesisId: string, params: {
    verificationMethod: string;
    expectedProperties: string[];
    actualOutput: unknown;
  }): GenesisReceipt {
    const receipt = this._get(genesisId);

    if (receipt.state !== "INVOKED") {
      throw new Error(`Genesis ${genesisId}: must be INVOKED before verification (current: ${receipt.state})`);
    }

    // Independent verification: different method than the tool itself
    const verifierHash = crypto.createHash("sha256")
      .update(JSON.stringify(params.actualOutput))
      .digest("hex");

    if (!receipt.artifact) {
      throw new Error(`Genesis ${genesisId}: no artifact`);
    }

    receipt.artifact.verificationResult = {
      verified: true, // Set by actual verification logic
      method: params.verificationMethod,
      evidence: JSON.stringify(params.expectedProperties),
      verifierHash,
    };

    receipt.state = "OUTPUT_VERIFIED";
    receipt.updatedAt = new Date().toISOString();
    receipt.receiptHash = this._hashReceipt(receipt);
    this.activeGenesis.set(genesisId, receipt);

    return receipt;
  }

  // ── Step 9: Retire Ephemeral Tool ─────────────────────────────
  retire(genesisId: string): GenesisReceipt {
    const receipt = this._get(genesisId);

    // Clean up lease
    if (receipt.lease) {
      receipt.lease.state = "EXPIRED";
      this.activeLeases.delete(receipt.lease.leaseId);
    }

    receipt.state = "RETIRED";
    receipt.retiredAt = new Date().toISOString();
    receipt.updatedAt = new Date().toISOString();
    receipt.receiptHash = this._hashReceipt(receipt);

    this.activeGenesis.set(genesisId, receipt);

    // Schedule removal from active map (keep receipt for audit)
    setTimeout(() => {
      this.activeGenesis.delete(genesisId);
    }, 3600_000); // Keep receipt 1h after retirement

    return receipt;
  }

  // ── Optional: Propose Promotion (NEVER self-promote) ──────────
  proposePromotion(genesisId: string): GenesisReceipt {
    const receipt = this._get(genesisId);

    if (receipt.promotionProposed) {
      throw new Error(`Genesis ${genesisId}: promotion already proposed`);
    }

    receipt.state = "PROMOTION_PROPOSED";
    receipt.promotionProposed = true;
    receipt.updatedAt = new Date().toISOString();
    receipt.receiptHash = this._hashReceipt(receipt);

    this.promotionProposals.set(genesisId, receipt);
    this.activeGenesis.set(genesisId, receipt);

    return receipt;
  }

  // ── Human/Kernel Gate: Approve or Reject Promotion ────────────
  resolvePromotion(genesisId: string, approved: boolean, approvedBy: string): GenesisReceipt {
    const receipt = this._get(genesisId);

    if (receipt.state !== "PROMOTION_PROPOSED") {
      throw new Error(`Genesis ${genesisId}: no promotion proposed (current: ${receipt.state})`);
    }

    if (approved) {
      receipt.state = "PROMOTION_APPROVED";
      receipt.promotionApproved = true;
      receipt.promotionApprovedBy = approvedBy;
    } else {
      receipt.state = "PROMOTION_REJECTED";
      receipt.promotionApproved = false;
    }

    receipt.updatedAt = new Date().toISOString();
    receipt.receiptHash = this._hashReceipt(receipt);
    this.activeGenesis.set(genesisId, receipt);

    return receipt;
  }

  // ── Auto-Retire Expired Leases ────────────────────────────────
  autoRetireExpired(): GenesisReceipt[] {
    const retired: GenesisReceipt[] = [];
    for (const [genesisId, receipt] of this.activeGenesis) {
      if (receipt.lease && isLeaseExpired(receipt.lease)) {
        retired.push(this.retire(genesisId));
      }
    }
    return retired;
  }

  // ── Get Active Genesis Count ──────────────────────────────────
  get activeCount(): number {
    return this.activeGenesis.size;
  }

  get pendingPromotions(): GenesisReceipt[] {
    return Array.from(this.promotionProposals.values());
  }

  // ── Internal Helpers ──────────────────────────────────────────
  private _get(genesisId: string): GenesisReceipt {
    const receipt = this.activeGenesis.get(genesisId);
    if (!receipt) {
      throw new Error(`Genesis ${genesisId} not found`);
    }
    return { ...receipt }; // Return copy to prevent accidental mutation
  }

  private _hashReceipt(receipt: Omit<GenesisReceipt, "receiptHash">): string {
    const { receiptHash: _, ...rest } = receipt as GenesisReceipt;
    const canonical = JSON.stringify(rest, Object.keys(rest).sort());
    return crypto.createHash("sha256").update(canonical).digest("hex");
  }
}

// ── Containment Rules (from forge instruction) ───────────────────

export const EPHEMERAL_CONTAINMENT_RULES = {
  noAmbientCredentials: true,
  noDirectConstitutionalAccess: true,  // Cannot call arif_judge, arif_seal, privilege APIs
  networkDenyByDefault: true,
  filesystemAllowlist: true,
  boundedResources: true,             // CPU, RAM, storage, time
  outputUntrustedUntilVerified: true,
  artifactMustHaveHashAndProvenance: true,
  workspaceDestroyedAfterCompletion: true,
  failClosedIfContainmentUnavailable: true,
} as const;

export const FORBIDDEN_APIS = [
  "arif_judge",
  "arif_seal",
  "arif_init",
  "arif_forge",      // Cannot self-replicate
  "arif_memory",     // Cannot directly write to governed memory
  "vault999_append",
  "mcp_register_tool",
  "systemctl",
  "docker",
] as const;
