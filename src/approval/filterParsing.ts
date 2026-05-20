import type { VaultVerdict } from "../vault/VaultClient.js";
import type { ApprovalTicket, TicketStatus } from "./TicketStore.js";

export const TICKET_STATUS_VALUES: readonly TicketStatus[] = [
  "PENDING",
  "DISPATCHED",
  "ACKED",
  "APPROVED",
  "REJECTED",
  "MODIFY_REQUIRED",
  "EXPIRED",
  "REPLAYED",
] as const;

export const RISK_LEVEL_VALUES: readonly ApprovalTicket["riskLevel"][] = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export const VAULT_VERDICT_VALUES: readonly VaultVerdict[] = [
  "SEAL",
  "HOLD",
  "SABAR",
  "VOID",
] as const;

function parseEnum<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  if (!value) return undefined;
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export function parseTicketStatus(value: string | undefined): TicketStatus | undefined {
  return parseEnum(value, TICKET_STATUS_VALUES);
}

export function parseRiskLevel(value: string | undefined): ApprovalTicket["riskLevel"] | undefined {
  return parseEnum(value, RISK_LEVEL_VALUES);
}

export function parseVaultVerdict(value: string | undefined): VaultVerdict | undefined {
  return parseEnum(value, VAULT_VERDICT_VALUES);
}

export function toQueryString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

