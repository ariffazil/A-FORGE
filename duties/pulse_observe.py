#!/usr/bin/env python3
"""Pulse observe helpers — latency cohorts, zombie provenance, forge_work ledger.

Read-only. No kill, no purge, no docker recycle.
Invoked by forge-vitality-pulse.sh. 2026-09-13 B-audit upgrades.
"""
from __future__ import annotations

import json
import os
import statistics
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

PREV_PATH = Path("/root/A-FORGE/duties/logs/.pulse-observe-prev.json")
FORGE_WORK = Path("/root/A-FORGE/forge_work")
ORGANS = [
    ("arifos", 8088),
    ("aforge", 7071),
    ("aaa", 3001),
    ("geox", 8081),
    ("wealth", 18082),
    ("well", 18083),
]
SAMPLE_N = 5
PUBLIC_GEOX = "https://geox.arif-fazil.com/"


def _curl_ms(url: str, timeout: float = 5.0) -> tuple[int, int]:
    t0 = time.perf_counter()
    try:
        r = subprocess.run(
            [
                "curl",
                "-sS",
                "-o",
                "/dev/null",
                "-w",
                "%{http_code}",
                "--max-time",
                str(int(timeout)),
                url,
            ],
            capture_output=True,
            text=True,
            timeout=timeout + 1,
        )
        code = int((r.stdout or "0").strip() or 0)
    except Exception:
        code = 0
    ms = int((time.perf_counter() - t0) * 1000)
    return code, ms


def _stats(ms_list: list[int]) -> dict:
    if not ms_list:
        return {"n": 0}
    s = sorted(ms_list)
    n = len(s)
    p95_i = min(n - 1, max(0, int(round(0.95 * (n - 1)))))
    return {
        "n": n,
        "min_ms": s[0],
        "median_ms": int(statistics.median(s)),
        "p95_ms": s[p95_i],
        "max_ms": s[-1],
        "mean_ms": int(sum(s) / n),
    }


def latency_cohorts() -> dict:
    local = {}
    for name, port in ORGANS:
        url = f"http://127.0.0.1:{port}/health"
        samples = []
        codes = []
        for _ in range(SAMPLE_N):
            code, ms = _curl_ms(url)
            samples.append(ms)
            codes.append(code)
            time.sleep(0.05)
        st = _stats(samples)
        st["url"] = url
        st["status_distribution"] = {str(c): codes.count(c) for c in sorted(set(codes))}
        st["interpretation"] = (
            "PROCEED" if codes.count(200) == SAMPLE_N else "DEGRADED_OR_DOWN"
        )
        local[name] = st
    pub_s, pub_c = [], []
    for _ in range(SAMPLE_N):
        code, ms = _curl_ms(PUBLIC_GEOX, timeout=8)
        pub_s.append(ms)
        pub_c.append(code)
        time.sleep(0.05)
    public = _stats(pub_s)
    public["url"] = PUBLIC_GEOX
    public["status_distribution"] = {str(c): pub_c.count(c) for c in sorted(set(pub_c))}
    public["interpretation"] = "reachable_with_external_path_variance"
    return {"local": local, "public_geox": public, "sample_count": SAMPLE_N, "method": "curl -sS -o /dev/null -w http_code timed in-process"}


def _ps() -> list[dict]:
    r = subprocess.run(
        ["ps", "-eo", "pid,ppid,stat,etime,user,cmd"],
        capture_output=True,
        text=True,
        timeout=8,
    )
    rows = []
    for line in (r.stdout or "").splitlines()[1:]:
        parts = line.split(None, 5)
        if len(parts) < 6:
            continue
        rows.append(
            {
                "pid": parts[0],
                "ppid": parts[1],
                "stat": parts[2],
                "etime": parts[3],
                "user": parts[4],
                "cmd": parts[5],
            }
        )
    return rows


