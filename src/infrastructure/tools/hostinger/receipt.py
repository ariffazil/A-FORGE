#!/usr/bin/env python3
"""
Hostinger Gate — External Action Receipt Writer
═══════════════════════════════════════════════════════════════════════════════
purpose:    Logs every hostinger-vps tool/call attempt to Supabase
            `external_action_receipt` table — BEFORE the action and AFTER
            with result + error_message. Doctrine: DB = reality.

pattern:    BEFORE → action_type="...", result="pending", parameters=...
            AFTER  → result="success|failure|blocked", error_message=?,
                    external_reference=?, completed_at=NOW(), duration_ms

fail-soft:  If Supabase is unreachable, log to stderr and continue.
            The gate NEVER blocks a tool call because of a receipt failure.

authority:  F11 AUDIT + AAA-Supabase Record Doctrine v1.0 §3.5
            DITEMPA BUKAN DIBERI — Receipt is forged, not given.

env vars:   SUPABASE_URL          — e.g. https://utbmmjmbolmuahwixjqc.supabase.co
            SUPABASE_SERVICE_ROLE_KEY  — service_role bypasses RLS for writes
            HOSTINGER_GATE_ACTOR_ID    — (optional) override actor_id (default: hostinger-gate)

usage:
            from receipt import write_receipt, complete_receipt
            receipt_id = write_receipt(tool_name=..., parameters=..., risk_tier=..., floor_refs=...)
            ... action runs ...
            complete_receipt(receipt_id, result=..., external_reference=..., error_message=...)
═══════════════════════════════════════════════════════════════════════════════
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error
import uuid
from datetime import datetime, timezone
from typing import Optional


SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
ACTOR_ID = os.environ.get("HOSTINGER_GATE_ACTOR_ID", "hostinger-gate")

TABLE = "external_action_receipt"
TIMEOUT_S = 5  # Supabase REST POST timeout — must not block the gate

# Outcome vocabulary (external_action_receipt.result column)
VALID_RESULTS: frozenset[str] = frozenset({
    "success", "failure", "blocked", "rolled_back", "partial",
})

# Fields that may legitimately be NULL in the write_receipt payload.
# All other fields are filtered out when value is None to avoid overwriting
# with NULL on PATCH.
NULLABLE_FIELDS: frozenset[str] = frozenset({
    "approval_ticket_id", "human_ratifier",
    "session_id", "trace_id", "source_subdomain",
})


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _log_stderr(action: str, msg: str) -> None:
    """Audit log to stderr (visible via journalctl). Never raises."""
    try:
        sys.stderr.write(
            json.dumps({
                "ts": _now_iso(),
                "gate": "hostinger-receipt",
                "action": action,
                "msg": msg,
            }) + "\n"
        )
        sys.stderr.flush()
    except (OSError, ValueError):
        pass  # stderr closed/unwritable — log channel itself is dead, give up


def _supabase_post(payload: dict) -> Optional[str]:
    """
    INSERT a row into external_action_receipt via Supabase REST.
    Returns the receipt_id on success, None on failure.
    Fail-soft: never raises.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        _log_stderr("SUPABASE_UNCONFIGURED",
                    f"SUPABASE_URL={'set' if SUPABASE_URL else 'MISSING'}, "
                    f"SUPABASE_SERVICE_ROLE_KEY={'set' if SUPABASE_KEY else 'MISSING'}")
        return None

    url = f"{SUPABASE_URL}/rest/v1/{TABLE}"
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Prefer": "return=representation",
        },
    )

    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
            elapsed_ms = int((time.time() - t0) * 1000)
            if resp.status in (200, 201):
                data = json.loads(resp.read().decode("utf-8"))
                if data and isinstance(data, list) and len(data) > 0:
                    receipt_id = data[0].get("receipt_id")
                    _log_stderr("INSERT_OK",
                                f"receipt_id={receipt_id} elapsed_ms={elapsed_ms}")
                    return receipt_id
                _log_stderr("INSERT_EMPTY", f"elapsed_ms={elapsed_ms}")
                return None
            _log_stderr("INSERT_BAD_STATUS", f"status={resp.status} elapsed_ms={elapsed_ms}")
            return None
    except urllib.error.URLError as e:
        _log_stderr("INSERT_URLError", f"{type(e).__name__}: {e}")
        return None
    except Exception as e:
        _log_stderr("INSERT_EXCEPTION", f"{type(e).__name__}: {e}")
        return None


