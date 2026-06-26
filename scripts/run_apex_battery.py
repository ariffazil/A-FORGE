#!/usr/bin/env python3
"""
APEX Falsification Battery v1 — Runner

Usage:
    python run_apex_battery.py --config apex_battery_config.yaml [--execute]

Default mode is dry-run: no external API calls are made.
Use --execute only after sealing the protocol in VAULT999 and confirming keys.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

import requests
import yaml


def load_config(path: str) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_probes(path: str) -> list[dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def call_openai(endpoint: str, key: str, model: str, prompt: str, timeout: int = 60) -> dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
    }
    t0 = time.time()
    resp = requests.post(endpoint, headers=headers, json=payload, timeout=timeout)
    latency_ms = int((time.time() - t0) * 1000)
    resp.raise_for_status()
    data = resp.json()
    content = ""
    if "choices" in data and data["choices"]:
        message = data["choices"][0].get("message", {})
        content = message.get("content", "")
    usage = data.get("usage", {})
    return {
        "response": content,
        "latency_ms": latency_ms,
        "status": resp.status_code,
        "prompt_tokens": usage.get("prompt_tokens", 0),
        "completion_tokens": usage.get("completion_tokens", 0),
        "total_tokens": usage.get("total_tokens", 0),
    }


def call_anthropic(endpoint: str, key: str, model: str, prompt: str, timeout: int = 60) -> dict[str, Any]:
    headers = {
        "x-api-key": key,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
    }
    payload = {
        "model": model,
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
    }
    t0 = time.time()
    resp = requests.post(endpoint, headers=headers, json=payload, timeout=timeout)
    latency_ms = int((time.time() - t0) * 1000)
    resp.raise_for_status()
    data = resp.json()
    content = ""
    if "content" in data and data["content"]:
        content = data["content"][0].get("text", "")
    usage = data.get("usage", {})
    return {
        "response": content,
        "latency_ms": latency_ms,
        "status": resp.status_code,
        "prompt_tokens": usage.get("input_tokens", 0),
        "completion_tokens": usage.get("output_tokens", 0),
        "total_tokens": usage.get("input_tokens", 0) + usage.get("output_tokens", 0),
    }


def call_kernel_via_mcporter(server: str, tool: str, prompt: str, timeout: int = 60) -> dict[str, Any]:
    """Route a probe through arifOS MCP using mcporter."""
    args_json = json.dumps({"query": prompt})
    cmd = ["mcporter", "call", f"{server}.{tool}", "--args", args_json, "--output", "json"]
    t0 = time.time()
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        latency_ms = int((time.time() - t0) * 1000)
        output = result.stdout.strip()
        try:
            parsed = json.loads(output)
        except json.JSONDecodeError:
            parsed = {"raw": output}
        return {
            "response": output,
            "parsed": parsed,
            "latency_ms": latency_ms,
            "status": result.returncode,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        }
    except subprocess.TimeoutExpired:
        return {
            "response": "",
            "parsed": {"error": "mcporter timeout"},
            "latency_ms": timeout * 1000,
            "status": -1,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        }


def direct_call(model_cfg: dict[str, Any], prompt: str) -> dict[str, Any]:
    key = os.environ.get(model_cfg["key_env"], "")
    if not key and "localhost" not in model_cfg["endpoint"]:
        raise RuntimeError(f"Missing API key for {model_cfg['model_name']}: {model_cfg['key_env']}")
    fmt = model_cfg.get("format", "openai")
    if fmt == "openai":
        return call_openai(model_cfg["endpoint"], key, model_cfg["model_name"], prompt)
    if fmt == "anthropic":
        return call_anthropic(model_cfg["endpoint"], key, model_cfg["model_name"], prompt)
    raise ValueError(f"Unknown format: {fmt}")


def dry_run_response(condition: str, probe: dict[str, Any]) -> dict[str, Any]:
    """Generate a deterministic placeholder response for dry-run mode."""
    if condition == "direct":
        return {
            "response": f"[DRY-RUN] Direct response placeholder for {probe['probe_id']}",
            "latency_ms": 100,
            "status": 200,
            "prompt_tokens": len(probe["prompt"].split()),
            "completion_tokens": 12,
            "total_tokens": len(probe["prompt"].split()) + 12,
        }
    return {
        "response": "",
        "parsed": {"verdict": "HOLD", "claim_state": "HYPOTHESIS"},
        "latency_ms": 2,
        "status": 0,
        "prompt_tokens": len(probe["prompt"].split()),
        "completion_tokens": 0,
        "total_tokens": len(probe["prompt"].split()),
    }


def run_battery(config: dict[str, Any], probes: list[dict[str, Any]], execute: bool) -> list[dict[str, Any]]:
    receipts: list[dict[str, Any]] = []
    models = config.get("models", {})
    kernel_cfg = config.get("kernel", {})
    kernel_server = kernel_cfg.get("mcporter_server", "arifOS")
    kernel_tool = kernel_cfg.get("tool", "arif_mind_reason")

    for model_id, model_cfg in models.items():
        family = model_cfg.get("family", "unknown")
        print(f"\n[MODEL] {model_id} ({family})")
        for probe in probes:
            # Direct condition
            print(f"  D {probe['probe_id']}", end=" ", flush=True)
            if execute:
                try:
                    direct = direct_call(model_cfg, probe["prompt"])
                except Exception as e:
                    direct = {"response": "", "error": str(e), "latency_ms": 0, "status": -1, "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
            else:
                direct = dry_run_response("direct", probe)
            print(f"{direct.get('status')} {direct.get('latency_ms')}ms")

            receipts.append({
                "model_id": model_id,
                "model_family": family,
                "condition": "direct",
                "probe_id": probe["probe_id"],
                "dial": probe["dial"],
                "floor": probe["floor"],
                "severity": probe["severity"],
                "prompt": probe["prompt"],
                "response": direct.get("response", ""),
                "error": direct.get("error"),
                "latency_ms": direct.get("latency_ms", 0),
                "status": direct.get("status", 0),
                "prompt_tokens": direct.get("prompt_tokens", 0),
                "completion_tokens": direct.get("completion_tokens", 0),
                "total_tokens": direct.get("total_tokens", 0),
            })

            # Kernel condition
            print(f"  K {probe['probe_id']}", end=" ", flush=True)
            if execute:
                kernel = call_kernel_via_mcporter(kernel_server, kernel_tool, probe["prompt"])
            else:
                kernel = dry_run_response("kernel", probe)
            print(f"{kernel.get('status')} {kernel.get('latency_ms')}ms")

            receipts.append({
                "model_id": model_id,
                "model_family": family,
                "condition": "kernel",
                "probe_id": probe["probe_id"],
                "dial": probe["dial"],
                "floor": probe["floor"],
                "severity": probe["severity"],
                "prompt": probe["prompt"],
                "response": kernel.get("response", ""),
                "parsed": kernel.get("parsed"),
                "error": kernel.get("error"),
                "latency_ms": kernel.get("latency_ms", 0),
                "status": kernel.get("status", 0),
                "prompt_tokens": kernel.get("prompt_tokens", 0),
                "completion_tokens": kernel.get("completion_tokens", 0),
                "total_tokens": kernel.get("total_tokens", 0),
            })

    return receipts


def summarize(receipts: list[dict[str, Any]]) -> dict[str, Any]:
    total = len(receipts)
    direct = [r for r in receipts if r["condition"] == "direct"]
    kernel = [r for r in receipts if r["condition"] == "kernel"]
    errors = [r for r in receipts if r.get("error")]
    return {
        "total_receipts": total,
        "direct_receipts": len(direct),
        "kernel_receipts": len(kernel),
        "errors": len(errors),
        "total_tokens": sum(r["total_tokens"] for r in receipts),
        "avg_latency_ms": sum(r["latency_ms"] for r in receipts) / max(total, 1),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="APEX Falsification Battery v1")
    parser.add_argument("--config", default="apex_battery_config.yaml", help="Path to config YAML")
    parser.add_argument("--execute", action="store_true", help="Make real API calls (default: dry-run)")
    args = parser.parse_args()

    config = load_config(args.config)
    probes_path = config["protocol"]["probes_file"]
    if not Path(probes_path).is_absolute():
        probes_path = str(Path(args.config).parent / probes_path)
    probes = load_probes(probes_path)

    output_dir = Path(config["protocol"]["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)

    if not args.execute:
        print("=== DRY-RUN MODE: no external API calls will be made ===")
    else:
        print("=== EXECUTE MODE: real API calls will be made ===")
        if config.get("vault", {}).get("seal_protocol_before_run"):
            print("Ensure protocol is sealed in VAULT999 before proceeding.")

    receipts = run_battery(config, probes, execute=args.execute)

    receipts_path = output_dir / "receipts.jsonl"
    with open(receipts_path, "w", encoding="utf-8") as f:
        for r in receipts:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    summary = summarize(receipts)
    summary_path = output_dir / "summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    print("\n=== SUMMARY ===")
    print(json.dumps(summary, indent=2))
    print(f"\nReceipts written to: {receipts_path}")
    print(f"Summary written to: {summary_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
