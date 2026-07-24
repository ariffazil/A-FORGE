#!/usr/bin/env python3
"""
Patch telemetry.py to add NATS publishing for Kabarkan.

Usage:
    python3 patch_telemetry.py /root/arifOS/arifosmcp/runtime/telemetry.py

Adds:
    1. _nats_client + _nats_loop globals
    2. _publish_to_nats() function (fire-and-forget NATS publish)
    3. Call to _publish_to_nats() in record_tool_call()

DITEMPA BUKAN DIBERI
"""

import re
import sys


NATS_IMPORT = """
# ── Kabarkan NATS publisher ─────────────────────────────────────────
_nats_client: Any = None
_nats_loop: Any = None


def _get_nats() -> Any:
    global _nats_client, _nats_loop
    if _nats_client is not None:
        return _nats_client
    try:
        import asyncio
        import threading

        _nats_loop = asyncio.new_event_loop()

        def _run_nats():
            asyncio.set_event_loop(_nats_loop)
            _nats_loop.run_forever()

        t = threading.Thread(target=_run_nats, daemon=True)
        t.start()

        async def _connect():
            import nats
            return await nats.connect(
                os.getenv("NATS_URL", "nats://127.0.0.1:4222"),
                max_reconnect_attempts=-1,
            )

        future = asyncio.run_coroutine_threadsafe(_connect(), _nats_loop)
        _nats_client = future.result(timeout=5)
        logger.info("[Telemetry] Kabarkan NATS publisher connected")
    except ImportError:
        logger.debug("[Telemetry] nats-py not installed")
    except Exception as e:
        logger.debug(f"[Telemetry] Kabarkan NATS connect failed: {e}")
        _nats_client = None
    return _nats_client


def _publish_to_nats(record: dict[str, Any]) -> None:
    \"\"\"Fire-and-forget publish to Kabarkan NATS stream.
    
    Never blocks — failures are silently dropped.
    Kabarkan Worker picks up from JetStream.
    \"\"\"
    nc = _get_nats()
    if nc is None or _nats_loop is None:
        return
    try:
        import json
        payload = json.dumps(record, default=str)
        subject = f"kabarkan.ingest.span.{record.get('tool_name', 'unknown')}"
        asyncio.run_coroutine_threadsafe(
            nc.publish(subject, payload.encode()),
            _nats_loop,
        )
    except Exception:
        pass  # Silent — telemetry must never block the kernel
"""

NATS_CALL = """
            # ── Kabarkan NATS publish (Phase 1) ───────────────────────
            _publish_to_nats({
                "id": str(uuid4()),
                "trace_id": str(uuid4()),
                "span_id": str(uuid4()),
                "session_id": session_id,
                "actor_id": actor_id or "unknown",
                "tool_name": tool,
                "organ_id": metadata.get("organ_id") if metadata else None,
                "verdict_class": verdict.upper(),
                "delta_s": delta_s,
                "reasons": reasons or [],
                "next_safe_action": next_safe_action,
                "input_hash": input_hash,
                "output_hash": output_hash,
                "vault_receipt": vault_receipt,
                "latency_ms": latency,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
"""


def patch_file(filepath: str) -> bool:
    with open(filepath, "r") as f:
        content = f.read()

    # Check if already patched
    if "_publish_to_nats" in content:
        print("telemetry.py already contains Kabarkan NATS producer — skipping")
        return True

    # 1. Add import for uuid if not present
    if "from uuid import uuid4" not in content:
        content = content.replace(
            "from __future__ import annotations",
            "from __future__ import annotations\nimport os",
        )
        content = content.replace(
            "import logging\nimport os",
            "import logging\nimport os",
        )
        # Add uuid4 import
        content = content.replace(
            "from datetime import datetime, timezone",
            "from datetime import datetime, timezone\nfrom uuid import uuid4",
        )

    # 2. Add NATS globals + _publish_to_nats function after _get_local_backend
    # Find the end of _get_local_backend function (look for return None after it)
    marker = "    return None\n\n\ndef _hash_payload"
    if marker in content:
        content = content.replace(
            marker, "    return None\n" + NATS_IMPORT + "\n\ndef _hash_payload"
        )
    else:
        # Fallback: insert before _hash_payload
        content = content.replace(
            "\n\ndef _hash_payload",
            NATS_IMPORT + "\n\ndef _hash_payload",
        )

    # 3. Add NATS publish call in record_tool_call
    # Find the end of the Langfuse span block and before the local backend block
    marker2 = (
        "            # ── Local backend (Kabarkan) ────────────────────────────────────"
    )
    if marker2 in content:
        content = content.replace(
            marker2,
            NATS_CALL + "\n" + marker2,
        )
    else:
        print("WARNING: Could not find Local backend marker — add NATS call manually")

    # Write back
    with open(filepath, "w") as f:
        f.write(content)

    print(f"telemetry.py patched successfully: {filepath}")
    return True


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <path/to/telemetry.py>")
        sys.exit(1)

    filepath = sys.argv[1]
    success = patch_file(filepath)
    sys.exit(0 if success else 1)
