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

Lane 1 has two witnesses, tried in order: the `gws` OAuth lane (primary) and a
Gmail IMAP app-password lane (fallback, added 2026-10-02). Google revoked the gws
refresh_token on 2026-10-01, which made this unit blind *and* permanently red —
but the inbox itself stayed readable over IMAP, so "gws is down" was never the
same fact as "we cannot see a disclosure". Credentials for the fallback live in a
root-only env file and are never logged.

Exit 0 when some lane can witness and nothing is overdue.
Exit 0 when NO lane can witness but the operator has already acknowledged the
        outage (`awaiting_human_oauth` in the state file) — that is a
        KNOWN-SUPPRESSED state, not a fresh failure, and exiting 1 for it pinned
        this unit into `systemctl --failed` for 6 consecutive runs, making a real
        P0 indistinguishable from an acked one. The blind window is still
        recorded in the state file.
Exit 1 when no lane can witness and nobody has acknowledged it (no data != all
        clear), or when a tracked disclosure clock expired.

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

import email
import imaplib
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

# ── Fallback lane (2026-10-02) ────────────────────────────────────────────────
# Same inbox, second independent witness. The gws lane needs a Google OAuth
# refresh_token that Google can revoke unilaterally (revoked 2026-10-01, see
# state.root_cause); an app password over IMAP does not. This file is root-only
# (mode 600) and holds GMAIL_USER + GMAIL_APP_PASSWORD. Only their PRESENCE is
# ever logged — a credential that reaches stdout or the state file has turned a
# monitoring unit into a leak.
EMAIL_ENV = Path("/opt/aaa/app/secrets/email.env")
IMAP_HOST = "imap.gmail.com"
IMAP_PORT = 993
SENT_MAILBOX = '"[Gmail]/Sent Mail"'

# Set once per run by probe_lanes(): "gws" | "imap" | "none". The lane-facing
# functions below dispatch on this, so no call site has to know which lane won.
LANE = "none"
_imap_conn = None

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


# ── IMAP transport (fallback lane, 2026-10-02) ────────────────────────────────
# Verified live 2026-10-02: AUTH ok, INBOX readable, X-GM-RAW / X-GM-THRID /
# X-GM-LABELS all supported by imap.gmail.com.
#
# imaplib does NOT quote command arguments for us, so every value that can
# contain a space is passed already quoted. Two lane differences are load-bearing
# and are handled explicitly rather than papered over:
#   * ids live in a different space. gws uses Gmail API message ids (16-hex);
#     IMAP uses UIDs. We namespace ours as "imap:<uid>" so the two can never
#     collide inside state.tracked.
#   * threadId is a different space too: X-GM-THRID is a decimal integer, the API
#     threadId is 16-hex. A record tracked on one lane cannot be thread-resolved
#     on the other, so that case returns None ("cannot tell") and main() falls
#     back to the lane-independent subject witness instead of guessing.

ALL_MAILBOX = '"[Gmail]/All Mail"'


def _email_env() -> dict:
    """KEY=VALUE pairs from the secrets file. Values never leave this dict."""
    out: dict = {}
    try:
        for line in EMAIL_ENV.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    except Exception:
        return {}
    return out


def imap_open():
    """(conn, None) or (None, error_class). INBOX is selected read-only; this unit
    never writes to the mailbox. The error is a class, never a credential."""
    global _imap_conn
    if _imap_conn is not None:
        return _imap_conn, None
    env = _email_env()
    user, pw = env.get("GMAIL_USER"), env.get("GMAIL_APP_PASSWORD")
    if not user or not pw:
        # Presence only — logging the value would turn a monitor into a leak.
        return None, f"credentials absent in {EMAIL_ENV} (user={bool(user)} pw={bool(pw)})"
    try:
        m = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
        m.login(user, pw)
        typ, _ = m.select("INBOX", readonly=True)
        if typ != "OK":
            return None, f"IMAP select INBOX -> {typ}"
        _imap_conn = m
        return m, None
    except Exception as e:
        # imaplib surfaces the SERVER's text. Keep class + a short slice; never the
        # arguments we sent, because a LOGIN argument carries the app password.
        return None, f"{type(e).__name__}: {str(e)[:80]}"


