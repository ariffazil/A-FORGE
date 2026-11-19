import test from "node:test";
import assert from "node:assert/strict";
import { evaluateConstitutionalBind, computePlanHash, isReadOnlyCommand } from "../src/interfaces/mcp/constitutionalBind.js";

const NOW = Date.parse("2026-10-31T08:30:00Z");
function fixture(over: any = {}) {
  const plan: any = {
    plan_id: "P1", task_id: "T1",
    operations: ["shell:mutate"], targets: ["shell"],
    preconditions: ["backup taken"], verification: ["probe 200"], rollback: "restore backup",
  };
  plan.plan_hash = computePlanHash(plan);
  const base: any = {
    intent: { task_id: "T1", objective: "bounded canary", constraints: ["no push"], success_criteria: ["canary prints"],
      owner: "333-AGI", baseline_ref: "B1", plan_ref: "P1", risk_ref: "R1", authority_ref: "G1", status: "AUTHORIZED" },
    baseline: { baseline_id: "B1", subject: "aforge", commit_or_state_hash: "be07aeb6", observed_at: "2026-10-31T08:00:00Z",
      evidence_refs: ["ev-1"], freshness: "fresh", examined_count: 6, observer: "333-AGI" },
    plan,
    risk: { risk_id: "R1", task_id: "T1", blast_radius: "service", reversibility: "reversible",
      rollback_ref: "baseline-serve.ts", protected_boundaries: ["ledgers"], residual_risk: "low", verdict: "ALLOW" },
    grant: { grant_id: "G1", task_id: "T1", plan_hash: plan.plan_hash, baseline_id: "B1", actor: "ARIF",
      executor: "A-FORGE", operations: ["shell:mutate"], targets: ["shell"], resource_scope: "single_file",
      policy_version: "v1", issued_at: "2026-10-31T08:00:00Z", expires_at: "2026-10-31T10:00:00Z",
      single_use: true, revocation_state: "active" },
  };
  return { ...base, ...over };
}
const args = (b: any) => ({ command: "touch /tmp/aforge-canary", constitutional_binding: b });

test("01 valid bounded request is allowed", () => {
  assert.equal(evaluateConstitutionalBind("forge_shell", args(fixture()), NOW).blocked, false);
});
test("02 missing intent blocked", () => { assert.equal(evaluateConstitutionalBind("forge_shell", args({ ...fixture(), intent: undefined }), NOW).blocked, true); });
test("03 missing baseline blocked", () => { assert.equal(evaluateConstitutionalBind("forge_shell", args({ ...fixture(), baseline: undefined }), NOW).blocked, true); });
test("04 examined_count=0 blocked", () => { const f = fixture(); f.baseline.examined_count = 0; assert.equal(evaluateConstitutionalBind("forge_shell", args(f), NOW).blocked, true); });
test("05 stale baseline blocked", () => { const f = fixture(); f.baseline.observed_at = "2026-10-30T00:00:00Z"; assert.equal(evaluateConstitutionalBind("forge_shell", args(f), NOW).blocked, true); });
test("06 missing plan blocked", () => { assert.equal(evaluateConstitutionalBind("forge_shell", args({ ...fixture(), plan: undefined }), NOW).blocked, true); });
test("07 altered plan_hash blocked", () => { const f = fixture(); f.plan.operations = ["shell:mutate", "shell:restart"]; assert.equal(evaluateConstitutionalBind("forge_shell", args(f), NOW).blocked, true); });
test("08 missing risk blocked", () => { assert.equal(evaluateConstitutionalBind("forge_shell", args({ ...fixture(), risk: undefined }), NOW).blocked, true); });
test("09 risk HOLD blocked", () => { const f = fixture(); f.risk.verdict = "HOLD"; assert.equal(evaluateConstitutionalBind("forge_shell", args(f), NOW).blocked, true); });
test("10 missing rollback blocked", () => { const f = fixture(); delete f.plan.rollback; f.plan.plan_hash = computePlanHash(f.plan); assert.equal(evaluateConstitutionalBind("forge_shell", args(f), NOW).blocked, true); });
test("11 missing grant blocked", () => { assert.equal(evaluateConstitutionalBind("forge_shell", args({ ...fixture(), grant: undefined }), NOW).blocked, true); });
test("12 expired grant blocked", () => { const f = fixture(); f.grant.expires_at = "2026-10-31T09:00:00Z"; assert.equal(evaluateConstitutionalBind("forge_shell", args(f), Date.parse("2026-10-31T09:30:00Z")).blocked, true); });
test("13 revoked grant blocked", () => { const f = fixture(); f.grant.revocation_state = "revoked"; assert.equal(evaluateConstitutionalBind("forge_shell", args(f), NOW).blocked, true); });
test("14 target outside grant scope blocked", () => { const f = fixture(); f.plan.targets = ["shell", "/etc/hosts"]; f.plan.plan_hash = computePlanHash(f.plan); f.grant.plan_hash = f.plan.plan_hash; assert.equal(evaluateConstitutionalBind("forge_shell", args(f), NOW).blocked, true); });
test("15 operation outside grant scope blocked", () => { const f = fixture(); f.plan.operations = ["shell:mutate", "shell:write"]; f.plan.plan_hash = computePlanHash(f.plan); f.grant.plan_hash = f.plan.plan_hash; assert.equal(evaluateConstitutionalBind("forge_shell", args(f), NOW).blocked, true); });
test("16 executor mismatch blocked", () => { const f = fixture(); f.grant.executor = "OTHER"; assert.equal(evaluateConstitutionalBind("forge_shell", args(f), NOW).blocked, true); });
test("17 single-use not asserted blocked", () => { const f = fixture(); f.grant.single_use = false; assert.equal(evaluateConstitutionalBind("forge_shell", args(f), NOW).blocked, true); });
test("18 scope expansion after authorization blocked", () => { const f = fixture(); f.grant.operations = ["shell:mutate"]; f.plan.operations = ["shell:mutate", "shell:delete"]; f.plan.plan_hash = computePlanHash(f.plan); f.grant.plan_hash = f.plan.plan_hash; assert.equal(evaluateConstitutionalBind("forge_shell", args(f), NOW).blocked, true); });
test("19 read-only path still allowed (F1 protections untouched)", () => { assert.equal(isReadOnlyCommand("ls -la /tmp"), true); assert.equal(evaluateConstitutionalBind("forge_shell", { command: "git status --porcelain" }, NOW).blocked, false); });
test("20 refusal never reaches an executor", () => {
  let called = 0;
  const exec = () => { called++; return "ran"; };
  const v = evaluateConstitutionalBind("forge_shell", args({}), NOW);
  if (!v.blocked) exec();
  assert.equal(v.blocked, true);
  assert.equal(called, 0, "executor must not be called on refusal");
});
