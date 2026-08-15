/**
 * amanah-auto-acquire.ts — Transparent lock interceptor for forge_filesystem
 *
 * F1 AMANAH Guard 2: Auto-invoke concurrency lock.
 * Instead of failing when no lock exists, auto-acquire one.
 * If another agent holds the lock → return 423 Locked (fail-closed).
 * If current session holds the lock → proceed.
 * Auto-release after write completes (only if we auto-acquired).
 *
 * Forged: 2026-08-15 by 333-AGI under F13 SOVEREIGN directive.
 * DITEMPA BUKAN DIBERI.
 */

import { AmanahLockManager } from "../../domain/governance/index.js";

export interface LockResult {
  ok: boolean;
  lock_id?: string;
  isAutoAcquired: boolean;
  error?: string;
  verdict?: string;
  holder?: {
    actor_id: string;
    lock_id: string;
    session_id: string;
  };
}

/**
 * Ensure an Amanah lock exists for the given resource.
 * - If no lock → auto-acquire with session context → return { ok: true, isAutoAcquired: true }
 * - If lock held by current session → return { ok: true, isAutoAcquired: false }
 * - If lock held by ANOTHER agent → return { ok: false, error: "423 Locked" }
 */
export async function ensureAmanahLock(
  resourceId: string,
  sessionId: string,
  actorId: string,
  justification: string,
  ttlMs: number = 300_000 // 5 min default
): Promise<LockResult> {
  const amanah = AmanahLockManager.getInstance();

  // 1. Check existing lock
  const existing = await amanah.getActiveLock(resourceId);

  if (existing) {
    // Lock exists — check ownership
    if (existing.session_id === sessionId) {
      // Current session already holds it — proceed
      return {
        ok: true,
        lock_id: existing.lock_id,
        isAutoAcquired: false,
      };
    }

    // Another agent holds it — 423 Locked
    return {
      ok: false,
      isAutoAcquired: false,
      error: `HTTP 423 Locked: Resource ${resourceId} is locked by ${existing.actor_id} (lock ${existing.lock_id}). Back off and retry.`,
      verdict: "888-HOLD",
      holder: {
        actor_id: existing.actor_id ?? "unknown",
        lock_id: existing.lock_id ?? "unknown",
        session_id: existing.session_id ?? "unknown",
      },
    };
  }

  // 2. No lock exists — auto-acquire
  const result = await amanah.acquireLock(
    resourceId,
    actorId || "auto-acquired",
    justification,
    sessionId,
    ttlMs
  );

  if (result.granted) {
    return {
      ok: true,
      lock_id: result.lock_id,
      isAutoAcquired: true,
    };
  }

  // Acquisition failed (race condition or DB error)
  return {
    ok: false,
    isAutoAcquired: false,
    error: `Lock acquisition failed: ${result.message}`,
    verdict: "888-HOLD",
  };
}

/**
 * Release an auto-acquired lock. No-op if lock wasn't auto-acquired.
 */
export async function releaseAutoLock(
  lockId: string,
  actorId: string,
  reason: string = "auto-release after write"
): Promise<void> {
  if (!lockId) return;
  const amanah = AmanahLockManager.getInstance();
  await amanah.releaseLock(lockId, actorId || "auto-acquired", reason);
}
