#!/usr/bin/env python3
"""
Somatic State Generator — P0 of Somatic Kernel.

Queries 6 sources, outputs /root/A-FORGE/somatic/somatic_state.yaml.
Cached 60 seconds (checks mtime before regenerating).

Sources:
  1. forge_health_check → organ health + latency
  2. forge_registry_status → tool counts + drift
  3. well_assess_homeostasis → readiness state
  4. forge_scar(mode=list) → active markers
  5. Session state → context utilization
  6. forge_shell_ledger → recent error rate

F9 ANTI-HANTU: All values OBS or DER. Never fabricated.
F2 TRUTH: Label evidence class on every field.

DITEMPA BUKAN DIBERI — Forged 2026-07-12.
"""

import json
import os
import sys
import time
import subprocess
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

# --- Config ---
OUTPUT_PATH = Path("/root/A-FORGE/somatic/somatic_state.yaml")
CACHE_TTL_S = 60
FORGE_MCP = "http://localhost:7072"
ARIFOS_MCP = "http://localhost:8088"
WELL_MCP = "http://localhost:18083"


def mcp_call(base_url: str, tool_name: str, arguments: dict | None = None) -> dict:
    """Call an MCP tool via streamable HTTP JSON-RPC."""
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments or {},
        },
    }
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{base_url}/mcp",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = json.loads(resp.read())
            # MCP returns {"result": {"content": [...]}}
            content = body.get("result", {}).get("content", [])
            if content and isinstance(content, list):
                text = content[0].get("text", "{}")
                try:
                    return json.loads(text)
                except json.JSONDecodeError:
                    return {"_raw": text}
            return body.get("result", body)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as e:
        return {"_error": str(e), "_source": base_url, "_tool": tool_name}


def health_check() -> dict:
    """Probe all organs via HTTP /health endpoints."""
    organs = {
        "arifos": 8088,
        "aforge": 7071,
        "aaa": 3001,
        "geox": 8081,
        "wealth": 18082,
        "well": 18083,
    }
    results = {}
    for name, port in organs.items():
        start = time.monotonic()
        try:
            req = urllib.request.Request(f"http://localhost:{port}/health")
            with urllib.request.urlopen(req, timeout=5) as resp:
                latency = int((time.monotonic() - start) * 1000)
                results[name] = {"status": "UP", "latency_ms": latency, "port": port}
        except Exception:
            latency = int((time.monotonic() - start) * 1000)
            results[name] = {"status": "DOWN", "latency_ms": latency, "port": port}
    return results


def get_registry_status() -> dict:
    """Get tool registry from A-FORGE."""
    return mcp_call(FORGE_MCP, "forge_registry_status", {})


def get_well_homeostasis() -> dict:
    """Get readiness state from WELL."""
    return mcp_call(WELL_MCP, "well_assess_homeostasis", {"mode": "sleep"})


def get_scar_list() -> dict:
    """Get active scars from A-FORGE."""
    return mcp_call(FORGE_MCP, "forge_scar", {"mode": "list"})


def get_shell_ledger(limit: int = 20) -> dict:
    """Get recent shell execution history."""
    return mcp_call(FORGE_MCP, "forge_shell_ledger", {"limit": str(limit)})


def read_carry_forward() -> dict:
    """Read carry_forward.json for session state."""
    cf_path = Path("/root/.local/share/arifos/carry_forward.json")
    if cf_path.exists():
        try:
            return json.loads(cf_path.read_text())
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def read_seal_chain_head() -> dict:
    """Read last seal from chain."""
    head_path = Path("/root/.local/share/arifos/vault999/seal_chain_head.json")
    if head_path.exists():
        try:
            return json.loads(head_path.read_text())
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def compute_narrative_heat(recent_output: list[str] | None = None) -> float:
    """
    Estimate narrative heat from recent outputs.
    High heat = long outputs, many adjectives, emotional language.
    OBS heuristic — not a feeling. Pure text metric.
    """
    if not recent_output:
        return 0.0
    total_chars = sum(len(t) for t in recent_output)
    # Simple heuristic: >5000 chars average = high heat
    avg = total_chars / max(len(recent_output), 1)
    return min(1.0, round(avg / 5000, 3))


