#!/usr/bin/env python3
"""
security-disclosure-watch — can we witness a vulnerability report?

SCAR (2026-08-25). SECURITY.md promises acknowledgment within its published window. A valid SSRF
report arrived at the published contact at 12:35; the fix shipped the same
morning; the reply never left the building because the Gmail lane had expired
OAuth scopes and failed with `403 insufficient scopes` — silently. The draft sat
in quarantine 18 days and the researcher escalated to a public GitHub thread.

Two things failed, so two things are checked. Nothing else.

  1. LANE      Can we read the security inbox at all?  (the silent 403)
  2. ACK CLOCK Is a human disclosure still unanswered past the window?  (seen but not sent)

Exit 0 when the lane can witness and nothing is overdue.
Exit 1 when the lane cannot witness (no data != all clear) or a clock expired.

Called by security-disclosure-watch.timer (4-hourly at :23). State stays under AAA/state.
Silent when clean. Alert via forge-notify.sh -> AAA ledger.

PROMISE SYNC: ACK_WINDOW must always equal the number PUBLISHED in SECURITY.md.
That document says **72 hours** (disclosure policy §3, verified 2026-09-16 against
the file, not against a summary of it). A watch enforcing a *different* window than
the published promise is the same silent failure it exists to prevent: a report
unanswered at hour 60 reads clean here while the promise to the researcher is
already broken. If the promise changes, change this constant in the same commit.

DITEMPA BUKAN DIBERI — a promise you do not measure is a promise you break.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

STATE = Path("/root/AAA/state/security-disclosure-watch.json")
NOTIFY = Path("/root/A-FORGE/duties/forge-notify.sh")

# Drill mode. A synthetic-failure drill travels to the same human channel as a
# real P0 and is indistinguishable from one unless it says so — on 2026-09-16 an
# unlabelled L1 drill made three agents open forensics on a lane that was up.
# Drill output is marked at the transport boundary; the production path is
# byte-identical when this is unset.
DRILL = os.environ.get("SECURITY_WATCH_DRILL") == "1"

# Must equal the number the REPORTER is promised — i.e. the public copy at
# arifOS/SECURITY.md §Disclosure Policy step 3 ("acknowledgment within 72 hours"),
# which is also the file this unit's Documentation= URL points at. Verified against
# origin/main 2026-09-16, not from memory or a summary.
#
# DRIFT (measured 2026-09-16, for whoever reconciles it): a second family of copies
# exists that says **48 hours** — AAA, GEOX, WEALTH, A-FORGE, WELL, arifFlow, FRAME.
# Two published numbers for one promise. 72h is kept here because that is what an
# outside researcher actually reads; an alert text that cites a window the reader
# cannot find in the public doc would be its own falsehood. If the public promise is
# ever tightened to 48h, change this constant and the two alert strings in the same
# commit as the document.
ACK_WINDOW = timedelta(hours=72)
REALERT_EVERY = timedelta(hours=24)
SCAN_WINDOW_DAYS = 60

# For a *disclosure* to reach us, a human types into an email client. Gmail
# already labels bulk mail, so the category is the filter — no sender regex.
BULK_LABELS = {"CATEGORY_UPDATES", "CATEGORY_PROMOTIONS", "CATEGORY_FORUMS", "CATEGORY_SOCIAL"}
# Not a filter list — just the set of senders that can never BE a disclosure to
# us: our own outbound, and GitHub's notification robot.
OUR_ADDRS = ("arifbfazil@gmail.com", "arifbfazil@11715757.brevosend.com")
NEVER_DISCLOSURE = ("notifications@github.com",)

TERMS = ("SSRF OR CVE OR vulnerability OR exploit OR \"responsible disclosure\" "
         "OR \"security disclosure\" OR injection OR RCE OR XSS")


def log(m: str) -> None:
    print(f"[security-watch] {m}", flush=True)


def alert(m: str) -> None:
    if DRILL:
        m = "[DRILL — synthetic, no real condition] " + m
    log(f"ALERT {m.splitlines()[0][:90]}")
    if not NOTIFY.exists():
        log("notify script missing")
        return
    try:
        subprocess.run([str(NOTIFY), m], capture_output=True, text=True, timeout=30)
    except Exception as e:
        log(f"notify failed: {type(e).__name__}")


def gws(*args: str, timeout: int = 45):
    """Run gws, return parsed JSON. Returns (ok, dict_or_error)."""
    exe = shutil.which("gws") or "/usr/bin/gws"
    try:
        r = subprocess.run([exe, *args], capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return False, "timeout"
    except Exception as e:
        return False, f"{type(e).__name__}: {e}"
    out = (r.stdout or "").strip()
    if out.startswith("Using keyring"):
        out = out.split("\n", 1)[1] if "\n" in out else ""
    if not out:
        return False, (r.stderr or "empty response").strip()[:200]
    try:
        d = json.loads(out)
    except json.JSONDecodeError:
        return False, f"non-JSON: {out[:150]}"
    if isinstance(d, dict) and "error" in d and "messages" not in d:
        err = d["error"]
        return False, (err.get("message", str(err)) if isinstance(err, dict) else str(err))[:200]
    return True, d


def gmail_list(q: str, limit: int = 25):
    ok, d = gws("gmail", "users", "messages", "list", "--params",
                json.dumps({"userId": "me", "q": q, "maxResults": limit,
                            "fields": "messages(id,threadId)"}))
    if not ok or not isinstance(d, dict):
        return False, d
    return True, [m["id"] for m in d.get("messages", [])]


def gmail_meta(msg_id: str):
    ok, d = gws("gmail", "users", "messages", "get", "--params",
                json.dumps({"userId": "me", "id": msg_id, "format": "metadata",
                            "metadataHeaders": ["From", "Subject", "Date"]}))
    if not ok or not isinstance(d, dict):
        return None
    h = {x["name"]: x["value"] for x in d.get("payload", {}).get("headers", [])}
    return {"id": msg_id, "threadId": d.get("threadId", ""), "from": h.get("From", ""),
            "subject": h.get("Subject", "(no subject)"), "date": h.get("Date", ""),
            "labels": d.get("labelIds", []), "snippet": d.get("snippet", "")[:140]}


def received(m: dict, fallback: datetime) -> datetime:
    """Aging is from when the sender wrote, not from when we happened to notice."""
    raw = (m.get("date") or "").replace(" (UTC)", "").strip()
    for fmt in ("%a, %d %b %Y %H:%M:%S %z", "%a, %d %b %Y %H:%M:%S %Z",
                "%d %b %Y %H:%M:%S %z"):
        try:
            return datetime.strptime(raw, fmt).astimezone(timezone.utc)
        except ValueError:
            continue
    return fallback


def thread_has_our_reply(thread_id: str):
    ok, d = gws("gmail", "users", "threads", "get", "--params",
                json.dumps({"userId": "me", "id": thread_id, "format": "metadata",
                            "metadataHeaders": ["From"]}))
    if not ok or not isinstance(d, dict):
        return None
    for m in d.get("messages", []):
        h = {x["name"]: x["value"] for x in m.get("payload", {}).get("headers", [])}
        if any(a in h.get("From", "") for a in OUR_ADDRS):
            return True
    return False


def _norm_subject(s: str) -> str:
    """Subject with reply/forward prefixes and [tags] stripped, for conversation matching."""
    t = re.sub(r"^\s*(\[[^\]]*\]\s*)*((re|fwd|fw|aw|sv)\s*:\s*)*", "", (s or ""), flags=re.I)
    t = re.sub(r"^\s*(\[[^\]]*\]\s*)*((re|fwd|fw|aw|sv)\s*:\s*)*", "", t, flags=re.I)
    return " ".join(t.split()).lower()


def conversation_has_our_reply(subject: str, limit: int = 6):
    """Did we answer this conversation in ANY thread it lives in?

    Gmail splits a conversation into several threads (a reporter's reply can land
    in a fresh threadId while our answer sits in the original one). Checking only
    the tracked threadId therefore reads an answered conversation as unanswered
    and, at the deadline, raises a P0 on a reporter who is already satisfied.
    Observed 2026-09-16: message 1a0a3f0cffd5eae8 came in on its own thread while
    the reply sat in 1a034a0dc7d3bfc5.

    Only called when the thread-level check says no — so the extra API calls land
    on the alarm path, never on a clean run. Returns None when it cannot tell.
    """
    norm = _norm_subject(subject)
    if not norm:
        return None
    ok, ids = gmail_list(f'in:inbox newer_than:{SCAN_WINDOW_DAYS}d subject:"{norm}"', limit=limit)
    if not ok:
        return None
    seen = set()
    for mid in ids:
        meta = gmail_meta(mid)
        if not meta:
            continue
        tid = meta.get("threadId")
        if not tid or tid in seen:
            continue
        seen.add(tid)
        replied = thread_has_our_reply(tid)
        if replied:
            return True
    return False


def load() -> dict:
    try:
        s = json.loads(STATE.read_text())
        s.setdefault("tracked", {})
        return s
    except Exception:
        return {"tracked": {}, "first_run_done": False}


def main() -> int:
    now = datetime.now(timezone.utc)
    st = load()
    tracked = st["tracked"]
    first_run = not st.get("first_run_done")
    problems: list[str] = []

    # ── 1. LANE — the failure of 2026-08-25. Must never be silent again.
    ok, probe = gmail_list("in:inbox newer_than:7d", limit=1)
    if not ok:
        alert("🔴 SECURITY LANE DOWN — cannot read the security inbox.\n"
              f"Gmail probe failed: {probe}\n"
              "A vulnerability report sent to the published contact would NOT be seen,\n"
              "and SECURITY.md promises acknowledgment within 72h.\n"
              "Fix: gws OAuth scope/token (the 2026-08-25 failure was `403 insufficient scopes`).")
        st["last_lane_down"] = now.isoformat()
        STATE.parent.mkdir(parents=True, exist_ok=True)
        STATE.write_text(json.dumps(st, indent=2, sort_keys=True))
        return 1

    # ── 2. Find human disclosures; baseline silently on first run.
    # in:inbox, not in:anywhere — our own replies must not read back as candidates.
    ok, ids = gmail_list(f"in:inbox newer_than:{SCAN_WINDOW_DAYS}d ({TERMS})")
    if not ok:
        log(f"search failed: {ids}")
        problems.append(f"security_watch: search failed ({ids})")
        ids = []

    for mid in ids:
        if mid in tracked:
            continue
        meta = gmail_meta(mid)
        if not meta:
            continue  # retry next run
        sender = meta["from"]
        rec = {"human": False, "seen": now.isoformat(), "threadId": meta["threadId"],
               "from": sender, "subject": meta["subject"][:180], "alerted": None,
               "received": received(meta, now).isoformat()}
        if any(a in sender for a in OUR_ADDRS) or any(n in sender for n in NEVER_DISCLOSURE):
            tracked[mid] = rec
            continue
        rec["human"] = not (BULK_LABELS & set(meta["labels"]))
        tracked[mid] = rec
        if rec["human"] and not first_run:
            problems.append(f"security_watch: NEW DISCLOSURE CANDIDATE — {sender}\n"
                            f"      subject: {meta['subject'][:120]}\n"
                            f"      snippet: {meta['snippet']}")

    # ── 3. ACK CLOCK — seen, drafted, never sent.
    for rec in tracked.values():
        if not rec.get("human") or rec.get("acknowledged") or rec.get("dismissed"):
            continue
        since = datetime.fromisoformat(rec.get("received") or rec["seen"])
        if now - since < ACK_WINDOW:
            continue
        last = rec.get("last_realert")
        if last and now - datetime.fromisoformat(last) < REALERT_EVERY:
            continue
        replied = thread_has_our_reply(rec["threadId"])
        if replied is None:
            continue
        if replied:
            rec["acknowledged"] = now.isoformat()
            continue
        # Gmail splits conversations across threads: our answer may live in a
        # sibling thread. Ask the conversation, not the threadId.
        convo = conversation_has_our_reply(rec.get("subject", ""))
        if convo:
            rec["acknowledged"] = now.isoformat()
            rec["acknowledged_via"] = "sibling thread (Gmail split the conversation)"
            continue
        if convo is None:
            continue
        rec["last_realert"] = now.isoformat()
        age = now - since
        problems.append(
            f"security_watch: UNACKNOWLEDGED DISCLOSURE — open {age.days}d{age.seconds // 3600}h\n"
            f"      from: {rec.get('from', '?')[:80]}\n"
            f"      subject: {rec.get('subject', '?')[:120]}\n"
            f"      no reply from us exists in the thread; SECURITY.md promises 72h")

    st["first_run_done"] = True
    st["last_run"] = now.isoformat()
    st["pending"] = len(problems)
    STATE.parent.mkdir(parents=True, exist_ok=True)
    tmp = STATE.with_suffix(".tmp")
    tmp.write_text(json.dumps(st, indent=2, sort_keys=True))
    tmp.replace(STATE)

    for p in problems[:3]:
        alert(p if p.startswith("🔴") else "⚠️ " + p)
    if len(problems) > 3:
        alert(f"⚠️ security_watch: +{len(problems) - 3} more — see {STATE}")

    if problems:
        return 1
    n = sum(1 for r in tracked.values() if r.get("human"))
    log(f"clean — lane readable, {n} human candidate(s) tracked, none overdue")
    return 0


if __name__ == "__main__":
    sys.exit(main())
