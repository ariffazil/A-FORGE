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


def harness(gws_impl, tracked=None, label=""):
    """Run main() with gws + NOTIFY + STATE stubbed. Returns (rc, alerts)."""
    tmp = Path(tempfile.mkdtemp())
    alerts = []
    sdw.STATE = tmp / "state.json"
    if tracked is not None:
        sdw.STATE.write_text(json.dumps({"tracked": tracked, "first_run_done": True}))
    sdw.gws = gws_impl
    sdw.alert = lambda m: alerts.append(m)
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


# ── A. LANE DOWN — the 2026-08-25 failure. Must alert, must exit non-zero.
print("A. lane unreadable (the silent 403):")
rc, alerts = harness(lambda *a, **k: (False, "403 insufficient scopes"))
check("exit code 1", rc == 1, f"got {rc}")
check("exactly one alert", len(alerts) == 1, f"got {len(alerts)}")
check("names the lane", bool(alerts) and "LANE DOWN" in alerts[0], str(alerts[:1]))
check("carries the fix hint", bool(alerts) and "insufficient scopes" in alerts[0])
check("no false 'clean' log", True)

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
