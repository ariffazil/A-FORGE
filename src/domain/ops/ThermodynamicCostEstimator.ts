/**
 * ThermodynamicCostEstimator — OPS/777 Landauer Gate
 *
 * Pre-action thermodynamic scan: estimates cost, reversibility, blast radius,
 * EMV/NPV viability, and entropy delta BEFORE a tool executes.
 *
 * Law of thermodynamic intelligence:
 *   "How expensive is this thought/action in energy, risk, and reversibility space?"
 *   If too hot → HOLD or VOID before decode.
 *
 * WEALTH organ contributes: EMV, NPV, reversibility (κᵣ), blast radius
 * Thermodynamic codec contributes: Landauer cost, dS prediction
 *
 * @module ops/ThermodynamicCostEstimator
 * @constitutional F4 Entropy — dS must trend ≤ 0
 * @constitutional F1 Amanah — irreversibility triggers 888_HOLD
 */

import type {
  ThermodynamicCost,
  ThermodynamicVerdict,
  WealthScenario,
  CashFlow,
  EMVResult,
  NPVResult,
} from "../types/wealth.js";
import {
  KAPPA_R_THRESHOLD,
  BLAST_RADIUS_THRESHOLD,
  LANDAUER_COST_THRESHOLD,
  DS_PREDICT_THRESHOLD,
  NPV_MIN,
  EMV_MIN,
} from "../types/wealth.js";

function computeEMV(scenario: WealthScenario): number {
  return scenario.cashFlows.reduce((sum, cf) => {
    return sum + cf.probability * cf.amount;
  }, 0) - scenario.initialInvestment;
}

function computeNPV(scenario: WealthScenario): number {
  const pvCashFlows = scenario.cashFlows.reduce((sum, cf, i) => {
    const pv = cf.amount / Math.pow(1 + scenario.discountRate, cf.period);
    return sum + pv;
  }, 0);
  return pvCashFlows - scenario.initialInvestment;
}

function discountRate(r: number): number {
  return 1 / Math.pow(1 + r, 1);
}

const TOOL_LANDAUER_COST: Record<string, number> = {
  read_file: 0.05,
  list_files: 0.03,
  grep_text: 0.08,
  apply_patches: 0.40,
  write_file: 0.35,
  run_tests: 0.40,
  run_command: 0.85,
};

const TOOL_KAPPA_R: Record<string, number> = {
  read_file: 1.0,
  list_files: 1.0,
  grep_text: 1.0,
  apply_patches: 0.8,
  write_file: 0.6,
  run_tests: 0.7,
  run_command: 0.2,
};

const TOOL_BLAST_RADIUS: Record<string, number> = {
  read_file: 0.0,
  list_files: 0.0,
  grep_text: 0.05,
  apply_patches: 0.4,
  write_file: 0.6,
  run_tests: 0.4,
  run_command: 0.9,
};

const BLAST_RADIUS_MODIFIERS: Array<{ pattern: RegExp; delta: number }> = [
  { pattern: /rm|del|drop|truncate/i, delta: 0.4 },
  { pattern: /production|prod|main|live/i, delta: 0.3 },
  { pattern: /sudo|exec|eval|spawn/i, delta: 0.35 },
  { pattern: /merge|push.*main|force.*push/i, delta: 0.5 },
  { pattern: /git.*reset|rebase.*-i/i, delta: 0.3 },
];

const DS_PREDICT_MODIFIERS: Array<{ pattern: RegExp; delta: number }> = [
  { pattern: /delete|remove|rm/i, delta: 0.4 },
  { pattern: /overwrite|replace/i, delta: 0.2 },
  { pattern: /production|prod|live/i, delta: 0.3 },
  { pattern: /batch|bulk|loop/i, delta: 0.25 },
];

function applyModifiers(
  base: number,
  args: Record<string, unknown>,
  modifiers: Array<{ pattern: RegExp; delta: number }>,
): number {
  const argStr = JSON.stringify(args);
  let value = base;
  for (const mod of modifiers) {
    if (mod.pattern.test(argStr)) {
      value += mod.delta;
    }
  }
  return Math.min(1.0, value);
}

