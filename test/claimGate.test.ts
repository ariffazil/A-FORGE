/**
 * test/claimGate.test.ts — claim_kernel explanatory-class gate.
 *
 * The hands layer must REFUSE a mutation whose stated justification is a
 * NARRATIVE-class or UNCLASSIFIED claim. MEASURED / MECHANISM / PATTERN pass.
 * Refusal is mechanical (exit code from the canonical Python kernel via the CLI
 * seam), never advisory. Every error path is fail-closed.
 *
 * Evidence: /root/AAA/lib/claim_kernel/claim_kernel.py and
 * /root/A-FORGE/src/infrastructure/governance/claimGate.ts
 * DITEMPA BUKAN DIBERI
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import {
  gateToolClaim,
  extractStatedClaim,
  evaluateClaimViaCli,
  claimGateRefusalResponse,
  claimGateHoldBody,
  claimGateHealth,
  claimGateEnabled,
  CLAIM_KERNEL_PATH,
  CLAIM_KERNEL_SCHEMA,
  ACTION_ELIGIBLE_CLASSES,
  type ClaimGateRefuse,
} from "../src/infrastructure/governance/claimGate.js";

// Class-unambiguous fixtures, verified against the live kernel.
const MEASURED_TEXT = "measured porosity 22.4% from core lab report 2026-03";
const MECHANISM_TEXT =
  "The locking defect occurs because the mutex is released before the write completes; mechanism: race on the session map; test: reproduce with 2 threads";
const PATTERN_TEXT = "Across 14 basins the same sequence appears; this pattern recurs in every case";
const NARRATIVE_TEXT = "The restructuring was destiny; the agency is naturally better at this";
const UNCLASSIFIED_TEXT = "it did not work because things are simply like that";

const kernelPresent = fs.existsSync(CLAIM_KERNEL_PATH);
const live = { skip: kernelPresent ? false : `claim_kernel absent at ${CLAIM_KERNEL_PATH}` };

let savedGate: string | undefined;
beforeEach(() => { savedGate = process.env.FORGE_CLAIM_GATE; });
afterEach(() => {
  if (savedGate === undefined) delete process.env.FORGE_CLAIM_GATE;
  else process.env.FORGE_CLAIM_GATE = savedGate;
});

describe("claimGate - seam block", () => {
  it("reports the kernel path and eligible class set", () => {
    const h = claimGateHealth();
    assert.equal(h.gate, "CLAIM_CLASS");
    assert.equal(h.kernel_path, CLAIM_KERNEL_PATH);
    assert.deepEqual(h.action_eligible_classes, ["MEASURED", "MECHANISM", "PATTERN"]);
  });

  it("honours the operator switch FORGE_CLAIM_GATE", () => {
    delete process.env.FORGE_CLAIM_GATE;
    assert.equal(claimGateEnabled(), true);
    process.env.FORGE_CLAIM_GATE = "0";
    assert.equal(claimGateEnabled(), false);
  });
});

describe("claimGate - extractStatedClaim", () => {
  it("returns null when the caller states no claim", () => {
    assert.equal(extractStatedClaim({ command: "ls" }), null);
    assert.equal(extractStatedClaim({ justification: "   " }), null);
    assert.equal(extractStatedClaim({}), null);
    assert.equal(extractStatedClaim(null), null);
  });

  it("reads justification + claim_class", () => {
    const c = extractStatedClaim({ justification: "why", claim_class: "mechanism" });
    assert.ok(c);
    assert.equal(c!.text, "why");
    assert.equal(c!.declared, "MECHANISM");
    assert.equal(c!.declared_unknown, false);
    assert.equal(c!.text_field, "justification");
    assert.equal(c!.class_field, "claim_class");
  });

  it("accepts alias fields", () => {
    const c = extractStatedClaim({ rationale: "why", declared_class: "PATTERN" });
    assert.equal(c!.declared, "PATTERN");
    assert.equal(c!.text_field, "rationale");
  });

  it("an undeclared claim text yields UNCLASSIFIED", () => {
    const c = extractStatedClaim({ justification: UNCLASSIFIED_TEXT });
    assert.equal(c!.declared, "UNCLASSIFIED");
  });

  it("an unknown declared class yields UNCLASSIFIED and sets declared_unknown", () => {
    const c = extractStatedClaim({ justification: "x", claim_class: "VIBES" });
    assert.equal(c!.declared, "UNCLASSIFIED");
    assert.equal(c!.declared_unknown, true);
  });
});

// ═══════════════════════════════════════════════════════════════
// REFUSAL PATH (the point of the gate)
// ═══════════════════════════════════════════════════════════════

describe("claimGate — refusal", () => {
  it("REFUSES a NARRATIVE-class justification on a MUTATE tool", live, async () => {
    const r = await gateToolClaim(
      "forge_shell",
      { justification: NARRATIVE_TEXT, claim_class: "NARRATIVE" },
      "EXECUTE_REVERSIBLE",
    );
    assert.equal(r.ok, false);
    const refusal = r as ClaimGateRefuse;
    assert.equal(refusal.error, "CLAIM_GATE");
    assert.equal(refusal.reason_code, "CLAIM_NOT_ACTION_ELIGIBLE");
    assert.match(refusal.message, /CLAIM_GATE/);
    assert.match(refusal.message, /NARRATIVE/);
    assert.ok(refusal.verdict.reasons.length > 0, "refusal must carry reasons");
  });

  it("REFUSES a justification with no declared class at all", live, async () => {
    const r = await gateToolClaim(
      "forge_git",
      { justification: UNCLASSIFIED_TEXT },
      "EXECUTE_HIGH_IMPACT",
    );
    assert.equal(r.ok, false);
    const refusal = r as ClaimGateRefuse;
    assert.equal(refusal.claim.declared, "UNCLASSIFIED");
    assert.match(refusal.verdict.reasons.join(" "), /UNCLASSIFIED/);
  });

  it("REFUSES an explicit UNCLASSIFIED declaration", live, async () => {
    const r = await gateToolClaim(
      "forge_git",
      { justification: UNCLASSIFIED_TEXT, claim_class: "UNCLASSIFIED" },
      "EXECUTE_HIGH_IMPACT",
    );
    assert.equal(r.ok, false);
    assert.equal((r as ClaimGateRefuse).claim.declared, "UNCLASSIFIED");
  });

  it("REFUSES an overclaim: declared MECHANISM, text infers NARRATIVE", live, async () => {
    const r = await gateToolClaim(
      "forge_execute",
      { justification: NARRATIVE_TEXT, claim_class: "MECHANISM" },
      "EXECUTE_HIGH_IMPACT",
    );
    assert.equal(r.ok, false);
    assert.equal((r as ClaimGateRefuse).verdict.class_verdict?.inferred, "NARRATIVE");
  });

  it("REFUSES a declared class with no justification text", async () => {
    const r = await gateToolClaim("forge_shell", { claim_class: "MEASURED" }, "EXECUTE_REVERSIBLE");
    assert.equal(r.ok, false);
    assert.equal((r as ClaimGateRefuse).reason_code, "CLAIM_TEXT_MISSING");
  });

  it("FAIL-CLOSED when the kernel is unreachable", async () => {
    const v = await evaluateClaimViaCli(MECHANISM_TEXT, "MECHANISM", {
      kernelPath: "/tmp/definitely-not-a-kernel-9f3a.py",
    });
    assert.equal(v.eligible, false);
    assert.equal(v.cli.ok, false);
    assert.match(v.reasons.join(" "), /CLAIM_KERNEL_ABSENT/);
  });

  it("FAIL-CLOSED on a non-JSON child exit", async () => {
    const v = await evaluateClaimViaCli(MECHANISM_TEXT, "MECHANISM", {
      kernelPath: "/tmp/definitely-not-a-kernel-9f3a.py",
      python: "python3",
    });
    assert.equal(v.eligible, false);
  });

  it("refusal surfaces as an MCP error response and an HTTP 423 body", live, async () => {
    const r = await gateToolClaim(
      "forge_shell",
      { justification: NARRATIVE_TEXT, claim_class: "NARRATIVE" },
      "EXECUTE_REVERSIBLE",
    );
    assert.equal(r.ok, false);
    const refusal = r as ClaimGateRefuse;

    const mcp = claimGateRefusalResponse(refusal);
    assert.equal(mcp.isError, true);
    assert.equal(mcp.content[0].type, "text");
    const parsed = JSON.parse(mcp.content[0].text);
    assert.equal(parsed.error, "CLAIM_GATE");
    assert.equal(parsed.verdict, "REFUSED");
    assert.equal(parsed.gate, "CLAIM_CLASS");
    assert.equal(parsed.kernel, CLAIM_KERNEL_SCHEMA);
    assert.deepEqual(parsed.action_eligible_classes, [...ACTION_ELIGIBLE_CLASSES]);

    const http = claimGateHoldBody(refusal);
    assert.equal(http.ok, false);
    assert.equal(http.adat_gate, "CLAIM_CLASS");
    assert.equal((http.error as any).type, "governance_hold");
  });
});

describe("claimGate - action-eligible claims pass", () => {
  it("PASSES MEASURED", live, async () => {
    const r = await gateToolClaim(
      "forge_shell",
      { justification: MEASURED_TEXT, claim_class: "MEASURED" },
      "EXECUTE_REVERSIBLE",
    );
    assert.equal(r.ok, true);
    assert.equal(r.skipped, false);
  });

  it("PASSES MECHANISM", live, async () => {
    const r = await gateToolClaim(
      "forge_execute",
      { justification: MECHANISM_TEXT, claim_class: "MECHANISM" },
      "EXECUTE_HIGH_IMPACT",
    );
    assert.equal(r.ok, true);
    assert.equal(r.skipped, false);
  });

  it("PASSES PATTERN", live, async () => {
    const r = await gateToolClaim(
      "forge_git",
      { justification: PATTERN_TEXT, claim_class: "PATTERN" },
      "EXECUTE_HIGH_IMPACT",
    );
    assert.equal(r.ok, true);
    assert.equal(r.skipped, false);
  });

  it("PASSES when no claim is stated at all (additive: existing calls untouched)", async () => {
    const r = await gateToolClaim("forge_shell", { command: "ls -la" }, "EXECUTE_REVERSIBLE");
    assert.equal(r.ok, true);
    assert.equal(r.skipped, true);
    assert.equal(r.reason, "NO_STATED_CLAIM");
  });

  it("SKIPS read-only action classes (nothing to justify)", async () => {
    const r = await gateToolClaim(
      "forge_health_check",
      { justification: NARRATIVE_TEXT, claim_class: "NARRATIVE" },
      "OBSERVE",
    );
    assert.equal(r.ok, true);
    assert.equal(r.skipped, true);
    assert.match(String(r.reason), /NON_GOVERNED_ACTION_CLASS/);
  });

  // Kernel-observed boundary (reported, not patched): claim_kernel accepts a
  // DECLARED eligible class over a text that carries no class signal at all
  // (inferred UNCLASSIFIED). The gate therefore passes it. Pinned here so the
  // boundary is visible and any future tightening is a deliberate change.
  it("documents the kernel boundary: declaration over a signal-free text passes", live, async () => {
    const r = await gateToolClaim(
      "forge_git",
      { justification: UNCLASSIFIED_TEXT, claim_class: "MEASURED" },
      "EXECUTE_HIGH_IMPACT",
    );
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.verdict?.class_verdict?.inferred, "UNCLASSIFIED");
  });

  it("SKIPS when the operator disables the gate (FORGE_CLAIM_GATE=0)", async () => {
    process.env.FORGE_CLAIM_GATE = "0";
    const r = await gateToolClaim(
      "forge_shell",
      { justification: NARRATIVE_TEXT, claim_class: "NARRATIVE" },
      "EXECUTE_REVERSIBLE",
    );
    assert.equal(r.ok, true);
    assert.equal(r.skipped, true);
    assert.match(String(r.reason), /DISABLED_BY_ENV/);
  });
});

describe("claimGate - ingress wiring", () => {
  it("is called at both MCP dispatcher wrappers and at POST /execute", () => {
    const core = fs.readFileSync("/root/A-FORGE/src/interfaces/mcp/core.ts", "utf-8");
    const server = fs.readFileSync("/root/A-FORGE/src/interfaces/server.ts", "utf-8");
    const coreHits = core.split("await gateToolClaim(").length - 1;
    const serverHits = server.split("await gateToolClaim(").length - 1;
    assert.equal(coreHits, 2, "dispatcher chokepoints wired");
    assert.equal(serverHits, 1, "HTTP ingress wired");
    assert.match(core, /claimGateRefusalResponse/);
    assert.match(server, /claimGateHoldBody/);
  });
});

// ═══════════════════════════════════════════════════════════════
// POST /execute END-TO-END (real express app, real refusal)
// ═══════════════════════════════════════════════════════════════

describe("claimGate - POST /execute end-to-end", () => {
  it("refuses a mutation justified by a NARRATIVE claim (HTTP 423)", live, async () => {
    const { app } = await import("../src/interfaces/server.js");
    const http = await import("node:http");
    const server = http.createServer(app as any);
    await new Promise<void>((res) => server.listen(0, "127.0.0.1", () => res()));
    const port = (server.address() as any).port;
    const call = async (args: Record<string, unknown>) => {
      const r = await fetch(`http://127.0.0.1:${port}/execute`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tool: "forge_git", args }),
      });
      return { status: r.status, body: (await r.json()) as any };
    };
    try {
      const nar = await call({ justification: NARRATIVE_TEXT, claim_class: "NARRATIVE" });
      assert.equal(nar.status, 423);
      assert.equal(nar.body.adat_gate, "CLAIM_CLASS");
      assert.equal(nar.body.ok, false);
      assert.match(String(nar.body.error.message), /CLAIM_GATE/);

      const undeclared = await call({ justification: UNCLASSIFIED_TEXT });
      assert.equal(undeclared.status, 423);
      assert.equal(undeclared.body.adat_gate, "CLAIM_CLASS");

      // Legitimate claim: the claim gate lets it through to the pre-existing
      // authority gate (which refuses the missing session) — not a claim refusal.
      const legit = await call({ justification: MEASURED_TEXT, claim_class: "MEASURED" });
      assert.equal(legit.status, 423);
      assert.notEqual(legit.body.adat_gate, "CLAIM_CLASS");
      assert.equal(legit.body.adat_gate, "SESSION_REQUIRED");
    } finally {
      server.close();
    }
  });
});
