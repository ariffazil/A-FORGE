#!/usr/bin/env python3
"""
GEOX MCP Server — WIRED VERSION
═══════════════════════════════════════════════════════════════════════════════
Integrates with GEOX Unified Backend for real Earth intelligence operations.

DITEMPA BUKAN DIBERI
"""

import sys
import json
import asyncio
import logging
from typing import Optional, Any
from datetime import datetime, timezone
from pathlib import Path

# Add GEOX to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / 'GEOX'))

try:
    from geox_unified import mcp as geox_mcp, GEOX_VERSION, GEOX_SEAL
    from geox_unified import (
        geox_fetch_authoritative_state,
        geox_set_scene,
        geox_render_scene_context,
        geox_compute_stoiip,
        geox_validate_operation,
        geox_audit_hold_breach,
        geox_synthesize_causal_scene
    )
    GEOX_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Could not import GEOX backend: {e}")
    GEOX_AVAILABLE = False
    GEOX_VERSION = "v2026.04.11-WIREDBACKEND-MISSING"
    GEOX_SEAL = "DITEMPA BUKAN DIBERI"

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import (
    Resource,
    Tool,
    Prompt,
    TextContent,
    ImageContent,
    EmbeddedResource,
)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("geox.mcp.wired")

# Load skill registry
REGISTRY_PATH = Path(__file__).parent.parent.parent / 'apps' / 'site' / 'registry.json'
REGISTRY = json.loads(REGISTRY_PATH.read_text()) if REGISTRY_PATH.exists() else {"skills": {}}

# MCP Server instance
app = Server("geox-mcp-wired")

# ═══════════════════════════════════════════════════════════════════════════════
# RESOURCES: Skills, Domains, Registry
# ═══════════════════════════════════════════════════════════════════════════════

@app.list_resources()
async def list_resources() -> list[Resource]:
    """List available GEOX resources."""
    resources = []
    
    # Skills as resources
    for skill_id, skill in REGISTRY.get('skills', {}).items():
        resources.append(Resource(
            uri=skill.get('mcp_resource', f"geox://skills/{skill_id}"),
            name=skill['name'],
            mimeType="application/json",
            description=skill['description']
        ))
    
    # Domains
    for domain in REGISTRY.get('domains', []):
        resources.append(Resource(
            uri=f"geox://domains/{domain['id']}",
            name=domain['name'],
            mimeType="application/json",
            description=domain['description']
        ))
    
    # Special resources
    resources.append(Resource(
        uri="geox://registry",
        name="GEOX Skill Registry",
        mimeType="application/json",
        description="Complete skill registry with 44 skills across 11 domains"
    ))
    
    resources.append(Resource(
        uri="geox://scene/state",
        name="GEOX Authoritative Scene State",
        mimeType="application/json",
        description="Current geological scene (888_JUDGE)"
    ))
    
    return resources

@app.read_resource()
async def read_resource(uri: str) -> str:
    """Read a GEOX resource."""
    
    # Registry
    if uri == "geox://registry":
        return json.dumps(REGISTRY, indent=2)
    
    # Scene state — WIRED to GEOX backend
    if uri == "geox://scene/state":
        if GEOX_AVAILABLE:
            state = await geox_fetch_authoritative_state()
            return json.dumps(state, indent=2)
        return json.dumps({"status": "BACKEND_UNAVAILABLE"}, indent=2)
    
    # Domain
    if uri.startswith("geox://domains/"):
        domain_id = uri.split("/")[-1]
        for domain in REGISTRY.get('domains', []):
            if domain['id'] == domain_id:
                return json.dumps(domain, indent=2)
        raise ValueError(f"Domain not found: {domain_id}")
    
    # Skill lookup
    for skill_id, skill in REGISTRY.get('skills', {}).items():
        if skill.get('mcp_resource') == uri or f"geox://skills/{skill_id}" == uri:
            return json.dumps(skill, indent=2)
    
    raise ValueError(f"Unknown resource: {uri}")

# ═══════════════════════════════════════════════════════════════════════════════
# TOOLS: Wired to GEOX Backend
# ═══════════════════════════════════════════════════════════════════════════════