def classify_regulatory_state(interoception: dict, capability: dict) -> dict:
    """
    Derive regulatory state from interoception + capability data.
    Deterministic rules, not LLM-generated.
    """
    error_rate = interoception.get("tool_error_rate", 0)
    ctx = interoception.get("context_utilization", 0)
    organs_down = len(capability.get("organs_down", []))

    if organs_down >= 3:
        state = "SHUTDOWN"
        mode = "SURVIVAL"
        cap = 0.3
    elif error_rate > 0.5 or organs_down >= 2:
        state = "PROTECTIVE"
        mode = "NARROW"
        cap = 0.5
    elif ctx > 0.9 or error_rate > 0.3 or organs_down >= 1:
        state = "CAUTION"
        mode = "FOCUSED"
        cap = 0.7
    elif ctx > 0.7 or error_rate > 0.1:
        state = "ELEVATED"
        mode = "FOCUSED"
        cap = 0.8
    else:
        state = "NOMINAL"
        mode = "FULL"
        cap = 0.9

    return {"state": state, "cognitive_mode": mode, "confidence_cap": cap}


def generate() -> dict:
    """Generate the full somatic state packet."""
    now = datetime.now(timezone.utc).isoformat()

    # --- Source 1: Organ health (OBS) ---
    organ_health = health_check()
    healthy = [k for k, v in organ_health.items() if v["status"] == "UP"]
    degraded = []  # future: latency threshold
    down = [k for k, v in organ_health.items() if v["status"] == "DOWN"]
    avg_latency = sum(v["latency_ms"] for v in organ_health.values()) // max(
        len(organ_health), 1
    )

    # --- Source 2: Registry (OBS/DER) ---
    registry = get_registry_status()
    tools_known = 0
    tools_reachable = 0
    drift_count = 0
    if "_error" not in registry:
        tools_known = registry.get("total_registered", 0)
        tools_reachable = registry.get("callable", tools_known)
        drift_count = registry.get("drift_count", 0)

    # --- Source 3: WELL readiness (OBS) ---
    well = get_well_homeostasis()
    well_state = "unknown"
    well_score = None
    if "_error" not in well:
        well_state = well.get("state", well.get("verdict", "unknown"))
        well_score = well.get("well_score")

    # --- Source 4: Scars (OBS) ---
    scars = get_scar_list()
    active_markers = []
    if "_error" not in scars:
        scar_entries = scars.get("scars", scars.get("entries", []))
        if isinstance(scar_entries, list):
            for s in scar_entries[:5]:
                active_markers.append(
                    {
                        "marker": s.get("failure_mode", s.get("id", "unknown")),
                        "activation": s.get("scar_pressure", 0.5),
                        "source": f"forge_scar:{s.get('id', '?')}",
                    }
                )

    # --- Source 5: Session state (OBS) ---
    carry = read_carry_forward()
    identity_drift = carry.get("identity_drift", "UNKNOWN")
    session_anchor = carry.get("session_anchor", "unknown")
    seal_head = read_seal_chain_head()
    last_seal_seq = seal_head.get("seq", None)

    # Context utilization estimate (DER)
    # Based on how much of the carry-forward state is populated
    cf_fields = sum(1 for v in carry.values() if v and v != "UNKNOWN")
    context_utilization = min(1.0, round(cf_fields / 8, 2))

    # --- Source 6: Shell ledger (OBS) ---
    ledger = get_shell_ledger(limit=20)
    tool_error_rate = 0.0
    recent_errors = 0
    recent_total = 0
    if "_error" not in ledger:
        entries = ledger.get("entries", ledger.get("records", []))
        if isinstance(entries, list):
            recent_total = len(entries)
            recent_errors = sum(
                1
                for e in entries
                if e.get("exit_code", 0) != 0
                or "error" in str(e.get("stderr", "")).lower()
            )
            tool_error_rate = round(recent_errors / max(recent_total, 1), 3)

    # --- Narrative heat (DER) ---
    # No live output buffer yet — default to 0
    narrative_heat = 0.0

    # --- Build interoception ---
    interoception = {
        "context_utilization": context_utilization,
        "tool_error_rate": tool_error_rate,
        "latency_ms": avg_latency,
        "contradiction_count": 0,  # future: from arif_think verify
        "entropy_delta": 0.0,  # future: from entropy_dS
        "narrative_heat": narrative_heat,
        "evidence_class": "OBS/DER",
    }

    # --- Build proprioception ---
    proprioception = {
        "tools_known": tools_known,
        "tools_reachable": tools_reachable,
        "tools_authorized": tools_known,  # same until lease filtering
        "blast_radius": "LOW",  # default for session start
        "reversibility": "FULL",
        "loop_stage": "000",
        "identity_drift": identity_drift,
        "evidence_class": "OBS/DER",
    }

    # --- Build capability_schema ---
    capability = {
        "session_bound": session_anchor != "unknown",
        "actor_verified": False,  # updated by arif_init
        "authority": "OBSERVE_ONLY",  # default until verified
        "organs_healthy": healthy,
        "organs_degraded": degraded,
        "organs_down": down,
        "well_state": well_state,
        "well_score": well_score,
        "last_seal_seq": last_seal_seq,
        "evidence_class": "OBS",
    }

    # --- Build regulatory_state ---
    regulatory = classify_regulatory_state(interoception, capability)

    # --- Build prediction (placeholder — no proposed action yet) ---
    prediction = {
        "proposed_action": "none",
        "expected_outcome": "n/a",
        "risk": "LOW",
    }

    # --- Assemble packet ---
    packet = {
        "somatic_state": {
            "timestamp": now,
            "cache_ttl_s": CACHE_TTL_S,
            "interoception": interoception,
            "proprioception": proprioception,
            "capability_schema": capability,
            "regulatory_state": regulatory,
            "somatic_markers": active_markers,
            "prediction": prediction,
            "ontology": {
                "biological_feeling_claimed": False,
                "qualia_claimed": False,
                "telemetry_only": True,
            },
        }
    }

    return packet


