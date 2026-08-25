/**
 * Gemini Capability Module for A-FORGE
 * ZEN-FORGED 2026-08-25 — direct bridge to Google AI Studio.
 *
 * Architecture: TypeScript handler → HTTP fetch → gemini_bridge.py :18092 → Google AI Studio.
 *
 * @module capabilities/gemini
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const BRIDGE_URL = "http://127.0.0.1:18092";

async function bridgeCall(verb: string, params: Record<string, any> = {}) {
  try {
    const resp = await fetch(`${BRIDGE_URL}/${verb}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verb, params }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      return { ok: false, verdict: "HOLD", error: `bridge_http_${resp.status}: ${text.slice(0, 500)}` };
    }
    return await resp.json();
  } catch (e: any) {
    return { ok: false, verdict: "HOLD", error: `bridge_unreachable: ${e.message}` };
  }
}

async function generateHandler(args: any) {
  return await bridgeCall("generate", {
    prompt: args.prompt,
    model: args.model || "gemini-3.6-flash",
    max_tokens: args.max_tokens || 2048,
    temperature: args.temperature || 0.7,
    system_instruction: args.system_instruction,
  });
}

async function chatHandler(args: any) {
  return await bridgeCall("chat", {
    messages: args.messages,
    model: args.model || "gemini-3.6-flash",
    max_tokens: args.max_tokens || 2048,
    temperature: args.temperature || 0.7,
  });
}

async function modelsHandler(_args: any) {
  return await bridgeCall("models");
}

async function healthHandler(_args: any) {
  return await bridgeCall("health");
}

export function registerGeminiTools(server: McpServer) {
  server.registerTool(
    "forge_gemini",
    {
      description: "ACTUATOR · meta · MUTATE. Direct bridge to Google AI Studio Gemini. 4 verbs: generate, chat, models, health. Default model: gemini-3.6-flash. Bridge listens 127.0.0.1:18092. Auth via bearer-style HTTP header from env.",
      inputSchema: z.object({
        verb: z.enum(["generate", "chat", "models", "health"]).describe("Bridge verb to invoke"),
        prompt: z.string().optional().describe("Required for generate"),
        model: z.string().optional().describe("Optional model override (default gemini-3.6-flash)"),
        max_tokens: z.number().optional().describe("Optional max output tokens (default 2048)"),
        temperature: z.number().optional().describe("Optional 0-1 (default 0.7)"),
        system_instruction: z.string().optional().describe("Optional system prompt"),
        messages: z.array(z.object({
          role: z.enum(["user", "assistant", "model"]),
          content: z.string(),
        })).optional().describe("For chat: [{role, content}]"),
      }),
    },
    async (args: any) => {
      const verb: string = args.verb || "generate";
      const handlers: Record<string, (a: any) => Promise<any>> = {
        generate: generateHandler,
        chat: chatHandler,
        models: modelsHandler,
        health: healthHandler,
      };
      const fn = handlers[verb];
      if (!fn) {
        return { content: [{ type: "text", text: JSON.stringify({ ok: false, error: `unknown verb: ${verb}` }) }] };
      }
      const result: any = await fn(args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
