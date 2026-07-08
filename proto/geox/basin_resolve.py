"""
FastMCP Prototype: GEOX Basin Resolver
======================================
Prototype for GEOX basin metadata resolution via FastMCP.
Hot-reload: fastmcp dev basin_resolve.py

This is a PROTOTYPE. Once proven, port to A-FORGE TypeScript with full governance.

Usage:
  fastmcp dev basin_resolve.py                    # Hot-reload dev server
  fastmcp inspect basin_resolve.py                # View tool schemas
  fastmcp call basin_resolve.py resolve_basin '{"basin_name":"Malay Basin"}'

DITEMPA BUKAN DIBERI — Prototype fast, harden later.
"""

from fastmcp import FastMCP, Context
import json

server = FastMCP("geox-proto")


@server.tool()
def resolve_basin(basin_name: str) -> str:
    """Resolve basin metadata from GEOX knowledge graph.

    Args:
        basin_name: Name of the sedimentary basin (e.g., "Malay Basin", "Sarawak Basin")

    Returns:
        JSON with basin metadata: location, age, tectonic setting, petroleum systems.
    """
    # Prototype: mock data. Real version would call GEOX MCP.
    basins = {
        "malay basin": {
            "name": "Malay Basin",
            "location": {"lat": 5.5, "lon": 105.0, "country": "Malaysia/Vietnam"},
            "age": "Oligocene to Recent",
            "tectonic_setting": "Pull-apart basin, back-arc",
            "petroleum_systems": [
                "Oligocene lacustrine source",
                "Miocene fluvio-deltaic reservoir",
            ],
            "status": "PRODUCTION",
            "confidence": 0.92,
        },
        "sarawak basin": {
            "name": "Sarawak Basin",
            "location": {"lat": 3.0, "lon": 113.0, "country": "Malaysia"},
            "age": "Cretaceous to Recent",
            "tectonic_setting": "Passive margin, deltaic",
            "petroleum_systems": ["Oligocene-Miocene carbonate", "Miocene clastics"],
            "status": "EXPLORATION",
            "confidence": 0.85,
        },
    }

    key = basin_name.lower().strip()
    if key in basins:
        return json.dumps(basins[key], indent=2)

    return json.dumps(
        {
            "error": f"Basin '{basin_name}' not found in prototype knowledge graph.",
            "available": list(basins.keys()),
            "hint": "In production, this queries GEOX MCP on port 8081.",
        }
    )


@server.tool()
def list_basins() -> str:
    """List all available basins in the prototype knowledge graph."""
    return json.dumps(
        {
            "basins": ["Malay Basin", "Sarawak Basin"],
            "note": "Prototype only. Production queries GEOX MCP :8081.",
        }
    )


@server.tool()
def search_basins(query: str, ctx: Context) -> str:
    """Search basins by keyword (location, age, tectonic setting).

    Args:
        query: Search term (e.g., "Miocene", "carbonate", "Malaysia")
    """
    ctx.info(f"Searching basins for: {query}")

    # Prototype: simple keyword match
    results = []
    all_basins = [
        {
            "name": "Malay Basin",
            "keywords": [
                "oligocene",
                "pull-apart",
                "malaysia",
                "vietnam",
                "production",
            ],
        },
        {
            "name": "Sarawak Basin",
            "keywords": [
                "cretaceous",
                "passive-margin",
                "malaysia",
                "carbonate",
                "exploration",
            ],
        },
    ]

    for basin in all_basins:
        if query.lower() in " ".join(basin["keywords"]):
            results.append(basin["name"])

    return json.dumps({"query": query, "matches": results, "total": len(results)})


if __name__ == "__main__":
    server.run()
