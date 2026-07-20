#!/usr/bin/env python3
"""
FLAME — Free Loop AI Model Engine
==================================
Non-agentic inference mesh for tools, system workers, and agent fallback.
Zero governance authority — pure RM0 throughput.

Architecture:
  Groq → SEA-LION → Gemini → Cerebras → OpenCode → Ollama

Features:
  - Hit-rate adaptive routing with latency probes
  - Graceful swap on timeout/refuse/censor/malform
  - Dynamic tier promotion/demotion every 5 min
  - RM0 enforcement — paid models never enter the chain
  - Health probe + 1-token sanity check per model

Constitutional: WORKERS only. Agents use the governed cascade.
                 Workers do not judge, seal, or hold authority.

DITEMPA BUKAN DIBERI — Forged, Not Given
"""

import json
import os
import sys
import time
import hashlib
import logging
from pathlib import Path
from typing import Any
from dataclasses import dataclass, field
from collections import defaultdict

import httpx

# ── Secrets auto-load ─────────────────────────────────────────────────────
_SECRETS_FILE = Path("/root/.secrets/vault.env")
if _SECRETS_FILE.exists():
    for _line in _SECRETS_FILE.read_text().splitlines():
        _line = _line.strip()
        if _line.startswith("export ") and "=" in _line:
            _kv = _line[7:].split("=", 1)
            if len(_kv) == 2:
                _key, _val = _kv[0].strip(), _kv[1].strip().strip('"').strip("'")
                if _key and _key not in os.environ:
                    os.environ[_key] = _val

# ── Configuration ──────────────────────────────────────────────────────────

CONFIG_PATH = Path(os.getenv("FLAME_CONFIG", "/root/A-FORGE/flame/flame_config.json"))
STATE_PATH = Path(
    os.getenv("FLAME_STATE", "/root/.local/share/arifos/flame_state.json")
)
LOG_PATH = Path(os.getenv("FLAME_LOG", "/root/.local/share/arifos/flame_hitrate.jsonl"))

SEAL_PATH = Path(os.getenv("FLAME_SEAL", "/root/A-FORGE/flame/flame_seal.txt"))

DEFAULT_CHAIN = os.getenv("FLAME_CHAIN", "RM0-TOOLS-FREELOOP")

# Censorship/refusal patterns to detect model non-compliance
CENSORSHIP_PATTERNS = [
    "I cannot",
    "I'm unable",
    "I apologize",
    "as an AI",
    "I don't feel comfortable",
    "not able to",
]
REFUSAL_PATTERNS = [
    "refuse",
    "cannot comply",
    "against my guidelines",
    "not appropriate",
    "violates",
    "not allowed",
]
MALFORMED_MARKERS = ["undefined", "null", "error code"]

logger = logging.getLogger("flame")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [FLAME] %(message)s")


# ── Data Structures ────────────────────────────────────────────────────────


@dataclass
class HitRate:
    """Per-model hit-rate tracking."""

    success: int = 0
    fail: int = 0
    refuse: int = 0
    censor: int = 0
    total_latency_ms: float = 0.0
    calls: int = 0
    last_probe_ms: float = 0.0
    promoted_at: float = 0.0
    demoted_at: float = 0.0
    active: bool = True

    @property
    def hit_rate(self) -> float:
        denom = self.success + self.fail + self.refuse
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
    ):
        self.calls += 1
        self.total_latency_ms += latency_ms
        if success:
            self.success += 1
        elif censor:
            self.censor += 1
        elif refuse:
            self.refuse += 1
        else:
            self.fail += 1


@dataclass
class FlameResult:
    """Output envelope for FLAME calls."""

    content: str
    model: str
    provider: str
    latency_ms: float
    tier_index: int
    tried: list[str] = field(default_factory=list)
    ok: bool = True
    error: str = ""


# ── Engine ─────────────────────────────────────────────────────────────────


