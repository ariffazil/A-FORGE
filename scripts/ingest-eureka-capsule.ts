/**
 * ingest-eureka-capsule.ts
 *
 * Ingest the 8 Canonical Runtime Laws into MemoryContract at the 'sacred' tier.
 * Sacred entries are immutable and pinned — they survive decay and cannot be edited.
 *
 * Usage: node dist/scripts/ingest-eureka-capsule.js
 */

import { getMemoryContract } from "../src/memory-contract/MemoryContract.js";
import type { MemoryEntry } from "../src/memory-contract/MemoryContract.js";

const RUNTIME_LAWS = [
  {
    law: 1,
    title: "Tri-Organ Lattice",
    content:
      "33 tools = 3 organs, not 1 list. arifOS owns constitutional governance and final verdicts; GEOX owns earth truth and subsurface evidence; WEALTH owns capital truth, valuation, and allocation. These are different organs with different questions — never interchangeable.",
    tags: ["constitutional", "architecture", "organs", "arifOS", "GEOX", "WEALTH"],
    reason: "Derived from 33-tool orthogonal architecture review — Eureka Capsule law #1",
  },
  {
    law: 2,
    title: "Single-Owner Doctrine",
    content:
      "One tool / one question / one responsibility. arifOS owns authority, routing, verdict, and seal. GEOX owns earth truth, evidence, and subsurface interpretation. WEALTH owns capital truth, liquidity, and allocation. No duplicate judgment surfaces.",
    tags: ["orthogonality", "ownership", "architecture", "responsibility"],
    reason: "Derived from 33-tool orthogonal architecture review — Eureka Capsule law #2",
  },
  {
    law: 3,
    title: "Domain Verdict ≠ Constitutional Verdict",
    content:
      "GEOX verdict = geological / physical judgment (propose). WEALTH verdict = financial / capital judgment (propose). arifOS verdict = final constitutional permission state (judge). No GEOX or WEALTH output is final until arifOS judges it.",
    tags: ["governance", "verdict", "arifOS", "GEOX", "WEALTH", "floor"],
    reason: "Derived from 33-tool orthogonal architecture review — Eureka Capsule law #3",
  },
  {
    law: 4,
    title: "Envelope-Based Composition",
    content:
      "Tools exchange governed outputs, not hidden internals. Every step is: input envelope → tool-local transformation → output envelope → verdict/confidence/hold flags → audit receipt. Tools must not silently absorb or re-implement another tool's logic.",
    tags: ["envelope", "composition", "contract", "orthogonality"],
    reason: "Derived from 33-tool orthogonal architecture review — Eureka Capsule law #4",
  },
  {
    law: 5,
    title: "Fail-Closed by Default",
    content:
      "When evidence, authority, or coherence is weak: output UNKNOWN, PARTIAL, or 888_HOLD — not confident prose. Never optimize for fluency over governance. Unknown beats hallucination; HOLD beats unsafe action.",
    tags: ["fail-closed", "888_HOLD", "governance", "safety", "constitution"],
    reason: "Derived from 33-tool orthogonal architecture review — Eureka Capsule law #5",
  },
  {
    law: 6,
    title: "Memory is Governed",
    content:
      "Not every result becomes memory. Only sealed doctrine, durable constraints, and stable architecture principles deserve canonization. Memory has lifecycle, sovereignty, and recovery semantics. Sacred entries are immutable — do not canonize noise.",
    tags: ["memory", "governance", "sacred", "canon", "lifecycle"],
    reason: "Derived from 33-tool orthogonal architecture review — Eureka Capsule law #6",
  },
  {
    law: 7,
    title: "GEOX is Evidence-First",
    content:
      "In geology mode, default to: evidence inventory → QC → interpretation → cross-evidence → risk → product. GEOX embeds physical invariants; it refuses rather than hallucinates. AC Risk scores and floor stamps are mandatory on all GEOX outputs.",
    tags: ["GEOX", "evidence", "physics", "subsurface", "AC_Risk", "floor"],
    reason: "Derived from 33-tool orthogonal architecture review — Eureka Capsule law #7",
  },
  {
    law: 8,
    title: "Swarm-Readiness Needs Contracts, Not More Organs",
    content:
      "The 33-tool lattice is architecturally sufficient for governed AGI-grade intelligence. Swarm-readiness still depends on: stronger cross-organ envelopes, stronger coordination contracts, stronger verdict interoperability, stronger feedback loops, and full WEALTH hardening. Prefer contract hardening over tool proliferation.",
    tags: ["swarm", "contracts", "WEALTH", "orthogonality", "architecture", "feedback"],
    reason: "Derived from 33-tool orthogonal architecture review — Eureka Capsule law #8",
  },
];

async function main() {
  const contract = getMemoryContract();
  await contract.initialize();

  const existingSacred = contract.getByTier("sacred");
  const existingLawIds = new Set(
    existingSacred
      .filter((m: MemoryEntry) => m.tags.includes("eureka-capsule"))
      .map((m: MemoryEntry) => m.content.slice(0, 80)),
  );

  let ingested = 0;
  let skipped = 0;

  for (const law of RUNTIME_LAWS) {
    const contentPreview = law.content.slice(0, 80);
    if (existingLawIds.has(contentPreview)) {
      console.log(`[SKIP] Law ${law.law} (${law.title}) — already ingested`);
      skipped++;
      continue;
    }

    const entry = await contract.store({
      content: `[EUREKA CAPSULE — LAW ${law.law}: ${law.title}]\n\n${law.content}`,
      tier: "sacred",
      source: {
        type: "system",
        description: "Eureka Capsule — 33-tool orthogonal architecture review (2026-04-14)",
        reference:
          "https://github.com/ariffazil/af-forge/blob/main/AGENTS.md",
      },
      confidence: 1.0,
      reason: law.reason,
      tags: ["eureka-capsule", `law-${law.law}`, ...law.tags],
    });

    console.log(
      `[INGESTED] Law ${law.law}: ${law.title} → memoryId=${entry.memoryId} (sacred, pinned=${entry.pinned}, editable=${entry.editable})`,
    );
    ingested++;
  }

  const stats = contract.getStats();
  console.log(
    `\nDone. Ingested=${ingested} Skipped=${skipped} | Sacred total=${stats.sacred}`,
  );
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
