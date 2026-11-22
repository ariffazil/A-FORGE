"""FED attribution fabric — contract, client, probe, key-plan, ledger tests.

Run: python3 -m pytest tests/fed/test_fed_attribution_fabric.py -q
"""

from __future__ import annotations

import importlib.util
import json
import os
import sqlite3
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts"
DEPLOY = ROOT / "deploy" / "fed"


def _load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


client = _load("fed_attribution_client", SCRIPTS / "fed_attribution_client.py")
probe = _load("fed_flow_probe", SCRIPTS / "fed_flow_probe.py")
keyplan = _load("fed_actor_key_plan", SCRIPTS / "fed_actor_key_plan.py")
ledger = _load("init_fed_ledger", SCRIPTS / "init_fed_ledger.py")


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    for k in ("ARIFOS_NODE_ID", "FED_ENTRY_GATEWAY", "FED_NODES_REGISTRY"):
        monkeypatch.delenv(k, raising=False)


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------


def test_registry_contract_and_nodes():
    reg = client.load_registry(DEPLOY / "nodes.json")
    assert reg["contract"] == client.CONTRACT
    assert {"kvm8", "kvm4", "kvm2"} <= set(reg["nodes"])
    assert reg["nodes"]["kvm8"]["loopback_gateway"] == "litellm_kvm8_4000"
    assert reg["nodes"]["kvm4"]["loopback_gateway"] == "litellm_kvm4_4000"


def test_agents_registry_parses():
    agents = json.loads((DEPLOY / "agents.json").read_text())
    names = {a["name"] for a in agents["agents"]}
    assert {"hermes", "opencode", "kimi-code", "codex", "claude-code"} <= names
    for a in agents["agents"]:
        assert a["injection"], a["name"]
        assert a["status"], a["name"]


# ---------------------------------------------------------------------------
# Gateway resolution
# ---------------------------------------------------------------------------


def test_gateway_resolution_loopback_and_remote():
    reg = client.load_registry(DEPLOY / "nodes.json")
    assert (
        client.gateway_id_for_url("http://127.0.0.1:4000/v1", "kvm8", reg)
        == "litellm_kvm8_4000"
    )
    assert (
        client.gateway_id_for_url("http://localhost:4000/v1", "kvm4", reg)
        == "litellm_kvm4_4000"
    )
    # kvm2 has no local litellm: its loopback tunnel enters kvm4.
    assert (
        client.gateway_id_for_url("http://127.0.0.1:4000/v1", "kvm2", reg)
        == "litellm_kvm4_4000"
    )
    # Remote front door from another node.
    assert (
        client.gateway_id_for_url("http://100.64.0.5:4000/v1", "kvm8", reg)
        == "litellm_kvm4_4000"
    )


def test_gateway_env_override(monkeypatch):
    monkeypatch.setenv("FED_ENTRY_GATEWAY", "litellm_test_9999")
    assert (
        client.gateway_id_for_url("http://127.0.0.1:4000/v1", "kvm8")
        == "litellm_test_9999"
    )


# ---------------------------------------------------------------------------
# Client contract
# ---------------------------------------------------------------------------


def test_headers_match_callback_names():
    attr = client.Attribution(
        actor_id="opencode",
        client="opencode/2.1",
        origin_node="kvm8",
        session_id="ses_abc",
        task_id="task_1",
        turn_id="turn_1",
        purpose="interactive",
        trace_id="a" * 32,
        requested_model_group="agi-333",
    )
    h = attr.headers()
    assert h["x-arifos-actor-id"] == "opencode"
    assert h["x-arifos-session-id"] == "ses_abc"
    assert h["x-arifos-task-id"] == "task_1"
    assert h["x-arifos-turn-id"] == "turn_1"
    assert h["x-arifos-purpose"] == "interactive"
    assert h["x-arifos-trace-id"] == "a" * 32
    assert h["x-arifos-node-id"] == "kvm8"
    assert h["x-arifos-requested-model-group"] == "agi-333"
    assert h["x-arifos-attribution-contract"] == client.CONTRACT
    assert not any("\n" in v or "\r" in v for v in h.values())


def test_metadata_is_flat_and_callback_readable():
    attr = client.Attribution(
        actor_id="hermes", client="hermes/1", origin_node="kvm8", purpose="verify"
    )
    md = attr.metadata()
    for key in (
        "actor_id",
        "session_id",
        "task_id",
        "turn_id",
        "purpose",
        "trace_id",
        "requested_model_group",
    ):
        assert key in md
    assert md["actor_id"] == "hermes"
    assert len(md["trace_id"]) == 32


