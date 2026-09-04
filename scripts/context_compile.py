#!/usr/bin/env python3
"""
Federation Context Compiler — Three-Pass Pre-Flight for Agent Sessions.

Pass 1: Intent → Reachability (which organs/skills/docs does this task actually need?)
Pass 2: Skeletonization (strip non-target surfaces to interface-only)
Pass 3: Tier Assembly (Tier 1 full, Tier 2 skeleton, Tier 3 excluded)

Inspired by: Emmimal P Alexander, "Coding Agents Don't Need Bigger Context Windows"
             https://towardsdatascience.com/context-compiler (Aug 2026)

Built for: arifOS Federation. DITEMPA BUKAN DIBERI.
"""

import json
import sys
import re
import hashlib
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# Locate paths_resolver relative to this script:
# scripts/context_compile.py → ../paradox-engine/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "paradox-engine"))
from paths_resolver import org_path  # noqa: E402

# ─── FEDERATION ORGAN REGISTRY ───────────────────────────────────────────

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
        "keywords": [
            "kernel",
            "judge",
            "seal",
            "floor",
            "constitution",
            "vault",
            "session",
            "identity",
            "init",
            "verdict",
            "hold",
            "void",
            "sabar",
            "amanah",
            "truth",
            "clarity",
            "humility",
            "sovereign",
            "arifos",
            "f1",
            "f2",
            "f3",
            "f4",
            "f5",
            "f6",
            "f7",
            "f8",
            "f9",
            "f10",
            "f11",
            "f12",
            "f13",
            "governance",
            "policy",
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
            "forge_browser_*",
            "forge_postgres",
            "forge_vault",
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
        "keywords": [
            "build",
            "deploy",
            "fix",
            "code",
            "refactor",
            "test",
            "git",
            "commit",
            "push",
            "docker",
            "shell",
            "bash",
            "command",
            "run",
            "execute",
            "file",
            "edit",
            "write",
            "npm",
            "pip",
            "uv",
            "node",
            "python",
            "typescript",
            "lint",
            "format",
            "compile",
            "package",
            "install",
            "dependency",
            "restart",
            "systemctl",
            "service",
            "aforge",
            "forge",
            "browser",
            "postgres",
            "db",
            "database",
            "mcp",
            "tool",
            "skill",
            "register",
            "generate",
            "synthesize",
            "entropy",
            "sweep",
            "clean",
            "security",
            "scan",
            "audit",
            "deploy",
            "site",
            "web",
            "caddy",
            "ssl",
            "certificate",
            "domain",
            "dns",
            "vps",
            "cron",
            "port",
            "firewall",
        ],
    },
    "geox": {
        "port": 8081,
        "role": "Earth intelligence — seismic, basin, petrophysics, prospect",
        "tools": [
            "geox_basin",
            "geox_seismic_*",
            "geox_prospect",
            "geox_petrophysics",
            "geox_falsify",
            "geox_claim_*",
            "geox_well_*",
            "geox_map_*",
            "geox_evidence",
            "geox_contradiction_scan",
            "geox_workspace",
            "geox_sequence",
            "geox_deep_time_state",
            "geox_geomechanics",
            "geox_subsurface_model",
            "geox_thermal_maturity_history",
            "geox_gempy_implicit_3d",
            "geox_visual_understand",
        ],
        "keywords": [
            "seismic",
            "basin",
            "geology",
            "prospect",
            "petrophysics",
            "well log",
            "las",
            "formation",
            "reservoir",
            "stratigraphy",
            "fault",
            "horizon",
            "depth",
            "porosity",
            "permeability",
            "saturation",
            "lithology",
            "tectonic",
            "subsurface",
            "geomechanics",
            "thermal",
            "maturity",
            "backstrip",
            "geox",
            "earth",
            "rock",
            "sediment",
            "structural",
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
        "keywords": [
            "finance",
            "npv",
            "stock",
            "portfolio",
            "market",
            "risk",
            "capital",
            "wealth",
            "money",
            "investment",
            "return",
            "irr",
            "emv",
            "monte carlo",
            "kelly",
            "markowitz",
            "fx",
            "forex",
            "commodity",
            "gold",
            "oil",
            "gas",
            "budget",
            "cost",
            "bid",
            "valuation",
            "discount",
            "cash flow",
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
        "keywords": [
            "health",
            "vitality",
            "sleep",
            "fatigue",
            "dignity",
            "wellness",
            "readiness",
            "human",
            "substrate",
            "biological",
            "cognitive",
            "stress",
            "hrv",
            "decision fatigue",
            "machine health",
            "ram",
            "cpu",
            "disk",
            "swap",
        ],
    },
    "arifflow": {
        "port": 7073,
        "role": "Metabolic nerve — Flow Quotient, execute/verify ratio, receipt metabolism",
        "tools": [
            "arifflow_flow_health",
            "arifflow_flow_ingest",
        ],
        "keywords": [
            "fq",
            "flow",
            "metabolic",
            "metabolism",
            "receipt",
            "metabolizer",
            "nerve",
            "pulse",
            "execute verify",
            "flow quotient",
            "cooling",
            "ingest",
        ],
    },
}

# ─── SKILL REGISTRY ──────────────────────────────────────────────────────

SKILLS = {
    "kernel-bind": {
        "trigger": "session start, governance bind, constitution",
        "keywords": ["kernel", "bind", "governance", "session", "init"],
        "organs": ["arifos"],
    },
    "observe-ground": {
        "trigger": "evidence gathering, observation, fact finding",
        "keywords": ["observe", "evidence", "search", "find", "look"],
        "organs": ["arifos"],
    },
    "route-dispatch": {
        "trigger": "routing, organ dispatch, intent classification",
        "keywords": ["route", "dispatch", "send", "organ", "intent"],
        "organs": ["arifos"],
    },
    "arifos-constitutional-judge": {
        "trigger": "constitutional verdict, floor check, SEAL/HOLD/VOID",
        "keywords": ["judge", "verdict", "seal", "hold", "void", "floor"],
        "organs": ["arifos"],
    },
    "FLAME-router": {
        "trigger": "inference routing, free vs governed lane",
        "keywords": ["flame", "free", "inference", "classify"],
        "organs": ["arifos"],
    },
    "atlas333-cognitive-geometry": {
        "trigger": "paradox reasoning, cognitive tension",
        "keywords": ["paradox", "atlas", "cognitive", "tension"],
        "organs": ["arifos"],
    },
    "RSI-recursive-improvement": {
        "trigger": "session end, phase boundary, self-improvement",
        "keywords": ["rsi", "improve", "bottleneck", "diagnose", "fix"],
        "organs": ["arifos", "aforge"],
    },
    "FORGE-route-least-power": {
        "trigger": "tool selection, capability routing",
        "keywords": ["least power", "simplest tool", "route"],
        "organs": ["aforge"],
    },
    "FORGE-github-ops": {
        "trigger": "GitHub operations, PR, issue",
        "keywords": ["github", "pr", "pull request", "issue", "repo"],
        "organs": ["aforge"],
    },
    "FORGE-ci-diagnose": {
        "trigger": "CI/CD failure, workflow debugging",
        "keywords": ["ci", "cd", "workflow", "action", "pipeline"],
        "organs": ["aforge"],
    },
    "FORGE-docker-entropy": {
        "trigger": "Docker operations, container management",
        "keywords": ["docker", "container", "compose", "image"],
        "organs": ["aforge"],
    },
    "FORGE-incident-triage": {
        "trigger": "incident response, service outage",
        "keywords": ["incident", "outage", "down", "crash", "error"],
        "organs": ["aforge"],
    },
    "FORGE-infra-guardian": {
        "trigger": "infrastructure, Caddy, SSL, DNS",
        "keywords": ["caddy", "ssl", "dns", "tunnel", "certificate", "infra"],
        "organs": ["aforge"],
    },
    "FORGE-verify-runtime": {
        "trigger": "verification, runtime check, health probe",
        "keywords": ["verify", "check", "health", "probe", "test"],
        "organs": ["aforge"],
    },
    "FORGE-context-compress": {
        "trigger": "context compression, log compaction",
        "keywords": ["compress", "context", "summarize", "compact"],
        "organs": ["aforge"],
    },
    "FORGE-ephemeral-genesis": {
        "trigger": "create temporary tool, capability gap",
        "keywords": ["ephemeral", "temporary", "generate tool"],
        "organs": ["aforge"],
    },
    "FORGE-document-intelligence": {
        "trigger": "document processing, OCR, PDF ingestion",
        "keywords": ["document", "pdf", "ocr", "ingest", "extract"],
        "organs": ["aforge"],
    },
    "GEOX-grounding": {
        "trigger": "geological evidence grounding",
        "keywords": ["geology", "earth", "seismic", "basin"],
        "organs": ["geox"],
    },
    "WEALTH-capital-reasoning": {
        "trigger": "capital reasoning, financial analysis",
        "keywords": ["capital", "finance", "npv", "portfolio"],
        "organs": ["wealth"],
    },
    "WELL-substrate-readiness": {
        "trigger": "human readiness, vitality assessment",
        "keywords": ["well", "vitality", "health", "fatigue", "sleep"],
        "organs": ["well"],
    },
}

# ─── DOCUMENT REGISTRY ───────────────────────────────────────────────────

DOCS = {
    "AGENTS.md": {
        "path": "/root/AGENTS.md",
        "size_kb": 31,
        "always": False,
        "keywords": ["federation", "organs", "ports", "autonomy", "floors"],
    },
    "INIT.md": {
        "path": str(org_path("AAA") / "prompts/INIT.md"),
        "size_kb": 42,
        "always": False,
        "keywords": ["boot", "trinity", "rsi", "constitutional", "init"],
    },
    "TOOLS.md": {
        "path": str(org_path("AAA") / "agents/opencode/TOOLS.md"),
        "size_kb": 11,
        "always": False,
        "keywords": ["tools", "mcp", "capabilities", "server"],
    },
    "AUTONOMOUS_GOVERNANCE.md": {
        "path": str(org_path("AAA") / "agents/opencode/AUTONOMOUS_GOVERNANCE.md"),
        "size_kb": 6,
        "always": True,
        "keywords": ["autonomy", "authority", "tier", "auto-do"],
    },
    "IDENTITY.md": {
        "path": str(org_path("AAA") / "agents/opencode/IDENTITY.md"),
        "size_kb": 9,
        "always": True,
        "keywords": ["identity", "voice", "sovereign"],
    },
    "AAA-ZEN-ALIGNMENT.md": {
        "path": str(org_path("AAA") / "prompts/AAA-ZEN-ALIGNMENT.md"),
        "size_kb": 12,
        "always": False,
        "keywords": ["zen", "alignment", "probe", "drift"],
    },
}

# ─── ALWAYS-LOADED FLOORS ────────────────────────────────────────────────

ALWAYS_DOCS = [
    "F1 AMANAH (reversible-first)",
    "F2 TRUTH (evidence labelling OBS/DER/INT/SPEC)",
    "F4 CLARITY (ΔS ≤ 0)",
    "F7 HUMILITY (Ω₀ ∈ [0.03, 0.05])",
    "F9 ANTI-HANTU (no soul/consciousness claims)",
    "F13 SOVEREIGN (Arif holds final veto)",
]

# ─── TIER THRESHOLDS ─────────────────────────────────────────────────────

DEFAULT_MAX_HOPS = 2
TOKENS_PER_CHAR = 0.25  # ~4 chars per token


@dataclass
class CompileResult:
    """Output of the three-pass compiler."""

    task: str
    target_files: list[str] = field(default_factory=list)

    # Identity
    compile_id: str = (
        ""  # SHA-256 of (task + ts) — used by metabolizer to join prediction→outcome
    )

    # Pass 1 output
    reachable_organs: dict[str, float] = field(default_factory=dict)
    reachable_skills: list[str] = field(default_factory=list)
    reachable_docs: list[str] = field(default_factory=list)

    # Pass 2 output
    tier1_full: list[str] = field(default_factory=list)
    tier2_skeleton: list[str] = field(default_factory=list)
    tier3_excluded: list[str] = field(default_factory=list)

    # Machine-readable prediction (for metabolizer feedback loop)
    predicted_organs: dict = field(default_factory=dict)

    # Stats
    naive_tokens: int = 0
    compiled_tokens: int = 0
    reduction_pct: float = 0.0
    build_ms: float = 0.0

    # Warnings
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "compile_id": self.compile_id,
            "task": self.task,
            "reachable_organs": self.reachable_organs,
            "reachable_skills": self.reachable_skills,
            "reachable_docs": self.reachable_docs,
            "predicted": self.predicted_organs,
            "tiers": {
                "tier1_full": self.tier1_full,
                "tier2_skeleton": self.tier2_skeleton,
                "tier3_excluded": self.tier3_excluded,
            },
            "stats": {
                "naive_tokens": self.naive_tokens,
                "compiled_tokens": self.compiled_tokens,
                "reduction_pct": round(self.reduction_pct, 1),
                "build_ms": round(self.build_ms, 1),
            },
            "warnings": self.warnings,
        }

    def print_report(self):
        """Print a human-readable compilation report."""
        print(f"""
╔══════════════════════════════════════════════════════════════╗
║       FEDERATION CONTEXT COMPILER — Compilation Report       ║
╠══════════════════════════════════════════════════════════════╣
║ Task: {self.task[:55]:<55} ║
╠══════════════════════════════════════════════════════════════╣
║ PASS 1 — REACHABILITY                                       ║
║   Organs: {", ".join(f"{k}({v:.0%})" for k, v in self.reachable_organs.items()):<54} ║
║   Skills: {len(self.reachable_skills):<52} ║
║   Docs:   {len(self.reachable_docs):<52} ║
╠══════════════════════════════════════════════════════════════╣
║ PASS 2+3 — TIER ASSEMBLY                                    ║
║   Tier 1 (full source):     {len(self.tier1_full):<3} items               ║
║   Tier 2 (skeletonized):    {len(self.tier2_skeleton):<3} items               ║
║   Tier 3 (excluded):        {len(self.tier3_excluded):<3} items               ║
╠══════════════════════════════════════════════════════════════╣
║ STATS                                                       ║
║   Naive full-dump:    {self.naive_tokens:>6,} tokens                 ║
║   Compiled context:   {self.compiled_tokens:>6,} tokens                 ║
║   Reduction:          {self.reduction_pct:>5.1f}%                        ║
║   Build time:         {self.build_ms:>6.1f} ms                       ║
╠══════════════════════════════════════════════════════════════╣
║ WARNINGS: {len(self.warnings):<53} ║""")
        for w in self.warnings:
            print(f"║   ⚠ {w[:52]:<52} ║")
        print("╚══════════════════════════════════════════════════════════════╝")


