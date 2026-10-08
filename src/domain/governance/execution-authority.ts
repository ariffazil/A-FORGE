/**
 * Action Classes (amended 2026-10-08 with QA2R_COLLAPSE)
 *
 * A-FORGE must know the difference between:
 *   draft patch → safe (observe)
 *   run test → safe (observe)
 *   write file → caution (draft)
 *   commit → hold if unreviewed
 *   push → digital normal (mubah per Digital Ops Policy 2026-06-30)
 *   deploy → requires lease + judge
 *   delete → requires 888_HOLD
 *   qa2r_collapse → MUST NOT auto-execute; route to F13 or block JITU
 * 
 * Real agency = "knows when not to execute."
 * 
 * FORGED: 2026-07-03
 * AMENDED: 2026-10-08 — added QA2R_COLLAPSE (F13 2026-10-08, agent-compartment.md §Quantum
 * Wave-Collapse Protocol). QA2R_COLLAPSE is the class for things where *digital*
 * execution is the LAST STEP before irreversible reality impact (money, hardware,
 * medical, legal commit). Agents cannot auto-collapse QA2R — must pause, present
 * risk+probabilities, route to F13 or be blocked by JITU.
 * 
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ QA2R cross-link (F13 2026-10-08, agent-compartment.md §Quantum  │
 * │ Wave-Collapse Protocol)                                          │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ IRREVERSIBLE-class commands in this ladder are *digital* —      │
 * │ they mutate state inside the federation. They are NOT the same  │
 * │ as QA2R (Quantum Agent ↔ Reality) — the irreversible collapse   │
 * │ into physical, financial, or legal consequence in the world.     │
 * │                                                                  │
 * │ If a forge_* call is the LAST step before money moves, hardware │
 * │ fires, legal docs are sent, or medical instructions execute,    │
 * │ this is a QA2R wave and:                                         │
 * │   1. CANNOT be auto-collapsed by an agent.                       │
 * │   2. MUST pause and present risks + probabilities to F13 (888).  │
 * │   3. MAY be blocked by JITU circuit brake (jitu.py).            │
 * │                                                                  │
 * │ Continuous Wave-Collapse: this ladder routes A2M (machine).    │
 * │ Reality overrides it when F2 truth contradicts A2A consensus.   │
 * │ Canonical ref: /root/AAA/instructions/agent-compartment.md     │
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * DITEMPA BUKAN DIBERI
 */

// ─── Action Classes ────────────────────────────────────────────────

