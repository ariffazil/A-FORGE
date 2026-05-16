/**
 * Supabase VAULT999 Client
 *
 * REST-based vault client using Supabase service_role_key.
 * Bypasses RLS to read/write vault records via RPC functions:
 *   vault_read(name)     → single record by name
 *   vault_list(category)  → records by category
 *   vault_write(...)     → create/update vault record
 *   vault_delete(name)   → delete vault record
 *
 * Complements PostgresVaultClient (local asyncpg writes) with
 * Supabase cloud read/list operations.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { VaultClient, VaultSealRecord, VaultVerdict } from "./VaultClient.js";

export interface VaultRecord {
  name: string;
  category: string;
  value: string;
  metadata?: Record<string, unknown>;
  is_encrypted?: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

let _supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_supabaseClient) return _supabaseClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) must be set");
  }

  _supabaseClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return _supabaseClient;
}

export class SupabaseVaultClient implements VaultClient {
  private readonly category?: string;

  constructor(category?: string) {
    this.category = category;
  }

  private get sb(): SupabaseClient {
    return getSupabaseClient();
  }

  async seal(record: VaultSealRecord): Promise<void> {
    await this.write({
      name: record.sealId ?? record.record_id ?? `seal-${Date.now()}`,
      category: "verdict",
      value: JSON.stringify({
        task: record.task,
        finalText: record.finalText,
        turnCount: record.turnCount,
        profileName: record.profileName,
        verdict: record.verdict,
        floors_triggered: record.floors_triggered,
        escalation: record.escalation,
        telemetrysnapshot: record.telemetrysnapshot,
      }),
      metadata: {
        sessionId: record.sessionId,
        verdict: record.verdict,
        turnCount: record.turnCount,
        floors_triggered: record.floors_triggered,
      },
    });
  }

  async read(name: string): Promise<VaultRecord | null> {
    const { data, error } = await this.sb.rpc("vault_read", { p_name: name });
    if (error) throw error;
    if (!data) return null;
    if (Array.isArray(data)) return (data as VaultRecord[])[0] ?? null;
    return data as VaultRecord;
  }

  async write(record: Omit<VaultRecord, "created_at" | "updated_at">): Promise<VaultRecord> {
    const { data, error } = await this.sb.rpc("vault_write", {
      p_name: record.name,
      p_category: record.category,
      p_value: record.value,
      p_metadata: record.metadata ?? {},
      p_is_encrypted: record.is_encrypted ?? false,
    });
    if (error) throw error;
    if (Array.isArray(data)) return data[0] ?? (data[0] satisfies VaultRecord);
    return data as unknown as VaultRecord;
  }

  async list(category?: string, limit = 100): Promise<VaultRecord[]> {
    const { data, error } = await this.sb.rpc("vault_list", {
      p_category: category ?? this.category ?? null,
      p_limit: limit,
    });
    if (error) throw error;
    if (!data) return [];
    if (Array.isArray(data)) return data as VaultRecord[];
    return [data as VaultRecord];
  }

  async delete(name: string): Promise<void> {
    const { error } = await this.sb.rpc("vault_delete", { p_name: name });
    if (error) throw error;
  }

  async query(options?: {
    sessionId?: string;
    verdict?: VaultVerdict;
    since?: string;
    until?: string;
    limit?: number;
  }): Promise<VaultSealRecord[]> {
    const category = options?.verdict ? `verdict_${options.verdict.toLowerCase()}` : "verdict";
    const records = await this.list(category, options?.limit ?? 100);
    return records
      .filter((r) => {
        if (options?.sessionId) {
          const meta = r.metadata as Record<string, unknown> | undefined;
          if (!meta || meta["sessionId"] !== options.sessionId) return false;
        }
        if (options?.since && r.created_at && r.created_at < options.since) return false;
        if (options?.until && r.created_at && r.created_at > options.until) return false;
        return true;
      })
      .map((r) => {
        const meta = r.metadata as Record<string, unknown> | undefined;
        const parsed = JSON.parse(r.value);
        return {
          sealId: r.name,
          record_id: r.name,
          sessionId: (meta?.["sessionId"] as string) ?? "",
          verdict: (meta?.["verdict"] as VaultVerdict) ?? "SEAL",
          hashofinput: "",
          telemetrysnapshot: parsed["telemetrysnapshot"] ?? { dS: 0, peace2: 0, psi_le: 0, W3: 0, G: 0 },
          floors_triggered: (meta?.["floors_triggered"] as string[]) ?? [],
          irreversibilityacknowledged: true,
          timestamp: r.created_at ?? new Date().toISOString(),
          task: parsed["task"] ?? "",
          finalText: parsed["finalText"] ?? "",
          turnCount: (meta?.["turnCount"] as number) ?? 0,
          profileName: parsed["profileName"] ?? "",
          escalation: parsed["escalation"],
        } satisfies VaultSealRecord;
      });
  }

  async findById(sealId: string): Promise<VaultSealRecord | undefined> {
    const record = await this.read(sealId);
    if (!record) return undefined;
    const meta = record.metadata as Record<string, unknown> | undefined;
    const parsed = JSON.parse(record.value);
    return {
      sealId: record.name,
      record_id: record.name,
      sessionId: (meta?.["sessionId"] as string) ?? "",
      verdict: (meta?.["verdict"] as VaultVerdict) ?? "SEAL",
      hashofinput: "",
      telemetrysnapshot: parsed["telemetrysnapshot"] ?? { dS: 0, peace2: 0, psi_le: 0, W3: 0, G: 0 },
      floors_triggered: (meta?.["floors_triggered"] as string[]) ?? [],
      irreversibilityacknowledged: true,
      timestamp: record.created_at ?? new Date().toISOString(),
      task: parsed["task"] ?? "",
      finalText: parsed["finalText"] ?? "",
      turnCount: (meta?.["turnCount"] as number) ?? 0,
      profileName: parsed["profileName"] ?? "",
      escalation: parsed["escalation"],
    };
  }
}