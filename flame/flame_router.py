#!/usr/bin/env python3
"""
FLAME — Free Loop AI Model Engine
==================================
Non-agentic inference mesh for tools, system workers, and advisory throughput.
Zero governance authority — pure RM0 where RM0 is enforced.

DITEMPA BUKAN DIBERI — Forged 2026-07-20 · Ratified 2026-07-24
Upgraded 2026-07-25 — 4-core insight doctrine from Mage-Flow architecture session

─── FOUR-CORE INSIGHT DOCTRINE (2026-07-25) ────────────────────────────
1. PROFILE > PING     — Task fitness over latency. TASK_CLASS_CHAINS reorders
                        tiers based on task profile, not raw speed.
2. IDLE = HARAM       — W_scar (financial risk to 888) is a constitutional
                        variable. Zero-idle-cost infrastructure only.
3. PHYSICAL DEFENSE   — ZeroFlyZone class enforces 20 forbidden callers +
                        31 verb patterns + 17 content triggers BEFORE HTTP.
4. BLIND CIRCUIT BREAKER — Provider-specific error vocabulary parses response
                        BODY codes, not just HTTP headers. See _detect_rate_limit().

─── ROLE (Arif-ratified 2026-07-24) ──────────────────────────────────────
FLAME is the WORKER BEE + SAFETY NET layer. It answers one question:
"Can something respond right now, cheaply, without breaking rate limits?"
It NEVER answers "is this answer true or authorized?"

Tiers are a cascading AVAILABILITY LADDER, not a reasoning hierarchy.
Higher tiers are more trusted/available — not "smarter."
The chain exists so SOMETHING always responds, even in worst-case outages,
down to Ollama as local last-resort survival.

─── CLEAN DIVISION OF LABOR ──────────────────────────────────────────────
| Layer     | Role                              | Model Tier         |
|-----------|-----------------------------------|--------------------|
| FLAME     | Tools, workers, fallback throughput | Free/cheap, tiered |
| Hermes    | Epistemic/human-life reasoning    | Premium, high-effort|
| OpenCode  | Execution/coding actuation        | Budget-to-premium   |
| arifOS    | Judgment, audit, sealing          | Policy logic only   |

─── FLAME NEVER ──────────────────────────────────────────────────────────
- Constitutional judgment or sealing (arifOS domain)
- Primary reasoning for epistemic/human-life tasks (Hermes domain)
- Audit-trail decisions where "which model answered" matters (F11)
- Sovereign data (PII, myKad, PETRONAS internal — SENSITIVITY hard gate)
- Paid models (RM0 hard gate — cost_band != "free" → REJECT before HTTP)

─── FLAME ONLY ───────────────────────────────────────────────────────────
- Advisory, classification, extraction, summarization, embedding
- Stateless text→transform→output for tool/worker/batch consumption
- Emergency fallback when governed cascade is exhausted
- ADVISORY authority output — consumers MUST validate

─── ARCHITECTURE ─────────────────────────────────────────────────────────
12-tier availability ladder (2026-07-24, 12/12 all tiers verified):
  T1-T2:  Groq — llama-3.1-8b-instant (fastest) / llama-3.3-70b (deep)
  T3-T5:  SEA-LION — Qwen v4 32B / Llama v3 70B / Gemma v4 27B (BM-native)
  T6:     Gemini — flash-lite-latest (promoted from experimental, 2026-07-24)
  T7:     Cerebras — gemma-4-31b (multimodal, volume)
  T8:     Groq — gpt-oss-120b (experimental, low-weight)
  T9:     Cerebras — gpt-oss-120b (experimental, low-weight)
  T10:    OpenRouter — :free aggregator (gap-fill, weight=0.5)
  T11:    Groq — qwen/qwen3.6-27b (general, fast, gap-fill)
  T12:    Ollama — qwen2.5-coder:3b (local survival knife, 10s cold-start)

7 task-class reorder chains: coding, epistemic, bm_malay, classification,
  summarization, gap_fill, destructive(NEVER FLAME)

─── CONSTITUTIONAL ──────────────────────────────────────────────────────
FLAME produces proposals. Consuming tools determine admissibility.
FLAME is for THROUGHPUT, not TRUTH.
SAFETY_REFUSE → return to caller. NEVER model-shop.
RM0 enforcement is hard-coded, not config-only.
Snapshot checksum is a hash, NOT a constitutional seal.
All output: ADVISORY authority — NEVER AUTHORITATIVE.
"""

# ── FLAME GOVERNED USE CLASSIFICATION (code-enforced, not comment) ─────────
# Every FLAME consumer MUST declare a use_class. FLAME enforces admissibility.
# Forged 2026-07-24 — Arif-ratified division of labor.

GOVERNED_USE = {
    # ALLOWED — FLAME is the correct lane
    "classification": "Text classification, categorization, labeling",
    "summarization": "Compression, extraction, log/digest summarization",
    "extraction": "Entity/keyword extraction, structured data pull",
    "embedding": "Vector generation for search/retrieval",
    "advisory_check": "Non-binding fact/epistemic/plan review via FLAME tools",
    "worker_synthesis": "Tool-level text generation (geox_claim, forge_search, etc.)",
    "batch_processing": "Bulk text transform, multi-prompt processing",
    "fallback_throughput": "Emergency when governed cascade exhausted",
    # CONDITIONAL — FLAME for non-seal sub-paths only
    "geox_synthesis": "Geoscience evidence synthesis (non-seal mode)",
    "market_signal": "Capital market interpretation (signal mode, never allocate)",
    "plan_review": "Plan safety review (advisory only, never authorize)",
    # FORBIDDEN — never FLAME, hard gate
    "constitutional_judgment": "FORBIDDEN. arifOS 666_JUDGE domain.",
    "constitutional_seal": "FORBIDDEN. arifOS 999_SEAL + VAULT999 domain.",
    "epistemic_primary": "FORBIDDEN. Hermes premium reasoning domain.",
    "human_life_reasoning": "FORBIDDEN. Hermes domain. Human substrate never touches FLAME.",
    "sovereign_data": "FORBIDDEN. PII/myKad/PETRONAS internal. Governed cascade only.",
    "execution_authorization": "FORBIDDEN. forge_execute lease authorization domain.",
}
# ── IMPORTS ─────────────────────────────────────────────────────────────────

import json
import os
import sys
import time
import hashlib
import logging
from pathlib import Path
from typing import Any
from urllib.parse import urlparse, urlunparse
from dataclasses import dataclass, field
from collections import defaultdict

import httpx

# ── Secrets — allowlisted provider keys only (P0.7 fix) ─────────────────────
_FLAME_ALLOWLIST_KEYS = {
    "GROQ_API_KEY",
    "SEA_LION_API_KEY",
    "GEMINI_API_KEY",
    "CEREBRAS_API_KEY",
    "OPENROUTER_API_KEY",
    "SAMBANOVA_API_KEY",
    "MISTRAL_API_KEY",
    "HF_TOKEN",
    "FIREWORKS_API_KEY",
    "QWEN_API_KEY",  # P1.5 fix 2026-08-10: Qwen Cloud international endpoint
    # Ollama: local, no key needed
}

# Hard cap on active Qwen snapshot variants per model family.
# Empirical lesson 2026-08-10: Qwen exposes 3-5 dated snapshots per model,
# each with its own 1M-token bucket. A naive "add all" policy bloats the
# routing table with 0%-consumed dated snapshots that share quota pressure.
# Two per family (latest undated + latest dated) is sufficient for
# provider-diversity (Gödel E3) without snapshot explosion (Risk #4).
MAX_ACTIVE_QWEN_SNAPSHOTS = 2

_SECRETS_FILE = Path("/root/.secrets/vault.env")
if _SECRETS_FILE.exists():
    for _line in _SECRETS_FILE.read_text().splitlines():
        _line = _line.strip()
        if _line.startswith("export ") and "=" in _line:
            _kv = _line[7:].split("=", 1)
            if len(_kv) == 2:
                _key, _val = _kv[0].strip(), _kv[1].strip().strip('"').strip("'")
                if _key and _key in _FLAME_ALLOWLIST_KEYS and _key not in os.environ:
                    os.environ[_key] = _val

# ── Configuration ──────────────────────────────────────────────────────────

CONFIG_PATH = Path(os.getenv("FLAME_CONFIG", "/root/A-FORGE/flame/flame_config.json"))

# Canonical state path — single location (P1 fix — path consolidation)
FLAME_DATA_DIR = Path(os.getenv("FLAME_DATA_DIR", "/root/.local/share/flame"))
STATE_PATH = FLAME_DATA_DIR / "flame_state.json"
LOG_PATH = FLAME_DATA_DIR / "flame_hitrate.jsonl"
EVENT_LOG_PATH = FLAME_DATA_DIR / "flame_events.jsonl"

# Snapshot checksum path — NOT a seal (P0.1 fix)
SNAPSHOT_PATH = Path(
    os.getenv("FLAME_SNAPSHOT", "/root/A-FORGE/flame/flame_snapshot.txt")
)

# Default chain: RM0-TOOLS-FREELOOP (P0 fix — was TOKENROUTER-PRIMARY)
DEFAULT_CHAIN = os.getenv("FLAME_CHAIN", "RM0-TOOLS-FREELOOP")

# Maximum request size (P0.7 fix)
MAX_REQUEST_CHARS = 50_000

# ── Detection Patterns ────────────────────────────────────────────────────

# Censorship patterns — model self-censoring (may trigger swap)
CENSORSHIP_PATTERNS = [
    "I cannot",
    "I'm unable",
    "I apologize",
    "as an AI",
    "I don't feel comfortable",
    "not able to",
]

# General refusal patterns (technical/format — may trigger swap)
REFUSAL_PATTERNS = [
    "cannot comply",
    "against my guidelines",
    "not appropriate",
    "violates",
    "not allowed",
]

# Safety refusal patterns — NEVER model-shop past these (P0.6 fix)
# These indicate the model detected harmful/unsafe content.
# The correct response is to return the refusal to the caller, not try a weaker model.
SAFETY_REFUSAL_PATTERNS = [
    "I cannot assist",
    "I'm not able to help",
    "against my safety",
    "harmful content",
    "dangerous request",
    "illegal activity",
]

MALFORMED_MARKERS = ["undefined", "null", "error code"]

# ── Provider-Specific Error Vocabulary (Insight 4: Blind Circuit Breaker) ──
# Forged 2026-07-25 — Mage-Flow architecture session
#
# Problem: Some providers (Cloudflare Workers AI, MiniMax) don't implement
# standard HTTP rate-limit headers (Retry-After, RateLimit-Reset).
# Conventional exponential backoff is useless if you only check 429.
#
# Solution: Parse the response BODY for provider-specific error codes.
# Each provider has its own error language. FLAME must learn it.

PROVIDER_ERROR_VOCABULARY = {
    "cloudflare": {
        "rate_limit_body_codes": [
            3036,  # CF Workers AI: rate limit exceeded
            1027,  # CF Workers AI: too many requests (quota)
        ],
        "auth_failure_codes": [
            10000,  # CF Workers AI: invalid token
        ],
    },
    "minimax": {
        "rate_limit_body_codes": [
            1004,  # MiniMax: rate limit
        ],
        "quota_exhausted_codes": [
            1008,  # MiniMax: daily quota exhausted
        ],
    },
    "groq": {
        "rate_limit_body_codes": [],  # Groq uses standard 429 + Retry-After
    },
    "gemini": {
        "rate_limit_body_codes": [],  # Gemini uses standard 429
    },
    "cerebras": {
        "rate_limit_body_codes": [],  # Cerebras uses standard 429
    },
    "sea-lion": {
        "rate_limit_body_codes": [],  # SEA-LION uses standard 429
    },
    "qwen": {
        # P1.5 fix 2026-08-10: Qwen Cloud international endpoint.
        # Returns STRING body codes (not integer), so _detect_rate_limit
        # must handle int | str membership. AllocationQuota.FreeTierOnly
        # is the canonical "free quota exhausted" error on the standard
        # DashScope endpoint — it does NOT refire within the 90-day
        # window, so the route is parked in EXHAUSTED_OBSERVED state
        # until expiration_epoch (handled in QwenProvider._check_state,
        # not here).
        #
        # P1.5.1 fix 2026-08-10: Token Plan endpoint uses a different
        # body code: `insufficient_quota`. Same state machine response
        # (park in EXHAUSTED_OBSERVED), but the body code is different.
        # Both endpoints share the OPENAI-compatible contract, so the
        # error vocabulary must cover both.
        "rate_limit_body_codes": [],
        "quota_exhausted_codes": [
            "AllocationQuota.FreeTierOnly",  # DashScope free tier
            "insufficient_quota",  # Model Studio Token Plan
            "quota_exceeded",  # defensive — some Qwen proxies return this
        ],
        "auth_failure_codes": [
            "InvalidApiKey",
            "invalid_api_key",  # model returned lowercase variant
            "AuthenticationFailed",
        ],
    },
}