class FederationContextCompiler:
    """
    Three-pass context compiler for the arifOS Federation.

    Pass 1: Intent → Reachability
        Classifies a task description into organ/skill/doc reachability scores.
        Uses keyword matching with scoring decay per keyword match.

    Pass 2: Skeletonization
        For non-primary organs: tool names + 1-line roles only.
        For non-reachable organs: excluded entirely.
        For reachable skills: name + trigger description only.

    Pass 3: Tier Assembly
        Tier 1 (full): Primary organ's complete surface + always-loaded docs
        Tier 2 (skeleton): Reachable-but-not-primary organs + reachable skills
        Tier 3 (excluded): Everything else (name only, available on demand)
    """

    def __init__(
        self, max_hops: int = DEFAULT_MAX_HOPS, weight_map: dict | None = None
    ):
        self.max_hops = max_hops
        self.weight_map = weight_map or {}
        self._build_indices()

    def _build_indices(self):
        """Build keyword→organ and keyword→skill lookup tables."""
        self.organ_keywords: dict[str, str] = {}
        for organ_name, organ in ORGANS.items():
            for kw in organ["keywords"]:
                self.organ_keywords[kw.lower()] = organ_name

        self.skill_keywords: dict[str, str] = {}
        for skill_name, skill in SKILLS.items():
            for kw in skill["keywords"]:
                self.skill_keywords[kw.lower()] = skill_name

        self.doc_keywords: dict[str, str] = {}
        for doc_name, doc in DOCS.items():
            if doc.get("always"):
                continue
            for kw in doc["keywords"]:
                self.doc_keywords[kw.lower()] = doc_name

    # ─── PASS 1: INTENT → REACHABILITY ───────────────────────────────

    def resolve_organs(self, task: str) -> dict[str, float]:
        """Score each organ by keyword match density, weighted by learned priors.

        If organ_weight_map.json has learned weights for a keyword→organ pair,
        those weights influence the score. Otherwise, each keyword match counts +1.
        """
        task_lower = task.lower()
        scores: dict[str, float] = {o: 0.0 for o in ORGANS}
        total_weight = 0.0

        # Load learned keyword weights if available
        learned_keywords = (
            self.weight_map.get("keywords", {}) if self.weight_map else {}
        )

        for kw, organ in self.organ_keywords.items():
            if kw in task_lower:
                # Check for learned weight
                kw_weights = learned_keywords.get(kw, {})
                learned = kw_weights.get(organ, None)
                if learned is not None:
                    # Use learned weight (0.0-1.0 scale, already normalized)
                    weight = learned
                else:
                    # Default: each keyword match counts as 1.0
                    weight = 1.0
                scores[organ] += weight
                total_weight += weight

        # Second pass: check learned keywords NOT in the hardcoded map
        # (adaptive routing — metabolizer learned new keyword→organ associations)
        for kw, kw_weights in learned_keywords.items():
            if kw in ("_meta",) or kw.startswith("_"):
                continue
            if kw in task_lower and kw not in self.organ_keywords:
                for organ, weight in kw_weights.items():
                    if organ in scores and isinstance(weight, (int, float)):
                        scores[organ] += weight
                        total_weight += weight

        if total_weight == 0:
            # Default: everything is potentially reachable
            return {o: 0.2 for o in ORGANS}

        # Normalize to 0-1
        max_score = max(scores.values()) if scores else 1.0
        return {o: min(1.0, s / max(1.0, max_score)) for o, s in scores.items()}

    def resolve_skills(self, task: str, organ_scores: dict[str, float]) -> list[str]:
        """Return skills whose keywords match and whose organs are reachable."""
        task_lower = task.lower()
        matched = set()

        for kw, skill_name in self.skill_keywords.items():
            if kw in task_lower:
                skill = SKILLS[skill_name]
                # Check if any of the skill's organs are reachable
                if any(organ_scores.get(o, 0) > 0.1 for o in skill["organs"]):
                    matched.add(skill_name)

        return sorted(matched)

    def resolve_docs(self, task: str, organ_scores: dict[str, float]) -> list[str]:
        """Return docs whose keywords match the task, plus always docs."""
        task_lower = task.lower()
        matched = set()

        for doc_name, doc in DOCS.items():
            if doc.get("always"):
                matched.add(doc_name)
                continue
            for kw in doc["keywords"]:
                if kw in task_lower:
                    matched.add(doc_name)
                    break

        return sorted(matched)

    # ─── PASS 2: SKELETONIZATION ─────────────────────────────────────

    def skeletonize_organ(self, organ_name: str) -> str:
        """Return interface-only summary of an organ's tools."""
        organ = ORGANS.get(organ_name, {})
        role = organ.get("role", "Unknown")
        tools = organ.get("tools", [])
        tool_list = ", ".join(tools[:8])
        if len(tools) > 8:
            tool_list += f" (+{len(tools) - 8} more)"
        return f"[{organ_name}:{organ.get('port', '?')}] {role}. Tools: {tool_list}"

    def skeletonize_skill(self, skill_name: str) -> str:
        """Return interface-only summary of a skill."""
        skill = SKILLS.get(skill_name, {})
        trigger = skill.get("trigger", "Unknown")
        organs = ", ".join(skill.get("organs", []))
        return f"[skill:{skill_name}] {trigger}. Organs: {organs}"

    def skeletonize_doc(self, doc_name: str) -> str:
        """Return interface-only summary of a doc."""
        doc = DOCS.get(doc_name, {})
        size = doc.get("size_kb", 0)
        return f"[doc:{doc_name}] {size}KB"

    # Realistic token estimates based on observed doc sizes + tool surface
    FULL_LOAD_BASE_TOKENS = 34_000  # All docs + all tool schemas + skills catalog
    SKELETON_TOKENS_PER_ORGAN = 180  # Tool names + 1-line role only
    SKELETON_TOKENS_PER_SKILL = 60  # Name + trigger description
    SKELETON_TOKENS_PER_DOC = 80  # Name + KB size
    ALWAYS_DOC_TOKENS = 4_500  # IDENTITY.md + AUTONOMOUS_GOVERNANCE.md
    FLOOR_TOKENS = 200  # 6 always floors
    TARGET_FILE_TOKENS = 2_000  # Full source for target files (estimated)

    def estimate_tokens(self, text: str) -> int:
        """Rough token estimate: chars // 4."""
        return max(1, len(text) // 4)

    def estimate_full_load_tokens(self) -> int:
        """Estimate tokens for a naive full-dump (all docs + all tools + all skills)."""
        return self.FULL_LOAD_BASE_TOKENS

    def estimate_compiled_tokens(
        self,
        primary_organ: str,
        reachable_organs: dict[str, float],
        reachable_skills: list[str],
        reachable_docs: list[str],
        has_target_files: bool,
    ) -> int:
        """Estimate tokens for the compiled (tiered) context."""
        tokens = self.FLOOR_TOKENS + self.ALWAYS_DOC_TOKENS

        # Primary organ full surface
        organ = ORGANS.get(primary_organ, {})
        tokens += len(organ.get("tools", [])) * 200  # Full tool descriptions

        # Other reachable organs (skeletonized)
        for o, score in reachable_organs.items():
            if o != primary_organ and score > 0.1:
                tokens += self.SKELETON_TOKENS_PER_ORGAN

        # Reachable skills (skeletonized)
        tokens += len(reachable_skills) * self.SKELETON_TOKENS_PER_SKILL

        # Reachable non-always docs (skeletonized)
        always_docs = {n for n, d in DOCS.items() if d.get("always")}
        tokens += (
            len([d for d in reachable_docs if d not in always_docs])
            * self.SKELETON_TOKENS_PER_DOC
        )

        # Target files (full source)
        if has_target_files:
            tokens += self.TARGET_FILE_TOKENS

        return tokens

    # ─── PASS 3: TIER ASSEMBLY ───────────────────────────────────────

    def compile(
        self, task: str, target_files: list[str] | None = None
    ) -> CompileResult:
        """Run all three passes and return a CompileResult."""
        import time

        t0 = time.time()
        target_files = target_files or []
        result = CompileResult(task=task, target_files=target_files)

        # ── Pass 1: Reachability ──
        organ_scores = self.resolve_organs(task)
        skill_matches = self.resolve_skills(task, organ_scores)
        doc_matches = self.resolve_docs(task, organ_scores)

        result.reachable_organs = organ_scores
        result.reachable_skills = skill_matches
        result.reachable_docs = doc_matches

        # Primary organ = highest scoring
        primary_organ = (
            max(organ_scores, key=lambda k: organ_scores.get(k, 0.0))
            if organ_scores
            else "arifos"
        )
        primary_score = organ_scores.get(primary_organ, 0)

        # ── Generate compile_id (deterministic per task+ts, traceable) ──
        ts = datetime.now(timezone.utc).isoformat()
        hash_input = f"{task}:{ts}"
        result.compile_id = hashlib.sha256(hash_input.encode()).hexdigest()[:16]

        # ── Build machine-readable prediction block ──
        secondary = sorted(
            [o for o, s in organ_scores.items() if o != primary_organ and s > 0.1]
        )
        excluded = sorted([o for o, s in organ_scores.items() if s <= 0.1])
        result.predicted_organs = {
            "primary": primary_organ,
            "secondary": secondary,
            "excluded": excluded,
            "confidence": round(primary_score, 2),
            "generated_at": ts,
        }

        # ── Pass 2+3: Tier Assembly ──

        # Tier 1: Primary organ (full surface) + always docs + F1-F13
        tier1 = []
        tier1.append(f"[ORGAN FULL] {self.skeletonize_organ(primary_organ)}")
        for floor in ALWAYS_DOCS:
            tier1.append(f"[FLOOR] {floor}")
        for doc_name in doc_matches:
            doc = DOCS.get(doc_name, {})
            if doc.get("always"):
                tier1.append(f"[DOC FULL] {self.skeletonize_doc(doc_name)}")
        if target_files:
            tier1.append(f"[TARGET FILES] {', '.join(target_files)}")
        result.tier1_full = tier1

        # Tier 2: Other reachable organs (skeletonized) + matched skills (skeletonized)
        tier2 = []
        for organ_name, score in organ_scores.items():
            if organ_name != primary_organ and score > 0.1:
                tier2.append(f"[ORGAN SKELETON] {self.skeletonize_organ(organ_name)}")
        for skill_name in skill_matches:
            tier2.append(f"[SKILL SKELETON] {self.skeletonize_skill(skill_name)}")
        for doc_name in doc_matches:
            doc = DOCS.get(doc_name, {})
            if not doc.get("always"):
                tier2.append(f"[DOC SKELETON] {self.skeletonize_doc(doc_name)}")
        result.tier2_skeleton = tier2

        # Tier 3: Everything else (excluded, available on demand)
        tier3 = []
        all_organs = set(ORGANS.keys())
        reachable_organs = {o for o, s in organ_scores.items() if s > 0.1}
        for organ_name in sorted(all_organs - reachable_organs):
            tier3.append(f"[EXCLUDED ORGAN] {organ_name}:{ORGANS[organ_name]['port']}")
        result.tier3_excluded = tier3

        # ── Stats ──
        result.naive_tokens = self.estimate_full_load_tokens()
        result.compiled_tokens = self.estimate_compiled_tokens(
            primary_organ=primary_organ,
            reachable_organs=organ_scores,
            reachable_skills=skill_matches,
            reachable_docs=doc_matches,
            has_target_files=bool(target_files),
        )
        if result.naive_tokens > 0:
            result.reduction_pct = (
                (result.naive_tokens - result.compiled_tokens)
                / result.naive_tokens
                * 100
            )

        result.build_ms = (time.time() - t0) * 1000

        # ── Warnings ──
        if primary_score < 0.3:
            result.warnings.append(
                f"Low confidence on primary organ '{primary_organ}' (score={primary_score:.2f}). "
                "Consider explicit organ hint."
            )
        if not target_files:
            result.warnings.append(
                "No target files specified — Pass 1 resolution is keyword-only (higher false-positive rate)."
            )
        if any(s < 0.1 for s in organ_scores.values()):
            excluded_count = sum(1 for s in organ_scores.values() if s < 0.1)
            result.warnings.append(
                f"{excluded_count} organ(s) excluded from Tier 2 — available on demand via arif_route."
            )

        return result


# ─── CLI ──────────────────────────────────────────────────────────────────


def main():
    import argparse
    import time

    parser = argparse.ArgumentParser(
        description="Federation Context Compiler — Three-pass pre-flight for agent sessions."
    )
    parser.add_argument(
        "task", nargs="?", default=None, help="Task description to compile context for."
    )
    parser.add_argument(
        "--target",
        "-t",
        action="append",
        default=[],
        help="Target file(s) being edited (repeatable).",
    )
    parser.add_argument(
        "--max-hops",
        type=int,
        default=DEFAULT_MAX_HOPS,
        help=f"Maximum expansion depth (default: {DEFAULT_MAX_HOPS}).",
    )
    parser.add_argument(
        "--json", action="store_true", help="Output as JSON instead of report."
    )
    parser.add_argument(
        "--demo", action="store_true", help="Run demo with sample tasks."
    )
    parser.add_argument(
        "--weights",
        type=str,
        default=None,
        help="Path to organ weight map JSON (from metabolizer_learn.py). Enables adaptive routing.",
    )

    args = parser.parse_args()

    # Load weight map if provided
    weight_map = None
    if args.weights:
        import json as _json

        with open(args.weights) as f:
            weight_map = _json.load(f)

    compiler = FederationContextCompiler(max_hops=args.max_hops, weight_map=weight_map)

    if args.demo:
        demos = [
            "fix a bug in the arifOS kernel session binding",
            "deploy the AAA cockpit to production",
            "interpret this seismic section from the Malay Basin",
            "calculate NPV for a portfolio of 5 assets",
            "check Arif's sleep and vitality metrics",
            "audit security drift across all federation ports",
        ]
        for i, task in enumerate(demos, 1):
            print(f"\n{'=' * 60}")
            print(f"DEMO {i}: {task}")
            print(f"{'=' * 60}")
            result = compiler.compile(task)
            result.print_report()
        return

    if not args.task:
        # Interactive mode
        print(
            "Federation Context Compiler — enter a task description (Ctrl+D to quit):"
        )
        try:
            task = sys.stdin.read().strip()
            if not task:
                print("No task provided.")
                sys.exit(1)
        except KeyboardInterrupt:
            print()
            sys.exit(0)
    else:
        task = args.task

    result = compiler.compile(task, target_files=args.target)

    if args.json:
        print(json.dumps(result.to_dict(), indent=2))
    else:
        result.print_report()


if __name__ == "__main__":
    main()
