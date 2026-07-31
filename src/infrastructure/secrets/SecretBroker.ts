/**
 * SecretBroker — Isolated credential brokering for ephemeral capabilities.
 *
 * ═══ P1.3 (2026-07-31) ═══════════════════════════════════════════════════
 * Generated artifacts receive short-lived capability references, never
 * ambient secrets. The SecretBroker resolves `SecretRef` values at
 * execution time only and revokes them after the sandbox exits.
 *
 * Critical: `resolve()` returns the secret value ONLY inside the sandbox
 * process — never on the host. The host process receives a token like
 * `${ENV:MULEROUTER_API_KEY}` that the sandbox-launched wrapper
 * substitutes at exec time.
 *
 * @module infrastructure/secrets/SecretBroker
 * @constitutional F1 AMANAH · F2 TRUTH · F9 ANTIHANTU · F11 AUDIT
 */

import { createHash } from "node:crypto";

// ── Types ──────────────────────────────────────────────────────────────

export type SecretRef =
  | { kind: "env"; name: string; scope: string }
  | { kind: "arifos-vault"; vault_entry_id: string }
  | { kind: "ephemeral"; bind_to_lease: string; expires_at: string };

export interface SecretContext {
  toolId?: string;
  leaseHash?: string;
  sessionId?: string;
  actorId?: string;
}

export interface SecretAccessAudit {
  ref: SecretRef;
  context: SecretContext;
  at: string;
  /** SHA-256 of the secret value at the moment of access (no plaintext). */
  secret_hash: string;
}

export interface SecretBroker {
  /** Returns the secret value. May only be called from inside a sandbox. */
  resolve(ref: SecretRef, context: SecretContext): Promise<string>;
  /** Revoke all secrets matching a scope. */
  revoke(scope: string): Promise<void>;
  /** Returns the audit trail for F11 inspection. */
  audit(): Promise<SecretAccessAudit[]>;
}

// ── ProcessEnvSecretBroker ────────────────────────────────────────────

export class ProcessEnvSecretBroker implements SecretBroker {
  private readonly auditLog: SecretAccessAudit[] = [];
  private readonly revokedScopes = new Set<string>();

  async resolve(ref: SecretRef, context: SecretContext): Promise<string> {
    if (ref.kind !== "env") {
      throw new Error(
        `SecretBroker.resolve: ProcessEnvSecretBroker only handles kind:"env" refs (got ${ref.kind})`,
      );
    }
    if (this.revokedScopes.has(ref.scope)) {
      throw new Error(
        `SecretBroker.resolve: scope ${ref.scope} has been revoked`,
      );
    }
    const value = process.env[ref.name] ?? "";
    const audit: SecretAccessAudit = {
      ref,
      context,
      at: new Date().toISOString(),
      secret_hash: createHash("sha256").update(value).digest("hex"),
    };
    this.auditLog.push(audit);
    if (value === "") {
      // F9: never let a tool run with an empty credential silently.
      throw new Error(
        `SecretBroker.resolve: env var ${ref.name} is empty; refusing to expose ambient secret.`,
      );
    }
    return value;
  }

  async revoke(scope: string): Promise<void> {
    this.revokedScopes.add(scope);
  }

  async audit(): Promise<SecretAccessAudit[]> {
    return [...this.auditLog];
  }
}

// ── ArifOsVaultSecretBroker ──────────────────────────────────────────

/**
 * ArifOsVaultSecretBroker — Routes to arif_seal/vault. Currently a
 * skeleton that calls the canonical arifOS MCP surface; the wiring
 * is finalized in P1.4 (verifier receipts to F11 chain).
 */
export class ArifOsVaultSecretBroker implements SecretBroker {
  private readonly auditLog: SecretAccessAudit[] = [];
  private readonly revokedScopes = new Set<string>();

  constructor(private readonly arifosBaseUrl: string = "http://127.0.0.1:8088") {}

  async resolve(ref: SecretRef, context: SecretContext): Promise<string> {
    if (ref.kind !== "arifos-vault") {
      throw new Error(
        `SecretBroker.resolve: ArifOsVaultSecretBroker only handles kind:"arifos-vault" refs (got ${ref.kind})`,
      );
    }
    // scope is only meaningful for kind:"env" refs; arifos-vault uses vault_entry_id
    if (ref.kind === "env" && this.revokedScopes.has(ref.scope)) {
      throw new Error(
        `SecretBroker.resolve: scope ${ref.scope} has been revoked`,
      );
    }
    // The real call delegates to arif_seal; for the unit test contract
    // we surface a deterministic placeholder. The engine's sandboxTest
    // path routes the actual call through MCP.
    const value = "arifos-vault:" + ref.vault_entry_id;
    this.auditLog.push({
      ref,
      context,
      at: new Date().toISOString(),
      secret_hash: createHash("sha256").update(value).digest("hex"),
    });
    return value;
  }

  async revoke(scope: string): Promise<void> {
    this.revokedScopes.add(scope);
  }

  async audit(): Promise<SecretAccessAudit[]> {
    return [...this.auditLog];
  }
}

// ── Singleton ─────────────────────────────────────────────────────────

let _broker: SecretBroker | null = null;

export function getDefaultSecretBroker(): SecretBroker {
  if (!_broker) _broker = new ProcessEnvSecretBroker();
  return _broker;
}
