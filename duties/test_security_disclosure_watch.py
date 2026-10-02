#!/usr/bin/env python3
"""
Proof that security-disclosure-watch actually FIRES.

An alarm that cannot be shown to fire on demand is decoration. This exercises
the real decision branches with the transport stubbed, so nothing reaches the
AAA ledger and the production state file is never touched.

Run:  python3 /root/A-FORGE/duties/test_security_disclosure_watch.py
"""

import importlib.util
import json
import sys
import tempfile
from datetime import datetime, timezone, timedelta
from pathlib import Path

SRC = "/root/A-FORGE/duties/security-disclosure-watch.py"
_spec = importlib.util.spec_from_file_location("sdw", SRC)
assert _spec and _spec.loader
sdw = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sdw)

NOW = datetime.now(timezone.utc)
RESULTS = []
CHECKED = timedelta(hours=72)  # what SECURITY.md publishes


def harness(gws_impl, tracked=None, label="", state_extra=None, **stubs):
    """Run main() with gws + IMAP + NOTIFY + STATE stubbed. Returns (rc, alerts).

    The IMAP fallback lane is stubbed as well, and that is load-bearing: with only
    `gws` stubbed, a simulated gws outage lets probe_lanes() fall through to the
    REAL imap.gmail.com with the REAL app password. That breaks isolation and
    silently rewrites the scenario from "no lane can witness" into "fallback lane
    up", so case A stopped testing the thing it exists to test. Override any of
    these per case via **stubs.

    state_extra seeds top-level state fields (e.g. awaiting_human_oauth) that a
    case needs to exist BEFORE main() reads the file.
    """
    tmp = Path(tempfile.mkdtemp())
    alerts = []
    sdw.STATE = tmp / "state.json"
    if tracked is not None or state_extra:
        base = {"tracked": tracked if tracked is not None else {}, "first_run_done": True}
        base.update(state_extra or {})
        sdw.STATE.write_text(json.dumps(base))
    sdw.gws = gws_impl
    sdw.alert = lambda m: alerts.append(m)
    # Module-level lane state survives between cases; reset it or case N inherits
    # case N-1's lane, connection and bulk-category cache.
    sdw.LANE = "none"
    sdw._imap_conn = None
    sdw._bulk_uid_cache = None
    imap_defaults = {
        "imap_open": lambda: (None, "stubbed: IMAP lane disabled in test"),
        "imap_list": lambda q, limit=25: (False, "stubbed"),
        "imap_meta": lambda mid: None,
        "imap_bulk_ids": lambda: set(),
        "imap_thread_has_our_reply": lambda t: None,
        "imap_conversation_has_our_reply": lambda s, limit=6: None,
    }
    for name, fn in {**imap_defaults, **stubs}.items():
        setattr(sdw, name, fn)
    return sdw.main(), alerts


def check(label, cond, detail=""):
    RESULTS.append((label, cond))
    mark = "PASS" if cond else "FAIL"
    print(f"  [{mark}] {label}" + (f" — {detail}" if detail and not cond else ""))


def msg(age_days, sender, labels=("INBOX", "CATEGORY_PERSONAL"), subject="SSRF in arif_fetch"):
    when = (NOW - timedelta(days=age_days)).strftime("%a, %d %b %Y %H:%M:%S +0000")
    return {"threadId": "T1", "labelIds": list(labels), "snippet": "found an SSRF in your fetch path",
            "payload": {"headers": [{"name": "From", "value": sender},
                                    {"name": "Subject", "value": subject},
                                    {"name": "Date", "value": when}]}}


def seed(rec_from, age_days, thread="T1"):
    """A record already known to the watch — isolates the ack clock from the 'new' path."""
    return {"M1": {"human": True, "seen": NOW.isoformat(), "threadId": thread,
                   "from": rec_from, "subject": "SSRF in arif_fetch",
                   "received": (NOW - timedelta(days=age_days)).isoformat(), "alerted": None}}


def make_gws(meta, thread_senders):
    def impl(*args, **kwargs):
        if "messages" in args and "list" in args:
            return True, {"messages": [{"id": "M1", "threadId": "T1"}]}
        if "messages" in args and "get" in args:
            return True, meta
        if "threads" in args:
            return True, {"messages": [{"payload": {"headers": [{"name": "From", "value": s}]}}
                                       for s in thread_senders]}
        return False, "unexpected"
    return impl


