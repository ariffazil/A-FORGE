import {
  ArifOSTaskContract,
  MetabolicState,
  MetabolicTransition,
  Tag,
} from "../types/arifos.js";

/**
 * ArifOSKernel — Quantum-Level Intelligence Orchestrator
 *
 * Manages the metabolic 000-999 pipeline.
 * Enforces constitutional state transitions and thermodynamic budgets.
 */
export class ArifOSKernel {
  private contract: ArifOSTaskContract;

  constructor(intent: string, sessionId: string) {
    this.contract = {
      sessionId,
      intent,
      riskTier: "medium",
      metabolicState: "000",
      activeFloors: ["F1", "F2", "F3", "F4", "F8", "F12"],
      tags: ["CLAIM"],
      context: {},
      thermodynamics: {
        joulesEstimate: 0,
        carbonEstimate: 0,
        entropyDelta: 0,
      },
    };
  }

  public getContract(): ArifOSTaskContract {
    return this.contract;
  }

  /**
   * Transition to a new metabolic state.
   * Performs basic validation of state sequence.
   */
  public transition(target: MetabolicState): MetabolicTransition {
    const from = this.contract.metabolicState;
    const transition: MetabolicTransition = {
      from,
      to: target,
      verdict: "PASS",
      timestamp: Date.now(),
    };

    // Basic state machine validation (no skipping stages except for direct 999 if allowed)
    const stages: MetabolicState[] = ["000", "111", "333", "555", "777", "888", "999"];
    const fromIdx = stages.indexOf(from);
    const targetIdx = stages.indexOf(target);

    if (targetIdx <= fromIdx && target !== from) {
      transition.verdict = "VOID";
      transition.reason = `Invalid state transition: Cannot regress from ${from} to ${target}. Use explicit reset if needed.`;
      return transition;
    }

    if (targetIdx > fromIdx + 1 && target !== "999") {
       transition.verdict = "HOLD";
       transition.reason = `Incomplete metabolic loop: Skipping stages (from ${from} to ${target}) requires explicit bypass authorization.`;
       return transition;
    }

    // 888 check: Irreversible ops must hold for F13
    if (target === "999" && from !== "888") {
       transition.verdict = "HOLD";
       transition.reason = "888 AUDIT must precede 999 SEAL. Delegate to arifOS Kernel for Authorization.";
       return transition;
    }

    // A-FORGE: Boundary Check (Architectural Law)
    // We only transition if arifOS has authorized the next state.
    // In this foundation phase, we log the delegation requirement.
    console.log(`[A-FORGE] State Transition ${from} -> ${target} pending arifOS Kernel validation.`);

    this.contract.metabolicState = target;
    return transition;
  }

  /**
   * Update contract tags based on evidence/confidence.
   */
  public updateTags(tags: Tag[]): void {
    this.contract.tags = [...new Set([...this.contract.tags, ...tags])];
  }

  /**
   * Inject context into the task contract.
   */
  public injectContext(key: string, value: any): void {
    this.contract.context[key] = value;
  }

  /**
   * Update thermodynamic metrics.
   */
  public updateThermodynamics(joules: number, carbon: number, entropy: number): void {
    this.contract.thermodynamics.joulesEstimate += joules;
    this.contract.thermodynamics.carbonEstimate += carbon;
    this.contract.thermodynamics.entropyDelta += entropy;
  }
}
