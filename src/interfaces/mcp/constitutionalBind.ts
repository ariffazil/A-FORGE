/**
 * constitutionalBind.ts — fail-closed binding gate for forge_shell mutations.
 * Forged 2026-10-31 under ARIFOS::AUTHORIZATION_GRANT::AFORGE_BIND_GATE::2026-10-31
 *
 * Rule: a mutation may not reach the executor unless every one of the five
 * objects is present, fresh, exact and scope-matched. Anything else refuses
 * with a structured reason. There is no warn mode and no bypass flag.
 */
import { createHash } from "node:crypto";

export type Refusal = { blocked: true; code: string; reasons: string[] };
export type BindVerdict = Refusal | { blocked: false };

const READ_ONLY_PREFIXES = [
  "ls", "cat", "head", "tail", "wc", "grep", "rg", "stat", "df", "du", "ps", "whoami",
  "date", "sha256sum", "md5sum", "jq", "echo", "printf", "true", "pwd", "which",
  "git status", "git log", "git diff", "git show", "git rev-parse", "git ls-files",
  "systemctl status", "systemctl is-active", "systemctl list-units", "docker ps",
  "docker logs", "curl -s", "curl --silent", "node --version", "python3 --version",
];

export function isReadOnlyCommand(command: string): boolean {
  const c = command.trim().replace(/^sudo\s+/, "");
  return READ_ONLY_PREFIXES.some((p) => c === p || c.startsWith(p + " "));
}

function canon(o: any): string {
  const walk = (v: any): any => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: any = {};
      for (const k of Object.keys(v).sort()) out[k] = walk(v[k]);
      return out;
    }
    return v;
  };
  return JSON.stringify(walk(o));
}

/** plan_hash over the executable body only — operations/targets/preconditions/verification/rollback. */
export function computePlanHash(plan: any): string {
  if (!plan) return "";
  const body = {
    operations: plan.operations,
    targets: plan.targets,
    preconditions: plan.preconditions,
    verification: plan.verification,
    rollback: plan.rollback,
  };
  return createHash("sha256").update(canon(body)).digest("hex");
}

const consumedGrants = new Set<string>();

const MAX_BASELINE_AGE_MS = 6 * 60 * 60 * 1000; // 6h freshness policy

