/**
 * AF-FORGE Agent Plane — Public API
 *
 * Exports the three core control-plane services:
 *   AgentManager  — job queue, session lifecycle, tool allowlists
 *   BackupManager  — pg_dump automation, F1-verified backups
 *   TelegramNotifier — 888_HOLD human escalation via Telegram
 */

export { AgentManager } from "./AgentManager.js";
export type { JobStatus, JobPriority, JobDefinition, JobRunState, AgentManagerConfig } from "./AgentManager.js";

export { BackupManager } from "./BackupManager.js";
export type { BackupResult, BackupManagerConfig } from "./BackupManager.js";
