/**
 * TrustTierEnforcer.test.ts — Constitutional Trust Tier Enforcement
 * Phase 2 Sprint 2: trust tiers must become executable law
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TrustTierEnforcer, getTrustTierEnforcer } from "../src/domain/governance/TrustTierEnforcer.js";

const enforcer = getTrustTierEnforcer();

describe("TrustTierEnforcer — UNTRUSTED tier (no authority)", () => {
  it("UNTRUSTED → execute blocked", () => {
    const v = enforcer.enforce("UNTRUSTED", "execute");
    assert.equal(v.allowed, false);
    assert.ok(v.reason.includes("cannot execute"));
  });

  it("UNTRUSTED → register blocked", () => {
    const v = enforcer.enforce("UNTRUSTED", "register");
    assert.equal(v.allowed, false);
  });

  it("UNTRUSTED → call_external blocked", () => {
    const v = enforcer.enforce("UNTRUSTED", "call_external", { targetOrgan: "geox" });
    assert.equal(v.allowed, false);
  });

  it("UNTRUSTED → requiredAction is REVIEW", () => {
    assert.equal(enforcer.requiredAction("UNTRUSTED"), "REVIEW");
  });
});

describe("TrustTierEnforcer — STAGED tier (sandbox only)", () => {
  it("STAGED → execute in sandbox allowed", () => {
    const v = enforcer.enforce("STAGED", "execute", { isSandbox: true });
    assert.equal(v.allowed, true);
    assert.equal(v.requiredAction, "TRI_WITNESS");
  });

  it("STAGED → execute outside sandbox blocked", () => {
    const v = enforcer.enforce("STAGED", "execute", { isSandbox: false });
    assert.equal(v.allowed, false);
    assert.ok(v.reason.includes("sandbox"));
    assert.equal(v.sandboxOnly, true);
  });

  it("STAGED → register blocked", () => {
    const v = enforcer.enforce("STAGED", "register");
    assert.equal(v.allowed, false);
  });

  it("STAGED → call_external blocked", () => {
    const v = enforcer.enforce("STAGED", "call_external");
    assert.equal(v.allowed, false);
  });
});

describe("TrustTierEnforcer — REVIEWED tier (limited authority)", () => {
  it("REVIEWED → execute allowed (limited)", () => {
    const v = enforcer.enforce("REVIEWED", "execute");
    assert.equal(v.allowed, true);
    assert.equal(v.requiredAction, "FORGE_GATE");
  });

  it("REVIEWED → register without human approval blocked", () => {
    const v = enforcer.enforce("REVIEWED", "register", { hasHumanApproval: false });
    assert.equal(v.allowed, false);
    assert.ok(v.reason.includes("human approval"));
  });

  it("REVIEWED → register with human approval allowed", () => {
    const v = enforcer.enforce("REVIEWED", "register", { hasHumanApproval: true });
    assert.equal(v.allowed, true);
  });

  it("REVIEWED → call_external to geox allowed (allowlist)", () => {
    const v = enforcer.enforce("REVIEWED", "call_external", { targetOrgan: "geox" });
    assert.equal(v.allowed, true);
  });

  it("REVIEWED → call_external to non-allowlist blocked", () => {
    const v = enforcer.enforce("REVIEWED", "call_external", { targetOrgan: "hostinger" });
    assert.equal(v.allowed, false);
    assert.ok(v.reason.includes("allowlist"));
  });
});

describe("TrustTierEnforcer — TRUSTED tier (full authority)", () => {
  it("TRUSTED → execute allowed", () => {
    const v = enforcer.enforce("TRUSTED", "execute");
    assert.equal(v.allowed, true);
    assert.equal(v.requiredAction, "SCAR_MONITOR");
  });

  it("TRUSTED → register allowed", () => {
    const v = enforcer.enforce("TRUSTED", "register");
    assert.equal(v.allowed, true);
  });

  it("TRUSTED → call_external allowed (scoped)", () => {
    const v = enforcer.enforce("TRUSTED", "call_external", { targetOrgan: "hostinger" });
    assert.equal(v.allowed, true);
  });

  it("TRUSTED → cannot promote further", () => {
    const v = enforcer.enforce("TRUSTED", "promote");
    assert.equal(v.allowed, false);
    assert.ok(v.reason.includes("highest tier"));
  });
});

describe("TrustTierEnforcer — promotion path", () => {
  it("UNTRUSTED → promote to STAGED requires REVIEW", () => {
    const v = enforcer.enforce("UNTRUSTED", "promote");
    assert.equal(v.allowed, true);
    assert.equal(v.requiredAction, "REVIEW");
  });

  it("STAGED → promote to REVIEWED requires TRI_WITNESS", () => {
    const v = enforcer.enforce("STAGED", "promote");
    assert.equal(v.allowed, true);
    assert.equal(v.requiredAction, "TRI_WITNESS");
  });

  it("REVIEWED → promote to TRUSTED requires FORGE_GATE", () => {
    const v = enforcer.enforce("REVIEWED", "promote");
    assert.equal(v.allowed, true);
    assert.equal(v.requiredAction, "FORGE_GATE");
  });
});
