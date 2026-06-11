/**
 * LongTermMemoryFailureLog — append-only JSONL failure record.
 * Mirrors the existing Qdrant failure log path pattern for consistency.
 */
import { appendFile } from "node:fs/promises";

const FAILURE_LOG_PATH =
  process.env.A_FORGE_FAILURE_LOG_PATH ?? "/tmp/a-forge-federation-failures.jsonl";

export async function logFederationFailure(
  reason: string,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    const entry = {
      ts: new Date().toISOString(),
      reason,
      details,
    };
    await appendFile(FAILURE_LOG_PATH, `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    // Never throw from failure logger — would cascade
  }
}