def _imap_select(mailbox: str) -> bool:
    conn, err = imap_open()
    if conn is None:
        return False
    try:
        typ, _ = conn.select(mailbox, readonly=True)
        return typ == "OK"
    except Exception:
        return False


def _imap_or_tree(words: list) -> str:
    """IMAP OR is prefix-binary: `OR OR a b c` == OR(OR(a,b),c)."""
    if len(words) == 1:
        return f'TEXT "{words[0]}"'
    return f'OR {_imap_or_tree(words[:-1])} TEXT "{words[-1]}"'


def _imap_criteria(q: str) -> list:
    """Standard-IMAP translation of the query subset this unit issues. Only used
    if the server ever rejects X-GM-RAW, so the lane degrades instead of dying."""
    crit = []
    m = re.search(r"newer_than:(\d+)d", q)
    if m:
        since = datetime.now(timezone.utc) - timedelta(days=int(m.group(1)))
        crit.append(f'SINCE {since.strftime("%d-%b-%Y")}')
    subj = re.search(r'subject:"([^"]+)"', q)
    if subj:
        crit.append(f'SUBJECT "{subj.group(1).replace(chr(34), "")}"')
    grp = re.search(r"\(([^()]*)\)", q)
    if grp and " OR " in grp.group(1):
        toks = [(a or b) for a, b in re.findall(r'"([^"]+)"|([^\s"]+)', grp.group(1))]
        words = [t for t in toks if t.upper() != "OR"]
        if words:
            crit.append(_imap_or_tree(words))
    return crit or ["ALL"]


def _imap_search(q: str):
    """UID SEARCH over the currently selected mailbox. UIDs, not sequence numbers:
    a sequence number silently re-points at a different message once mail arrives,
    and this unit persists these ids in state.tracked."""
    conn, err = imap_open()
    if conn is None:
        return False, err or "imap unavailable"
    try:
        raw = q.replace('"', '\\"')
        typ, data = conn.uid("SEARCH", "CHARSET", "UTF-8", f'X-GM-RAW "{raw}"')
        if typ != "OK":
            typ, data = conn.uid("SEARCH", "CHARSET", "UTF-8", *_imap_criteria(q))
        if typ != "OK":
            return False, f"IMAP SEARCH -> {typ}"
        ids = (data[0] or b"").split() if data and isinstance(data[0], bytes) else []
        return True, [i.decode() for i in ids]
    except Exception as e:
        return False, f"{type(e).__name__}: {str(e)[:80]}"


def _imap_fetch(uid: str, items: str):
    conn, err = imap_open()
    if conn is None:
        return None
    try:
        typ, data = conn.uid("FETCH", uid, items)
        if typ != "OK" or not data:
            return None
        return data
    except Exception:
        return None


def _imap_labels(data) -> list:
    """X-GM-LABELS -> the same CATEGORY_* tokens BULK_LABELS is written against.
    Missing extension = empty list, which makes `human` True — over-witness rather
    than silently classify a real disclosure as bulk."""
    out = []
    for part in data or []:
        head = part[0].decode(errors="replace") if isinstance(part, tuple) else str(part)
        m = re.search(r"X-GM-LABELS \((.*?)\)", head)
        if m:
            out += [(a or b) for a, b in re.findall(r'"([^"]+)"|(\S+)', m.group(1))]
    return out


def _imap_thrid(data) -> str:
    for part in data or []:
        head = part[0].decode(errors="replace") if isinstance(part, tuple) else str(part)
        m = re.search(r"X-GM-THRID (\d+)", head)
        if m:
            return m.group(1)
    return ""


def _imap_snippet(uid: str) -> str:
    """First bytes of the body, for the alert text only. Never fatal."""
    data = _imap_fetch(uid, "(BODY.PEEK[TEXT]<0.4096>)")
    for part in data or []:
        if isinstance(part, tuple) and len(part) > 1:
            txt = part[1].decode(errors="replace")
            txt = re.sub(r"^[^\n]*\n", "", txt)  # drop the MIME boundary line
            return " ".join(txt.split())[:140]
    return ""


def imap_list(q: str, limit: int = 25):
    if not _imap_select("INBOX"):
        return False, "IMAP select INBOX failed"
    ok, ids = _imap_search(q)
    if not ok:
        return False, ids
    # newest last in IMAP order; keep the same "most recent `limit`" semantics
    return True, [f"imap:{u}" for u in ids[-limit:]]


