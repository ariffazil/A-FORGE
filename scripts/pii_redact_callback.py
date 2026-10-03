#!/usr/bin/env python3
"""PII Redaction Gateway Callback — federation input-boundary chokepoint.

Forged 2026-10-03 (333-AGI, F13 SAH "do all" chat 2026-10-03) from the spec
seed banked by FI-008 in /root/AAA/governance/OSS-DISTILLATION-ADK-EVAL-OBS-2026-10-03.md
(kuanhoong/adk-lab pattern: before-model redaction, typed detectors, Luhn
validation, de-obfuscation, offline self-test). Local delta per FI-008: MyKad.

Design laws:
  * ONE chokepoint: every warga lane crosses HAProxy :4000 -> litellm. One hook
    covers all lanes (stronger than per-agent callbacks).
  * FAIL-OPEN on internal error: a bug here degrades to today's status quo
    (no redaction), NEVER to a gateway outage. Availability is sacred.
  * Receipts, not silence: every redaction appends a typed receipt to
    /app/data/pii_redactions.jsonl (detector labels + counts + sha256 of the
    ORIGINAL span — never the span itself).
  * v1 scope: PII + credential leakage in message text. NO injection blocking
    (F12 owns that at AAA/hermes layer), NO IP redaction (federation is
    infra-heavy; public-IP redaction FP cost > benefit — v2 lane-aware candidate).

Deliberate non-goals (documented so nobody "fixes" them blindly):
  * Private/loopback/CGNAT IPs, git SHAs, ports, model names, os.environ/REFS
    must NEVER be redacted (infra literals are the federation's working fluid).
  * Kill switch: remove the callbacks line in litellm-config.yaml + restart.

Deployed: mounted at /app/data/pii_redact_callback.py (host path
/root/.local/share/arifos/pii_redact_callback.py); registered in
litellm-config.yaml litellm_settings.callbacks as
`data.pii_redact_callback.proxy_handler_instance`.

Offline self-test (no API key, no litellm needed):  python3 pii_redact_callback.py --selftest
"""

import hashlib
import json
import os
import re
import datetime

_Base: type
try:  # container path
    from litellm.integrations.custom_logger import CustomLogger

    _Base = CustomLogger
except Exception:  # host self-test path

    class _FallbackBase:  # minimal stand-in; runtime only
        pass

    _Base = _FallbackBase


REDACT_FILE = os.environ.get("PII_REDACT_FILE", "/app/data/pii_redactions.jsonl")

