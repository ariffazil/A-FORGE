/**
 * Personal Module
 * 
 * The human-facing layer of arifOS.
 * 
 * Exports:
 * - SovereignLoop: Core personal OS engine
 * - DailyLoop: Morning/evening rituals and project rhythms  
 * - HumanCLI: Simplified natural language interface
 * 
 * @module personal
 * @constitutional F13 Sovereign - Human intention is primary
 */

export { SovereignLoop } from "./SovereignLoop.js";
export type {
  HumanCommand,
  HumanIntent,
  SovereignResponse,
  ActionBadge,
  ActionState,
  MemoryTier,
  TieredMemory,
  SovereignDashboard,
  InboxItem,
  HoldItem,
  WatchItem,
  AlertItem,
  ForgeItem,
  HumanExplanation,
} from "./SovereignLoop.js";

export { DailyLoop } from "./DailyLoop.js";
export type {
  MorningContext,
  EveningClosure,
  ProjectLoop,
  LifeMemoryLoop,
  ChangeSummary,
  DecisionItem,
  WatchReminder,
  MemoryDigest,
  Artifact,
  ActionItem,
  RiskItem,
  FactItem,
  PreferenceItem,
  CommitmentItem,
  LessonItem,
} from "./DailyLoop.js";

export { HumanCLI, createPersonalOS } from "./HumanCLI.js";
