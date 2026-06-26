/**
 * INFRA TOOL: systemctl_wrapper.ts
 * ================================
 * Forged: 2026-06-14 by FORGE (000Ω)
 * Target: A-FORGE src/infrastructure/tools/infra/
 * Status: STUB — read operations implemented, write operations stubbed with E7 gating
 * 
 * Spec reference: /root/forge_work/2026-06-14/INFRA_TOOL_WRAPPERS_SPEC.md
 * 
 * Risk bands:
 *   systemctl.status    → OBSERVE, FULL_AUTO
 *   systemctl.isActive  → OBSERVE, FULL_AUTO
 *   systemctl.listUnits → OBSERVE, FULL_AUTO
 *   systemctl.start     → MUTATE, APPROVE_ONLY
 *   systemctl.restart   → ATOMIC, HUMAN_ONLY
 *   systemctl.stop      → ATOMIC, HUMAN_ONLY
 */

import {
  assertSystemdUnitName,
  assertSystemdUnitPattern,
  execFileAsync,
  requireMutationApproval,
} from "./safety.js";

// ─── TYPES ────────────────────────────────────────────────────────

export interface ServiceStatus {
  name: string;
  active: boolean;
  enabled: boolean;
  status: string;
  description: string;
  loaded: boolean;
  pid?: number;
  memory?: string;
}

export interface UnitInfo {
  name: string;
  active: boolean;
  status: string;
  description: string;
}

export interface ActionResult {
  success: boolean;
  service: string;
  action: string;
  output: string;
  error?: string;
  riskBand: string;
  gated: boolean;  // true if required 888_HOLD approval
}

// ─── TOOL RISK REGISTRY ───────────────────────────────────────────

const TOOL_RISK: Record<string, { actionClass: string; riskBand: string; gated: boolean }> = {
  'systemctl.status':    { actionClass: 'OBSERVE', riskBand: 'FULL_AUTO',    gated: false },
  'systemctl.isActive':  { actionClass: 'OBSERVE', riskBand: 'FULL_AUTO',    gated: false },
  'systemctl.listUnits': { actionClass: 'OBSERVE', riskBand: 'FULL_AUTO',    gated: false },
  'systemctl.start':     { actionClass: 'MUTATE',  riskBand: 'APPROVE_ONLY', gated: true },
  'systemctl.restart':   { actionClass: 'ATOMIC',  riskBand: 'HUMAN_ONLY',   gated: true },
  'systemctl.stop':      { actionClass: 'ATOMIC',  riskBand: 'HUMAN_ONLY',   gated: true },
};

// ─── READ OPERATIONS (FULL_AUTO — safe) ────────────────────────────

/**
 * Check a service's active status.
 * Risk: OBSERVE — FULL_AUTO. No mutation.
 */
export async function status(service: string): Promise<ServiceStatus> {
  const unit = assertSystemdUnitName(service);
  try {
    const { stdout } = await execFileAsync("systemctl", ["show", unit, "--no-page"], {
      encoding: "utf8",
      timeout: 10000,
    });
    const props: Record<string, string> = {};
    stdout.split('\n').forEach(line => {
      const [key, ...rest] = line.split('=');
      if (key) props[key] = rest.join('=');
    });

    return {
      name: unit,
      active: props.ActiveState === 'active',
      enabled: props.UnitFileState === 'enabled',
      status: props.ActiveState || 'unknown',
      description: props.Description || '',
      loaded: props.LoadState === 'loaded',
      pid: props.MainPID ? parseInt(props.MainPID) : undefined,
      memory: props.MemoryCurrent || undefined,
    };
  } catch (err: any) {
    return {
      name: unit,
      active: false,
      enabled: false,
      status: 'not-found',
      description: `Service not found: ${err.message}`,
      loaded: false,
    };
  }
}

/**
 * Quick active check. Returns boolean.
 * Risk: OBSERVE — FULL_AUTO.
 */
export async function isActive(service: string): Promise<boolean> {
  const unit = assertSystemdUnitName(service);
  try {
    await execFileAsync("systemctl", ["is-active", "--quiet", unit], { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * List systemd units, optionally filtered.
 * Risk: OBSERVE — FULL_AUTO.
 */
export async function listUnits(filter?: string): Promise<UnitInfo[]> {
  try {
    const args = ["list-units", "--all", "--no-legend"];
    if (filter) args.push(assertSystemdUnitPattern(filter));
    const { stdout } = await execFileAsync("systemctl", args, {
      encoding: "utf8",
      timeout: 10000,
    });

    return stdout.trim().split('\n').map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        name: parts[0] || 'unknown',
        active: parts[3] === 'active',
        status: parts[3] || 'unknown',
        description: parts.slice(4).join(' ') || '',
      };
    });
  } catch {
    return [];
  }
}

// ─── WRITE OPERATIONS (GATED — requires kernel lease) ─────────────

/**
 * Start a service.
 * Risk: MUTATE — APPROVE_ONLY. Requires kernel-issued lease.
 * 
 * @param ackImpact - Must be true. Caller acknowledges blast radius.
 */
export async function start(
  service: string,
  ackImpact: boolean,
  lease_id?: string,
): Promise<ActionResult> {
  const unit = assertSystemdUnitName(service);
  if (!ackImpact) {
    return {
      success: false,
      service: unit,
      action: 'start',
      output: '',
      error: 'Impact not acknowledged. Set ackImpact=true to proceed.',
      riskBand: TOOL_RISK['systemctl.start'].riskBand,
      gated: true,
    };
  }

  const gate = await requireMutationApproval('systemctl.start', unit, lease_id);
  if (!gate.allowed) {
    return {
      success: false,
      service: unit,
      action: 'start',
      output: '',
      error: gate.error,
      riskBand: TOOL_RISK['systemctl.start'].riskBand,
      gated: true,
    };
  }

  return {
    success: false,
    service: unit,
    action: 'start',
    output: '',
    error: '888_HOLD: systemctl.start execution is disabled until the E7 lease executor is wired.',
    riskBand: TOOL_RISK['systemctl.start'].riskBand,
    gated: true,
  };
}

/**
 * Restart a service.
 * Risk: ATOMIC — HUMAN_ONLY. ALWAYS requires 888_HOLD. 
 * Cannot be called by agents — Arif must explicitly approve.
 */
export async function restart(service: string): Promise<ActionResult> {
  const unit = assertSystemdUnitName(service);
  // STUB: This operation requires F13 SOVEREIGN approval.
  // In the real implementation, this function is wrapped by the E7 gate
  // which checks the caller's lease and action_class before allowing execution.
  return {
    success: false,
    service: unit,
    action: 'restart',
    output: '',
    error: 'ATOMIC operation: requires 888_HOLD + F13 SOVEREIGN approval',
    riskBand: 'HUMAN_ONLY',
    gated: true,
  };
}

/**
 * Stop a service.
 * Risk: ATOMIC — HUMAN_ONLY. ALWAYS requires 888_HOLD.
 */
export async function stop(service: string): Promise<ActionResult> {
  const unit = assertSystemdUnitName(service);
  return {
    success: false,
    service: unit,
    action: 'stop',
    output: '',
    error: 'ATOMIC operation: requires 888_HOLD + F13 SOVEREIGN approval',
    riskBand: 'HUMAN_ONLY',
    gated: true,
  };
}

// ─── EXPORT ───────────────────────────────────────────────────────

export const systemctlWrapper = {
  // READ — safe, autonomous
  status,
  isActive,
  listUnits,

  // WRITE — gated
  start,
  restart,
  stop,

  // Risk registry
  riskRegistry: TOOL_RISK,
};

export default systemctlWrapper;