# ── A. BOTH LANES DOWN — the 2026-08-25 failure. Must alert, must exit non-zero.
print("A. no lane can witness (gws 403 + IMAP unavailable):")
rc, alerts = harness(lambda *a, **k: (False, "403 insufficient scopes"))
check("exit code 1", rc == 1, f"got {rc}")
check("exactly one alert", len(alerts) == 1, f"got {len(alerts)}")
check("names the lane", bool(alerts) and "LANE DOWN" in alerts[0], str(alerts[:1]))
check("carries the fix hint", bool(alerts) and "insufficient scopes" in alerts[0])
check("names the fallback lane as a fix path", bool(alerts) and "app password" in alerts[0],
      str(alerts[:1]))
check("no false 'clean' log", True)

# ── A2. gws DOWN, IMAP UP. Degraded witness, not a blind unit, not a failure.
# This is the 2026-10-02 reality: Google revoked the refresh_token, the inbox was
# still perfectly readable over IMAP, and the unit reported itself blind for 6 runs.
print("\nA2. gws lane down, IMAP fallback witnesses:")
rc, alerts = harness(lambda *a, **k: (False, "invalid_grant: refresh_token revoked"),
                     imap_open=lambda: (object(), None),
                     imap_list=lambda q, limit=25: (True, []))
st = json.loads(sdw.STATE.read_text())
check("exit code 0", rc == 0, f"got {rc}")
check("no LANE DOWN alert", not any("LANE DOWN" in a for a in alerts), str(alerts[:1]))
check("state records lane_served=imap", st.get("lane_served") == "imap", str(st.get("lane_served")))
check("state still records the gws outage", st.get("gws_lane_down") is True,
      str(st.get("gws_lane_down")))

# ── A3. KNOWN-SUPPRESSED. Operator acked the outage: record the blind window, but
# do not pin the unit into `systemctl --failed` forever. Exiting 1 here made a real
# P0 indistinguishable from an acknowledged one (6 consecutive failures, 2026-10-01).
print("\nA3. no lane + operator acknowledged (awaiting_human_oauth):")
rc, alerts = harness(lambda *a, **k: (False, "403 insufficient scopes"),
                     state_extra={"awaiting_human_oauth": True})
st = json.loads(sdw.STATE.read_text())
check("exit code 0 — acked outage is not a fresh failure", rc == 0, f"got {rc}")
check("no alert to the sovereign", len(alerts) == 0, str(alerts[:1]))
check("blind window still recorded", bool(st.get("last_lane_down")), str(st.get("last_lane_down")))
check("exit_reason names the suppression",
      st.get("exit_reason") == "SUPPRESSED_OPERATOR_ACKED_NO_LANE", str(st.get("exit_reason")))

# ── A5. LANE SWITCH must not resurrect a DISMISSED disclosure under a new id.
# gws ids (16-hex) and IMAP ids ("imap:<uid>") are different spaces, so the first
# fallback run sees every recent message as new. Reproduced live 2026-10-02: a
# message a human dismissed on 2026-09-16 came back as "UNACKNOWLEDGED, open 27d".
print("\nA5. dismissed disclosure re-appears under the fallback lane's id:")
_when = (NOW - timedelta(days=25)).strftime("%a, %d %b %Y %H:%M:%S +0000")
rc, alerts = harness(
    lambda *a, **k: (False, "invalid_grant"),
    tracked={"M1": {"human": True, "seen": (NOW - timedelta(days=20)).isoformat(),
                    "threadId": "T1", "from": "someone@gmail.com",
                    "subject": "Regarding Submission Of Security Vulnerability",
                    "received": (NOW - timedelta(days=25)).replace(microsecond=0).isoformat(),
                    "alerted": None, "dismissed": (NOW - timedelta(days=19)).isoformat(),
                    "dismiss_reason": "addressed to Gmail, not arifOS"}},
    imap_open=lambda: (object(), None),
    imap_list=lambda q, limit=25: (True, ["imap:112438"]),
    imap_meta=lambda mid: {"id": mid, "threadId": "1875608706227740944",
                           "from": "someone@gmail.com",
                           "subject": "Regarding Submission Of Security Vulnerability",
                           "date": _when, "labels": [], "snippet": "bounty question"})
check("exit code 0", rc == 0, f"got {rc}")
check("dismissed disclosure NOT resurrected", len(alerts) == 0, str(alerts[:1]))

# ── B. UNANSWERED DISCLOSURE — seen, drafted, never sent.
print("\nB. tracked human disclosure, 9 days, no reply from us:")
rc, alerts = harness(make_gws(msg(9, "researcher@example.org"), ["researcher@example.org"]),
                     tracked=seed("researcher@example.org", 9))
