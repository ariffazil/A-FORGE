#!/usr/bin/env python3
"""FED Route Weights — the loop-closer (points 1+2+4 of the FED future-state).

333-AGI, 2026-09-12. This is the ACTUATOR that fed_router.py's advisory signals
were missing. It reads token_bank.db (route_health, providers.balance_usd,
route_latency, token_bank_spend) and emits a canonical weight state that closes
the loop:

  fed_quota_sentinel (witness) ──► token_bank.db ──► THIS (weights) ──► litellm reload

It does NOT mutate litellm itself (F1: witness-first; the reload is the governed
boundary). Output: /root/.local/share/arifos/fed_route_weights.json

Weights are derived, not asserted:
  - route_health.status == 'DEAD'/'DEGRADED'  -> demote (weight 0 / 0.3)
  - providers.balance_usd < $0.50             -> demote (starvation guard)
  - route_latency p95 > 3000ms                -> cap (0.5)
  - recent spend concentration                 -> surfaced, not acted (sovereign)
"""

import sqlite3, json, time, os

DB = "/root/.local/share/arifos/token_bank.db"
OUT = "/root/.local/share/arifos/fed_route_weights.json"
NOW = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

rows = {}
con = sqlite3.connect(DB)
con.row_factory = sqlite3.Row

# 1. health status per provider+model
for r in con.execute(
    "SELECT provider_name, model_id, status, degraded_since FROM route_health"
):
    key = (r["provider_name"], r["model_id"])
    rows.setdefault(key, {})["health"] = r["status"]

# 2. balance per provider
bal = {
    r["provider_name"]: r["balance_usd"]
    for r in con.execute("SELECT provider_name, balance_usd FROM providers")
}

# 3. latency per provider+model
for r in con.execute("SELECT provider_name, model_id, p95_ms FROM route_latency"):
    key = (r["provider_name"], r["model_id"])
    rows.setdefault(key, {})["p95_ms"] = r["p95_ms"]

# 4. recent spend (last 24h)
spend = con.execute(
    "SELECT provider_name, SUM(estimated_cost_usd) AS usd, SUM(tokens_out) AS tok "
    "FROM token_bank_spend WHERE called_at > datetime('now','-1 day') "
    "GROUP BY provider_name ORDER BY usd DESC"
).fetchall()
con.close()

weights = {
    "computed_at_utc": NOW,
    "demote": [],
    "cap": [],
    "promote": [],
    "spend_24h": [],
    "balances": {},
}
seen = set()
for (p, m), v in rows.items():
    h = v.get("health", "LIVE")
    lat = v.get("p95_ms")
    if h in ("DEAD", "DEGRADED"):
        if (p, m) not in seen:
            weights["demote"].append({"provider": p, "model": m, "why": f"health={h}"})
            seen.add((p, m))
    elif lat and lat > 3000:
        weights["cap"].append({"provider": p, "model": m, "why": f"p95={lat}ms"})

# balance=$0 is structural for subscription token-plans (minimax, mimo,
# qwen-token-plan-*, opencode-*). Only PAYG providers demote on low balance.
SUBSCRIPTION = {
    "minimax",
    "mimo-token-plan",
    "mimo-platform",
    "qwen-token-plan-team",
    "qwen-token-plan-individual",
    "opencode-zen",
    "opencode-go",
    "kimi-moonshot",
    "kimi-coding",
}
for p, b in sorted(bal.items(), key=lambda x: x[1]):
    weights["balances"][p] = round(b, 4)
    if b < 0.5 and p not in SUBSCRIPTION and p not in seen:
        weights["demote"].append(
            {"provider": p, "model": "*", "why": f"balance=${b:.2f}"}
        )

for r in spend:
    weights["spend_24h"].append(
        {
            "provider": r["provider_name"],
            "usd": round(r["usd"] or 0, 4),
            "tokens_out": r["tok"] or 0,
        }
    )

# promote = LIVE providers NOT in demote/cap (implicitly the healthy set)
demoted = {d["provider"] for d in weights["demote"]}
capped = {c["provider"] for c in weights["cap"]}
for p in bal:
    if p not in demoted and p not in capped:
        weights["promote"].append(p)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(weights, open(OUT, "w"), indent=1)
print(
    json.dumps(
        {
            "computed_at": NOW,
            "demote": len(weights["demote"]),
            "cap": len(weights["cap"]),
            "promote": len(weights["promote"]),
            "top_spend_24h": weights["spend_24h"][:5],
            "demotions": weights["demote"][:20],
        },
        indent=1,
    )
)
