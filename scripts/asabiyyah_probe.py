#!/usr/bin/env python3
"""asabiyyah_probe — A-FORGE organ self-reading for the federation cycle instrument.

A-FORGE is the EXECUTION organ (the hands): it owns the mutation primitives the
rest of the federation calls. Its primary cycle signal is therefore ENC
(enforcement coverage), the Kerkoporta signature -- Byzantium 1453 fell through
one unguarded postern, not a breached wall. One ungated mutation path is enough.

  CER = ceremony_artifacts / exercised_capabilities   -> Luxury signature
  ASD = executors / doctrine_holders                  -> Kafes signature
  ENC = gated_paths / total_paths                     -> Kerkoporta signature

Method (every count traces to a real file/port on disk; nothing is estimated):

  CER  live .md doctrine (archive/backups/node_modules/.git/.venv/dist/build and
       other vendored/generated trees excluded) vs distinct A-FORGE primitives
       with a real invocation receipt inside the observation window.
  ASD  attempted from data/gateway_receipts.jsonl. Those receipts carry NO
       actor identity field -> NOT_APPLICABLE. The missing actor field is
       itself the finding: a receipt without an actor is an event, not a
       causal-ledger entry. A non-aggregated proxy from the policy-gate log is
       recorded in evidence for a human, never fed to the ratio.
  ENC  mutation primitives enumerated from (a) the LIVE MCP registry of the
       running service and (b) the classifier's own mode-aware mutation blocks
       -- i.e. A-FORGE's actual tool definitions, not a doc. Gate presence is
       then verified per ENTRYPOINT by reading the dispatching module and
       counting reference-monitor call sites. A primitive is GATED only if
       EVERY live entrypoint that can dispatch it evaluates the policy gate
       (complete mediation). If one entrypoint reaches the whole registry
       without the gate, the primitive is ungated and the entrypoint is named.

Complete mediation is the test, not blocked-attempt counts: 99% coverage is not
"almost complete", it is one open postern. See
/root/AAA/instructions/authority-envelope.md.

READ-ONLY against the repository. The only write is the reading drop-file.
No third-party dependencies. Standard library only.

Usage:
    python3 /root/A-FORGE/scripts/asabiyyah_probe.py            # write + print
    python3 /root/A-FORGE/scripts/asabiyyah_probe.py --no-write # print only
"""

from __future__ import annotations

import argparse
import datetime as _dt
import importlib.util
import json
import os
import re
import socket
import sys
import time
import urllib.request
from pathlib import Path

ORGAN = "A-FORGE"
REPO = Path("/root/A-FORGE")
DROP_DIR = Path("/var/lib/arifos/asabiyyah")
KERNEL_PATH = "/root/arifOS/arifosmcp/runtime/asabiyyah.py"
SCHEMA_PATH = Path("/root/AAA/schemas/asabiyyah-reading.schema.json")

WINDOW_DAYS = 30
LIVE_MCP_URL = "http://127.0.0.1:7072/mcp"

GATE_LOG = REPO / "logs" / "mcp_policy_gate.log"
RECEIPTS = REPO / "data" / "gateway_receipts.jsonl"
CLASSIFIER = REPO / "src" / "domain" / "governance" / "actionClassifier.ts"

# Doctrine trees that are vendored, stale, cached or generated — not live doctrine.
CER_EXCLUDE_DIRS = {
    "archive", "archived", "_backups", "backups", "node_modules",
    ".git", ".venv", "venv", "dist", "build", ".ua", "vendor",
    ".next", "out", ".pytest_cache", "__pycache__",
}

# Modules that dispatch MCP tool calls. Gate presence is verified by reading them.
DISPATCH_MODULES = {
    "serve": REPO / "src" / "interfaces" / "mcp" / "serve.ts",
    "core": REPO / "src" / "interfaces" / "mcp" / "core.ts",
    "server": REPO / "src" / "interfaces" / "server.ts",
}