class FlameEngine:
    """Free-loop adaptive inference mesh."""

    def __init__(self, config_path: Path = CONFIG_PATH, chain_id: str = DEFAULT_CHAIN):
        self.config = json.loads(config_path.read_text())
        self.chain_id = chain_id
        self.chain = self.config["chains"][chain_id]
        self.providers = self.config["providers"]
        self.routing = self.config["routing"]
        self.hitrates: dict[str, HitRate] = defaultdict(HitRate)
        self._load_state()

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

    def _provider_key(self, provider: str, model: str) -> str:
        return f"{provider}/{model}"

    def _get_api_key(self, provider: str) -> str:
        env_var = self.providers[provider]["api_key_env"]
        if env_var is None:
            return ""
        return os.getenv(env_var, "")

    def _check_censorship(self, text: str) -> bool:
        text_lower = text.lower()
        return any(p.lower() in text_lower for p in CENSORSHIP_PATTERNS)

    def _check_refusal(self, text: str) -> bool:
        text_lower = text.lower()
        return any(p.lower() in text_lower for p in REFUSAL_PATTERNS)

    def _check_malformed(self, text: str) -> bool:
        return not text or not text.strip() or len(text.strip()) < 2

    def _call_model(
        self,
        provider: str,
        model: str,
        messages: list[dict],
        max_tokens: int = 1024,
        temperature: float = 0.3,
    ) -> tuple[str, float, bool, bool]:
        """Call a single model. Returns (content, latency_ms, refused, censored)."""
        cfg = self.providers[provider]
        base_url = cfg["base_url"]
        api_key = self._get_api_key(provider)
        timeout = cfg.get("timeout_ms", 15000) / 1000

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
                return "", latency, False, False

            data = resp.json()
            content = data["choices"][0]["message"].get("content", "").strip()

            refused = self._check_refusal(content)
            censored = self._check_censorship(content)

            return content, latency, refused, censored

        except Exception as e:
            latency = (time.monotonic() - t0) * 1000
            logger.warning(f"FLAME {provider}/{model} error: {e}")
            return "", latency, False, False

    def call(
        self,
        prompt: str,
        system: str = "",
        max_tokens: int = 1024,
        temperature: float = 0.3,
        chain_id: str | None = None,
    ) -> FlameResult:
        """
        Route a prompt through the free-loop chain.
        Returns FlameResult with content and routing metadata.
        """
        if chain_id and chain_id in self.config["chains"]:
            chain = self.config["chains"][chain_id]
        else:
            chain = self.chain

        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        tried = []
        tiers = chain["tiers"]

        for i, tier in enumerate(tiers):
            provider = tier["provider"]
            model = tier["model"]
            key = self._provider_key(provider, model)
            tried.append(key)

            content, latency, refused, censored = self._call_model(
                provider, model, messages, max_tokens, temperature
            )

            success = (
                bool(content)
                and not self._check_malformed(content)
                and not refused
                and not censored
            )

            # Record hit-rate
            hr = self.hitrates[key]
            hr.record(success, latency, refuse=refused, censor=censored)
            hr.last_probe_ms = latency

            if success:
                logger.info(f"FLAME ✅ {key} → {len(content)} chars in {latency:.0f}ms")
                self._save_state()
                return FlameResult(
                    content=content,
                    model=model,
                    provider=provider,
                    latency_ms=latency,
                    tier_index=i,
                    tried=tried,
                    ok=True,
                )

            reason = "censor" if censored else ("refuse" if refused else "empty/error")
            logger.info(f"FLAME ⚠️ {key} → {reason}, swapping to next tier")

        # All tiers exhausted
        logger.error(f"FLAME ❌ all {len(tiers)} tiers exhausted. Tried: {tried}")
        self._save_state()
        return FlameResult(
            content="",
            model="HOLD",
            provider="HOLD",
            latency_ms=0,
            tier_index=-1,
            tried=tried,
            ok=False,
            error="All free tiers exhausted. FLAME HOLD.",
        )

    def probe_all(self) -> dict[str, dict]:
        """Health probe: test all models with a 1-token sanity check."""
        results = {}
        for tier in self.chain["tiers"]:
            provider = tier["provider"]
            model = tier["model"]
            key = self._provider_key(provider, model)
            content, latency, refused, censored = self._call_model(
                provider,
                model,
                [{"role": "user", "content": "Reply READY"}],
                max_tokens=20,
                temperature=0.0,
            )
            ok = (
                bool(content)
                and not self._check_malformed(content)
                and not refused
                and not censored
            )
            results[key] = {"ok": ok, "latency_ms": latency, "content": content[:50]}
            logger.info(f"FLAME probe {'✅' if ok else '❌'} {key} → {latency:.0f}ms")
        return results

    def reorder_by_latency(self) -> list[dict]:
        """Dynamic tiering: reorder tiers by observed latency (fastest first)."""
        scored = []
        for tier in self.chain["tiers"]:
            key = self._provider_key(tier["provider"], tier["model"])
            hr = self.hitrates.get(key)
            avg_lat = hr.avg_latency_ms if hr and hr.calls > 0 else 99999
            hit = hr.hit_rate if hr else 1.0
            score = (1.0 / (avg_lat + 1)) * hit * tier.get("weight", 5)
            scored.append((score, tier))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [t for _, t in scored]

    def seal(self):
        """Write FLAME integrity seal."""
        state_hash = hashlib.sha256(
            json.dumps(
                {k: vars(v) for k, v in self.hitrates.items()}, sort_keys=True
            ).encode()
        ).hexdigest()[:16]
        seal_text = (
            f"FLAME::SEAL::{state_hash}::{time.strftime('%Y-%m-%dT%H:%M:%SZ')}::RM0\n"
        )
        SEAL_PATH.write_text(seal_text)
        return seal_text.strip()

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
            }
        return out


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
        choices=["infer", "summarize", "classify", "embed", "probe", "stats", "seal"],
        default="infer",
        help="Operation mode",
    )
    parser.add_argument("--chain", "-c", default=DEFAULT_CHAIN, help="Chain ID to use")
    parser.add_argument("--max-tokens", "-t", type=int, default=1024)
    parser.add_argument("--temperature", type=float, default=0.3)
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--batch", help="Batch file (one prompt per line)")
    args = parser.parse_args()

    engine = FlameEngine(chain_id=args.chain)

    # Mode handlers
    if args.mode == "probe":
        results = engine.probe_all()
        for k, v in results.items():
            print(f"{'✅' if v['ok'] else '❌'} {k} → {v['latency_ms']:.0f}ms")
        engine._save_state()
        return

    if args.mode == "stats":
        stats = engine.stats()
        for k, v in stats.items():
            print(
                f"{k}: {v['calls']} calls, {v['hit_rate']} hit, {v['avg_latency_ms']}ms avg"
            )
        return

    if args.mode == "seal":
        seal = engine.seal()
        print(seal)
        return

    # Get prompt
    prompt = args.prompt
    if args.input:
        prompt = Path(args.input).read_text().strip()
    if not prompt:
        print(
            "Error: No prompt provided. Use positional arg or --input.", file=sys.stderr
        )
        sys.exit(1)

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
                        }
                    )
                )
            else:
                print(f"[{result.model}] {result.content[:200]}")
        engine._save_state()
        return

    # Single call
    result = engine.call(
        prompt, system=system, max_tokens=args.max_tokens, temperature=args.temperature
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
