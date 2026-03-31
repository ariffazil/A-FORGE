"""
GEOX MCP Server — FastMCP Earth Witness for Visual Seismic Interpretation
DITEMPA BUKAN DIBERI

A governed, visual-first seismic structural interpretation coprocessor.
Forged in 2026 for the arifOS federation (March 2026 standard).
"""

import os
import uuid
import json
from pathlib import Path
from datetime import datetime
from fastmcp import FastMCP

# arifOS Unified Architecture (ToAC) v0.3.2 structural imports
from arifos.geox import HardenedGeoxAgent, ToolRegistry
from arifos.geox.TOOLS.seismic.visual_tools import extract_seismic_views
from arifos.geox.TOOLS.seismic.create_overlay import create_overlay

# Initialize GEOX Core
mcp = FastMCP(
    name="GEOX Earth Witness",
    description="Governed seismic interpretation coprocessor — Contrast Canon enforced. Benda ni physically boleh jadi tak?",
    version="0.3.2-visual-seal"
)

# Output directory for visual artifacts
OUTPUT_DIR = Path("geox_output")
OUTPUT_DIR.mkdir(exist_ok=True, parents=True)

# Register Hardened Agent for tool delegation
agent = HardenedGeoxAgent(session_id="GEOX_SOVEREIGN_VISUAL_SEAL")

@mcp.tool
async def geox_extract_seismic_views(seismic_data: str) -> dict:
    """Generate 2-3 controlled display variants (Standard, High Saliency, Edge) to 'ignite' LLM vision."""
    variants = await extract_seismic_views(seismic_data)
    # Output schema: {label, base64, mimeType}
    return {
        "status": "SEALED",
        "variants": variants,
        "message": "Visual contrast canon views generated for multimodal ignition."
    }

@mcp.tool
async def geox_create_overlay(base_image_ref: str, features: list[dict], overlay_type: str = "faults") -> dict:
    """Create a visual overlay (faults/horizons) on a seismic base image. Returns image path."""
    overlay_path = await create_overlay(base_image_ref, features, overlay_type)
    return {
        "overlay_image": str(overlay_path),
        "overlay_type": overlay_type,
        "legend": f"GEOX {overlay_type.upper()} overlay | DITEMPA BUKAN DIBERI"
    }

@mcp.tool
async def geox_interpret_single_line(seismic_data: str, data_type: str = "raster") -> dict:
    """Full governed visual interpreter (orchestrator). Returns JSON result + visual artifacts + visual_markdown."""
    
    # 1. Pipeline Execution via Hardened Agent (Band A)
    # This hits: ingest -> views -> extract -> ranker -> rules -> summary
    envelope = await agent.execute_tool("SingleLineInterpreter", {"seismic_data": seismic_data, "data_type": data_type})
    
    # 2. Visual Artifact Generation for 'Ignition'
    # Generate contrast views and overlays for the final display
    variants = await extract_seismic_views(seismic_data)
    
    best_candidate_id = envelope["payload"].get("best_candidate_id", "C-001")
    candidates = envelope["payload"].get("alternatives", [])
    best = next((c for c in candidates if c["candidate_id"] == best_candidate_id), {"faults": [], "horizons": []})
    
    fault_overlay = await create_overlay(seismic_data, best.get("faults", []), "faults")
    horizon_overlay = await create_overlay(seismic_data, best.get("horizons", []), "horizons")

    # 3. Forging the 'Visual Markdown' payload (Multimodal Orchestration)
    visual_md = f"""
### 🌍 GEOX Governed Visual Interpretation — {os.path.basename(seismic_data)}

**Best Structural Model:** {envelope['payload'].get('geological_setting', 'Passive Margin')} / {best_candidate_id}
Confidence: {envelope['payload'].get('confidence', 'Est. 0.85')} | Verdict: {envelope['verdict']}

**Contrast Panel (Multi-View Canon Compliance)**
(Images are base64-encoded to LLM context)
![Standard]({variants[0]['base64']})
![High Saliency (Equalized)]({variants[1]['base64']})

**Structural Overlays**
![Fault Sticks]({fault_overlay})
![Horizon Picking]({horizon_overlay})

**Bias Audit [Bond et al. 2007]**
{envelope['payload'].get('bias_audit', 'No display bias detected; feature stability verified.')}

**Physical Reality Check**
Is this physically possible? **{envelope['explanation']}**

**Seal:** DITEMPA BUKAN DIBERI 🔨
"""
    
    return {
        "verdict": envelope["verdict"],
        "result": envelope["payload"],
        "artifacts": {
            "fault_overlay": str(fault_overlay),
            "horizon_overlay": str(horizon_overlay),
        },
        "visual_markdown": visual_md.strip(),
        "telemetry": envelope["metrics"]
    }

@mcp.resource("geox://capabilities")
def get_geox_capabilities() -> str:
    """GEOX Earth Witness detailed capabilities resource."""
    return """
GEOX Earth Witness (v0.3.2 SEALED)
----------------------------------
Sovereign structural interpretation powered by Theory of Anomalous Contrast (ToAC).
Standard Tools:
- geox_interpret_single_line: Orchestrates full Band A interpretational pipeline.
- geox_extract_seismic_views: Triggers multimodal LLM visual mode.
- geox_create_overlay: Generates visual structural audits.
DITEMPA BUKAN DIBERI.🔨
"""

if __name__ == "__main__":
    print("GEOX Earth Witness — FAST-MCP Server starting (v0.3.2) 錘")
    mcp.run()