def imap_meta(msg_id: str):
    uid = msg_id.split(":", 1)[1] if msg_id.startswith("imap:") else msg_id
    data = _imap_fetch(uid, "(RFC822.HEADER X-GM-LABELS X-GM-THRID)")
    if not data:
        return None
    raw = b""
    for part in data:
        if isinstance(part, tuple) and len(part) > 1:
            raw = part[1]
            break
    if not raw:
        return None
    msg = email.message_from_bytes(raw)
    return {"id": msg_id, "threadId": _imap_thrid(data),
            "from": msg.get("From", ""), "subject": msg.get("Subject", "(no subject)"),
            "date": msg.get("Date", ""), "labels": _imap_labels(data),
            "snippet": _imap_snippet(uid)}


def imap_from(uid: str) -> str:
    data = _imap_fetch(uid, "(BODY.PEEK[HEADER.FIELDS (FROM)])")
    for part in data or []:
        if isinstance(part, tuple) and len(part) > 1:
            m = re.search(rb"^From:\s*(.*)$", part[1], re.M | re.I)
            if m:
                return m.group(1).decode(errors="replace")
    return ""


def imap_thread_has_our_reply(thrid: str):
    """True/False when the thread is resolvable on this lane, None when it is not.

    None is the honest answer for a threadId minted by the gws lane: X-GM-THRID
    (decimal) and the API threadId (16-hex) are different encodings, so the lookup
    finds nothing and we cannot tell whether a reply exists. main() treats None as
    "ask the subject witness instead", never as "no reply".
    """
    if not thrid or not str(thrid).isdigit():
        return None
    conn, err = imap_open()
    if conn is None:
        return None
    try:
        if not _imap_select(ALL_MAILBOX):
            return None
        typ, data = conn.uid("SEARCH", "CHARSET", "UTF-8", f"X-GM-THRID {thrid}")
        ids = (data[0] or b"").split() if typ == "OK" and data and isinstance(data[0], bytes) else []
        if not ids:
            return None
        for uid in ids:
            frm = imap_from(uid.decode())
            if any(a in frm for a in OUR_ADDRS):
                return True
        return False
    except Exception:
        return None
    finally:
        _imap_select("INBOX")


def imap_conversation_has_our_reply(norm_subject: str, limit: int = 6):
    """Did we answer this conversation? Searched in Sent Mail, because our replies
    live there — INBOX-only searching would read every answered reporter as
    unanswered and raise a P0 on someone already satisfied."""
    if not norm_subject or not _imap_select(SENT_MAILBOX):
        return None
    try:
        ok, ids = _imap_search(f'subject:"{norm_subject.replace(chr(34), "")}"')
        if not ok:
            return None
        for uid in ids[-limit:]:
            if any(a in imap_from(uid) for a in OUR_ADDRS):
                return True
        return False
    except Exception:
        return None
    finally:
        _imap_select("INBOX")


def probe_lanes():
    """Pick a witness. gws first (it carries labels + threadIds natively), IMAP
    app-password second. Returns (lane, error_detail_for_state)."""
    global LANE
    LANE = "gws"
    ok, probe = gmail_list("in:inbox newer_than:7d", limit=1)
    if ok:
        return "gws", ""
    gws_err = str(probe)[:200]
    conn, err = imap_open()
    if conn is None:
        return "none", f"gws: {gws_err} | imap: {err}"
    LANE = "imap"
    ok2, probe2 = gmail_list("in:inbox newer_than:7d", limit=1)
    if ok2:
        return "imap", f"gws: {gws_err}"
    LANE = "none"
    return "none", f"gws: {gws_err} | imap: {probe2}"


def gmail_list(q: str, limit: int = 25):
    if LANE == "imap":
        return imap_list(q, limit)
    ok, d = gws("gmail", "users", "messages", "list", "--params",
                json.dumps({"userId": "me", "q": q, "maxResults": limit,
                            "fields": "messages(id,threadId)"}))
    if not ok or not isinstance(d, dict):
        return False, d
    return True, [m["id"] for m in d.get("messages", [])]