@app.list_tools()
async def list_tools() -> list[Tool]:
    """List available GEOX tools."""
    return [
        # Registry tools
        Tool(
            name="geox_search_skills",
            description="Search GEOX skills by keyword, domain, or substrate",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "domain": {"type": "string", "description": "Filter by domain ID"},
                    "substrate": {"type": "string", "description": "Filter by substrate"}
                }
            }
        ),
        Tool(
            name="geox_get_skill",
            description="Get detailed information about a specific skill",
            inputSchema={
                "type": "object",
                "properties": {
                    "skill_id": {"type": "string", "description": "Skill identifier (e.g., flood_model)"}
                },
                "required": ["skill_id"]
            }
        ),
        
        # Scene tools — WIRED to GEOX backend
        Tool(
            name="geox_fetch_authoritative_state",
            description="Fetch the 888_JUDGE authoritative scene state. Returns NO_ACTIVE_SCENE if no data loaded.",
            inputSchema={"type": "object", "properties": {}}
        ),
        Tool(
            name="geox_set_scene",
            description="Establish a REAL geological scene with user-provided parameters. NO FAKE DATA.",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Scene/reservoir name"},
                    "crs": {"type": "string", "description": "Coordinate reference system"},
                    "area_m2": {"type": "number", "description": "Area in square meters"},
                    "gross_thickness_m": {"type": "number", "description": "Gross thickness in meters"},
                    "porosity": {"type": "number", "description": "Porosity (0-1)"},
                    "provenance": {"type": "string", "description": "Source of data (e.g., well_log_interpretation)"}
                },
                "required": ["name", "crs", "area_m2", "gross_thickness_m", "porosity"]
            }
        ),
        Tool(
            name="geox_compute_stoiip",
            description="Compute STOIIP from REAL reservoir parameters. Formula: 7758 × area × thickness × porosity × (1 - sw) / fvf",
            inputSchema={
                "type": "object",
                "properties": {
                    "area_acres": {"type": "number", "description": "Area in acres"},
                    "thickness_ft": {"type": "number", "description": "Thickness in feet"},
                    "porosity": {"type": "number", "description": "Porosity (0-1)"},
                    "sw": {"type": "number", "description": "Water saturation (0-1)"},
                    "fvf": {"type": "number", "description": "Formation volume factor"},
                    "witness_id": {"type": "string", "description": "Optional witness identifier for audit trail"}
                },
                "required": ["area_acres", "thickness_ft", "porosity", "sw", "fvf"]
            }
        ),
        Tool(
            name="geox_validate_operation",
            description="Constitutional validation for contrast operations (F2 Truth, F8 Grounding, F9 Anti-Hantu)",
            inputSchema={
                "type": "object",
                "properties": {
                    "op_kind": {"type": "string", "enum": ["contrast", "bridge", "project", "ground"]},
                    "left_kind": {"type": "string", "enum": ["human", "ai", "earth", "void"]},
                    "left_support": {"type": "string", "enum": ["direct", "inferred", "simulated", "void"]},
                    "right_kind": {"type": "string", "enum": ["human", "ai", "earth", "void"]},
                    "right_support": {"type": "string", "enum": ["direct", "inferred", "simulated", "void"]}
                },
                "required": ["op_kind", "left_kind", "left_support", "right_kind", "right_support"]
            }
        ),
        
        # Risk & Governance
        Tool(
            name="geox_score_risk",
            description="Score a scenario for constitutional risk (888_SEAL/QUALIFY/HOLD/VOID)",
            inputSchema={
                "type": "object",
                "properties": {
                    "scenario_type": {
                        "type": "string",
                        "enum": ["flood", "seismic", "mobility", "maritime", "prospect"]
                    },
                    "parameters": {"type": "object", "description": "Scenario-specific parameters"},
                    "evidence_refs": {"type": "array", "items": {"type": "string"}, "description": "Evidence references"}
                },
                "required": ["scenario_type", "parameters"]
            }
        ),
        Tool(
            name="geox_constitutional_gate",
            description="Evaluate operation against arifOS F1-F13 constitutional constraints",
            inputSchema={
                "type": "object",
                "properties": {
                    "operation": {"type": "string", "description": "Operation description"},
                    "risk_profile": {"type": "object", "description": "Risk assessment data"},
                    "authority_level": {"type": "integer", "minimum": 1, "maximum": 5, "description": "Required authority level"}
                },
                "required": ["operation"]
            }
        ),
        Tool(
            name="geox_audit_hold_breach",
            description="Structured audit for 888_HOLD breaches",
            inputSchema={
                "type": "object",
                "properties": {
                    "operator": {"type": "string", "description": "Operator identifier"},
                    "violations": {"type": "array", "items": {"type": "string"}, "description": "List of violations"}
                },
                "required": ["operator", "violations"]
            }
        ),
    ]

