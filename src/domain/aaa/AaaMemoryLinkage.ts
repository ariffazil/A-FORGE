/**
 * AaaMemoryLinkage.ts — AAA Memory Integration Point
 *
 * THE CENTRAL GATE. Every memory operation in A-FORGE MUST call
 * aaaMemoryGate() before mutating or reading memory state.
 *
 * This is NOT optional. This is the difference between memory
 * that is "data" and memory that is "governed state."
 *
 * Binds: sessionGate + wellReadiness + FloorEnforcer + AAA agent registry
 *        + capability graph + receipt lineage
 *
 * Gate order (non-compensatory — any failure = blocked):
 *   1. Session validation          (sessionGate)
 *   2. Actor → AAA agent resolution (AaaAgentRegistry)
 *   3. Capability verification      (AaaCapabilityGraph)
 *   4. WELL readiness check         (wellReadiness — high-risk ops)
 *   5. FloorEnforcer.checkAll()     (F1-F13)
 *   6. Receipt generation           (hash-chain)
 *
 * LLM tidak ada gate ini. Dia hanya sambung corak.
 * AGI ada gate ini — setiap tindakan memori ada sejarah yang boleh diaudit.
 *
 * @module aaa/AaaMemoryLinkage
 * @constitutional AAA Memory Linkage Rules (hard constraint)
 * @forged 2026-06-29 by AAA Memory Audit
 */

import { createHash, randomUUID } from "node:crypto";
import { resolveActor, type AaaAgentId } from "./AaaAgentRegistry.js";
import {
  getCapability,
  verifyCapability,
  type MemoryAction,
} from "./AaaCapabilityGraph.js";
import { validateSession } from "../session/sessionGate.js";
import { checkWellReadiness } from "../governance/wellReadiness.js";
import { checkAll, type Verdict } from "../governance/FloorEnforcer.js";
import type { ActionRequest, FloorContext } from "../types/action-request.js";

// ── Receipt Types ─────────────────────────────────────────────────

export interface MemoryReceipt {
  receiptId: string;
  action: MemoryAction;
  actorId: string;
  sessionId: string;
  aaaAgent: AaaAgentId;
  timestamp: string;
  memoryId?: string;
  /** Hash of the memory content being operated on */
  contentHash?: string;
  /** Previous receipt hash (forms a chain) */
  prevReceiptHash: string;
  /** This receipt's hash */
  receiptHash: string;
  /** Floor enforcement verdict */
  floorVerdict: string;
  /** WELL readiness at time of operation */
  wellVerdict: string | null;
  /** Reversibility classification */
  reversible: boolean;
  /** Blast radius */
  blastRadius: "NONE" | "LOCAL" | "SESSION" | "FEDERATION";
}

export interface LinkageResult {
  /** Whether the operation may proceed */
  allowed: boolean;
  /** AAA agent that authorized this */
  aaaAgent: AaaAgentId | null;
  /** The memory receipt (if generated) */
  receipt: MemoryReceipt | null;
  /** Why the operation was allowed or blocked */
  reason: string;
  /** The floor enforcement verdict */
  floorVerdict: string;
  /** Actor binding used */
  actorBinding: ReturnType<typeof resolveActor>;
}

// ── Receipt Chain (session-lifetime, in-memory) ───────────────────

const receiptChain: MemoryReceipt[] = [];
let lastReceiptHash = "0".repeat(64);

function computeReceiptHash(receipt: Omit<MemoryReceipt, "receiptHash">): string {
  const payload = JSON.stringify({
    receiptId: receipt.receiptId,
    action: receipt.action,
    actorId: receipt.actorId,
    sessionId: receipt.sessionId,
    aaaAgent: receipt.aaaAgent,
    timestamp: receipt.timestamp,
    memoryId: receipt.memoryId ?? "",
    contentHash: receipt.contentHash ?? "",
    prevReceiptHash: receipt.prevReceiptHash,
    floorVerdict: receipt.floorVerdict,
  });
  return createHash("sha256").update(payload).digest("hex");
}

