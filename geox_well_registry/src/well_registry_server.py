"""
GEOX Well Registry MCP Server
=============================
DITEMPA BUKAN DIBERI — Forged, Not Given.

Read-only well metadata and log curve registry.
Serves as the GEOX well data surface for the arifOS federation.

Pattern: AssetOpsBench IoT server → adapted for well data.
Data: 715 LAS files in /root/geox/data/wells/

Tools:
  geox_well_list          — all wells, basic metadata
  geox_well_summary       — detailed well header info
  geox_well_logs          — available log curves per well
  geox_well_curve_data    — depth + curve values (sample-limited)
  geox_well_tops          — formation tops (if parsed)

Transport: stdio (local agents) / http (port 8082, systemd)
"""

from __future__ import annotations

import logging
import os
import sys
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import BaseModel

# ── Logging ──────────────────────────────────────────────────────────────────
_log_level = getattr(
    logging, os.environ.get("LOG_LEVEL", "WARNING").upper(), logging.WARNING
)
logging.basicConfig(
    level=_log_level, format="%(asctime)s %(name)s %(levelname)s %(message)s"
)
logger = logging.getLogger("geox-well-registry")

# ── Data path ───────────────────────────────────────────────────────────────
import warnings  # noqa: E402

# Suppress numpy truth-value warnings from malformed LAS files at import time
warnings.filterwarnings(  # noqa: E402
    "ignore", message="The truth value of an empty array is ambiguous"
)

WELLS_DIR = Path(os.environ.get("GEOX_WELLS_DIR", "/root/geox/data/wells"))
INDEX_CACHE: dict[str, WellIndexEntry] = {}
_INDEX_BUILT = False


# ── Pydantic models ──────────────────────────────────────────────────────────
class WellIndexEntry(BaseModel):
    well_id: str  # filename without .las
    filename: str  # full filename
    well_name: str | None
    uwi: str | None
    location: str | None
    company: str | None
    date: str | None
    logs: list[str]
    n_logs: int
    depth_min: float | None
    depth_max: float | None


class WellListResult(BaseModel):
    total: int
    wells: list[dict]
    message: str


class WellSummaryResult(BaseModel):
    well_id: str
    well_name: str | None
    uwi: str | None
    location: str | None
    company: str | None
    date: str | None
    n_logs: int
    logs: list[str]
    depth_min: float | None
    depth_max: float | None
    message: str


class WellLogsResult(BaseModel):
    well_id: str
    well_name: str | None
    total: int
    curves: list[str]
    message: str


class CurveDataResult(BaseModel):
    well_id: str
    curve: str
    total_points: int
    start_depth: float | None
    end_depth: float | None
    depths: list[float]
    values: list[float | None]
    message: str


class ErrorResult(BaseModel):
    error: str