def gmail_meta(msg_id: str):
    if LANE == "imap":
        return imap_meta(msg_id)
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
    if LANE == "imap":
        return imap_thread_has_our_reply(thread_id)
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

    IMAP lane: the thread walk is replaced by a subject search of Sent Mail, which
    is where our replies actually live.
    """
    norm = _norm_subject(subject)
    if not norm:
        return None
    if LANE == "imap":
        return imap_conversation_has_our_reply(norm, limit)
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


def _fingerprint(rec: dict) -> tuple:
    """Lane-independent identity of a message: who sent it, what it is about, when."""
    return (rec.get("from", ""), _norm_subject(rec.get("subject", "")), rec.get("received", ""))


def superseded_cross_lane(key: str, rec: dict, tracked: dict) -> bool:
    """True when the SAME message is already tracked under the other lane's id and
    that copy is OLDER. The older record stays the canonical witness.

    gws ids (Gmail API, 16-hex) and IMAP ids ("imap:<uid>") are different spaces,
    so the first run on the fallback lane sees every recent candidate as new. Left
    alone that re-fires a P0 for a disclosure already tracked — and, worse, runs the
    ACK clock twice on one human. Compared on the message, not the id.

    Asymmetric on purpose: suppressing BOTH copies would silence a genuinely
    unacknowledged disclosure, which is the one thing this unit must never do.
    """
    fp = _fingerprint(rec)
    mine = (rec.get("seen") or "", key)
    for k, other in tracked.items():
        if k == key or other is rec:
            continue
        if other.get("via_lane", "gws") == rec.get("via_lane"):
            continue
        if _fingerprint(other) != fp:
            continue
        if (other.get("seen") or "", k) < mine:
            return True
    return False


_bulk_uid_cache = None


def imap_bulk_ids() -> set:
    """Message ids Gmail itself files under a bulk category.

    X-GM-LABELS does NOT carry CATEGORY_* over IMAP — measured 2026-10-02: a CNN
    newsletter came back labelled only "\\Important", and 17 bulk senders were one
    `human=True` away from being raised as disclosures to the sovereign. Same
    taxonomy, different wire: ask the server with a `category:` search instead of
    reading a label IMAP never sends. One search per run, cached.
    """
    global _bulk_uid_cache
    if _bulk_uid_cache is not None:
        return _bulk_uid_cache
    if not _imap_select("INBOX"):
        _bulk_uid_cache = set()
        return _bulk_uid_cache
    ok, ids = _imap_search(
        f"in:inbox newer_than:{SCAN_WINDOW_DAYS}d "
        "(category:updates OR category:promotions OR category:forums OR category:social)")
    if not ok:
        # Fail towards over-witnessing, never towards silence — but say so.
        log(f"bulk-category search failed ({str(ids)[:100]}); classification degrades to 'assume human'")
        _bulk_uid_cache = set()
        return _bulk_uid_cache
    _bulk_uid_cache = {f"imap:{u}" for u in ids}
    return _bulk_uid_cache


def is_human_sender(mid: str, labels) -> bool:
    """Could a HUMAN have written this? A bulk category never is a disclosure."""
    if LANE == "imap":
        return mid not in imap_bulk_ids()
    return not (BULK_LABELS & set(labels or []))


def main() -> int:
    now = datetime.now(timezone.utc)
    st = load()
    tracked = st["tracked"]
    first_run = not st.get("first_run_done")
    problems: list[str] = []

    # ── 1. LANE — the failure of 2026-08-25. Must never be silent again.
    # Two witnesses now: gws OAuth (primary) and the Gmail IMAP app password.
    lane, lane_err = probe_lanes()
    st["lane_served"] = lane
    st["lane_served_at"] = now.isoformat()
    STATE.parent.mkdir(parents=True, exist_ok=True)

    if lane == "imap":
        # gws is still broken; we are witnessing on the fallback. Degraded, not
        # blind — so not a failure, but the degradation is recorded, not hidden.
        st["gws_lane_down"] = True
        st["gws_lane_down_detail"] = lane_err[:300]
        st.pop("exit_reason", None)
        st.pop("suppressed_since", None)
        log(f"witnessing via IMAP fallback (gws lane down: {lane_err[:140]})")
    elif lane == "gws":
        st["gws_lane_down"] = False
        st.pop("gws_lane_down_detail", None)
        st.pop("exit_reason", None)
        st.pop("suppressed_since", None)

    if lane == "none":
        st["last_lane_down"] = now.isoformat()
        st["last_lane_down_detail"] = lane_err[:400]
        # Operator has acknowledged the outage and taken it over manually. That is
        # a KNOWN-SUPPRESSED state, not a fresh failure — returning 1 for it pinned
        # this unit into `systemctl --failed` for 6 consecutive runs (2026-10-01 →
        # 2026-10-02), which makes a real P0 indistinguishable from an acked one.
        # The blind window is still recorded here and in the state file.
        # Reset by clearing `awaiting_human_oauth`.
        if st.get("awaiting_human_oauth"):
            st["suppressed_since"] = st.get("suppressed_since") or now.isoformat()
            st["exit_reason"] = "SUPPRESSED_OPERATOR_ACKED_NO_LANE"
            log("no lane could witness — operator-acked; blind window recorded, exit 0")
            STATE.write_text(json.dumps(st, indent=2, sort_keys=True))
            return 0
        st.pop("suppressed_since", None)
        # First occurrence OR new failure mode: alert once per (down_ts).
        prev_down_ts = st.get("last_alerted_lane_down")
        if prev_down_ts != st["last_lane_down"]:
            alert("🔴 SECURITY LANE DOWN — cannot read the security inbox.\n"
                  f"BOTH witnesses failed: {lane_err}\n"
                  "A vulnerability report sent to the published contact would NOT be seen,\n"
                  "and SECURITY.md promises acknowledgment within 72h.\n"
                  "Fix either lane: gws OAuth (`gws auth login`), or the IMAP app password\n"
                  "in /opt/aaa/app/secrets/email.env (GMAIL_USER + GMAIL_APP_PASSWORD).\n"
                  "\nTo suppress re-alerts while the operator re-authorizes, set\n"
                  "`awaiting_human_oauth: true` in /root/AAA/state/security-disclosure-watch.json.")
            st["last_alerted_lane_down"] = st["last_lane_down"]
        st["exit_reason"] = "NO_LANE_NO_WITNESS"
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
               "received": received(meta, now).isoformat(), "via_lane": LANE}
        if any(a in sender for a in OUR_ADDRS) or any(n in sender for n in NEVER_DISCLOSURE):
            tracked[mid] = rec
            continue
        rec["human"] = is_human_sender(mid, meta["labels"])
        tracked[mid] = rec
        if rec["human"] and not first_run:
            if superseded_cross_lane(mid, rec, tracked):
                # Same message, other lane's id, already tracked. Log, do not re-P0.
                log(f"already tracked on the other lane, not re-alerting: {sender[:60]}")
                continue
            problems.append(f"security_watch: NEW DISCLOSURE CANDIDATE — {sender}\n"
                            f"      subject: {meta['subject'][:120]}\n"
                            f"      snippet: {meta['snippet']}")

    # ── 3. ACK CLOCK — seen, drafted, never sent.
    for key, rec in tracked.items():
        if not rec.get("human") or rec.get("acknowledged") or rec.get("dismissed"):
            continue
        if superseded_cross_lane(key, rec, tracked):
            # A lane switch duplicates the message under a second id. One witness
            # per disclosure — the older record keeps the clock, this copy stays quiet.
            continue
        since = datetime.fromisoformat(rec.get("received") or rec["seen"])
        if now - since < ACK_WINDOW:
            continue
        last = rec.get("last_realert")
        if last and now - datetime.fromisoformat(last) < REALERT_EVERY:
            continue
        replied = thread_has_our_reply(rec["threadId"])
        if replied is None:
            # On the IMAP lane a threadId minted by gws is unresolvable (X-GM-THRID
            # is decimal, the API threadId is 16-hex). Honouring "cannot tell" with
            # a bare `continue` would freeze the ACK clock for every record tracked
            # before the fallback engaged — silence by a different route, which is
            # exactly what this unit exists to prevent. Fall through to the
            # conversation witness, which is lane-independent.
            if LANE != "imap" or rec.get("via_lane") == "imap":
                continue
            replied = False
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
    log(f"clean — lane '{LANE}' readable, {n} human candidate(s) tracked, none overdue")
    return 0


if __name__ == "__main__":
    sys.exit(main())
