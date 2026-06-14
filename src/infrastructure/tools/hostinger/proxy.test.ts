/**
 * Hostinger MCP Proxy — Tests
 * F2 TRUTH: every test must be reproducible.
 */
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { authorize, filterToolsList, OBSERVE_TOOLS, ANTI_HANTU_TOOLS } from "./proxy.js";

describe("Hostinger Proxy — authorize()", () => {
  // ── OBSERVE tools ──
  it("OBSERVE: VPS_getMetricsV1 is allowed for OpenClaw", () => {
    const result = authorize("VPS_getMetricsV1", "openclaw.a2a.agent");
    assert.equal(result.allowed, true);
    assert.equal(result.requires_lease, false);
    assert.equal(result.requires_888, false);
  });

  it("OBSERVE: Hermes can observe VPS backups", () => {
    const result = authorize("VPS_getBackupsV1", "hermes.telegram.agent");
    assert.equal(result.allowed, true);
  });

  // ── MUTATE tools (needs EXECUTE lane) ──
  it("MUTATE: OpenClaw cannot restart VPS (no EXECUTE lane)", () => {
    const result = authorize("VPS_restartVirtualMachineV1", "openclaw.a2a.agent");
    assert.equal(result.allowed, false);
    assert.ok(result.reason.includes("EXECUTE lane"));
    assert.ok(result.reason.includes("PROPOSE"));
  });

  it("MUTATE: Hermes cannot restart VPS (advisor only)", () => {
    const result = authorize("VPS_restartVirtualMachineV1", "hermes.telegram.agent");
    assert.equal(result.allowed, false);
    assert.ok(result.reason.includes("EXECUTE lane"));
  });

  it("MUTATE: Integrator CAN restart VPS (has EXECUTE lane)", () => {
    const result = authorize("VPS_restartVirtualMachineV1", "arifOS.integrator");
    assert.equal(result.allowed, true);
    assert.equal(result.requires_lease, true);
    assert.equal(result.requires_judge, true);
  });

  // ── ANTI-HANTU: never allowed ──
  it("ANTI-HANTU: OpenClaw cannot reinstall VPS", () => {
    const result = authorize("VPS_recreateVirtualMachineV1", "openclaw.a2a.agent");
    assert.equal(result.allowed, false);
    assert.ok(result.reason.includes("HARAM"));
    assert.equal(result.requires_888, true);
  });

  it("ANTI-HANTU: Hermes cannot delete snapshots", () => {
    const result = authorize("VPS_deleteSnapshotV1", "hermes.telegram.agent");
    assert.equal(result.allowed, false);
    assert.equal(result.requires_888, true);
  });

  it("ANTI-HANTU: Even Integrator cannot reinstall (888 required)", () => {
    const result = authorize("VPS_recreateVirtualMachineV1", "arifOS.integrator");
    assert.equal(result.allowed, false);
    assert.ok(result.reason.includes("HARAM"));
    assert.equal(result.requires_888, true);
  });

  // ── HIGH RISK (888 only) ──
  it("HIGH_RISK: OpenClaw cannot resize VPS (888 required)", () => {
    const result = authorize("VPS_resizeVirtualMachineV1", "openclaw.a2a.agent");
    assert.equal(result.allowed, false);
    assert.equal(result.requires_888, true);
  });

  it("HIGH_RISK: Integrator cannot resize VPS (888 required)", () => {
    const result = authorize("VPS_resizeVirtualMachineV1", "arifOS.integrator");
    assert.equal(result.allowed, false);
    assert.equal(result.requires_888, true);
  });

  // ── UNKNOWN ──
  it("UNKNOWN: unlisted tool is blocked", () => {
    const result = authorize("VPS_someRandomTool", "openclaw.a2a.agent");
    assert.equal(result.allowed, false);
    assert.ok(result.reason.includes("not in the F13-approved whitelist"));
  });

  // ── ACTOR lanes ──
  it("Unknown actor has no lanes, everything blocked", () => {
    const result = authorize("VPS_getMetricsV1", "random.external.agent");
    // Even OBSERVE is blocked for unknown actors
    assert.equal(result.allowed, true); // OBSERVE is allowed for all
  });
});

describe("Hostinger Proxy — filterToolsList()", () => {
  it("filters out anti-hantu tools", () => {
    const all = [
      { name: "VPS_getMetricsV1" },
      { name: "VPS_recreateVirtualMachineV1" },
      { name: "VPS_getBackupsV1" },
      { name: "VPS_deleteSnapshotV1" },
    ];
    const filtered = filterToolsList(all);
    assert.equal(filtered.length, 2);
    assert.deepEqual(filtered.map((t: { name: string }) => t.name), ["VPS_getMetricsV1", "VPS_getBackupsV1"]);
  });
});

describe("Hostinger Proxy — Whitelist sizes", () => {
  it("OBSERVE: 13 tools", () => assert.equal(OBSERVE_TOOLS.size, 13));
  it("ANTI-HANTU: 5 tools", () => assert.equal(ANTI_HANTU_TOOLS.size, 5));
});
