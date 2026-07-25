#!/usr/bin/env python3
"""
flame_client.py — Thin FLAME bridge for A-FORGE CLI/script use.

Pattern: identical to GEOX and arifOS flame_client.py.
HTTP POST to :18901 with task_class routing, graceful degradation, ADVISORY authority.

Usage:
    from tools.flame_client import flame_infer, flame_extract

    result = flame_extract("parse this error: ...")
    if result["ok"]: print(result["content"])

DITEMPA BUKAN DIBERI — Forged, Not Given.
"""

from __future__ import annotations

import json
import logging
import sys
import urllib.request
import urllib.error
from typing import Any

logger = logging.getLogger("aforge.flame_client")

FLAME_API = "http://127.0.0.1:18901"
TIMEOUT_S = 8
MAX_CHARS = 8000


def _post(endpoint: str, payload: dict) -> dict[str, Any] | None:
    body = json.dumps(payload).encode()
    if len(body) > MAX_CHARS * 4:
        body = body[: MAX_CHARS * 4]
    req = urllib.request.Request(
        endpoint if endpoint.startswith("http") else f"{FLAME_API}{endpoint}",
        data=body,
        headers={"Content-Type": "application/json", "Caller-Id": "aforge"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        logger.warning("FLAME A-FORGE %s: %s", endpoint, str(e)[:150])
        return None


def flame_infer(
    prompt: str,
    task_class: str = "extract",
    system: str = "",
) -> dict[str, Any]:
    """Run inference via FLAME with task-class routing.

    Args:
        prompt: Self-contained prompt
        task_class: classify | summarize | extract | coding | draft_plan | observe
        system: Optional system prompt override

    Returns:
        Dict with ok, content, model, provider, latency_ms, authority
    """
    full_prompt = f"{system}\n\n{prompt}" if system else prompt
    result = _post("/summarize", {
        "text": full_prompt[:MAX_CHARS],
        "task_type": task_class,
        "caller_id": "aforge",
        "sensitivity": "PUBLIC",
    })
    if result and result.get("ok"):
        return {
            "ok": True,
            "content": result.get("content", ""),
            "model": result.get("model", "unknown"),
            "provider": result.get("provider", "unknown"),
            "latency_ms": result.get("latency_ms", 0),
            "authority": "ADVISORY",
        }
    return {"ok": False, "content": "", "authority": "ADVISORY", "error": str(result or "FLAME unavailable")}


def flame_extract(code_context: str, schema: dict | None = None) -> dict[str, Any]:
    """Extract structured data from code context via FLAME.

    Args:
        code_context: Code block, error trace, or text to parse
        schema: Optional JSON schema for structured output

    Returns:
        Dict with ok, content (parsed data string), authority
    """
    prompt = f"Extract structured information from:\n\n{code_context[:3000]}"
    if schema:
        prompt += f"\n\nOutput MUST match schema: {json.dumps(schema)}"
    return flame_infer(prompt, task_class="extract",
                        system="You are a code extraction specialist. Extract facts only. Do not add external knowledge.")


def flame_diagnose(error_trace: str) -> dict[str, Any]:
    """Classify and diagnose an error/log trace via FLAME.

    Args:
        error_trace: Error message, stack trace, or log lines

    Returns:
        Dict with ok, content (diagnosis), model, authority
    """
    prompt = f"Diagnose this error:\n\n{error_trace[:3000]}"
    return flame_infer(prompt, task_class="classify",
                        system="You are a diagnostic engine. Classify the error type, identify root cause, suggest fix.")


def flame_summarize(text: str) -> dict[str, Any]:
    """Summarize text via FLAME.

    Args:
        text: Text to summarize

    Returns:
        Dict with ok, content (summary), authority
    """
    return flame_infer(text[:MAX_CHARS], task_class="summarize",
                        system="Summarize concisely. Retain key facts. No opinions.")


def flame_draft_plan(intent: str, context: str = "") -> dict[str, Any]:
    """Draft an execution plan via FLAME — ADVISORY only, never auto-executes.

    F1 AMANAH: This is a draft only. plan must pass arif_judge before execution.

    Args:
        intent: What the plan should accomplish
        context: Optional context (constraints, resources, risks)

    Returns:
        Dict with ok, content (draft plan), authority=ADVISORY
    """
    prompt = f"Intent: {intent[:1500]}"
    if context:
        prompt += f"\nContext: {context[:1500]}"
    prompt += "\n\nProduce a structured execution plan with: steps, risks, reversibility check."
    return flame_infer(prompt, task_class="draft_plan",
                        system="You are a plan drafter. Produce ADVISORY drafts only. "
                               "Never auto-execute. Tag every step as reversible or irreversible.")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["infer", "extract", "diagnose", "summarize", "draft"], default="infer")
    parser.add_argument("--task-class", default="extract")
    parser.add_argument("input", nargs="?", help="Input text or - for stdin")
    args = parser.parse_args()

    text = args.input if args.input else sys.stdin.read()
    if args.mode == "extract":
        r = flame_extract(text)
    elif args.mode == "diagnose":
        r = flame_diagnose(text)
    elif args.mode == "summarize":
        r = flame_summarize(text)
    elif args.mode == "draft":
        r = flame_draft_plan(text)
    else:
        r = flame_infer(text, task_class=args.task_class)
    print(json.dumps(r, indent=2))
