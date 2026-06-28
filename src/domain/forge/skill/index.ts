/**
 * skill/index.ts — Public exports for forge_skill
 *
 * APEX THEORY Epoch 34Ω — Organism Layer wired to A-FORGE
 */

export * from "./types.js";
export {
  computeDecisionField,
  computeQ,
  computeV,
  computePsi,
  computePhi,
  computeTheta,
} from "./decisionField.js";
export {
  sealScar,
  consultScars,
  listScars,
  revokeScar,
  fingerprintIntent,
} from "./scarLaw.js";
export { getSkillRegistry, SkillRegistry } from "./skillRegistry.js";
export { forgeSkill, haramScan } from "./skillForge.js";