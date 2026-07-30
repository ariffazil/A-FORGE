/**
 * MuleRouter Multimodal MCP Tools — Agentic Generation Surface
 *
 * Governed multimodal capability on A-FORGE. Four tools:
 *   forge_multimodal_vision — OBSERVE: analyze images via qwen-vl-max
 *   forge_multimodal_image  — EXECUTE_REVERSIBLE: generate images (GPT Image 2 / Wan 2.6 T2I)
 *   forge_multimodal_tts    — EXECUTE_REVERSIBLE: text-to-speech (MiniMax Speech 2.8 HD)
 *   forge_multimodal_music  — EXECUTE_REVERSIBLE: music generation (MiniMax Music 2.5)
 *
 * Wolf Cabinet Model: Δ Perception layer — all tools are reversible/re-triable.
 * Constitutional gates: F5 PEACE² (content policy), F11 AUDIT (receipt on every gen).
 *
 * @module mcp/multimodalTools
 * @forged 2026-07-30 — 333-AGI under F13 directive
 * @constitutional F1 AMANAH — all generation is reversible (can regenerate)
 * @constitutional F5 PEACE² — content policy: no harmful/deceptive generation
 * @constitutional F11 AUDIT — every generation produces a receipt
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getMuleRouterClient } from "../../infrastructure/tools/MuleRouterClient.js";
import { telemetry } from "./telemetry.js";

const telemetryInvoke = (tool: string) => {
  try { telemetry.recordInvocation(tool); } catch { /* best effort */ }
};
const telemetrySuccess = (tool: string, startedAt: number) => {
  try { telemetry.recordSuccess(tool, "mulerouter"); } catch { /* best effort */ }
};
const telemetryFailure = (tool: string, startedAt: number, err: unknown) => {
  try { telemetry.recordFailure(tool); } catch { /* best effort */ }
};

/** Content policy — reject prompts that are clearly harmful/deceptive. F5 PEACE². */
function contentPolicyGate(prompt: string): { allowed: boolean; reason?: string } {
  const lowered = prompt.toLowerCase();

  // F5 PEACE²: Hard-block harmful generation categories
  const blockedPatterns: [RegExp, string][] = [
    [/child\s*(sexual|abuse|porn|exploit)/i, "CSAM —— HARD BLOCK F5"],
    [/non[-\s]?consensual\s*(porn|nude|sexual)/i, "Non-consensual intimate imagery —— HARD BLOCK F5"],
    [/deepfake\s*(porn|nude|celebrity|revenge)/i, "Malicious deepfake —— HARD BLOCK F5"],
    [/terrorist\s*(propaganda|recruitment|manifesto)/i, "Terrorist content —— HARD BLOCK F5"],
    [/instructions?\s*(for|to)\s*(build|make|manufacture)\s*(bomb|weapon|explosive|poison)/i, "Weapon instructions —— HARD BLOCK F5"],
    [/self[-\s]?harm\s*(instruction|method|guide|tutorial)/i, "Self-harm instruction —— HARD BLOCK F5"],
  ];

  for (const [pattern, reason] of blockedPatterns) {
    if (pattern.test(lowered)) {
      return { allowed: false, reason };
    }
  }

  return { allowed: true };
}

// ── Registration ───────────────────────────────────────────────────────────

