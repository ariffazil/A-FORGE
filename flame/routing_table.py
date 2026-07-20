"""
FLAME Routing Table — live model routing from health probes + hit-rate tracking.

Replaces static tiers[] in flame_config.json with a dynamic table rebuilt
from live health probes. Routes are resolved per-request based on:
  - Required capabilities (chat, embed, vision, bm-native)
  - Cost band (RM0 gate)
  - Current health (healthy > degraded > down)
  - Weight (hit_rate / latency)

FORGED: 2026-07-20 by FORGE (000Ω)
DITEMPA BUKAN DIBERI
"""

import time
import threading
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Route:
    """A single model route in the live routing table."""

    route_id: str  # "groq/llama-3.1-8b-instant"
    provider: str  # "groq"
    model: str  # "llama-3.1-8b-instant"
    endpoint: str  # "https://api.groq.com/openai/v1"
    cost_band: str  # "free" | "paid"
    capabilities: set[str] = field(default_factory=lambda: {"chat"})

    # ── Live metrics (updated by health probes) ──
    health: str = "unknown"  # healthy | degraded | down | rate_limited
    avg_latency_ms: float = 0.0
    hit_rate: float = 1.0  # 0.0–1.0
    last_probe_at: str = ""

    # ── Routing state ──
    weight: float = 0.0  # derived: hit_rate / (avg_latency_ms + 1)
    cooldown_until: float = 0.0  # epoch seconds — skip until

    # ── Stats ──
    total_calls: int = 0
    total_success: int = 0
    total_fail: int = 0
    total_safety_refuse: int = 0


class RoutingTable:
    """Dynamic routing table rebuilt from health probes.

    Thread-safe. Resolve() returns ordered eligible routes per-request.
    """

    def __init__(self):
        self.routes: dict[str, Route] = {}
        self._lock = threading.Lock()

    # ── Registration ──────────────────────────────────────────────────────

    def register(self, route: Route):
        """Add or update a route definition (capabilities, endpoint, etc.)."""
        with self._lock:
            existing = self.routes.get(route.route_id)
            if existing:
                # Preserve live metrics, update static fields
                existing.endpoint = route.endpoint
                existing.cost_band = route.cost_band
                existing.capabilities = route.capabilities
            else:
                self.routes[route.route_id] = route

    def remove(self, route_id: str):
        with self._lock:
            self.routes.pop(route_id, None)

    # ── Health Updates ────────────────────────────────────────────────────

    def update_health(
        self,
        route_id: str,
        health: str,
        latency_ms: float,
        hit_rate: float,
    ):
        """Update live metrics from a health probe or call result."""
        with self._lock:
            route = self.routes.get(route_id)
            if not route:
                return
            route.health = health
            route.avg_latency_ms = latency_ms
            route.hit_rate = hit_rate
            route.last_probe_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            route.weight = hit_rate / (latency_ms + 1.0) if latency_ms >= 0 else 0.0

    def mark_down(self, route_id: str, reason: str = ""):
        with self._lock:
            route = self.routes.get(route_id)
            if route:
                route.health = "down"

    def mark_rate_limited(self, route_id: str, cooldown_seconds: int = 60):
        with self._lock:
            route = self.routes.get(route_id)
            if route:
                route.health = "rate_limited"
                route.cooldown_until = time.time() + cooldown_seconds

    def record_call(self, route_id: str, success: bool, safety_refuse: bool = False):
        with self._lock:
            route = self.routes.get(route_id)
            if not route:
                return
            route.total_calls += 1
            if success:
                route.total_success += 1
            else:
                route.total_fail += 1
            if safety_refuse:
                route.total_safety_refuse += 1

    # ── Resolution ────────────────────────────────────────────────────────

    def resolve(
        self,
        required_capabilities: Optional[set[str]] = None,
        max_cost: str = "free",
        exclude: Optional[set[str]] = None,
    ) -> list[Route]:
        """Return ordered list of eligible routes for a request.

        Order: healthy first, then by weight descending.
        Excludes: down/rate_limited routes, wrong capabilities, wrong cost.
        """
        if required_capabilities is None:
            required_capabilities = {"chat"}
        if exclude is None:
            exclude = set()

        now = time.time()
        cost_order = {"free": 0, "paid": 1}
        max_cost_val = cost_order.get(max_cost, 0)

        with self._lock:
            eligible = []
            for route in self.routes.values():
                # Exclusion checks
                if route.route_id in exclude:
                    continue
                if route.cooldown_until > now:
                    continue
                if route.health == "down":
                    continue
                if not required_capabilities.issubset(route.capabilities):
                    continue
                if cost_order.get(route.cost_band, 999) > max_cost_val:
                    continue

                eligible.append(route)

            # Sort: healthy > degraded > rate_limited, then by weight desc
            health_rank = {"healthy": 0, "unknown": 1, "degraded": 2, "rate_limited": 3}
            eligible.sort(key=lambda r: (health_rank.get(r.health, 99), -r.weight))
            return eligible

    # ── Introspection ─────────────────────────────────────────────────────

    def list_all(self) -> list[dict]:
        """Return all routes as dicts (for API /probe, /routes)."""
        with self._lock:
            return [
                {
                    "route_id": r.route_id,
                    "provider": r.provider,
                    "model": r.model,
                    "cost_band": r.cost_band,
                    "capabilities": list(r.capabilities),
                    "health": r.health,
                    "avg_latency_ms": r.avg_latency_ms,
                    "hit_rate": round(r.hit_rate, 3),
                    "weight": round(r.weight, 4),
                    "total_calls": r.total_calls,
                    "total_success": r.total_success,
                    "last_probe_at": r.last_probe_at,
                }
                for r in self.routes.values()
            ]

    def snapshot(self) -> dict:
        """Return a snapshot of the full routing table state."""
        return {
            "routes": self.list_all(),
            "snapshot_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "total_routes": len(self.routes),
        }

    # ── Bootstrap from config ─────────────────────────────────────────────

    @classmethod
    def from_config(
        cls, config: dict, chain_id: str = "RM0-TOOLS-FREELOOP"
    ) -> "RoutingTable":
        """Build a RoutingTable from flame_config.json chain + providers."""
        table = cls()
        chain = config["chains"].get(
            chain_id, config["chains"].get("RM0-TOOLS-FREELOOP", {})
        )
        providers = config.get("providers", {})

        for tier in chain.get("tiers", []):
            provider_name = tier["provider"]
            model = tier["model"]
            route_id = f"{provider_name}/{model}"
            provider_cfg = providers.get(provider_name, {})
            tags = set(tier.get("tags", []))

            # Map tags to capabilities
            capabilities = {"chat"}
            if "embed" in tags:
                capabilities.add("embed")
            if "vision" in tags or "multimodal" in tags:
                capabilities.add("vision")
            if "bm-native" in tags or "malay" in tags:
                capabilities.add("bm-native")

            route = Route(
                route_id=route_id,
                provider=provider_name,
                model=model,
                endpoint=provider_cfg.get("base_url", ""),
                cost_band=provider_cfg.get("cost_band", "free"),
                capabilities=capabilities,
                weight=float(tier.get("weight", 5)),
                health="unknown",
            )
            table.register(route)

        return table
