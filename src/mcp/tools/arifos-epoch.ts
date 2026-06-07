/**
 * arifos_epoch_* — INTERNAL MCP tools for W3 Epoch Architecture.
 *
 * Six internal tools (arifos_ prefix; NOT in public 13):
 *   - arifos_epoch_create    : create epoch from plan
 *   - arifos_epoch_start     : CREATED → ACTIVE
 *   - arifos_epoch_complete  : ACTIVE → COMPLETED
 *   - arifos_epoch_suspend   : ACTIVE → SUSPENDED
 *   - arifos_epoch_resume    : SUSPENDED → ACTIVE
 *   - arifos_epoch_abort     : any → ABORTED (F13 only)
 *   - arifos_epoch_status    : query epoch state
 *   - arifos_epoch_replay    : reconstruct epoch from event log (W11 helper)
 *
 * Activation: F13 sovereign approval required to register with live FastMCP
 * + add list_tools filter + service reload.
 *
 * Naming convention (F4 CLARITY):
 *   - External MCP tools: arif_*
 *   - Internal federation tools: arifos_*
 *
 * @constitutional F1 Amanah — internal tool, never exposed externally
 */

import { EpochEngine, EpochError, EpochF1Error, EpochF13Error, EpochStateError } from "../../governance/epochEngine.js";
import type { Epoch, EpochEvent } from "../../types/epoch.js";
import type { Plan } from "../../types/plan.js";

// Singleton engine — lazy
let _engine: EpochEngine | null = null;
function getEngine(): EpochEngine {
  if (_engine === null) _engine = new EpochEngine();
  return _engine;
}

// ─── Tool entry points ──────────────────────────────────────────────────

export function arifos_epoch_create(
  plan: Plan,
  created_by: string,
  options: { name?: string; parent_epoch_id?: string } = {}
): { ok: true; epoch: Epoch } | { ok: false; code: string; reason: string } {
  try {
    const epoch = getEngine().create(plan, { created_by, ...options });
    return { ok: true, epoch };
  } catch (e) {
    if (e instanceof EpochF1Error) {
      return { ok: false, code: e.code, reason: e.message };
    }
    return { ok: false, code: "EPOCH_CREATE_FAILED", reason: (e as Error).message };
  }
}

export function arifos_epoch_start(epoch: Epoch, actor_id: string): { ok: true; epoch: Epoch } | { ok: false; code: string; reason: string } {
  try {
    const next = getEngine().start(epoch, actor_id);
    return { ok: true, epoch: next };
  } catch (e) {
    if (e instanceof EpochError) {
      return { ok: false, code: e.code, reason: e.message };
    }
    return { ok: false, code: "EPOCH_START_FAILED", reason: (e as Error).message };
  }
}

export function arifos_epoch_complete(epoch: Epoch, actor_id: string): { ok: true; epoch: Epoch } | { ok: false; code: string; reason: string } {
  try {
    const next = getEngine().complete(epoch, actor_id);
    return { ok: true, epoch: next };
  } catch (e) {
    if (e instanceof EpochError) {
      return { ok: false, code: e.code, reason: e.message };
    }
    return { ok: false, code: "EPOCH_COMPLETE_FAILED", reason: (e as Error).message };
  }
}

export function arifos_epoch_suspend(epoch: Epoch, reason: string, actor_id: string): { ok: true; epoch: Epoch } | { ok: false; code: string; reason: string } {
  try {
    const next = getEngine().suspend(epoch, reason, actor_id);
    return { ok: true, epoch: next };
  } catch (e) {
    if (e instanceof EpochError) {
      return { ok: false, code: e.code, reason: e.message };
    }
    return { ok: false, code: "EPOCH_SUSPEND_FAILED", reason: (e as Error).message };
  }
}

export function arifos_epoch_resume(epoch: Epoch, actor_id: string): { ok: true; epoch: Epoch } | { ok: false; code: string; reason: string } {
  try {
    const next = getEngine().resume(epoch, actor_id);
    return { ok: true, epoch: next };
  } catch (e) {
    if (e instanceof EpochError) {
      return { ok: false, code: e.code, reason: e.message };
    }
    return { ok: false, code: "EPOCH_RESUME_FAILED", reason: (e as Error).message };
  }
}

/** F13 SOVEREIGN only. */
export function arifos_epoch_abort(epoch: Epoch, reason: string, actor_id: string): { ok: true; epoch: Epoch } | { ok: false; code: string; reason: string } {
  try {
    const next = getEngine().abort(epoch, reason, actor_id);
    return { ok: true, epoch: next };
  } catch (e) {
    if (e instanceof EpochF13Error || e instanceof EpochStateError || e instanceof EpochError) {
      return { ok: false, code: e.code, reason: e.message };
    }
    return { ok: false, code: "EPOCH_ABORT_FAILED", reason: (e as Error).message };
  }
}

export function arifos_epoch_status(epoch: Epoch): { ok: true; state_summary: Record<string, unknown> } {
  return {
    ok: true,
    state_summary: {
      epoch_id: epoch.epoch_id,
      state: epoch.state,
      created_at: epoch.created_at,
      started_at: epoch.started_at,
      completed_at: epoch.completed_at,
      remaining_seconds: epoch.remaining_seconds,
      f13_halt_active: epoch.f13_halt_active,
      event_count: epoch.events.length,
      checkpoint_count: epoch.checkpoints.length,
      latest_event_hash: epoch.latest_event_hash,
    },
  };
}

/** W11 Temporal helper — reconstruct epoch from event log. */
export function arifos_epoch_replay(
  events: EpochEvent[],
  epoch_id: string,
  plan_id: string,
  mission_id: string,
  outcome_spec_id: string
): { ok: true; epoch: Epoch } | { ok: false; code: string; reason: string } {
  try {
    const epoch = getEngine().replay(events, epoch_id, plan_id, mission_id, outcome_spec_id);
    return { ok: true, epoch };
  } catch (e) {
    if (e instanceof EpochError) {
      return { ok: false, code: e.code, reason: e.message };
    }
    return { ok: false, code: "EPOCH_REPLAY_FAILED", reason: (e as Error).message };
  }
}
