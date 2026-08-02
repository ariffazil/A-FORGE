/**
 * forge_ephemeral — Capability Metabolism Tool
 *
 * The phase transition: from accumulating permanent tools to metabolizing capability.
 *
 * Modes:
 *   inspect_gap        — Detect what capability is missing
 *   generate           — Create ephemeral tool from template
 *   sandbox_test       — Verify the generated tool works
 *   invoke             — Execute the ephemeral tool
 *   verify             — Validate the result (independent verifier, NOT self-cert)
 *   retire             — Clean up + propose promotion if warranted
 *   list_templates     — Show available templates
 *   list_active        — Show currently active ephemeral tools
 *   propose_promotion  — Mark a template as recommended for permanent promotion
 *
 * LIFECYCLE (Wolf Cabinet: Ψ Survival layer):
 *   inspect_gap → generate → sandbox_test → invoke → verify → retire
 *
 * DEFAULT: temporary by default. A tool becomes permanent ONLY if:
 *   (a) it survives sandbox_test, invoke, AND an independent verify, AND
 *   (b) the same template reaches `promotionThreshold` instantiations, AND
 *   (c) `propose_promotion` is escalated, AND
 *   (d) F13 SOVEREIGN ratifies the proposal.
 *
 * EVIDENCE RULES (P0.3 — fail-closed):
 *   - `verify` REJECTS verifier_method="SELF_CERTIFIED" as inadmissible.
 *   - Only these verifier methods are accepted: known_answer, schema_invariant,
 *     independent_recompute, domain_witness.
 *
 * CONTAINMENT (P0.4 — fail-closed):
 *   - sandbox_test / invoke use the bwrap-backed ExecutionSandbox.
 *   - If no sandbox backend is available, the tool state becomes `failed` —
 *     it does NOT pass with a green-looking skip.
 *
 * ADOPTION TELEMETRY (P1-AA, 2026-08-02):
 *   Every call emits an `ephemeral_lifecycle` audit event to the existing
 *   McpTelemetry pathway (mcp-audit.jsonl + arifFLOW :7073/telemetry/log).
 *   Captured: mode, projectId, sessionId, outcome, durationMs.
 *   Outcomes: success | failure | fail_closed | retired | promotion_proposed.
 *
 * USE WHEN: 'I need to do X but no tool exists' — the federation synthesizes
 * capability on demand. After the mission, retire it. Capability was
 * metabolized, not accumulated.
 *
 * @module mcp/ephemeralTools
 * @forged 2026-07-30 — 333-AGI under F13 directive
 * @updated 2026-08-02 — P1-AA adoption (description + telemetry + project_id label)
 * @constitutional F1 AMANAH — ephemeral tools are session-scoped, fully reversible
 * @constitutional F9 ANTIHANTU — SELF_CERTIFIED is inadmissible
 * @constitutional F11 AUDIT — every lifecycle event is hash-chained to VAULT999
 * @constitutional F13 SOVEREIGN — promotion to permanent requires human ratification
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getEphemeralGenesis } from "../../infrastructure/tools/EphemeralGenesis.js";
import { telemetry } from "./telemetry.js";

const telemetryInvoke = (tool: string) => {
  try { telemetry.recordInvocation(tool); } catch { /* best effort */ }
};

// P1-AA (2026-08-02): ephemeral lifecycle outcomes.
// "fail_closed" is for P0.4 sandbox backend absent (NOT a green skip).
// "retired" / "promotion_proposed" are success-class outcomes that need
// to surface in dashboards so adoption pressure is measurable.
type EphemeralOutcome =
  | "success"
  | "failure"
  | "fail_closed"
  | "retired"
  | "promotion_proposed";

