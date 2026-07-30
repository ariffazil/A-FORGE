/**
 * forge_ephemeral — Capability Metabolism Tool
 *
 * The phase transition: from accumulating permanent tools to metabolizing capability.
 *
 * Modes:
 *   inspect_gap      — Detect what capability is missing
 *   generate         — Create ephemeral tool from template
 *   sandbox_test     — Verify the generated tool works
 *   invoke           — Execute the ephemeral tool
 *   verify           — Validate the result
 *   retire           — Clean up + propose promotion if warranted
 *   list_templates   — Show available templates
 *   list_active      — Show currently active ephemeral tools
 *
 * Wolf Cabinet: Ψ Survival layer — this is the mechanism by which the federation
 * adapts without accumulating permanent state.
 *
 * @module mcp/ephemeralTools
 * @forged 2026-07-30 — 333-AGI under F13 directive
 * @constitutional F1 AMANAH — ephemeral tools are session-scoped, fully reversible
 * @constitutional F13 SOVEREIGN — promotion to permanent requires human ratification
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getEphemeralGenesis } from "../../infrastructure/tools/EphemeralGenesis.js";
import { telemetry } from "./telemetry.js";

const telemetryInvoke = (tool: string) => {
  try { telemetry.recordInvocation(tool); } catch { /* best effort */ }
};