def _supabase_patch(receipt_id: str, payload: dict) -> bool:
    """
    UPDATE a row by receipt_id. Fail-soft. Returns True on success.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        return False

    url = f"{SUPABASE_URL}/rest/v1/{TABLE}?receipt_id=eq.{receipt_id}"
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="PATCH",
        headers={
            "Content-Type": "application/json",
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Prefer": "return=minimal",
        },
    )

    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
            elapsed_ms = int((time.time() - t0) * 1000)
            ok = resp.status in (200, 204)
            _log_stderr("UPDATE_" + ("OK" if ok else "FAIL"),
                        f"receipt_id={receipt_id} status={resp.status} elapsed_ms={elapsed_ms}")
            return ok
    except urllib.error.URLError as e:
        _log_stderr("UPDATE_URLError", f"{type(e).__name__}: {e}")
        return False
    except Exception as e:
        _log_stderr("UPDATE_EXCEPTION", f"{type(e).__name__}: {e}")
        return False


# ── Public API ─────────────────────────────────────────────────────────────────


def write_receipt(
    tool_name: str,
    parameters: dict,
    risk_tier: int = 1,
    floor_refs: Optional[list] = None,
    ack_irreversible: bool = False,
    approval_ticket_id: Optional[str] = None,
    human_ratifier: Optional[str] = None,
    session_id: Optional[str] = None,
    trace_id: Optional[str] = None,
    actor_id: Optional[str] = None,
    source_subdomain: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> Optional[str]:
    """
    Write a pending receipt BEFORE the action runs.
    Returns the receipt_id (UUID) on success, None on failure.
    Never raises — fail-soft.
    """
    payload = {
        "source_system": "hostinger",
        "source_subdomain": source_subdomain or "vps:af-forge",
        "action_type": tool_name,
        "target": f"tool:{tool_name}",
        "parameters": parameters,
        "result": "pending",
        "actor_id": actor_id or ACTOR_ID,
        "risk_tier": risk_tier,
        "floor_refs": floor_refs or [],
        "ack_irreversible": ack_irreversible,
        "approval_ticket_id": approval_ticket_id,
        "human_ratifier": human_ratifier,
        "session_id": session_id,
        "trace_id": trace_id,
        "metadata": metadata or {},
        "payload_hash": "",  # trigger computes it
        # prev_receipt_hash chain link: skipped here — single-receipt atomic actions
    }
    # Drop None values for fields that should be NULL (Supabase handles NULL correctly)
    payload = {k: v for k, v in payload.items() if v is not None or k in NULLABLE_FIELDS}

    return _supabase_post(payload)


def complete_receipt(
    receipt_id: Optional[str],
    result: str,
    external_reference: Optional[str] = None,
    error_message: Optional[str] = None,
    extra_metadata: Optional[dict] = None,
) -> bool:
    """
    Update the receipt AFTER the action completes.
    result: 'success' | 'failure' | 'blocked' | 'rolled_back' | 'partial'
    Returns True if update succeeded.
    """
    if not receipt_id:
        return False

    if result not in VALID_RESULTS:
        _log_stderr("INVALID_RESULT", f"result={result}")
        return False

    payload = {
        "result": result,
        "external_reference": external_reference,
        "error_message": error_message,
        "completed_at": _now_iso(),
    }
    if extra_metadata:
        # PATCH replaces JSONB wholesale; merging requires read-modify-write
        # or a Postgres RPC. Drop extra_metadata here, but signal the loss
        # so the caller can route to error_message or a future metadata_patch.
        _log_stderr(
            "METADATA_DROPPED",
            f"extra_metadata keys={list(extra_metadata)} ignored — PATCH semantics",
        )

    # Remove None values to avoid overwriting with NULL
    payload = {k: v for k, v in payload.items() if v is not None}
    return _supabase_patch(receipt_id, payload)


# ── Smoke test ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"[receipt_smoke] SUPABASE_URL set: {bool(SUPABASE_URL)}")
    print(f"[receipt_smoke] SUPABASE_KEY set: {bool(SUPABASE_KEY)}")
    print(f"[receipt_smoke] actor_id: {ACTOR_ID}")

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[receipt_smoke] SKIP — Supabase not configured in env")
        sys.exit(0)

    rid = write_receipt(
        tool_name="VPS_smoke_test",
        parameters={"smoke": True, "ts": _now_iso()},
        risk_tier=1,
        floor_refs=["F11"],
        metadata={"smoke": "receipt_writer_self_test"},
    )
    print(f"[receipt_smoke] wrote receipt_id={rid}")

    if rid:
        ok = complete_receipt(
            rid,
            result="success",
            external_reference=f"smoke-{uuid.uuid4().hex[:8]}",
            error_message=None,
        )
        print(f"[receipt_smoke] completed: {ok}")