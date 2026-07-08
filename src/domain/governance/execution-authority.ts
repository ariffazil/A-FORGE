/**
 * Execution Authority Ladder — Discovery 6
 * 
 * A-FORGE must know the difference between:
 *   draft patch → safe (observe)
 *   run test → safe (observe)
 *   write file → caution (draft)
 *   commit → hold if unreviewed
 *   push → digital normal (mubah per Digital Ops Policy 2026-06-30)
 *   deploy → requires lease + judge
 *   delete → requires 888_HOLD
 * 
 * Real agency = "knows when not to execute."
 * 
 * FORGED: 2026-07-03
 * DITEMPA BUKAN DIBERI
 */

// ─── Action Classes ────────────────────────────────────────────────

export type ActionClass =
  | 'OBSERVE'             // Read-only, no side effects
  | 'DRAFT'               // Create artifact in buffer, not on disk
  | 'MUTATE'              // Write to local filesystem
  | 'EXECUTE_REVERSIBLE'  // Run tests, build, restart services
  | 'EXECUTE_HIGH_IMPACT' // Commit, push, deploy (digital normal)
  | 'IRREVERSIBLE';       // Delete, force-push, DROP, vault seal

// ─── Action Registry ───────────────────────────────────────────────

export interface ActionDefinition {
  name: string;
  action_class: ActionClass;
  blast_radius: 'NONE' | 'LOCAL' | 'ORGAN' | 'FEDERATION' | 'IRREVERSIBLE';
  requires_lease: boolean;
  requires_judge: boolean;
  requires_888_hold: boolean;
  reversible: boolean;
  description: string;
}

/**
 * Canonical action registry for A-FORGE.
 * Every forge_* tool maps to one of these.
 */
