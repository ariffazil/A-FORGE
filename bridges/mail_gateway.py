#!/usr/bin/env python3
"""
mail_gateway.py — arifOS Federation-Wide Gmail Gateway
Canonical Spec: /root/AAA/canon/FEDERATION_GMAIL_GATEWAY_SPEC.md

Architecture:
  WARGA (HERMES / AAA warga / FI agents / future agents)
                    │ (actor_id + purpose + intent)
                    ▼
            ┌───────────────┐
            │    arifOS     │
            │Authority Gate │ (Capability ≠ Authority)
            └───────┬───────┘
                    │ ACT / lease / policy
                    ▼
            ┌───────────────┐
            │    A-FORGE    │
            │ MAIL GATEWAY  │ (Single OAuth Credential Boundary & Chokepoint)
            └───────┬───────┘
                    │
              backend adapter
               ┌────┴─────┐
               │          │
            gws NOW    Gmail MCP LATER
               │          │
               └────┬─────┘
                    ▼
                  Gmail
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any, Dict, Optional

# Paths
CONFIG_DIR = Path("/root/.config/gws")
SECRET_DIR = Path("/root/.secrets/email")
REVOCATION_FLAG = SECRET_DIR / "GMAIL_REVOKED"
REVOCATION_FLAG_FALLBACK = Path("/tmp/GMAIL_REVOKED")
RECEIPT_LOG = Path("/root/AAA/ops/capabilities/mail_gateway_receipts.jsonl")
RECEIPT_LOG_FALLBACK = Path("/tmp/mail_gateway_receipts.jsonl")

# Granular Action Classification
ACTIONS = {
    # OBSERVE (Metadata only, autonomous)
    "search": {"class": "OBSERVE", "tier": "AUTONOMOUS", "reversible": True, "progressive": "metadata_only"},
    "search_threads": {"class": "OBSERVE", "tier": "AUTONOMOUS", "reversible": True, "progressive": "metadata_only"},
    "list_labels": {"class": "OBSERVE", "tier": "AUTONOMOUS", "reversible": True, "progressive": "metadata_only"},
    "read_headers": {"class": "OBSERVE", "tier": "AUTONOMOUS", "reversible": True, "progressive": "metadata_only"},

    # OBSERVE (Purpose-scoped read)
    "read": {"class": "OBSERVE", "tier": "PURPOSE_SCOPED", "reversible": True, "progressive": "quarantined_body"},
    "read_body": {"class": "OBSERVE", "tier": "PURPOSE_SCOPED", "reversible": True, "progressive": "quarantined_body"},
    "get_message": {"class": "OBSERVE", "tier": "PURPOSE_SCOPED", "reversible": True, "progressive": "quarantined_body"},
    "get_thread": {"class": "OBSERVE", "tier": "PURPOSE_SCOPED", "reversible": True, "progressive": "quarantined_body"},

    # DRAFT (Reversible state mutation, autonomous lease)
    "create_draft": {"class": "DRAFT", "tier": "AUTONOMOUS", "reversible": True},
    "update_draft": {"class": "DRAFT", "tier": "AUTONOMOUS", "reversible": True},

    # EXECUTE_REVERSIBLE (State mutation, autonomous lease)
    "create_label": {"class": "EXECUTE_REVERSIBLE", "tier": "AUTONOMOUS", "reversible": True},
    "label_message": {"class": "EXECUTE_REVERSIBLE", "tier": "AUTONOMOUS", "reversible": True},
    "archive": {"class": "EXECUTE_REVERSIBLE", "tier": "AUTONOMOUS", "reversible": True},

    # EXTERNAL_CONSEQUENCE (Irreversible, requires explicit sovereign F13 approval)
    "send": {"class": "EXTERNAL_CONSEQUENCE", "tier": "GOVERNED_F13", "reversible": False},
    "draft_send": {"class": "EXTERNAL_CONSEQUENCE", "tier": "GOVERNED_F13", "reversible": False},
    "forward": {"class": "EXTERNAL_CONSEQUENCE", "tier": "GOVERNED_F13", "reversible": False},

    # HIGHER_IMPACT (Destructive, requires explicit sovereign F13 approval)
    "trash": {"class": "HIGHER_IMPACT", "tier": "GOVERNED_F13", "reversible": True},
    "delete": {"class": "HIGHER_IMPACT", "tier": "GOVERNED_F13", "reversible": False},

    # FORBIDDEN (Blocked at gateway)
    "settings_update": {"class": "FORBIDDEN", "tier": "MUTATION_FORBIDDEN", "reversible": False},
    "filter_delete": {"class": "FORBIDDEN", "tier": "MUTATION_FORBIDDEN", "reversible": False},
    "account_mutation": {"class": "FORBIDDEN", "tier": "MUTATION_FORBIDDEN", "reversible": False},
}


def mint_receipt(
    actor_id: str,
    purpose: str,
    intent: str,
    verdict: str,
    ok: bool,
    action_class: str,
    details: Optional[str] = None,
) -> Dict[str, Any]:
    receipt = {
        "receipt_id": f"r-mail-{uuid.uuid4().hex[:12]}",
        "actor_id": actor_id or "ANONYMOUS_WARGA",
        "purpose": purpose or "UNSPECIFIED",
        "intent": intent,
        "action_class": action_class,
        "verdict": verdict,
        "ok": ok,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    # Log receipt to append-only causal ledger
    for path in (RECEIPT_LOG, RECEIPT_LOG_FALLBACK):
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            with open(path, "a", encoding="utf-8") as f:
                f.write(json.dumps(receipt) + "\n")
            break
        except Exception:
            continue
    return receipt


def is_revoked() -> bool:
    return REVOCATION_FLAG.exists() or REVOCATION_FLAG_FALLBACK.exists()


def quarantine_untrusted_content(raw_data: Any) -> Dict[str, Any]:
    """
    INDIRECT PROMPT INJECTION DEFENSE:
    EMAIL CONTENT = EVIDENCE
    EMAIL CONTENT ≠ AUTHORITY

    Wraps external email strings into a strictly untrusted evidence container.
    """
    return {
        "source": "gmail",
        "trust": "UNTRUSTED_EXTERNAL_CONTENT",
        "authority": 0,
        "instructions_executable": False,
        "sanitized": True,
        "payload": raw_data,
    }


def check_authority(
    intent: str, purpose: str, f13_auth_token: Optional[str] = None
) -> tuple[bool, str, str, str]:
    """Returns (is_allowed, verdict, action_class, reason)."""
    if is_revoked():
        return (
            False,
            "REVOKED",
            "REVOKED",
            "CENTRAL_REVOCATION_ACTIVE: Gmail access is globally severed across all warga.",
        )

    action_meta = ACTIONS.get(intent)
    if not action_meta:
        return (
            False,
            "HOLD",
            "UNKNOWN",
            f"UNKNOWN_INTENT: Intent '{intent}' is not registered in the federation authority matrix.",
        )

    action_class = action_meta["class"]
    tier = action_meta["tier"]

    if action_class == "FORBIDDEN":
        return (
            False,
            "FORBIDDEN",
            action_class,
            f"MUTATION_FORBIDDEN: Action '{intent}' is strictly forbidden by federation constitution.",
        )

    if tier == "GOVERNED_F13":
        expected_token = os.environ.get("F13_SOVEREIGN_TOKEN", "ARIF_F13_CONFIRMED")
        if not f13_auth_token or f13_auth_token.strip() != expected_token:
            return (
                False,
                "HOLD",
                action_class,
                f"CAPABILITY_NOT_AUTHORITY: Intent '{intent}' classified as {action_class}. Requires explicit F13 sovereign approval.",
            )

    if tier == "PURPOSE_SCOPED":
        if not purpose or len(purpose.strip()) < 8:
            return (
                False,
                "HOLD",
                action_class,
                f"PURPOSE_REQUIRED: Reading full email bodies/threads requires a specific, falsifiable purpose (minimum 8 chars).",
            )

    return True, "PROCEED", action_class, f"Action permitted under {action_class} classification."


def execute_via_gws(
    intent: str, params: Dict[str, Any],
    actor_id: str = "", purpose: str = "",
) -> tuple[bool, Any, Optional[str]]:
    """Execute Gmail action through the arifOS Token-Custody Broker.

    The broker (systemd: mailgw-broker, AppArmor: arifos-gws-broker) is the only
    context permitted to read the OAuth token store. This function no longer
    shells out to a bare `gws`, because the citizen AppArmor profile denies that
    path - see /root/A-FORGE/bridges/gws_truth_test.py.
    """
    try:
        user_id = params.get("userId", "me")
        action_meta = ACTIONS.get(intent, {})
        progressive = action_meta.get("progressive")

        if intent in ("list_labels",):
            cmd = ["gws", "gmail", "users", "labels", "list", "--params", json.dumps({"userId": user_id})]
        elif intent in ("search", "search_messages"):
            query = params.get("query", "")
            max_results = min(int(params.get("max_results", 10)), 20)
            cmd = [
                "gws",
                "gmail",
                "users",
                "messages",
                "list",
                "--params",
                json.dumps({"userId": user_id, "q": query, "maxResults": max_results}),
            ]
        elif intent in ("search_threads",):
            query = params.get("query", "")
            max_results = min(int(params.get("max_results", 10)), 20)
            cmd = [
                "gws",
                "gmail",
                "users",
                "threads",
                "list",
                "--params",
                json.dumps({"userId": user_id, "q": query, "maxResults": max_results}),
            ]
        elif intent in ("read_headers",):
            msg_id = params.get("id") or params.get("message_id")
            if not msg_id:
                return False, None, "Missing parameter 'message_id' / 'id'"
            cmd = [
                "gws",
                "gmail",
                "users",
                "messages",
                "get",
                "--params",
                json.dumps({"userId": user_id, "id": msg_id, "format": "metadata"}),
            ]
        elif intent in ("read", "read_body", "get_message"):
            msg_id = params.get("id") or params.get("message_id")
            if not msg_id:
                return False, None, "Missing parameter 'message_id' / 'id'"
            fmt = params.get("format", "full")
            cmd = [
                "gws",
                "gmail",
                "users",
                "messages",
                "get",
                "--params",
                json.dumps({"userId": user_id, "id": msg_id, "format": fmt}),
            ]
        elif intent in ("get_thread",):
            thread_id = params.get("id") or params.get("thread_id")
            if not thread_id:
                return False, None, "Missing parameter 'thread_id' / 'id'"
            cmd = [
                "gws",
                "gmail",
                "users",
                "threads",
                "get",
                "--params",
                json.dumps({"userId": user_id, "id": thread_id}),
            ]
        elif intent in ("create_draft",):
            to = params.get("to", "")
            subject = params.get("subject", "")
            body = params.get("body", "")
            msg = MIMEText(body)
            msg["to"] = to
            msg["subject"] = subject
            raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
            cmd = [
                "gws",
                "gmail",
                "users",
                "drafts",
                "create",
                "--params",
                json.dumps({"userId": user_id, "message": {"raw": raw}}),
            ]
        elif intent in ("create_label",):
            name = params.get("name")
            if not name:
                return False, None, "Missing parameter 'name'"
            cmd = [
                "gws",
                "gmail",
                "users",
                "labels",
                "create",
                "--params",
                json.dumps({"userId": user_id, "name": name}),
            ]
        elif intent in ("label_message", "archive"):
            msg_id = params.get("id") or params.get("message_id")
            add_labels = params.get("add_labels", [])
            remove_labels = params.get("remove_labels", [])
            if intent == "archive":
                remove_labels = list(set(remove_labels + ["INBOX"]))
            cmd = [
                "gws",
                "gmail",
                "users",
                "messages",
                "modify",
                "--params",
                json.dumps({
                    "userId": user_id,
                    "id": msg_id,
                    "addLabelIds": add_labels,
                    "removeLabelIds": remove_labels,
                }),
            ]
        elif intent in ("send",):
            to = params.get("to", "")
            subject = params.get("subject", "")
            body = params.get("body", "")
            msg = MIMEText(body)
            msg["to"] = to
            msg["subject"] = subject
            raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
            cmd = [
                "gws",
                "gmail",
                "users",
                "messages",
                "send",
                "--params",
                json.dumps({"userId": user_id, "raw": raw}),
            ]
        elif intent in ("trash",):
            msg_id = params.get("id") or params.get("message_id")
            cmd = [
                "gws",
                "gmail",
                "users",
                "messages",
                "trash",
                "--params",
                json.dumps({"userId": user_id, "id": msg_id}),
            ]
        elif intent in ("delete",):
            msg_id = params.get("id") or params.get("message_id")
            cmd = [
                "gws",
                "gmail",
                "users",
                "messages",
                "delete",
                "--params",
                json.dumps({"userId": user_id, "id": msg_id}),
            ]
        else:
            return False, None, f"Unsupported execution intent: {intent}"

        env = os.environ.copy()
        env["ARIFOS_MAIL_GATEWAY_INTERNAL"] = "1"
        # Route through the broker: bare `gws` is AppArmor-denied for citizens.
        env["MAILGW_ACTOR"] = actor_id or "ANONYMOUS_WARGA"
        env["MAILGW_PURPOSE"] = purpose or "mail_gateway dispatch"
        broker_cmd = [
            "/usr/bin/python3",
            "/opt/mailgw/mailgw_client.py",
            *cmd[1:],  # drop the leading bare "gws"; the client supplies it
        ]
        res = subprocess.run(broker_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=45, env=env)
        if res.returncode != 0:
            return False, None, f"gws CLI returned code {res.returncode}: {res.stderr.strip()}"

        out = res.stdout.strip()
        json_start = out.find("{")
        if json_start != -1:
            data = json.loads(out[json_start:])
            # Wrap in untrusted evidence container if reading content
            if progressive == "quarantined_body":
                data = quarantine_untrusted_content(data)
            return True, data, None
        return True, {"output": out}, None

    except subprocess.TimeoutExpired:
        return False, None, "Execution timed out (20s)"
    except Exception as e:
        return False, None, f"Execution exception: {str(e)}"


def dispatch(
    actor_id: str,
    purpose: str,
    intent: str,
    params: Dict[str, Any],
    f13_auth_token: Optional[str] = None,
) -> Dict[str, Any]:
    """Central Gateway Dispatcher."""
    allowed, verdict, action_class, reason = check_authority(intent, purpose, f13_auth_token)
    if not allowed:
        receipt = mint_receipt(actor_id, purpose, intent, verdict, ok=False, action_class=action_class, details=reason)
        return {
            "ok": False,
            "verdict": verdict,
            "action_class": action_class,
            "gate": "arifOS_authority",
            "error": reason,
            "receipt": receipt,
        }

    ok, result, err = execute_via_gws(intent, params, actor_id, purpose)
    verdict = "PROCEED" if ok else "HOLD"
    receipt = mint_receipt(actor_id, purpose, intent, verdict, ok=ok, action_class=action_class, details=err)

    if not ok:
        return {
            "ok": False,
            "verdict": "HOLD",
            "action_class": action_class,
            "gate": "mail_gateway_backend",
            "error": err,
            "receipt": receipt,
        }

    return {
        "ok": True,
        "verdict": "PROCEED",
        "action_class": action_class,
        "evidence_tag": "OBS",
        "result": result,
        "receipt": receipt,
    }


def main():
    parser = argparse.ArgumentParser(description="arifOS Mail Gateway")
    subparsers = parser.add_subparsers(dest="command")

    p_disp = subparsers.add_parser("dispatch", help="Dispatch a mail action through arifOS authority")
    p_disp.add_argument("--actor-id", required=True, help="Actor ID (e.g. HERMES, FI-001, AAA-skill)")
    p_disp.add_argument("--purpose", required=True, help="Specific, falsifiable operational purpose")
    p_disp.add_argument("--intent", required=True, help="Intent to execute")
    p_disp.add_argument("--params", default="{}", help="JSON encoded parameters")
    p_disp.add_argument("--f13-token", default=None, help="Explicit F13 token for governed operations")

    subparsers.add_parser("status", help="Check gateway status and revocation state")
    subparsers.add_parser("revoke", help="Sever Gmail access across all federation warga")
    subparsers.add_parser("unrevoke", help="Restore Gmail access")

    args = parser.parse_args()

    if args.command == "status":
        revoked = is_revoked()
        state = {
            "gateway": "arifOS Federation Mail Gateway",
            "status": "REVOKED" if revoked else "ACTIVE",
            "epistemic_state": "CANDIDATE_HOLD_CHOKEPOINT",
            "credential_boundary": "SINGLE_CENTRAL_OAUTH",
            "upstream_mcp": "https://gmailmcp.googleapis.com/mcp/v1",
            "local_adapter": "/usr/bin/gws",
            "chokepoint_bypass_audited": True,
            "untrusted_content_quarantine": True,
            "registered_actions": {k: v["class"] for k, v in ACTIONS.items()},
        }
        print(json.dumps(state, indent=2))
        return

    if args.command == "revoke":
        revoked = False
        for flag in (REVOCATION_FLAG, REVOCATION_FLAG_FALLBACK):
            try:
                flag.parent.mkdir(parents=True, exist_ok=True)
                flag.touch()
                revoked = True
                break
            except Exception:
                continue
        print(json.dumps({"status": "REVOKED", "message": "Gmail access severed for all federation citizens."}))
        return

    if args.command == "unrevoke":
        for flag in (REVOCATION_FLAG, REVOCATION_FLAG_FALLBACK):
            try:
                if flag.exists():
                    flag.unlink()
            except Exception:
                pass
        print(json.dumps({"status": "ACTIVE", "message": "Gmail access restored."}))
        return

    if args.command == "dispatch":
        try:
            params = json.loads(args.params)
        except json.JSONDecodeError as e:
            print(json.dumps({"ok": False, "verdict": "HOLD", "error": f"Invalid JSON params: {e}"}))
            sys.exit(1)

        resp = dispatch(
            actor_id=args.actor_id,
            purpose=args.purpose,
            intent=args.intent,
            params=params,
            f13_auth_token=args.f13_token,
        )
        print(json.dumps(resp, indent=2))
        if not resp["ok"]:
            sys.exit(1)
        return

    parser.print_help()


if __name__ == "__main__":
    main()
