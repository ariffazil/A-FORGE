/**
 * ephemeralNoAmbientSecrets.test.ts — Built-in templates must NOT
 * embed `process.env.MULEROUTER_API_KEY` literals or raw bearer
 * tokens. The `authRef` is the only carrier.
 */
import test, { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { getEphemeralGenesis } from "../src/infrastructure/tools/EphemeralGenesis.js";

let genesis: ReturnType<typeof getEphemeralGenesis>;

before(() => {
  genesis = getEphemeralGenesis();
});

const TEMPLATE_IDS = [
  "mulerouter_image_gen",
  "mulerouter_tts",
  "mulerouter_music",
  "mulerouter_vision",
  "generic_api_wrapper",
];

describe("ephemeral templates — no ambient secret leaks", () => {
  for (const templateId of TEMPLATE_IDS) {
    it(`${templateId} has authRef, no MULEROUTER_API_KEY literal`, async () => {
      const template = genesis.registry.get(templateId);
      assert.ok(template, `template ${templateId} should be registered`);
      const params: Record<string, unknown> = templateId === "generic_api_wrapper"
        ? { url: "https://example.com", method: "GET" }
        : templateId.startsWith("mulerouter_tts")
          ? { text: "hello" }
          : templateId === "mulerouter_vision"
            ? { image_url: "https://example.com/x.png" }
            : { prompt: "hello" };
      const result = await genesis.generate(templateId, params, "test-session", "test-actor", "test mission");
      assert.equal(result.ok, true, `generate should succeed for ${templateId}: ${result.error}`);
      const tool = result.tool!;
      // Implementation JSON MUST NOT contain a raw token
      assert.ok(!tool.implementation.includes(process.env.MULEROUTER_API_KEY ?? "DOES_NOT_EXIST"),
        `${templateId} must not embed raw MULEROUTER_API_KEY`);
      // Implementation JSON MUST NOT contain process.env literal
      assert.ok(!tool.implementation.includes("process.env"),
        `${templateId} must not embed process.env literal`);
      // authRef MUST be present
      const parsed = JSON.parse(tool.implementation) as { authRef?: unknown };
      assert.ok(parsed.authRef, `${templateId} must carry an authRef`);
      const authRef = parsed.authRef as { kind?: string; name?: string };
      assert.equal(authRef.kind, "env");
      assert.equal(authRef.name, "MULEROUTER_API_KEY");
    });
  }
});
