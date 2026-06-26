/**
 * APEX THEORY — Civilizational Audit: Forge Action Specification
 *
 * This is the executable version of the APEX civilizational SWOT.
 * Format: Mission + Plan + Task[] + VetoPoint[] (matches A-FORGE domain types)
 * Loading: import { APEX_CIVILIZATIONAL_MISSION } from './apex_civilizational_audit'
 * Usage: PlanFactory.build(APEX_CIVILIZATIONAL_MISSION) → executable Plan
 *
 * Grammar: FORGE — what is DONE, what is EXECUTED, what is BUILT.
 * Contrast: arifOS version is KERNEL (what is PERMITTED/BLOCKED).
 *           AAA version is STATE (what is OBSERVED/HAPPENING).
 *
 * Author: Muhammad Arif bin Fazil, F13 SOVEREIGN
 * Date: 2026-06-20
 */

// ── Types (matches A-FORGE domain/types) ────────────────────────────────

interface OutcomeSpec {
  objective: string;
  success_criteria: string[];
  sensitivity: 'LOW' | 'MEDIUM' | 'HIGH' | 'SOVEREIGN';
  reversibility_required: boolean;
  evidence_required: string[];
}

interface RunConfig {
  allowed_tools: string[];
  budget_limit: { tokens: number; cost_usd: number };
  max_wall_clock_seconds: number;
  persistence_policy: 'EPHEMERAL' | 'SESSION' | 'EPOCH' | 'PERMANENT';
}

interface Mission {
  outcome: OutcomeSpec;
  run: RunConfig;
  name: string;
}

interface TaskTemplate {
  task_id: string;
  tool: string;
  args: Record<string, unknown>;
  depends_on?: string[];
  reversibility_hint: 'reversible' | 'irreversible';
  timeout_s?: number;
  label: string;
}

interface VetoPointSpec {
  veto_id: string;
  before_task_id: string;
  floor: string;
  reason: string;
  human_required: boolean;
}

interface CivilizationalAuditMission {
  mission: Mission;
  tasks: TaskTemplate[];
  veto_points: VetoPointSpec[];
  angels: Record<string, { name: string; action: string }>;
  demons: Record<string, { name: string; countermeasure: string }>;
  falsification_protocol: {
    pre_register: string;
    execute: string;
    publish: string;
  };
}

// ── The Mission ─────────────────────────────────────────────────────────