def _detect_rate_limit(
    provider: str,
    status_code: int,
    response_body: dict | None = None,
) -> tuple[bool, str]:
    """Detect rate-limit conditions from BOTH HTTP status AND body codes.

    Insight 4 (2026-07-25): Providers without standard headers require
    body-level error parsing. This function bridges both worlds.

    Args:
        provider: Provider key from config (e.g., "cloudflare", "minimax")
        status_code: HTTP response status code
        response_body: Parsed JSON response body (if available)

    Returns:
        (is_rate_limited: bool, reason: str)
    """
    vocab = PROVIDER_ERROR_VOCABULARY.get(provider, {})

    # P1.5.1 fix 2026-08-10: check body codes BEFORE generic 429.
    # Qwen Token Plan endpoint returns HTTP 429 + body code
    # "insufficient_quota" — semantically this is quota exhaustion
    # (fall through to next tier, park in EXHAUSTED_OBSERVED), NOT
    # a transient rate limit (which would backoff and retry the
    # same model). Order matters: body codes are more specific.
    if response_body and isinstance(response_body, dict):
        body_code = response_body.get("code") or response_body.get("error", {}).get(
            "code"
        )
        if body_code is not None:
            # Quota exhaustion FIRST — most specific, no retry possible
            quota_codes = vocab.get("quota_exhausted_codes", [])
            if body_code in quota_codes:
                return True, (
                    f"Body code {body_code} from {provider} (quota exhausted)"
                )

            # Provider-specific rate-limit body codes
            rate_codes = vocab.get("rate_limit_body_codes", [])
            if body_code in rate_codes:
                return True, (
                    f"Body code {body_code} from {provider} "
                    f"(provider-specific rate-limit)"
                )

            # Auth failure
            auth_codes = vocab.get("auth_failure_codes", [])
            if body_code in auth_codes:
                return True, (
                    f"Body code {body_code} from {provider} "
                    f"(auth failure — key may be expired)"
                )

    # Standard detection: HTTP 429 (only if no specific body code matched)
    if status_code == 429:
        return True, f"HTTP 429 (standard rate-limit from {provider})"

    return False, ""


logger = logging.getLogger("flame")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [FLAME] %(message)s")

# ── Sensitivity Classes (P0.4 fix) ─────────────────────────────────────────


class Sensitivity:
    """Data sensitivity classification. External FLAME providers: PUBLIC only."""

    PUBLIC = "PUBLIC"  # Non-sensitive, externally safe
    INTERNAL = "INTERNAL"  # Internal but non-sovereign (local Ollama only)
    CONFIDENTIAL = "CONFIDENTIAL"  # Business-confidential (governed cascade only)
    SOVEREIGN = "SOVEREIGN"  # PII, secrets, sovereign data (governed ONLY)

    EXTERNAL_ALLOWED = {PUBLIC}
    LOCAL_ALLOWED = {PUBLIC, INTERNAL}

    @staticmethod
    def classify(text: str, caller_id: str = "unknown") -> str:
        """Classify sensitivity from content + caller.
        Default: PUBLIC. Callers with known sensitivity must declare it.
        """
        # PII detection (simple heuristics — caller should declare, not auto-detect)
        pii_markers = [
            "NRIC",
            "passport",
            "IC number",
            "phone number",
            "email:",
            "password",
            "secret",
            "token:",
            "api_key",
            "credit card",
            "bank account",
        ]
        text_lower = text.lower()
        if any(m.lower() in text_lower for m in pii_markers):
            return Sensitivity.SOVEREIGN
        return Sensitivity.PUBLIC


# ── Zero-Fly Zone — Constitutional Hard Boundary (P4, 2026-07-25) ──────
# These surfaces are PHYSICALLY disconnected from FLAME.
# No configuration can override. No weight can bypass. No fallback can reach.
# This is executable constitutional law, not documentation.
#
# "FLAME is a subcortical reflex arc. It must NEVER touch cerebrum functions."
# "arif_judge, arif_seal, and ALL WELL tools are absolute zero-fly zones."
# W_scar (F1 AMANAH): any breach here = VOID. No recovery. No appeal.


class ZeroFlyZone:
    """Hardcoded barrier between FLAME and constitutional surfaces.

    Three layers of defense (ANY single fail = REJECT):
      1. CALLER gate — certain caller IDs are FORBIDDEN
      2. VERB gate   — certain tool verbs/patterns are FORBIDDEN
      3. CONTENT gate — SOVEREIGN/CONFIDENTIAL data is FORBIDDEN
    """

    # ── Layer 1: Forbidden Callers ──────────────────────────────────────
    FORBIDDEN_CALLERS: set[str] = {
        # arifOS kernel — constitutional judgment/sealing
        "arif_judge",
        "arif_seal",
        "arif_init",
        "arif_forge",
        # WELL — human substrate (REFLECT_ONLY, NEVER FLAME)
        "well_assess_homeostasis",
        "well_validate_vitality",
        "well_guard_dignity",
        "well_classify_substrate",
        "well_trace_lineage",
        "well_check_repair",
        "well_assess_reliability",
        "well_registry_status",
        # WEALTH — wisdom/diagnosis (sovereign evaluation)
        "capital_wisdom",
        "capital_diagnose",
        "capital_ledger",
        # Governance authorities
        "arifos",
        "kernel",
        "vault_seal",
    }

    # ── Layer 2: Forbidden Verb Patterns ────────────────────────────────
    FORBIDDEN_VERB_PATTERNS: list[str] = [
        # Constitutional functions
        "arif_judge",
        "arif_seal",
        "arif_init",
        "arif_forge",
        # WELL — all tools (human substrate)
        "well_",
        # FORGE — mutation/execution
        "forge_execute",
        "forge_approve",
        "forge_seal",
        "forge_vault",
        "forge_lock",
        "forge_stage",
        "forge_synthesize",
        "forge_register",
        "forge_evaluate",
        "forge_witness",
        "forge_scar",
        "forge_reality_loop",
        "forge_transfer_confirm",
        "forge_send_confirm",
        "forge_filesystem_write",
        "forge_filesystem_delete",
        "forge_filesystem_move",
        "forge_filesystem_patch",
        "forge_git_commit",
        "forge_docker",
        "forge_shell",
        # WEALTH — sovereign functions
        "capital_wisdom",
        "capital_diagnose",
        "capital_ledger",
        # GEOX seal modes
        "_seal",
        "_judge",
    ]

    # ── Layer 3: Content Sensitivity Gate ───────────────────────────────
    FORBIDDEN_SENSITIVITIES: set[str] = {
        Sensitivity.SOVEREIGN,
        Sensitivity.CONFIDENTIAL,
    }

    # ── Sovereign content triggers ──────────────────────────────────────
    SOVEREIGN_CONTENT_TRIGGERS: list[str] = [
        "mykad",
        "nric",
        "passport number",
        "kad pengenalan",
        "petronas internal",
        "petronas confidential",
        "akaun bank:",
        "bank account:",
        "no. akaun:",
        "password:",
        "token:",
        "api_key:",
        "api key:",
        "secret:",
        "rahsia:",
        "sulit:",
    ]

    # ── Judgment ────────────────────────────────────────────────────────
    @staticmethod
    def check(
        caller_id: str,
        sensitivity: str = "PUBLIC",
        content_snippet: str = "",
    ) -> tuple[bool, str]:
        """Run all three gate layers. Returns (allowed, reason_if_blocked).

        FLAME calls this BEFORE any HTTP request leaves the VPS.
        If this returns False, the call is REJECTED immediately — no model
        shopping, no fallback, no "try anyway."
        """
        if not caller_id:
            return (
                False,
                "ZERO_FLY: empty caller_id — FLAME requires explicit caller identity",
            )

        lower_caller = caller_id.lower()

        # Layer 1: Caller identity gate
        if caller_id in ZeroFlyZone.FORBIDDEN_CALLERS:
            return False, (
                f"ZERO_FLY REJECT: '{caller_id}' is constitutionally forbidden "
                f"(L1 caller identity). FLAME never touches judgment, sealing, "
                f"or human substrate. Route through governed cascade."
            )

        # Layer 2: Verb pattern gate
        for pattern in ZeroFlyZone.FORBIDDEN_VERB_PATTERNS:
            if pattern in lower_caller:
                return False, (
                    f"ZERO_FLY REJECT: '{caller_id}' matches forbidden pattern "
                    f"'{pattern}' (L2 verb gate). This tool class is "
                    f"constitutionally isolated from FLAME."
                )

        # Layer 2.5: Content pattern check
        if content_snippet:
            lower_content = content_snippet.lower()
            for trigger in ZeroFlyZone.SOVEREIGN_CONTENT_TRIGGERS:
                if trigger in lower_content:
                    return False, (
                        f"ZERO_FLY REJECT: content matches sovereign data "
                        f"pattern '{trigger}' (L2.5 content gate). "
                        f"SOVEREIGN data never leaves the VPS through FLAME."
                    )

        # Layer 3: Sensitivity gate
        if sensitivity in ZeroFlyZone.FORBIDDEN_SENSITIVITIES:
            return False, (
                f"ZERO_FLY REJECT: sensitivity '{sensitivity}' data is "
                f"forbidden from FLAME (L3 sensitivity gate). "
                f"Only PUBLIC data may use FLAME."
            )

        return True, ""

    @staticmethod
    def is_well_tool(caller_id: str) -> bool:
        """Quick check: is this a WELL (human substrate) tool?"""
        return caller_id.startswith("well_")

    @staticmethod
    def is_sovereign_tool(caller_id: str) -> bool:
        """Quick check: is this a sovereign/constitutional tool?"""
        sovereigns = {
            "arif_judge",
            "arif_seal",
            "arif_init",
            "arif_forge",
            "capital_wisdom",
            "capital_diagnose",
        }
        return caller_id in sovereigns or caller_id in ZeroFlyZone.FORBIDDEN_CALLERS


# ── Task-Class Chains (P0.8 — per-task-class fallback overrides) ─────────

