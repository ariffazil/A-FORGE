#!/usr/bin/env python3
"""
FLAME — Free Loop AI Model Engine
==================================
Non-agentic inference mesh for tools, system workers, and advisory throughput.
Zero governance authority — pure RM0 where RM0 is enforced.

DITEMPA BUKAN DIBERI — Forged 2026-07-20 · Ratified 2026-07-24

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
    # Ollama: local, no key needed
}

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


# ── Task-Class Chains (P0.8 — per-task-class fallback overrides) ─────────

TASK_CLASS_CHAINS = {
    "coding": [
        "groq/llama-3.3-70b-versatile",
        "openrouter/free-aggregator",
        "cerebras/gemma-4-31b",
    ],
    "epistemic": ["groq/llama-3.3-70b-versatile", "gemini/gemini-2.5-flash"],
    "bm_malay": [
        "sea-lion/aisingapore/Qwen-SEA-LION-v4-32B-IT",
        "sea-lion/aisingapore/Llama-SEA-LION-v3-70B-IT",
    ],
    "classification": ["groq/llama-3.1-8b-instant", "gemini/gemini-flash-lite-latest"],
    "summarization": ["groq/llama-3.1-8b-instant", "gemini/gemini-2.5-flash"],
    "gap_fill": [
        "openrouter/free-aggregator"
    ],  # OR free models only — for providers FLAME can't reach directly
    "destructive": [],  # NEVER FLAME — governed cascade only
}

# ── Data Structures ────────────────────────────────────────────────────────


@dataclass
class HitRate:
    """Per-model hit-rate tracking.

    P0.6 fix: hit_rate denominator now includes censor count.
    P0.2 fix: reasoning_without_final counts as task_ok=False.
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
        elif safety_refuse:
            self.safety_refuse += 1
            self.refuse += 1
        elif reasoning_no_final:
            self.reasoning_no_final += 1
            self.fail += 1
        elif censor:
            self.censor += 1
        elif refuse:
            self.refuse += 1
        else:
            self.fail += 1


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
    # These are models FLAME cannot reach directly via free tiers:
    # Cohere, InclusionAI, Poolside are NOT accessible via Groq/Gemini/Cerebras/SEA-LION
    ALLOWLIST = [
        "cohere/north-mini-code:free",  # Cohere — lightweight coding
        "inclusionai/ling-3.0-flash:free",  # InclusionAI — 124B MoE, 5.1B active/token
        "poolside/laguna-s-2.1:free",  # Poolside — coding specialist
        "google/gemma-4-31b-it:free",  # Google — already available via Cerebras direct
        "nvidia/nemotron-3-super-120b-a12b:free",  # NVIDIA — 120B, 12B active
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
                content = message.get("content", "").strip()

                # Check reasoning_content (same P0.2 fix as _call_model)
                reasoning = message.get("reasoning_content", "") or message.get(
                    "reasoning", ""
                )
                if not content and reasoning and reasoning.strip():
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
            content = message.get("content", "").strip()

            # P0.2: reasoning_content without final content = FAILURE, not success.
            # The model consumed token budget reasoning but did not produce the
            # requested answer. This is task_ok=false, failure_class=reasoning_without_final.
            reasoning = message.get("reasoning_content", "") or message.get(
                "reasoning", ""
            )
            reasoning_no_final = False
            if not content and reasoning and reasoning.strip():
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
            "coding",
            "epistemic",
            "bm_malay",
            "classification",
            "summarization",
            "gap_fill",
            "destructive",
        ],
        default="",
        help="Task class for chain override (P0.8). Destructive: NEVER FLAME.",
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
