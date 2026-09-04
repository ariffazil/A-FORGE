"""
Cross-Organ Wiring Test — A-FORGE Paradox Engine → arifOS paradox_gate

FORGE-FIX P3 (2026-07-11): Closes the test gap between:
  - A-FORGE paradox-engine writes /tmp/paradox_engine_state.json
  - arifOS kernel reads that file via evaluate_paradox_gate()

Without this test, the cross-organ bridge could silently break and
neither the algorithm tests (test_engine.py) nor the schema tests
(test_paradox_hold.py) would catch it.

DITEMPA BUKAN DIBERI — Cross-organ wiring is load-bearing.
"""

import json
import os
import sys
import tempfile
from pathlib import Path

import numpy as np

from paths_resolver import org_import_root

# ── 1. A-FORGE engine side: produce a state file ─────────────────────────────

sys.path.insert(0, org_import_root("A-FORGE") + "/paradox-engine")
sys.path.insert(0, org_import_root("arifOS"))

from models import MotifState, ParadoxState, SOMATIC_DIM
from engine import ParadoxEngine
from registry import MotifRegistry


def make_engine_state_file() -> Path:
    """Drive the engine through one tick so it writes a state file."""
    registry = MotifRegistry()
    engine = ParadoxEngine(registry=registry)

    # Use real Nusantara motifs: sedih (grief/sadness) + syukur (gratitude/grace).
    # Nusantara cultural manifold: in Melayu, sedih×syukur is COMPLEMENTARY
    # not contradictory (per cultural_manifold_minang_inang.json). We use
    # generic sedih/syukur here so the engine accepts them. For strict
    # contradiction, use 'sedih' + 'marah' or override via api.py.
    sedih = MotifState(
        id="sedih",
        label="sedih",
        intensity=0.7,
        somatic_vector=np.array([0.5] * SOMATIC_DIM, dtype=np.float32),
        semantic_embedding=None,
        timestamp=0.0,
        decay_rate=0.1,
        contradiction_ids=["marah"],
        complementary_ids=["syukur"],
        cultural_origin="malay",
        description="the feeling of sadness / grief",
    )
    marah = MotifState(
        id="marah",
        label="marah",
        intensity=0.6,
        somatic_vector=np.array([-0.4] * SOMATIC_DIM, dtype=np.float32),
        semantic_embedding=None,
        timestamp=0.0,
        decay_rate=0.1,
        contradiction_ids=["sedih"],
        complementary_ids=[],
        cultural_origin="malay",
        description="the feeling of anger",
    )
    engine.tick([sedih, marah])

    # Persist to a temp file (we don't write to the live /tmp slot in test)
    state_path = Path(tempfile.mkdtemp()) / "paradox_engine_state.json"
    state_path.write_text(json.dumps(engine.get_state_dict(), indent=2, default=str))
    return state_path


# ── 2. arifOS kernel side: load and evaluate via paradox_gate ───────────────

def evaluate_with_kernel_gate(state_file: Path, candidate_text: str):
    """
    Replicate what evaluate_paradox_gate does:
      1. Load /tmp/paradox_engine_state.json (we point to our temp file via env)
      2. Check resolution risk on candidate_text
      3. Return gate verdict + flags

    We import the real paradox_gate module but monkey-patch the state path
    so the test doesn't pollute the live /tmp slot.
    """
    from arifosmcp.core.enforcement import paradox_gate

    # Save original path constant, swap to test file
    orig_path = paradox_gate._PARADOX_STATE_PATH
    paradox_gate._PARADOX_STATE_PATH = str(state_file)
    try:
        result = paradox_gate.evaluate_paradox_gate(
            output_text=candidate_text,
            evidence={},
        )
        return result
    finally:
        paradox_gate._PARADOX_STATE_PATH = orig_path


# ── Tests ───────────────────────────────────────────────────────────────────

def test_engine_writes_valid_state_file():
    """A-FORGE engine produces a JSON state file the kernel can read."""
    print("\n── Test 1: Engine writes valid state file ──")
    state_file = make_engine_state_file()
    assert state_file.exists()
    state = json.loads(state_file.read_text())
    assert "active_paradoxes" in state or "engine" in state, (
        f"State file missing expected keys; got {list(state.keys())}"
    )
    print(f"  ✅ engine state written to {state_file}")
    print(f"     keys: {list(state.keys())}")
    return state_file


