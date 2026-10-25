/**
 * actionClassifier regression pins — H6 (2026-09-27).
 *
 * Born from the 333-AGI mutation-model audit (sovereign directive):
 *  - P1: forge_transfer_confirm (money) was EXECUTE_REVERSIBLE while its own
 *    comment said HIGH_IMPACT ("moved below" never executed) — silent lenient
 *    drift = CSA "safety co-option" class. Pinned HIGH_IMPACT forever below.
 *  - Ghost dual-classifications (github writers in two sets) — pinned to their
 *    severity-wins resolution.
 *  - Name drift (forge_cool, forge_compose live but unclassified → fail-closed
 *    HOLD blocked even reads) — pinned classified.
 *  - Fail-closed contract: unknown tool → unclassified (isClassifiedTool=false,
 *    policy gate forces HOLD) AND classified at the MUTATE floor.
 *
 * FEDERATION_HARDENING P1 (2026-10-25, sovereign directive) — deliberate
 * ratchet changes, each replacing an older pin:
 *  - Unknown-tool fallback is now the MUTATE floor (EXECUTE_REVERSIBLE), not
 *    IRREVERSIBLE: unknown tools are treated as mutation-capable, never as
 *    read-only. Fail-closed survives via isClassifiedTool=false → policy-gate
 *    HOLD (McpPolicyGate L4b) — the class fallback only shapes direct
 *    classifyTool() consumers.
 *  - auth_pipeline is no longer OBSERVE: its handler runs executePipeline()
 *    (lease → lock → runtime_verify → execute …) for any non-dry_run call.
 *  - Dead entries (forge_visual_seal, forge_github_create_issue) were removed
 *    from the classifier (registry-is-SOT) — pins updated to their live
 *    replacements.
 *
 * Any future edit that weakens these pins fails the build. Ratchet, not dial.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyTool,
  isClassifiedTool,
  requiresGovernance,
  requires888Hold,
} from "../src/domain/governance/actionClassifier.js";

test("H1: money/send/sealed-execute tools are EXECUTE_HIGH_IMPACT", () => {
  for (const t of ["forge_transfer_confirm", "forge_send_confirm", "forge_execute_sealed"]) {
    assert.equal(classifyTool(t), "EXECUTE_HIGH_IMPACT", `${t} must be HIGH_IMPACT (money/egress/sealed execution)`);
    assert.equal(requires888Hold(classifyTool(t)), true, `${t} must require 888_HOLD`);
    assert.equal(requiresGovernance(classifyTool(t)), true, `${t} must require governance`);
  }
});

test("H2: remote-repo file writer resolves to IRREVERSIBLE (severity floor)", () => {
  assert.equal(classifyTool("forge_github_create_or_update_file"), "IRREVERSIBLE");
  // P1 (2026-10-25): forge_github_create_issue is not on the live registry
  // (tools_sot.yaml 118) — its entry was removed as dead. The MUTATE floor
  // governs any reintroduction; it may never fall to OBSERVE.
  assert.equal(classifyTool("forge_github_create_issue"), "EXECUTE_REVERSIBLE");
  assert.equal(isClassifiedTool("forge_github_create_issue"), false);
});

test("H3: forge_predict stays OBSERVE (pure evidence tool, no session gating)", () => {
  assert.equal(classifyTool("forge_predict"), "OBSERVE");
  assert.equal(requiresGovernance("OBSERVE"), false);
});

test("H4: former name-drift tools are classified (no fail-closed HOLD on live surface)", () => {
  assert.equal(isClassifiedTool("forge_cool"), true);
  assert.equal(classifyTool("forge_cool"), "OBSERVE");
  assert.equal(isClassifiedTool("forge_compose"), true);
  // compose is mode-aware
  assert.equal(classifyTool("forge_compose", "status"), "OBSERVE");
  assert.equal(classifyTool("forge_compose", "analyze"), "OBSERVE");
  assert.equal(classifyTool("forge_compose", "execute"), "EXECUTE_REVERSIBLE");
  assert.equal(classifyTool("forge_compose", "cancel"), "EXECUTE_REVERSIBLE");
  // P1 (2026-10-25): auth_pipeline is NOT read-only — non-dry_run runs the
  // full AUTH pipeline. Only the dry_run validation path is OBSERVE.
  assert.equal(isClassifiedTool("auth_pipeline"), true);
  assert.equal(classifyTool("auth_pipeline"), "EXECUTE_REVERSIBLE");
  assert.equal(classifyTool("auth_pipeline", "dry_run"), "OBSERVE");
});

test("fail-closed contract: unknown tool → MUTATE floor, unclassified, gate HOLDs", () => {
  const unknown = "forge_definitely_not_a_real_tool_xyz";
  // P1 (2026-10-25): the fallback class is the MUTATE floor — unknown tools
  // are treated as mutation-capable (governed), never read-only.
  assert.equal(classifyTool(unknown), "EXECUTE_REVERSIBLE", "unknown tools must fall to the MUTATE floor");
  assert.equal(requiresGovernance(classifyTool(unknown)), true, "unknown tools must require governance");
  assert.equal(isClassifiedTool(unknown), false, "unknown tools must be interceptable by policy gate");
});

test("seals are IRREVERSIBLE (constitutional floor)", () => {
  for (const t of ["forge_seal", "arif_seal", "forge_github_create_or_update_file"]) {
    assert.equal(classifyTool(t), "IRREVERSIBLE", `${t} must never be downgraded`);
  }
});

test("mode-aware filesystem ladder: read < write < delete", () => {
  assert.equal(classifyTool("forge_filesystem", "read"), "OBSERVE");
  assert.equal(classifyTool("forge_filesystem", "grep"), "OBSERVE");
  assert.equal(classifyTool("forge_filesystem", "write"), "EXECUTE_REVERSIBLE");
  assert.equal(classifyTool("forge_filesystem", "patch"), "EXECUTE_REVERSIBLE");
  assert.equal(classifyTool("forge_filesystem", "delete"), "EXECUTE_HIGH_IMPACT");
  assert.equal(classifyTool("forge_filesystem"), "OBSERVE", "modeless pre-classification must not block reads");
});

test("mode-aware vault: append-only write is REVERSIBLE, read is OBSERVE", () => {
  assert.equal(classifyTool("forge_vault", "read"), "OBSERVE");
  assert.equal(classifyTool("forge_vault", "write"), "EXECUTE_REVERSIBLE");
  assert.equal(classifyTool("forge_vault"), "OBSERVE");
});

test("shell is governed EXECUTE_REVERSIBLE (T1 2026-07-19 pin)", () => {
  assert.equal(classifyTool("forge_shell"), "EXECUTE_REVERSIBLE");
  assert.equal(classifyTool("forge_shell_dryrun"), "OBSERVE");
  assert.equal(requiresGovernance(classifyTool("forge_shell")), true);
});

test("severity ordering: IRREVERSIBLE outranks every class", () => {
  const order = [
    "IRREVERSIBLE",
    "EXECUTE_HIGH_IMPACT",
    "EXECUTE_REVERSIBLE",
    "QUEUE",
    "DRAFT",
    "SIMULATE",
    "SUGGEST",
    "OBSERVE",
  ] as const;
  for (let i = 0; i < order.length - 1; i++) {
    assert.equal(
      requires888Hold(order[i]) || !requires888Hold(order[i + 1]),
      true,
      `888_HOLD must cover ${order[i]} at least as strictly as ${order[i + 1]}`
    );
  }
  assert.equal(requires888Hold("EXECUTE_HIGH_IMPACT"), true);
  assert.equal(requires888Hold("EXECUTE_REVERSIBLE"), false);
  assert.equal(requires888Hold("OBSERVE"), false);
});

test("P7: forge_lease request is a REQUEST, not an action (bootstrap-circularity fix 2026-10-20)", () => {
  // Failure class: authority-request paths were ranked against the very
  // authority they ask for. forge_lease request was EXECUTE_REVERSIBLE, so
  // raising a lease required already holding the class it grants. Nobody could
  // bootstrap out of OBSERVE and the autonomous receipt path (forge_vault,
  // IRREVERSIBLE) was silently unreachable for every agent — the lane existed
  // on paper and dead-ended in LEASE_CLASS_EXCEEDED.
  //
  // A-FORGE does not self-issue leases ("arifOS mints them"), so `request` is a
  // forward of a request and the DECISION stays with the kernel. It stays
  // session-gated: an unbound caller still fails. `revoke` is unchanged —
  // revoking live authority IS a mutation.
  assert.equal(classifyTool("forge_lease", "request"), "OBSERVE");
  assert.equal(classifyTool("forge_lease", "status"), "OBSERVE");
  assert.equal(classifyTool("forge_lease", "list"), "OBSERVE");
  assert.equal(classifyTool("forge_lease", "revoke"), "EXECUTE_REVERSIBLE");
});

// ── FEDERATION_HARDENING P1 pins (2026-10-25) ──────────────────────────────

test("P1: formerly-unclassified live tools now have explicit classes", () => {
  // Measured handler behaviour (forgeCompilerTools.ts / chainStateTools.ts):
  // chain_state reads only; the compiler lane tools write in-memory state.
  assert.equal(isClassifiedTool("forge_chain_state"), true);
  assert.equal(classifyTool("forge_chain_state"), "OBSERVE");
  for (const t of ["forge_compile_task", "forge_dispatch_lane", "forge_collect_evidence", "forge_seal_run"]) {
    assert.equal(isClassifiedTool(t), true, `${t} must be explicitly classified`);
    assert.equal(classifyTool(t), "EXECUTE_REVERSIBLE", `${t} must take the governed mutation class`);
    assert.equal(requiresGovernance(classifyTool(t)), true, `${t} must require session+lease`);
  }
});

test("P1: false-readonly closures — write modes may not hide behind an OBSERVE base", () => {
  // forge_policy: set/remove/save mutate the governed MCP policy store.
  assert.equal(classifyTool("forge_policy", "check"), "OBSERVE");
  assert.equal(classifyTool("forge_policy", "list"), "OBSERVE");
  assert.equal(classifyTool("forge_policy", "set"), "EXECUTE_REVERSIBLE");
  assert.equal(classifyTool("forge_policy", "remove"), "EXECUTE_REVERSIBLE");
  assert.equal(classifyTool("forge_policy", "save"), "EXECUTE_REVERSIBLE");
  // forge_scar: seal records a failure into the scar ledger — a write.
  assert.equal(classifyTool("forge_scar", "list"), "OBSERVE");
  assert.equal(classifyTool("forge_scar", "consult"), "OBSERVE");
  assert.equal(classifyTool("forge_scar", "seal"), "EXECUTE_REVERSIBLE");
  // forge_github: read modes OBSERVE; every other mode (pr create …) governed;
  // unknown mode takes the MUTATE floor — fail-closed, never OBSERVE.
  assert.equal(classifyTool("forge_github", "search"), "OBSERVE");
  assert.equal(classifyTool("forge_github", "get"), "OBSERVE");
  assert.equal(classifyTool("forge_github", "pr"), "EXECUTE_REVERSIBLE");
  assert.equal(classifyTool("forge_github", "definitely_unknown_mode"), "EXECUTE_REVERSIBLE");
  // forge_job: submit spawns a background job — an execution, not a query.
  assert.equal(classifyTool("forge_job", "status"), "OBSERVE");
  assert.equal(classifyTool("forge_job", "list"), "OBSERVE");
  assert.equal(classifyTool("forge_job", "submit"), "EXECUTE_REVERSIBLE");
  // forge_experience_trace appends to the trace store — governed, not OBSERVE.
  assert.equal(classifyTool("forge_experience_trace"), "EXECUTE_REVERSIBLE");
});

test("P1: arif_report (KERNEL cross-organ) — write modes governed, reads free", () => {
  assert.equal(isClassifiedTool("arif_report"), true);
  assert.equal(classifyTool("arif_report", "inbox"), "OBSERVE");
  assert.equal(classifyTool("arif_report", "stats"), "OBSERVE");
  assert.equal(classifyTool("arif_report", "report"), "EXECUTE_REVERSIBLE");
  assert.equal(classifyTool("arif_report", "ack"), "EXECUTE_REVERSIBLE");
  assert.equal(classifyTool("arif_report", "flush"), "EXECUTE_REVERSIBLE");
  // modeless (registration-time) takes the MUTATE floor — fail-closed.
  assert.equal(classifyTool("arif_report"), "EXECUTE_REVERSIBLE");
});
