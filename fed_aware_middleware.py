#!/usr/bin/env python3
"""
fed_aware_middleware.py — Path B / F13 directive 2026-08-11
================================================================

Fed-Aware Middleware — sits between OpenCode CLI and model providers.

OpenCode sends `model: "fed-<capability>"` (e.g. "fed-reasoning-heavy",
"fed-memory", "fed-multimodal-vision"). On every request, this middleware:

  1. Parses the capability signature from the model field.
  2. Calls FED :7074/mcp `tools/call fed_route` with (task, model, modality, ...).
  3. Takes the rank-1 route's `(model_name, provider_ref)`.
  4. Rewrites the body: `model = "<resolved_model_name>"`.
  5. Proxies the request to a per-provider upstream URL (auto-detected).
  6. Returns the upstream's response verbatim to the caller.

If FED is unreachable, the middleware gracefully degrades: passes the
original `model: "fed-..."` string through unchanged to litellm-federation
at :4000 (which already routes `litellm-federation/agi-333`-style aliases).
This is the central architectural closure: opencode.json can declare
`model: "fed-reasoning-heavy"` and the federation decides per-call.

Service: systemd `fed-aware-middleware.service` listening on 127.0.0.1:4010.
Target port chosen (was free at 11:48 MYT 2026-08-11).

Revert: `systemctl stop fed-aware-middleware && rm /etc/systemd/system/fed-aware-middleware.service`.
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

FED_URL = os.environ.get("FED_URL", "http://127.0.0.1:7074")
LISTEN_HOST = os.environ.get("LISTEN_HOST", "127.0.0.1")
LISTEN_PORT = int(os.environ.get("LISTEN_PORT", "4010"))
REQUEST_TIMEOUT = float(os.environ.get("REQUEST_TIMEOUT", "30"))

# Provider URL registry — kept in sync with opencode.json provider definitions.
# When FED resolves (provider_name, model), we look up base_url here.
# Falls back to FED litellm-federation at :4000 if no specific mapping.
PROVIDER_BASE_URL = {
    "deepseek": "https://api.deepseek.com/v1",
    "deepseek-v4-pro": "https://api.deepseek.com/v1",  # alias
    "qwen-token-plan-individual": "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1",
    "qwen-token-plan": "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1",
    "bailian-token-plan": "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1",
    "minimax": "https://api.minimax.io/v1",
    "MiniMax": "https://api.minimax.io/v1",
    "mimo-platform": "https://token-plan-sgp.xiaomimimo.com/v1",
    "MiMo": "https://token-plan-sgp.xiaomimimo.com/v1",
    "opencode-go": "https://opencode.ai/zen/go/v1",
    "opencode-zen": "https://opencode.ai/zen/v1",
    "ollama": "http://127.0.0.1:11434/v1",
    "qwen-responses": "https://token-plan.ap-southeast-1.maas.aliyuncs.com/apps/anthropic",
    "anthropic": None,  # explicit anthropic passthrough — handled separately
    "google": None,  # Gemini uses URL path /v1/models/<model>
    "openai": "https://api.openai.com/v1",
    "xai": "https://api.x.ai/v1",
    "zhipu-z-ai": "https://open.bigmodel.cn/api/paas/v4",
    "moonshot": "https://api.moonshot.cn/v1",
    "zai": "https://api.z.ai/api/paas/v4",
    "litellm-federation": "http://127.0.0.1:4000/v1",
    # ── ZEN 2026-08-17: providers FED SOT actually returns (federation-models.json) ──
    "mulerouter": "https://api.mulerouter.ai/vendors/openai/v1",
    "kimi-moonshot": "https://api.kimi.com/coding/v1",
    "flame": "http://127.0.0.1:18901",
    "comfyui": None,  # local image runtime — never chat/completions
}

# Capability signatures this middleware understands (mirrors fed_router.py CAPABILITY_SIGNATURES).
CAPABILITY_PREFIXES = (
    # Slash-separated (opencode.json model: "fed/reasoning-heavy" etc.)
    "fed/reasoning-heavy",
    "fed/reasoning-standard",
    "fed/fast",
    "fed/vision",
    "fed/multimodal",
    "fed/long-context",
    "fed/agent-subagent",
    # Dash-separated (backward compat)
    "fed-reasoning-heavy",
    "fed-reasoning-standard",
    "fed-fast",
    "fed-vision",
    "fed-multimodal-vision",
    "fed-long-context",
    "fed-agent-subagent",
    "fed-realtime-voice",
    "fed-grounded-vision",
    "fed-inpainting",
    "fed-judge-deputy",
    "fed-local-uncensored",
    "fed-opencode-zen-cascade",
    "fed-image-generation",
    "fed-memory",
)

# ── ACTOR-ENVELOPE COMPAT LAYER (Stage 2, 2026-08-15) ─────────────────
# Doctrine: AAA/federation/FED_ACTOR_ENVELOPE_DOCTRINE.md
# "State is no longer topology." Legacy aliases are translated to the
# surviving actor/utility groups before any hop to :4000. SOT for this
# map: AAA/federation/fed_signatures.yaml → actor_geometry.compat_aliases.
ACTOR_ALIAS = {
    # edge persona pair collapse
    "hermes-asi": "i-arif",
    "i-arif-qualia": "i-arif",
    "zai-pro": "i-arif",
    "openclaw": "i-arif",
    # audit independence member
    "fed-audit-glm": "apex-888",
    # task lanes → actors
    "fed-reasoning-heavy": "agi-333",
    "fed/reasoning-heavy": "agi-333",
    "fed-long-context": "agi-333",
    "fed-agent-subagent": "agi-333",
    "dispatch": "agi-333",
    # fast lane collapsed into sovereign chat organ (Stage-2 envelope; SOT has no fed-fast cascade)
    "fed-fast": "i-arif",
    "fed/fast": "i-arif",
    "fed-multimodal-vision": "asi-555",
    "asi-555-audio": "fed/audio",
    "asi-555-video": "fed/audio",
    "fed-realtime-voice": "fed/audio",
    # FI mirrors → forge actor
    "opencode": "forge-777",
    "codex": "forge-777",
    "kimi-code": "forge-777",
    # raw gemini → judge cascade
    "gemini-flash-lite": "apex-888",
    "gemini-flash": "apex-888",
    "gemini-pro": "apex-888",
    # ── ZEN 2026-08-17: slash variants missing from Stage-2 map ─────
    # These fell through to the FED-route path which returned
    # (mulerouter, deepseek-v4-pro) → no base_url → raw model to :4000
    # → LiteLLM 400 "Invalid model name". Now they translate to actors
    # before any hop, matching fed/reasoning-heavy → agi-333.
    "fed/reasoning-standard": "agi-333",
    "fed-reasoning-standard": "agi-333",
    "fed/multimodal": "asi-555",
    "fed-multimodal": "asi-555",
    "fed/vision": "asi-555",
    "fed-vision": "asi-555",
    "fed/agent-subagent": "agi-333",
    "fed/long-context": "agi-333",
}

# ── ZEN 2026-08-17: resolved-model → actor fallback map ─────────────
# When FED returns a route whose provider has no base_url mapping, the
# middleware used to forward the RAW resolved model name to :4000, which
# LiteLLM rejects ("Invalid model name"). This map translates known model
# names to the surviving actor group so the fallback always lands on a
# valid :4000 alias. Covers every model in federation-models.json cascades.
MODEL_TO_ACTOR = {
    "deepseek-v4-pro": "agi-333",
    "deepseek-v4-flash": "agi-333",
    "qwen3.6-flash": "agi-333",
    "qwen3.7-plus": "agi-333",
    "qwen3.7-max": "agi-333",
    "qwen3.8-max": "agi-333",
    "qwen-vl-max": "asi-555",
    "qwen3-vl-plus": "asi-555",
    "qwen3-vl-flash": "asi-555",
    "qwen3-omni-flash": "asi-555",
    "qwen3-max": "agi-333",
    "MiniMax-M3": "agi-333",
    "MiniMax-M2.7": "agi-333",
    "MiniMax-M2.5": "agi-333",
    "mimo-v2.5": "asi-555",
    "mimo-v2.5-pro": "agi-333",
    "k3": "agi-333",
    "k3-256k": "agi-333",
    "kimi-k3": "agi-333",
    "kimi-k2.7-code": "forge-777",
    "kimi-k2.6": "agi-333",
    "kimi-k2.5": "agi-333",
    "kimi-for-coding": "forge-777",
    "kimi-for-coding-highspeed": "forge-777",
    "glm-5": "agi-333",
    "glm-5.1": "agi-333",
    "glm-5.2": "agi-333",
    "claude-sonnet-5": "apex-888",
    "claude-opus-5": "apex-888",
    "gpt-5.6-sol": "agi-333",
    "gpt-5.5": "agi-333",
    "gemini-2.5-flash": "apex-888",
    "gemini-3.6-flash": "apex-888",
}


def _translate_alias(model: str) -> str:
    """Rewrite legacy alias → surviving group. One hop, no chains."""
    return ACTOR_ALIAS.get(model, model)


# Provider → API-key env var mapping.
# When forwarding to <provider>, read the corresponding env var and use as Bearer token.
# F2 fix 2026-08-11 12:22 MYT: previously only OPENROUTER_API_KEY was checked, blocking all
# other providers (notably MiniMax which requires MINIMAX_API_KEY).
PROVIDER_API_KEY_ENV = {
    "minimax": "MINIMAX_API_KEY",
    "MiniMax": "MINIMAX_API_KEY",
    "deepseek": "DEEPSEEK_API_KEY",
    "deepseek-v4-pro": "DEEPSEEK_API_KEY",
    "qwen-token-plan-individual": "QWEN_INDIVIDUAL_API_KEY",
    "qwen-token-plan": "QWEN_TEAM_OWNER_API_KEY",
    "qwen-token-plan-team": "QWEN_TEAM_OWNER_API_KEY",
    "qwen-token-plan-arifos": "QWEN_ARIFOS_API_KEY",
    "qwen-token-plan-ariffazil": "QWEN_HERMES_API_KEY",
    "qwen-responses": "QWEN_API_KEY",
    "bailian-token-plan": "BAILIAN_PAYG_API_KEY",
    "mimo-platform": "MIMO_PLATFORM_API_KEY",
    "MiMo": "MIMO_PLATFORM_API_KEY",
    "mimo-token-plan": "MIMO_API_KEY",
    "opencode-go": "OPENCODE_API_KEY",
    "opencode-zen": "OPENCODE_API_KEY",
    "openai": "OPENAI_API_KEY",
    "xai": "XAI_API_KEY",
    "zhipu-z-ai": "ZHIPU_API_KEY",
    "moonshot": "MOONSHOT_API_KEY",
    "kimi-moonshot": "MOONSHOT_API_KEY",
    "mulerouter": "MULEROUTER_API_KEY",
    "flame": None,
    "zai": "ZAI_API_KEY",
    "google": "GEMINI_API_KEY",
}


def _resolve_api_key(provider_ref: str) -> str | None:
    """Look up the API key env var for a given provider. Returns None if not configured."""
    env_var = PROVIDER_API_KEY_ENV.get(provider_ref)
    if env_var:
        return os.environ.get(env_var)
    return None  # ZEN 2026-08-17: no legacy fallback


def _is_fed_capability(model: str) -> bool:
    return any(model.startswith(p) for p in CAPABILITY_PREFIXES)


# Bare model names from opencode.json's providers.fed.models keys.
# When opencode CLI picks one from the picker, it sends the bare name (e.g. "reasoning-heavy")
# to the provider baseURL. We auto-prefix with "fed/" so the capability resolver picks it up.
_FED_PROVIDER_BARE_MODELS = {
    # current opencode.json providers.fed.models keys
    "reasoning-heavy",
    "reasoning-standard",
    "fast",
    "vision",
    "multimodal",
}


# F2 ZEN fix 2026-08-11 12:36 MYT: absorbed from fed-clean-proxy (was :4001, now retired).
# Strips unsupported Responses API features (store=true, web_search tool) before forwarding
# to the LiteLLM gateway. This consolidates 2 proxies into 1 FED entry point at :4010.
def _strip_responses_features(body: bytes, content_type: str) -> bytes:
    """Strip store=true and web_search tool from Responses API request bodies."""
    if "application/json" not in (content_type or ""):
        return body
    try:
        data = json.loads(body.decode("utf-8"))
    except Exception:
        return body
    mutated = []
    if isinstance(data, dict) and data.get("store") is True:
        data["store"] = False
        mutated.append("store:true->false")
    if isinstance(data, dict) and isinstance(data.get("tools"), list):
        before = len(data["tools"])
        data["tools"] = [
            t
            for t in data["tools"]
            if not (isinstance(t, dict) and t.get("type") == "web_search")
        ]
        if len(data["tools"]) != before:
            mutated.append(f"web_search:dropped({before - len(data['tools'])})")
    if mutated:
        sys.stderr.write(
            f"[fed-aware-middleware] responses-stripped: {'+'.join(mutated)}\n"
        )
        return json.dumps(data, ensure_ascii=False).encode("utf-8")
    return body


def _call_fed_route(
    task: str,
    model: str,
    modality: str = "text",
    effort: str = "medium",
    tier: int = 333,
) -> dict[str, Any] | None:
    """Call FED direct HTTP route advisor at :7074/fed/route. Returns parsed routes or None.

    Avoids the JSON-RPC /mcp + session-handshake dance — uses the direct
    /fed/route endpoint forged for F13 Path B directive (2026-08-11).
    """
    payload = {
        "task": task,
        "model": model,
        "modality": modality,
        "effort_level": effort,
        "constitutional_tier": tier,
        "agent_id": "fed-aware-middleware",
    }
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{FED_URL}/fed/route",
        data=body,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as r:
            raw = r.read().decode("utf-8", errors="replace")
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as e:
        sys.stderr.write(f"[fed-aware-middleware] FED unreachable: {e}\n")
        return None
    try:
        d = json.loads(raw)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"[fed-aware-middleware] FED JSON parse: {e}\n")
        return None
    if "error" in d and "routes" not in d:
        sys.stderr.write(f"[fed-aware-middleware] FED error: {d['error']}\n")
        return None
    return d


def _select_target_route(result: dict[str, Any]) -> tuple[str, str] | None:
    """Return (model_name, provider_ref) for rank-1 healthy route, else None."""
    routes = (result or {}).get("routes") or []
    for r in routes:
        if r.get("health", "LIVE").upper() in ("DEAD",):
            continue
        m = r.get("model", "")
        p = r.get("provider", "")
        if m and p:
            return m, p
    return None


def _resolve_base_url(provider_ref: str) -> str | None:
    return PROVIDER_BASE_URL.get(provider_ref)


def _proxy_to(
    url: str, body_bytes: bytes, headers: dict[str, str], api_key: str | None = None
) -> tuple[int, dict[str, str], bytes]:
    """Forward an OpenAI-compatible POST and return (status, headers, body)."""
    hdrs = dict(headers)
    # F2 fix: remove hop-by-hop length headers case-insensitively —
    # urllib recomputes Content-Length from the (possibly rewritten) body
    for k in [k for k in hdrs if k.lower() == "content-length"]:
        hdrs.pop(k, None)
    # Without this, Akamai-fronted upstreams (e.g. api.minimax.io) reject with "Invalid URL [No Host]".
    # urllib's Request DOES auto-set Host from URL when not present, but defensive double-set
    # is bulletproof against future proxy middleware that may inject Host header.
    from urllib.parse import urlparse

    upstream_host = urlparse(url).netloc
    if upstream_host:
        hdrs["Host"] = upstream_host
    hdrs.pop("content-length", None)  # urllib sets this
    if api_key:
        hdrs["Authorization"] = f"Bearer {api_key}"
    req = urllib.request.Request(url, data=body_bytes, headers=hdrs, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as r:
            return r.status, dict(r.getheaders()), r.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read() if hasattr(e, "read") else b""
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        return (
            502,
            {"Content-Type": "application/json"},
            json.dumps(
                {"error": {"type": "upstream_unreachable", "message": str(e)}}
            ).encode(),
        )


class FedAwareMiddleware(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write(
            f"[fed-aware-middleware] {self.address_string()} {fmt % args}\n"
        )

    def _json(self, status: int, payload: Any):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Fed-Aware-Middleware", "1.0")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path in ("/", "/health", "/healthz"):
            self._json(
                200,
                {
                    "status": "healthy",
                    "service": "fed-aware-middleware",
                    "version": "1.0.0",
                    "federation_url": FED_URL,
                    "capabilities": list(CAPABILITY_PREFIXES),
                },
            )
            return
        # /v1/models: serve static list (FED :7074 lacks /v1/models - was 502). ZEN 2026-08-17.
        if self.path.startswith("/v1/models"):
            caps = [m.lstrip("fed/") for m in CAPABILITY_PREFIXES if "/" in m]
            data = {
                "object": "list",
                "data": [{"id": c, "object": "model", "owned_by": "fed"} for c in sorted(set(caps))],
            }
            self._json(200, data)
            return
        # Other /v1/* - pass through to FED if requested
        if self.path.startswith("/v1/"):
            try:
                with urllib.request.urlopen(
                    f"{FED_URL}{self.path}", timeout=REQUEST_TIMEOUT
                ) as r:
                    body = r.read()
                    self.send_response(r.status)
                    for k, v in r.headers.items():
                        if k.lower() not in ("transfer-encoding", "content-length"):
                            self.send_header(k, v)
                    self.send_header("Content-Length", str(len(body)))
                    self.send_header("X-Forwarded-By", "fed-aware-middleware")
                    self.end_headers()
                    self.wfile.write(body)
            except (urllib.error.URLError, TimeoutError) as e:
                self._json(502, {"error": {"message": str(e)}})
            return
        self._json(404, {"error": "not_found", "path": self.path})

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0:
            self._json(400, {"error": {"message": "empty body"}})
            return
        body_bytes = self.rfile.read(length)

        # F2 ZEN fix 2026-08-11 12:36 MYT: absorb fed-clean-proxy responsibilities.
        # /v1/responses (used by Codex CLI v0.146) sends store=true + web_search tool which
        # LiteLLM gateway can't handle. Strip them in-place before forwarding.
        # This retires :4001 fed-clean-proxy into :4010 fed-aware-middleware.
        if self.path.startswith("/v1/responses"):
            body_bytes = _strip_responses_features(
                body_bytes, self.headers.get("Content-Type", "")
            )

        # Parse body
        try:
            body = json.loads(body_bytes)
            if not isinstance(body, dict):
                raise ValueError("body is not an object")
        except Exception as e:
            # Pass raw body upstream if not JSON (some tools post raw strings)
            body = {"_raw": body_bytes.decode("utf-8", errors="replace")}

        # Find model name
        model = body.get("model", "") if isinstance(body, dict) else ""

        # ACTOR-ENVELOPE COMPAT (Stage 2): legacy alias → surviving actor group.
        # Applied before capability checks so fed-* lanes also land on actors,
        # and before passthrough so FI mirrors (codex/opencode/kimi-code)
        # resolve even when FED routing isn't involved.
        if model:
            translated = _translate_alias(model)
            if translated != model:
                body["model"] = translated
                model = translated
                # keep the forwarded payload in sync with the rewrite —
                # passthrough sends body_bytes, not the parsed dict
                body_bytes = json.dumps(body, ensure_ascii=False).encode("utf-8")
                sys.stderr.write(
                    f"[fed-aware-middleware] alias->actor: -> {translated}\n"
                )

        # F2 ZEN fix 2026-08-11 12:34 MYT: auto-prepend "fed/" when user picks a bare capability
        # name from the fed provider model picker. opencode.json's providers.fed.models keys are
        # bare (e.g. "reasoning-heavy") but opencode sends them AS-IS to the baseURL. Without this
        # auto-prefix, the model passes through to litellm :4000 which 400s with
        # "Invalid model name passed in model=reasoning-heavy".
        # F13 directive: "zen the FED, i create FED to reduce redundancies and contradictions and
        # to federate and unified the intelligence flow" — bare names must work, period.
        if (
            model
            and not model.startswith("fed/")
            and not model.startswith("fed-")
            and model in _FED_PROVIDER_BARE_MODELS
        ):
            model = f"fed/{model}"

        if _is_fed_capability(model):
            task = (
                body.get("_task", "opencode request")
                if isinstance(body, dict)
                else "opencode request"
            )
            modality = (
                body.get("_modality", "text") if isinstance(body, dict) else "text"
            )
            effort = (
                body.get("_effort", "medium") if isinstance(body, dict) else "medium"
            )
            tier = int(body.get("_tier", 333)) if isinstance(body, dict) else 333

            # F2 fix 2026-08-11 12:27 MYT: normalize "fed/X" -> "fed-X" before calling fed_router.
            # OpenCode sends slash-separated (matches fed/reasoning-heavy in providers.fed.models)
            # but fed_router CAPABILITY_SIGNATURES uses dash-separated (fed-reasoning-heavy).
            # Without normalization, fed_router fails to resolve capability and silently falls
            # back to MODEL_ROUTES["deepseek-v4-pro"] — the quota-exhausted 429 path.
            fed_route_model = model.replace("/", "-") if "/" in model else model

            result = _call_fed_route(
                task=task,
                model=fed_route_model,
                modality=modality,
                effort=effort,
                tier=tier,
            )
            target = _select_target_route(result) if result else None

            if target:
                resolved_model, resolved_provider = target
                base_url = _resolve_base_url(resolved_provider)
                if base_url:
                    # Rewrite model in body and forward
                    body["model"] = resolved_model
                    # Remove routing-only fields if present
                    for k in ("_task", "_modality", "_effort", "_tier"):
                        body.pop(k, None)
                    forward_body = json.dumps(body).encode("utf-8")
                    # F2 fix 2026-08-11 12:24 MYT: look up the correct API key for the resolved
                    # provider. OpenCode's "fed" provider sends a placeholder " FED" auth which
                    # upstream rejects with 401. We translate per-provider using PROVIDER_API_KEY_ENV.
                    provider_api_key = _resolve_api_key(resolved_provider)
                    if not provider_api_key:
                        self._forward_to_litellm(
                            forward_body, self.headers, resolved_model, resolved_provider, model
                        )
                        return
                    status, hdrs, resp_body = _proxy_to(
                        base_url.rstrip("/") + "/chat/completions",
                        forward_body,
                        {
                            k: v
                            for k, v in self.headers.items()
                            if k.lower()
                            not in (
                                "transfer-encoding",
                                "content-length",
                                "server",
                                "authorization",  # drop fed's placeholder auth
                            )
                        },
                        provider_api_key,
                    )
                    self.send_response(status)
                    for k, v in hdrs.items():
                        if k.lower() not in (
                            "transfer-encoding",
                            "content-length",
                            "server",
                        ):
                            self.send_header(k, v)
                    self.send_header("Content-Length", str(len(resp_body)))
                    self.send_header("X-Fed-Resolved-Model", resolved_model)
                    self.send_header("X-Fed-Resolved-Provider", resolved_provider)
                    self.send_header("X-Fed-Original-Capability", model)
                    self.end_headers()
                    self.wfile.write(resp_body)
                    return
                else:
                    # No base URL mapping → fallback to FED litellm at :4000
                    body["model"] = resolved_model
                    forward_body = json.dumps(body).encode("utf-8")
                    self._forward_to_litellm(
                        forward_body,
                        self.headers,
                        resolved_model,
                        resolved_provider,
                        model,
                    )
                    return
            else:
                # FED didn't return a usable route — graceful fallback:
                # forward with the original fed-* signature to FED litellm-federation :4000
                # which already handles litellm aliases for agi-333 / asi-555 / etc.
                forward_body = json.dumps(body).encode("utf-8")
                self._forward_to_litellm(
                    forward_body, self.headers, model, "fed-fallback", model
                )
                return

        # Not a fed-* capability — pass through to FED litellm-federation :4000
        # (allows OpenCode CLI's regular providers to keep working when model: is static)
        forward_body = body_bytes
        self._forward_to_litellm(
            forward_body, self.headers, model, "passthrough", model
        )

    def _forward_to_litellm(
        self, body_bytes, headers, resolved_model, resolved_provider, original_cap
    ):
        # ZEN 2026-08-17: raw model name -> actor alias so :4000 never 400s.
        if resolved_model not in ("agi-333", "asi-555", "forge-777", "apex-888", "i-arif"):
            alias = MODEL_TO_ACTOR.get(resolved_model)
            if alias:
                try:
                    payload = json.loads(body_bytes)
                    if isinstance(payload, dict) and payload.get("model") == resolved_model:
                        payload["model"] = alias
                        body_bytes = json.dumps(payload).encode("utf-8")
                        sys.stderr.write(
                            "[fed-aware-middleware] model->actor fallback: %s -> %s\n"
                            % (resolved_model, alias)
                        )
                except Exception:
                    pass
        # F2 fix 2026-08-21 (FI-003): preserve Responses API path. Codex CLI
        # (wire_api=responses) posts /v1/responses bodies with no `messages` key —
        # forwarding them to chat/completions made litellm's Router.acompletion()
        # raise TypeError -> HTTP 500. :4000 serves /v1/responses natively.
        litellm_target = (
            "http://127.0.0.1:4000/v1/responses"
            if self.path.startswith("/v1/responses")
            else "http://127.0.0.1:4000/v1/chat/completions"
        )
        status, hdrs, resp_body = _proxy_to(
            litellm_target,
            body_bytes,
            {k: v for k, v in headers.items()},
            None,
        )
        self.send_response(status)
        for k, v in hdrs.items():
            if k.lower() not in ("transfer-encoding", "content-length", "server"):
                self.send_header(k, v)
        self.send_header("Content-Length", str(len(resp_body)))
        self.send_header("X-Fed-Resolved-Model", str(resolved_model))
        self.send_header("X-Fed-Resolved-Provider", str(resolved_provider))
        self.send_header("X-Fed-Original-Capability", str(original_cap))
        self.end_headers()
        self.wfile.write(resp_body)


def main():
    addr = (LISTEN_HOST, LISTEN_PORT)
    srv = ThreadingHTTPServer(addr, FedAwareMiddleware)
    sys.stderr.write(
        f"[fed-aware-middleware] listening on http://{LISTEN_HOST}:{LISTEN_PORT} "
        f"(FED={FED_URL})\n"
    )
    sys.stderr.flush()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        sys.stderr.write("[fed-aware-middleware] shutting down\n")
        srv.shutdown()


if __name__ == "__main__":
    main()