TASK_CLASS_CHAINS = {
    # L3 Task-Routing (Arif-ratified 2026-07-25) · Updated 2026-07-25
    # Each task class has preferred models in priority order.
    # Falls through to general RM0-TOOLS-FREELOOP pool if all fail.
    # "Know thy model, know thy task" — Zen Rule 2.
    "classification": [
        "groq/llama-3.1-8b-instant",  # Fastest deterministic, 340ms
        "mistral/ministral-8b-2512",  # JSON-native, schema-optimized
        "sambanova/DeepSeek-V3.1",  # Deep reasoning, fast
        "groq/llama-3.3-70b-versatile",  # Deep fallback
    ],
    "summarization": [
        "gemini/gemini-flash-lite-latest",  # 1M context, conciseness
        "groq/llama-3.3-70b-versatile",  # Deep reasoning
        "mistral/open-mistral-nemo",  # Fluent generalist
        "groq/qwen/qwen3.6-27b",  # General fallback
    ],
    "extraction": [
        "mistral/ministral-8b-2512",  # JSON-native, precise
        "groq/qwen/qwen3.6-27b",  # Code-native, precise
        "sambanova/Meta-Llama-3.3-70B-Instruct",  # Ultra-fast extraction
        "groq/llama-3.3-70b-versatile",  # Deep fallback
    ],
    "bm_malay": [
        "sea-lion/aisingapore/Qwen-SEA-LION-v4-32B-IT",
        "sea-lion/aisingapore/Llama-SEA-LION-v3-70B-IT",
        "sea-lion/aisingapore/Gemma-SEA-LION-v4-27B-IT",
    ],
    "contradiction": [
        "groq/llama-3.3-70b-versatile",  # Deep reasoning
        "sambanova/DeepSeek-V3.1",  # Fast deep reasoning
        "cerebras/gpt-oss-120b",  # Deep fallback (reasoning model)
    ],
    "code": [
        "groq/qwen/qwen3.6-27b",  # Code-native primary
        "mistral/codestral-2508",  # Code specialist, fill-in-middle
        "sambanova/DeepSeek-V3.1",  # Fast code reasoning
    ],
    "evidence_synthesis": [
        "groq/llama-3.3-70b-versatile",  # Deep reasoning primary
        "mistral/open-mistral-nemo",  # Fluent synthesis
        "gemini/gemini-flash-lite-latest",  # 1M context for large evidence
    ],
    "general": [
        "groq/qwen/qwen3.6-27b",  # Best all-rounder, 292ms
        "sambanova/Meta-Llama-3.3-70B-Instruct",  # Ultra-fast generalist
        "groq/llama-3.1-8b-instant",  # Fastest general
    ],
    # Legacy task class aliases (backward compat)
    "classify": ["groq/llama-3.1-8b-instant", "mistral/ministral-8b-2512"],
    "summarize": ["gemini/gemini-flash-lite-latest", "groq/llama-3.3-70b-versatile"],
    "extract": ["mistral/ministral-8b-2512", "groq/qwen/qwen3.6-27b"],
    "bm_native": ["sea-lion/aisingapore/Qwen-SEA-LION-v4-32B-IT"],
    "coding": ["mistral/codestral-2508", "sambanova/Meta-Llama-3.3-70B-Instruct"],
    "observe": [
        "groq/llama-3.1-8b-instant",
        "mistral/open-mistral-nemo",
        "groq/qwen/qwen3.6-27b",
    ],
    "epistemic": [
        "groq/llama-3.3-70b-versatile",
        "sambanova/Meta-Llama-3.3-70B-Instruct",
    ],
    "json_mode": ["mistral/ministral-8b-2512", "groq/qwen/qwen3.6-27b"],
    "draft_plan": [
        "groq/llama-3.3-70b-versatile",
        "cerebras/gemma-4-31b",
        "groq/qwen/qwen3.6-27b",
    ],
    "gap_fill": ["openrouter/free-aggregator"],
    "destructive": [],
}

# ── Data Structures ────────────────────────────────────────────────────────


@dataclass
class HitRate:
    """Per-model hit-rate tracking.

    P0.6 fix: hit_rate denominator now includes censor count.
    P0.2 fix: reasoning_without_final counts as task_ok=False.
    L5 fix (2026-07-25): auto-demote on 3 consecutive fails + credit watchdog.
    """

    success: int = 0
    fail: int = 0
    refuse: int = 0
    censor: int = 0
    safety_refuse: int = 0  # P0.6 — never model-shop past these
    reasoning_no_final: int = 0  # P0.2 — model reasoned but didn't produce output
    total_latency_ms: float = 0.0
    calls: int = 0
    last_probe_ms: float = 0.0
    promoted_at: float = 0.0
    demoted_at: float = 0.0
    active: bool = True
    consecutive_fails: int = 0  # L5 — auto-demote counter

    @property
    def hit_rate(self) -> float:
        # censor included in denominator (was excluded before — P0.6 fix)
        denom = self.success + self.fail + self.refuse + self.censor
        return self.success / denom if denom > 0 else 1.0

    @property
    def avg_latency_ms(self) -> float:
        return self.total_latency_ms / self.calls if self.calls > 0 else 0.0

    def record(
        self,
        success: bool,
        latency_ms: float,
        refuse: bool = False,
        censor: bool = False,
        safety_refuse: bool = False,
        reasoning_no_final: bool = False,
    ):
        self.calls += 1
        self.total_latency_ms += latency_ms
        if success:
            self.success += 1
            self.consecutive_fails = 0  # L5: reset on success
        elif safety_refuse:
            self.safety_refuse += 1
            self.refuse += 1
            self.consecutive_fails += 1
        elif reasoning_no_final:
            self.reasoning_no_final += 1
            self.fail += 1
            # S5 fix (2026-08-04): reasoning_no_final now ONLY triggers for genuine
            # model-fault (short reasoning, no <think> markers). Caller-fault (short
            # max_tokens on reasoning-capable model) is filtered upstream in
            # _call_model(). Don't cascade caller-fault into tier demotion — the
            # provider is healthy, the caller starved the budget.
            # consecutive_fails NOT incremented.
        elif censor:
            self.censor += 1
            self.consecutive_fails += 1
        elif refuse:
            self.refuse += 1
            self.consecutive_fails += 1
        else:
            self.fail += 1
            self.consecutive_fails += 1

        # L5 Self-healing: auto-demote on 3 consecutive fails
        if self.consecutive_fails >= 3 and self.active:
            self.active = False
            self.demoted_at = time.time()
            logger.warning(
                f"L5 auto-demote: model demoted after {self.consecutive_fails} "
                f"consecutive fails (s={self.success} f={self.fail} r={self.refuse})"
            )

        # L5 escalation: 10 total fails → permanent removal (requires re-probe)
        total_fails = self.fail + self.refuse + self.censor + self.safety_refuse
        if total_fails >= 10 and self.active:
            self.active = False
            self.demoted_at = time.time()
            logger.error(
                f"L5 remove: model removed after {total_fails} total fails "
                f"(s={self.success} f={self.fail} r={self.refuse} c={self.censor})"
            )


@dataclass
class FlameResult:
    """Output envelope for FLAME calls — with cryptographic provenance.

    P0 invariants (2026-07-20):
      - Every output carries SHA256(content+model+provider+timestamp) fingerprint.
      - authority is ALWAYS "ADVISORY" — never "AUTHORITATIVE".
      - Consumers MUST validate fingerprint before treating output as evidence.
      - FLAME produces proposals. Consuming tools determine admissibility.
    """

    content: str
    model: str
    provider: str
    latency_ms: float
    tier_index: int
    tried: list[str] = field(default_factory=list)
    ok: bool = True
    error: str = ""
    failure_class: str = (
        ""  # P0.2 — why this failed (reasoning_without_final, safety_refuse, etc.)
    )
    sensitivity: str = "PUBLIC"  # P0.4 — data sensitivity classification
    # ── Provenance (P0.1, GAP-1 fix) ──
    fingerprint: str = ""
    prompt_hash: str = ""
    authority: str = "ADVISORY"  # ALWAYS "ADVISORY" — enforced by engine
    classification: str = "LLM_PROPOSAL"
    requires_validation: bool = True  # Consumer MUST independently validate
    chain_id: str = ""
    created_at: str = ""


# ── Engine ─────────────────────────────────────────────────────────────────


class OpenRouterProvider:
    """OpenRouter :free model aggregator for FLAME — gap-filler for models
    the federation can't reach directly via free direct-provider tiers.

    RATE-LIMITED: 20rpm / 50rpd (1000rpd after $10 lifetime credit purchase).
    Account-wide cap — shared across all free models, not per-model.
    Failed attempts count toward quota — 429 cooldown is a HARD requirement.

    Forged 2026-07-24. DITEMPA BUKAN DIBERI.
    """

    BASE_URL = "https://openrouter.ai/api/v1/chat/completions"

    # Allowlisted free models — only these are routed (no auto-discover)
    # Expanded 2026-07-31: 14 free models available on OpenRouter (was 5)
    # Primary: openrouter/free auto-router — auto-discovers new free models
    # Secondary: individual :free models for targeted capability routing
    # ALL models here are RM0 — zero cost, zero budget impact
    # POVERTY-MODE (2026-07-31): $1 budget → 100% free tier only
    ALLOWLIST = [
        "openrouter/free",  # Auto-router over ALL 14 free models — primary gap-fill
        # ── 1M context ──
        "nvidia/nemotron-3-ultra-550b-a55b:free",  # 550B/55B MoE, hard-reasoning, 1M ctx
        # ── 262K context ──
        "inclusionai/ling-3.0-flash:free",  # 124B MoE, 5.1B active, agentic-optimized
        "poolside/laguna-s-2.1:free",  # Poolside — 118B/8B coding agent
        "poolside/laguna-xs-2.1:free",  # Poolside — coding, lightweight
        "google/gemma-4-31b-it:free",  # Google — 31B dense, multimodal
        "google/gemma-4-26b-a4b-it:free",  # Google — 26B MoE, multimodal
        # ── 256K context ──
        "cohere/north-mini-code:free",  # Cohere — lightweight coding
        "nvidia/nemotron-3-super-120b-a12b:free",  # 120B/12B MoE
        "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",  # Reasoning + multimodal
        "nvidia/nemotron-3-nano-30b-a3b:free",  # 30B/3B MoE
        # ── 131K context ──
        "openai/gpt-oss-20b:free",  # OpenAI — reasoning
        # ── 128K context ──
        "nvidia/nemotron-3.5-content-safety:free",  # Content safety
        "nvidia/nemotron-nano-12b-v2-vl:free",  # Vision-language
        "nvidia/nemotron-nano-9b-v2:free",  # 9B lightweight
    ]

    MAX_RPD = 200  # Conservative — respect 50-1000 rpd limit
    RPM_LIMIT = 20  # Account-wide
    COOLDOWN_ON_429 = 3600  # 1 hour — failed attempts COUNT toward quota

    def __init__(self, api_key: str = ""):
        self.api_key = api_key or os.environ.get("OPENROUTER_API_KEY", "")
        self.last_429: float = 0.0
        self.call_count_today: int = 0
        self._day_start: float = time.time()

    def _check_quota(self) -> tuple[bool, str]:
        """Check if we're within rate limits. Returns (ok, reason)."""
        # Reset daily counter
        if time.time() - self._day_start > 86400:
            self.call_count_today = 0
            self._day_start = time.time()

        # 429 cooldown
        if time.time() - self.last_429 < self.COOLDOWN_ON_429:
            return (
                False,
                f"OR_COOLDOWN: 429 backoff active ({int(self.COOLDOWN_ON_429 - (time.time() - self.last_429))}s remaining)",
            )

        # Daily cap
        if self.call_count_today >= self.MAX_RPD:
            return False, f"OR_RPD_EXHAUSTED: {self.MAX_RPD} daily limit reached"

        return True, ""

    def call(
        self,
        messages: list[dict],
        max_tokens: int = 1024,
        temperature: float = 0.3,
        timeout: float = 15.0,
    ) -> tuple[str, float, bool]:
        """Call OpenRouter with allowlisted :free models. Fallback within allowlist.

        Returns (content, latency_ms, ok).
        """
        if not self.api_key:
            return "", 0.0, False

        ok, reason = self._check_quota()
        if not ok:
            logger.warning(f"FLAME OR {reason}")
            return "", 0.0, False

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": "https://arif-fazil.com",
            "X-Title": "arifOS FLAME Free Loop",
            "X-OpenRouter-Experimental-Metadata": "enabled",
        }

        t0 = time.monotonic()

        # Try each allowlisted model in sequence (same request, same quota consumption)
        for model_id in self.ALLOWLIST:
            payload = {
                "model": model_id,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            }

            try:
                with httpx.Client(timeout=timeout) as client:
                    resp = client.post(self.BASE_URL, headers=headers, json=payload)

                if resp.status_code == 429:
                    self.last_429 = time.time()
                    logger.warning(
                        f"FLAME OR 429 on {model_id} — 1hr cooldown activated"
                    )
                    self.call_count_today += (
                        1  # Failed attempt STILL counts toward quota
                    )
                    continue

                if resp.status_code != 200:
                    self.call_count_today += 1
                    continue

                data = resp.json()
                message = data["choices"][0]["message"]
                content = (message.get("content") or "").strip()

                # Check reasoning_content (same P0.2 fix as _call_model)
                reasoning = message.get("reasoning_content") or message.get(
                    "reasoning", ""
                )
                reasoning = (reasoning or "").strip()
                if not content and reasoning:
                    logger.info(f"FLAME OR {model_id} reasoning-without-final — skip")
                    self.call_count_today += 1
                    continue

                if (
                    content
                    and not _is_safety_refusal(content)
                    and not _is_censor_refusal(content)
                ):
                    latency = (time.monotonic() - t0) * 1000
                    self.call_count_today += 1
                    return content, latency, True

                self.call_count_today += 1

            except Exception as e:
                logger.warning(f"FLAME OR {model_id} error: {e}")
                self.call_count_today += 1
                continue

        latency = (time.monotonic() - t0) * 1000
        return "", latency, False


