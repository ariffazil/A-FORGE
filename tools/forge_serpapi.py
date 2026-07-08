#!/usr/bin/env python3
"""
forge_serpapi — Universal SERP API dispatcher for arifOS federation.
107 engines, one gateway, governed execution with budget tracking.

Usage:
    python3 forge_serpapi.py --engine google_finance --query "PCHEM:KLSE"
    python3 forge_serpapi.py --engine google_scholar --query "petroleum geology" --params '{"as_ylo": 2020}'
    python3 forge_serpapi.py --engine bing_copilot --query "GDP by country, table"
    python3 forge_serpapi.py --engine google_maps --query "geology consultant Kuala Lumpur"
    python3 forge_serpapi.py --budget  # Check remaining credits

DITEMPA BUKAN DIBERI — Forged, Not Given.
"""

import json
import os
import sys
import time
import hashlib
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

# === CONFIGURATION ===
SERPAPI_BASE = "https://serpapi.com/search.json"
BUDGET_FILE = "/root/A-FORGE/tools/.serpapi_budget.json"
AUDIT_LOG = "/root/A-FORGE/forge_work/serpapi_audit.jsonl"
SKILL_FILE = "/root/.agents/skills/serpapi-intelligence/SKILL.md"

# === ENGINE REGISTRY — 107 engines mapped to domains ===
ENGINE_DOMAINS = {
    # SEARCH
    "google": "search",
    "google_light": "search",
    "google_ai_mode": "search",
    "google_ai_overview": "search",
    "bing": "search",
    "bing_copilot": "search",
    "brave_ai_mode": "search",
    "duckduckgo": "search",
    "yahoo": "search",
    "yandex": "search",
    "baidu": "search",
    "naver": "search",
    "naver_ai_overview": "search",
    # FINANCE
    "google_finance": "finance",
    "google_finance_markets": "finance",
    # COMMERCE
    "google_shopping": "commerce",
    "google_shopping_light": "commerce",
    "google_immersive_product": "commerce",
    "amazon": "commerce",
    "amazon_product": "commerce",
    "ebay": "commerce",
    "ebay_product": "commerce",
    "walmart": "commerce",
    "walmart_product": "commerce",
    "walmart_reviews": "commerce",
    "bing_shopping": "commerce",
    "bing_product": "commerce",
    "yahoo_shopping": "commerce",
    "home_depot": "commerce",
    "home_depot_product": "commerce",
    "home_depot_reviews": "commerce",
    # LOCAL
    "google_maps": "local",
    "google_maps_reviews": "local",
    "google_maps_contributor_reviews": "local",
    "google_maps_photos": "local",
    "google_maps_posts": "local",
    "google_maps_autocomplete": "local",
    "google_maps_directions": "local",
    "google_local": "local",
    "google_local_services": "local",
    "bing_maps": "local",
    "duckduckgo_maps": "local",
    "apple_maps": "local",
    "apple_places": "local",
    "yelp": "local",
    "yelp_place": "local",
    "yelp_reviews": "local",
    "tripadvisor": "local",
    "tripadvisor_place": "local",
    "tripadvisor_reviews": "local",
    "opentable": "local",
    # ACADEMIC
    "google_scholar": "academic",
    "google_scholar_author": "academic",
    "google_scholar_case_law": "academic",
    "google_patents": "academic",
    "google_patents_details": "academic",
    # MEDIA
    "google_videos": "media",
    "google_videos_light": "media",
    "google_images": "media",
    "google_images_light": "media",
    "google_short_videos": "media",
    "google_lens": "media",
    "google_reverse_image": "media",
    "bing_videos": "media",
    "bing_images": "media",
    "bing_reverse_image": "media",
    "yahoo_videos": "media",
    "yahoo_images": "media",
    "yandex_images": "media",
    "yandex_videos": "media",
    "youtube": "media",
    "youtube_video": "media",
    "youtube_transcript": "media",
    # NEWS
    "google_news": "news",
    "google_news_light": "news",
    "bing_news": "news",
    "duckduckgo_news": "news",
    "baidu_news": "news",
    # TRAVEL
    "google_flights": "travel",
    "google_flights_autocomplete": "travel",
    "google_flights_deals": "travel",
    "google_hotels": "travel",
    "google_hotels_autocomplete": "travel",
    "google_hotels_photos": "travel",
    "google_hotels_reviews": "travel",
    "google_travel_explore": "travel",
    # APPS
    "google_play_store": "apps",
    "google_play_games": "apps",
    "google_play_movies": "apps",
    "google_play_books": "apps",
    "google_play_product": "apps",
    "apple_app_store": "apps",
    "apple_app_store_reviews": "apps",
    "apple_app_store_product": "apps",
    # SPORTS
    "google_sports": "sports",
    # TRENDS
    "google_trends": "trends",
    "google_trends_autocomplete": "trends",
    "google_trends_trending_now": "trends",
    # ADS
    "google_ads": "ads",
    "google_ads_transparency": "ads",
    # SOCIAL
    "facebook_profile": "social",
    "instagram_profile": "social",
    # KNOWLEDGE
    "google_autocomplete": "knowledge",
    "google_related_questions": "knowledge",
    "google_events": "knowledge",
}

