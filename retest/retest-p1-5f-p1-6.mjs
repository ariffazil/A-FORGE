#!/usr/bin/env node
/**
 * P1-5f + P1-6 TARGET-RELEASE RETEST — 4 scenarios required before ARIF GO.
 *
 * Authorized: F13 (Arif) 2026-11-17, answering "a and b" on the observatory
 * NEXT MUTATION GATE. Canary 2026-09-09 passed happy-path only; this suite
 * covers the four cases the gate names:
 *   S1 retry        → offline fallback + sweep replay (no silent drop)
 *   S2 duplicate    → same receipt_id twice → server-side dedupe, FQ unchanged
 *   S3 restart      → fresh process emission (module re-init after restart)
 *   S4 writer fail  → arifFLOW answers 500 → local fallback, no drop
 *
 * NOTE: /root/A-FORGE/scripts and /root/A-FORGE/reports are chattr +i
 * (immutable). This harness therefore lives in /root/A-FORGE/retest/.
 *
 * Additive only. Invoked as:  node retest/retest-p1-5f-p1-6.mjs --phase <p>
 *
 * DITEMPA BUKAN DIBERI.
 */
import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";

const PHASE = (() => {
  const i = process.argv.indexOf("--phase");
  return i > -1 ? process.argv[i + 1] : "offline";
})();

const ACTOR = process.env.RETEST_ACTOR || "retest.p1-5-6";
const RUN = process.env.RETEST_RUN_ID || "manual";
const SESSION = `retest-p1-5f-p1-6-${RUN}`;
const RECEIPTS = "/var/lib/arifflow/receipts.jsonl";
const DUPS = "/var/lib/arifflow/duplicates.jsonl";
const FALLBACK = process.env.AF_FLOW_FALLBACK_PATH || "";