def zombie_provenance(prev: dict | None) -> dict:
    rows = _ps()
    by_pid = {r["pid"]: r for r in rows}
    zombies = [r for r in rows if "Z" in r["stat"]]
    groups: dict[str, list] = {}
    for z in zombies:
        parent = by_pid.get(z["ppid"], {})
        key = z["ppid"]
        groups.setdefault(key, []).append(
            {
                "pid": z["pid"],
                "cmd": z["cmd"][:80],
                "etime": z["etime"],
                "stat": z["stat"],
                "parent_stat": parent.get("stat", "?"),
                "parent_cmd": (parent.get("cmd") or "?")[:100],
            }
        )
    prev_total = (prev or {}).get("zombies_total")
    prev_parents = set((prev or {}).get("parent_ppids") or [])
    now_parents = set(groups.keys())
    reaping = []
    for ppid, kids in groups.items():
        pcmd = kids[0]["parent_cmd"].lower()
        if "qwen-code" in pcmd or "qwen" in pcmd:
            need = "exit_or_resume_then_exit_parent_job (STAT Tl = stopped)"
        elif "litellm" in pcmd or "docker" in pcmd:
            need = "recycle_container (FED litellm) — Option C HOLD"
        else:
            need = "parent must reap; do not kill from vitality tick"
        reaping.append({"ppid": ppid, "n": len(kids), "requires": need, "parent_stat": kids[0]["parent_stat"]})
    return {
        "zombies_total": len(zombies),
        "zombies_by_parent": {k: v for k, v in groups.items()},
        "parent_ppids": list(groups.keys()),
        "oldest_etime": max((z["etime"] for z in zombies), default="—"),
        "new_parents_since_prev": sorted(now_parents - prev_parents),
        "delta_total": None if prev_total is None else len(zombies) - int(prev_total),
        "reaping_requires": reaping,
        "recurrence_detected": bool(prev_parents & now_parents) if prev_parents else False,
        "policy": "no_action_on_vitality_tick",
    }


def forge_work_ledger() -> dict:
    now = time.time()
    cutoff = now - 7 * 86400
    disk = subprocess.check_output(["df", "-BG", "/"], text=True).splitlines()[1].split()
    used_pct = int(disk[4].rstrip("%"))
    free_gb = int(disk[3].rstrip("G"))
    cands = []
    if FORGE_WORK.exists():
        for p in sorted(FORGE_WORK.iterdir()):
            if not p.is_dir():
                continue
            try:
                st = p.stat()
            except OSError:
                continue
            if st.st_mtime >= cutoff:
                continue
            size = 0
            nfiles = 0
            try:
                for f in p.rglob("*"):
                    try:
                        if f.is_file():
                            size += f.stat().st_size
                            nfiles += 1
                    except OSError:
                        pass
            except OSError:
                pass
            cands.append(
                {
                    "path": str(p),
                    "mb": round(size / 1e6, 1),
                    "files": nfiles,
                    "age_d": int((now - st.st_mtime) / 86400),
                    "status": "inspect_before_any_action",
                }
            )
    cands.sort(key=lambda x: -x["mb"])
    top3 = cands[:3]
    return {
        "directories_gt_7d": len(cands),
        "total_mb": round(sum(c["mb"] for c in cands), 1),
        "top_three_mb": round(sum(c["mb"] for c in top3), 1),
        "top_three": top3,
        "disk_used_pct": used_pct,
        "disk_free_gb": free_gb,
        "cleanup_trigger_pct": 85,
        "orphan_preview_required": True,
        "do_not_call_stale_until_inspected": True,
        "preserve": [
            "uncommitted_changes",
            "unpushed_branches",
            "receipts",
            "active_process_cwds",
            "referenced_artifacts",
        ],
    }


def vps_formula_block(h, m, g, c, reported) -> str:
    try:
        hf, mf, gf, cf = float(h), float(m), float(g), float(c)
        raw = 0.40 * hf + 0.20 * mf + 0.25 * gf + 0.15 * cf
        raw_s = f"{raw:.2f}"
        contrib = (
            f"{hf}×0.40={0.40*hf:.2f} · {mf}×0.20={0.20*mf:.2f} · "
            f"{gf}×0.25={0.25*gf:.2f} · {cf}×0.15={0.15*cf:.2f}"
        )
    except (TypeError, ValueError):
        raw_s = "insufficient"
        contrib = "one or more dimensions missing"
        raw = None
    return f"""## VPS formula (reconstructible)

Canonical: `/root/WELL/vps_compute.py` — `VPS = 0.40H + 0.20M + 0.25G + 0.15C`
Rounding: Python `round()` of the weighted sum (banker's round at .5).
Higher is better on every dimension (readiness, not occupancy).

| Dimension | Meaning | Higher means | Weight |
|-----------|---------|--------------|--------|
| Human (H) | WELL readiness (sensor or self-report HR3) | more ready | 0.40 |
| Machine (M) | Host CPU/mem/disk/organs-up | healthier host | 0.20 |
| Governance (G) | Floor/coherence | more coherent | 0.25 |
| Coupling (C) | Human×machine risk | lower coupling risk | 0.15 |

Disk occupancy % is an **entropy** signal, not H. Do not substitute an unweighted mean.

```
raw = 0.40H + 0.20M + 0.25G + 0.15C
    = {contrib}
    = {raw_s}
reported = {reported}
```
"""