export type ActionClass =
  | 'OBSERVE'             // Read-only, no side effects
  | 'DRAFT'               // Create artifact in buffer, not on disk
  | 'MUTATE'              // Write to local filesystem
  | 'EXECUTE_REVERSIBLE'  // Run tests, build, restart services
  | 'EXECUTE_HIGH_IMPACT' // Commit, push, deploy (digital normal)
  | 'IRREVERSIBLE'        // Delete, force-push, DROP, vault seal
  | 'QA2R_COLLAPSE';      // 2026-10-08 — last step before reality-side irreversible
                      //          (money, hardware, medical, legal). Agent MUST NOT auto-collapse.

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

  // QA2R_COLLAPSE patterns (F13 2026-10-08) — last step before reality-side irreversible
  // Money: bank transfer, broker order, crypto send, bill payment
  if (/\b(transfer|wire|send\s+funds|wire_to)\s+(\$|usd|myr|rm|rmb|sgd|satoshi|btc|eth)\b/i.test(cmd)) return 'QA2R_COLLAPSE';
  // Verb + number + currency code (no $ sign needed for wire 10000 SGD)
  if (/\b(wire|transfer|pay|send)\b.*?\b\d+\s*(usd|myr|sgd|rm|btc|eth)\b/i.test(cmd)) return 'QA2R_COLLAPSE';
  if (/\bsend\s+\d+(\.\d+)?\s*(btc|eth|satoshi|usd|myr|sgd)\b/i.test(cmd)) return 'QA2R_COLLAPSE';
  if (/\b(bni|maybank|cimb|public\s+bank|rahlia|cash|atm|fpv|fpx|duitsnow)\s+(transfer|send)/i.test(cmd)) return 'QA2R_COLLAPSE';
  // Brokerage
  if (/\b(bursa|cgs-cimb|kaf-securities|rakuten\s+trade|interactive\s+brokers)\s+(buy|sell|order|market)/i.test(cmd)) return 'QA2R_COLLAPSE';
  // Generic buy/sell/order + quantity + security-type keyword (number optional for "buy stock at market")
  if (/\b(buy|sell|order)\b.*?\b(stock|share|equity|option|future|crypto|coin)s?\b/i.test(cmd)) return 'QA2R_COLLAPSE';
  // Order + quantity + units-of-securities ("order 100 options", "buy 50 contracts")
  if (/\b(buy|sell|order)\b[\s\S]*?\b\d+\s+(stock|share|equity|option|future|crypto|coin|contract|unit|lot)s?\b/i.test(cmd)) return 'QA2R_COLLAPSE';
  // Hardware / physical
  if (/\b(send\s+to\s+printer|3d\s+print\s+start|mint|cutting\s+start|manufacture|ship\s+to)\b/i.test(cmd)) return 'QA2R_COLLAPSE';
  // Medical
  if (/\b(prescribe|administer\s+medication|start\s+iv|order\s+surgery|schedule\s+surgery)\b/i.test(cmd)) return 'QA2R_COLLAPSE';
  // Legal commit
  if (/\b(sign|submit|file)\s+(contract|agreement|legal|tender|court\s+filing|tax\s+return|will|trust)\b/i.test(cmd)) return 'QA2R_COLLAPSE';

  // Default: MUTATE (conservative — treat unknown writes as mutations)
  return 'MUTATE';
}

// ─── QA2R Detector (F13 2026-10-08) ────────────────────────────────────
//
// `isQa2rCollapse` is a structural helper that any A-FORGE tool may call
// before executing. It returns true when a command/intent matches the
// QA2R keyword pattern AND the caller indicates the call is the LAST step
// before a reality-side collapse (not a secondary read/probe).
//
// Per Quantum Wave-Collapse Protocol (agent-compartment.md):
//   - If true and agent caller: MUST NOT auto-execute. Route to F13 or
//     block JITU. Return HOLD_QA2R with explicit owner_of_risk field.
//   - If true and human caller (actor_type === 'human'): sovereign override.
//     F13 is the only actor that may collapse a QA2R wave.

export interface Qa2rDetectorContext {
  /** Caller identity. ONLY 'human' may bypass QA2R gate (F13 sovereign). */
  actor_type?: 'agent' | 'human' | 'kernel';
  /** True if this call is the LAST step before the reality-side effect. */
  is_terminal_step?: boolean;
  /** Optional explicit JItu brake state (true = tripped, blocks everything). */
  jitu_tripped?: boolean;
}

export interface Qa2rVerdict {
  is_qa2r: boolean;
  reason: string;
  matched_pattern: string | null;
  required_route: 'AUTO_COLLAPSE' | 'HOLD_QA2R_F13' | 'BLOCKED_BY_JITU';
  owner_of_risk: 'F13_SOVEREIGN' | 'JITU_KERNEL' | 'AGENT_LAMP';
}