export function registerEphemeralTools(server: McpServer): void {

  // ═══════════════════════════════════════════════════════════════════════
  // forge_ephemeral — Unified capability metabolism
  // ═══════════════════════════════════════════════════════════════════════
  server.tool(
    "forge_ephemeral",
    "ACTUATOR · metabolism · MUTATE. Ephemeral Tool Genesis — the capability metabolism engine. Generates TEMPORARY tools from templates for one mission, then dissolves. Modes: inspect_gap (detect missing capability), generate (create from template), sandbox_test (verify), invoke (execute), verify (validate result), retire (cleanup + propose promotion). Wolf Cabinet Ψ Survival — adapts without accumulating permanent state. USE WHEN: 'I need to do X but no tool exists' — the federation synthesizes capability on demand.",
    {
      mode: z.enum(["inspect_gap", "generate", "sandbox_test", "invoke", "verify", "retire", "list_templates", "list_active", "propose_promotion"])
        .describe("Operation mode"),
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
    },
    async (args) => {
      const startedAt = Date.now();
      await telemetryInvoke("forge_ephemeral");
      const genesis = getEphemeralGenesis();

      try {
        const { mode } = args as any;
        let result: any;

        switch (mode) {
          // ── inspect_gap ──────────────────────────────────────────
          case "inspect_gap": {
            const { capability_need, existing_tools } = args as any;
            if (!capability_need) {
              return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: "capability_need is required for inspect_gap mode" }) }], isError: true };
            }
            const gap = genesis.analyzeGap(capability_need, existing_tools || []);
            result = {
              ok: true,
              mode: "inspect_gap",
              analysis: gap,
              _epistemic: "DER",
              _next: gap.recommended ? `Use template_id='${gap.recommended}' with mode='generate'` : "No template found — consider generic_api_wrapper or request new template",
            };
            break;
          }

          // ── generate ─────────────────────────────────────────────
          case "generate": {
            const { template_id, template_params, mission_intent, session_id, actor_id } = args as any;
            if (!template_id) {
              return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: "template_id is required for generate mode. Use list_templates to see available templates." }) }], isError: true };
            }
            const gen = await genesis.generate(
              template_id,
              template_params || {},
              session_id || "unknown",
              actor_id || "unknown",
              mission_intent || "unspecified mission",
            );
            result = {
              ok: gen.ok,
              mode: "generate",
              tool: gen.tool,
              error: gen.error,
              receiptHash: gen.receiptHash,
              _epistemic: gen.ok ? "OBS" : "INT",
              _next: gen.ok ? `Tool created: ${gen.tool?.id}. Next: sandbox_test with tool_id='${gen.tool?.id}'` : "Fix params and retry",
            };
            break;
          }

          // ── sandbox_test ─────────────────────────────────────────
          case "sandbox_test": {
            const { tool_id } = args as any;
            if (!tool_id) {
              return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: "tool_id is required for sandbox_test mode" }) }], isError: true };
            }
            const test = await genesis.sandboxTest(tool_id);
            result = {
              ok: test.ok,
              mode: "sandbox_test",
              tool: test.tool,
              error: test.error,
              receiptHash: test.receiptHash,
              _epistemic: "OBS",
              _next: test.ok ? `Sandbox test passed. Next: invoke with tool_id='${tool_id}'` : `Test failed: ${test.error}. Regenerate or adjust params.`,
            };
            break;
          }

          // ── invoke ───────────────────────────────────────────────
          case "invoke": {
            const { tool_id, invoke_args } = args as any;
            if (!tool_id) {
              return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: "tool_id is required for invoke mode" }) }], isError: true };
            }
            const inv = await genesis.invoke(tool_id, invoke_args || {});
            result = {
              ok: inv.ok,
              mode: "invoke",
              tool: inv.tool,
              error: inv.error,
              receiptHash: inv.receiptHash,
              _epistemic: "OBS",
              _next: inv.ok ? `Invoked. Next: verify with tool_id='${tool_id}'` : `Invoke failed: ${inv.error}`,
            };
            break;
          }

          // ── verify ───────────────────────────────────────────────
          case "verify": {
            const { tool_id } = args as any;
            if (!tool_id) {
              return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: "tool_id is required for verify mode" }) }], isError: true };
            }
            const ver = await genesis.verify(tool_id);
            result = {
              ok: ver.ok,
              mode: "verify",
              tool: ver.tool,
              error: ver.error,
              _epistemic: "OBS",
              _next: ver.ok ? `Verified. Next: retire with tool_id='${tool_id}'` : "Tool not yet invocable — invoke first then verify",
            };
            break;
          }

          // ── retire ───────────────────────────────────────────────
          case "retire": {
            const { tool_id } = args as any;
            if (!tool_id) {
              return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: "tool_id is required for retire mode" }) }], isError: true };
            }
            const ret = await genesis.retire(tool_id);
            // Check if promotion should be proposed
            const tool = ret.tool;
            let promotion: any = null;
            if (tool) {
              const pp = genesis.proposePromotion(tool.templateId);
              if (pp.shouldPropose) {
                promotion = {
                  proposed: true,
                  template: pp.template?.id,
                  instantiationCount: pp.count,
                  threshold: pp.threshold,
                  action: "Use propose_promotion mode to escalate to human review",
                };
              }
            }
            result = {
              ok: ret.ok,
              mode: "retire",
              tool: ret.tool,
              receiptHash: ret.receiptHash,
              promotion,
              _epistemic: "OBS",
              _next: "Tool retired. Capability was metabolized, not accumulated.",
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
              _epistemic: "OBS",
            };
            break;
          }

          // ── propose_promotion ────────────────────────────────────
          case "propose_promotion": {
            const { template_id } = args as any;
            if (!template_id) {
              return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: "template_id is required for propose_promotion mode" }) }], isError: true };
            }
            const pp = genesis.proposePromotion(template_id);
            if (pp.shouldPropose) {
              genesis.registry.markPromotionProposed(template_id);
            }
            result = {
              ok: true,
              mode: "propose_promotion",
              ...pp,
              _epistemic: "DER",
              _next: pp.shouldPropose
                ? `Template '${template_id}' has been used ${pp.count} times (threshold: ${pp.threshold}). Recommended for promotion. Requires human ratification (F13).`
                : `Template '${template_id}' has ${pp.count}/${pp.threshold} instantiations. Not yet at promotion threshold.`,
            };
            break;
          }

          default: {
            return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: `Unknown mode: ${mode}` }) }], isError: true };
          }
        }

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], isError: !result.ok };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ ok: false, mode: (args as any).mode, error: err instanceof Error ? err.message : String(err), _epistemic: "INT" }, null, 2) }],
          isError: true,
        };
      }
    }
  );
}