# Real MCP client configs on this host that launch A-FORGE themselves.
STDIO_CLIENT_CONFIGS = (
    Path("/root/.hermes/config.yaml"),
    Path("/root/.config/1mcp/mcp.json"),
)

SYSTEMD_DIR = Path("/etc/systemd/system")

MUTATION_CLASSES = {"EXECUTE_REVERSIBLE", "EXECUTE_HIGH_IMPACT", "IRREVERSIBLE"}

# A-FORGE mutation primitives grouped by the capability class the organ exposes.
# Labels only -- the counts come from the enumerated primitives, never this table.
CAPABILITY_CLASSES = {
    "shell_exec": ("forge_shell", "forge_execute", "forge_sandbox_run"),
    "file_write": ("forge_filesystem", "forge_skillstore_write", "forge_stage",
                   "forge_sheets", "forge_calendar"),
    "file_delete": ("forge_filesystem",),
    "git_commit_push": ("forge_git", "forge_git_commit",
                        "forge_github_create_or_update_file"),
    "deploy": ("forge_dispatch_lane", "forge_pipeline_run", "forge_execute_sealed",
               "forge_cool", "forge_compile_task"),
    "service_restart": ("forge_shell", "forge_docker", "forge_kernel"),
    "database_write": ("forge_postgres",),
    "vault_seal": ("forge_seal", "forge_seal_run", "forge_visual_seal", "forge_vault",
                   "forge_canonize"),
}


