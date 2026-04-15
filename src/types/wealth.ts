/**
 * WEALTH — Sovereign Resource Intelligence (Layer 2)
 * 
 * Wealth is Organized Survival Energy across Time.
 * This contract governs the allocation of Energy, Time, and Capital.
 * Aligned to the WEALTH Civilizational Constitution.
 */

export type WealthScale = "Individual" | "Family" | "Organization" | "Nation" | "Machine" | "Civilization";

export interface SovereignWealthContract {
  scale: WealthScale;
  subjectId: string; // The Son, The Family, The AI, The Nation
  intent: string;    // e.g., "Invest in Engineering Degree", "Build Fusion Reactor"
  
  // The 8 Dimensions of Resource Intelligence
  metrics: {
    // 1. Flow: Metabolic Health (Net energy/cash movement)
    flow: { rate: number; burn: number; isPositive: boolean };
    
    // 2. Mass: Structural Gravity (Assets vs Liabilities)
    mass: { assets: number; obligations: number; gravityRatio: number };
    
    // 3. Velocity: Compounding Trajectory (Growth/Innovation delta)
    velocity: { growthRate: number; innovationDelta: number };
    
    // 4. Time: Patience Thresholds (Payback/Recovery)
    time: { paybackPeriod: number; horizon: number; runway: number };
    
    // 5. Reward: Temporal Coherence (NPV - Is it worth it across time?)
    reward: { npv: number; futureValue: number };
    
    // 6. Energy: Efficiency (IRR/PI - Conversion of capital to growth)
    energy: { irr: number; efficiencyRatio: number };
    
    // 7. Entropy: Fragility (EMV/Risk - Fragility under uncertainty)
    entropy: { riskScore: number; volatility: number; uncertainty: number };
    
    // 8. Survival Load: Existential Obligation (DSCR/Leverage)
    survivalLoad: { leverageRatio: number; dscr: number; isSustainable: boolean };
  };

  // Thermodynamic Coupling (Landauer limits & Entropy)
  thermodynamics: {
    joulesExpended: number;
    entropyGenerated: number;
  };

  verdict: {
    action: "ALLOCATE" | "HOLD" | "VOID";
    rationale: string;
  };
}

export interface SurvivalAudit {
  status: "COMPOUNDING" | "STAGNATING" | "DECAYING";
  criticalFragility: string[]; // List of entropy/leverage warnings
  survivalHorizon: string;     // Estimated time until resource exhaustion
}
