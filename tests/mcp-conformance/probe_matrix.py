#!/usr/bin/env python3
"""Federation MCP conformance probe — spec 2026-07-28.

Probes every federation organ endpoint with three request shapes and
emits a compact alignment matrix. Report, not gate: exit 0 on completion.

Shapes:
  A (bare)   — server/discover with _meta protocolVersion only
  B (full)   — server/discover with _meta protocolVersion + clientCapabilities,
               plus Mcp-Method header (the 2026-07-28 header/body ratchet)
  C (legacy) — initialize with 2025-11-25, no Mcp-Method (session-era probe)

Classification is code-visible below. No retries, 5s timeout per probe,
exact error strings recorded. Stdlib only.

Usage: python3 probe_matrix.py
"""

import json
import urllib.error
import urllib.request

PROBE_TIMEOUT_S = 5

ENDPOINTS = [
    ("arifOS", 8088),
    ("A-FORGE-sense", 7071),
    ("A-FORGE-forge", 7072),
    ("AAA", 3001),
    ("GEOX", 8081),
    ("WEALTH", 18082),
    ("WELL", 18083),
    ("FRAME", 18085),
    ("HERMES", 18087),
    ("CHRON", 18102),
]

META_FULL = {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": {
        "tools": {},
        "elicitation": {},
        "completions": {},
    },
}

BODY_A = {
    "jsonrpc": "2.0",
    "id": "probe-a",
    "method": "server/discover",
    "params": {"_meta": {"io.modelcontextprotocol/protocolVersion": "2026-07-28"}},
}
BODY_B = {
    "jsonrpc": "2.0",
    "id": "probe-b",
    "method": "server/discover",
    "params": {"_meta": META_FULL},
}
BODY_C = {
    "jsonrpc": "2.0",
    "id": "probe-c",
    "method": "initialize",
    "params": {
        "protocolVersion": "2025-11-25",
        "capabilities": {},
        "clientInfo": {"name": "conformance-probe", "version": "0.1"},
    },
}


def post(port, body, extra_headers=None):
    req = urllib.request.Request(
        f"http://127.0.0.1:{port}/mcp",
        data=json.dumps(body).encode(),
        headers={
            "Content-Type": "application/json",
            # Streamable HTTP content negotiation: servers 406 without both.
            "Accept": "application/json, text/event-stream",
            **(extra_headers or {}),
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=PROBE_TIMEOUT_S) as resp:
            raw = resp.read().decode(errors="replace")
            return resp.status, dict(resp.headers), raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        return e.code, dict(e.headers), raw
    except Exception as e:  # noqa: BLE001 — probe report records any failure
        return 0, {}, f"{type(e).__name__}: {e}"


def classify(a, b, c):
    """ALIGNED / PARTIAL / LEGACY_SESSION / LEGACY_NO_DISCOVER / NO_MCP_SURFACE / A2A_OTHER."""
    code_a, _, raw_a = a
    code_b, hdrs_b, raw_b = b
    code_c, hdrs_c, raw_c = c

    if "A2A Gateway" in raw_c or "A2A Gateway" in raw_a:
        return "A2A_OTHER"
    if code_b == 404 and code_a == 404:
        return "NO_MCP_SURFACE"

    def is_discover_ok(raw, code):
        if code != 200:
            return False
        try:
            d = json.loads(raw)
        except json.JSONDecodeError:
            return False
        r = d.get("result") or {}
        return r.get("resultType") == "complete" or "supportedVersions" in r

    if is_discover_ok(raw_b, code_b):
        return "ALIGNED"
    if "Mcp-Session-Id header is required" in raw_a or "Mcp-Session-Id header is required" in raw_b or "Mcp-Session-Id header required" in raw_b or "SESSION_MISSING" in raw_c or "Mcp-Session-Id header required" in raw_a or "Server not initialized" in raw_a or "Server not initialized" in raw_b:
        return "LEGACY_SESSION"
    if "Method not found" in raw_b:
        return "LEGACY_NO_DISCOVER"
    return "PARTIAL"


def main():
    rows = []
    for name, port in ENDPOINTS:
        a = post(port, BODY_A, {"MCP-Protocol-Version": "2026-07-28"})
        b = post(
            port,
            BODY_B,
            {"MCP-Protocol-Version": "2026-07-28", "Mcp-Method": "server/discover"},
        )
        c = post(port, BODY_C)

        # classify needs shape-A status too
        code_a = a[0]
        verdict = classify((code_a, a[1], a[2]), b, c)
        if verdict == "NO_MCP_SURFACE":
            # Distinguish a non-MCP gateway (A2A) from a genuinely missing surface.
            try:
                with urllib.request.urlopen(
                    f"http://127.0.0.1:{port}/", timeout=PROBE_TIMEOUT_S
                ) as resp:
                    if "A2A" in resp.read().decode(errors="replace"):
                        verdict = "A2A_OTHER"
            except Exception:  # noqa: BLE001 — probe refinement only
                pass

        versions = ""
        try:
            r = (json.loads(b[2]).get("result") or {}) if b[0] == 200 else {}
            versions = ",".join(r.get("supportedVersions", []))
        except json.JSONDecodeError:
            pass

        err = ""
        if verdict not in ("ALIGNED", "A2A_OTHER"):
            for raw in (b[2], a[2], c[2]):
                try:
                    d = json.loads(raw)
                    if "error" in d:
                        err = d["error"].get("message", "")[:80]
                        break
                except json.JSONDecodeError:
                    if raw:
                        err = raw[:80]
                        break

        rows.append((name, port, b[0], verdict, versions, err))
        print(
            f"{name:<14} :{port}  HTTP {b[0]:<3} {verdict:<20} {versions:<45} {err}"
        )

    aligned = sum(1 for r in rows if r[3] == "ALIGNED")
    print(f"\n{aligned}/{len(rows)} endpoints ALIGNED with MCP 2026-07-28 "
          f"({len(rows) - aligned} need work or are non-MCP by design)")


if __name__ == "__main__":
    main()
