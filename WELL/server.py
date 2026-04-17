from fastmcp import FastMCP
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

# Initialize FastMCP
mcp = FastMCP("WELL — Biological Substrate")

# Constants - Updated path to /var/lib for service access
WELL_STATE_PATH = Path(os.environ.get("WELL_STATE_PATH", "/var/lib/arifosmcp/WELL/state.json"))

def _get_raw_state() -> Dict[str, Any]:
    """Helper to read WELL state with fallback."""
    if not WELL_STATE_PATH.exists():
        return {
            "ok": False,
            "well_score": 50.0,
            "verdict": "UNKNOWN",
            "bandwidth": "NORMAL",
            "floors_violated": [],
            "message": f"WELL substrate offline or state missing at {WELL_STATE_PATH}"
        }
    try:
        with open(WELL_STATE_PATH, "r") as f:
            return json.load(f)
    except Exception as e:
        return {"error": str(e), "ok": False}

def _save_state(state: Dict[str, Any]) -> bool:
    """Helper to save WELL state."""
    try:
        # Update timestamp on every write
        state["timestamp"] = datetime.now(timezone.utc).isoformat() + "Z"
        with open(WELL_STATE_PATH, "w") as f:
            json.dump(state, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving state: {e}")
        return False

# === PERCEPTION TOOLS (P-Axis) ===

@mcp.tool()
def mcp_P_well_state_read() -> Dict[str, Any]:
    """
    Read the current biological telemetry snapshot from the WELL substrate.
    Returns: A dictionary containing scores, metrics, and readiness verdict.
    """
    return _get_raw_state()

@mcp.tool()
def mcp_P_well_readiness_check() -> Dict[str, Any]:
    """
    Perform a biological readiness check for constitutional governance.
    Returns: A verdict (OPTIMAL, FUNCTIONAL, DEGRADED, LOW_CAPACITY) and supporting metrics.
    """
    state = _get_raw_state()
    score = state.get("well_score", 50.0)
    violations = state.get("floors_violated", [])

    if violations:
        verdict = "DEGRADED"
        bandwidth = "RESTRICTED"
    elif score >= 80:
        verdict = "OPTIMAL"
        bandwidth = "FULL"
    elif score >= 60:
        verdict = "FUNCTIONAL"
        bandwidth = "NORMAL"
    else:
        verdict = "LOW_CAPACITY"
        bandwidth = "REDUCED"

    return {
        "verdict": verdict,
        "well_score": score,
        "bandwidth": bandwidth,
        "violations": violations,
        "timestamp": state.get("timestamp")
    }

@mcp.tool()
def mcp_P_well_floor_scan() -> Dict[str, Any]:
    """
    Scan the 13 W-Floors (Well-being dimensions) for any constitutional violations.
    Returns: A list of violated floors and current system health.
    """
    state = _get_raw_state()
    return {
        "floors_violated": state.get("floors_violated", []),
        "metrics": state.get("metrics", {}),
        "health_score": state.get("well_score", 0.0)
    }

# === EXECUTION TOOLS (E-Axis) ===

@mcp.tool()
def mcp_E_well_log_update(
    well_score: Optional[float] = None,
    metrics: Optional[Dict[str, Any]] = None,
    floors_violated: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Update the WELL state with new telemetry (e.g., after sleep, exercise, or meditation).
    """
    state = _get_raw_state()
    if well_score is not None:
        state["well_score"] = well_score
    if metrics:
        current_metrics = state.get("metrics", {})
        current_metrics.update(metrics)
        state["metrics"] = current_metrics
    if floors_violated is not None:
        state["floors_violated"] = floors_violated
    
    success = _save_state(state)
    return {"success": success, "updated_state": state if success else None}

@mcp.tool()
def mcp_E_well_pressure_signal(load_delta: float, reason: str) -> Dict[str, Any]:
    """
    Signal cognitive pressure/load to WELL. Triggers W6 Metabolic Pause if load is too high.
    """
    state = _get_raw_state()
    metrics = state.get("metrics", {})
    cog = metrics.get("cognitive", {"clarity": 10, "decision_fatigue": 0.0})
    
    # Increment fatigue
    old_fatigue = cog.get("decision_fatigue", 0.0)
    new_fatigue = min(10.0, old_fatigue + load_delta)
    cog["decision_fatigue"] = new_fatigue
    metrics["cognitive"] = cog
    state["metrics"] = metrics
    
    # Update score
    state["well_score"] = max(0.0, state.get("well_score", 50.0) - (load_delta * 2))
    
    # W6 Violation check
    violations = state.get("floors_violated", [])
    if load_delta > 2.0 and "W6_METABOLIC_PAUSE" not in violations:
        violations.append("W6_METABOLIC_PAUSE")
    state["floors_violated"] = violations
    
    success = _save_state(state)
    return {"success": success, "verdict": "HOLD" if load_delta > 2.0 else "PROCEED", "reason": reason}

@mcp.tool()
async def mcp_E_well_anchor_to_vault(summary: str = "WELL Substrate Anchor") -> Dict[str, Any]:
    """
    Seal the current WELL state to the arifOS VAULT999 (requires arifosmcp package).
    """
    state = _get_raw_state()
    try:
        from arifosmcp.runtime.vault_postgres import seal_to_vault
        res = await seal_to_vault(
            event_type="WELL_ANCHOR",
            session_id="WELL-AUTO",
            actor_id="well-system",
            stage="999_VAULT",
            verdict="SEAL" if state.get("well_score", 0) > 60 else "HOLD",
            payload=state,
            risk_tier="low"
        )
        return {"success": True, "vault_id": getattr(res, 'ledger_id', 'N/A')}
    except Exception as e:
        return {"success": False, "error": str(e), "message": "Vault anchoring requires arifosmcp runtime."}

if __name__ == "__main__":
    mcp.run()