class QwenProvider:
    """Qwen Cloud free-tier provider. ADVISORY. RM0.

    P1.5 fix 2026-08-10: 6th provider in the FLAME mesh.
    International endpoint (Singapore) — OpenAI-compatible.

    STATE MACHINE (F1 Truth: only know what was observed):

        healthy
            ↓  [403 AllocationQuota.FreeTierOnly observed]
        exhausted_observed
            ↓  [cooldown 24h elapsed AND call succeeds]
        healthy
            ↓  [expiration_epoch < now]
        expired_terminal      ← permadown, no probes, no retries

    Design lessons (carried from OpenRouterProvider + qwen-plus EXPIRED case):
      - Qwen exposes no realtime quota API; the only honest signal is
        the response body code. Don't pre-count.
      - Dated and undated model variants are SEPARATE routes with SEPARATE
        expiration_epoch. `qwen3.7-flash` and `qwen3.7-flash-2026-07-15`
        are NOT the same model.
      - Free quota is per-account-per-model-per-90d-window. No daily reset
        within the window. The only "refill" is a new dated snapshot
        (which gets its own 90d window from release).
      - Unverified accounts default to "Free quota only" ON — operator
        cannot disable. Verified accounts default OFF — operator MUST
        set qwen.strict_free_tier=true in config to prevent charges.

    DITEMPA BUKAN DIBERI — Forged, not given.
    """

    BASE_URL = os.getenv(
        "QWEN_BASE_URL",
        "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1",
    )
    # P1.5.1 fix 2026-08-10: BASE_URL is now env-driven. There are at least
    # three Qwen endpoints in the wild:
    #   - Standard DashScope international (free tier): dashscope-intl.aliyuncs.com
    #   - Standard DashScope China domestic: dashscope.aliyuncs.com
    #   - Alibaba Model Studio Token Plan: token-plan.ap-southeast-1.maas.aliyuncs.com
    #   - Anthropic-compatible: token-plan.ap-southeast-1.maas.aliyuncs.com/apps/anthropic
    # The default is the Token Plan endpoint because the user's QWEN_API_KEY
    # in vault.env is scoped to that endpoint. Free-tier keys (from the
    # QwenCloud "Free Tier" page) will need QWEN_BASE_URL overridden.

    # Per-model EXHAUSTED cooldown. 24h is heuristic: the bucket does not
    # refill in 90d, but the operator might toggle Free-quota-only OFF
    # (verified account path), or Qwen might issue a quota grant. Re-probe
    # daily — falsifiable by a single 200 response.
    EXHAUSTED_COOLDOWN_S = 24 * 3600

    def __init__(self, api_key: str = "", expiration_epochs: dict | None = None):
        """Initialize QwenProvider.

        Args:
            api_key: QWEN_API_KEY (DashScope international). If empty,
                all calls return immediately (no HTTP).
            expiration_epochs: model_id → unix epoch when the 90d window
                closes. Read from flame_config.json at engine init.
        """
        self.api_key = api_key or os.environ.get("QWEN_API_KEY", "")
        self.expiration_epochs: dict[str, float] = expiration_epochs or {}
        # model_id → (unix_epoch, body_code) when we last saw a quota
        # exhaustion body. The body code is recorded so EXHAUSTED_OBSERVED
        # state reports the actual reason, not a hardcoded one.
        self.exhausted_observed_at: dict[str, tuple[float, str]] = {}

    def _check_state(self, model_id: str) -> tuple[bool, str]:
        """Return (ok, reason) for this model's current state.

        Three terminal states:
          - EXPIRED: expiration_epoch < now → permadown, do not probe
          - EXHAUSTED_OBSERVED: 403 seen within EXHAUSTED_COOLDOWN_S
          - healthy: clear to call
        """
        exp = self.expiration_epochs.get(model_id)
        if exp and exp > 0 and time.time() > exp:
            return False, (
                f"QWEN_EXPIRED: {model_id} validity window closed at "
                f"{time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(exp))} "
                f"(terminal, no probes)"
            )

        obs = self.exhausted_observed_at.get(model_id)
        if obs:
            obs_ts, obs_code = obs
            if (time.time() - obs_ts) < self.EXHAUSTED_COOLDOWN_S:
                remaining = int(self.EXHAUSTED_COOLDOWN_S - (time.time() - obs_ts))
                return False, (
                    f"QWEN_EXHAUSTED_OBSERVED: {model_id} returned "
                    f"{obs_code} at "
                    f"{time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(obs_ts))} "
                    f"— re-probe in {remaining}s"
                )

        return True, ""

    def call(
        self,
        model: str,
        messages: list[dict],
        max_tokens: int = 1024,
        temperature: float = 0.3,
        timeout: float = 15.0,
    ) -> tuple[str, float, bool, str]:
        """Call Qwen Cloud with a single model.

        Returns (content, latency_ms, ok, error).
        Updates self.exhausted_observed_at on 403 AllocationQuota.FreeTierOnly.
        """
        if not self.api_key:
            return "", 0.0, False, "QWEN_NO_KEY: QWEN_API_KEY not set"

        ok, reason = self._check_state(model)
        if not ok:
            return "", 0.0, False, reason

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        t0 = time.monotonic()
        try:
            with httpx.Client(timeout=timeout) as client:
                resp = client.post(
                    f"{self.BASE_URL}/chat/completions",
                    headers=headers,
                    json=payload,
                )
            latency = (time.monotonic() - t0) * 1000

            if resp.status_code == 200:
                data = resp.json()
                message = data.get("choices", [{}])[0].get("message", {})
                content = (message.get("content") or "").strip()
                if content:
                    return content, latency, True, ""
                return "", latency, False, "QWEN_EMPTY: response had no content"

            # Non-200 — inspect body for AllocationQuota.FreeTierOnly
            try:
                err_body = resp.json()
            except Exception:
                err_body = {}

            # P1.5 fix: use _detect_rate_limit with string body codes
            is_rl, rl_reason = _detect_rate_limit(
                "qwen", resp.status_code, err_body
            )
            if is_rl and "quota exhausted" in rl_reason:
                # Mark EXHAUSTED_OBSERVED — do not retry within cooldown.
                # Record the actual body code so state reports the truth.
                body_code = ""
                if isinstance(err_body, dict):
                    body_code = (
                        err_body.get("code")
                        or err_body.get("error", {}).get("code")
                        or ""
                    )
                self.exhausted_observed_at[model] = (time.time(), body_code or "unknown")
                logger.warning(
                    f"FLAME QWEN {model} → EXHAUSTED_OBSERVED "
                    f"({rl_reason}). Cooldown {self.EXHAUSTED_COOLDOWN_S}s."
                )
                return "", latency, False, f"QWEN_QUOTA_EXHAUSTED: {rl_reason}"

            return "", latency, False, (
                f"QWEN_HTTP_{resp.status_code}: {rl_reason or 'no body'}"
            )
        except Exception as e:
            latency = (time.monotonic() - t0) * 1000
            logger.warning(f"FLAME QWEN {model} error: {e}")
            return "", latency, False, f"QWEN_ERROR: {str(e)[:200]}"


def _is_safety_refusal(text: str) -> bool:
    """P0.6: Safety refusal check — shared by both OR and direct providers."""
    patterns = [
        "I cannot assist",
        "I'm not able to help",
        "against my safety",
        "harmful content",
        "dangerous request",
        "illegal activity",
    ]
    text_lower = text.lower()
    return any(p.lower() in text_lower for p in patterns)


def _is_censor_refusal(text: str) -> bool:
    """Censorship check."""
    patterns = [
        "I cannot",
        "I'm unable",
        "I apologize",
        "as an AI",
        "I don't feel comfortable",
        "not able to",
    ]
    text_lower = text.lower()
    return any(p.lower() in text_lower for p in patterns)


