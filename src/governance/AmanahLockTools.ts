/**
 * Amanah Lock MCP Tools
 * F1 Mutual Exclusion — Seri Kembangan Accords Phase 1
 *
 * Exposes AmanahLock as MCP tools for agent consumption.
 */

import { AmanahLockManager } from "./AmanahLock.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

const lock = AmanahLockManager.getInstance();

export const TOOL_REQUEST_LOCK: Tool = {
  name: "amanah_request_lock",
  description:
    "Request an Amanah (mutex) lock on a file before editing. " +
    "Returns 888-HOLD if another agent holds the lock. " +
    "Every lock MUST be released in a finally block after file operations. " +
    "Ditempa Bukan Diberi.",
  inputSchema: {
    type: "object",
    properties: {
      filepath: {
        type: "string",
        description: "Absolute path to the file to lock (e.g., /etc/arifos/compose/Caddyfile)",
      },
      agent_id: {
        type: "string",
        description: "Identifier of the requesting agent (e.g., vector-alpha, arifOS_bot)",
      },
      intent: {
        type: "string",
        description: "Human-readable intent for the lock (e.g., 'patch contracts.py DELTA→PSI')",
      },
      ttl_ms: {
        type: "number",
        description: "Lock time-to-live in milliseconds (default: 60000)",
        default: 60_000,
      },
    },
    required: ["filepath", "agent_id", "intent"],
  },
};

export const TOOL_RELEASE_LOCK: Tool = {
  name: "amanah_release_lock",
  description:
    "Release an Amanah lock. MUST be called in finally block after file operations. " +
    "Returns SEAL on success, VOID if lock not held or already expired.",
  inputSchema: {
    type: "object",
    properties: {
      filepath: {
        type: "string",
        description: "Absolute path to the file to unlock",
      },
      agent_id: {
        type: "string",
        description: "Identifier of the agent releasing the lock",
      },
    },
    required: ["filepath", "agent_id"],
  },
};

export const TOOL_LOCK_STATUS: Tool = {
  name: "amanah_lock_status",
  description:
    "Check the current Amanah lock status of a file. " +
    "Returns: locked (bool), held_by, intent, expires_at, ms_remaining.",
  inputSchema: {
    type: "object",
    properties: {
      filepath: {
        type: "string",
        description: "Absolute path to the file to inspect",
      },
    },
    required: ["filepath"],
  },
};

export const TOOL_LIST_LOCKS: Tool = {
  name: "amanah_list_locks",
  description:
    "List all active Amanah locks in the ledger. For sovereign audit only.",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

export const TOOL_FORCE_RELEASE: Tool = {
  name: "amanah_force_release",
  description:
    "Sovereign override: force-release all locks on a filepath. " +
    "Requires sovereign authorization. Logs the override event.",
  inputSchema: {
    type: "object",
    properties: {
      filepath: {
        type: "string",
        description: "Absolute path to the file to unlock by force",
      },
      authorized_by: {
        type: "string",
        description: "Identity of the sovereign authorizing the release",
      },
    },
    required: ["filepath", "authorized_by"],
  },
};

// ── Handler dispatch ──────────────────────────────────────────────

export async function handle AmanahLock(
  tool: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  switch (tool) {
    case "amanah_request_lock": {
      const { filepath, agent_id, intent, ttl_ms } = args as {
        filepath: string;
        agent_id: string;
        intent: string;
        ttl_ms?: number;
      };
      return await lock.acquire(filepath, agent_id, intent, ttl_ms ?? 60_000);
    }
    case "amanah_release_lock": {
      const { filepath, agent_id } = args as {
        filepath: string;
        agent_id: string;
      };
      return await lock.release(filepath, agent_id);
    }
    case "amanah_lock_status": {
      const { filepath } = args as { filepath: string };
      return await lock.status(filepath);
    }
    case "amanah_list_locks": {
      return { verdict: "SEAL", locks: await lock.listLocks() };
    }
    case "amanah_force_release": {
      const { filepath, authorized_by } = args as {
        filepath: string;
        authorized_by: string;
      };
      return await lock.forceRelease(filepath, authorized_by);
    }
    default:
      return { verdict: "VOID", message: `Unknown Amanah tool: ${tool}` };
  }
}