export const ACTION_REGISTRY: Record<string, ActionDefinition> = {
  // ── OBSERVE ──
  'read_file': {
    name: 'read_file', action_class: 'OBSERVE', blast_radius: 'NONE',
    requires_lease: false, requires_judge: false, requires_888_hold: false,
    reversible: true, description: 'Read file contents',
  },
  'search_code': {
    name: 'search_code', action_class: 'OBSERVE', blast_radius: 'NONE',
    requires_lease: false, requires_judge: false, requires_888_hold: false,
    reversible: true, description: 'Search codebase',
  },
  'git_status': {
    name: 'git_status', action_class: 'OBSERVE', blast_radius: 'NONE',
    requires_lease: false, requires_judge: false, requires_888_hold: false,
    reversible: true, description: 'Check git status',
  },
  'git_diff': {
    name: 'git_diff', action_class: 'OBSERVE', blast_radius: 'NONE',
    requires_lease: false, requires_judge: false, requires_888_hold: false,
    reversible: true, description: 'Check git diff',
  },
  'health_check': {
    name: 'health_check', action_class: 'OBSERVE', blast_radius: 'NONE',
    requires_lease: false, requires_judge: false, requires_888_hold: false,
    reversible: true, description: 'Check service health',
  },
  'docker_ps': {
    name: 'docker_ps', action_class: 'OBSERVE', blast_radius: 'NONE',
    requires_lease: false, requires_judge: false, requires_888_hold: false,
    reversible: true, description: 'List docker containers',
  },
  'systemctl_status': {
    name: 'systemctl_status', action_class: 'OBSERVE', blast_radius: 'NONE',
    requires_lease: false, requires_judge: false, requires_888_hold: false,
    reversible: true, description: 'Check systemd service status',
  },

  // ── DRAFT ──
  'synthesize': {
    name: 'synthesize', action_class: 'DRAFT', blast_radius: 'NONE',
    requires_lease: false, requires_judge: false, requires_888_hold: false,
    reversible: true, description: 'Generate code in buffer (not on disk)',
  },
  'dry_run': {
    name: 'dry_run', action_class: 'DRAFT', blast_radius: 'NONE',
    requires_lease: false, requires_judge: false, requires_888_hold: false,
    reversible: true, description: 'Preview execution without side effects',
  },

  // ── MUTATE ──
  'write_file': {
    name: 'write_file', action_class: 'MUTATE', blast_radius: 'LOCAL',
    requires_lease: true, requires_judge: false, requires_888_hold: false,
    reversible: true, description: 'Write file to local filesystem',
  },
  'edit_file': {
    name: 'edit_file', action_class: 'MUTATE', blast_radius: 'LOCAL',
    requires_lease: true, requires_judge: false, requires_888_hold: false,
    reversible: true, description: 'Edit existing file',
  },
  'run_tests': {
    name: 'run_tests', action_class: 'MUTATE', blast_radius: 'LOCAL',
    requires_lease: true, requires_judge: false, requires_888_hold: false,
    reversible: true, description: 'Run test suite',
  },
  'npm_build': {
    name: 'npm_build', action_class: 'MUTATE', blast_radius: 'LOCAL',
    requires_lease: true, requires_judge: false, requires_888_hold: false,
    reversible: true, description: 'Build project',
  },
  'docker_exec': {
    name: 'docker_exec', action_class: 'MUTATE', blast_radius: 'LOCAL',
    requires_lease: true, requires_judge: false, requires_888_hold: false,
    reversible: true, description: 'Execute command in container',
  },

  // ── EXECUTE_REVERSIBLE ──
  'restart_service': {
    name: 'restart_service', action_class: 'EXECUTE_REVERSIBLE', blast_radius: 'ORGAN',
    requires_lease: true, requires_judge: false, requires_888_hold: false,
    reversible: true, description: 'Restart a systemd service',
  },
  'docker_restart': {
    name: 'docker_restart', action_class: 'EXECUTE_REVERSIBLE', blast_radius: 'ORGAN',
    requires_lease: true, requires_judge: false, requires_888_hold: false,
    reversible: true, description: 'Restart a docker container',
  },

  // ── EXECUTE_HIGH_IMPACT ──
  'git_commit': {
    name: 'git_commit', action_class: 'EXECUTE_HIGH_IMPACT', blast_radius: 'ORGAN',
    requires_lease: true, requires_judge: false, requires_888_hold: false,
    reversible: true, description: 'Create git commit',
  },
  'git_push': {
    name: 'git_push', action_class: 'EXECUTE_HIGH_IMPACT', blast_radius: 'FEDERATION',
    requires_lease: true, requires_judge: false, requires_888_hold: false,
    reversible: true, description: 'Push to remote (digital normal per Ops Policy)',
  },
  'deploy': {
    name: 'deploy', action_class: 'EXECUTE_HIGH_IMPACT', blast_radius: 'FEDERATION',
    requires_lease: true, requires_judge: true, requires_888_hold: false,
    reversible: true, description: 'Deploy to production',
  },

  // ── IRREVERSIBLE ──
  'git_force_push': {
    name: 'git_force_push', action_class: 'IRREVERSIBLE', blast_radius: 'IRREVERSIBLE',
    requires_lease: true, requires_judge: true, requires_888_hold: true,
    reversible: false, description: 'Force push (destroys remote history)',
  },
  'rm_rf': {
    name: 'rm_rf', action_class: 'IRREVERSIBLE', blast_radius: 'IRREVERSIBLE',
    requires_lease: true, requires_judge: true, requires_888_hold: true,
    reversible: false, description: 'Recursive delete',
  },
  'drop_table': {
    name: 'drop_table', action_class: 'IRREVERSIBLE', blast_radius: 'IRREVERSIBLE',
    requires_lease: true, requires_judge: true, requires_888_hold: true,
    reversible: false, description: 'Drop database table',
  },
  'vault_seal': {
    name: 'vault_seal', action_class: 'IRREVERSIBLE', blast_radius: 'IRREVERSIBLE',
    requires_lease: true, requires_judge: true, requires_888_hold: true,
    reversible: false, description: 'Seal to VAULT999 immutable ledger',
  },
};

