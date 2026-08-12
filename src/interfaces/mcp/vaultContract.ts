import { z } from "zod";

/**
 * Canonical forge_vault boundary shared by registration and contract tests.
 * Credential fields must survive parsing so the ingress gate can validate them;
 * they are deliberately excluded from persisted metadata.
 */
export const ForgeVaultInputSchema = z.object({
  mode: z.enum(["read", "list", "write", "receipt"]).describe(
    "Vault operation (read|list|write|receipt). For VAULT999 sealing, use arifOS arif_seal (port 8088).",
  ),
  name: z.string().optional().describe("Record name (read/write/receipt)"),
  category: z.string().optional().describe(
    "Category filter (list) / Record category (write/receipt)",
  ),
  limit: z.number().optional().describe("Max records (list, default 100)"),
  value: z.string().optional().describe("Record value (write/receipt)"),
  content: z.string().optional().describe("Canonical receipt content; alias of value"),
  reason: z.string().optional().describe("Receipt reason (for example SESSION_CLOSE)"),
  tier: z.string().optional().describe("Receipt tier (for example session.ledger)"),
  actor_id: z.string().optional().describe("Actor issuing the receipt"),
  session_id: z.string().optional().describe("Governed session ID"),
  session_token: z.string().optional().describe("Governed session capability token"),
  sct: z.string().optional().describe("Alias for session_token"),
  lease_id: z.string().optional().describe("Governed lease ID"),
  metadata: z.record(z.string(), z.unknown()).optional().describe(
    "Optional metadata (write/receipt)",
  ),
});

export type ForgeVaultInput = z.infer<typeof ForgeVaultInputSchema>;

export function vaultRecordValue(input: ForgeVaultInput): string | undefined {
  return input.value ?? input.content;
}

export function vaultRecordMetadata(
  input: ForgeVaultInput,
  mode: "write" | "receipt",
): Record<string, unknown> {
  return {
    ...(input.metadata ?? {}),
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.tier ? { tier: input.tier } : {}),
    ...(input.actor_id ? { actor_id: input.actor_id } : {}),
    ...(input.session_id ? { session_id: input.session_id } : {}),
    _receipt: mode === "receipt",
    _receipt_ts: new Date().toISOString(),
  };
}