def render_md(obs: dict, h, m, g, c, reported) -> str:
    lat = obs["latency"]
    z = obs["zombies"]
    fw = obs["forge_work"]
    lines = [vps_formula_block(h, m, g, c, reported), "## Latency cohorts (n=5, local /health unless noted)", "", "| Organ | min | median | p95 | max | statuses | verdict |", "|---|---:|---:|---:|---:|---|---|"]
    for name, _port in ORGANS:
        s = lat["local"][name]
        st = s.get("status_distribution", {})
        lines.append(
            f"| {name} | {s.get('min_ms','—')} | {s.get('median_ms','—')} | {s.get('p95_ms','—')} | {s.get('max_ms','—')} | {st} | {s.get('interpretation')} |"
        )
    pg = lat["public_geox"]
    lines.append(
        f"| geox public TLS | {pg.get('min_ms')} | {pg.get('median_ms')} | {pg.get('p95_ms')} | {pg.get('max_ms')} | {pg.get('status_distribution')} | {pg.get('interpretation')} |"
    )
    lines += [
        "",
        f"Method: {lat['method']}. A single max must not dominate the organ-up verdict.",
        "",
        "## Process hygiene (zombies) — SHADOW, no reap",
        "",
        f"- zombies_total: **{z['zombies_total']}**",
        f"- oldest_etime: {z['oldest_etime']}",
        f"- delta_total vs previous pulse: {z['delta_total']}",
        f"- recurrence_same_parent: {z['recurrence_detected']}",
        f"- new_parents_since_prev: {z['new_parents_since_prev'] or '—'}",
        "",
    ]
    for req in z["reaping_requires"]:
        kids = z["zombies_by_parent"].get(req["ppid"], [])
        cmds = ", ".join(sorted({k['cmd'].split()[0] for k in kids}))
        lines.append(
            f"- ppid `{req['ppid']}` n={req['n']} parent_stat=`{req['parent_stat']}` children=`{cmds}` — reaping_requires: {req['requires']}"
        )
    lines += [
        "",
        "_Policy: no_action_on_vitality_tick. Escalation only on growth or service impact._",
        "",
        "## forge_work retention ledger (inspect before calling stale)",
        "",
        f"- directories age>7d: **{fw['directories_gt_7d']}**",
        f"- total_mb: {fw['total_mb']}",
        f"- top_three_mb: {fw['top_three_mb']}",
        f"- disk_used_pct: {fw['disk_used_pct']}% (trigger {fw['cleanup_trigger_pct']}%) · free {fw['disk_free_gb']}G",
        "",
        "Top candidates (status=inspect_before_any_action):",
        "",
    ]
    for c in fw["top_three"]:
        lines.append(f"- `{c['path']}` {c['mb']} MB · {c['files']} files · {c['age_d']}d")
    lines.append("")
    lines.append("Preserve: uncommitted changes, unpushed branches, receipts, active cwds, referenced artifacts. Orphan preview required before any delete. Option C HOLD.")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--json-out", default="")
    ap.add_argument("--h", default="—")
    ap.add_argument("--m", default="—")
    ap.add_argument("--g", default="—")
    ap.add_argument("--c", default="—")
    ap.add_argument("--reported", default="—")
    args = ap.parse_args()
    prev = None
    if PREV_PATH.exists():
        try:
            prev = json.loads(PREV_PATH.read_text())
        except Exception:
            prev = None
    obs = {
        "observed_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "latency": latency_cohorts(),
        "zombies": zombie_provenance(prev.get("zombies") if prev else None),
        "forge_work": forge_work_ledger(),
    }
    md = render_md(obs, args.h, args.m, args.g, args.c, args.reported)
    print(md)
    payload = {**obs, "vps": {"H": args.h, "M": args.m, "G": args.g, "C": args.c, "reported": args.reported}}
    PREV_PATH.parent.mkdir(parents=True, exist_ok=True)
    PREV_PATH.write_text(json.dumps({"zombies": {"zombies_total": obs["zombies"]["zombies_total"], "parent_ppids": obs["zombies"]["parent_ppids"]}}, indent=2) + "\n")
    if args.json_out:
        Path(args.json_out).write_text(json.dumps(payload, indent=2) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