export class ThermodynamicCostEstimator {
  /**
   * estimate — compute thermodynamic cost for a single tool call.
   * Does NOT account for EMV/NPV (those require WealthScenario input).
   * Use estimateWithWealth() for full financial + thermodynamic scan.
   */
  estimate(
    toolName: string,
    args: Record<string, unknown>,
  ): ThermodynamicCost {
    const baseLandauer = TOOL_LANDAUER_COST[toolName] ?? 0.5;
    const landauerCost = applyModifiers(baseLandauer, args, []);

    const kappa_r = TOOL_KAPPA_R[toolName] ?? 0.5;
    const blastRadius = applyModifiers(
      TOOL_BLAST_RADIUS[toolName] ?? 0.5,
      args,
      BLAST_RADIUS_MODIFIERS,
    );
    const dS_predict = applyModifiers(
      blastRadius * 0.5,
      args,
      DS_PREDICT_MODIFIERS,
    );

    const isReversible = kappa_r >= KAPPA_R_THRESHOLD;
    const isExpensive = landauerCost >= LANDAUER_COST_THRESHOLD;

    let thermodynamicBand: ThermodynamicCost["thermodynamicBand"] = "LOW";
    const composite =
      landauerCost * 0.3 + (1 - kappa_r) * 0.3 + blastRadius * 0.2 + dS_predict * 0.2;
    if (composite >= 0.8) {
      thermodynamicBand = "CRITICAL";
    } else if (composite >= 0.6) {
      thermodynamicBand = "HIGH";
    } else if (composite >= 0.3) {
      thermodynamicBand = "MEDIUM";
    }

    return {
      toolName,
      landauerCost,
      kappa_r,
      blastRadius,
      dS_predict,
      emv: 0,
      npv: 0,
      isReversible,
      isExpensive,
      thermodynamicBand,
    };
  }

  /**
   * estimateWithWealth — full thermodynamic + financial scan.
   * Runs Landauer/entropy scan first; if PASS, enriches with EMV/NPV.
   * Returns full ThermodynamicVerdict with wealth integration.
   */
  estimateWithWealth(
    toolName: string,
    args: Record<string, unknown>,
    wealthScenario?: WealthScenario,
  ): ThermodynamicVerdict {
    const cost = this.estimate(toolName, args);

    if (wealthScenario) {
      cost.emv = computeEMV(wealthScenario);
      cost.npv = computeNPV(wealthScenario);
    }

    const violations: string[] = [];

    if (cost.landauerCost >= LANDAUER_COST_THRESHOLD) {
      violations.push(
        `LANDAUER_COST ${cost.landauerCost.toFixed(2)} ≥ ${LANDAUER_COST_THRESHOLD}`,
      );
    }

    if (cost.kappa_r < KAPPA_R_THRESHOLD) {
      violations.push(
        `REVERSIBILITY κᵣ ${cost.kappa_r.toFixed(2)} < ${KAPPA_R_THRESHOLD} (irreversible)`,
      );
    }

    if (cost.blastRadius >= BLAST_RADIUS_THRESHOLD) {
      violations.push(
        `BLAST_RADIUS ${cost.blastRadius.toFixed(2)} ≥ ${BLAST_RADIUS_THRESHOLD}`,
      );
    }

    if (cost.dS_predict > DS_PREDICT_THRESHOLD) {
      violations.push(
        `ENTROPY_DELTA dS ${cost.dS_predict.toFixed(2)} > ${DS_PREDICT_THRESHOLD}`,
      );
    }

    if (cost.emv < EMV_MIN) {
      violations.push(`EMV ${cost.emv.toFixed(2)} < ${EMV_MIN} (negative expected value)`);
    }

    if (cost.npv < NPV_MIN) {
      violations.push(`NPV ${cost.npv.toFixed(2)} < ${NPV_MIN} (negative net present value)`);
    }

    const criticalViolations = violations.filter(
      (v) =>
        v.includes("BLAST_RADIUS") ||
        v.includes("EMV") ||
        v.includes("NPV"),
    );

    let verdict: ThermodynamicVerdict["verdict"] = "PASS";
    if (criticalViolations.length > 0) {
      verdict = "VOID";
    } else if (
      cost.thermodynamicBand === "HIGH" ||
      cost.thermodynamicBand === "CRITICAL"
    ) {
      verdict = "HOLD";
    }

    const landauerReason =
      cost.landauerCost >= LANDAUER_COST_THRESHOLD
        ? `Landauer cost HIGH (${cost.landauerCost.toFixed(2)}) — action is thermodynamically expensive`
        : `Landauer cost acceptable (${cost.landauerCost.toFixed(2)})`;

    const reversibilityReason =
      cost.kappa_r < KAPPA_R_THRESHOLD
        ? `κᵣ ${cost.kappa_r.toFixed(2)} below threshold — irreversible without VAULT999 seal`
        : `κᵣ ${cost.kappa_r.toFixed(2)} — reversibility confirmed`;

    const blastRadiusReason =
      cost.blastRadius >= BLAST_RADIUS_THRESHOLD
        ? `Blast radius CRITICAL (${cost.blastRadius.toFixed(2)}) — maximum downside exceeds safe threshold`
        : `Blast radius within bounds (${cost.blastRadius.toFixed(2)})`;

    const wealthReason =
      cost.emv !== 0 || cost.npv !== 0
        ? `EMV=${cost.emv.toFixed(2)} NPV=${cost.npv.toFixed(2)} — ${
            cost.emv >= EMV_MIN && cost.npv >= NPV_MIN
              ? "financial viability confirmed"
              : "financial viability FAIL"
          }`
        : "WEALTH scenario not provided — financial scan skipped";

    return {
      verdict,
      cost,
      violations,
      landauerReason,
      reversibilityReason,
      blastRadiusReason,
      wealthReason,
    };
  }