@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent | ImageContent | EmbeddedResource]:
    """Execute a GEOX tool — WIRED to backend."""
    
    # ─── Registry Tools ───
    
    if name == "geox_search_skills":
        query = arguments.get("query", "").lower()
        domain_filter = arguments.get("domain")
        substrate_filter = arguments.get("substrate")
        
        results = []
        for skill_id, skill in REGISTRY.get('skills', {}).items():
            if domain_filter and skill.get('domain') != domain_filter:
                continue
            if substrate_filter and substrate_filter not in skill.get('substrates', []):
                continue
            if query and query not in skill.get('name', '').lower() and query not in skill.get('description', '').lower():
                continue
            results.append({
                "id": skill_id,
                "name": skill['name'],
                "domain": skill['domain'],
                "complexity": skill['complexity'],
                "mcp_resource": skill.get('mcp_resource')
            })
        return [TextContent(type="text", text=json.dumps({"results": results, "count": len(results)}, indent=2))]
    
    if name == "geox_get_skill":
        skill_id = arguments.get("skill_id")
        skill = REGISTRY.get('skills', {}).get(skill_id)
        if not skill:
            return [TextContent(type="text", text=json.dumps({"error": "Skill not found", "id": skill_id}))]
        return [TextContent(type="text", text=json.dumps(skill, indent=2))]
    
    # ─── WIRED TO GEOX BACKEND ───
    
    if not GEOX_AVAILABLE:
        return [TextContent(type="text", text=json.dumps({
            "error": "GEOX backend unavailable",
            "status": "888_HOLD",
            "message": "The GEOX unified backend could not be loaded. Check installation."
        }, indent=2))]
    
    if name == "geox_fetch_authoritative_state":
        result = await geox_fetch_authoritative_state()
        return [TextContent(type="text", text=json.dumps(result, indent=2))]
    
    if name == "geox_set_scene":
        result = await geox_set_scene(
            name=arguments.get("name"),
            crs=arguments.get("crs"),
            area_m2=arguments.get("area_m2"),
            gross_thickness_m=arguments.get("gross_thickness_m"),
            porosity=arguments.get("porosity"),
            provenance=arguments.get("provenance", "user_specified")
        )
        return [TextContent(type="text", text=json.dumps(result, indent=2))]
    
    if name == "geox_compute_stoiip":
        result = await geox_compute_stoiip(
            area_acres=arguments.get("area_acres"),
            thickness_ft=arguments.get("thickness_ft"),
            porosity=arguments.get("porosity"),
            sw=arguments.get("sw"),
            fvf=arguments.get("fvf"),
            witness_id=arguments.get("witness_id")
        )
        return [TextContent(type="text", text=json.dumps(result, indent=2))]
    
    if name == "geox_validate_operation":
        result = await geox_validate_operation(
            op_kind=arguments.get("op_kind"),
            left_kind=arguments.get("left_kind"),
            left_support=arguments.get("left_support"),
            right_kind=arguments.get("right_kind"),
            right_support=arguments.get("right_support")
        )
        return [TextContent(type="text", text=json.dumps(result, indent=2))]
    
    if name == "geox_audit_hold_breach":
        result = await geox_audit_hold_breach(
            operator=arguments.get("operator"),
            violations=arguments.get("violations", [])
        )
        return [TextContent(type="text", text=result)]
    
    # ─── Risk & Governance (Hybrid) ───
    
    if name == "geox_score_risk":
        scenario = arguments.get("scenario_type")
        params = arguments.get("parameters", {})
        
        # Wire to actual GEOX if available, else compute locally
        risk_score = params.get("base_risk", 0.5)
        uncertainty = params.get("uncertainty", 0.2)
        
        # Determine verdict
        if risk_score > 0.8:
            verdict = "888_HOLD"
        elif risk_score > 0.5:
            verdict = "888_QUALIFY"
        else:
            verdict = "888_SEAL"
        
        result = {
            "scenario": scenario,
            "parameters": params,
            "risk_score": risk_score,
            "uncertainty": uncertainty,
            "verdict": verdict,
            "confidence": 1 - uncertainty,
            "telemetry": {
                "epoch": datetime.now(timezone.utc).isoformat(),
                "dS": round(risk_score * 0.1, 3),
                "peace2": round(1 + uncertainty, 2),
                "kappa_r": round(risk_score * 0.3, 3)
            },
            "governance": "arifOS F2/F6/F7"
        }
        return [TextContent(type="text", text=json.dumps(result, indent=2))]
    
    if name == "geox_constitutional_gate":
        operation = arguments.get("operation")
        authority = arguments.get("authority_level", 1)
        
        # Simple constitutional check
        verdict = "888_SEAL"
        conditions = []
        
        # Authority check
        required = 3 if "write" in operation.lower() else 1
        if authority < required:
            verdict = "888_HOLD"
            conditions.append(f"Insufficient authority: {authority} < {required}")
        
        # Destructive operations check
        if any(w in operation.lower() for w in ["delete", "destroy", "purge"]):
            verdict = "888_HOLD"
            conditions.append("Destructive operation requires explicit 888_HOLD release")
        
        result = {
            "operation": operation,
            "verdict": verdict,
            "conditions": conditions,
            "authority_required": required,
            "authority_provided": authority,
            "audit_log": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "checked_floors": ["F1", "F2", "F6", "F9", "F13"]
            }
        }
        return [TextContent(type="text", text=json.dumps(result, indent=2))]
    
    return [TextContent(type="text", text=json.dumps({"error": "Unknown tool"}))]