def test_apply_preserves_caller_values():
    attr = client.Attribution(
        actor_id="opencode", client="opencode/2", origin_node="kvm8"
    )
    headers, body = attr.apply(
        headers={"X-Arifos-Actor-Id": "explicit-actor", "X-Other": "1"},
        body={"metadata": {"actor_id": "body-actor", "custom": "keep"}},
    )
    assert headers["X-Arifos-Actor-Id"] == "explicit-actor"
    assert headers["X-Other"] == "1"
    assert body["metadata"]["actor_id"] == "body-actor"
    assert body["metadata"]["custom"] == "keep"
    # Missing keys are filled.
    assert headers["x-arifos-session-id"] == ""
    assert body["metadata"]["trace_id"] == attr.trace_id


def test_invalid_input_rejected():
    with pytest.raises(ValueError):
        client.Attribution(actor_id="")
    with pytest.raises(ValueError):
        client.Attribution(actor_id="bad actor")
    with pytest.raises(ValueError):
        client.Attribution(actor_id="opencode", purpose="bad purpose!")
    with pytest.raises(ValueError):
        client.Attribution(actor_id="opencode", trace_id="not-hex")


def test_actor_canonicalised_and_trace_deterministic():
    a = client.Attribution(actor_id="OpenCode", client="oc/2", origin_node="kvm8")
    assert a.actor_id == "opencode"
    t1 = client.trace_id_for("opencode", "ses", "task", "turn")
    t2 = client.trace_id_for("opencode", "ses", "task", "turn")
    assert t1 == t2 and len(t1) == 32
    assert client.trace_id_for("opencode", "ses", "task", "other") != t1


def test_is_valid_attribution():
    ok, errors = client.is_valid_attribution(
        client.Attribution(
            actor_id="kimi", client="kimi/1", origin_node="kvm4", purpose="build"
        ).metadata()
    )
    assert ok, errors
    bad, errs = client.is_valid_attribution({"actor_id": "Bad Actor"})
    assert not bad and "bad:actor_id" in errs


# ---------------------------------------------------------------------------
# Probe (offline)
# ---------------------------------------------------------------------------


def test_offline_report_structure(monkeypatch):
    monkeypatch.setattr(probe, "_tcp", lambda *a, **k: False)
    reg = client.load_registry(DEPLOY / "nodes.json")
    agents = json.loads((DEPLOY / "agents.json").read_text())
    report = probe.offline_report(reg, agents)
    assert report["mode"] == "offline"
    assert {n["node"] for n in report["nodes"]} >= {"kvm8", "kvm4", "kvm2"}
    assert any(a["agent"] == "opencode" for a in report["agents"])
    assert all(
        l["reachable_from_here"] is False
        for n in report["nodes"]
        for l in n["listeners"]
    )


# ---------------------------------------------------------------------------
# Actor key plan
# ---------------------------------------------------------------------------


def test_key_plan_shape_and_no_secret_material():
    agents = json.loads((DEPLOY / "agents.json").read_text())
    plan = keyplan.build_plan(agents, ["agi-333", "asi-555"])
    assert plan["mode"] == "PLAN_ONLY"
    assert plan["keys"]
    blob = json.dumps(plan)
    assert "sk-" not in blob and "Bearer" not in blob
    for k in plan["keys"]:
        assert k["key_alias"] == f"fed-actor-{k['actor_id']}"
        assert k["payload"]["metadata"]["contract"] == client.CONTRACT
        assert k["models"] == ["agi-333", "asi-555"]


# ---------------------------------------------------------------------------
# Ledger init
# ---------------------------------------------------------------------------


def test_ledger_init_idempotent(tmp_path):
    db = str(tmp_path / "token_bank.db")
    first = ledger.init(db)
    assert first["ok"], first
    assert first["rows"] == 0
    second = ledger.init(db)
    assert second["ok"] and second["missing"] == []
    con = sqlite3.connect(db)
    cols = {r[1] for r in con.execute("PRAGMA table_info(token_bank_spend)")}
    con.close()
    for col in ("actor_id", "trace_id", "entry_gateway", "cost_evidence_class"):
        assert col in cols


def test_ledger_check_flags_empty_file(tmp_path):
    db = tmp_path / "empty.db"
    db.write_bytes(b"")
    result = ledger.check(str(db))
    assert result["ok"] is False
    assert "token_bank_spend" in result["missing"]