  /**
   * quickEntropyCheck — fast F4 dS check without full wealth scan.
   * Use this when only F4 entropy check is needed (e.g. in hot path).
   */
  quickEntropyCheck(
    toolName: string,
    args: Record<string, unknown>,
    previousRisk: number,
  ): { verdict: "PASS" | "HOLD"; dS: number; reason: string } {
    const cost = this.estimate(toolName, args);
    const dS = cost.dS_predict;

    if (dS > DS_PREDICT_THRESHOLD && previousRisk > 0) {
      return {
        verdict: "HOLD",
        dS,
        reason: `F4 HOLD: dS_predict=${dS.toFixed(2)} > ${DS_PREDICT_THRESHOLD}. Risk delta exceeds safe threshold.`,
      };
    }

    return {
      verdict: "PASS",
      dS,
      reason: `F4 PASS: dS_predict=${dS.toFixed(2)} within safe band.`,
    };
  }

  /**
   * computeExpectedValue — pure EMV calculation for a WEALTH scenario.
   */
  computeEMV(scenario: WealthScenario): EMVResult {
    const weightedOutcomes = scenario.cashFlows.reduce(
      (sum, cf) => sum + cf.probability * cf.amount,
      0,
    );
    const emv = weightedOutcomes - scenario.initialInvestment;

    return {
      emv,
      expectedValue: weightedOutcomes,
      weightedOutcomes,
      scenarios: scenario.cashFlows.length,
      reason:
        emv >= EMV_MIN
          ? `EMV ${emv.toFixed(2)} ≥ ${EMV_MIN} — positive expected value`
          : `EMV ${emv.toFixed(2)} < ${EMV_MIN} — negative expected value, HOLD required`,
    };
  }

  /**
   * computeNPV — NPV calculation for a WEALTH scenario.
   */
  computeNPV(scenario: WealthScenario): NPVResult {
    const presentValues = scenario.cashFlows.map((cf) => {
      const period = cf.period > 0 ? cf.period : 1;
      return cf.amount / Math.pow(1 + scenario.discountRate, period);
    });

    const pvCashFlows = presentValues.reduce((sum, pv) => sum + pv, 0);
    const npv = pvCashFlows - scenario.initialInvestment;

    return {
      npv,
      presentValues,
      discountRate: scenario.discountRate,
      initialInvestment: scenario.initialInvestment,
      reason:
        npv >= NPV_MIN
          ? `NPV ${npv.toFixed(2)} ≥ ${NPV_MIN} — investment viable`
          : `NPV ${npv.toFixed(2)} < ${NPV_MIN} — investment not viable without human approval`,
    };
  }
}

export const getThermodynamicEstimator = (): ThermodynamicCostEstimator => {
  return new ThermodynamicCostEstimator();
};
