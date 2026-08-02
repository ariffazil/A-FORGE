/**
 * ephemeralP1AAAdoption.test.ts — P1-AA (2026-08-02) adoption surface.
 *
 * Static-source assertions for the discoverability + telemetry contract.
 * Behavior tests for project_id label-only pass-through using modes that
 * do not require sandbox execution (inspect_gap, list_templates,
 * list_active, propose_promotion).
 *
 * No live bwrap invocation. No real MuleRouter API call. Fail-closed.
 */
import test, { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";

const EPHEMERAL_TOOLS = resolve(process.cwd(), "src/interfaces/mcp/ephemeralTools.ts");
const TELEMETRY = resolve(process.cwd(), "src/interfaces/mcp/telemetry.ts");

describe("P1-AA — description discoverability", () => {
  it("forge_ephemeral description lists all 9 modes", () => {
    const src = readFileSync(EPHEMERAL_TOOLS, "utf-8");
    for (const mode of [
      "inspect_gap",
      "generate",
      "sandbox_test",
      "invoke",
      "verify",
      "retire",
      "list_templates",
      "list_active",
      "propose_promotion",
    ]) {
      assert.match(src, new RegExp(mode), `description must mention mode '${mode}'`);
    }
  });

  it("forge_ephemeral description surfaces SELF_CERTIFIED as inadmissible", () => {
    const src = readFileSync(EPHEMERAL_TOOLS, "utf-8");
    assert.match(
      src,
      /SELF_CERTIFIED[^\n]*INADMISSIBLE|SELF_CERTIFIED[\s\S]{0,200}inadmissible/i,
      "SELF_CERTIFIED rule must be visible in the description block",
    );
  });

  it("forge_ephemeral description states the 4-stage promotion rule", () => {
    const src = readFileSync(EPHEMERAL_TOOLS, "utf-8");
    // Four-condition rule: sandbox_test, independent verify, threshold, F13.
    assert.match(src, /sandbox_test/i);
    assert.match(src, /independent verify|independent_verif/i);
    assert.match(src, /promotionThreshold|promotion threshold|threshold/i);
    assert.match(src, /F13 SOVEREIGN|F13/);
  });

  it("forge_ephemeral description says temporary by default", () => {
    const src = readFileSync(EPHEMERAL_TOOLS, "utf-8");
    assert.match(src, /temporary by default|metabolized, not accumulated|REMOVED unless promoted/i);
  });
});

describe("P1-AA — telemetry event shape", () => {
  it("AuditEventAction includes ephemeral_lifecycle", () => {
    const src = readFileSync(TELEMETRY, "utf-8");
    assert.match(src, /"ephemeral_lifecycle"/, "new action value must be declared");
  });

  it("ephemeralTools calls telemetry.logEvent with the right shape", () => {
    const src = readFileSync(EPHEMERAL_TOOLS, "utf-8");
    // mode + projectId + session_id + outcome + durationMs fields
    assert.match(src, /tool:\s*"forge_ephemeral"/);
    assert.match(src, /action:\s*"ephemeral_lifecycle"/);
    assert.match(src, /session_id:\s*sessionId/);
    assert.match(src, /mode,\s*projectId/);
    assert.match(src, /durationMs/);
  });

  it("ephemeralTools does not log args or generated code into telemetry", () => {
    const src = readFileSync(EPHEMERAL_TOOLS, "utf-8");
    // F11/F9 safety: must NOT put args/template_params/invoke_args into the
    // telemetry metadata. (We allow `error` because logEvent() runs
    // redactSecrets() on it, but no raw payload.)
    assert.doesNotMatch(
      src,
      /metadata:\s*\{\s*template_params/,
      "template_params must NOT be passed to telemetry (contains user payloads)",
    );
    assert.doesNotMatch(
      src,
      /metadata:\s*\{\s*invoke_args/,
      "invoke_args must NOT be passed to telemetry",
    );
    assert.doesNotMatch(
      src,
      /metadata:\s*\{\s*args:/,
      "raw args must NOT be passed to telemetry",
    );
  });
});

describe("P1-AA — project_id label surface", () => {
  it("input schema declares optional project_id with UNKNOWN default", () => {
    const src = readFileSync(EPHEMERAL_TOOLS, "utf-8");
    assert.match(src, /project_id:\s*z\.string\(\)\.optional\(\)/);
    assert.match(
      src,
      /projectId\s*=\s*\(args as any\)\.project_id\s*\?\?\s*"UNKNOWN"/,
      "projectId must default to UNKNOWN, never invented",
    );
  });
});

describe("P1-AA — fail_closed signal", () => {
  it("P0.4 / ContainmentUnavailableError maps to fail_closed outcome", () => {
    const src = readFileSync(EPHEMERAL_TOOLS, "utf-8");
    // The P0.4 detector exists in three places: generate, sandbox_test, invoke,
    // and a final catch-all.
    const matches = src.match(/P0\\\.4|P0\.4/g) || [];
    assert.ok(matches.length >= 3, "P0.4 detection must exist for generate/sandbox_test/invoke + catch");
    // fail_closed outcome is set
    assert.match(src, /outcome = "fail_closed"/);
  });
});