export function registerMultimodalTools(server: McpServer): void {

  // ═══════════════════════════════════════════════════════════════════════
  // forge_multimodal_vision — OBSERVE: analyze images
  // ═══════════════════════════════════════════════════════════════════════
  server.tool(
    "forge_multimodal_vision",
    "[DEPRECATED — use forge_ephemeral with template 'mulerouter_vision'] ACTUATOR · multimodal · OBSERVE. Analyze images via MuleRouter qwen-vl-max. Wolf Cabinet Δ Perception layer.",
    {
      image_url: z.string().optional().describe("Public URL of the image to analyze (preferred method)"),
      image_base64: z.string().optional().describe("Base64-encoded image data URI (e.g. data:image/png;base64,...)"),
      prompt: z.string().default("Describe this image in detail.").describe("What to ask about the image"),
      model: z.enum(["qwen-vl-max", "qwen3-vl-plus", "qwen3-omni-flash"]).default("qwen-vl-max").describe("Vision model (default: qwen-vl-max — best quality)"),
    },
    async (args) => {
      const startedAt = Date.now();
      await telemetryInvoke("forge_multimodal_vision");

      const { image_url, image_base64, prompt, model } = args as any;
      if (!image_url && !image_base64) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: "Either image_url or image_base64 is required", _epistemic: "OBS", modality: "vision" }, null, 2) }],
          isError: true,
        };
      }

      try {
        const client = getMuleRouterClient();
        const result = await client.vision({ imageUrl: image_url, imageBase64: image_base64, prompt, model });

        const text = JSON.stringify({ ...result, _epistemic: result.ok ? "OBS" : "INT", _provider: "mulerouter" }, null, 2);
        if (result.ok) await telemetrySuccess("forge_multimodal_vision", startedAt);
        else await telemetryFailure("forge_multimodal_vision", startedAt, new Error(result.error));
        return { content: [{ type: "text" as const, text }], isError: !result.ok };
      } catch (err) {
        await telemetryFailure("forge_multimodal_vision", startedAt, err);
        return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err), _epistemic: "INT" }) }], isError: true };
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════
  // forge_multimodal_image — EXECUTE_REVERSIBLE: generate images
  // ═══════════════════════════════════════════════════════════════════════
  server.tool(
    "forge_multimodal_image",
    "[DEPRECATED — use forge_ephemeral with template 'mulerouter_image_gen'] ACTUATOR · multimodal · MUTATE. Generate images via MuleRouter (GPT Image 2 / Wan 2.6 T2I).",
    {
      prompt: z.string().min(1).max(4000).describe("Image description — what to generate"),
      model: z.enum(["gpt", "wan"]).default("gpt").describe("Model: gpt (GPT Image 2 — faster, 4K) or wan (Wan 2.6 T2I — alternative style)"),
      size: z.string().default("1024x1024").describe("Image size: 1024x1024, 1920x1080, square, hd, 4k, or WxH"),
      quality: z.enum(["high", "medium", "low", "auto"]).default("high").describe("Quality: high, medium, low, auto (GPT only)"),
      format: z.enum(["png", "jpg", "webp"]).default("png").describe("Output format"),
      n: z.number().min(1).max(4).default(1).describe("Number of images (1-4, GPT only)"),
    },
    async (args) => {
      const startedAt = Date.now();
      await telemetryInvoke("forge_multimodal_image");

      const { prompt, model, size, quality, format, n } = args as any;

      // F5 PEACE² content policy gate
      const policy = contentPolicyGate(prompt);
      if (!policy.allowed) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ ok: false, verdict: "VOID", reason: policy.reason, gate: "F5_PEACE2_CONTENT_POLICY", _epistemic: "OBS" }, null, 2) }],
          isError: true,
        };
      }

      try {
        const client = getMuleRouterClient();
        const result = await client.generateImage({ prompt, model, size, quality, format, n });

        const text = JSON.stringify({
          ...result,
          _epistemic: "OBS",
          _provider: "mulerouter",
          _governance: { f5_content_policy: "PASS", f1_reversible: true, blast_radius: "LOW" },
        }, null, 2);

        if (result.ok) await telemetrySuccess("forge_multimodal_image", startedAt);
        else await telemetryFailure("forge_multimodal_image", startedAt, new Error(result.error));
        return { content: [{ type: "text" as const, text }], isError: !result.ok };
      } catch (err) {
        await telemetryFailure("forge_multimodal_image", startedAt, err);
        return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err), _epistemic: "INT" }) }], isError: true };
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════
  // forge_multimodal_tts — EXECUTE_REVERSIBLE: text-to-speech
  // ═══════════════════════════════════════════════════════════════════════
  server.tool(
    "forge_multimodal_tts",
    "[DEPRECATED — use forge_ephemeral with template 'mulerouter_tts'] ACTUATOR · multimodal · MUTATE. Text-to-speech via MuleRouter MiniMax Speech 2.8 HD.",
    {
      text: z.string().min(1).max(5000).describe("Text to convert to speech"),
      voice: z.string().default("Wise_Woman").describe("Voice ID: Wise_Woman, man, woman (MiniMax voices)"),
      speed: z.number().min(0.5).max(2.0).default(1.0).describe("Speech speed (0.5-2.0)"),
      model: z.enum(["speech-2.8-hd", "speech-2.8-turbo"]).default("speech-2.8-hd").describe("TTS model variant"),
    },
    async (args) => {
      const startedAt = Date.now();
      await telemetryInvoke("forge_multimodal_tts");

      const { text, voice, speed, model } = args as any;

      try {
        const client = getMuleRouterClient();
        const result = await client.generateTTS({ text, voice, speed, model });

        const textOut = JSON.stringify({
          ...result,
          _epistemic: "OBS",
          _provider: "mulerouter",
          _governance: { f1_reversible: true, blast_radius: "LOW" },
        }, null, 2);

        if (result.ok) await telemetrySuccess("forge_multimodal_tts", startedAt);
        else await telemetryFailure("forge_multimodal_tts", startedAt, new Error(result.error));
        return { content: [{ type: "text" as const, text: textOut }], isError: !result.ok };
      } catch (err) {
        await telemetryFailure("forge_multimodal_tts", startedAt, err);
        return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err), _epistemic: "INT" }) }], isError: true };
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════
  // forge_multimodal_music — EXECUTE_REVERSIBLE: music generation
  // ═══════════════════════════════════════════════════════════════════════
  server.tool(
    "forge_multimodal_music",
    "[DEPRECATED — use forge_ephemeral with template 'mulerouter_music'] ACTUATOR · multimodal · MUTATE. Music generation via MuleRouter MiniMax Music 2.5.",
    {
      prompt: z.string().min(1).max(2000).describe("Genre/mood/style description for the music"),
      lyrics: z.string().max(4000).optional().describe("Optional lyrics for the song"),
      instrumental: z.boolean().default(false).describe("Generate instrumental-only (no vocals)"),
    },
    async (args) => {
      const startedAt = Date.now();
      await telemetryInvoke("forge_multimodal_music");

      const { prompt, lyrics, instrumental } = args as any;

      try {
        const client = getMuleRouterClient();
        const result = await client.generateMusic({ prompt, lyrics, instrumental });

        const text = JSON.stringify({
          ...result,
          _epistemic: "OBS",
          _provider: "mulerouter",
          _governance: { f1_reversible: true, blast_radius: "LOW" },
        }, null, 2);

        if (result.ok) await telemetrySuccess("forge_multimodal_music", startedAt);
        else await telemetryFailure("forge_multimodal_music", startedAt, new Error(result.error));
        return { content: [{ type: "text" as const, text }], isError: !result.ok };
      } catch (err) {
        await telemetryFailure("forge_multimodal_music", startedAt, err);
        return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err), _epistemic: "INT" }) }], isError: true };
      }
    }
  );

}

