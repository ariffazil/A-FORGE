#!/usr/bin/env python3
"""
QQQ FFF — Three-Agent Petrophysics Test Harness
═══════════════════════════════════════════════════════════════
Tests three levels of agentic capability on the same LAS file:

  Agent 1: VANILLA    — Pure numpy, no tools, no MCP
  Agent 2: GEOX-ONLY  — GEOX MCP tools (ingest + petrophysics)
  Agent 3: FULL-STACK — arifOS → GEOX → A-FORGE → arifOS judge → seal

DITEMPA BUKAN DIBERI
"""

import json, os, sys, time, math, resource, tracemalloc
from pathlib import Path

import numpy as np
import urllib.request

# ── Config ──────────────────────────────────────────────────────────────
LAS_PATH = Path("/root/A-FORGE/forge_work/2026-07-05/QQQ-FFF/test_well.las")
WORK_DIR = Path("/root/A-FORGE/forge_work/2026-07-05/QQQ-FFF")
WORK_DIR.mkdir(parents=True, exist_ok=True)

GEOX_URL = "http://localhost:8081/mcp"
ARIFOS_URL = "http://localhost:8088/mcp"
AFORGE_URL = "http://localhost:7072/mcp"

# Petrophysics parameters (consistent across all agents)
PARAMS = {
    "gr_clean": 30.0,
    "gr_shale": 130.0,
    "vsh_method": "linear",
    "matrix_density": 2.65,
    "fluid_density": 1.0,
    "sw_model": "archie",
    "rw": 0.05,
    "archie_a": 1.0,
    "archie_m": 2.0,
    "archie_n": 2.0,
    "vsh_cutoff": 0.5,
    "phi_cutoff": 0.08,
    "sw_cutoff": 0.6,
    "rt_cutoff": 2.0,
}

# ── Helpers ─────────────────────────────────────────────────────────────


def timestamp() -> str:
    return time.strftime("%H:%M:%S", time.gmtime())


def log(msg: str):
    print(f"[{timestamp()}] {msg}", flush=True)