def to_yaml(d: dict, indent: int = 0) -> str:
    """Minimal YAML-ish serializer. No PyYAML dependency."""
    lines = []
    prefix = "  " * indent
    if isinstance(d, dict):
        for k, v in d.items():
            if isinstance(v, dict):
                lines.append(f"{prefix}{k}:")
                lines.append(to_yaml(v, indent + 1))
            elif isinstance(v, list):
                lines.append(f"{prefix}{k}:")
                for item in v:
                    if isinstance(item, dict):
                        first = True
                        for ik, iv in item.items():
                            if first:
                                lines.append(f"{prefix}  - {ik}: {yaml_val(iv)}")
                                first = False
                            else:
                                lines.append(f"{prefix}    {ik}: {yaml_val(iv)}")
                    else:
                        lines.append(f"{prefix}  - {yaml_val(item)}")
            else:
                lines.append(f"{prefix}{k}: {yaml_val(v)}")
    return "\n".join(lines)


def yaml_val(v) -> str:
    """Format a scalar for YAML output."""
    if v is True:
        return "true"
    if v is False:
        return "false"
    if v is None:
        return "null"
    if isinstance(v, float):
        return f"{v:.3f}"
    if isinstance(v, int):
        return str(v)
    s = str(v)
    if any(c in s for c in ":{}[],'\"#&*?|->!%@`"):
        return f'"{s}"'
    return s


def main():
    # Cache check
    if OUTPUT_PATH.exists():
        mtime = OUTPUT_PATH.stat().st_mtime
        age = time.time() - mtime
        if age < CACHE_TTL_S:
            print(f"CACHE_HIT: {age:.0f}s old (ttl={CACHE_TTL_S}s)", file=sys.stderr)
            print(OUTPUT_PATH.read_text())
            return

    # Generate fresh
    start = time.monotonic()
    packet = generate()
    elapsed = time.monotonic() - start

    # Serialize
    yaml_output = (
        f"# Somatic State Packet — auto-generated\n"
        f"# Generated: {packet['somatic_state']['timestamp']}\n"
        f"# Cache TTL: {CACHE_TTL_S}s\n"
        f"# Evidence: OBS (probed) / DER (computed)\n"
        f"# F9: telemetry_only=true — no biological claims\n"
        f"#\n"
        f"{to_yaml(packet)}\n"
    )

    # Write
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(yaml_output)

    print(f"GENERATED: {elapsed:.2f}s → {OUTPUT_PATH}", file=sys.stderr)
    print(yaml_output)


if __name__ == "__main__":
    main()