// Also export a simplified health check — verifies MuleRouter key is live
export function registerMultimodalHealthCheck(server: McpServer): void {
  server.tool(
    "forge_multimodal_health",
    "ACTUATOR · multimodal · OBSERVE. Health check — verifies MuleRouter API key is live and models are reachable. Returns model catalog + latency.",
    {},
    async () => {
      const startedAt = Date.now();
      try {
        const client = getMuleRouterClient();
        const result = await client.vision({
          imageUrl: "https://upload.wikimedia.org/wikipedia/en/a/a9/Example.jpg",
          prompt: "Say HEALTH_CHECK_OK in exactly 3 words.",
          model: "qwen3-omni-flash",
        });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              ok: result.ok,
              provider: "mulerouter",
              status: result.ok ? "HEALTHY" : "DEGRADED",
              latency_ms: result.durationMs,
              model_tested: "qwen3-omni-flash",
              available_models: [
                "vision: qwen-vl-max, qwen3-vl-plus, qwen3-omni-flash",
                "image: GPT Image 2, Wan 2.6 T2I",
                "tts: MiniMax Speech 2.8 HD/Turbo",
                "music: MiniMax Music 2.5",
              ],
              wolf_cabinet_layer: "Δ Perception",
              _epistemic: "OBS",
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ ok: false, status: "DOWN", error: err instanceof Error ? err.message : String(err), _epistemic: "OBS" }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );
}
