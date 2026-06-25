/**
 * External Action Receipt Client (TypeScript)
 * ════════════════════════════════════════════════════════════════════════════
 * Purpose:  Writes to `public.external_action_receipt` in Supabase — the L4
 *           record type for external side-effects (Hostinger, Cloudflare,
 *           GitHub, local-FS, etc.).
 *
 * Doctrine: AAA-SUPABASE-RECORD-DOCTRINE v1.0 §3.5
 *           "External action requires approval at TIER_3"
 *
 * Pattern:  writePending() → action runs → complete() with result
 *           fail-soft — never throws out of an action path.
 *
 * Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (loaded via vault.flat.env)
 *
 * DITEMPA BUKAN DIBERI — Receipt is forged, not given.
 * ════════════════════════════════════════════════════════════════════════════
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;
  if (!url || !key) {
    // fail-soft — log to stderr, return null
    process.stderr.write(
      "[receipt_client] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — receipts disabled\n"
    );
    return null;
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

export type ReceiptResult =
  | "success"
  | "failure"
  | "blocked"
  | "rolled_back"
  | "partial"
  | "pending";

export interface WriteReceiptInput {
  source_system: string;            // 'local_fs' | 'cloudflare' | 'github' | 'hostinger' | ...
  source_subdomain?: string;        // 'a-forge:file_ops' | 'hermes:cloudflare' | ...
  action_type: string;              // 'file_write' | 'dns_update' | 'pr_merge' | ...
  target: string;                   // resource affected
  parameters?: Record<string, unknown>;
  result?: ReceiptResult;           // default 'pending' if writing before action
  risk_tier?: number;               // 1-5
  floor_refs?: string[];            // ['F1','F11','F13']
  ack_irreversible?: boolean;
  approval_ticket_id?: string | null;
  human_ratifier?: string | null;
  session_id?: string | null;
  trace_id?: string | null;
  actor_id?: string;
  metadata?: Record<string, unknown>;
}

export interface CompleteReceiptInput {
  receipt_id: string;
  result: Exclude<ReceiptResult, "pending">;
  external_reference?: string | null;
  error_message?: string | null;
  duration_ms?: number | null;
}

/**
 * Write a pending receipt BEFORE the action runs. Returns receipt_id (UUID)
 * on success, null on failure. Never throws — fail-soft.
 */
export async function writePending(input: WriteReceiptInput): Promise<string | null> {
  const sb = getClient();
  if (!sb) return null;

  const row = {
    source_system: input.source_system,
    source_subdomain: input.source_subdomain ?? null,
    action_type: input.action_type,
    target: input.target,
    parameters: input.parameters ?? {},
    result: input.result ?? "pending",
    actor_id: input.actor_id ?? "a-forge:unknown",
    risk_tier: input.risk_tier ?? 1,
    floor_refs: input.floor_refs ?? [],
    ack_irreversible: input.ack_irreversible ?? false,
    approval_ticket_id: input.approval_ticket_id ?? null,
    human_ratifier: input.human_ratifier ?? null,
    session_id: input.session_id ?? null,
    trace_id: input.trace_id ?? null,
    metadata: input.metadata ?? {},
    payload_hash: "", // trigger auto-computes
  };

  try {
    const { data, error } = await sb
      .from("external_action_receipt")
      .insert(row)
      .select("receipt_id")
      .single();

    if (error) {
      process.stderr.write(
        `[receipt_client] INSERT error: ${error.message}\n`
      );
      return null;
    }
    return data?.receipt_id ?? null;
  } catch (e: any) {
    process.stderr.write(`[receipt_client] INSERT exception: ${e?.message ?? e}\n`);
    return null;
  }
}

/**
 * Update a receipt AFTER the action completes. Returns true on success.
 * Never throws — fail-soft.
 */
export async function complete(input: CompleteReceiptInput): Promise<boolean> {
  const sb = getClient();
  if (!sb) return false;

  const update: Record<string, unknown> = {
    result: input.result,
    external_reference: input.external_reference ?? null,
    error_message: input.error_message ?? null,
    completed_at: new Date().toISOString(),
  };
  if (input.duration_ms != null) {
    update.metadata = { duration_ms: input.duration_ms };
  }

  try {
    const { error } = await sb
      .from("external_action_receipt")
      .update(update)
      .eq("receipt_id", input.receipt_id);

    if (error) {
      process.stderr.write(
        `[receipt_client] UPDATE error: ${error.message}\n`
      );
      return false;
    }
    return true;
  } catch (e: any) {
    process.stderr.write(`[receipt_client] UPDATE exception: ${e?.message ?? e}\n`);
    return false;
  }
}

/**
 * One-shot helper: write a "blocked" receipt (no before/after split).
 * Used when an action is REJECTED at the gate level — record the attempt + reason.
 */
export async function logBlocked(input: Omit<WriteReceiptInput, "result"> & { reason: string }): Promise<string | null> {
  const rid = await writePending({ ...input, result: "pending" });
  if (!rid) return null;
  await complete({ receipt_id: rid, result: "blocked", error_message: input.reason });
  return rid;
}