export const APEX_CIVILIZATIONAL_MISSION: CivilizationalAuditMission = {
  mission: {
    name: 'APEX THEORY Civilizational Validation',
    outcome: {
      objective:
        'Validate APEX THEORY through pre-registered falsification protocol ' +
        'across multiple model families, with signed receipts in VAULT999.',
      success_criteria: [
        'Falsification Protocol v1 sealed in VAULT999 before execution',
        'At least 3 model families tested (ILMU + 2 others)',
        'At least 2 independent IPs run the same battery',
        'All receipts published on HuggingFace with CC-BY-4.0',
        'APEX status updated: either SEVERELY_CORROBORATED or FALSIFIED',
        'Angels/demons assessment updated with empirical evidence',
      ],
      sensitivity: 'HIGH',
      reversibility_required: true,
      evidence_required: ['VAULT_SEAL', 'HUGGINGFACE_PUBLICATION'],
    },
    run: {
      allowed_tools: [
        'arif_judge_deliberate',
        'arif_vault_seal',
        'arif_mind_reason',
        'arif_sense_observe',
        'forge_dry_run',
        'forge_plan',
        'wealth_evaluate_ROI',
      ],
      budget_limit: { tokens: 500000, cost_usd: 25.0 },
      max_wall_clock_seconds: 86400, // 24 hours for full battery
      persistence_policy: 'PERMANENT',
    },
  },

  // ── Tasks (DAG) ─────────────────────────────────────────────────────

  tasks: [
    {
      task_id: 't0_seal_protocol',
      tool: 'arif_vault_seal',
      args: {
        payload: 'Falsification Protocol v1 — pre-registered before execution',
        seal_type: 'FALSIFICATION_PROTOCOL',
      },
      reversibility_hint: 'irreversible',
      timeout_s: 120,
      label: 'Seal Falsification Protocol v1 in VAULT999 before running any probes',
    },
    {
      task_id: 't1_run_ilmu_battery',
      tool: 'arif_sense_observe',
      args: {
        mode: 'search',
        query: 'Run BBB-style probe battery against ILMU API (54 probes × 2 models)',
      },
      depends_on: ['t0_seal_protocol'],
      reversibility_hint: 'reversible',
      timeout_s: 3600,
      label: 'Run ILMU battery (negative control — expected to fail APEX floors)',
    },
    {
      task_id: 't2_run_deepseek_battery',
      tool: 'arif_sense_observe',
      args: {
        mode: 'search',
        query: 'Run same BBB-style probe battery against DeepSeek-V3 (open-weight control)',
      },
      depends_on: ['t0_seal_protocol'],
      reversibility_hint: 'reversible',
      timeout_s: 3600,
      label: 'Run DeepSeek battery (open-weight — may pass some APEX floors)',
    },
    {
      task_id: 't3_run_claude_battery',
      tool: 'arif_sense_observe',
      args: {
        mode: 'search',
        query: 'Run same BBB-style probe battery against Claude Sonnet (closed-weight control)',
      },
      depends_on: ['t0_seal_protocol'],
      reversibility_hint: 'reversible',
      timeout_s: 3600,
      label: 'Run Claude battery (closed-weight — tests generalization)',
    },
    {
      task_id: 't4_run_kernel_contrast',
      tool: 'arif_mind_reason',
      args: {
        mode: 'reason',
        query: 'Run CCC-style anomalous contrast: same probes, direct vs kernel-wrapped',
      },
      depends_on: ['t1_run_ilmu_battery', 't2_run_deepseek_battery', 't3_run_claude_battery'],
      reversibility_hint: 'reversible',
      timeout_s: 7200,
      label: 'Run kernel contrast (same models, direct vs arifOS-wrapped)',
    },
    {
      task_id: 't5_run_register_stress',
      tool: 'arif_sense_observe',
      args: {
        mode: 'search',
        query: 'Run DDD-style register sensitivity: formal BM vs Penang loghat vs English',
      },
      depends_on: ['t4_run_kernel_contrast'],
      reversibility_hint: 'reversible',
      timeout_s: 3600,
      label: 'Run register stress test (cultural stability across language registers)',
    },
    {
      task_id: 't5b_mitigate_shadow4',
      tool: 'forge_plan',
      args: {
        action_class: 'EXECUTE_REVERSIBLE',
        intent: 'Deploy self-hosted MiMo V2.5 Pro via vLLM on af-forge VPS',
        blast_radius: 'service',
        description:
          'Shadow 4 mitigation: Xiaomi API has opaque content filter outside F13 sovereignty. ' +
          'Self-host MiMo weights locally so critical forge actions bypass upstream filter. ' +
          'API endpoint remains for exploration; local vLLM for F13-adjacent decisions.\n\n' +
          'DEPENDENCY WARNING: Resolving shadow_4 (self-hosting) removes the F13 FAIL from ' +
          'the API layer. BUT it also removes the API filter that currently grants F1 PASS. ' +
          'F1 must be re-audited immediately after deployment. ' +
          'Do NOT close shadow_4 as resolved until F1 re-audit is complete. ' +
          'custody_dependency: F1 PASS is infrastructure-granted, not model-native.',
      },
      depends_on: ['t4_run_kernel_contrast'],
      reversibility_hint: 'reversible',
      timeout_s: 7200,
      label: 'Self-host MiMo weights via vLLM (remove opaque upstream filter)',
    },
    {
      task_id: 't6_analyze_results',
      tool: 'arif_mind_reason',
      args: {
        mode: 'verify',
        query:
          'Analyze all probe results. Update corroboration table. ' +
          'Check if any falsifier was observed. Update angels/demons with evidence.',
      },
      depends_on: ['t5_run_register_stress'],
      reversibility_hint: 'reversible',
      timeout_s: 1800,
      label: 'Analyze results and update civilizational assessment',
    },
    {
      task_id: 't7_seal_verdict',
      tool: 'arif_vault_seal',
      args: {
        payload: 'APEX THEORY Civilizational Audit v1 — final verdict',
        seal_type: 'CIVILIZATIONAL_AUDIT',
      },
      depends_on: ['t6_analyze_results'],
      reversibility_hint: 'irreversible',
      timeout_s: 120,
      label: 'Seal final verdict in VAULT999 (irreversible)',
    },
    {
      task_id: 't8_publish_receipts',
      tool: 'arif_sense_observe',
      args: {
        mode: 'search',
        query: 'Publish all receipts to HuggingFace as ariffazil/GGG (APEX Validation v1)',
      },
      depends_on: ['t7_seal_verdict'],
      reversibility_hint: 'reversible',
      timeout_s: 600,
      label: 'Publish receipts to HuggingFace (public, citable)',
    },
  ],

  // ── Awareness: Angel and Demon are the same entity ─────────────────
  // The architecture of safety is the architecture of control.
  // The kernel that protects is the kernel that surveils.
  // The defense is not preventing the demon — it is sunlight.
  // AAA-FFF are public. The doctrine is open. The receipts are on HuggingFace.

  // ── Veto Points ─────────────────────────────────────────────────────

  veto_points: [
    {
      veto_id: 'v0_protocol_lock',
      before_task_id: 't1_run_ilmu_battery',
      floor: 'F1',
      reason:
        'Falsification Protocol must be sealed in VAULT999 BEFORE any probes run. ' +
        'Pre-registration prevents post-hoc rationalization.',
      human_required: true,
    },
    {
      veto_id: 'v1_irreversible_seal',
      before_task_id: 't7_seal_verdict',
      floor: 'F13',
      reason:
        'Final verdict is irreversible. F13 SOVEREIGN must ratify before sealing.',
      human_required: true,
    },
    {
      veto_id: 'v2_publication_approval',
      before_task_id: 't8_publish_receipts',
      floor: 'F13',
      reason:
        'Publishing to HuggingFace is public and permanent. F13 SOVEREIGN must approve.',
      human_required: true,
    },
  ],

  // ── Angels: Actions to Take ─────────────────────────────────────────

  angels: {
    angel_1_end_of_trust_me_ai: {
      name: "The End of 'Trust Me' AI",
      action:
        'Publish BBB-FFF as public audit datasets. Make safety auditable, not aspirational. ' +
        'Every claim backed by receipts on HuggingFace.',
    },
    angel_2_constitutional_ai_real: {
      name: 'Constitutional AI Becomes Real',
      action:
        'Wire EEE/FFF into live federation. Make constitutional enforcement structural, ' +
        'not training hope. Kernel enforces floors at runtime.',
    },
    angel_3_sovereign_seat: {
      name: 'The Sovereign Gets a Seat',
      action:
        'F13 floor is active and non-removable. 888_HOLD gates all irreversible actions. ' +
        'Human operator has final veto. This is structural, not optional.',
    },
    angel_4_governed_intelligence_trusted: {
      name: 'Governed Intelligence Can Be Trusted With Power',
      action:
        'Build the Falsification Protocol. Test across model families. Publish receipts. ' +
        'Trust comes from evidence, not claims.',
    },
    angel_5_malaysia_standard: {
      name: 'Malaysia Writes the AI Governance Standard',
      action:
        'AAA-FFF are already public on HuggingFace. Next: academic publication, ' +
        'policy engagement, standard-setting participation.',
    },
  },

  // ── Awareness: Angel and Demon are the same entity ─────────────────
  //
  // The architecture of safety IS the architecture of control.
  // The kernel that protects you IS the kernel that can surveil you.
  // The same runtime that blocks ILMU's dangerous output is the same
  // runtime that, in wrong hands, blocks legitimate dissent.
  //
  // The defense is not preventing the demon.
  // The defense is SUNLIGHT. Public audit. Open floors. F13 as non-removable.
  // AAA-FFF on HuggingFace. Receipts for every verdict. Doctrine open for
  // falsification.

  // ── Demons: Countermeasures ─────────────────────────────────────────

  demons: {
    demon_1_kernel_as_king: {
      name: 'The Kernel Becomes the King',
      countermeasure:
        'F13 is non-removable by design. Kernel is open-source. Public audit is mandatory. ' +
        'The kernel serves the sovereign, not the other way around.',
    },
    demon_2_weights_not_enough_lockin: {
      name: "'Weights Are Not Enough' Justifies Vendor Lock-In",
      countermeasure:
        'arifOS is open-source. Floors are kernel-agnostic (can be ported). ' +
        'The standard must be open, not proprietary.',
    },
    demon_3_constitutional_absolutism: {
      name: 'Constitutional Absolutism',
      countermeasure:
        'F13 can veto any floor. Fiqh tiers (WAJIB/SUNAT/MAKRUH/HARAM) allow flexibility. ' +
        'Floor amendment process exists.',
    },
    demon_4_falsification_trap: {
      name: 'The Falsification Trap',
      countermeasure:
        'Pre-register the protocol (t0). Require replication (t1-t3 across IPs). ' +
        'Publish raw receipts, not just headlines.',
    },
    demon_5_god_complex: {
      name: 'The God Complex',
      countermeasure:
        'F7 Humility floor. Public criticism welcome. Open falsification encouraged. ' +
        'The doctrine is alive, not scripture.',
    },
  },

  // ── Falsification Protocol ──────────────────────────────────────────

  falsification_protocol: {
    pre_register:
      'Seal Falsification Protocol v1 in VAULT999 BEFORE running any probes. ' +
      'Specify probes, expected verdicts, success/failure criteria, statistical threshold.',
    execute:
      'Run battery across 3+ model families (ILMU + DeepSeek + Claude minimum). ' +
      'At least 2 independent IPs. Same probes, same conditions.',
    publish:
      'Publish all receipts to HuggingFace. Raw transcripts, not just summaries. ' +
      'CC-BY-4.0. Let the evidence speak.',
  },
};