// QA2R pattern registry — keep in sync with classifyShellCommand above.
const QA2R_PATTERNS = [
    { regex: /\b(transfer|wire|send\s+funds|wire_to)\s+(\$|usd|myr|rm|rmb|sgd|satoshi|btc|eth)\b/i,
        reason: 'Money transfer / payment' },
    { regex: /\b(wire|transfer|pay|send)\b.*?\b\d+\s*(usd|myr|sgd|rm|btc|eth)\b/i,
        reason: 'Money transfer / payment (verb+noun+amount)' },
    { regex: /\bsend\s+\d+(\.\d+)?\s*(btc|eth|satoshi|usd|myr|sgd)\b/i,
        reason: 'Crypto send with amount' },
    { regex: /\b(bni|maybank|cimb|public\s+bank|rahat|atm|fpv|fpx|duitsnow)\s+(transfer|send)/i,
        reason: 'Bank transfer (MY)' },
    { regex: /\b(bursa|cgs-cimb|kaf-securities|rakuten\s+trade|interactive\s+brokers)\s+(buy|sell|order|market)/i,
        reason: 'Brokerage order' },
    { regex: /\b(buy|sell|order)\b.*?\b(stock|share|equity|option|future|crypto|coin)\b/i,
        reason: 'Securities order' },
    // Order + quantity + units-of-securities ("order 100 options", "buy 50 contracts")
    { regex: /\b(buy|sell|order)\b[\s\S]*?\b\d+\s+(stock|share|equity|option|future|crypto|coin|contract|unit|lot)s?\b/i,
        reason: 'Securities order (qty+units)' },
    { regex: /\b(send\s+to\s+printer|3d\s+print\s+start|manufacture|ship\s+to)\b/i,
        reason: 'Physical fabrication / shipping' },
    { regex: /\b(prescribe|administer\s+medication|start\s+iv|order\s+surgery|schedule\s+surgery)\b/i,
        reason: 'Medical instruction' },
    { regex: /\b(sign|submit|file)\s+(contract|agreement|legal|tender|court\s+filing|tax\s+return|will|trust)\b/i,
        reason: 'Legal commitment' },
];

export function isQa2rCollapse(
  command: string,
  context: Qa2rDetectorContext = {}
): Qa2rVerdict {
  // JITU trip = absolute block (sabrernel brake)
  if (context.jitu_tripped === true) {
    return {
      is_qa2r: true,
      reason: 'JITU circuit brake tripped — all QA2R waves blocked at actuator',
      matched_pattern: null,
      required_route: 'BLOCKED_BY_JITU',
      owner_of_risk: 'JITU_KERNEL',
    };
  }

  for (const { regex, reason } of QA2R_PATTERNS) {
    if (regex.test(command)) {
      // Sovereign override: only human/F13 may collapse a QA2R wave
      if (context.actor_type === 'human') {
        return {
          is_qa2r: true,
          reason: `${reason} — sovereign collapse (F13)`,
          matched_pattern: regex.source,
          required_route: 'AUTO_COLLAPSE',
          owner_of_risk: 'F13_SOVEREIGN',
        };
      }
      // Agent caller + QA2R pattern = HOLD route to F13 (or JITU if trip armed)
      return {
        is_qa2r: true,
        reason: `${reason} — agent CANNOT auto-collapse. Quantum Wave-Collapse Protocol: pause + present to F13 (888)`,
        matched_pattern: regex.source,
        required_route: 'HOLD_QA2R_F13',
        owner_of_risk: 'AGENT_LAMP',
      };
    }
  }

  return {
    is_qa2r: false,
    reason: 'Command does not match QA2R pattern set',
    matched_pattern: null,
    required_route: 'AUTO_COLLAPSE',
    owner_of_risk: 'F13_SOVEREIGN',
  };
}

// ─── Warning: QA2R detector coverage is a denylist, not a golden list. ──
// Detected patterns are NECESSARY not SUFFICIENT for the gate. Per Quantum
// Wave-Collapse Protocol invariant 1 (Continuous Wave-Collapse), an agent MUST
// probe reality (A-FORGE/GEOX) before any action that COULD reach QA2R —
// because a missing pattern here does NOT mean the action is safe. F2 truth
// requires the agent to ask "is this the LAST step before reality collapses?"
// before every high-impact call.