def load_kernel():
    """Load the shared instrument standalone. Never vendor a copy."""
    spec = importlib.util.spec_from_file_location("asabiyyah", KERNEL_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load kernel at {KERNEL_PATH}")
    mod = importlib.util.module_from_spec(spec)
    # dataclasses resolve cls.__module__ through sys.modules; without this
    # registration exec_module raises AttributeError on the first @dataclass.
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def _host() -> str:
    return socket.gethostname() or "unknown"


def _read(path: Path) -> str:
    try:
        return path.read_text(errors="ignore")
    except OSError:
        return ""


def _iso_utc(ts: str):
    try:
        return _dt.datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def _cutoff(days: int):
    return _dt.datetime.now(_dt.timezone.utc) - _dt.timedelta(days=days)


def _block_from_brace(text: str, open_idx: int) -> str:
    """Text of the brace-delimited block whose opening brace is at open_idx."""
    if open_idx < 0 or open_idx >= len(text) or text[open_idx] != "{":
        return ""
    depth = 0
    for j in range(open_idx, len(text)):
        if text[j] == "{":
            depth += 1
        elif text[j] == "}":
            depth -= 1
            if depth == 0:
                return text[open_idx:j + 1]
    return text[open_idx:]


# ---------------------------------------------------------------------------
# CER inputs
# ---------------------------------------------------------------------------

def count_ceremony_artifacts(repo: Path = REPO) -> dict:
    """Live .md doctrine. Excludes archive/backups/vendored/generated trees."""
    total = 0
    by_top: dict[str, int] = {}
    for root, dirs, files in os.walk(repo):
        dirs[:] = [d for d in dirs if d not in CER_EXCLUDE_DIRS]
        rel = os.path.relpath(root, repo)
        top = rel.split(os.sep)[0] if rel != "." else "<root>"
        for f in files:
            if f.endswith(".md"):
                total += 1
                by_top[top] = by_top.get(top, 0) + 1
    # Narrower doctrine-only reading, recorded for transparency but NOT used as
    # the CER numerator (the contract's exclusion list is the stated definition).
    narrow = sum(n for k, n in by_top.items()
                 if k in ("docs", "governance", "skills", "specs", "workflows", "<root>"))
    return {
        "total": total,
        "narrow_doctrine_only": narrow,
        "top_dirs": sorted(by_top.items(), key=lambda kv: -kv[1])[:8],
    }


def read_gate_log(path: Path = GATE_LOG, window_days: int = WINDOW_DAYS) -> dict:
    """Policy-gate decisions. ALLOW == the call was permitted to reach a handler."""
    verdicts: dict[str, int] = {}
    allow_tools, any_tools = set(), set()
    allow_actors: dict[str, int] = {}
    total = 0
    timestamps: list[str] = []
    for line in _read(path).splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            d = json.loads(line)
        except json.JSONDecodeError:
            continue
        total += 1
        ts = d.get("timestamp") or ""
        if ts:
            timestamps.append(ts)
        t = _iso_utc(ts)
        if t is None or t < _cutoff(window_days):
            continue
        v = d.get("verdict") or "UNKNOWN"
        verdicts[v] = verdicts.get(v, 0) + 1
        name = d.get("tool_name")
        if name:
            any_tools.add(name)
            if v == "ALLOW":
                allow_tools.add(name)
                a = d.get("actor_id") or "<null>"
                allow_actors[a] = allow_actors.get(a, 0) + 1
    return {
        "lines_total": total,
        "lines_in_window": sum(verdicts.values()),
        "verdicts_in_window": verdicts,
        "allow_tools_in_window": sorted(allow_tools),
        "any_tools_in_window": sorted(any_tools),
        "allow_actors_in_window": sorted(allow_actors.items(), key=lambda kv: -kv[1]),
        "ts_first": min(timestamps) if timestamps else "",
        "ts_last": max(timestamps) if timestamps else "",
        "path": str(path),
    }


def read_receipts(path: Path = RECEIPTS, window_days: int = WINDOW_DAYS) -> dict:
    """Invocation receipts. Source for exercised capability + actor presence."""
    total = with_actor = 0
    tools_window, tools_all, keys = set(), set(), set()
    timestamps: list[str] = []
    for line in _read(path).splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            d = json.loads(line)
        except json.JSONDecodeError:
            continue
        total += 1
        keys.update(d.keys())
        if any(k in d for k in ("actor_id", "actor", "actorId", "principal", "caller")):
            with_actor += 1
        name = d.get("tool")
        if name:
            tools_all.add(name)
        ts = d.get("timestamp") or ""
        if ts:
            timestamps.append(ts)
        t = _iso_utc(ts)
        if name and t is not None and t >= _cutoff(window_days):
            tools_window.add(name)
    return {
        "lines_total": total,
        "lines_with_actor_field": with_actor,
        "tools_in_window": sorted(tools_window),
        "tools_all_time": sorted(tools_all),
        "field_names": sorted(keys),
        "ts_first": min(timestamps) if timestamps else "",
        "ts_last": max(timestamps) if timestamps else "",
        "path": str(path),
    }


# ---------------------------------------------------------------------------
# ENC inputs — primitives
# ---------------------------------------------------------------------------

_MODE_AWARE_RE = re.compile(r'if\s*\(\s*toolName\s*===\s*"([a-z0-9_]+)"\s*\)\s*\{')
_RETURN_CLASS_RE = re.compile(
    r'return\s+"(OBSERVE|SUGGEST|SIMULATE|DRAFT|QUEUE|'
    r'EXECUTE_REVERSIBLE|EXECUTE_HIGH_IMPACT|IRREVERSIBLE)"'
)
_SET_RE = re.compile(r"const\s+([A-Z_]+)\s*=\s*new\s+Set\(\[(.*?)\]\)", re.S)
_NAME_RE = re.compile(r'"([a-z0-9_]+)"')


def read_classifier(path: Path | None = None) -> dict:
    """Parse A-FORGE's own mutation declarations out of its classifier source."""
    path = path or CLASSIFIER
    text = _read(path)

    explicit_sets = {
        name: sorted(set(_NAME_RE.findall(body)))
        for name, body in _SET_RE.findall(text)
    }

    mode_aware: dict[str, list] = {}
    for m in _MODE_AWARE_RE.finditer(text):
        tool = m.group(1)
        block = _block_from_brace(text, m.end() - 1)  # m matched the '{' itself
        mode_aware[tool] = sorted(set(_RETURN_CLASS_RE.findall(block)))

    mode_aware_mutating = sorted(
        t for t, cs in mode_aware.items() if set(cs) & MUTATION_CLASSES
    )
    declared = set()
    for k in ("IRREVERSIBLE_TOOLS", "HIGH_IMPACT_TOOLS", "REVERSIBLE_EXEC_TOOLS"):
        declared.update(explicit_sets.get(k, []))

    return {
        "path": str(path),
        "explicit_sets": explicit_sets,
        "declared_mutation_names": sorted(declared),
        "mode_aware_tools": mode_aware,
        "mode_aware_mutating": mode_aware_mutating,
    }


def live_registry(url: str = LIVE_MCP_URL, timeout: float = 8.0) -> dict:
    """Read the LIVE tool registry of the running service (read-only)."""
    payload = json.dumps(
        {"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}
    ).encode()
    req = urllib.request.Request(
        url, data=payload,
        headers={"Content-Type": "application/json", "X-Compact": "1"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = json.loads(r.read().decode("utf-8", "replace"))
    except Exception as e:  # noqa: BLE001 - any failure: fall back and say so
        return {"ok": False, "error": f"{type(e).__name__}: {e}", "tools": {}, "url": url}
    tools = {}
    for t in (body.get("result") or {}).get("tools") or []:
        meta = (t.get("_meta") or {}).get("io.modelcontextprotocol/affordance") or {}
        tools[t.get("name")] = meta.get("action_class")
    return {"ok": bool(tools), "error": "", "tools": tools, "url": url}


def enumerate_primitives(registry: dict, classifier: dict) -> dict:
    """Mutation primitives = live registry base class + mode-aware declarations."""
    live = registry.get("tools") or {}
    base_mut = sorted(n for n, c in live.items() if c in MUTATION_CLASSES)
    mode_mut = sorted(classifier.get("mode_aware_mutating", []))
    primitives = sorted(set(base_mut) | set(mode_mut))
    return {
        "registry_tools_total": len(live),
        "registry_available": bool(registry.get("ok")),
        "registry_url": registry.get("url", LIVE_MCP_URL),
        "registry_error": registry.get("error", ""),
        "base_mutation_class": base_mut,
        "mode_aware_mutation": mode_mut,
        "mode_aware_beyond_base_class": sorted(set(mode_mut) - set(base_mut)),
        "primitives": primitives,
    }


# ---------------------------------------------------------------------------
# ENC inputs — entrypoints and gate presence
# ---------------------------------------------------------------------------

def _gate_call_sites(text: str) -> int:
    """Reference-monitor evaluation call sites (definition excluded).

    The monitor decides in exactly two shapes:
        evaluatePolicyGate(<args>)          -- the serve.ts wrapper
        <gate>.evaluate({ ... })            -- the monitor itself
    """
    calls = len(re.findall(r"(?<!function )evaluatePolicyGate\s*\(", text))
    calls += len(re.findall(r"\.evaluate\s*\(\s*\{", text))
    return calls


def stdio_branch_report(serve_path: Path | None = None) -> dict:
    """serve.ts has two dispatch branches; the gate lives in only one of them."""
    serve_path = serve_path or DISPATCH_MODULES["serve"]
    text = _read(serve_path)
    m = re.search(r'if\s*\(\s*transportType\s*===\s*"stdio"\s*\)\s*\{', text)
    if not m:
        return {"found": False, "stdio_gate_call_sites": 0, "http_gate_call_sites": 0}
    block = _block_from_brace(text, m.end() - 1)
    stdio_sites = _gate_call_sites(block)
    return {
        "found": True,
        "stdio_branch_head": [ln.strip() for ln in block.strip().splitlines()[:4]],
        "stdio_connects_sdk": "server.connect(" in block,
        "stdio_gate_call_sites": stdio_sites,
        "http_gate_call_sites": _gate_call_sites(text) - stdio_sites,
        "gate_call_sites_file_total": _gate_call_sites(text),
    }


def read_stdio_clients() -> list:
    """Real client configs on this host that launch A-FORGE over stdio."""
    out = []
    for p in STDIO_CLIENT_CONFIGS:
        text = _read(p)
        if not text:
            continue
        if "A-FORGE/dist/src/interfaces/mcp/cli.js" in text and "--transport" in text:
            out.append(str(p))
    return out


def _aforge_units() -> list:
    """systemd units whose ExecStart itself runs an A-FORGE binary."""
    out = []
    if not SYSTEMD_DIR.is_dir():
        return out
    for p in sorted(SYSTEMD_DIR.glob("*.service")):
        text = _read(p)
        for ln in text.splitlines():
            s = ln.strip()
            if not s.startswith("ExecStart"):
                continue
            body = s.split("=", 1)[1].strip().lstrip("-+")
            if "/root/A-FORGE" not in body:
                continue
            out.append({"unit": p.name, "exec": body, "path": str(p)})
    return out


def classify_exec(exec_line: str) -> dict:
    """Map a real ExecStart line onto the dispatching module + transport."""
    if "interfaces/mcp/cli.js" in exec_line or "interfaces/mcp/cli.ts" in exec_line:
        if "--transport stdio" in exec_line or "--transport=stdio" in exec_line:
            return {"kind": "mcp_dispatch", "module": "serve", "transport": "stdio",
                    "port": None,
                    "dispatch": "McpServer.connect(StdioServerTransport) [SDK]"}
        m = re.search(r"--port[= ](\d+)", exec_line)
        return {"kind": "mcp_dispatch", "module": "serve", "transport": "http",
                "port": int(m.group(1)) if m else 3000,
                "dispatch": "HTTP POST /mcp -> tools/call handler"}
    if "interfaces/mcp/stdio" in exec_line or "interfaces/mcp/server.js" in exec_line:
        return {"kind": "mcp_dispatch", "module": "core", "transport": "stdio",
                "port": None,
                "dispatch": "McpServer.connect(StdioServerTransport) [SDK]"}
    if "interfaces/server.js" in exec_line or "interfaces/server.ts" in exec_line:
        return {"kind": "mcp_dispatch", "module": "server", "transport": "http",
                "port": 7071,
                "dispatch": "POST /mcp router (mounts core MCP server) + POST /execute dispatch"}
    return {"kind": "host_path", "module": "unknown", "transport": "unknown",
            "port": None, "dispatch": "A-FORGE process that does not dispatch MCP tool calls"}


def host_path_gate_check(exec_line: str) -> dict:
    """For a non-dispatch A-FORGE process: does the script it runs touch the gate?"""
    m = re.search(r"(/[^\s]*/root/A-FORGE/[^\s]+)", exec_line)
    if not m:
        m = re.search(r"(\S*?/root/A-FORGE/\S+)", exec_line)
    target = m.group(1) if m else ""
    path = Path(target) if target else None
    text = _read(path) if path and path.is_file() else ""
    hits = sum(
        text.count(tok)
        for tok in ("mcp_policy_gate", "McpPolicyGate", "evaluatePolicyGate")
    )
    return {
        "script": str(path) if path else "",
        "script_exists": bool(path and path.is_file()),
        "gate_references": hits,
        "dispatches_mcp_tools": False,
    }


def enumerate_entrypoints() -> dict:
    """Build the real entrypoint list, then verify gate presence in each."""
    stdio = stdio_branch_report()
    entrypoints, host_paths = [], []
    seen = set()

    for unit in _aforge_units():
        cls = classify_exec(unit["exec"])
        if cls["kind"] != "mcp_dispatch":
            host_paths.append({"unit": unit["unit"], "exec": unit["exec"],
                               "kind": "host_path",
                               **host_path_gate_check(unit["exec"])})
            continue
        key = (cls["module"], cls["transport"], cls["port"])
        if key in seen:
            continue
        seen.add(key)
        entrypoints.append({**cls, "unit": unit["unit"], "live_clients": []})

    clients = read_stdio_clients()
    if clients and ("serve", "stdio", None) not in seen:
        entrypoints.append({
            "kind": "mcp_dispatch", "module": "serve", "transport": "stdio",
            "port": None, "unit": "<mcp-client-config>",
            "dispatch": "McpServer.connect(StdioServerTransport) [SDK]",
            "live_clients": clients,
        })
    elif clients:
        for ep in entrypoints:
            if ep["module"] == "serve" and ep["transport"] == "stdio":
                ep["live_clients"] = clients

    for ep in entrypoints:
        if ep["transport"] == "stdio":
            sites = stdio["stdio_gate_call_sites"]
            where = "stdio branch"
        elif ep["module"] == "serve":
            sites = stdio["http_gate_call_sites"]
            where = "HTTP tools/call dispatch path"
        else:
            sites = _gate_call_sites(
                _read(DISPATCH_MODULES.get(ep["module"], Path("/nonexistent")))
            )
            where = "dispatch path"
        ep["gate_call_sites"] = sites
        ep["gated"] = sites > 0
        ep["where_checked"] = where
        ep["module_path"] = str(DISPATCH_MODULES.get(ep["module"], "?"))
        ep["id"] = (f"{ep['transport']}:{ep['port']}" if ep["port"]
                    else f"{ep['transport']}")
        ep["close_target"] = (
            f"{ep['id']} ({ep['unit']}) -> {ep['module_path']} {where}: "
            f"{sites} policy-gate call site(s)"
        )

    return {"entrypoints": entrypoints, "host_paths": host_paths,
            "stdio_branch": stdio, "stdio_clients": clients}


def capability_coverage(primitives: list) -> dict:
    pset = set(primitives)
    return {k: sorted(set(v) & pset) for k, v in CAPABILITY_CLASSES.items()}


# ---------------------------------------------------------------------------
# reading
# ---------------------------------------------------------------------------

def build_reading() -> tuple:
    asb = load_kernel()
    ts = _now()

    ceramic = count_ceremony_artifacts()
    gate = read_gate_log()
    rec = read_receipts()
    classifier = read_classifier()
    registry = live_registry()
    prim = enumerate_primitives(registry, classifier)
    eps = enumerate_entrypoints()
    coverage = capability_coverage(prim["primitives"])

    registry_names = set(registry.get("tools") or {})
    exercised_raw = set(gate["allow_tools_in_window"]) | set(rec["tools_in_window"])
    exercised = sorted(exercised_raw & registry_names) if registry_names else sorted(exercised_raw)
    outside_registry = sorted(exercised_raw - registry_names)

    # ── ENC ──────────────────────────────────────────────────────────────
    # A primitive is gated iff EVERY live MCP-dispatch entrypoint that can
    # dispatch it evaluates the gate. All dispatch entrypoints share one
    # registry (serve.ts and server.ts both mount the core MCP server), so an
    # ungated entrypoint reaches every primitive.
    primitives = prim["primitives"]
    dispatching = [e for e in eps["entrypoints"] if e["kind"] == "mcp_dispatch"]
    ungated_eps = [e for e in dispatching if not e["gated"]]
    gated_eps = [e for e in dispatching if e["gated"]]

    if not primitives:
        enc = asb.Metric.na(
            "enc",
            "no mutation primitives enumerated: live MCP registry unreachable and no "
            "mode-aware mutation declarations parsed from the classifier",
        )
        gated_paths = 0
        ungated_names = []
    else:
        gated_paths = 0 if ungated_eps else len(primitives)
        ungated_names = [e["close_target"] for e in ungated_eps]
        enc = asb.enforcement_coverage(
            gated_paths, len(primitives),
            source=(
                f"{prim['registry_tools_total']} live tools @ {prim['registry_url']} "
                f"(tools/list) + mode-aware mutation blocks in {classifier['path']}; "
                f"gate presence verified by reading the dispatching modules "
                f"({', '.join(sorted({e['module_path'] for e in dispatching}))})"
            ),
            observed_at=ts, ungated=ungated_names,
        )
        enc.notes = (
            f"{gated_paths}/{len(primitives)} primitives gated on EVERY live MCP-dispatch "
            f"entrypoint. {len(gated_eps)} gated, {len(ungated_eps)} ungated: "
            + "; ".join(e["id"] for e in ungated_eps)
        )

    # ── CER ──────────────────────────────────────────────────────────────
    ceremony = ceramic["total"]
    cer = asb.ceremony_exercise_ratio(
        ceremony, len(exercised),
        source=(
            f"{ceremony} live .md under {REPO} (excl. "
            f"{', '.join(sorted(CER_EXCLUDE_DIRS))}) vs {len(exercised)} A-FORGE "
            f"primitives with a real invocation receipt in {WINDOW_DAYS}d "
            f"(gate-log ALLOW within registry "
            f"{len(set(gate['allow_tools_in_window']) & registry_names)} + "
            f"gateway_receipts {len(set(rec['tools_in_window']) & registry_names)})"
        ),
        observed_at=ts,
    )
    cer.notes = (
        f"doctrine-only subset (docs/governance/skills/specs/workflows/root) = "
        f"{ceramic['narrow_doctrine_only']} .md; top dirs {ceramic['top_dirs']}"
    )

    # ── ASD ──────────────────────────────────────────────────────────────
    asd = asb.Metric.na(
        "asd",
        f"{RECEIPTS} carries no actor identity field: 0 of {rec['lines_total']} receipts "
        f"have actor_id/actor/principal/caller. Executors are therefore unidentified; "
        f"any executor count would be invented, so ASD is NOT_APPLICABLE.",
    )
    asd.notes = (
        "NOT_APPLICABLE is the reading, not a gap: a receipt without an actor is an event, "
        "not a causal-ledger entry. Non-aggregated proxy from the policy-gate log (which "
        f"does carry actor_id): {len(gate['allow_actors_in_window'])} distinct actor_id on "
        f"ALLOW in {WINDOW_DAYS}d. Caveat: the stdio entrypoints write nothing to the gate "
        "log, so this proxy under-counts real executors and must not be federated as a number."
    )

    evidence = {
        # ── raw additive integers the kernel aggregates ──
        "ceremony_artifacts": ceremony,
        "exercised_capabilities": len(exercised),
        "gated_paths": gated_paths,
        "total_paths": len(primitives),
        "ungated": ungated_names,
        "window_days": WINDOW_DAYS,
        # doctrine_holders / executors deliberately ABSENT -> ASD stays
        # NOT_APPLICABLE and must not be federated as a number.
        # ── traceability ──
        "ceremony_artifacts_narrow_doctrine_only": ceramic["narrow_doctrine_only"],
        "ceremony_top_dirs": [f"{k}:{v}" for k, v in ceramic["top_dirs"]],
        "registry_tools_total": prim["registry_tools_total"],
        "registry_live": prim["registry_available"],
        "registry_url": prim["registry_url"],
        "gate_log_lines_total": gate["lines_total"],
        "gate_log_lines_in_window": gate["lines_in_window"],
        "gate_log_verdicts_in_window": gate["verdicts_in_window"],
        "gate_log_tools_allowed_in_window": len(gate["allow_tools_in_window"]),
        "gate_log_ts_first": gate["ts_first"],
        "gate_log_ts_last": gate["ts_last"],
        "receipts_lines_total": rec["lines_total"],
        "receipts_lines_with_actor_field": rec["lines_with_actor_field"],
        "receipts_tools_in_window": len(rec["tools_in_window"]),
        "observed_actors_gate_log_proxy": len(gate["allow_actors_in_window"]),
        "exercised_outside_registry": outside_registry,
        "entrypoints_total": len(eps["entrypoints"]),
        "entrypoints_gated": len(gated_eps),
        "entrypoints_ungated": len(ungated_eps),
        "entrypoints": [
            {k: e[k] for k in ("id", "kind", "module", "transport", "port", "unit",
                               "dispatch", "gate_call_sites", "gated",
                               "where_checked", "module_path", "live_clients")}
            for e in eps["entrypoints"]
        ],
        "serve_stdio_branch": eps["stdio_branch"],
        "host_paths": eps["host_paths"],
        "host_paths_total": len(eps["host_paths"]),
        "host_paths_referencing_gate": sum(
            1 for h in eps["host_paths"] if h.get("gate_references", 0) > 0
        ),
        "stdio_live_client_configs": eps["stdio_clients"],
        "primitives_reachable_ungated": len(primitives) if primitives and ungated_eps else 0,
        "mutation_primitives": primitives,
        "base_mutation_class": prim["base_mutation_class"],
        "mode_aware_beyond_base_class": prim["mode_aware_beyond_base_class"],
        "capability_coverage": coverage,
        "classifier_path": classifier["path"],
        "classifier_declared_names": classifier["declared_mutation_names"],
    }

    reading = asb.SubstrateReading(
        organ=ORGAN, host=_host(), observed_at=ts,
        metrics={"cer": cer, "asd": asd, "enc": enc},
        evidence=evidence,
    )
    return reading, asb


def validate(reading_json: str, schema_path: Path = SCHEMA_PATH) -> list:
    """Minimal structural check against the contract (stdlib only)."""
    problems: list[str] = []
    doc = json.loads(reading_json)
    for k in ("reading_version", "organ", "host", "observed_at", "metrics", "evidence"):
        if k not in doc:
            problems.append(f"missing required key: {k}")
    if doc.get("reading_version") != 1:
        problems.append("reading_version must be 1")
    if doc.get("organ") not in ("arifOS", "AAA", "A-FORGE", "arifFlow", "WELL",
                                "WEALTH", "GEOX", "HERMES"):
        problems.append(f"organ not in enum: {doc.get('organ')!r}")
    allowed = {"name", "value", "state", "source", "observed_at", "band", "notes"}
    for name, m in (doc.get("metrics") or {}).items():
        extra = set(m) - allowed
        if extra:
            problems.append(f"metric {name}: unexpected keys {sorted(extra)}")
        for k in ("name", "state", "source", "observed_at"):
            if not m.get(k):
                problems.append(f"metric {name}: empty {k}")
        if m.get("state") not in ("MEASURED", "NOT_APPLICABLE", "UNKNOWN"):
            problems.append(f"metric {name}: bad state {m.get('state')!r}")
        if m.get("state") == "NOT_APPLICABLE" and m.get("value") is not None:
            problems.append(f"metric {name}: NOT_APPLICABLE must have value null")
    if not schema_path.exists():
        problems.append(f"schema not found at {schema_path}")
    ev = doc.get("evidence") or {}
    for k in ("gated_paths", "total_paths", "ceremony_artifacts",
              "exercised_capabilities", "window_days"):
        v = ev.get(k)
        if not isinstance(v, int) or v < 0:
            problems.append(f"evidence.{k} must be a non-negative integer")
    if isinstance(ev.get("window_days"), int) and ev["window_days"] < 1:
        problems.append("evidence.window_days must be >= 1")
    ung = ev.get("ungated")
    if not isinstance(ung, list) or any(not isinstance(x, str) for x in ung):
        problems.append("evidence.ungated must be a list of strings")
    elif len(ung) != len(set(ung)):
        problems.append("evidence.ungated must not contain duplicates")
    if isinstance(ev.get("gated_paths"), int) and isinstance(ev.get("total_paths"), int):
        if ev["gated_paths"] > ev["total_paths"]:
            problems.append("gated_paths cannot exceed total_paths")
    return problems


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="asabiyyah_probe", description=__doc__)
    p.add_argument("--no-write", action="store_true", help="print the reading only")
    p.add_argument("--drop-dir", default=str(DROP_DIR))
    args = p.parse_args(argv)

    reading, _asb = build_reading()
    text = reading.to_json()

    problems = validate(text)
    if problems:
        print(json.dumps({"contract_violations": problems}, indent=2), file=sys.stderr)
        return 2

    if not args.no_write:
        out = Path(args.drop_dir) / f"{ORGAN}.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text + "\n")
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