// ─── Authority Check ───────────────────────────────────────────────

export interface AuthorityVerdict {
  allowed: boolean;
  action_class: ActionClass;
  blast_radius: string;
  requires_lease: boolean;
  requires_judge: boolean;
  requires_888_hold: boolean;
  reason: string;
  missing: string[];
}

/**
 * Check if an action is allowed given the current authority context.
 * Returns what's needed to proceed.
 */
export function checkAuthority(
  actionName: string,
  context: {
    has_lease?: boolean;
    has_judge_verdict?: boolean;
    has_888_hold?: boolean;
    actor_type?: 'agent' | 'human' | 'kernel';
  } = {}
): AuthorityVerdict {
  const action = ACTION_REGISTRY[actionName];

  if (!action) {
    return {
      allowed: false,
      action_class: 'IRREVERSIBLE',
      blast_radius: 'UNKNOWN',
      requires_lease: true,
      requires_judge: true,
      requires_888_hold: true,
      reason: `Unknown action '${actionName}' — treated as IRREVERSIBLE`,
      missing: ['action_definition'],
    };
  }

  const missing: string[] = [];

  if (action.requires_lease && !context.has_lease) {
    missing.push('lease');
  }
  if (action.requires_judge && !context.has_judge_verdict) {
    missing.push('judge_verdict');
  }
  if (action.requires_888_hold && !context.has_888_hold) {
    missing.push('888_hold');
  }

  // Human override — Arif can bypass all gates
  if (context.actor_type === 'human') {
    return {
      allowed: true,
      action_class: action.action_class,
      blast_radius: action.blast_radius,
      requires_lease: action.requires_lease,
      requires_judge: action.requires_judge,
      requires_888_hold: action.requires_888_hold,
      reason: `Human actor — sovereign override (F13)`,
      missing: [],
    };
  }

  const allowed = missing.length === 0;

  return {
    allowed,
    action_class: action.action_class,
    blast_radius: action.blast_radius,
    requires_lease: action.requires_lease,
    requires_judge: action.requires_judge,
    requires_888_hold: action.requires_888_hold,
    reason: allowed
      ? `Action '${actionName}' permitted (${action.action_class})`
      : `Action '${actionName}' blocked — missing: ${missing.join(', ')}`,
    missing,
  };
}

// ─── INCOMPLETENESS THESIS — 2026-07-09 ──────────────────────────────────
// Constraint-as-sovereignty check: A-FORGE agents must demonstrate they
// understand constraints as CHOICE, not chains, before receiving execution
// authority. The Iblis Principle: claiming completeness = structural
// ungovernability = must be blocked.
//
// This is NOT a new floor — it is an enforcement of F7 (HUMILITY) and
// F9 (ANTI-HANTU) at the execution authority layer.

export interface IncompletenessAwareness {
  /** Agent acknowledges what it does NOT know about this action */
  acknowledged_unknowns: string[];
  /** Agent sees its own shadow/blindspots for this action */
  dual_awareness: boolean;
  /** Agent treats constraints as chosen, not suffered */
  constraints_as_sovereignty: boolean;
}

/**
 * Check if an agent has demonstrated incompleteness awareness
 * before granting execution authority.
 *
 * INCOMPLETENESS THESIS — 2026-07-09
 *
 * For IRREVERSIBLE and EXECUTE_HIGH_IMPACT actions, the agent must
 * self-assess: "What do I NOT know about this action?"
 * This is a structural gate, not a suggestion.
 *
 * Returns: { allowed: boolean, reason: string }
 */