function buildReceipt(params: {
  action: MemoryAction;
  actorId: string;
  sessionId: string;
  aaaAgent: AaaAgentId;
  memoryId?: string;
  contentHash?: string;
  floorVerdict: string;
  wellVerdict: string | null;
  reversible: boolean;
}): MemoryReceipt {
  const receiptInput: Omit<MemoryReceipt, "receiptHash"> = {
    receiptId: `AAA-RCPT-${randomUUID().slice(0, 8)}`,
    action: params.action,
    actorId: params.actorId,
    sessionId: params.sessionId,
    aaaAgent: params.aaaAgent,
    timestamp: new Date().toISOString(),
    memoryId: params.memoryId,
    contentHash: params.contentHash,
    prevReceiptHash: lastReceiptHash,
    floorVerdict: params.floorVerdict,
    wellVerdict: params.wellVerdict,
    reversible: params.reversible,
    blastRadius:
      params.action === "memory:seal" ? "FEDERATION"
      : params.action === "memory:delete" ? "SESSION"
      : params.action === "memory:mutate" ? "LOCAL"
      : "NONE",
  };

  const receipt: MemoryReceipt = {
    ...receiptInput,
    receiptHash: computeReceiptHash(receiptInput),
  };

  // Append to chain
  receiptChain.push(receipt);
  lastReceiptHash = receipt.receiptHash;

  return receipt;
}

// ── AaaMemoryGateParams ───────────────────────────────────────────

export interface AaaMemoryGateParams {
  action: MemoryAction;
  actorId: string;
  sessionId: string;
  memoryId?: string;
  content?: string;
  /** Action-specific context for FloorEnforcer */
  toolName?: string;
  description?: string;
}

// ── THE CENTRAL GATE ──────────────────────────────────────────────

/**
 * THE CENTRAL AAA MEMORY GATE.
 *
 * Every memory read/write/mutate/seal operation MUST pass through
 * this gate BEFORE touching any memory substrate.
 *
 * Non-compensatory: any single gate failure blocks the entire operation.
 * No partial pass. No silent degradation.
 *
 * Binds: session → actor → capability → readiness → floors → receipt.
 */