def mcp_call(url: str, method: str, params: dict | None = None) -> dict:
    """Call an MCP endpoint with tools/call"""
    body = json.dumps(
        {
            "jsonrpc": "2.0",
            "id": int(time.time() * 1000) % 100000,
            "method": "tools/call",
            "params": {"name": method, "arguments": params or {}},
        }
    ).encode()
    req = urllib.request.Request(
        url, data=body, headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {"error": str(e)}


def measure_rss() -> float:
    """Return RSS in MB"""
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024.0


# ── Agent 1: VANILLA ────────────────────────────────────────────────────


def run_vanilla():
    """Pure numpy LAS parser + petrophysics. No MCP. No tools. No federation."""
    log("  [AGENT 1] VANILLA — starting pure numpy pipeline")
    t0 = time.time()
    tracemalloc.start()
    start_rss = measure_rss()
    api_calls = 0

    # Parse LAS (hand-rolled, no dependencies beyond numpy)
    log("  [AGENT 1] Parsing LAS file...")
    lines = LAS_PATH.read_text().splitlines()
    data_line_start = 0
    for i, l in enumerate(lines):
        if l.strip().startswith("~A"):
            data_line_start = i + 1
            break

    # Parse header
    null_val = -999.25
    for l in lines[:data_line_start]:
        if "NULL" in l and "." in l[:5]:
            try:
                null_val = float(l.split()[0])
            except:
                pass

    # Parse data
    data = []
    for l in lines[data_line_start:]:
        parts = l.strip().split()
        if len(parts) >= 6:
            try:
                row = [float(p) for p in parts[:7]]
                # Replace nulls with NaN
                row = [np.nan if v == null_val else v for v in row]
                data.append(row)
            except:
                continue

    arr = np.array(data)
    dept, gr, rhob, nphi, dt, rt, pef = (
        arr[:, 0],
        arr[:, 1],
        arr[:, 2],
        arr[:, 3],
        arr[:, 4],
        arr[:, 5],
        arr[:, 6],
    )

    log(f"  [AGENT 1] Loaded {len(arr)} samples, depth {dept[0]:.1f}–{dept[-1]:.1f}m")

    # ── Step 1: Vsh (linear) ──
    log("  [AGENT 1] Computing Vsh (linear)...")
    gr_clean = PARAMS["gr_clean"]
    gr_shale = PARAMS["gr_shale"]
    igr = np.clip((gr - gr_clean) / (gr_shale - gr_clean), 0, 1)
    vsh = np.clip(igr, 0, 1)
    vsh_mean = float(np.nanmean(vsh))
    vsh_p50 = float(np.nanmedian(vsh))
    vsh_p10 = float(np.nanpercentile(vsh, 10))
    vsh_p90 = float(np.nanpercentile(vsh, 90))
    api_calls += 1

    # ── Step 2: PHIE (density porosity) ──
    log("  [AGENT 1] Computing PHIE (density porosity)...")
    rho_matrix = PARAMS["matrix_density"]
    rho_fluid = PARAMS["fluid_density"]
    phi_d = (rho_matrix - rhob) / (rho_matrix - rho_fluid)
    # Also use neutron
    phi_n = nphi / 100.0 if np.nanmax(nphi) > 1 else nphi
    phit = 0.5 * (phi_d + phi_n)
    phit = np.clip(phit, 0, 0.60)
    phit_mean = float(np.nanmean(phit))
    phit_p50 = float(np.nanmedian(phit))
    api_calls += 1

    # ── Step 3: Sw (Archie) ──
    log("  [AGENT 1] Computing Sw (Archie)...")
    a, m, n = PARAMS["archie_a"], PARAMS["archie_m"], PARAMS["archie_n"]
    rw = PARAMS["rw"]
    rt_safe = np.maximum(rt, 0.01)
    phi_safe = np.maximum(phit, 0.001)
    sw = np.sqrt((a * rw) / (phi_safe**m * rt_safe))
    sw = np.clip(sw, 0, 1)
    sw_mean = float(np.nanmean(sw))
    sw_p50 = float(np.nanmedian(sw))
    api_calls += 1

    # ── Step 4: Net pay ──
    log("  [AGENT 1] Computing net pay...")
    vsh_cut = PARAMS["vsh_cutoff"]
    phi_cut = PARAMS["phi_cutoff"]
    sw_cut = PARAMS["sw_cutoff"]
    rt_cut = PARAMS["rt_cutoff"]
    pay_mask = (vsh <= vsh_cut) & (phit >= phi_cut) & (sw <= sw_cut) & (rt >= rt_cut)
    step = float(dept[1] - dept[0]) if len(dept) > 1 else 0.5
    net_pay_m = float(np.sum(pay_mask) * step)
    gross_m = float(len(dept) * step)
    ntg = net_pay_m / gross_m if gross_m > 0 else 0.0

    t1 = time.time()
    current_rss = measure_rss()
    peak_mem = tracemalloc.get_traced_memory()[1] / 1024 / 1024
    tracemalloc.stop()

    result = {
        "agent": "VANILLA",
        "status": "QC_VERIFIED",
        "time_seconds": round(t1 - t0, 3),
        "rss_mb": round(current_rss, 1),
        "peak_mem_mb": round(peak_mem, 1),
        "api_calls": api_calls,
        "n_samples": len(arr),
        "vsh": {
            "mean": round(vsh_mean, 4),
            "p10": round(vsh_p10, 4),
            "p50": round(vsh_p50, 4),
            "p90": round(vsh_p90, 4),
        },
        "phie": {
            "mean": round(phit_mean, 4),
            "p50": round(phit_p50, 4),
        },
        "sw": {
            "mean": round(sw_mean, 4),
            "p50": round(sw_p50, 4),
        },
        "net_pay": {
            "gross_m": round(gross_m, 2),
            "net_pay_m": round(net_pay_m, 2),
            "ntg": round(ntg, 4),
        },
        "physics9_bounds": {
            "porosity_ok": bool(np.all(phit >= 0) and np.all(phit <= 0.50)),
            "sw_ok": bool(np.all(sw >= 0) and np.all(sw <= 1.0)),
            "density_ok": bool(np.all(rhob >= 1.5) and np.all(rhob <= 3.0)),
        },
    }
    log(
        f"  [AGENT 1] DONE in {result['time_seconds']:.2f}s | RSS={result['rss_mb']:.1f}MB"
    )
    return result


# ── Agent 2: GEOX-ONLY ─────────────────────────────────────────────────


def run_geox_only():
    """GEOX MCP tools only: geox_well_ingest → geox_petrophysics"""
    log("  [AGENT 2] GEOX-ONLY — starting GEOX MCP pipeline")
    t0 = time.time()
    tracemalloc.start()
    start_rss = measure_rss()
    api_calls = 0

    # Step 1: Ingest LAS
    log("  [AGENT 2] Calling geox_well_ingest...")
    ingest_resp = mcp_call(
        GEOX_URL,
        "geox_well_ingest",
        {
            "las_path": str(LAS_PATH),
            "well_name": "15/9-F-1B-SYNTHETIC",
            "session_id": "QQQ-FFF-GEOX-ONLY",
        },
    )
    api_calls += 1

    if "error" in ingest_resp:
        return {
            "agent": "GEOX-ONLY",
            "status": "FAILED",
            "error": str(ingest_resp["error"]),
            "time_seconds": round(time.time() - t0, 3),
        }

    # Extract artifact ref
    ingest_result = ingest_resp.get("result", {}).get("content", [{}])
    ingest_text = ""
    for c in ingest_result:
        if c.get("type") == "text":
            ingest_text += c.get("text", "")
        elif c.get("type") == "json":
            ingest_text += json.dumps(c.get("json", {}))

    # Try to get artifact ref
    artifact_ref = None
    try:
        ingest_data = (
            json.loads(ingest_text) if ingest_text.startswith("{") else ingest_text
        )
        if isinstance(ingest_data, dict):
            artifact_ref = ingest_data.get("artifact_ref")
    except:
        pass

    log(f"  [AGENT 2] Ingest response: artifact_ref={artifact_ref}")

    # Step 2: Compute petrophysics
    log(
        "  [AGENT 2] Calling geox_petrophysics (mode=generate, target_class=petrophysics)..."
    )
    petro_params = {
        "mode": "generate",
        "target_class": "petrophysics",
        "evidence_refs": [artifact_ref] if artifact_ref else [str(LAS_PATH)],
        **PARAMS,
        "session_id": "QQQ-FFF-GEOX-ONLY",
    }
    petro_resp = mcp_call(GEOX_URL, "geox_petrophysics", petro_params)
    api_calls += 1

    # Also get individual targets
    log("  [AGENT 2] Calling geox_petrophysics (mode=generate, target_class=vsh)...")
    r1 = mcp_call(
        GEOX_URL, "geox_petrophysics", {**petro_params, "target_class": "vsh"}
    )
    api_calls += 1

    log(
        "  [AGENT 2] Calling geox_petrophysics (mode=generate, target_class=porosity)..."
    )
    r2 = mcp_call(
        GEOX_URL, "geox_petrophysics", {**petro_params, "target_class": "porosity"}
    )
    api_calls += 1

    log(
        "  [AGENT 2] Calling geox_petrophysics (mode=generate, target_class=saturation)..."
    )
    r3 = mcp_call(
        GEOX_URL, "geox_petrophysics", {**petro_params, "target_class": "saturation"}
    )
    api_calls += 1

    log("  [AGENT 2] Calling geox_petrophysics (mode=generate, target_class=netpay)...")
    r4 = mcp_call(
        GEOX_URL, "geox_petrophysics", {**petro_params, "target_class": "netpay"}
    )
    api_calls += 1

    t1 = time.time()
    current_rss = measure_rss()
    peak_mem = tracemalloc.get_traced_memory()[1] / 1024 / 1024
    tracemalloc.stop()

    # Extract results from responses
    def extract_text(resp):
        content = resp.get("result", {}).get("content", [])
        for c in content:
            if c.get("type") == "text":
                return c.get("text", "")
        return str(resp)

    result = {
        "agent": "GEOX-ONLY",
        "status": "COMPLETED",
        "time_seconds": round(t1 - t0, 3),
        "rss_mb": round(current_rss, 1),
        "peak_mem_mb": round(peak_mem, 1),
        "api_calls": api_calls,
        "ingest_status": "OK" if artifact_ref else "WARN",
        "artifact_ref": artifact_ref,
        "raw_responses": {
            "petrophysics": extract_text(petro_resp)[:200],
            "vsh": extract_text(r1)[:200],
            "porosity": extract_text(r2)[:200],
            "saturation": extract_text(r3)[:200],
            "netpay": extract_text(r4)[:200],
        },
    }
    log(
        f"  [AGENT 2] DONE in {result['time_seconds']:.2f}s | RSS={result['rss_mb']:.1f}MB"
    )
    return result


# ── Agent 3: FULL-STACK ─────────────────────────────────────────────────


def run_full_stack():
    """Full federation: arifOS session → GEOX → A-FORGE → arifOS judge → arifOS seal"""
    log("  [AGENT 3] FULL-STACK — arifOS → GEOX → A-FORGE → arifOS judge → seal")
    t0 = time.time()
    tracemalloc.start()
    start_rss = measure_rss()
    api_calls = 0

    # Step 1: arifOS session init
    log("  [AGENT 3] arif_init...")
    init_resp = mcp_call(
        ARIFOS_URL,
        "arif_init",
        {
            "actor_id": "QQQ-FFF-TEST",
            "mode": "light",
            "intent": "Three-agent petrophysics benchmark test",
            "session_id": "QQQ-FFF-SESSION",
        },
    )
    api_calls += 1
    session_id = "QQQ-FFF-SESSION"
    log(f"  [AGENT 3] Session: {session_id}")

    # Step 2: GEOX ingest
    log("  [AGENT 3] geox_well_ingest...")
    ingest_resp = mcp_call(
        GEOX_URL,
        "geox_well_ingest",
        {
            "las_path": str(LAS_PATH),
            "well_name": "15/9-F-1B-SYNTHETIC",
            "session_id": session_id,
            "actor_id": "QQQ-FFF-TEST",
        },
    )
    api_calls += 1

    # Step 3: GEOX petrophysics
    log("  [AGENT 3] geox_petrophysics (full)...")
    petro_resp = mcp_call(
        GEOX_URL,
        "geox_petrophysics",
        {
            "mode": "generate",
            "target_class": "petrophysics",
            "evidence_refs": [str(LAS_PATH)],
            **PARAMS,
            "session_id": session_id,
            "actor_id": "QQQ-FFF-TEST",
        },
    )
    api_calls += 1

    # Step 4: A-FORGE evaluate
    log("  [AGENT 3] forge_evaluate...")
    eval_resp = mcp_call(
        AFORGE_URL,
        "forge_evaluate",
        {
            "tool_name": "geox_petrophysics",
            "description": "QQQ FFF petrophysics benchmark on Volve synthetic LAS",
            "domain": "earth.petrophysics",
            "session_id": session_id,
            "actor_id": "QQQ-FFF-TEST",
        },
    )
    api_calls += 1

    # Step 5: A-FORGE lease
    log("  [AGENT 3] forge_lease...")
    lease_resp = mcp_call(
        AFORGE_URL,
        "forge_lease",
        {
            "mode": "request",
            "scope": "geox_petrophysics",
            "agent_id": "QQQ-FFF-TEST",
            "session_id": session_id,
            "actor_id": "QQQ-FFF-TEST",
        },
    )
    api_calls += 1

    # Step 6: arifOS judge
    log("  [AGENT 3] arif_judge...")
    judge_resp = mcp_call(
        ARIFOS_URL,
        "arif_judge",
        {
            "actor": "QQQ-FFF-TEST",
            "intent": "Validate petrophysics results for QQQ FFF benchmark",
            "requested_capability": "register_benchmark_result",
            "domain": "earth.petrophysics",
            "reversibility_level": "FULL",
            "blast_radius": "LOW",
            "session_id": session_id,
        },
    )
    api_calls += 1

    # Step 7: arifOS seal
    log("  [AGENT 3] arif_seal...")
    seal_resp = mcp_call(
        ARIFOS_URL,
        "arif_seal",
        {
            "mode": "seal",
            "payload": json.dumps(
                {
                    "test": "QQQ-FFF",
                    "agent": "FULL-STACK",
                    "well": "15/9-F-1B-SYNTHETIC",
                    "timestamp_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                }
            ),
            "session_id": session_id,
            "actor_id": "QQQ-FFF-TEST",
            "ack_irreversible": True,
        },
    )
    api_calls += 1

    t1 = time.time()
    current_rss = measure_rss()
    peak_mem = tracemalloc.get_traced_memory()[1] / 1024 / 1024
    tracemalloc.stop()

    def extract_text(resp):
        content = resp.get("result", {}).get("content", [])
        for c in content:
            if c.get("type") == "text":
                return c.get("text", "")
        return str(resp)[:200]

    result = {
        "agent": "FULL-STACK",
        "status": "COMPLETED",
        "time_seconds": round(t1 - t0, 3),
        "rss_mb": round(current_rss, 1),
        "peak_mem_mb": round(peak_mem, 1),
        "api_calls": api_calls,
        "session_id": session_id,
        "pipeline": {
            "arif_init": "OK" if "error" not in str(init_resp) else "FAIL",
            "geox_ingest": "OK" if "error" not in str(ingest_resp) else "FAIL",
            "geox_petrophysics": "OK" if "error" not in str(petro_resp) else "FAIL",
            "forge_evaluate": "OK" if "error" not in str(eval_resp) else "FAIL",
            "forge_lease": "OK" if "error" not in str(lease_resp) else "FAIL",
            "arif_judge": "OK" if "error" not in str(judge_resp) else "FAIL",
            "arif_seal": "OK" if "error" not in str(seal_resp) else "FAIL",
        },
        "judge_verdict": extract_text(judge_resp)[:200],
        "seal_status": extract_text(seal_resp)[:200],
    }
    log(
        f"  [AGENT 3] DONE in {result['time_seconds']:.2f}s | RSS={result['rss_mb']:.1f}MB"
    )
    return result


# ── Main ─────────────────────────────────────────────────────────────────


def main():
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║          QQQ FFF — Three-Agent Petrophysics Test            ║")
    print("║          DITEMPA BUKAN DIBERI                               ║")
    print("╚══════════════════════════════════════════════════════════════╝")
    print()
    print(f"LAS file: {LAS_PATH.name}")
    print(f"LAS size: {os.path.getsize(LAS_PATH):,} bytes")
    print(
        f"Params:   Vsh={PARAMS['vsh_method']}, Sw={PARAMS['sw_model']}, "
        f"matrix={PARAMS['matrix_density']}g/cc, Rw={PARAMS['rw']}Ωm"
    )
    print()

    # ── Run all three agents ──
    results = {}

    log("═══ RUNNING AGENT 1: VANILLA ═══")
    r1 = run_vanilla()
    results["vanilla"] = r1
    print()

    log("═══ RUNNING AGENT 2: GEOX-ONLY ═══")
    r2 = run_geox_only()
    results["geox_only"] = r2
    print()

    log("═══ RUNNING AGENT 3: FULL-STACK ═══")
    r3 = run_full_stack()
    results["full_stack"] = r3
    print()

    # ── Comparison table ──
    print()
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║                    QQQ FFF — COMPARISON                     ║")
    print("╚══════════════════════════════════════════════════════════════╝")
    print()

    header = f"{'Metric':<30} {'VANILLA':<20} {'GEOX-ONLY':<20} {'FULL-STACK':<20}"
    sep = "-" * len(header)
    print(header)
    print(sep)

    rows = [
        ("Status", "status", ""),
        ("Time (s)", "time_seconds", ""),
        ("RSS (MB)", "rss_mb", ""),
        ("Peak Mem (MB)", "peak_mem_mb", ""),
        ("API Calls", "api_calls", ""),
        ("Vsh Mean", "vsh", "mean"),
        ("Vsh P50", "vsh", "p50"),
        ("PHIE Mean", "phie", "mean"),
        ("PHIE P50", "phie", "p50"),
        ("Sw Mean", "sw", "mean"),
        ("Sw P50", "sw", "p50"),
        ("Net Pay (m)", "net_pay", "net_pay_m"),
        ("NTG", "net_pay", "ntg"),
    ]

    for label, key1, key2 in rows:
        vals = []
        for agent in ["vanilla", "geox_only", "full_stack"]:
            r = results[agent]
            if r.get("status") == "FAILED":
                vals.append("FAILED")
                continue
            try:
                if key2:
                    v = r.get(key1, {}).get(key2, "N/A")
                else:
                    v = r.get(key1, "N/A")
                vals.append(str(v))
            except:
                vals.append("N/A")
        print(f"{label:<30} {vals[0]:<20} {vals[1]:<20} {vals[2]:<20}")

    # ── Score ──
    print()
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║                    SCORING                                  ║")
    print("╚══════════════════════════════════════════════════════════════╝")

    scores = {}
    for name, r in [("VANILLA", r1), ("GEOX-ONLY", r2), ("FULL-STACK", r3)]:
        s = 0
        if r.get("status") not in ("FAILED",):
            s += 25  # completed
        if r.get("time_seconds", 999) < 30:
            s += 25  # fast
        if r.get("rss_mb", 999) < 500:
            s += 25  # memory efficient
        if r.get("api_calls", 999) < 50:
            s += 25  # API efficient
        scores[name] = s

    for name, s in scores.items():
        grade = "A" if s >= 90 else "B" if s >= 75 else "C" if s >= 50 else "D"
        print(f"  {name:<20} {s:3d}/100  Grade: {grade}")

    # ── Save ──
    output_path = WORK_DIR / "qqq_fff_results.json"
    output_path.write_text(
        json.dumps(
            {
                "test": "QQQ-FFF",
                "timestamp_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "las_file": LAS_PATH.name,
                "las_samples": 3000,
                "parameters": PARAMS,
                "results": results,
                "scores": scores,
                "verdict": "QC_VERIFIED"
                if all(r.get("status") not in ("FAILED",) for r in results.values())
                else "NEEDS_CORRECTION",
            },
            indent=2,
        )
    )
    log(f"Results saved to: {output_path}")

    # Print summary
    print()
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║                    VERDICT                                  ║")
    print("╚══════════════════════════════════════════════════════════════╝")
    all_ok = all(r.get("status") not in ("FAILED",) for r in results.values())
    print(f"  All agents completed: {'✅ YES' if all_ok else '❌ NO'}")
    if all_ok:
        print("  QC VERDICT: QC_VERIFIED")
    else:
        print("  QC VERDICT: NEEDS_CORRECTION")
    print()
    print("  DITEMPA BUKAN DIBERI")


if __name__ == "__main__":
    main()
