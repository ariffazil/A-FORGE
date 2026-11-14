/**
 * executeUnclassifiedGate — the HTTP ingress must BLOCK unclassified tools.
 *
 * 2026-10-26 · 333-AGI · next-horizon P0 ("Require explicit classification;
 * block unclassified mutation").
 *
 * Reproduced before this test existed: POST /execute classified an unknown tool
 * at the MUTATE floor (EXECUTE_REVERSIBLE) and never consulted
 * isClassifiedTool(), so an unknown mutation needed only a session+lease while
 * McpPolicyGate L4b held the same tool on the MCP path. Deployed behaviour had
 * been IRREVERSIBLE + 888_HOLD. The ingress now denies on identity first.
 *
 * Hermetic on purpose: the CLASSIFY gate runs before the FQ metabolic gate, so
 * this test does not depend on the federation's live FQ quotient.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("POST /execute - unclassified tool gate", () => {
  it("holds an unclassified tool, and does not blanket-block a classified one", async () => {
    const { app } = await import("../src/interfaces/server.js");
    const http = await import("node:http");
    const server = http.createServer(app as any);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const port = (server.address() as any).port;

    const call = async (tool: string, args: Record<string, unknown>) => {
      const response = await fetch(`http://127.0.0.1:${port}/execute`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tool, args }),
      });
      return { status: response.status, body: (await response.json()) as any };
    };

    try {
      const unknown = await call("forge_tool_not_classified_20261026", {});
      assert.equal(unknown.status, 423, "unclassified tool must be held, not executed");
      assert.equal(unknown.body.ok, false);
      assert.equal(unknown.body.error, "UNCLASSIFIED_TOOL");
      assert.equal(unknown.body.adat_gate, "UNCLASSIFIED_HOLD");
      assert.equal(unknown.body.verdict, "HOLD");

      // A classified tool must reach its normal gate chain, never this one.
      // (forge_git is classified; its mode ladder is pinned by actionClassifier.)
      const classified = await call("forge_git", { mode: "status" });
      assert.notEqual(
        classified.body.adat_gate,
        "UNCLASSIFIED_HOLD",
        "the gate must not block a classified tool",
      );
    } finally {
      server.close();
    }
  });
});