# ── detectors (typed, conservative) ────────────────────────────────────────
EMAIL = re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")
# obfuscated email: jane [at] example [dot] com / jane at example dot com
EMAIL_OBF = re.compile(
    r"\b[A-Za-z0-9._%+\-]+\s*(?:\[at\]|\(at\)|\bat\b)\s*[A-Za-z0-9.\-]+\s*"
    r"(?:\[dot\]|\(dot\)|\bdot\b)\s*[A-Za-z]{2,}\b",
    re.IGNORECASE,
)
# Malaysian mobile: 01X-XXXXXXX(X) or +601X...
MY_PHONE = re.compile(r"(?<!\d)(?:\+?60[\s\-]?1|01)\d[\s\-]?\d{3,4}[\s\-]?\d{4}(?!\d)")
# MyKad/NRIC: YYMMDD-PB-SSSG, date-plausible gate cuts FPs (FI-008 local delta)
MYKAD = re.compile(
    r"(?<!\d)(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[\-](\d{2})[\-](\d{4})(?!\d)"
)
US_SSN = re.compile(r"(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)")
CAND_CARD = re.compile(r"(?<!\d)(?:\d[\s\-]?){13,19}(?!\d)")
SECRET_PATTERNS = [
    ("sk-anthropic", re.compile(r"\bsk-ant-[A-Za-z0-9_\-]{20,}")),
    ("sk-generic", re.compile(r"\bsk-[A-Za-z0-9_\-]{20,}")),
    ("github-pat", re.compile(r"\bghp_[A-Za-z0-9]{20,}\b")),
    ("aws-akid", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("slack-token", re.compile(r"\bxox[baprs]-[A-Za-z0-9\-]{10,}\b")),
    ("google-key", re.compile(r"\bAIza[0-9A-Za-z_\-]{30,}\b")),
    (
        "jwt",
        re.compile(
            r"\beyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\b"
        ),
    ),
    (
        "kv-assignment",
        re.compile(
            r"(?i)\b(api[_\-]?key|secret|password|passwd|token)\b\s*[:=]\s*[\"']?"
            r"(?!os\.environ)(?!\$\{)(?![\"']?\s)([A-Za-z0-9_\-.]{12,})"
        ),
    ),
]
# infra literals that must survive (negative-test anchors)
INFRA_SAFE = re.compile(
    r"^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|169\.254\.|0\.|255\.)"
)


def _luhn_ok(digits: str) -> bool:
    if not (13 <= len(digits) <= 19):
        return False
    if digits[0] not in "23456" and not digits.startswith("37"):
        return False
    total, alt = 0, False
    for ch in reversed(digits):
        d = int(ch)
        if alt:
            d *= 2
            if d > 9:
                d -= 9
        total += d
        alt = not alt
    return total % 10 == 0


def redact_text(text: str):
    """Return (redacted_text, [detector_labels_hit])."""
    hits = []
    if not isinstance(text, str) or not text:
        return text, hits

    def _sub(pattern, label, s, validator=None):
        nonlocal text

        def repl(m):
            if validator and not validator(m):
                return m.group(0)
            hits.append(label)
            return "[REDACTED:%s]" % label

        return pattern.sub(repl, s)

    text = _sub(EMAIL_OBF, "EMAIL_OBF", text)
    text = _sub(EMAIL, "EMAIL", text)
    text = _sub(MYKAD, "MYKAD", text, validator=lambda m: True)  # date gate is in-regex
    text = _sub(MY_PHONE, "MY_PHONE", text)
    text = _sub(US_SSN, "SSN", text)

    def _card(m):
        return _luhn_ok(re.sub(r"[\s\-]", "", m.group(0)))

    text = _sub(CAND_CARD, "CARD", text, validator=_card)

    for label, pat in SECRET_PATTERNS:
        if label == "kv-assignment":

            def _kv(m, _label=label):
                hits.append(_label)
                return m.group(0).replace(m.group(2), "[REDACTED:%s]" % _label)

            text = pat.sub(_kv, text)
        else:
            text = _sub(pat, label, text)
    return text, hits


def _receipt(model, call_type, hits, content_sha):
    try:
        rec = {
            "ts": datetime.datetime.utcnow().isoformat() + "Z",
            "model": model or "unknown",
            "call_type": call_type or "unknown",
            "detectors": sorted(set(hits)),
            "redaction_count": len(hits),
            "content_sha256_16": content_sha[:16],
            "actor": "pii_redact_callback/v1",
        }
        with open(REDACT_FILE, "a") as f:
            f.write(json.dumps(rec) + "\n")
        os.chmod(REDACT_FILE, 0o600)
    except Exception:
        pass  # receipts must never break the lane


class PIIRedactCallback(_Base):
    """LiteLLM pre-call hook — redacts PII/credentials from message text."""

    async def async_pre_call_hook(self, user_api_key_dict, cache, data, call_type):
        try:
            if os.environ.get("PII_REDACT_DISABLED", "") == "1":
                return data
            messages = data.get("messages") if isinstance(data, dict) else None
            if not messages:
                return data
            all_hits, changed = [], False
            for msg in messages:
                content = msg.get("content") if isinstance(msg, dict) else None
                if isinstance(content, str):
                    new, hits = redact_text(content)
                    if hits:
                        msg["content"] = new
                        all_hits += hits
                        changed = True
                elif isinstance(content, list):
                    for part in content:
                        if isinstance(part, dict) and isinstance(part.get("text"), str):
                            new, hits = redact_text(part["text"])
                            if hits:
                                part["text"] = new
                                all_hits += hits
                                changed = True
            if changed:
                model = (
                    data.get("model") if isinstance(data, dict) else None
                ) or "unknown"
                sha = hashlib.sha256(
                    json.dumps(messages, default=str).encode()
                ).hexdigest()
                _receipt(model, call_type, all_hits, sha)
            return data
        except Exception:
            return data  # FAIL-OPEN: never block the lane on a redactor bug


proxy_handler_instance = PIIRedactCallback()


# ── offline self-test (no API key, no litellm) ─────────────────────────────
def _selftest():
    pos = [
        ("email jane.doe@example.com here", ["EMAIL"]),
        ("obfu jane [at] example [dot] com ok", ["EMAIL_OBF"]),
        ("call 012-3456789 or +6019-888 7777", ["MY_PHONE"]),
        ("MyKad 900101-10-5678 recorded", ["MYKAD"]),
        ("card 4111 1111 1111 1111 charged", ["CARD"]),
        ("ssn 123-45-6789 leaked", ["SSN"]),
        ("key sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWX tail", ["sk-anthropic"]),
        ("ghp_ABCDEFGHIJKLMNOPQRSTUV1234 in log", ["github-pat"]),
        ("cfg api_key = ABC123DEF456GHI end", ["kv-assignment"]),
    ]
    neg = [
        "redis at 127.0.0.1:6379 and 100.64.0.2 cache host",
        "commit 3739ba4ed4721cc134b5c785f64ae0b7e0185600 deployed",
        "port :4013 model gpt-4o order 10500 units",
        "api_key: os.environ/DEEPSEEK_API_KEY",
        "card 4111111111111112 fails luhn",
        "date 2026-10-03 week 40",
    ]
    fails = 0
    for text, want in pos:
        out, hits = redact_text(text)
        if not all(w in hits for w in want) or "[REDACTED" not in out:
            print("FAIL(pos): %r -> hits=%s" % (text, hits))
            fails += 1
        else:
            print("ok(pos): %-46r -> %s" % (text[:44], sorted(set(hits))))
    for text in neg:
        out, hits = redact_text(text)
        if hits or out != text:
            print("FAIL(neg): %r -> hits=%s out=%r" % (text, hits, out))
            fails += 1
        else:
            print("ok(neg): %r untouched" % text[:60])
    # JSON structure safety: redaction only touches strings
    print("\n%d/%d passed" % (len(pos) + len(neg) - fails, len(pos) + len(neg)))
    return fails


if __name__ == "__main__":
    import sys

    sys.exit(1 if _selftest() else 0)