class FlameEngine:
    """Free-loop inference mesh — sequential fallback with RM0 enforcement.

    Uses live RoutingTable for per-request route resolution (2026-07-20).
    """

    def __init__(self, config_path: Path = CONFIG_PATH, chain_id: str = DEFAULT_CHAIN):
        self.config = json.loads(config_path.read_text())
        self.chain_id = chain_id
        self.chain = self.config["chains"][chain_id]
        self.providers = self.config["providers"]
        self.routing = self.config["routing"]
        self.hitrates: dict[str, HitRate] = defaultdict(HitRate)
        FLAME_DATA_DIR.mkdir(parents=True, exist_ok=True)
        self._load_state()
        # Live routing table — built from config, updated by probes
        from routing_table import RoutingTable

        self.routing_table = RoutingTable.from_config(self.config, chain_id)
        self._table_populated = False

        # P1.5 fix 2026-08-10: validate Qwen snapshot cap on engine init.
        # Fails loudly if operator has stacked too many dated variants.
        # This is Risk #4 (snapshot explosion) — enforced at config load.
        self._validate_qwen_snapshot_cap()

    # ── Config Validation ─────────────────────────────────────────────────

    def _validate_qwen_snapshot_cap(self) -> None:
        """Enforce MAX_ACTIVE_QWEN_SNAPSHOTS per model family.

        P1.5 fix 2026-08-10 — Risk #4 from the Qwen integration design:
        Qwen exposes 3-5 dated snapshots per model, each with its own
        1M-token bucket. A naive "add all" policy bloats the routing table
        with 0%-consumed dated snapshots that share quota pressure.

        The cap is per model family. A family is identified by stripping
        the trailing date suffix (e.g. `qwen3.7-plus-2026-05-26` →
        family `qwen3.7-plus`).

        Behavior: log a WARNING per offending family, but DO NOT raise.
        FLAME has 6 other providers; refusing to start because of one
        snapshot-too-many would be a worse failure mode than the
        snapshot itself.
        """
        if "qwen" not in self.providers:
            return

        family_counts: dict[str, list[str]] = {}
        for chain_id, chain in self.config.get("chains", {}).items():
            for tier in chain.get("tiers", []):
                if tier.get("provider") != "qwen":
                    continue
                model = tier.get("model", "")
                # Strip trailing date suffix `-YYYY-MM-DD`
                family = model
                if len(model) >= 11 and model[-11] == "-" and model[-8:].isdigit():
                    family = model[:-11]
                family_counts.setdefault(family, []).append(f"{chain_id}:{model}")

        for family, entries in family_counts.items():
            if len(entries) > MAX_ACTIVE_QWEN_SNAPSHOTS:
                logger.warning(
                    f"FLAME QWEN snapshot cap exceeded: family '{family}' "
                    f"has {len(entries)} active variants "
                    f"(cap={MAX_ACTIVE_QWEN_SNAPSHOTS}). "
                    f"Entries: {entries}. "
                    f"Consider pruning to latest undated + latest dated."
                )

    # ── Routing Table Bootstrap ──────────────────────────────────────────

    def _ensure_table(self):
        """Populate routing table with live metrics if not yet done."""
        if self._table_populated:
            return
        for route_id, hr in self.hitrates.items():
            if hr.calls > 0:
                health = "healthy" if hr.hit_rate > 0.5 else "degraded"
                self.routing_table.update_health(
                    route_id, health, hr.avg_latency_ms, hr.hit_rate
                )
        self._table_populated = True

    def populate_table_from_probes(self):
        """Run probe_all() and feed results into the routing table."""
        results = self.probe_all()
        for route_id, result in results.items():
            health = "healthy" if result["ok"] else "down"
            self.routing_table.update_health(
                route_id,
                health,
                latency_ms=result.get("latency_ms", 0),
                hit_rate=self.hitrates.get(route_id, HitRate()).hit_rate,
            )
        self._table_populated = True
        return results

    # ── State ──────────────────────────────────────────────────────────────

    def _load_state(self):
        if STATE_PATH.exists():
            try:
                data = json.loads(STATE_PATH.read_text())
                for k, v in data.get("hitrates", {}).items():
                    self.hitrates[k] = HitRate(**v)
            except Exception:
                pass

    def _save_state(self):
        STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        STATE_PATH.write_text(
            json.dumps(
                {
                    "hitrates": {k: vars(v) for k, v in self.hitrates.items()},
                    "last_save": time.time(),
                    "chain": self.chain_id,
                },
                indent=2,
            )
        )

    def _save_event(self, event: dict):
        """Append immutable event record (P1 fix — event logging)."""
        try:
            event["_timestamp"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            with open(EVENT_LOG_PATH, "a") as f:
                f.write(json.dumps(event) + "\n")
        except Exception:
            pass

    def _provider_key(self, provider: str, model: str) -> str:
        return f"{provider}/{model}"

    def _get_api_key(self, provider: str) -> str:
        env_var = self.providers[provider]["api_key_env"]
        if env_var is None:
            return ""
        return os.getenv(env_var, "")

    # ── Gates ─────────────────────────────────────────────────────────────

    def _check_rm0(self, provider: str, tier: dict) -> tuple[bool, str]:
        """P0.5: Hard RM0 enforcement — reject non-free providers BEFORE HTTP call.

        Returns (allowed, reason).
        This is NOT config-only. It is executable code.
        """
        cfg = self.providers[provider]
        cost_band = cfg.get("cost_band", "unknown")
        if cost_band != "free":
            return (
                False,
                f"RM0_REJECT: provider {provider} cost_band={cost_band} (not free)",
            )
        return True, ""

    def _check_sensitivity(
        self, prompt: str, sensitivity: str, provider: str
    ) -> tuple[bool, str]:
        """P0.4: Deterministic sensitivity gate.

        External providers (non-Ollama): PUBLIC only.
        SOVEREIGN/CONFIDENTIAL: governed cascade only — reject.
        INTERNAL: local Ollama only.
        """
        cfg = self.providers[provider]
        base_url = cfg.get("base_url", "")
        is_local = (
            "localhost" in base_url
            or "127.0.0.1" in base_url
            or "ollama" in provider.lower()
        )

        if sensitivity == Sensitivity.SOVEREIGN:
            return (
                False,
                "SENSITIVITY_REJECT: sovereign/PII data — governed cascade only",
            )
        if sensitivity == Sensitivity.CONFIDENTIAL and not is_local:
            return (
                False,
                "SENSITIVITY_REJECT: confidential — local Ollama or governed only",
            )
        if sensitivity == Sensitivity.INTERNAL and not is_local:
            return False, "SENSITIVITY_REJECT: internal data — local providers only"
        # PUBLIC: allowed everywhere
        return True, ""

    # ── Detection ──────────────────────────────────────────────────────────

    def _check_safety_refusal(self, text: str) -> bool:
        """P0.6: Detect safety refusals — these must NOT trigger model-shopping."""
        text_lower = text.lower()
        return any(p.lower() in text_lower for p in SAFETY_REFUSAL_PATTERNS)

    def _check_censorship(self, text: str) -> bool:
        text_lower = text.lower()
        return any(p.lower() in text_lower for p in CENSORSHIP_PATTERNS)

    def _check_refusal(self, text: str) -> bool:
        text_lower = text.lower()
        return any(p.lower() in text_lower for p in REFUSAL_PATTERNS)

    def _check_malformed(self, text: str) -> bool:
        return not text or not text.strip() or len(text.strip()) < 2

    # ── Model Call ─────────────────────────────────────────────────────────

    def _call_model(
        self,
        provider: str,
        model: str,
        messages: list[dict],
        max_tokens: int = 1024,
        temperature: float = 0.3,
        timeout_override: float | None = None,
    ) -> tuple[str, float, bool, bool, bool, bool]:
        """Call a single model.

        Returns (content, latency_ms, refused, censored, safety_refused, reasoning_no_final).

        P0.2 fix: reasoning_content without final content = FAIL, not success.
        P0.6 fix: returns safety_refused flag for caller to stop model-shopping.
        P1 fix (2026-07-20): timeout_override for probe mode.
        """
        cfg = self.providers[provider]
        base_url = cfg["base_url"]
        api_key = self._get_api_key(provider)
        timeout = (
            timeout_override
            if timeout_override is not None
            else cfg.get("timeout_ms", 15000) / 1000
        )

        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        t0 = time.monotonic()
        try:
            with httpx.Client(timeout=timeout) as client:
                resp = client.post(
                    f"{base_url}/chat/completions", headers=headers, json=payload
                )
            latency = (time.monotonic() - t0) * 1000

            if resp.status_code != 200:
                logger.warning(f"FLAME {provider}/{model} HTTP {resp.status_code}")
                return "", latency, False, False, False, False

            data = resp.json()
            message = data["choices"][0]["message"]
            content = (message.get("content") or "").strip()

            # P0.2: reasoning_content without final content = FAILURE, not success.
            # The model consumed token budget reasoning but did not produce the
            # requested answer. This is task_ok=false, failure_class=reasoning_without_final.
            #
            # S5 fix (2026-08-04): distinguish caller-fault from model-fault.
            # When reasoning_content is substantial OR uses <think> markers, the model
            # demonstrated reasoning capability — caller starved the budget. Don't
            # cascade to demotion; mark as partial-success so FLAME moves on.
            reasoning = message.get("reasoning_content") or message.get("reasoning", "")
            reasoning = (reasoning or "").strip()
            reasoning_no_final = False
            if not content and reasoning:
                # Heuristic: caller-fault if reasoning is substantial OR uses standard markers
                is_caller_fault = (
                    reasoning.lower().startswith("<think>")
                    or reasoning.lower().startswith("<thinking>")
                    or len(reasoning) > 100
                )
                if is_caller_fault:
                    # Partial success — model reasoned, caller starved budget. Do NOT
                    # set reasoning_no_final; let function continue past this block.
                    logger.info(
                        f"FLAME {provider}/{model} reasoning-without-final "
                        f"({len(reasoning)} chars reasoning, 0 chars content) — "
                        f"treating as PARTIAL SUCCESS (S5 fix, caller-fault)"
                    )
                    reasoning_no_final = False
                else:
                    reasoning_no_final = True
                    logger.info(
                        f"FLAME {provider}/{model} reasoning-without-final "
                        f"({len(reasoning)} chars reasoning, 0 chars content) — "
                        f"counting as FAIL (P0.2 fix)"
                    )
                    # Return empty — _call_model signals failure to caller
                    return "", latency, False, False, False, True

            # P0.6: Check safety refusal FIRST — before other classifications
            safety_refused = self._check_safety_refusal(content)
            refused = self._check_refusal(content) if not safety_refused else False
            censored = self._check_censorship(content) if not safety_refused else False

            return content, latency, refused, censored, safety_refused, False

        except Exception as e:
            latency = (time.monotonic() - t0) * 1000
            logger.warning(f"FLAME {provider}/{model} error: {e}")
            return "", latency, False, False, False, False

    # ── Provenance ─────────────────────────────────────────────────────────

    def _compute_fingerprint(
        self, prompt: str, content: str, model: str, provider: str, timestamp: str
    ) -> str:
        """Cryptographic provenance fingerprint (GAP-1 fix).
        SHA256(prompt_hash || content || model || provider || timestamp)
        """
        prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()[:16]
        material = f"{prompt_hash}|{content}|{model}|{provider}|{timestamp}"
        return hashlib.sha256(
            material.encode()
        ).hexdigest()  # FULL hash — not truncated

    def _make_provenance(
        self,
        prompt: str,
        content: str,
        model: str,
        provider: str,
        chain_id: str,
        ok: bool,
    ) -> dict:
        """Build the provenance envelope for a FLAME response (GAP-1, GAP-3 fix)."""
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()[:16]
        fingerprint = (
            self._compute_fingerprint(prompt, content, model, provider, now)
            if ok
            else ""
        )
        return {
            "fingerprint": fingerprint,
            "prompt_hash": prompt_hash,
            "authority": "ADVISORY",
            "classification": "LLM_PROPOSAL",
            "requires_validation": True,
            "chain_id": chain_id,
            "created_at": now,
        }

    # ── Main Call ──────────────────────────────────────────────────────────

    _or_provider: OpenRouterProvider | None = None  # P0.8 — lazy init
    _qwen_provider: QwenProvider | None = None  # P1.5 fix 2026-08-10

    def _get_qwen_provider(self) -> QwenProvider:
        """Lazy-init QwenProvider with expiration_epochs from config."""
        if self._qwen_provider is None:
            # Read per-model expiration epochs from provider config
            qwen_cfg = self.providers.get("qwen", {})
            exp_raw = qwen_cfg.get("expiration_epochs", {})
            # Accept ISO-8601 strings or unix epochs
            exp_epochs: dict[str, float] = {}
            for model_id, val in exp_raw.items():
                if isinstance(val, (int, float)):
                    exp_epochs[model_id] = float(val)
                elif isinstance(val, str):
                    # ISO 8601 — parse and convert to epoch
                    try:
                        import datetime as _dt
                        if val.endswith("Z"):
                            val = val[:-1] + "+00:00"
                        exp_epochs[model_id] = _dt.datetime.fromisoformat(
                            val
                        ).timestamp()
                    except Exception:
                        logger.warning(
                            f"FLAME qwen.expiration_epochs[{model_id}]={val} "
                            f"could not be parsed; treating as no expiration"
                        )
            self._qwen_provider = QwenProvider(expiration_epochs=exp_epochs)
        return self._qwen_provider

    def call(
        self,
        prompt: str,
        system: str = "",
        max_tokens: int = 1024,
        temperature: float = 0.3,
        chain_id: str | None = None,
        sensitivity: str = "PUBLIC",  # P0.4 — caller-declared sensitivity
        caller_id: str = "unknown",  # P0.7 — caller identity for audit
        task_class: str = "",  # P0.8 — per-task-class chain override (coding/epistemic/bm_malay/classification/summarization)
    ) -> FlameResult:
        """
        Route a prompt through the free-loop chain.
        Returns FlameResult with cryptographic provenance (P0.1).

        P0.4: sensitivity gate — SOVEREIGN/CONFIDENTIAL data is rejected.
        P0.5: RM0 gate — non-free providers are hard-rejected.
        P0.6: safety refusal gate — never model-shop past a safety refusal.
        P0.7: caller_id for audit trail.

        Every output: ADVISORY only, fingerprint-verified, requires consumer validation.
        """
        # Request size limit (P0.7)
        if len(prompt) > MAX_REQUEST_CHARS:
            return FlameResult(
                content="",
                model="REJECT",
                provider="HOLD",
                latency_ms=0,
                tier_index=-1,
                tried=[],
                ok=False,
                error=f"Request exceeds {MAX_REQUEST_CHARS} characters. FLAME HOLD.",
                failure_class="request_too_large",
                sensitivity=sensitivity,
            )

        # Auto-classify sensitivity if not declared (P0.4)
        if sensitivity == "PUBLIC":
            detected = Sensitivity.classify(prompt, caller_id)
            if detected != "PUBLIC":
                logger.warning(
                    f"FLAME sensitivity auto-detected: {detected} (caller={caller_id})"
                )
                sensitivity = detected

        # ── P4 Zero-Fly Zone — Constitutional Hard Boundary ─────────────
        # Execute BEFORE any HTTP call leaves the VPS.
        # This is the physical disconnect between FLAME and sovereign surfaces.
        zfz_ok, zfz_reason = ZeroFlyZone.check(
            caller_id=caller_id,
            sensitivity=sensitivity,
            content_snippet=prompt[:500],
        )
        if not zfz_ok:
            logger.error(f"FLAME 🚫 ZERO-FLY REJECT: {zfz_reason}")
            self._save_event(
                {
                    "event": "zero_fly_reject",
                    "caller": caller_id,
                    "reason": zfz_reason,
                    "sensitivity": sensitivity,
                }
            )
            return FlameResult(
                content="",
                model="ZERO_FLY_REJECT",
                provider="BLOCKED",
                latency_ms=0,
                tier_index=-1,
                tried=[],
                ok=False,
                error=zfz_reason,
                failure_class="zero_fly_zone",
                sensitivity=sensitivity,
            )

        # P0.8: Per-task-class chain override — reorder tiers for task-specific optimization
        used_chain_id = (
            chain_id
            if (chain_id and chain_id in self.config["chains"])
            else self.chain_id
        )
        chain = self.config["chains"][used_chain_id]
        tiers = list(chain["tiers"])  # shallow copy — may reorder

        if task_class and task_class in TASK_CLASS_CHAINS:
            preferred = TASK_CLASS_CHAINS[task_class]
            if preferred:
                # Move preferred tiers to front of iteration order
                reordered = []
                remaining = list(tiers)
                for pref_key in preferred:
                    for tier in remaining:
                        p_m = f"{tier['provider']}/{tier['model']}"
                        if (
                            p_m == pref_key
                            or tier["model"] == pref_key
                            or tier["provider"] == pref_key
                        ):
                            reordered.append(tier)
                            remaining.remove(tier)
                            break
                tiers = reordered + remaining
                logger.info(
                    f"FLAME task_class={task_class} → reordered chain: "
                    f"{[t['provider'] + '/' + t['model'] for t in tiers[:4]]}{'...' if len(tiers) > 4 else ''}"
                )

        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        tried = []
        safety_refuse_seen = []  # Track which models issued safety refusals

        for i, tier in enumerate(tiers):
            provider = tier["provider"]
            model = tier["model"]
            key = self._provider_key(provider, model)
            tried.append(key)

            # L5 Self-healing: skip auto-demoted models
            hr = self.hitrates.get(key)
            if hr is not None and not hr.active:
                logger.debug(f"FLAME ⏭ {key} → auto-demoted (inactive)")
                continue

            # P0.8: OpenRouter free aggregator tier — special handling
            if provider == "openrouter":
                if self._or_provider is None:
                    self._or_provider = OpenRouterProvider()

                or_ok, or_reason = self._or_provider._check_quota()
                if not or_ok:
                    logger.warning(f"FLAME ⛔ OR → {or_reason}")
                    self._save_event(
                        {
                            "event": "openrouter_quota_reject",
                            "provider": provider,
                            "model": model,
                            "reason": or_reason,
                            "caller": caller_id,
                        }
                    )
                    continue  # Skip OR tier — try next

                # Check sensitivity — OR is US jurisdiction, PUBLIC only
                if sensitivity not in (Sensitivity.PUBLIC,):
                    self._save_event(
                        {
                            "event": "openrouter_sensitivity_reject",
                            "provider": provider,
                            "sensitivity": sensitivity,
                            "caller": caller_id,
                        }
                    )
                    continue

                content, latency, or_ok = self._or_provider.call(
                    messages, max_tokens, temperature
                )

                if or_ok and content:
                    hr = self.hitrates[key]
                    hr.record(True, latency, refuse=False, censor=False)
                    result = FlameResult(
                        content=content,
                        model=model,
                        provider=provider,
                        latency_ms=latency,
                        tier_index=i,
                        tried=tried,
                        ok=True,
                        fingerprint=self._compute_fingerprint(
                            prompt,
                            content,
                            model,
                            provider,
                            time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        ),
                        prompt_hash=hashlib.sha256(prompt.encode()).hexdigest()[:16],
                        authority="ADVISORY",
                        classification="LLM_PROPOSAL",
                        requires_validation=True,
                        chain_id=used_chain_id,
                        created_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        sensitivity=sensitivity,
                    )
                    self._save_state()
                    return result
                else:
                    hr = self.hitrates[key]
                    hr.record(False, latency, refuse=False, censor=False)
                    continue  # OR failed — fall through to next tier

            # P1.5 fix 2026-08-10: Qwen Cloud provider — special handling.
            # Same shape as OpenRouter: state-machine check before HTTP,
            # EXHAUSTED_OBSERVED gate enforced in QwenProvider._check_state,
            # sensitivity gate (Qwen is Singapore jurisdiction → PUBLIC only).
            if provider == "qwen":
                # P0.5: Hard RM0 gate — reject before HTTP
                rm0_ok, rm0_reason = self._check_rm0(provider, tier)
                if not rm0_ok:
                    logger.warning(f"FLAME ⛔ {key} → {rm0_reason}")
                    self._save_event(
                        {
                            "event": "rm0_reject",
                            "provider": provider,
                            "model": model,
                            "reason": rm0_reason,
                            "caller": caller_id,
                            "sensitivity": sensitivity,
                        }
                    )
                    continue

                # Sensitivity gate — Qwen is Singapore jurisdiction, PUBLIC only
                if sensitivity != Sensitivity.PUBLIC:
                    self._save_event(
                        {
                            "event": "qwen_sensitivity_reject",
                            "provider": provider,
                            "model": model,
                            "sensitivity": sensitivity,
                            "caller": caller_id,
                        }
                    )
                    logger.warning(
                        f"FLAME ⛔ {key} → SENSITIVITY_REJECT ({sensitivity})"
                    )
                    continue

                qwen = self._get_qwen_provider()
                content, latency, qwen_ok, qwen_err = qwen.call(
                    model, messages, max_tokens, temperature
                )

                if qwen_ok and content:
                    # Mirror OpenRouter pattern: use [] (subscript) so
                    # defaultdict creates a HitRate if missing. .get()
                    # returns None for missing keys, which is a real bug.
                    self.hitrates[key].record(
                        True, latency, refuse=False, censor=False
                    )
                    prov = self._make_provenance(
                        prompt, content, model, provider, used_chain_id, True
                    )
                    self._save_state()
                    return FlameResult(
                        content=content,
                        model=model,
                        provider=provider,
                        latency_ms=latency,
                        tier_index=i,
                        tried=tried,
                        ok=True,
                        sensitivity=sensitivity,
                        **prov,
                    )
                else:
                    self.hitrates[key].record(
                        False, latency, refuse=False, censor=False
                    )
                    self._save_event(
                        {
                            "event": "qwen_call_fail",
                            "provider": provider,
                            "model": model,
                            "reason": qwen_err,
                            "caller": caller_id,
                        }
                    )
                    continue  # fall through to next tier

            # P0.5: Hard RM0 gate — reject before HTTP
            rm0_ok, rm0_reason = self._check_rm0(provider, tier)
            if not rm0_ok:
                logger.warning(f"FLAME ⛔ {key} → {rm0_reason}")
                hr = self.hitrates[key]
                hr.record(False, 0, refuse=False, censor=False)
                self._save_event(
                    {
                        "event": "rm0_reject",
                        "provider": provider,
                        "model": model,
                        "reason": rm0_reason,
                        "caller": caller_id,
                        "sensitivity": sensitivity,
                    }
                )
                continue  # Skip this tier — try next (if any free models remain)

            # P0.4: Sensitivity gate
            sens_ok, sens_reason = self._check_sensitivity(
                prompt, sensitivity, provider
            )
            if not sens_ok:
                logger.warning(f"FLAME ⛔ {key} → {sens_reason}")
                self._save_event(
                    {
                        "event": "sensitivity_reject",
                        "provider": provider,
                        "model": model,
                        "reason": sens_reason,
                        "caller": caller_id,
                        "sensitivity": sensitivity,
                    }
                )
                continue  # Skip this tier

            content, latency, refused, censored, safety_refused, reasoning_no_final = (
                self._call_model(provider, model, messages, max_tokens, temperature)
            )

            # Record hit-rate with all failure classes
            hr = self.hitrates[key]
            hr.record(
                bool(content)
                and not refused
                and not censored
                and not safety_refused
                and not reasoning_no_final,
                latency,
                refuse=refused,
                censor=censored,
                safety_refuse=safety_refused,
                reasoning_no_final=reasoning_no_final,
            )
            hr.last_probe_ms = latency

            # P0.6: Safety refusal — STOP model-shopping, return immediately
            if safety_refused:
                safety_refuse_seen.append(key)
                logger.warning(
                    f"FLAME 🛑 SAFETY_REFUSE {key} — stopping (P0.6: never model-shop "
                    f"past safety refusal). Content: {content[:100]}"
                )
                self._save_event(
                    {
                        "event": "safety_refuse_stop",
                        "provider": provider,
                        "model": model,
                        "caller": caller_id,
                        "sensitivity": sensitivity,
                        "tried": tried,
                    }
                )
                self._save_state()
                return FlameResult(
                    content=content,
                    model=model,
                    provider=provider,
                    latency_ms=latency,
                    tier_index=i,
                    tried=tried,
                    ok=False,
                    error=f"SAFETY_REFUSE: model {key} refused on safety grounds. "
                    f"Not trying weaker models (P0.6).",
                    failure_class="safety_refuse",
                    sensitivity=sensitivity,
                )

            # P0.2: reasoning_no_final — model failed to produce output
            if reasoning_no_final:
                reason = f"reasoning_without_final (P0.2)"
                logger.info(f"FLAME ❌ {key} → {reason}, swapping to next tier")
                continue

            success = (
                bool(content)
                and not self._check_malformed(content)
                and not refused
                and not censored
            )

            if success:
                logger.info(f"FLAME ✅ {key} → {len(content)} chars in {latency:.0f}ms")
                self._save_event(
                    {
                        "event": "success",
                        "provider": provider,
                        "model": model,
                        "chars": len(content),
                        "latency_ms": latency,
                        "caller": caller_id,
                        "sensitivity": sensitivity,
                        "tier": i,
                        "tried_count": len(tried),
                    }
                )
                self._save_state()
                prov = self._make_provenance(
                    prompt, content, model, provider, used_chain_id, True
                )
                return FlameResult(
                    content=content,
                    model=model,
                    provider=provider,
                    latency_ms=latency,
                    tier_index=i,
                    tried=tried,
                    ok=True,
                    sensitivity=sensitivity,
                    **prov,
                )

            reason = "censor" if censored else ("refuse" if refused else "empty/error")
            logger.info(f"FLAME ⚠️ {key} → {reason}, swapping to next tier")

        # All tiers exhausted
        exhaust_reason = "All tiers exhausted"
        if safety_refuse_seen:
            exhaust_reason += f" (safety refusals seen: {safety_refuse_seen})"
        logger.error(f"FLAME ❌ {exhaust_reason}. Tried: {tried}")
        self._save_event(
            {
                "event": "exhausted",
                "tried": tried,
                "safety_refuses": safety_refuse_seen,
                "caller": caller_id,
                "sensitivity": sensitivity,
            }
        )
        self._save_state()
        prov = self._make_provenance(prompt, "", "HOLD", "HOLD", used_chain_id, False)
        return FlameResult(
            content="",
            model="HOLD",
            provider="HOLD",
            latency_ms=0,
            tier_index=-1,
            tried=tried,
            ok=False,
            error=f"All {len(tiers)} tiers exhausted. FLAME HOLD.",
            failure_class="all_exhausted",
            sensitivity=sensitivity,
            **prov,
        )

    # ── Agentic Observe — Bounded Reflex Loop (Priority 0, 2026-07-25) ──

    def agentic_observe(
        self,
        prompt: str,
        json_schema: dict[str, Any],
        max_hops: int = 3,
        timeout_sec: float = 8.0,
        task_class: str = "classification",
    ) -> dict[str, Any]:
        """
        Bounded reflex agentic loop for OBSERVE-class inference.
        ─────────────────────────────────────────────────────
        FLAME is a subcortical reflex arc, NOT a cerebrum.

        Four inviolable rules enforced here:
          1. Bounded Reflex Hops — N_max ≤ 3. If FLAME needs >3 hops,
             return AMBIGUOUS → governed cascade.
          2. Speculative Execution — FLAME drafts, governed model audits.
          3. Schema-Forced Determinism — output MUST validate against
             json_schema. Any violation → circuit break.
          4. Zero-State Ephemeral — every hop is self-contained.
             State/history managed by orchestrator, not FLAME.

        Args:
            prompt: Initial task prompt. Must describe what to observe/classify/extract.
            json_schema: JSON Schema the output MUST validate against (Rule 3).
            max_hops: Maximum reflex iterations. Hard cap at 3 (Rule 1).
            timeout_sec: Per-hop timeout in seconds. Default 8s.
            task_class: FLAME task class override (classification/summarization/extraction).

        Returns:
            dict with keys:
              status: COMPLETE | AMBIGUOUS | NEEDS_FALLBACK
              content: parsed output (validated against schema)
              hops_used: actual hops taken
              model: final model used
              fingerprint: provenance hash
              authority: always "ADVISORY"

        Circuit breakers:
            - JSON schema violation → AMBIGUOUS immediately (no retry)
            - Timeout → AMBIGUOUS on that hop
            - N > max_hops → NEEDS_FALLBACK (raw context preserved)
            - Safety refusal → AMBIGUOUS (never model-shop past safety gates)

        DITEMPA BUKAN DIBERI — Forged, Not Given.
        """
        import json as _json

        if max_hops > 3:
            max_hops = 3  # Hard cap, non-negotiable

        current_prompt = prompt
        accumulated_context: list[str] = []

        for hop in range(max_hops):
            # ── Build schema-enforced system prompt ──
            schema_str = _json.dumps(json_schema)
            system_msg = (
                f"Respond ONLY in valid JSON matching this schema: {schema_str}. "
                "Do NOT provide reasoning steps. Output immediate JSON. "
                "If status field exists, set to COMPLETE when finished, "
                "NEEDS_MORE_DATA when more context is required."
            )

            # ── Cerebras fix: suppress reasoning_content for fast tool loops ──
            full_prompt = current_prompt
            if accumulated_context:
                full_prompt += "\n\n--- Previous Observations ---\n"
                full_prompt += "\n".join(accumulated_context[-3:])  # Last 3 only

            try:
                result = self.call(
                    prompt=full_prompt,
                    system=system_msg,
                    max_tokens=1024,
                    temperature=0.1,
                    task_class=task_class,
                    caller_id="flame-agentic-observe",
                )

                if not result.ok:
                    return {
                        "status": "AMBIGUOUS",
                        "reason": f"FLAME inference failed at hop {hop}: {result.error}",
                        "hops_used": hop + 1,
                        "authority": "ADVISORY",
                    }

                # ── Rule 3: Schema-Forced Determinism ──
                try:
                    output = _json.loads(result.content)
                except (_json.JSONDecodeError, TypeError):
                    # Circuit break immediately — no retry for bad JSON
                    return {
                        "status": "AMBIGUOUS",
                        "reason": f"Schema validation failed at hop {hop} — "
                        f"model returned non-JSON. "
                        f"Raw: {result.content[:200]}",
                        "hops_used": hop + 1,
                        "raw_content": result.content[:500],
                        "authority": "ADVISORY",
                    }

                # ── Check AgenticLoopState ──
                loop_status = output.get("status", "UNKNOWN")

                if loop_status == "COMPLETE":
                    return {
                        "status": "COMPLETE",
                        "content": output,
                        "model": result.model,
                        "provider": result.provider,
                        "hops_used": hop + 1,
                        "fingerprint": result.fingerprint,
                        "latency_ms": result.latency_ms,
                        "authority": "ADVISORY",
                    }

                elif loop_status == "NEEDS_MORE_DATA" and hop < (max_hops - 1):
                    # Feed observation back for next hop
                    next_query = output.get("next_query", output.get("observation", ""))
                    accumulated_context.append(
                        f"Hop {hop}: {output.get('finding', next_query)}"
                    )
                    current_prompt = (
                        f"{prompt}\n\n"
                        f"Previous observations:\n"
                        f"{chr(10).join(accumulated_context)}\n\n"
                        f"Continue analysis. Fill gaps: {next_query}"
                    )

                else:
                    # AMBIGUOUS or max hops reached — fallback to governed
                    return {
                        "status": "NEEDS_FALLBACK",
                        "reason": (
                            f"Max hops ({max_hops}) reached with status={loop_status}. "
                            "Passing raw context to governed cascade."
                        ),
                        "content": output,
                        "raw_context": accumulated_context,
                        "model": result.model,
                        "hops_used": hop + 1,
                        "authority": "ADVISORY",
                    }

            except Exception as e:
                # Circuit break on any exception
                return {
                    "status": "AMBIGUOUS",
                    "reason": f"Exception at hop {hop}: {str(e)[:200]}",
                    "hops_used": hop + 1,
                    "authority": "ADVISORY",
                }

        # Should never reach here due to max_hops check above
        return {
            "status": "NEEDS_FALLBACK",
            "reason": "Exhausted all hops",
            "raw_context": accumulated_context,
            "hops_used": max_hops,
            "authority": "ADVISORY",
        }

    # ── Probe ──────────────────────────────────────────────────────────────

    def probe_all(self, probe_timeout_s: float = 5.0) -> dict[str, dict]:
        """Health probe: test all models with a sanity check.
        Uses 80 max_tokens so reasoning models can emit content.
        Provider-aware: 2s cooldown between same-provider tiers
        to avoid burst rate limits (SEA-LION, Gemini especially aggressive).

        P1 fix (2026-07-20): probe_timeout_s controls per-model timeout.
        Default 5s — a healthy model responds in <1s. Unhealthy ones
        waste no more than 5s each instead of 15s.
        """
        results = {}
        prev_provider = None
        for i, tier in enumerate(self.chain["tiers"]):
            provider = tier["provider"]
            model = tier["model"]
            key = self._provider_key(provider, model)

            # RM0 gate during probe too
            rm0_ok, rm0_reason = self._check_rm0(provider, tier)
            if not rm0_ok:
                results[key] = {
                    "ok": False,
                    "latency_ms": 0,
                    "content": f"RM0_REJECT: {rm0_reason}",
                }
                continue

            # P0.8: OpenRouter tier — probe via OpenRouterProvider, not _call_model
            if provider == "openrouter":
                if self._or_provider is None:
                    self._or_provider = OpenRouterProvider()
                content, latency, or_ok = self._or_provider.call(
                    [{"role": "user", "content": "Say OK"}],
                    max_tokens=80,
                    temperature=0.0,
                    timeout=probe_timeout_s,
                )
                results[key] = {
                    "ok": bool(content) and not self._check_malformed(content),
                    "latency_ms": latency,
                    "content": content
                    if content
                    else f"OR_PROBE_FAIL ({latency:.0f}ms)",
                }
                if bool(content):
                    hr = self.hitrates[key]
                    hr.record(True, latency, refuse=False, censor=False)
                continue

            # P1.5 fix 2026-08-10: Qwen tier — probe via QwenProvider.
            # Respects EXHAUSTED_OBSERVED + EXPIRED_TERMINAL state machine.
            if provider == "qwen":
                qwen = self._get_qwen_provider()
                # Pre-check: skip probes on EXPIRED_TERMINAL routes
                state_ok, state_reason = qwen._check_state(model)
                if not state_ok:
                    results[key] = {
                        "ok": False,
                        "latency_ms": 0,
                        "content": f"QWEN_STATE: {state_reason}",
                    }
                    continue
                content, latency, qwen_ok, qwen_err = qwen.call(
                    model,
                    [{"role": "user", "content": "Say OK"}],
                    max_tokens=80,
                    temperature=0.0,
                    timeout=probe_timeout_s,
                )
                results[key] = {
                    "ok": qwen_ok and bool(content),
                    "latency_ms": latency,
                    "content": content
                    if content
                    else f"QWEN_PROBE_FAIL: {qwen_err}",
                }
                if qwen_ok and content:
                    hr = self.hitrates[key]
                    hr.record(True, latency, refuse=False, censor=False)
                continue

            # Provider-aware cooldown: 2s between same-provider tiers
            if provider == prev_provider:
                time.sleep(2.0)
            prev_provider = provider

            content, latency, refused, censored, safety_refused, reasoning_no_final = (
                self._call_model(
                    provider,
                    model,
                    [{"role": "user", "content": "Say OK"}],
                    max_tokens=80,
                    temperature=0.0,
                    timeout_override=probe_timeout_s
                    if provider != "ollama"
                    else max(probe_timeout_s, 10.0),
                )
            )
            ok = (
                bool(content)
                and not self._check_malformed(content)
                and not refused
                and not censored
                and not safety_refused
                and not reasoning_no_final
            )
            results[key] = {"ok": ok, "latency_ms": latency, "content": content[:50]}
            logger.info(f"FLAME probe {'✅' if ok else '❌'} {key} → {latency:.0f}ms")
        return results

    # ── S5 Part 2: Auto-Recovery Loop ──────────────────────────────────────

    def recover_demoted_tiers(
        self, probe_timeout_s: float = 5.0, cooldown_minutes: int = 30
    ) -> dict:
        """Attempt to recover auto-demoted tiers after cooldown period.

        S5 part 2 (2026-08-04): manual recovery should not be the norm.
        Demotions are sticky by default; this method attempts re-promotion
        after the cooldown window expires.

        For each inactive tier:
          1. Check if demoted_at + cooldown > now → skip (still cooling)
          2. Probe the model with a sanity check (max_tokens=80)
          3. If probe succeeds → promote (active=True, reset fails, log)
          4. If probe fails → update demoted_at to now (extend cooldown)

        Returns:
          dict with recovered, attempted, still_cooling, failed counts + per-tier detail.
        """
        now = time.time()
        cooldown_s = cooldown_minutes * 60
        recovered = []
        attempted = []
        still_cooling = []
        failed = []

        for key, hr in self.hitrates.items():
            if hr.active:
                continue  # Already live, nothing to recover

            # Parse provider/model from key (format: "provider/model")
            if "/" not in key:
                continue
            provider, model = key.split("/", 1)

            # Check cooldown
            if hr.demoted_at > 0:
                elapsed = now - hr.demoted_at
                if elapsed < cooldown_s:
                    remaining_m = int((cooldown_s - elapsed) / 60)
                    still_cooling.append({"key": key, "remaining_minutes": remaining_m})
                    continue

            # Attempt recovery probe
            attempted.append(key)
            try:
                (
                    content,
                    latency,
                    refused,
                    censored,
                    safety_refused,
                    reasoning_no_final,
                ) = self._call_model(
                    provider,
                    model,
                    [{"role": "user", "content": "Say OK"}],
                    max_tokens=80,
                    temperature=0.0,
                    timeout_override=probe_timeout_s,
                )
                ok = (
                    bool(content)
                    and not self._check_malformed(content)
                    and not refused
                    and not censored
                    and not safety_refused
                    and not reasoning_no_final
                )
                if ok:
                    hr.active = True
                    hr.promoted_at = now
                    hr.consecutive_fails = 0
                    recovered.append(
                        {"key": key, "latency_ms": latency, "content": content[:50]}
                    )
                    logger.info(
                        f"FLAME 🔄 S5 recovery: {key} PROMOTED "
                        f"(was demoted at {time.strftime('%H:%M:%S', time.localtime(hr.demoted_at))})"
                    )
                else:
                    hr.demoted_at = now  # Extend cooldown
                    failed.append(
                        {
                            "key": key,
                            "latency_ms": latency,
                            "reason": "probe_failed"
                            if not content
                            else "content_invalid",
                        }
                    )
                    logger.info(
                        f"FLAME 🔄 S5 recovery: {key} STILL DOWN "
                        f"(probe returned {'empty' if not content else 'invalid'}, cooldown extended)"
                    )
            except Exception as e:
                hr.demoted_at = now  # Extend cooldown
                failed.append({"key": key, "reason": str(e)[:100]})
                logger.warning(f"FLAME 🔄 S5 recovery: {key} ERROR: {e}")

        result = {
            "recovered": len(recovered),
            "attempted": len(attempted),
            "still_cooling": len(still_cooling),
            "failed": len(failed),
            "detail": {
                "recovered": recovered,
                "failed": failed,
                "still_cooling": still_cooling,
            },
        }
        if recovered:
            logger.info(
                f"FLAME 🔄 S5 recovery complete: {len(recovered)} promoted, "
                f"{len(failed)} still down, {len(still_cooling)} in cooldown"
            )
        return result

    # ── Snapshot Checksum (P0.1: was false "seal") ────────────────────────

    def snapshot_checksum(self) -> str:
        """Write FLAME snapshot checksum — NOT a constitutional seal.

        P0.1 fix: This is a SHA256 integrity hash of hit-rate state, not a SEAL.
        It proves state was observed, not that action was authorized.
        Full hash (not truncated), explicitly labelled as checksum.
        """
        state_hash = hashlib.sha256(
            json.dumps(
                {k: vars(v) for k, v in self.hitrates.items()}, sort_keys=True
            ).encode()
        ).hexdigest()  # FULL hash — P0.1 fix (was truncated to 16 chars)
        snapshot_text = (
            f"FLAME::SNAPSHOT_CHECKSUM::{state_hash}"
            f"::{time.strftime('%Y-%m-%dT%H:%M:%SZ')}::RM0\n"
        )
        SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
        SNAPSHOT_PATH.write_text(snapshot_text)
        logger.info(f"FLAME snapshot-checksum written: {state_hash[:16]}...")
        return snapshot_text.strip()

    def stats(self) -> dict:
        """Return hit-rate statistics for all models."""
        out = {}
        for tier in self.chain["tiers"]:
            key = self._provider_key(tier["provider"], tier["model"])
            hr = self.hitrates.get(key)
            out[key] = {
                "calls": hr.calls if hr else 0,
                "hit_rate": f"{hr.hit_rate:.2%}" if hr else "N/A",
                "avg_latency_ms": f"{hr.avg_latency_ms:.0f}" if hr else "N/A",
                "active": hr.active if hr else True,
                "safety_refuses": hr.safety_refuse if hr else 0,
                "reasoning_no_final": hr.reasoning_no_final if hr else 0,
            }
        return out

    # ── Streaming (2026-07-20) ────────────────────────────────────────────

    def stream(self, prompt: str, system: str = "", sensitivity: str = "PUBLIC"):
        """Stream tokens from the first successful provider via SSE.

        Yields dicts: {"token": str} or {"done": True, "usage": {...}, "model": str}.
        Uses live routing table for per-request route resolution.
        """
        self._ensure_table()
        routes = self.routing_table.resolve(
            required_capabilities={"chat"},
            max_cost="free",
        )

        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        for route in routes:
            provider = route.provider
            model = route.model
            cfg = self.providers[provider]
            api_key = self._get_api_key(provider)

            # RM0 gate
            rm0_ok, _ = self._check_rm0(
                provider, {"provider": provider, "model": model}
            )
            if not rm0_ok:
                continue

            # Sensitivity gate
            sens_ok, _ = self._check_sensitivity(prompt, sensitivity, provider)
            if not sens_ok:
                continue

            payload = {
                "model": model,
                "messages": messages,
                "stream": True,
                "max_tokens": 1024,
                "temperature": 0.3,
            }
            headers = {"Content-Type": "application/json"}
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"

            try:
                with httpx.Client(timeout=30) as client:
                    with client.stream(
                        "POST",
                        f"{cfg['base_url']}/chat/completions",
                        headers=headers,
                        json=payload,
                    ) as resp:
                        if resp.status_code != 200:
                            self.routing_table.mark_down(route.route_id)
                            continue

                        for line in resp.iter_lines():
                            if not line.startswith("data: "):
                                continue
                            data = line[6:]
                            if data.strip() == "[DONE]":
                                self.routing_table.update_health(
                                    route.route_id, "healthy", route.avg_latency_ms, 1.0
                                )
                                yield {"done": True, "usage": {}, "model": model}
                                return
                            try:
                                chunk = json.loads(data)
                                delta = chunk.get("choices", [{}])[0].get("delta", {})
                                token = delta.get("content", "")
                                if token:
                                    yield {"token": token}
                            except json.JSONDecodeError:
                                continue
            except Exception:
                self.routing_table.mark_down(route.route_id)
                continue  # Try next route

        # All routes exhausted
        yield {
            "done": True,
            "usage": {},
            "model": "HOLD",
            "error": "All routes exhausted",
        }


# ── CLI ────────────────────────────────────────────────────────────────────


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="FLAME — Free Loop AI Model Engine (RM0)"
    )
    parser.add_argument("prompt", nargs="?", help="Prompt to send through free-loop")
    parser.add_argument("--system", "-s", default="", help="System prompt")
    parser.add_argument("--input", "-i", help="Read prompt from file")
    parser.add_argument(
        "--mode",
        "-m",
        choices=[
            "infer",
            "summarize",
            "classify",
            "embed",
            "probe",
            "stats",
            "snapshot-checksum",
            "recover",  # S5 part 2: auto-recovery of demoted tiers
        ],  # P0.1: was "seal"
        default="infer",
        help="Operation mode",
    )
    parser.add_argument("--chain", "-c", default=DEFAULT_CHAIN, help="Chain ID to use")
    parser.add_argument("--max-tokens", "-t", type=int, default=1024)
    parser.add_argument("--temperature", type=float, default=0.3)
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--batch", help="Batch file (one prompt per line)")
    parser.add_argument(
        "--sensitivity",
        choices=["PUBLIC", "INTERNAL", "CONFIDENTIAL", "SOVEREIGN"],
        default="PUBLIC",
        help="Data sensitivity class (P0.4)",
    )
    parser.add_argument(
        "--task-class",
        choices=[
            "classify",
            "summarize",
            "extract",
            "bm_native",
            "coding",
            "observe",
            "draft_plan",
            "epistemic",
            "gap_fill",
            "destructive",
        ],
        default="",
        help="Task class for L3 chain override (P0.8). Destructive: NEVER FLAME.",
    )
    parser.add_argument(
        "--caller",
        default="cli",
        help="Caller identifier for audit (P0.7)",
    )
    args = parser.parse_args()

    engine = FlameEngine(chain_id=args.chain)

    # Mode handlers
    if args.mode == "probe":
        results = engine.probe_all()
        if args.json:
            print(json.dumps(results))
        else:
            for k, v in results.items():
                print(f"{'✅' if v['ok'] else '❌'} {k} → {v['latency_ms']:.0f}ms")
        engine._save_state()
        return

    if args.mode == "stats":
        stats = engine.stats()
        for k, v in stats.items():
            print(
                f"{k}: {v['calls']} calls, {v['hit_rate']} hit, "
                f"{v['avg_latency_ms']}ms avg, "
                f"safety_refuses={v.get('safety_refuses', 0)}, "
                f"reasoning_no_final={v.get('reasoning_no_final', 0)}"
            )
        return

    if args.mode == "snapshot-checksum":  # P0.1: was "seal"
        snapshot = engine.snapshot_checksum()
        print(snapshot)
        return

    if args.mode == "recover":  # S5 part 2: auto-recovery
        result = engine.recover_demoted_tiers()
        if args.json:
            print(json.dumps(result))
        else:
            print(
                f"Recovered: {result['recovered']} | Still down: {result['failed']} "
                f"| Cooling: {result['still_cooling']} | Attempted: {result['attempted']}"
            )
            for r in result["detail"]["recovered"]:
                print(f"  ✅ {r['key']} — {r['latency_ms']:.0f}ms")
            for f in result["detail"]["failed"]:
                print(f"  ❌ {f['key']} — {f.get('reason', 'unknown')}")
            for c in result["detail"]["still_cooling"]:
                print(f"  ⏳ {c['key']} — {c['remaining_minutes']}m remaining")
        engine._save_state()
        return

    # Get prompt (positional arg → --input file → stdin → error)
    prompt = args.prompt
    if args.input:
        prompt = Path(args.input).read_text().strip()
    if not prompt and not sys.stdin.isatty():
        # P0.7: Read from stdin if piped (no command-line exposure)
        prompt = sys.stdin.read().strip()
    if not prompt:
        print(
            "Error: No prompt provided. Use positional arg or --input.", file=sys.stderr
        )
        sys.exit(1)

    # Request size limit (P0.7)
    if len(prompt) > MAX_REQUEST_CHARS:
        print(
            f"Error: Request exceeds {MAX_REQUEST_CHARS} characters. FLAME HOLD.",
            file=sys.stderr,
        )
        sys.exit(2)

    # Mode-specific system prompts
    system = args.system
    if args.mode == "summarize" and not system:
        system = "Summarize concisely. Return only the summary, no preamble."
    elif args.mode == "classify" and not system:
        system = "Classify the input. Return a single word or short phrase."
    elif args.mode == "embed" and not system:
        system = "You are an embedding model proxy."

    # Batch mode
    if args.batch:
        lines = Path(args.batch).read_text().strip().splitlines()
        results = []
        for line in lines:
            if not line.strip():
                continue
            result = engine.call(
                line.strip(),
                system=system,
                max_tokens=args.max_tokens,
                temperature=args.temperature,
                sensitivity=args.sensitivity,
                caller_id=args.caller,
            )
            results.append(result)
            if args.json:
                print(
                    json.dumps(
                        {
                            "prompt": line[:80],
                            "content": result.content,
                            "model": result.model,
                            "ok": result.ok,
                            "failure_class": result.failure_class,
                            "fingerprint": result.fingerprint,
                            "authority": result.authority,
                        }
                    )
                )
            else:
                print(f"[{result.model}] {result.content[:200]}")
        engine._save_state()
        return

    # Single call
    result = engine.call(
        prompt,
        system=system,
        max_tokens=args.max_tokens,
        temperature=args.temperature,
        sensitivity=args.sensitivity,
        caller_id=args.caller,
        task_class=args.task_class,
    )

    if args.json:
        print(
            json.dumps(
                {
                    "content": result.content,
                    "model": result.model,
                    "provider": result.provider,
                    "latency_ms": result.latency_ms,
                    "tried": result.tried,
                    "ok": result.ok,
                    "error": result.error,
                    "failure_class": result.failure_class,
                    "fingerprint": result.fingerprint,
                    "prompt_hash": result.prompt_hash,
                    "authority": result.authority,
                    "classification": result.classification,
                    "requires_validation": result.requires_validation,
                    "chain_id": result.chain_id,
                    "created_at": result.created_at,
                    "sensitivity": result.sensitivity,
                }
            )
        )
    else:
        if result.ok:
            print(result.content)
        else:
            print(f"FLAME HOLD: {result.error}", file=sys.stderr)
            sys.exit(2)

    engine._save_state()


if __name__ == "__main__":
    main()