/** Refuse unless the five objects bind to this exact operation and target. */
export function evaluateConstitutionalBind(toolName: string, args: any, nowMs: number = Date.now()): BindVerdict {
  if (toolName !== "forge_shell" && toolName !== "forge_shell_dryrun") return { blocked: false };
  const command = String(args?.command ?? "");
  if (isReadOnlyCommand(command)) return { blocked: false };

  const b = args?.constitutional_binding;
  if (!b || typeof b !== "object") {
    return {
      blocked: true,
      code: "BINDING_ABSENT",
      reasons: ["mutation-class forge_shell requires args.constitutional_binding {intent,baseline,plan,risk,grant}"],
    };
  }
  const { intent, baseline, plan, risk, grant } = b;
  const reasons: string[] = [];

  // A. TaskIntent
  for (const f of ["task_id", "objective", "constraints", "success_criteria", "owner",
    "baseline_ref", "plan_ref", "risk_ref", "authority_ref", "status"]) {
    if (!intent?.[f] || (Array.isArray(intent[f]) && intent[f].length === 0)) reasons.push(`intent.${f} missing`);
  }
  if (intent?.status === "VOID" || intent?.status === "HELD") reasons.push(`intent.status=${intent.status}`);

  // B. BaselineWitness
  if (!baseline) reasons.push("baseline missing");
  else {
    if (!Number.isInteger(baseline.examined_count) || baseline.examined_count <= 0) reasons.push("baseline.examined_count<=0 (nothing examined)");
    if (!Array.isArray(baseline.evidence_refs) || baseline.evidence_refs.length === 0) reasons.push("baseline.evidence_refs absent");
    if (!baseline.commit_or_state_hash) reasons.push("baseline.commit_or_state_hash missing");
    const t = Date.parse(baseline.observed_at || "");
    if (!Number.isFinite(t)) reasons.push("baseline.observed_at unparseable");
    else if (nowMs - t > MAX_BASELINE_AGE_MS) reasons.push("baseline stale (older than 6h)");
    if (baseline.baseline_id !== intent?.baseline_ref) reasons.push("baseline_id != intent.baseline_ref");
  }

  // C. ExecutionPlan
  if (!plan) reasons.push("plan missing");
  else {
    if (!plan.rollback) reasons.push("plan.rollback missing");
    if (computePlanHash(plan) !== plan.plan_hash) reasons.push("plan_hash does not match plan body (altered plan)");
    if (plan.plan_id !== intent?.plan_ref) reasons.push("plan_id != intent.plan_ref");
    if (!Array.isArray(plan.operations) || plan.operations.length === 0) reasons.push("plan.operations empty");
    if (!Array.isArray(plan.targets) || plan.targets.length === 0) reasons.push("plan.targets empty");
  }

  // D. RiskEnvelope
  if (!risk) reasons.push("risk envelope missing");
  else {
    if (!risk.blast_radius) reasons.push("risk.blast_radius missing");
    if (!risk.rollback_ref) reasons.push("risk.rollback_ref missing");
    if (risk.verdict !== "ALLOW") reasons.push(`risk.verdict=${risk.verdict} (must be ALLOW)`);
    if (risk.risk_id !== intent?.risk_ref) reasons.push("risk_id != intent.risk_ref");
  }

  // E. AuthorizationGrant
  if (!grant) reasons.push("authorization grant missing");
  else {
    if (grant.grant_id !== intent?.authority_ref) reasons.push("grant_id != intent.authority_ref");
    if (plan && grant.plan_hash !== plan.plan_hash) reasons.push("grant.plan_hash != plan.plan_hash");
    if (baseline && grant.baseline_id !== baseline.baseline_id) reasons.push("grant.baseline_id mismatch");
    if (grant.task_id !== intent?.task_id) reasons.push("grant.task_id mismatch");
    if (grant.single_use !== true) reasons.push("grant.single_use must be true");
    if (grant.revocation_state !== "active") reasons.push(`grant.revocation_state=${grant.revocation_state}`);
    const exp = Date.parse(grant.expires_at || "");
    if (!Number.isFinite(exp)) reasons.push("grant.expires_at unparseable");
    else if (exp <= nowMs) reasons.push("grant expired");
    if (!Array.isArray(grant.operations) || !grant.operations.includes("shell:mutate")) reasons.push("grant.operations does not include shell:mutate");
    if (!Array.isArray(grant.targets) || !grant.targets.includes("shell")) reasons.push("grant.targets does not include shell");
    // scope containment: the grant must cover every operation and target the plan named
    const gOps: string[] = Array.isArray(grant.operations) ? grant.operations : [];
    const gTgt: string[] = Array.isArray(grant.targets) ? grant.targets : [];
    for (const op of (plan?.operations ?? [])) if (!gOps.includes(op)) reasons.push(`plan operation outside grant scope: ${op}`);
    for (const tg of (plan?.targets ?? [])) if (!gTgt.includes(tg)) reasons.push(`plan target outside grant scope: ${tg}`);
    if (!grant.actor) reasons.push("grant.actor missing");
    if (!grant.executor || grant.executor !== "A-FORGE") reasons.push("grant.executor mismatch (must be A-FORGE)");
  }

  // single-use consumption: a grant may authorise exactly one execution
  if (grant?.grant_id) {
    if (consumedGrants.has(grant.grant_id)) reasons.push(`grant ${grant.grant_id} already consumed (single-use)`);
    else if (toolName === "forge_shell") consumedGrants.add(grant.grant_id);
  }

  if (reasons.length) return { blocked: true, code: "BINDING_INVALID", reasons };
  return { blocked: false };
}
