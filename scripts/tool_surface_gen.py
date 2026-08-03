#!/usr/bin/env python3
"""Tool surface generator for context_boot.sh — outputs organ tool listings."""

import json, sys

ORGANS = {
    "arifos": {
        "port": 8088,
        "role": "Constitutional kernel — F1-F13, judge, seal, session identity",
        "tools": [
            "arif_init",
            "arif_observe",
            "arif_think",
            "arif_route",
            "arif_memory",
            "arif_judge",
            "arif_forge",
            "arif_seal",
        ],
    },
    "aforge": {
        "port": 7071,
        "role": "Execution shell — build, deploy, filesystem, git, docker, shell",
        "tools": [
            "forge_shell",
            "forge_git",
            "forge_filesystem",
            "forge_docker",
            "forge_execute",
            "forge_session_init",
            "forge_health_check",
            "forge_probe",
            "forge_synthesize",
            "forge_stage",
            "forge_sandbox_run",
            "forge_github_*",
            "forge_fetch",
            "forge_search",
            "forge_skill",
            "forge_parallel",
            "forge_pipeline_run",
            "forge_entropy_sweep",
            "forge_security_drift_scan",
            "forge_surface_guard",
            "forge_web_zen",
            "forge_document_ingest",
            "forge_chart",
            "forge_predict",
            "forge_evaluate",
            "forge_witness",
            "forge_register",
            "forge_scar",
            "forge_ephemeral",
            "forge_reality_loop",
            "forge_visual_qa",
            "forge_context_compile",
        ],
    },
    "geox": {
        "port": 8081,
        "role": "Earth intelligence — seismic, basin, petrophysics, prospect",
        "tools": [
            "geox_basin",
            "geox_seismic_compute",
            "geox_seismic_interpret",
            "geox_seismic_ingest",
            "geox_prospect",
            "geox_petrophysics",
            "geox_falsify",
            "geox_claim",
            "geox_evidence",
            "geox_contradiction_scan",
            "geox_well_desk",
            "geox_well_ingest",
            "geox_well_view",
            "geox_well_qc",
            "geox_map_layers_list",
            "geox_map_render_preview",
            "geox_map_scene_plan",
            "geox_workspace",
            "geox_sequence",
            "geox_deep_time_state",
            "geox_geomechanics",
            "geox_subsurface_model",
            "geox_thermal_maturity_history",
            "geox_visual_understand",
            "geox_gempy_implicit_3d",
            "geox_surface_status",
            "geox_h3_spatial_index",
            "geox_lancedb_embed_store",
            "geox_lem_predict",
            "geox_dde_reason",
            "geox_stac_discover",
        ],
    },
    "wealth": {
        "port": 18082,
        "role": "Capital intelligence — NPV, EMV, risk, portfolio, market",
        "tools": [
            "capital_primitive",
            "capital_market",
            "capital_health",
            "capital_diagnose",
            "capital_entropy",
            "capital_wisdom",
            "capital_ledger",
            "capital_registry",
            "wealth_institutional_stress_index",
            "wealth_governance_capacity",
            "wealth_cascade_model",
            "wealth_external_exploitation_detect",
            "wealth_bid_surface",
            "wealth_judge_handoff",
        ],
    },
    "well": {
        "port": 18083,
        "role": "Human readiness — vitality, fatigue, dignity, homeostasis",
        "tools": [
            "well_assess_homeostasis",
            "well_validate_vitality",
            "well_guard_dignity",
            "well_classify_substrate",
            "well_trace_lineage",
            "well_check_repair",
            "well_assess_reliability",
            "well_machine_diagnose",
            "well_machine_recommend",
            "well_registry_status",
        ],
    },
}

if __name__ == "__main__":
    organ = sys.argv[1]
    tier = sys.argv[2]  # 'full' or 'skeleton'

    o = ORGANS.get(organ, {})
    role = o.get("role", "Unknown")
    tools = o.get("tools", [])
    port = o.get("port", "?")

    if tier == "full":
        print(f"### {organ.upper()} — {role} (:{port})")
        print()
        for t in tools:
            print(f"- `{t}`")
        print()
    else:
        tool_list = ", ".join(f"`{t}`" for t in tools[:6])
        if len(tools) > 6:
            tool_list += f" (+{len(tools) - 6} more)"
        print(f"- **{organ.upper()}** (:{port}) — {role}. Tools: {tool_list}")
