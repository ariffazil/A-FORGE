"""
Patch for /root/arifOS/arifosmcp/runtime/governed_sense_impl.py

Add this code to the governed_sense_impl.py file to enable AF-FORGE bridge.

Integration points:
1. Import the bridge module at top
2. Add env var checks
3. Wrap the main sense function with bridge call
4. Add 888_HOLD gate based on Sense recommendation
"""

# ═══════════════════════════════════════════════════════════════════════════════
# AF-FORGE BRIDGE INTEGRATION
# ═══════════════════════════════════════════════════════════════════════════════

import os
import requests
from typing import Optional, Dict, Any

# AF-FORGE Bridge Configuration
AF_FORGE_ENABLED = os.getenv("AF_FORGE_ENABLED", "false").lower() == "true"
AF_FORGE_ENDPOINT = os.getenv("AF_FORGE_ENDPOINT", "http://localhost:7071/sense")
AF_FORGE_TIMEOUT = float(os.getenv("AF_FORGE_TIMEOUT_SECONDS", "2.0"))


def _call_af_forge_sense(
    session_id: str,
    prompt: str,
    context: Optional[Dict[str, Any]] = None
) -> Optional[Dict[str, Any]]:
    """Call AF-FORGE Sense endpoint. Returns None on failure."""
    if not AF_FORGE_ENABLED:
        return None
    
    try:
        payload = {
            "version": "1",
            "session_id": session_id,
            "prompt": prompt,
            "context": context or {
                "source": "mcp-python",
                "tool": "sense",
                "epoch": "2026-04-08",
            },
        }
        
        resp = requests.post(
            AF_FORGE_ENDPOINT,
            json=payload,
            timeout=AF_FORGE_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        
        if not data.get("ok"):
            return None
            
        return data
        
    except Exception as e:
        # Log but don't fail - fallback to Python sense
        print(f"[AF-FORGE] Bridge error (falling back): {e}", flush=True)
        return None


def _should_hold_from_af_forge(af_result: Dict[str, Any]) -> bool:
    """Check if AF-FORGE result indicates 888_HOLD."""
    sense = af_result.get("sense", {})
    
    # Primary check: Sense recommendation
    if sense.get("recommended_next_stage") == "hold":
        return True
    
    return False


def _extract_af_forge_telemetry(af_result: Dict[str, Any]) -> Dict[str, Any]:
    """Extract telemetry for logging/metrics."""
    sense = af_result.get("sense", {})
    judge = af_result.get("judge", {})
    
    return {
        "senseMode": sense.get("mode_used"),
        "senseUncertaintyBand": sense.get("uncertainty_band"),
        "senseEvidenceCount": sense.get("evidence_count"),
        "senseComplexityScore": sense.get("query_complexity_score"),
        "senseRiskIndicators": sense.get("risk_indicators", []),
        "judgeVerdict": judge.get("verdict"),
        "source": "af-forge",
    }


# ═══════════════════════════════════════════════════════════════════════════════
# INTEGRATION: Wrap run_sense function
# ═══════════════════════════════════════════════════════════════════════════════

# In the main run_sense function, add at the beginning:

def run_sense_with_bridge(session_id: str, prompt: str, **kwargs):
    """
    Wrapped sense function that tries AF-FORGE first, falls back to Python.
    """
    # Try AF-FORGE first
    af_result = _call_af_forge_sense(session_id, prompt, kwargs.get("context"))
    
    if af_result is not None:
        # Log telemetry
        telemetry = _extract_af_forge_telemetry(af_result)
        print(f"[AF-FORGE] Sense telemetry: {telemetry}", flush=True)
        
        # Check for 888_HOLD
        if _should_hold_from_af_forge(af_result):
            return {
                "verdict": "HOLD",
                "stage": "111_SENSE",
                "message": "888_HOLD: Destructive or high-risk query detected - requires human review",
                "telemetry": telemetry,
                "source": "af-forge",
            }
        
        # AF-FORGE passed, return enriched result
        return {
            "verdict": "SABAR",  # or SEAL depending on judge
            "stage": "111_SENSE",
            "source": "af-forge",
            "telemetry": telemetry,
            # Include other fields as needed
        }
    
    # Fallback to existing Python sense logic
    return run_sense_original(session_id, prompt, **kwargs)


# ═══════════════════════════════════════════════════════════════════════════════
# 888_HOLD GATE (add before LLM/tool execution)
# ═══════════════════════════════════════════════════════════════════════════════

# Before calling LLM or tools, check:
# if sense_result.get("verdict") == "HOLD":
#     return HoldResponse(message=sense_result["message"], telemetry=sense_result.get("telemetry"))