# Credits per engine type
CREDIT_COST = {
    "bing_copilot": 2,  # AI-synthesized answers cost more
}
DEFAULT_CREDIT_COST = 1


def load_budget():
    """Load or initialize budget tracker."""
    if os.path.exists(BUDGET_FILE):
        with open(BUDGET_FILE) as f:
            return json.load(f)
    return {
        "month": datetime.now(timezone.utc).strftime("%Y-%m"),
        "total_limit": 250,
        "used": 0,
        "calls": [],
        "by_domain": {},
        "by_engine": {},
    }


def save_budget(budget):
    """Persist budget tracker."""
    os.makedirs(os.path.dirname(BUDGET_FILE), exist_ok=True)
    with open(BUDGET_FILE, "w") as f:
        json.dump(budget, f, indent=2)


def check_budget_reset(budget):
    """Reset budget if new month."""
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")
    if budget.get("month") != current_month:
        budget["month"] = current_month
        budget["used"] = 0
        budget["calls"] = []
        budget["by_domain"] = {}
        budget["by_engine"] = {}
    return budget


def log_audit(engine, domain, query, credits_used, status, result_keys, error=None):
    """Append to audit log."""
    os.makedirs(os.path.dirname(AUDIT_LOG), exist_ok=True)
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "engine": engine,
        "domain": domain,
        "query": query[:200],
        "credits": credits_used,
        "status": status,
        "result_keys": result_keys[:10] if result_keys else [],
        "error": error,
    }
    with open(AUDIT_LOG, "a") as f:
        f.write(json.dumps(entry) + "\n")