# ── LAS indexing ─────────────────────────────────────────────────────────────
def _build_index() -> dict[str, WellIndexEntry]:
    """Scan WELLS_DIR and build well metadata index. Called once at startup."""
    global _INDEX_BUILT, INDEX_CACHE
    if _INDEX_BUILT:
        return INDEX_CACHE

    if not WELLS_DIR.exists():
        logger.warning(f"WELLS_DIR does not exist: {WELLS_DIR}")
        _INDEX_BUILT = True
        return INDEX_CACHE

    las_files = sorted(WELLS_DIR.glob("*.las"))
    logger.info(f"Indexing {len(las_files)} LAS files from {WELLS_DIR}")

    for fpath in las_files:
        try:
            import lasio

            las = lasio.read(str(fpath), ignore_data=True)  # header only
            well_sec = las.well

            # Determine well_id: prefer numeric UWI, fallback to filename
            uwi_val = None
            if hasattr(well_sec, "UWI") and well_sec.UWI.value:
                uwi_val = str(well_sec.UWI.value).strip()
            well_id = uwi_val or fpath.stem

            # Well name
            well_name = None
            if hasattr(well_sec, "WELL") and well_sec.WELL.value:
                well_name = str(well_sec.WELL.value).strip()

            # Location
            location = None
            for field in ("LOCATION", "LOC", "WELLBORE_LOCATION"):
                if hasattr(well_sec, field) and well_sec[field].value:
                    location = str(well_sec[field].value).strip()
                    break

            # Company
            company = None
            if hasattr(well_sec, "COMP") and well_sec.COMP.value:
                company = str(well_sec.COMP.value).strip()

            # Date
            date_str = None
            for field in ("DATE", "WELL_DATE", "SPUD_DATE"):
                if hasattr(well_sec, field) and well_sec[field].value:
                    date_str = str(well_sec[field].value).strip()
                    break

            # Log curves (data section, but header has curve names)
            log_curves = list(las.keys())

            # Depth range from data if available
            depth_min: float | None = None
            depth_max: float | None = None
            if "DEPT" in las or "DEPTH" in las:
                depth_curve = las["DEPT"] if "DEPT" in las else las["DEPTH"]
                try:
                    d = depth_curve.data
                    if d is not None and getattr(d, "size", 0) > 0:
                        depth_min = float(d.min())
                        depth_max = float(d.max())
                except Exception:
                    pass

            entry = WellIndexEntry(
                well_id=well_id,
                filename=fpath.name,
                well_name=well_name,
                uwi=uwi_val,
                location=location,
                company=company,
                date=date_str,
                logs=log_curves,
                n_logs=len(log_curves),
                depth_min=depth_min,
                depth_max=depth_max,
            )
            INDEX_CACHE[well_id] = entry
        except Exception as e:
            logger.warning(f"Could not index {fpath.name}: {e}")
            # Index by filename so it's still discoverable
            INDEX_CACHE[fpath.stem] = WellIndexEntry(
                well_id=fpath.stem,
                filename=fpath.name,
                well_name=None,
                uwi=None,
                location=None,
                company=None,
                date=None,
                logs=[],
                n_logs=0,
                depth_min=None,
                depth_max=None,
            )

    logger.info(f"Indexed {len(INDEX_CACHE)} wells")
    _INDEX_BUILT = True
    return INDEX_CACHE


# ── FastMCP server ───────────────────────────────────────────────────────────
try:
    from mcp.server.fastmcp import FastMCP
except ImportError:
    logger.error("mcp package not installed. Run: pip install mcp")
    sys.exit(1)

mcp = FastMCP(
    "geox-well-registry",
    instructions=(
        "GEOX Well Registry — read-only well metadata and log curve index. "
        "715 LAS files indexed from /root/geox/data/wells/. "
        "Use geox_well_list to discover wells, geox_well_summary for header details, "
        "geox_well_logs for available curves, geox_well_curve_data for sample data. "
        "DITEMPA BUKAN DIBERI — Earth evidence is forged, not given."
    ),
)

# Build index at startup
_build_index()


@mcp.tool(title="List All Wells")
def geox_well_list() -> WellListResult:
    """Returns all indexed wells with basic metadata (id, name, location, n_logs)."""
    index = _build_index()
    wells = [
        {
            "well_id": e.well_id,
            "well_name": e.well_name,
            "location": e.location,
            "n_logs": e.n_logs,
        }
        for e in sorted(index.values(), key=lambda x: x.well_id)
    ]
    return WellListResult(
        total=len(wells),
        wells=wells,
        message=f"found {len(wells)} wells in registry.",
    )


@mcp.tool(title="Well Summary")
def geox_well_summary(well_id: str) -> WellSummaryResult | ErrorResult:
    """Return detailed header metadata for one well by ID (well_id or UWI)."""
    index = _build_index()
    entry = index.get(well_id)
    if not entry:
        return ErrorResult(error=f"well not found: {well_id}")
    return WellSummaryResult(
        well_id=entry.well_id,
        well_name=entry.well_name,
        uwi=entry.uwi,
        location=entry.location,
        company=entry.company,
        date=entry.date,
        n_logs=entry.n_logs,
        logs=entry.logs,
        depth_min=entry.depth_min,
        depth_max=entry.depth_max,
        message=f"well {well_id}: {entry.n_logs} log curves, depth {entry.depth_min or 0:.1f}–{entry.depth_max or 0:.1f}m.",
    )


