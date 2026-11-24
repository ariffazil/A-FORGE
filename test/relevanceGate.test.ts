/**
 * test/relevanceGate.test.ts — the search ladder must not reward junk.
 *
 * Regression lock for 2026-11-24 (Arif SEAL, tier-0 repair).
 *
 * The failure this prevents: the executor treated "HTTP 200 + non-empty results"
 * as an LFD WIN. SearXNG therefore learned from junk — its weight climbed to the
 * 3.0 clamp and it outranked healthier lanes even in pure-LFD order. Live proof
 * that day: a RAG/grounding query returned RAID-card forum posts and yearbooks
 * while being recorded as a success.
 *
 * Contract asserted here:
 *   1. A junk result scores 0 against an unrelated query.
 *   2. On-topic results score > 0.
 *   3. anyRelevant() is the only thing allowed to convert a lane into a win.
 *   4. Function words carry no signal.
 *   5. The score is deterministic (same input -> same number).
 *
 * The score is never used to drop results — see gatewayTools.ts. It only gates
 * the learning signal.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { relevanceScore, anyRelevant, tokenizeText } from "../src/domain/web/relevance.js";

const RAG_QUERY = "retrieval augmented generation agent grounding external evidence";

describe("relevance instrument — junk must score zero", () => {
  it("scores 0 for the real junk that poisoned the ladder (RAID cards)", () => {
    const s = relevanceScore(
      RAG_QUERY,
      "ARECA Owner's Thread (SAS/SATA RAID Cards)",
      "There is a master hardcoded password in some of the older cards, can only be used in the bios.",
    );
    assert.equal(s, 0);
  });

  it("scores 0 for yearbook pages against a technical query", () => {
    const s = relevanceScore(
      RAG_QUERY,
      "Treering: School Yearbooks and Custom Photo Books",
      "Treering is a memory-as-a-service provider that enables brands and organizations to transform life's meaningful moments.",
    );
    assert.equal(s, 0);
  });

  it("scores > 0 for a genuinely on-topic result", () => {
    const s = relevanceScore(
      RAG_QUERY,
      "Retrieval-Augmented Generation (RAG): A survey of grounding",
      "We survey retrieval augmented generation for grounding language models in external evidence.",
    );
    assert.ok(s > 0, `expected > 0, got ${s}`);
  });

  it("scores 1 when every query token is present", () => {
    const s = relevanceScore(
      "model context protocol",
      "Model Context Protocol specification",
      "The model context protocol specification defines server and client behaviour.",
    );
    assert.equal(s, 1);
  });
});

describe("relevance instrument — gating semantics", () => {
  it("anyRelevant is false for an all-junk set (this is what stops weight inflation)", () => {
    assert.equal(anyRelevant([0, 0, 0, 0]), false);
  });

  it("anyRelevant is true if a single result is topical (permissive: never drop results)", () => {
    assert.equal(anyRelevant([0, 0, 0.25, 0]), true);
  });

  it("anyRelevant is false for an empty set", () => {
    assert.equal(anyRelevant([]), false);
  });
});

describe("relevance instrument — tokenizer", () => {
  it("drops English and Malay function words", () => {
    const t = tokenizeText("the model and the protocol untuk dan yang");
    assert.deepEqual(t, ["model", "protocol"]);
  });

  it("drops tokens shorter than three characters", () => {
    assert.deepEqual(tokenizeText("a b c ab abc"), ["abc"]);
  });

  it("is deterministic across calls", () => {
    const q = "stateless mcp server discover";
    const a = relevanceScore(q, "Stateless MCP", "server discover handshake");
    const b = relevanceScore(q, "Stateless MCP", "server discover handshake");
    assert.equal(a, b);
  });
});
