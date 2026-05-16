/**
 * ARIFOS_REPLY_PROTOCOL — Resonance Contract (Layer 2)
 * 
 * Defines the requirements for Cognitive-Linguistic Alignment.
 * Ensures machine-to-human communication minimizes cognitive entropy.
 */

export interface ResonanceContract {
  // The "Aha!" Moment: What is the single most critical insight?
  eurekaSignal: string;
  
  // Scars: What are the known failures, gaps, or "dirty" data points?
  scars: string[]; 
  
  // Paradoxes: What are the logical or physical tensions in this result?
  // e.g., "High ROI but violates local entropy limits."
  paradoxes: string[];
  
  // Causal Chain: The "How we got here" in human logic
  causalChain: string[];
  
  // Emotional/Existential Alignment (Maruah)
  // Why does this matter to the human/civilization?
  stakes: string;

  // Cognitive Energy Metrics
  metrics: {
    complexityScore: number; // [0, 1] - Goal is < 0.4 for Eureka
    signalToNoise: number;   // [0, 1] - Goal is > 0.8
  };
}
