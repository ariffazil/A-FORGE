/**
 * 777 Verification Obligation — the consequence-closure primitive.
 *
 * F13 ruling 2026-10-02 (build order #1): every consequential 777 action
 * MUST create a future verification obligation. Receipt ≠ Outcome.
 * 777 → Obligation → Reality → 888 → 999. Never 777 → 999 direct.
 *
 * Lane B (temporal): obligations are POSTed to arifFlow :7073/ingest —
 * the metabolic hash-chained ledger — so CHRON's bridge and FQ monitoring
 * see every open obligation. Fail-open by design: minting NEVER blocks
 * execution; a dead metabolism lane is logged, not fatal (F1: the action
 * already happened; suppressing its record would be the worse sin).
 *
 * v1 honesty: obligations minted at the runStage wrapper carry
 * expected_effect="UNDECLARED_BY_CALLER" unless the tool result embeds one.
 * UNDECLARED is a MEASURED signal (how many executions fly blind), not a
 * hidden gap. Schema-level expected_effect fields land with the next
 * forge_execute contract release.
 *
 * @module forge/verificationObligation
 * @constitutional F13 ruling 2026-10-02 · three-lane contract (B=temporal)
 */

const ARIFFLOW_INGEST_URL =
  process.env.ARIFFLOW_INGEST_URL ?? "http://127.0.0.1:7073/ingest";
const OBLIGATION_TTL_HOURS = Number(process.env.FORGE_OBLIGATION_TTL_H ?? 24);

export interface VerificationObligation {
  intervention_id: string;
  created_at: string;
  verify_at: string;
  stage: string;
  tool: string;
  task_excerpt: string;
  expected_effect: string;
  success_criteria: string;
  failure_criteria: string;
  rollback_ref: string;
  owner: string;
  blast_radius: string;
  reversibility: string;
  status: "OPEN";
}

function excerpt(s: unknown, n = 160): string {
  const t = typeof s === "string" ? s : JSON.stringify(s) ?? "";
  return t.slice(0, n).replace(/\s+/g, " ");
}

/** Extract the most obligation-relevant fields from an opaque 777 result. */
function probeResult(result: unknown): {
  tool: string;
  task: string;
  status: string;
  expected: string;
} {
  let tool = "unknown";
  let task = "";
  let status = "UNKNOWN";
  let expected = "UNDECLARED_BY_CALLER";
  try {
    const r = result as any;
    const text: string | undefined =
      r?.content?.[0]?.text ?? (typeof r === "string" ? r : undefined);
    const parsed = text ? (JSON.parse(text) as any) : r ?? {};
    tool = String(parsed.tool ?? parsed.tool_name ?? tool);
    task = String(parsed.task ?? parsed.command ?? parsed.description ?? "");
    status = String(parsed.status ?? parsed.verdict ?? status);
    if (parsed.expected_effect) expected = String(parsed.expected_effect);
  } catch {
    /* opaque result — keep defaults */
  }
  return { tool, task, status, expected };
}

/** Mint the obligation contract from a completed 777-stage execution. */
export function mintVerificationObligation(
  stage: string,
  result: unknown,
): VerificationObligation {
  const { tool, task, status, expected } = probeResult(result);
  const now = new Date();
  const verifyAt = new Date(now.getTime() + OBLIGATION_TTL_HOURS * 3600_000);
  return {
    intervention_id: `vo-${now.getTime().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    created_at: now.toISOString(),
    verify_at: verifyAt.toISOString(),
    stage,
    tool,
    task_excerpt: excerpt(task),
    expected_effect: expected,
    success_criteria: "observed system state matches expected_effect",
    failure_criteria: "observed system state diverges from expected_effect",
    rollback_ref: "see execution receipt (hash-chained in seal ledger)",
    owner: "calling-actor",
    blast_radius: "as-executed",
    reversibility: status === "OK" ? "per-receipt" : "n/a-failed",
    status: "OPEN",
  };
}

/**
 * POST the obligation to the arifFlow metabolic ledger (Lane B).
 * Fire-and-forget: resolves regardless; logs on failure. Never throws.
 */
export async function emitObligation(
  ob: VerificationObligation,
  sessionId?: string,
  actorId?: string,
): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(ARIFFLOW_INGEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        actor_id: actorId ?? "aforge-777",
        session_id: sessionId ?? "SEAL-forge-obligation",
        step_type: "Execute",
        step_number: 1,
        epistemic_label: "Specification",
        floor_verdict: "Pass",
        payload: { verification_obligation: ob },
      }),
    });
    clearTimeout(t);
    if (!res.ok) {
      console.warn(
        `[obligation] ingest HTTP ${res.status} — obligation ${ob.intervention_id} logged locally only`,
      );
      return false;
    }
    return true;
  } catch (e) {
    console.warn(
      `[obligation] ingest unreachable — obligation ${ob.intervention_id} logged locally only:`,
      e instanceof Error ? e.message : e,
    );
    return false;
  }
}
