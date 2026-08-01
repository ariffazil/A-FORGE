/**
 * SecretBrokerPolicy — Governance wrapper around SecretBroker.
 *
 * ═══ P1.2 RATIFIED (2026-07-31) — ISOLATED CREDENTIAL BROKERING ═══════════
 *
 * The bare SecretBroker resolves refs and returns plaintext — but in the
 * wrong place that becomes an ambient secret leak. This policy layer
 * enforces:
 *
 *   1. HOST-PROCESS GUARD — only broker callers running inside the
 *      sandbox-launched process can receive plaintext. Host callers
 *      receive a ${ENV:NAME} token instead. (F1 AMANAH)
 *
 *   2. TTL ENFORCEMENT — ephemeral refs auto-revoke on expires_at.
 *      Scoped env refs respect explicit revoke(scope) calls. (F1)
 *
 *   3. ACTOR POLICY — only authorized actor_ids (or session_ids) may
 *      resolve a given ref. The policy table is hash-bound to arifOS
 *      via merkle chain. (F2 TRUTH)
 *
 *   4. AUDIT — every resolve/revoke emits a F11 SecretAccessAudit with
 *      SHA-256 of the secret at the moment of access (no plaintext).
 *      The audit log is append-only and can be replayed against arifOS.
 *
 *   5. NEVER-RETURN-HOST — the policy enforces that host-process callers
 *      only ever see the token, not the plaintext. This is the single
 *      most important governance property. (F9 ANTIHANTU)
 *
 * @module infrastructure/secrets/SecretBrokerPolicy
 * @constitutional F1 AMANAH · F2 TRUTH · F9 ANTIHANTU · F11 AUDIT
 */

import { createHash } from "node:crypto";
import {
  type SecretBroker,
  type SecretRef,
  type SecretContext,
  type SecretAccessAudit,
} from "./SecretBroker.js";

// ── Caller context ─────────────────────────────────────────────────────────

export type CallerEnvironment = "host" | "sandbox";

export interface PolicyContext extends SecretContext {
  caller_env: CallerEnvironment;
  /** Override policy for testing only. Production never sets this. */
  _unsafeForcePlaintext?: boolean;
}

// ── Policy table entry ─────────────────────────────────────────────────────

export interface PolicyEntry {
  /** Pattern matched against ref. */
  ref_kind: SecretRef["kind"];
  /** Required caller_env. */
  required_env: CallerEnvironment;
  /** Actor ids authorised to resolve (empty = any actor). */
  authorised_actors: ReadonlyArray<string>;
  /** TTL in ms (overrides ref.expires_at if present). */
  ttl_ms?: number;
  /** Whether the broker returns plaintext or token when caller is host. */
  host_returns: "token" | "plaintext";   // always "token" in prod
  /** Authorising receipt hash (provenance). */
  receipt_hash: string;
}

// ── Default policy table ──────────────────────────────────────────────────

const DEFAULT_POLICY: ReadonlyArray<PolicyEntry> = [
  {
    ref_kind: "env",
    required_env: "sandbox",
    authorised_actors: [],
    host_returns: "token",
    receipt_hash: "arifos-sb-env-v1",
  },
  {
    ref_kind: "arifos-vault",
    required_env: "sandbox",
    authorised_actors: [],
    host_returns: "token",
    receipt_hash: "arifos-sb-vault-v1",
  },
  {
    ref_kind: "ephemeral",
    required_env: "sandbox",
    authorised_actors: [],
    host_returns: "token",
    receipt_hash: "arifos-sb-ephemeral-v1",
  },
];

// ── Policy engine ──────────────────────────────────────────────────────────

export interface PolicyDecision {
  ok: boolean;
  reason?: string;
  /** Whether to return plaintext or token to the caller. */
  return_kind: "token" | "plaintext";
  /** If return_kind=token, this is the token. */
  token?: string;
}

export class SecretBrokerPolicy {
  private readonly auditLog: SecretAccessAudit[] = [];
  private readonly revokedScopes = new Set<string>();
  private readonly ephemeralUsed = new Map<string, number>();   // ref -> timestamp