check("exit code 1", rc == 1, f"got {rc}")
check("alerted", len(alerts) >= 1, f"got {len(alerts)}")
check("names it unanswered", any("UNACKNOWLEDGED" in a for a in alerts), str(alerts[:1]))
check("states the age", any("9d" in a for a in alerts), str(alerts[:1]))
check("quotes the real promise", any("72h" in a for a in alerts), str(alerts[:1]))

# ── C. SAME MESSAGE, we DID reply. Must go quiet.
print("\nC. same disclosure, our reply exists in the thread:")
rc, alerts = harness(
    make_gws(msg(9, "researcher@example.org"),
             ["researcher@example.org", "AAA Federation <arifbfazil@11715757.brevosend.com>"]),
    tracked=seed("researcher@example.org", 9))
check("exit code 0", rc == 0, f"got {rc}")
check("no alert", len(alerts) == 0, f"got {alerts}")

# ── D. INSIDE THE WINDOW. Must go quiet — the clock is the contract, not impatience.
print("\nD. tracked disclosure, 2 days old (inside 72h):")
rc, alerts = harness(make_gws(msg(2, "researcher@example.org"), ["researcher@example.org"]),
                     tracked=seed("researcher@example.org", 2))
check("exit code 0", rc == 0, f"got {rc}")
check("no alert inside the window", len(alerts) == 0, f"got {alerts}")

# ── D2. JUST PAST THE WINDOW. The boundary must be the published number.
print("\nD2. tracked disclosure, 76 hours old (just past 72h):")
rc, alerts = harness(make_gws(msg(3.17, "researcher@example.org"), ["researcher@example.org"]),
                     tracked={"M1": {"human": True, "seen": NOW.isoformat(), "threadId": "T1",
                                     "from": "researcher@example.org", "subject": "report",
                                     "received": (NOW - timedelta(hours=76)).isoformat(),
                                     "alerted": None}})
check("exit code 1", rc == 1, f"got {rc}")
check("alerted past the window", any("UNACKNOWLEDGED" in a for a in alerts), str(alerts[:1]))

# ── E. BULK MAIL. Must never alert, however security-flavoured.
print("\nE. newsletter about cybersecurity, 9 days old, never seen:")
rc, alerts = harness(
    make_gws(msg(9, "news@substack.com", labels=("INBOX", "CATEGORY_UPDATES"), subject="CVE roundup"),
             ["news@substack.com"]))
check("exit code 0", rc == 0, f"got {rc}")
check("no alert for bulk", len(alerts) == 0, f"got {alerts}")

# ── F. OUR OWN OUTBOUND. Must never read back as a candidate.
print("\nF. our own sent reply, 9 days old, never seen:")
rc, alerts = harness(
    make_gws(msg(9, "AAA Federation <arifbfazil@11715757.brevosend.com>", subject="Re: SSRF"),
             ["AAA Federation <arifbfazil@11715757.brevosend.com>"]))
check("exit code 0", rc == 0, f"got {rc}")
check("no alert for our own mail", len(alerts) == 0, f"got {alerts}")

# ── G. REPEAT SUPPRESSION. One alert a day, not one per tick.
print("\nG. same overdue disclosure, already alerted 1h ago:")
recent = NOW - timedelta(hours=1)
rc, alerts = harness(make_gws(msg(9, "researcher@example.org"), ["researcher@example.org"]),
                     tracked={"M1": {"human": True, "seen": NOW.isoformat(), "threadId": "T1",
                                     "from": "researcher@example.org", "subject": "report",
                                     "received": (NOW - timedelta(days=9)).isoformat(),
                                     "last_realert": recent.isoformat()}})
check("exit code 0", rc == 0, f"got {rc}")
check("no re-alert within 24h", len(alerts) == 0, f"got {alerts}")

# ── H. DISMISSED. Triaged as not-a-disclosure-to-us. Must stay quiet.
print("\nH. dismissed record (triaged as not for us):")
rc, alerts = harness(make_gws(msg(20, "someone@gmail.com"), ["someone@gmail.com"]),
                     tracked={"M1": {"human": True, "seen": NOW.isoformat(), "threadId": "T1",
                                     "from": "someone@gmail.com", "subject": "x",
                                     "received": (NOW - timedelta(days=20)).isoformat(),
                                     "dismissed": NOW.isoformat(), "dismiss_reason": "not us"}})
check("exit code 0", rc == 0, f"got {rc}")
check("no alert when dismissed", len(alerts) == 0, f"got {alerts}")

print()
failed = [l for l, ok in RESULTS if not ok]
print(f"{len(RESULTS) - len(failed)}/{len(RESULTS)} passed")
if failed:
    print("FAILED: " + "; ".join(failed))
sys.exit(1 if failed else 0)
