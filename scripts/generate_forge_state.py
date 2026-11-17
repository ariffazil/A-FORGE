#!/usr/bin/env python3
"""
scripts/generate_forge_state.py — ONE WITNESS OBJECT, MULTIPLE VIEWS (A-FORGE).

Probes the live gateway (:7072/health) and generates:
  1. docs/state/forge-state.json   — machine state (projection source)
  2. docs/state/badges/*.json      — shields.io endpoint-badge payloads
  3. README.md generated block      — between GENERATED:CURRENT-STATE markers

Truth model: runtime self-measurement ≠ independent/hand audit (2026-10-11).
Both are rendered with provenance + date. If the gateway is unreachable the
block reads UNMEASURED — a cached value is never written.

Usage: python scripts/generate_forge_state.py [--dry-run]
DITEMPA BUKAN DIBERI — Forged, Not Given.
"""

import json
import sys
from datetime import UTC, datetime
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
README = ROOT / "README.md"
STATE = ROOT / "docs" / "state" / "forge-state.json"
BADGE_DIR = ROOT / "docs" / "state" / "badges"
HEALTH_URL = "http://127.0.0.1:7072/health"

BEGIN = "<!-- GENERATED:CURRENT-STATE:BEGIN · source: scripts/generate_forge_state.py · never hand-edit -->"
END = "<!-- GENERATED:CURRENT-STATE:END -->"

# Independent/hand-audited observation (2026-10-11, FI-008 live re-probe) — immutable.
AUDIT_SNAPSHOT = {
    "date": "2026-10-11",
    "method": "live re-probe by FI-008 (forge_registry_status + observed MUTATE-class call)",
    "refusal": "a MUTATE-class call without presented authority was stopped by A_THINK_GUARD (BUDGET: max_tools=0)",
    "tools_listed": 122,
    "unique_fingerprints": 122,
    "observed_at_detail": "2026-10-10T18:26:35Z",
    "enforcement": "action class + budget — NOT a SEAL verdict binding",
    "open_defects": [
        "invocation-telemetry writer has no governance-outcome field: a kernel HOLD (can_claim_success:false) persisted as ok:true",
        "refusal cause (A_THINK_GUARD) appears 0x in the ledger",
        "sessionGate.ts:315 infers verified from verdict == SEAL (a verdict string is not identity evidence)",
        "default session ids are manufactured with a SEAL- prefix when none is supplied",
    ],
}


def probe_health() -> dict | None:
    try:
        return httpx.get(HEALTH_URL, timeout=5).json()
    except Exception:
        return None


def build_state(health: dict | None) -> dict:
    now = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    if health is None:
        return {
            "observed_at": now,
            "self_measurement": {
                "status": "UNMEASURED",
                "note": f"gateway probe down @{now} — no cached value written",
            },
            "independent_audit": AUDIT_SNAPSHOT,
        }
    return {
        "observed_at": now,
        "self_measurement": {
            "status": health.get("status"),
            "service": health.get("service"),
            "commit": health.get("commit"),
            "tools_listed": health.get("tools_listed"),
            "stateless_tools": health.get("stateless_tools"),
            "authority_ceiling": health.get("authority_ceiling"),
            "transport": health.get("transport"),
            "probe": f"{HEALTH_URL} @{now}",
        },
        "enforcement_model": {
            "gate": "action_class_and_budget",
            "verdict_binding": "not_proven",
            "identity_binding": "defect_open",
            "receipt_fidelity": "defect_open",
        },
        "independent_audit": AUDIT_SNAPSHOT,
    }


def render_block(state: dict) -> str:
    s, a = state["self_measurement"], state["independent_audit"]
    if s.get("status") == "UNMEASURED":
        self_line = f"**Runtime self-measurement:** {s['note']}"
    else:
        self_line = (
            f"**Runtime self-measurement** (`{s['probe']}`): **{s.get('status')}** · commit `{s.get('commit')}` · "
            f"tools listed **{s.get('tools_listed')}** ({s.get('stateless_tools')} stateless) · "
            f"authority ceiling `{s.get('authority_ceiling')}` · transport {s.get('transport')}."
        )
    audit_line = (
        f"**Independent/hand audit** ({a['date']}, {a['method']}): {a['refusal']}. "
        f"Enforcement is **{a['enforcement']}**. "
        f"Open defects: " + " · ".join(a["open_defects"]) + "."
    )
    return f"""{BEGIN}
> ### ⚠️ Current verified state — generated, never hand-edited
>
> {self_line}
>
> {audit_line}
>
> **Self-measurement ≠ independent audit.** A tested unauthorised MUTATE-class request was
> refused; universal SEAL-verdict binding is the **target architecture, not the measured
> enforcement mechanism**. If this block conflicts with the live gateway, the gateway wins —
> re-run `python scripts/generate_forge_state.py`.
>
> Machine state: [`docs/state/forge-state.json`](./docs/state/forge-state.json) ·
> Badge feed: [`docs/state/badges/`](./docs/state/badges/)
{END}"""


def patch_readme(block: str, dry_run: bool) -> None:
    if not README.exists():
        print(f"ERROR: {README} not found", file=sys.stderr)
        sys.exit(1)
    content = README.read_text()
    if BEGIN not in content or END not in content:
        print("ERROR: README markers missing — refusing to splice.", file=sys.stderr)
        sys.exit(2)
    head, rest = content.split(BEGIN, 1)
    _, tail = rest.split(END, 1)
    new = head + block + tail
    if dry_run:
        print("DRY RUN — block would become:\n" + block)
        return
    if new != content:
        README.write_text(new)
        print(f"README block re-stamped @{datetime.now(UTC).strftime('%H:%M:%SZ')}")
    else:
        print("README block already current.")


def main() -> None:
    dry = "--dry-run" in sys.argv
    state = build_state(probe_health())
    if not dry:
        STATE.parent.mkdir(parents=True, exist_ok=True)
        BADGE_DIR.mkdir(parents=True, exist_ok=True)
        STATE.write_text(json.dumps(state, indent=2) + "\n")
        s = state["self_measurement"]
        badges = {
            "tool-registry.json": {
                "schemaVersion": 1,
                "label": "tool registry",
                "message": f"{s.get('tools_listed', 'UNMEASURED')} live ({s.get('stateless_tools', '?')} stateless)",
                "color": "orange",
            },
            "gate.json": {
                "schemaVersion": 1,
                "label": "current gate",
                "message": "action class + budget",
                "color": "d4a853",
            },
            "fidelity.json": {
                "schemaVersion": 1,
                "label": "governance fidelity",
                "message": "open defects",
                "color": "red",
            },
        }
        for name, payload in badges.items():
            (BADGE_DIR / name).write_text(json.dumps(payload, indent=2) + "\n")
        print(f"wrote forge-state.json + {len(badges)} badge payloads")
    patch_readme(render_block(state), dry)


if __name__ == "__main__":
    main()
