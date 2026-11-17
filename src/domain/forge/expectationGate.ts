export type ExpectationTier = "irreversible" | "reversible" | "none";
export interface ExpectationGateResult { ok: boolean; tier: ExpectationTier; declared: boolean; refusalCause?: string; }
const IRREVERSIBLE_CLASSES = new Set(["IRREVERSIBLE","EXECUTE_HIGH_IMPACT","ATOMIC"]);
const REVERSIBLE_CLASSES = new Set(["EXECUTE_REVERSIBLE","MUTATE"]);
export function expectationTier(ac: string): ExpectationTier {
  if (IRREVERSIBLE_CLASSES.has(ac)) return "irreversible";
  if (REVERSIBLE_CLASSES.has(ac)) return "reversible";
  return "none";
}
export function hasDeclaredExpectation(args: Record<string,unknown>): boolean {
  const a = args || {};
  if (typeof a.expected_effect === "string" && a.expected_effect.trim().length > 0) return true;
  if (a.acknowledge_no_expectation === true) return true;
  const ex = a.expect;
  if (ex && typeof ex === "object") { const e = ex as Record<string,unknown>; if (e.sha256_post||e.sha256_pre||e.exists!==undefined||e.absent!==undefined||e.lines_delta!==undefined||e.target) return true; }
  if (a.expect_sha256 || a.expect_sha256_post || a.expect_exists === true || a.expect_absent === true) return true;
  return false;
}
export function checkExpectedEffect(actionClass: string, args: Record<string,unknown>): ExpectationGateResult {
  const tier = expectationTier(actionClass);
  if (tier === "none") return { ok: true, tier, declared: true };
  const enforce = Number(process.env.FORGE_EXPECT_ENFORCE ?? "1");
  const declared = hasDeclaredExpectation(args);
  if (declared) return { ok: true, tier, declared };
  const hardRefuse = enforce !== 0 && (tier === "irreversible" || enforce >= 2);
  if (hardRefuse) return { ok: false, tier, declared: false, refusalCause: "NO_EXPECTED_STATE_DECLARED" };
  return { ok: true, tier, declared: false };
}
export function expectationRefusal(actionClass: string, tier: string) {
  return { content: [{ type: "text" as const, text: JSON.stringify({ error:"EXPECTATION_GATE", verdict:"HOLD", message:"No declared measurable expected effect. Consequential mutation refused before execution.", action_class: actionClass, tier, gate:"EXPECTATION", refusal_cause:"NO_EXPECTED_STATE_DECLARED", next_action:"Declare expected_effect, expect.* (sha256_post/exists/absent/lines_delta/target), or set acknowledge_no_expectation=true to record an unmeasurable mutation." }, null, 2) }], isError: true };
}