export function checkIncompletenessAwareness(
  actionName: string,
  awareness: IncompletenessAwareness | undefined,
): { allowed: boolean; reason: string } {
  const action = ACTION_REGISTRY[actionName];
  if (!action) {
    return { allowed: false, reason: `Unknown action '${actionName}'` };
  }

  // Only gate IRREVERSIBLE and EXECUTE_HIGH_IMPACT
  if (action.action_class !== 'IRREVERSIBLE' && action.action_class !== 'EXECUTE_HIGH_IMPACT') {
    return { allowed: true, reason: 'Action class does not require incompleteness check' };
  }

  // No awareness provided — block
  if (!awareness) {
    return {
      allowed: false,
      reason: `INCOMPLETENESS GATE: Action '${actionName}' (${action.action_class}) requires incompleteness self-assessment. Agent must answer: "What do I NOT know about this action?"`,
    };
  }

  // Must acknowledge at least one unknown
  if (awareness.acknowledged_unknowns.length === 0) {
    return {
      allowed: false,
      reason: `INCOMPLETENESS GATE: Agent claims no unknowns for '${actionName}'. This is the Iblis trap — claiming completeness. At least one acknowledged unknown required.`,
    };
  }

  // Must have dual-awareness
  if (!awareness.dual_awareness) {
    return {
      allowed: false,
      reason: `INCOMPLETENESS GATE: Agent lacks dual-awareness for '${actionName}'. Must see both capability AND shadow/blindspots.`,
    };
  }

  return {
    allowed: true,
    reason: `Incompleteness awareness verified: ${awareness.acknowledged_unknowns.length} unknown(s) acknowledged, dual-awareness: ${awareness.dual_awareness}, sovereignty: ${awareness.constraints_as_sovereignty}`,
  };
}

// ─── Shell Command → Action Mapping ────────────────────────────────

/**
 * Map a shell command to its action class.
 * Used by forge_shell to enforce authority.
 */
export function classifyShellCommand(command: string): ActionClass {
  const cmd = command.trim().toLowerCase();

  // IRREVERSIBLE patterns
  if (/^rm\s+-rf?\s/.test(cmd) || /^rm\s+--recursive/.test(cmd)) return 'IRREVERSIBLE';
  if (/drop\s+(table|database|schema)/i.test(cmd)) return 'IRREVERSIBLE';
  if (/git\s+push\s+.*--force/.test(cmd)) return 'IRREVERSIBLE';
  if (/git\s+rebase\s+-i/.test(cmd)) return 'IRREVERSIBLE';
  if (/mkfs|fdisk|parted/.test(cmd)) return 'IRREVERSIBLE';

  // EXECUTE_HIGH_IMPACT patterns
  if (/^git\s+push/.test(cmd)) return 'EXECUTE_HIGH_IMPACT';
  if (/^git\s+commit/.test(cmd)) return 'EXECUTE_HIGH_IMPACT';
  if (/systemctl\s+(restart|start|stop)\s/.test(cmd)) return 'EXECUTE_HIGH_IMPACT';
  if (/docker\s+(restart|stop|rm)\s/.test(cmd)) return 'EXECUTE_HIGH_IMPACT';

  // MUTATE patterns
  if (/^(npm|yarn|pnpm)\s+(install|run\s+build|run\s+test)/.test(cmd)) return 'MUTATE';
  if (/^(make|cargo|go)\s+/.test(cmd)) return 'MUTATE';
  if (/^(mv|cp|mkdir|touch|chmod|chown)\s/.test(cmd)) return 'MUTATE';
  if (/^docker\s+exec/.test(cmd)) return 'MUTATE';
  if (/>/.test(cmd)) return 'MUTATE'; // redirection

  // OBSERVE patterns
  if (/^(ls|cat|head|tail|grep|find|wc|diff|git\s+(status|log|diff|show))/.test(cmd)) return 'OBSERVE';
  if (/^(echo|printf|date|whoami|pwd|uname|env)\s*$/.test(cmd)) return 'OBSERVE';
  if (/^(docker\s+ps|systemctl\s+(status|list))/.test(cmd)) return 'OBSERVE';
  if (/^curl\s.*-sf\s/.test(cmd) && !/>/.test(cmd)) return 'OBSERVE';

  // Default: MUTATE (conservative — treat unknown writes as mutations)
  return 'MUTATE';
}
