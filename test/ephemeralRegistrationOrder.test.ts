/**
 * ephemeralRegistrationOrder.test.ts — Asserts that `forge_ephemeral`
 * is wired into the MUTATE set so external clients receive
 * -32042 elicitation, and that the MCP core module registers
 * `forge_ephemeral` BEFORE the policy/elicitation interceptors.
 *
 * The static-source check is acceptable for a registration-order
 * invariant: the actual wrapper behaviour is exercised live by the
 * smoke test in the deploy step.
 */
import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const POLICY_TOOLS = resolve(
  process.cwd(),
  "src/interfaces/mcp/policyTools.ts",
);
const CORE = resolve(process.cwd(), "src/interfaces/mcp/core.ts");

describe("ephemeral — policy gate membership", () => {
  it("forge_ephemeral is in ELICITATION_GATE_TOOLS", () => {
    const src = readFileSync(POLICY_TOOLS, "utf-8");
    assert.match(src, /ELICITATION_GATE_TOOLS[\s\S]*"forge_ephemeral"/);
  });
});

describe("ephemeral — registration order in core.ts", () => {
  it("registerEphemeralTools precedes installPolicyInterceptor", () => {
    const src = readFileSync(CORE, "utf-8");
    const ephemeralIdx = src.indexOf("registerEphemeralTools(server)");
    const policyIdx = src.indexOf("installPolicyInterceptor(server)");
    const elicitationIdx = src.indexOf("installElicitationGate(server)");
    const fingerprintIdx = src.indexOf("startupFingerprintCheck(server)");
    assert.ok(ephemeralIdx > 0, "registerEphemeralTools(server) call should be present");
    assert.ok(policyIdx > 0, "installPolicyInterceptor(server) call should be present");
    assert.ok(elicitationIdx > 0, "installElicitationGate(server) call should be present");
    assert.ok(fingerprintIdx > 0, "startupFingerprintCheck(server) call should be present");
    assert.ok(ephemeralIdx < policyIdx, "ephemeral must register before policy interceptor");
    assert.ok(ephemeralIdx < elicitationIdx, "ephemeral must register before elicitation gate");
    assert.ok(ephemeralIdx < fingerprintIdx, "ephemeral must register before fingerprint check");
  });
});