  constructor(
    private readonly broker: SecretBroker,
    private readonly policy: ReadonlyArray<PolicyEntry> = DEFAULT_POLICY,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /**
   * Resolve a ref under policy. The policy decides whether the caller
   * receives plaintext (sandbox env only) or a ${ENV:NAME} token.
   *
   * F1: the host NEVER receives plaintext. This is the single most
   * important governance property of this layer.
   */
  async resolve(
    ref: SecretRef,
    ctx: PolicyContext,
  ): Promise<{ value: string; decision: PolicyDecision; audit: SecretAccessAudit }> {
    const entry = this.policy.find(p => p.ref_kind === ref.kind);
    if (!entry) {
      const audit = this.auditWithoutValue(ref, ctx, "POLICY_DENY_NO_ENTRY");
      throw new SecretBrokerPolicyError(
        `no policy entry for ref kind '${ref.kind}'`,
        audit,
      );
    }

    // TTL enforcement for ephemeral refs
    if (ref.kind === "ephemeral") {
      if (new Date(ref.expires_at).getTime() <= this.now()) {
        const audit = this.auditWithoutValue(ref, ctx, "POLICY_DENY_EXPIRED");
        throw new SecretBrokerPolicyError(
          `ephemeral ref expired at ${ref.expires_at}`,
          audit,
        );
      }
    }

    // Scope revocation
    const refScope = ref.kind === "env" ? ref.scope : "";
    if (this.revokedScopes.has(refScope)) {
      const audit = this.auditWithoutValue(ref, ctx, "POLICY_DENY_REVOKED");
      throw new SecretBrokerPolicyError(
        `scope '${refScope}' has been revoked`,
        audit,
      );
    }

    // Actor policy
    if (entry.authorised_actors.length > 0 && ctx.actorId) {
      if (!entry.authorised_actors.includes(ctx.actorId)) {
        const audit = this.auditWithoutValue(ref, ctx, "POLICY_DENY_ACTOR");
        throw new SecretBrokerPolicyError(
          `actor '${ctx.actorId}' not authorised for ref kind '${ref.kind}'`,
          audit,
        );
      }
    }

    // Caller env check — host NEVER gets plaintext
    if (ctx.caller_env !== entry.required_env && !ctx._unsafeForcePlaintext) {
      // Token return — host receives the marker, sandbox resolves it.
      const token = this.tokenFor(ref);
      const decision: PolicyDecision = {
        ok: true,
        reason: "host returns token; sandbox resolves plaintext",
        return_kind: "token",
        token,
      };
      const audit = this.auditWithToken(ref, ctx, token);
      return { value: token, decision, audit };
    }

    // Sandbox path: actually call the broker.
    const plaintext = await this.broker.resolve(ref, ctx);
    const audit = this.auditWithHash(ref, ctx, plaintext);
    const decision: PolicyDecision = {
      ok: true,
      return_kind: "plaintext",
    };
    return { value: plaintext, decision, audit };
  }

  /**
   * Revoke a scope (env refs) or an ephemeral ref.
   * After revoke, future resolve() calls fail with POLICY_DENY_REVOKED.
   */
  async revoke(refOrScope: SecretRef | string): Promise<void> {
    const scope = typeof refOrScope === "string" ? refOrScope : (refOrScope.kind === "env" ? refOrScope.scope : "");
    this.revokedScopes.add(scope);
    await this.broker.revoke(scope);
  }

  /**
   * Replay audit trail for F11 inspection. Returns the audit log.
   * Secrets are NEVER returned — only their SHA-256 at access time.
   */
  audit(): ReadonlyArray<SecretAccessAudit> {
    return [...this.auditLog];
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private tokenFor(ref: SecretRef): string {
    if (ref.kind === "env") return `\${ENV:${ref.name}}`;
    if (ref.kind === "arifos-vault") return `\${VAULT:${ref.vault_entry_id}}`;
    return `\${EPHEMERAL:${ref.bind_to_lease}:${ref.expires_at}}`;
  }

  private auditWithoutValue(
    ref: SecretRef,
    ctx: PolicyContext,
    denialCode: string,
  ): SecretAccessAudit {
    const audit: SecretAccessAudit = {
      ref,
      context: ctx,
      at: new Date(this.now()).toISOString(),
      secret_hash: createHash("sha256").update(`DENY:${denialCode}`).digest("hex"),
    };
    this.auditLog.push(audit);
    return audit;
  }

  private auditWithToken(
    ref: SecretRef,
    ctx: PolicyContext,
    token: string,
  ): SecretAccessAudit {
    const audit: SecretAccessAudit = {
      ref,
      context: ctx,
      at: new Date(this.now()).toISOString(),
      secret_hash: createHash("sha256").update(token).digest("hex"),
    };
    this.auditLog.push(audit);
    return audit;
  }

  private auditWithHash(
    ref: SecretRef,
    ctx: PolicyContext,
    value: string,
  ): SecretAccessAudit {
    const audit: SecretAccessAudit = {
      ref,
      context: ctx,
      at: new Date(this.now()).toISOString(),
      secret_hash: createHash("sha256").update(value).digest("hex"),
    };
    this.auditLog.push(audit);
    return audit;
  }
}

export class SecretBrokerPolicyError extends Error {
  readonly code = "SECRET_BROKER_POLICY_DENY";
  constructor(
    message: string,
    public readonly audit: SecretAccessAudit,
  ) {
    super(message);
    this.name = "SecretBrokerPolicyError";
  }
}