const out = { phase: PHASE, run: RUN, at: new Date().toISOString(), checks: [] };
const check = (name, pass, detail = "") => {
  out.checks.push({ name, pass, detail });
  console.log(`  ${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const countLines = (p) => (existsSync(p) ? readFileSync(p, "utf-8").split("\n").filter(Boolean).length : 0);
const countMarker = (p, marker) =>
  existsSync(p) ? readFileSync(p, "utf-8").split("\n").filter((l) => l.includes(marker)).length : 0;

// shape identical to emitReceipt()'s ingest payload (Rust FlowReceipt)
function receiptShape(receiptId, summary) {
  return {
    receipt_id: receiptId,
    previous_receipt_hash: null,
    created_at: new Date().toISOString(),
    actor_id: ACTOR,
    session_id: SESSION,
    session_token: null,
    step_type: "Execute",
    topology_id: null,
    lane_id: null,
    step_number: 0,
    cost_ns: 0,
    preceding_verify_cost_ns: null,
    epistemic_label: "Observation",
    floor_verdict: "Pass",
    cooling_decision: "None",
    tri_witness_votes: null,
    merkle_root: null,
    merkle_inclusion_proof: null,
    payload: { summary, details: { retest: "retest-p1-5f-p1-6", run: RUN } },
  };
}

async function postIngest(url, body) {
  const res = await fetch(`${url}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { http: res.status, json, text };
}

if (PHASE === "offline") {
  const { emitAForgeReceipt, FALLBACK_PATH } = await import(
    new URL("../dist/src/infrastructure/receipts/flowEmit.js", import.meta.url).href
  );
  check("fallback path isolated from prod", FALLBACK_PATH === FALLBACK, FALLBACK_PATH);
  const before = countLines(FALLBACK);
  const results = [];
  for (let i = 1; i <= 3; i++) {
    results.push(
      await emitAForgeReceipt({
        actor_id: ACTOR,
        session_id: SESSION,
        step_type: "Execute",
        summary: `S1 retry — offline emission #${i}`,
        epistemic_label: "OBS",
        floor_verdict: "PASS",
      }),
    );
  }
  const after = countLines(FALLBACK);
  check("3 emissions failed honestly (ok=false)", results.every((r) => r.ok === false), results.map((r) => r.ok).join(","));
  check("3 fallback lines written (no silent drop)", after - before === 3, `${before}→${after}`);
  check("failure reason captured", results.every((r) => r.fallback_written === true && !!r.error));
  out.fallback_delta = after - before;
}

if (PHASE === "recover") {
  const { maybeSweep } = await import(
    new URL("../dist/src/infrastructure/receipts/flowFallbackSweeper.js", import.meta.url).href
  );
  const { emitAForgeReceipt } = await import(
    new URL("../dist/src/infrastructure/receipts/flowEmit.js", import.meta.url).href
  );
  const live = await emitAForgeReceipt({
    actor_id: ACTOR,
    session_id: SESSION,
    step_type: "Execute",
    summary: "S1 retry — recovery emission (plane back)",
    epistemic_label: "OBS",
    floor_verdict: "PASS",
  });
  check("recovery emission landed (ok=true)", live.ok === true, JSON.stringify(live).slice(0, 120));
  const report = (await maybeSweep("retest-recover")) || { replayed: 0, remaining: -1, failed: -1 };
  check("sweeper replayed the 3 offline receipts", report.replayed >= 3, `replayed=${report.replayed}`);
  check("no receipt left pending (nothing dropped)", report.remaining === 0, `remaining=${report.remaining}`);
  check("replayed ledger appended", countLines(`${FALLBACK}.replayed`) >= 3);
  const landed = countMarker(RECEIPTS, "S1 retry — offline emission");
  check("offline receipts durably in arifFLOW", landed >= 3, `marker hits=${landed}`);
  out.sweep = report;
  out.fallback_after_drain = countLines(FALLBACK);
}

if (PHASE === "dedup") {
  const url = process.env.ARIFLOW_URL || "http://127.0.0.1:7073";
  const { getClient } = await import(
    new URL("../dist/src/infrastructure/receipts/arifflowClient.js", import.meta.url).href
  );
  const client = getClient(url);
  const fqBefore = (await client.health()).fq;
  const dupBefore = countLines(DUPS);
  const id = randomUUID();
  const body = receiptShape(id, "S2 duplicate — fixed receipt_id delivery");

  const first = await postIngest(url, body);
  const second = await postIngest(url, body);
  const third = await postIngest(url, { ...body, receipt_id: randomUUID() }); // fresh UUID, same content

  check("first delivery stored", first.http === 200 && first.json?.duplicate !== true, `http=${first.http}`);
  check("second delivery classified duplicate", second.http === 200 && second.json?.status === "duplicate", `status=${second.json?.status}`);
  check("duplicate stored=false", second.json?.stored === false);
  check("duplicate fq_unchanged=true", second.json?.fq_unchanged === true);
  check("duplicate durably logged", countLines(DUPS) - dupBefore >= 1, `duplicates.jsonl ${dupBefore}→${countLines(DUPS)}`);
  out.fresh_uuid_copy_stored = third.http === 200 && third.json?.duplicate !== true;
  out.dedupe_key = second.json?.dedupe_key || null;
  out.fq_metric_frame = fqBefore?.metric_frame ?? null;
}

if (PHASE === "writer500") {
  const { createServer } = await import("node:http");
  const url = process.env.ARIFLOW_URL || "http://127.0.0.1:7079";
  const port = Number(new URL(url).port || 7079);
  // self-verifying: record every fetch URL so the report proves which target was hit
  const fetchedUrls = [];
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (u, o) => { fetchedUrls.push(String(u)); return origFetch(u, o); };
  const stub = createServer((req, res) => {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "error", error: "simulated receipt-writer failure" }));
  });
  await new Promise((r) => stub.listen(port, "127.0.0.1", r));

  const { emitAForgeReceipt } = await import(
    new URL("../dist/src/infrastructure/receipts/flowEmit.js", import.meta.url).href
  );
  const { emitFlowReceipt } = await import(
    new URL("../dist/src/infrastructure/bridges/arifFlowBridge.js", import.meta.url).href
  );
  const fbBefore = countLines(FALLBACK);
  const exec = await emitAForgeReceipt({
    actor_id: ACTOR,
    session_id: SESSION,
    step_type: "Execute",
    summary: "S4 writer500 — executor path against 500 writer",
    epistemic_label: "OBS",
    floor_verdict: "PASS",
  });
  const bridge = await emitFlowReceipt({
    actor_id: ACTOR,
    session_id: SESSION,
    step_type: "Execute",
    cost_ns: 0,
    payload: { summary: "S4 writer500 — shell bridge path against 500 writer" },
  });
  const fbAfter = countLines(FALLBACK);
  stub.close();

  check("executor path fell back honestly", exec.ok === false && exec.fallback_written === true, JSON.stringify(exec).slice(0, 100));
  check("shell bridge path returned non-ok", bridge.ok === false, `status=${bridge.status}`);
  check("both failures persisted to fallback (no drop)", fbAfter - fbBefore >= 2, `${fbBefore}→${fbAfter}`);
  out.fallback_delta = fbAfter - fbBefore;
  out.fetched_urls = fetchedUrls;
  out.env_ariflow_url = process.env.ARIFLOW_URL ?? null;
  out.bridge_result = bridge;
  out.exec_result = exec;
  out.evidence_class = "SIMULATED_WRITER_FAILURE (HTTP 500 stub on loopback; prod writer untouched)";
}

if (PHASE === "fresh") {
  const { emitAForgeReceipt } = await import(
    new URL("../dist/src/infrastructure/receipts/flowEmit.js", import.meta.url).href
  );
  const r = await emitAForgeReceipt({
    actor_id: ACTOR,
    session_id: SESSION,
    step_type: "Verify",
    summary: "S3 restart — emission from a fresh process (module re-init)",
    epistemic_label: "OBS",
    floor_verdict: "PASS",
  });
  check("emission works from cold process (restart-safe)", r.ok === true, JSON.stringify(r).slice(0, 120));
  out.pid = process.pid;
}

console.log(JSON.stringify(out));