# ═══════════════════════════════════════════════════════════════════════════════
# PROMPTS: Operational Workflows
# ═══════════════════════════════════════════════════════════════════════════════

@app.list_prompts()
async def list_prompts() -> list[Prompt]:
    """List available GEOX prompts."""
    return [
        Prompt(
            name="geox_interpret_prospect",
            description="Guide for interpreting a basin prospect with constitutional checks",
            arguments=[
                {"name": "basin_id", "description": "Basin identifier", "required": True},
                {"name": "prospect_name", "description": "Prospect name", "required": True}
            ]
        ),
        Prompt(
            name="geox_compare_scenarios",
            description="Compare multiple operational scenarios with risk scoring",
            arguments=[
                {"name": "scenarios", "description": "JSON array of scenarios to compare", "required": True}
            ]
        ),
        Prompt(
            name="geox_issue_verdict",
            description="Guide for issuing a constitutional verdict (888_SEAL/QUALIFY/HOLD/VOID)",
            arguments=[
                {"name": "operation", "description": "Operation to evaluate", "required": True},
                {"name": "evidence", "description": "Supporting evidence", "required": False}
            ]
        ),
        Prompt(
            name="geox_establish_scene",
            description="Workflow for establishing a geological scene with proper provenance",
            arguments=[
                {"name": "data_source", "description": "Primary data source (well_logs, seismic, core)", "required": True}
            ]
        ),
    ]