def call_serpapi(engine, query, params=None):
    """Execute SERP API call."""
    api_key = os.environ.get("SERPAPI_API_KEY")
    if not api_key:
        return {"error": "SERPAPI_API_KEY not set in environment"}

    # Build request
    req_params = {
        "engine": engine,
        "q": query,
        "api_key": api_key,
    }
    if params:
        req_params.update(params)

    url = f"{SERPAPI_BASE}?{urllib.parse.urlencode(req_params)}"

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "forge-serpapi/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        return {"error": f"HTTP {e.code}: {body[:500]}"}
    except urllib.error.URLError as e:
        return {"error": f"URL error: {e.reason}"}
    except Exception as e:
        return {"error": f"Unexpected: {str(e)}"}


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="forge_serpapi — Universal SERP API dispatcher"
    )
    parser.add_argument("--engine", "-e", help="Engine name (107 available)")
    parser.add_argument("--query", "-q", help="Search query")
    parser.add_argument("--params", "-p", help="Additional params as JSON string")
    parser.add_argument(
        "--domain", "-d", help="Domain hint for logging (auto-detected if omitted)"
    )
    parser.add_argument("--budget", action="store_true", help="Show budget status")
    parser.add_argument(
        "--engines", action="store_true", help="List all available engines"
    )
    parser.add_argument(
        "--compact", action="store_true", help="Return compact result (key fields only)"
    )
    args = parser.parse_args()

    # Budget check
    if args.budget:
        budget = check_budget_reset(load_budget())
        remaining = budget["total_limit"] - budget["used"]
        print(
            json.dumps(
                {
                    "month": budget["month"],
                    "total_limit": budget["total_limit"],
                    "used": budget["used"],
                    "remaining": remaining,
                    "pct_used": round(budget["used"] / budget["total_limit"] * 100, 1),
                    "by_domain": budget.get("by_domain", {}),
                    "by_engine": budget.get("by_engine", {}),
                    "last_5_calls": budget.get("calls", [])[-5:],
                },
                indent=2,
            )
        )
        return

    # Engine list
    if args.engines:
        by_domain = {}
        for eng, dom in sorted(ENGINE_DOMAINS.items()):
            by_domain.setdefault(dom, []).append(eng)
        for dom, engines in sorted(by_domain.items()):
            print(f"\n{dom.upper()} ({len(engines)}):")
            for e in engines:
                cost = CREDIT_COST.get(e, DEFAULT_CREDIT_COST)
                print(f"  {e} ({cost}cr)")
        return

    # Validate
    if not args.engine or not args.query:
        parser.error("--engine and --query are required (or use --budget / --engines)")

    engine = args.engine.lower().strip()
    query = args.query.strip()

    # Validate engine
    if engine not in ENGINE_DOMAINS:
        print(
            json.dumps(
                {
                    "error": f"Unknown engine: {engine}",
                    "hint": "Run with --engines to see all 107 available engines",
                    "similar": [e for e in ENGINE_DOMAINS if engine[:4] in e][:5],
                },
                indent=2,
            )
        )
        sys.exit(1)

    domain = args.domain or ENGINE_DOMAINS[engine]
    credits_needed = CREDIT_COST.get(engine, DEFAULT_CREDIT_COST)

    # Budget check
    budget = check_budget_reset(load_budget())
    remaining = budget["total_limit"] - budget["used"]
    if remaining < credits_needed:
        print(
            json.dumps(
                {
                    "error": "BUDGET_EXHAUSTED",
                    "remaining": remaining,
                    "needed": credits_needed,
                    "month": budget["month"],
                    "hint": "Budget resets next month, or upgrade plan at serpapi.com",
                },
                indent=2,
            )
        )
        sys.exit(1)

    # Parse extra params
    extra_params = {}
    if args.params:
        try:
            extra_params = json.loads(args.params)
        except json.JSONDecodeError:
            print(json.dumps({"error": f"Invalid JSON in --params: {args.params}"}))
            sys.exit(1)

    # Execute
    start = time.time()
    result = call_serpapi(engine, query, extra_params)
    elapsed = round(time.time() - start, 2)

    # Check for errors
    if "error" in result:
        log_audit(engine, domain, query, 0, "error", [], result["error"])
        print(
            json.dumps(
                {"error": result["error"], "engine": engine, "elapsed_s": elapsed},
                indent=2,
            )
        )
        sys.exit(1)

    # Update budget
    budget["used"] += credits_needed
    budget["calls"].append(
        {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "engine": engine,
            "domain": domain,
            "query": query[:100],
            "credits": credits_needed,
        }
    )
    budget["by_domain"][domain] = budget["by_domain"].get(domain, 0) + credits_needed
    budget["by_engine"][engine] = budget["by_engine"].get(engine, 0) + credits_needed
    save_budget(budget)

    # Audit log
    result_keys = list(result.keys()) if isinstance(result, dict) else []
    log_audit(engine, domain, query, credits_needed, "success", result_keys)

    # Compact mode — return only key fields
    if args.compact:
        compact = {"engine": engine, "domain": domain, "elapsed_s": elapsed}
        if "search_metadata" in result:
            compact["status"] = result["search_metadata"].get("status")
        if "organic_results" in result:
            compact["results_count"] = len(result["organic_results"])
            compact["top_results"] = [
                {"title": r.get("title"), "link": r.get("link")}
                for r in result["organic_results"][:3]
            ]
        if "summary" in result:
            compact["summary"] = result["summary"]
        if "local_results" in result:
            compact["places_count"] = len(result["local_results"])
            compact["top_places"] = [
                {
                    "title": r.get("title"),
                    "rating": r.get("rating"),
                    "address": r.get("address"),
                }
                for r in result["local_results"][:3]
            ]
        if "jobs_results" in result:
            compact["jobs_count"] = len(result["jobs_results"])
        if "video_results" in result:
            compact["videos_count"] = len(result["video_results"])
        if "shopping_results" in result:
            compact["products_count"] = len(result["shopping_results"])
        if "profile_results" in result:
            compact["profile"] = {
                k: result["profile_results"].get(k)
                for k in [
                    "full_name",
                    "followers",
                    "following",
                    "posts_count",
                    "is_verified",
                    "biography",
                ]
                if k in result["profile_results"]
            }
        compact["budget_remaining"] = budget["total_limit"] - budget["used"]
        print(json.dumps(compact, indent=2))
        return

    # Full result + metadata
    result["_forge_meta"] = {
        "engine": engine,
        "domain": domain,
        "credits_used": credits_needed,
        "budget_remaining": budget["total_limit"] - budget["used"],
        "elapsed_s": elapsed,
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