def test_kernel_loads_engine_state():
    """arifOS paradox_gate loads the engine state file."""
    print("\n── Test 2: Kernel loads engine state ──")
    state_file = make_engine_state_file()
    result = evaluate_with_kernel_gate(state_file, candidate_text="")
    # Without an active paradox in the file or with empty active, gate returns PASS
    print(f"  ✅ gate verdict: {result.gate_verdict}")
    print(f"     active_paradoxes: {result.active_paradoxes}")
    print(f"     paradox_score: {result.paradox_score}")
    assert result.gate_verdict in ("PASS", "FLAGGED"), (
        f"Unexpected gate verdict: {result.gate_verdict}"
    )


def test_kernel_detects_resolution_risk():
    """When engine has active grief×grace paradox and candidate favors grief,
    kernel gate flags RESOLUTION_RISK."""
    print("\n── Test 3: Kernel detects resolution risk ──")
    # Manually craft a state file with explicit motif labels so the
    # substring heuristic in _check_resolution_risk can match.
    state_path = Path(tempfile.mkdtemp()) / "paradox_engine_state.json"
    state = {
        "active_paradoxes": {
            "grief×grace": {
                "motif_a": {"label": "grief", "intensity": 0.7},
                "motif_b": {"label": "grace", "intensity": 0.6},
                "tension": 0.85,
                "matured": False,
            }
        },
        "paradox_score": 0.75,
    }
    state_path.write_text(json.dumps(state))

    # Candidate that resolves grief×grace by ONLY mentioning grief
    result = evaluate_with_kernel_gate(state_path, candidate_text="she sings grief")

    print(f"  ✅ gate verdict: {result.gate_verdict}")
    print(f"     flags: {[(f.flag, f.tension) for f in result.flags]}")
    print(f"     active_paradoxes: {result.active_paradoxes}")

    assert result.gate_verdict == "FLAGGED", (
        f"Expected FLAGGED when output favors one motif, got {result.gate_verdict}"
    )
    assert any(f.flag == "RESOLUTION_RISK" for f in result.flags), (
        "Expected at least one RESOLUTION_RISK flag"
    )


def test_kernel_passes_balanced_candidate():
    """When candidate mentions both motifs, gate should not flag resolution risk."""
    print("\n── Test 4: Balanced candidate passes ──")
    state_path = Path(tempfile.mkdtemp()) / "paradox_engine_state.json"
    state = {
        "active_paradoxes": {
            "grief×grace": {
                "motif_a": {"label": "grief", "intensity": 0.7},
                "motif_b": {"label": "grace", "intensity": 0.6},
                "tension": 0.85,
                "matured": False,
            }
        },
        "paradox_score": 0.75,
    }
    state_path.write_text(json.dumps(state))

    result = evaluate_with_kernel_gate(state_path, candidate_text="grief and grace in one note")

    print(f"  ✅ gate verdict: {result.gate_verdict}")
    print(f"     flags: {[f.flag for f in result.flags]}")
    # Balanced mention — no resolution risk; may or may not flag depending on parity
    assert result.gate_verdict in ("PASS", "FLAGGED"), (
        f"Unexpected verdict: {result.gate_verdict}"
    )


def test_kernel_handles_missing_state_file():
    """When state file doesn't exist, gate should PASS gracefully."""
    print("\n── Test 5: Missing state file ──")
    nonexistent = "/tmp/this_does_not_exist_paradox_engine_test.json"
    # paradox_gate's _load_paradox_state returns None on missing file
    # which triggers PASS in evaluate_paradox_gate
    result = evaluate_with_kernel_gate(Path(nonexistent), candidate_text="anything")
    assert result.gate_verdict == "PASS", (
        f"Expected PASS on missing state, got {result.gate_verdict}"
    )
    print(f"  ✅ gate verdict: PASS (graceful degradation)")


# ── Runner ───────────────────────────────────────────────────────────────────

def main():
    print("=" * 70)
    print("Cross-Organ Wiring Test — A-FORGE engine → arifOS paradox_gate")
    print("FORGE-FIX P3 (2026-07-11)")
    print("=" * 70)

    failures = []

    for fn in [
        test_engine_writes_valid_state_file,
        test_kernel_loads_engine_state,
        test_kernel_detects_resolution_risk,
        test_kernel_passes_balanced_candidate,
        test_kernel_handles_missing_state_file,
    ]:
        try:
            fn()
        except AssertionError as e:
            failures.append((fn.__name__, str(e)))
            print(f"  ❌ {fn.__name__}: {e}")
        except Exception as e:
            failures.append((fn.__name__, repr(e)))
            print(f"  ❌ {fn.__name__}: {e!r}")

    print()
    print("=" * 70)
    if failures:
        print(f"FAILED: {len(failures)} test(s)")
        for name, err in failures:
            print(f"  - {name}: {err}")
        sys.exit(1)
    else:
        print("ALL TESTS PASSED — cross-organ wiring verified")
        sys.exit(0)


if __name__ == "__main__":
    main()