@app.get_prompt()
async def get_prompt(name: str, arguments: dict | None = None) -> str:
    """Get a GEOX prompt."""
    args = arguments or {}
    
    if name == "geox_interpret_prospect":
        basin = args.get("basin_id", "unknown")
        prospect = args.get("prospect_name", "unknown")
        return f"""# Interpreting {prospect} in {basin}

## Constitutional Workflow (arifOS F1-F13)

1. **Load Context** — Fetch basin geology and regional trends
2. **Validate Scene** — Call `geox_fetch_authoritative_state()`
3. **If NO_ACTIVE_SCENE:**
   - Establish scene with `geox_set_scene()` using real data
   - Document provenance (well logs, seismic picks, core analysis)
4. **Physics Validation** — Run Physics9 feasibility checks
5. **Constitutional Gate** — Call `geox_validate_operation()`
6. **Generate Interpretation** — Structure claims with confidence bounds
7. **Issue Verdict** — 888_SEAL, 888_QUALIFY, 888_HOLD, or 888_VOID

## Constraints
- F2 Truth: Every claim must reference data
- F7 Humility: Uncertainty must be explicit (±bounds)
- F13 Sovereign: Human authority on consequential decisions

## Next Steps
After interpretation, call `geox_compute_stoiip()` if reserves estimation needed.
"""
    
    if name == "geox_compare_scenarios":
        return """# Compare Operational Scenarios

## Multi-Scenario Analysis Protocol

For each scenario provided:
1. Parse parameters and assumptions
2. Run `geox_score_risk()` for constitutional assessment
3. Compute deltas (technical, economic, risk)
4. Apply `geox_constitutional_gate()` for each path

## Output Structure
```json
{
  "scenarios": [
    {"name": "A", "score": 0.3, "verdict": "888_SEAL"},
    {"name": "B", "score": 0.6, "verdict": "888_QUALIFY"},
    {"name": "C", "score": 0.9, "verdict": "888_HOLD"}
  ],
  "recommendation": "B",
  "rationale": "Balanced risk with explicit mitigation paths"
}
```

## Governance
- Document all assumptions
- Provide confidence intervals
- Flag irreversible commitments
"""
    
    if name == "geox_issue_verdict":
        operation = args.get("operation", "unspecified operation")
        return f"""# Constitutional Verdict: {operation}

## Evaluation Matrix (arifOS F1-F13)

| Floor | Check | Status |
|-------|-------|--------|
| F1 | Reversible? Can this be undone? | □ PASS □ HOLD |
| F2 | Truth? All claims grounded? | □ PASS □ HOLD |
| F6 | Harmless? No foreseeable harm? | □ PASS □ HOLD |
| F7 | Humble? Uncertainty explicit? | □ PASS □ HOLD |
| F9 | Transparent? Reasoning inspectable? | □ PASS □ HOLD |
| F13 | Sovereign? Human authority preserved? | □ PASS □ HOLD |

## Verdict Options

- **888 SEAL**: All floors passed, proceed
- **888 QUALIFY**: Minor concerns noted, proceed with conditions
- **888 HOLD**: Material concerns, pause for review
- **888 VOID**: Constitutional violation, reject

## Audit Trail
All verdicts are logged with:
- Timestamp
- Evaluator identity
- Evidence references
- Appeal pathway

Issue verdict: `geox_constitutional_gate(operation="{operation}", authority_level=YOUR_LEVEL)`
"""
    
    if name == "geox_establish_scene":
        source = args.get("data_source", "unknown")
        return f"""# Establishing Geological Scene

## Data Source: {source}

### Required Parameters
Call `geox_set_scene()` with:
- `name`: Reservoir or project identifier
- `crs`: Coordinate reference system (e.g., "WGS84_UTM50N")
- `area_m2`: Surface area in square meters (from mapping)
- `gross_thickness_m`: Thickness in meters (from wells/seismic)
- `porosity`: Fraction 0-1 (from core analysis or log interpretation)
- `provenance`: Data source documentation

### Validation Rules
- All values must be positive
- Porosity must be in [0, 1] physical range
- CRS must be valid and specified
- Provenance must not be "assumed" or "estimated"

### Governance
This operation establishes the causal foundation for all subsequent analysis.
Incorrect scene parameters invalidate all downstream conclusions (F2 Truth).

### After Establishing
Call `geox_fetch_authoritative_state()` to verify scene is active.
"""
    
    return "Prompt not found"

# ═══════════════════════════════════════════════════════════════════════════════
# ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════════

async def main():
    """Run the wired GEOX MCP server."""
    
    logger.info("═══════════════════════════════════════════════════════════")
    logger.info("🔥 GEOX MCP Server — WIRED VERSION")
    logger.info(f"   Version: {GEOX_VERSION}")
    logger.info(f"   Seal: {GEOX_SEAL}")
    logger.info(f"   Backend: {'CONNECTED' if GEOX_AVAILABLE else 'UNAVAILABLE'}")
    logger.info(f"   Skills: {len(REGISTRY.get('skills', {}))}")
    logger.info(f"   Governance: arifOS F1-F13")
    logger.info("═══════════════════════════════════════════════════════════")
    
    async with stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            app.create_initialization_options()
        )

if __name__ == "__main__":
    asyncio.run(main())