@mcp.tool(title="Well Log Curves")
def geox_well_logs(well_id: str) -> WellLogsResult | ErrorResult:
    """List all available log curve mnemonics for a well."""
    index = _build_index()
    entry = index.get(well_id)
    if not entry:
        return ErrorResult(error=f"well not found: {well_id}")
    return WellLogsResult(
        well_id=entry.well_id,
        well_name=entry.well_name,
        total=entry.n_logs,
        curves=entry.logs,
        message=f"{entry.well_id} has {entry.n_logs} curves: {', '.join(entry.logs)}.",
    )


@mcp.tool(title="Curve Data (Sample-Limited)")
def geox_well_curve_data(
    well_id: str,
    curve: str = "GR",
    max_points: int = 1000,
    depth_start: float | None = None,
    depth_end: float | None = None,
) -> CurveDataResult | ErrorResult:
    """Return depth + values for a specific log curve (sample-limited to max_points).

    Use this to retrieve a sample of log data for a specific curve.
    For full resolution, use the LAS file directly.
    """
    index = _build_index()
    entry = index.get(well_id)
    if not entry:
        return ErrorResult(error=f"well not found: {well_id}")

    if curve.upper() not in [c.upper() for c in entry.logs]:
        return ErrorResult(
            error=f"curve '{curve}' not found in well {well_id}. Available: {', '.join(entry.logs)}"
        )

    # Find actual curve case-insensitively
    actual_curve = next(c for c in entry.logs if c.upper() == curve.upper())

    try:
        import lasio

        fpath = WELLS_DIR / entry.filename
        las = lasio.read(str(fpath))
        depth_curve = (
            las["DEPT"] if "DEPT" in las else (las["DEPTH"] if "DEPTH" in las else None)
        )
        value_curve = las[actual_curve]

        if depth_curve is None:
            return ErrorResult(error="no depth curve found in LAS file")

        depths_arr = depth_curve.data
        values_arr = value_curve.data

        # Apply depth filter
        mask = None
        if depth_start is not None:
            mask = depths_arr >= depth_start
        if depth_end is not None:
            m2 = depths_arr <= depth_end
            mask = mask & m2 if mask is not None else m2

        if mask is not None:
            depths_arr = depths_arr[mask]
            values_arr = values_arr[mask]

        # Resample if too many points
        n = len(depths_arr)
        if n > max_points:
            step = n // max_points
            depths_arr = depths_arr[::step]
            values_arr = values_arr[::step]

        # Convert numpy None/NaN to None
        values_clean: list[float | None] = []
        for v in values_arr:
            try:
                if v is None or (hasattr(v, "isnull") and v.isnull()):
                    values_clean.append(None)
                else:
                    values_clean.append(float(v))
            except (ValueError, TypeError):
                values_clean.append(None)

        return CurveDataResult(
            well_id=well_id,
            curve=actual_curve,
            total_points=len(depths_arr),
            start_depth=float(depths_arr.min()) if len(depths_arr) else None,
            end_depth=float(depths_arr.max()) if len(depths_arr) else None,
            depths=[float(d) for d in depths_arr],
            values=values_clean,
            message=f"returned {len(depths_arr)} points for {actual_curve} in {well_id} (max_points={max_points}).",
        )
    except Exception as e:
        logger.error(f"Error reading curve data for {well_id}/{curve}: {e}")
        return ErrorResult(error=f"failed to read curve data: {e}")


def main():
    transport = os.environ.get("GEOX_WELL_TRANSPORT", "stdio")
    if transport == "http":
        port = int(os.environ.get("GEOX_WELL_PORT", "8082"))
        import uvicorn
        from starlette.applications import Starlette
        from starlette.routing import Mount
        from mcp.server.stdio import stdio_server
        from mcp.server import Server
        from starlette.testclient import TestClient

        app = Starlette(routes=[Mount("/mcp/", app=mcp.streamable_http_app())])
        logger.info(f"Starting GEOX Well Registry on port {port}")
        uvicorn.run(app, host="0.0.0.0", port=port)
    else:
        # Stdio mode — for MCP agents
        mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