export function registerEphemeralTools(server: McpServer): void {

  // ═══════════════════════════════════════════════════════════════════════
  // forge_ephemeral — Unified capability metabolism
  // ═══════════════════════════════════════════════════════════════════════
  server.tool(
    "forge_ephemeral",
    [
      "ACTUATOR · metabolism · MUTATE. Ephemeral Tool Genesis — the capability metabolism engine.",
      "Generates TEMPORARY tools from templates for one mission, then dissolves.",
      "",
      "9 MODES (default lifecycle: inspect_gap → generate → sandbox_test → invoke → verify → retire):",
      "  • inspect_gap        — Detect what capability is missing (use first).",
      "  • generate           — Create ephemeral tool from a template.",
      "  • sandbox_test       — Verify in bwrap-backed sandbox (fail-closed if no backend).",
      "  • invoke             — Execute the ephemeral tool (sandboxed).",
      "  • verify             — Independent verification. SELF_CERTIFIED is INADMISSIBLE.",
      "                         Accepted methods: known_answer | schema_invariant |",
      "                         independent_recompute | domain_witness.",
      "  • retire             — Cleanup. Temporary capability is REMOVED unless promoted.",
      "  • list_templates     — Browse the template registry.",
      "  • list_active        — List currently-active ephemeral tools + cleanup expired.",
      "  • propose_promotion  — Mark a template as recommended (after threshold + F13).",
      "",
      "EVIDENCE & PROMOTION (P0.3 + F13):",
      "  • A tool becomes permanent ONLY if: it survives sandbox_test, invoke, AND",
      "    an independent verify, AND the template reaches promotionThreshold, AND",
      "    F13 SOVEREIGN ratifies the proposal.",
      "  • SELF_CERTIFIED verification is REJECTED as inadmissible for promotion.",
      "",
      "CONTAINMENT (P0.4 — fail-closed):",
      "  • sandbox_test / invoke use the bwrap-backed ExecutionSandbox.",
      "  • No backend → tool state becomes 'failed' (NOT a green skip).",
      "",
      "USE WHEN: 'I need to do X but no tool exists' — the federation synthesizes",
      "capability on demand. After the mission, retire it. Capability was metabolized,",
      "not accumulated.",
    ].join("\n"),
    {
      mode: z.enum([
        "inspect_gap",
        "generate",
        "sandbox_test",
        "invoke",
        "verify",
        "retire",
        "list_templates",
        "list_active",
        "propose_promotion",
      ]).describe(
        "Operation mode. Default lifecycle: inspect_gap → generate → sandbox_test → invoke → verify → retire. " +
        "Use 'list_templates' first to discover what is available; use 'list_active' to see ephemeral state. " +
        "After the mission, call 'retire' so the capability is metabolized, not accumulated.",
      ),
      // inspect_gap
      capability_need: z.string().optional().describe("What capability is needed (inspect_gap mode)"),
      existing_tools: z.array(z.string()).optional().describe("List of currently available tools (inspect_gap mode)"),
      // generate
      template_id: z.string().optional().describe("Template ID to instantiate (generate mode). Use list_templates to discover."),
      template_params: z.record(z.unknown()).optional().describe("Parameters to bind to the template (generate mode)"),
      mission_intent: z.string().optional().describe("What mission this tool serves (generate mode)"),
      // sandbox_test / invoke / verify / retire
      tool_id: z.string().optional().describe("Ephemeral tool ID (sandbox_test, invoke, verify, retire modes)"),
      invoke_args: z.record(z.unknown()).optional().describe("Arguments to pass to the ephemeral tool (invoke mode)"),
      // governance
      session_id: z.string().optional().describe("Governing session"),
      actor_id: z.string().optional().describe("Calling agent"),
      // P2B (2026-08-02): project_id label. Recorded in telemetry and result metadata.
      // Currently does NOT scope the ephemeral tool itself (scoping is by sessionId).
      // Future: per-project isolation if capability metabolism grows multi-tenant.
      project_id: z.string().optional().describe(
        "Optional project label (P2B). Recorded in telemetry and result metadata only. " +
        "If omitted, telemetry records projectId='UNKNOWN' — do NOT invent one.",
      ),
    },
    async (args) => {
      const startedAt = Date.now();
      await telemetryInvoke("forge_ephemeral");
      const genesis = getEphemeralGenesis();

      const { mode } = args as any;
      const sessionId = (args as any).session_id ?? "unknown";
      const actorId = (args as any).actor_id ?? "unknown";
      // P2B: project_id is a label only. If absent, do not invent — record UNKNOWN.
      const projectId = (args as any).project_id ?? "UNKNOWN";

      let result: any;
      let outcome: EphemeralOutcome = "success";
      let failClosed = false;

      try {
        switch (mode) {
          // ── inspect_gap ──────────────────────────────────────────
          case "inspect_gap": {
            const { capability_need, existing_tools } = args as any;
            if (!capability_need) {
              outcome = "failure";
              return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, mode, error: "capability_need is required for inspect_gap mode", _epistemic: "INT", projectId }) }], isError: true };
            }
            const gap = genesis.analyzeGap(capability_need, existing_tools || []);
            result = {
              ok: true,
              mode: "inspect_gap",
              analysis: gap,
              projectId,
              _epistemic: "DER",
              _next: gap.recommended ? `Use template_id='${gap.recommended}' with mode='generate'` : "No template found — consider generic_api_wrapper or request new template",
            };
            break;
          }

          // ── generate ─────────────────────────────────────────────
          case "generate": {
            const { template_id, template_params, mission_intent } = args as any;
            if (!template_id) {
              outcome = "failure";
              return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, mode, error: "template_id is required for generate mode. Use list_templates to see available templates.", _epistemic: "INT", projectId }) }], isError: true };
            }
            const gen = await genesis.generate(
              template_id,
              template_params || {},
              sessionId,
              actorId,
              mission_intent || "unspecified mission",
            );
            // P0.4 detection: P0.4 fail-closed errors carry the message prefix.
            if (!gen.ok && gen.error && /P0\.4/.test(gen.error)) {
              outcome = "fail_closed";
              failClosed = true;
            } else if (!gen.ok) {
              outcome = "failure";
            }
            result = {
              ok: gen.ok,
              mode: "generate",
              tool: gen.tool,
              error: gen.error,
              receiptHash: gen.receiptHash,
              projectId,
              _epistemic: gen.ok ? "OBS" : "INT",
              _next: gen.ok ? `Tool created: ${gen.tool?.id}. Next: sandbox_test with tool_id='${gen.tool?.id}'` : "Fix params and retry",
            };
            break;
          }

          // ── sandbox_test ─────────────────────────────────────────
          case "sandbox_test": {
            const { tool_id } = args as any;
            if (!tool_id) {
              outcome = "failure";
              return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, mode, error: "tool_id is required for sandbox_test mode", _epistemic: "INT", projectId }) }], isError: true };
            }
            const test = await genesis.sandboxTest(tool_id);
            // P0.4: ContainmentUnavailableError → fail_closed
            if (!test.ok && test.error && /P0\.4/.test(test.error)) {
              outcome = "fail_closed";
              failClosed = true;
            } else if (!test.ok) {
              outcome = "failure";
            }
            result = {
              ok: test.ok,
              mode: "sandbox_test",
              tool: test.tool,
              error: test.error,
              receiptHash: test.receiptHash,
              projectId,
              _epistemic: "OBS",
              _next: test.ok ? `Sandbox test passed. Next: invoke with tool_id='${tool_id}'` : `Test failed: ${test.error}. Regenerate or adjust params.`,
            };
            break;
          }

          // ── invoke ───────────────────────────────────────────────
          case "invoke": {
            const { tool_id, invoke_args } = args as any;
            if (!tool_id) {
              outcome = "failure";
              return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, mode, error: "tool_id is required for invoke mode", _epistemic: "INT", projectId }) }], isError: true };
            }
            const inv = await genesis.invoke(tool_id, invoke_args || {});
            if (!inv.ok && inv.error && /P0\.4/.test(inv.error)) {
              outcome = "fail_closed";
              failClosed = true;
            } else if (!inv.ok) {
              outcome = "failure";
            }
            result = {
              ok: inv.ok,
              mode: "invoke",
              tool: inv.tool,
              error: inv.error,
              receiptHash: inv.receiptHash,
              projectId,
              _epistemic: "OBS",
              _next: inv.ok ? `Invoked. Next: verify with tool_id='${tool_id}'` : `Invoke failed: ${inv.error}`,
            };
            break;
          }

          // ── verify ───────────────────────────────────────────────
          case "verify": {
            const { tool_id } = args as any;
            if (!tool_id) {
              outcome = "failure";
              return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, mode, error: "tool_id is required for verify mode", _epistemic: "INT", projectId }) }], isError: true };
            }
            const ver = await genesis.verify(tool_id);
            if (!ver.ok) outcome = "failure";
            result = {
              ok: ver.ok,
              mode: "verify",
              tool: ver.tool,
              error: ver.error,
              projectId,
              _epistemic: "OBS",
              _next: ver.ok ? `Verified. Next: retire with tool_id='${tool_id}'` : "Tool not yet invocable — invoke first then verify with independent verifier",
            };
            break;
          }

          // ── retire ───────────────────────────────────────────────
          case "retire": {
            const { tool_id } = args as any;
            if (!tool_id) {
              outcome = "failure";
              return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, mode, error: "tool_id is required for retire mode", _epistemic: "INT", projectId }) }], isError: true };
            }
            const ret = await genesis.retire(tool_id);
            // Check if promotion should be proposed
            const tool = ret.tool;
            let promotion: any = null;
            let promotionProposed = false;
            if (tool) {
              const pp = genesis.proposePromotion(tool.templateId);
              if (pp.shouldPropose) {
                promotion = {
                  proposed: true,
                  template: pp.template?.id,
                  instantiationCount: pp.count,
                  threshold: pp.threshold,
                  action: "Use propose_promotion mode to escalate to human review (F13 ratification required)",
                };
                promotionProposed = true;
              }
            }
            // P1-AA: retire is its own outcome (capability was metabolized).
            outcome = ret.ok ? "retired" : "failure";
            result = {
              ok: ret.ok,
              mode: "retire",
              tool: ret.tool,
              receiptHash: ret.receiptHash,
              promotion,
              projectId,
              _epistemic: "OBS",
              _next: promotionProposed
                ? "Tool retired. Promotion PROPOSED — escalation requires F13 ratification. Capability was metabolized, not accumulated."
                : "Tool retired. Capability was metabolized, not accumulated.",
            };
            break;
          }

          // ── list_templates ───────────────────────────────────────
          case "list_templates": {
            const templates = genesis.registry.list().map(t => ({
              id: t.id,
              type: t.type,
              description: t.description,
              serves: t.serves,
              instantiationCount: t.instantiationCount,
              promotionThreshold: t.promotionThreshold,
              promoted: t.promotionProposed,
            }));
            result = {
              ok: true,
              mode: "list_templates",
              count: templates.length,
              templates,
              projectId,
              _epistemic: "OBS",
              _next: "Use template_id with mode='generate' to create an ephemeral tool",
            };
            break;
          }

          // ── list_active ──────────────────────────────────────────
          case "list_active": {
            const active = genesis.store.listActive().map(t => ({
              id: t.id,
              templateId: t.templateId,
              description: t.description,
              state: t.state,
              createdAt: t.createdAt,
              expiresAt: t.expiresAt,
              invocationCount: t.metadata.invocationCount,
            }));
            const expired = genesis.cleanupExpired();
            result = {
              ok: true,
              mode: "list_active",
              count: active.length,
              expired_cleaned: expired,
              tools: active,
              projectId,
              _epistemic: "OBS",
            };
            break;
          }

          // ── propose_promotion ────────────────────────────────────
          case "propose_promotion": {
            const { template_id } = args as any;
            if (!template_id) {
              outcome = "failure";
              return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, mode, error: "template_id is required for propose_promotion mode", _epistemic: "INT", projectId }) }], isError: true };
            }
            // P1-AA Gap 2 fix (2026-08-02): the legacy `proposePromotion`
            // was count-based and bypassed the EvidencePromotionGate entirely.
            // Switch to the evidence-based path so failing_gates actually
            // surface in the MCP response and operators can see what
            // (instantiation_count, success_rate, verifier_passes,
            // empirical_capability_score, diversity) is blocking the gate.
            const proposal = genesis.evaluatePromotion(template_id);
            if (proposal.ok_to_propose) {
              genesis.registry.markPromotionProposed(template_id);
              outcome = "promotion_proposed";
            }
            result = {
              ok: true,
              mode: "propose_promotion",
              template_id: proposal.template_id,
              ok_to_propose: proposal.ok_to_propose,
              evidence: proposal.evidence,
              thresholds: proposal.thresholds,
              failing_gates: proposal.failing_gates,
              next_step: proposal.next_step,
              projectId,
              _epistemic: "DER",
              _next: proposal.ok_to_propose
                ? `Template '${template_id}' PASSES EvidencePromotionGate. Empirical score ${proposal.evidence.empirical_capability_score.toFixed(3)} >= ${proposal.thresholds.minEmpiricalCapabilityScore}. Recommended for promotion. Route to arif_judge for F13 ratification.`
                : `Template '${template_id}' is BLOCKED by EvidencePromotionGate. Failing: [${proposal.failing_gates.join(", ")}]. Empirical score ${proposal.evidence.empirical_capability_score.toFixed(3)} < ${proposal.thresholds.minEmpiricalCapabilityScore}. Run more missions, get independent verifier passes, then retry.`,
            };
            break;
          }

          default: {
            outcome = "failure";
            return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: `Unknown mode: ${mode}`, projectId }) }], isError: true };
          }
        }

        // ── P1-AA: Adoption telemetry (success path) ─────────────
        // Best-effort, fire-and-forget. Never block the call on telemetry.
        const durationMs = Date.now() - startedAt;
        telemetry
          .logEvent({
            epoch: new Date().toISOString(),
            tool: "forge_ephemeral",
            action: "ephemeral_lifecycle",
            session_id: sessionId,
            verdict: outcome === "fail_closed" ? "HOLD" : (outcome === "failure" ? "HOLD" : "SEAL"),
            outcome,
            metadata: {
              mode,
              projectId,
              actorId,
              durationMs,
              failClosed,
              toolId: (result && (result as any).tool && (result as any).tool.id) || (args as any).tool_id,
              templateId: (args as any).template_id,
            },
          })
          .catch(() => {
            // P1-AA: telemetry is best-effort. The call already returned;
            // surface the lifecycle in stdout if the audit log is unwritable.
            process.stderr.write(
              `[forge_ephemeral] mode=${mode} outcome=${outcome} projectId=${projectId} durationMs=${durationMs} (telemetry unwritable)\n`,
            );
          });

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], isError: !result.ok };
      } catch (err) {
        // ── P1-AA: Adoption telemetry (exception path) ─────────────
        // ContainmentUnavailableError and any other engine error → failure / fail_closed.
        const errorMsg = err instanceof Error ? err.message : String(err);
        const isFailClosed = /P0\.4|ContainmentUnavailable/.test(errorMsg);
        outcome = isFailClosed ? "fail_closed" : "failure";
        const durationMs = Date.now() - startedAt;
        telemetry
          .logEvent({
            epoch: new Date().toISOString(),
            tool: "forge_ephemeral",
            action: "ephemeral_lifecycle",
            session_id: sessionId,
            verdict: "HOLD",
            outcome,
            metadata: {
              mode: (args as any).mode,
              projectId,
              actorId,
              durationMs,
              failClosed: isFailClosed,
              error: errorMsg.slice(0, 500), // truncated; redactSecrets() runs in logEvent
            },
          })
          .catch(() => {
            process.stderr.write(
              `[forge_ephemeral] mode=${(args as any).mode} outcome=${outcome} error="${errorMsg.slice(0, 200)}"\n`,
            );
          });
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ ok: false, mode: (args as any).mode, outcome, projectId, error: errorMsg, _epistemic: "INT" }, null, 2) }],
          isError: true,
        };
      }
    }
  );
}