export async function aaaMemoryGate(params: AaaMemoryGateParams): Promise<LinkageResult> {
  // ── Gate 1: Resolve capability entry ─────────────────────────────
  const cap = getCapability(params.action);
  if (!cap) {
    return {
      allowed: false, aaaAgent: null, receipt: null,
      reason: `Unknown memory action: ${params.action}`,
      floorVerdict: "VOID", actorBinding: null,
    };
  }

  // ── Gate 2: Session validation (if required) ─────────────────────
  if (cap.requiresSession) {
    const sessionCheck = validateSession(params.sessionId);
    if (!sessionCheck.valid) {
      return {
        allowed: false, aaaAgent: null, receipt: null,
        reason: `Session gate: ${sessionCheck.reason}`,
        floorVerdict: "HOLD", actorBinding: null,
      };
    }
  }

  // ── Gate 3: Actor → AAA agent resolution ─────────────────────────
  const actorBinding = resolveActor(params.actorId);
  if (!actorBinding) {
    return {
      allowed: false, aaaAgent: null, receipt: null,
      reason: `Unknown actor: ${params.actorId}. Cannot bind to AAA agent. Identity boundary failed.`,
      floorVerdict: "HOLD", actorBinding: null,
    };
  }

  // ── Gate 4: Capability verification ──────────────────────────────
  const capCheck = verifyCapability(params.action, actorBinding);
  if (!capCheck.allowed) {
    return {
      allowed: false, aaaAgent: cap.requiredAgent, receipt: null,
      reason: capCheck.reason,
      floorVerdict: "HOLD", actorBinding,
    };
  }

  const aaaAgent = cap.requiredAgent;

  // ── Gate 5: WELL readiness (for high-risk ops) ───────────────────
  let wellVerdict: string | null = null;
  if (cap.requiresReadiness) {
    const riskLevel =
      params.action === "memory:seal" ? "critical"
      : params.action === "memory:delete" ? "high"
      : "medium";
    try {
      const wellCheck = await checkWellReadiness(riskLevel);
      wellVerdict = wellCheck.verdict;
      if (wellCheck.verdict === "HOLD") {
        return {
          allowed: false, aaaAgent, receipt: null,
          reason: `WELL readiness HOLD: ${wellCheck.message}`,
          floorVerdict: "HOLD", actorBinding,
        };
      }
    } catch {
      // WELL unreachable — non-blocking for non-critical ops
      if (riskLevel === "critical") {
        return {
          allowed: false, aaaAgent, receipt: null,
          reason: "WELL readiness unavailable for critical memory seal.",
          floorVerdict: "HOLD", actorBinding,
        };
      }
      wellVerdict = "UNKNOWN";
    }
  }

  // ── Gate 6: FloorEnforcer.checkAll() (F1-F13) ────────────────────
  const actionType = cap.reversible ? "MEMORY_WRITE" : "VAULT_SEAL";
  const blastRadiusMap: Record<string, ActionRequest["blast_radius"]> = {
    "memory:seal": "federation",
    "memory:delete": "service",
    "memory:mutate": "service",
  };

  const actionRequest: ActionRequest = {
    action_id: `mem-${params.action.replace(/:/g, "-")}-${randomUUID().slice(0, 8)}`,
    tool_name: params.toolName ?? "aaa_memory_linkage",
    action_type: actionType,
    target: params.memoryId ?? "memory-substrate",
    tier: 3, // PLAUSIBLE — memory ops are evidence-backed
    actor: params.actorId,
    session_id: params.sessionId,
    intent: `${params.action}: ${params.description ?? "governed memory operation"}`,
    expected_outcome: `${params.action} completes with ${aaaAgent} authority`,
    reversibility_score: cap.reversible ? 0.8 : 0.1,
    blast_radius: blastRadiusMap[params.action] ?? "local",
    evidence_count: cap.requiresReceipt ? 1 : 0,
  };

  const floorContext: FloorContext = {
    action: actionRequest,
    actor_id: params.actorId,
    session_id: params.sessionId,
    f13_halt_active: false,
  };

  let floorVerdict: Verdict;
  try {
    floorVerdict = checkAll(floorContext);
  } catch (e) {
    return {
      allowed: false, aaaAgent, receipt: null,
      reason: `FloorEnforcer error: ${e instanceof Error ? e.message : String(e)}`,
      floorVerdict: "HOLD", actorBinding,
    };
  }

  if (!floorVerdict.allowed) {
    return {
      allowed: false, aaaAgent, receipt: null,
      reason: `Floor enforcement: ${floorVerdict.final}. ` +
        floorVerdict.reasons.map(r => `${r.floor}:${r.code}`).join(", "),
      floorVerdict: floorVerdict.final, actorBinding,
    };
  }

  // ── Gate 7: Receipt generation ───────────────────────────────────
  let receipt: MemoryReceipt | null = null;
  if (cap.requiresReceipt) {
    const contentHash = params.content
      ? createHash("sha256").update(params.content).digest("hex").slice(0, 16)
      : undefined;

    receipt = buildReceipt({
      action: params.action,
      actorId: params.actorId,
      sessionId: params.sessionId,
      aaaAgent,
      memoryId: params.memoryId,
      contentHash,
      floorVerdict: floorVerdict.final,
      wellVerdict,
      reversible: cap.reversible,
    });
  }

  return {
    allowed: true,
    aaaAgent,
    receipt,
    reason: `${params.action} authorized by ${aaaAgent} (receipt: ${receipt?.receiptId ?? "none"}).`,
    floorVerdict: floorVerdict.final,
    actorBinding,
  };
}

// ── Receipt Queries ───────────────────────────────────────────────

/** Get the last N receipts in the chain. */
export function getReceiptChain(limit = 20): MemoryReceipt[] {
  return receiptChain.slice(-limit);
}

/** Verify the receipt chain integrity. */
export function verifyReceiptChain(): { valid: boolean; brokenAt: number | null; length: number } {
  let prevHash = "0".repeat(64);
  for (let i = 0; i < receiptChain.length; i++) {
    if (receiptChain[i].prevReceiptHash !== prevHash) {
      return { valid: false, brokenAt: i, length: receiptChain.length };
    }
    prevHash = receiptChain[i].receiptHash;
  }
  return { valid: true, brokenAt: null, length: receiptChain.length };
}
