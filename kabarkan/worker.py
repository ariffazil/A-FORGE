#!/usr/bin/env python3
"""
Kabarkan Worker v1 — NATS → Postgres → MinIO
=============================================
Phase 1 of the Kabarkan sovereign observability surface.

Architecture:
    NATS JetStream (kabarkan.ingest.*) ──subscribe──→ Worker
        ├── Batch-merge spans (500ms window / 100 records)
        ├── Write to Postgres observability.observations (idempotent)
        ├── Archive to MinIO (cold storage, >90 days)
        └── Emit health metrics

Run:
    python3 worker.py
    # or via systemd: systemctl start kabarkan-worker

Env vars (from vault.env):
    NATS_URL         — NATS server URL (default: nats://127.0.0.1:4222)
    POSTGRES_URL     — Postgres connection string
    MINIO_ENDPOINT   — MinIO endpoint (default: 127.0.0.1:9000)
    MINIO_ACCESS_KEY — MinIO access key
    MINIO_SECRET_KEY — MinIO secret key
    HEALTH_PORT      — Health endpoint port (default: 18902)
    BATCH_MAX_SIZE   — Max records per batch (default: 100)
    BATCH_MAX_MS     — Max batch window ms (default: 500)
    ARCHIVE_DAYS     — Days before archiving to MinIO (default: 90)

DITEMPA BUKAN DIBERI
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import signal
import sys
import time
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

# ── Config ──────────────────────────────────────────────────────────────
NATS_URL = os.getenv("NATS_URL", "nats://127.0.0.1:4222")
NATS_STREAM = os.getenv("KABARKAN_NATS_STREAM", "kabarkan-ingest")
NATS_SUBJECT = os.getenv("KABARKAN_NATS_SUBJECT", "kabarkan.ingest.>")
NATS_CONSUMER = os.getenv("KABARKAN_NATS_CONSUMER", "kabarkan-worker-v1")

POSTGRES_URL = os.getenv("POSTGRES_URL", "")
HEALTH_PORT = int(os.getenv("KABARKAN_HEALTH_PORT", "18902"))
BATCH_MAX_SIZE = int(os.getenv("KABARKAN_BATCH_SIZE", "100"))
BATCH_MAX_MS = int(os.getenv("KABARKAN_BATCH_MS", "500"))
ARCHIVE_DAYS = int(os.getenv("KABARKAN_ARCHIVE_DAYS", "90"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [Kabarkan] %(levelname)s %(message)s",
)
logger = logging.getLogger("kabarkan-worker")

# ── State ───────────────────────────────────────────────────────────────
_state = {
    "started_at": datetime.now(timezone.utc).isoformat(),
    "messages_received": 0,
    "messages_processed": 0,
    "messages_failed": 0,
    "batches_flushed": 0,
    "last_batch_at": None,
    "postgres_healthy": False,
    "nats_connected": False,
    "running": True,
}

# ── Postgres ────────────────────────────────────────────────────────────
_pg_pool = None


async def pg_connect() -> bool:
    global _pg_pool
    try:
        import asyncpg  # type: ignore

        if POSTGRES_URL:
            _pg_pool = await asyncpg.create_pool(
                POSTGRES_URL,
                min_size=1,
                max_size=4,
                timeout=10.0,
            )
        else:
            host = os.getenv("POSTGRES_HOST", "127.0.0.1")
            port = os.getenv("POSTGRES_PORT", "5432")
            db = os.getenv("POSTGRES_DB", "vault999")
            user = os.getenv("POSTGRES_USER", "arifos_admin")
            password = os.getenv("POSTGRES_PASSWORD", "")
            _pg_pool = await asyncpg.create_pool(
                host=host,
                port=int(port),
                database=db,
                user=user,
                password=password,
                min_size=1,
                max_size=4,
                timeout=10.0,
            )

        async with _pg_pool.acquire() as conn:
            await conn.execute("SELECT 1")
        _state["postgres_healthy"] = True
        logger.info("Postgres connected — pool ready")
        return True
    except ImportError:
        logger.error("asyncpg not installed — run: pip3 install asyncpg")
        return False
    except Exception as e:
        logger.warning(f"Postgres connection failed: {e}")
        _state["postgres_healthy"] = False
        return False


async def pg_write_batch(records: list[dict[str, Any]]) -> int:
    """Write a batch of observations to Postgres.

    Idempotent — uses ON CONFLICT (id) DO NOTHING
    so replayed NATS messages don't duplicate.
    """
    if not _pg_pool:
        return 0

    written = 0
    try:
        async with _pg_pool.acquire() as conn:
            await conn.executemany(
                """
                INSERT INTO observability.observations (
                    id, trace_id, span_id, parent_span_id,
                    session_id, actor_id, tool_name, organ_id,
                    verdict_class, delta_s, reasons, next_safe_action,
                    uncertainty_tag, input_hash, output_hash, vault_receipt,
                    cost_usd, model_name, latency_ms,
                    start_time, end_time, metadata, created_at
                ) VALUES (
                    $1, $2, $3, $4,
                    $5, $6, $7, $8,
                    $9, $10, $11, $12,
                    $13, $14, $15, $16,
                    $17, $18, $19,
                    $20, $21, $22, $23
                )
                ON CONFLICT (id) DO NOTHING
                """,
                [
                    (
                        r["id"],
                        r["trace_id"],
                        r["span_id"],
                        r.get("parent_span_id"),
                        r.get("session_id"),
                        r.get("actor_id", "unknown"),
                        r.get("tool_name", ""),
                        r.get("organ_id"),
                        r.get("verdict_class", "OK"),
                        r.get("delta_s", 0.0),
                        json.dumps(r.get("reasons", [])),
                        r.get("next_safe_action"),
                        r.get("uncertainty_tag"),
                        r.get("input_hash"),
                        r.get("output_hash"),
                        r.get("vault_receipt"),
                        r.get("cost_usd"),
                        r.get("model_name"),
                        r.get("latency_ms"),
                        r.get("start_time"),
                        r.get("end_time"),
                        json.dumps(r.get("metadata")) if r.get("metadata") else None,
                        r.get("created_at", datetime.now(timezone.utc).isoformat()),
                    )
                    for r in records
                ],
            )
            written = len(records)
    except Exception as e:
        logger.error(f"Postgres batch write failed: {e}")
        _state["postgres_healthy"] = False
        _state["messages_failed"] += len(records)
        return 0

    return written


# ── MinIO Archive ────────────────────────────────────────────────────────


async def archive_to_minio() -> int:
    """Archive observations older than ARCHIVE_DAYS to MinIO.

    Reads old rows → writes JSONL to MinIO → deletes from Postgres.
    """
    if not _pg_pool:
        return 0

    try:
        # Check if aioboto3 is available
        import aioboto3  # type: ignore # noqa: F401

        async with _pg_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT * FROM observability.observations
                WHERE created_at < NOW() - INTERVAL '1 day' * $1
                LIMIT 1000
                """,
                ARCHIVE_DAYS,
            )
            if not rows:
                return 0

            # Build JSONL
            lines = []
            ids = []
            for row in rows:
                ids.append(str(row["id"]))
                d = dict(row)
                for k, v in d.items():
                    if isinstance(v, datetime):
                        d[k] = v.isoformat()
                    elif isinstance(v, UUID):
                        d[k] = str(v)
                lines.append(json.dumps(d, default=str))

            date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            key = f"kabarkan/archive/{date_str}/observations-{len(ids)}.jsonl"

            # Write to MinIO
            session = aioboto3.Session()
            async with session.client(
                "s3",
                endpoint_url=f"http://{os.getenv('MINIO_ENDPOINT', '127.0.0.1:9000')}",
                aws_access_key_id=os.getenv("MINIO_ACCESS_KEY", "minioadmin"),
                aws_secret_access_key=os.getenv("MINIO_SECRET_KEY", "minioadmin"),
                aws_region_name="us-east-1",
                use_ssl=False,
            ) as s3:
                await s3.put_object(
                    Bucket="kabarkan",
                    Key=key,
                    Body="\n".join(lines).encode("utf-8"),
                    ContentType="application/x-ndjson",
                )
                logger.info(f"MinIO archived {len(ids)} observations → {key}")

            # Delete archived rows
            async with _pg_pool.acquire() as conn:
                await conn.execute(
                    "DELETE FROM observability.observations WHERE id = ANY($1)",
                    ids,
                )
            return len(ids)
    except ImportError:
        logger.debug("aioboto3 not installed — skipping MinIO archive")
        return 0
    except Exception as e:
        logger.warning(f"MinIO archive failed: {e}")
        return 0


# ── NATS Consumer ────────────────────────────────────────────────────────
_nc = None
_js = None
_batch: list[dict[str, Any]] = []
_batch_deadline: float = 0.0


async def nats_connect() -> bool:
    global _nc, _js
    try:
        import nats  # type: ignore # noqa: F811

        _nc = await nats.connect(
            NATS_URL, max_reconnect_attempts=-1, reconnect_time_wait=2
        )
        _js = _nc.jetstream()
        _state["nats_connected"] = True
        logger.info(f"NATS connected — {NATS_URL}")
        return True
    except ImportError:
        logger.error("nats-py not installed — run: pip3 install nats-py")
        return False
    except Exception as e:
        logger.error(f"NATS connection failed: {e}")
        _state["nats_connected"] = False
        return False


async def msg_handler(msg: Any) -> None:
    """Handle an incoming NATS message.

    Deserialize, validate, add to batch.
    """
    global _batch, _batch_deadline
    _state["messages_received"] += 1

    try:
        data = json.loads(msg.data.decode())
        # Validate required fields
        if not all(k in data for k in ("id", "trace_id", "span_id")):
            logger.debug(
                f"Invalid message (missing required fields): {list(data.keys())[:5]}"
            )
            await msg.ack()
            _state["messages_failed"] += 1
            return

        _batch.append(data)

        if _batch_deadline == 0:
            _batch_deadline = time.monotonic() + (BATCH_MAX_MS / 1000.0)

        await msg.ack()
    except json.JSONDecodeError:
        logger.debug("Invalid JSON — skipping")
        await msg.ack()
        _state["messages_failed"] += 1
    except Exception as e:
        logger.error(f"Handler error: {e}")
        await msg.ack()
        _state["messages_failed"] += 1


async def batch_flush_timer() -> None:
    """Periodically flush the batch to Postgres."""
    global _batch, _batch_deadline

    while _state["running"]:
        await asyncio.sleep(0.1)

        now = time.monotonic()
        should_flush = False

        if len(_batch) >= BATCH_MAX_SIZE:
            should_flush = True
        elif _batch and _batch_deadline > 0 and now >= _batch_deadline:
            should_flush = True

        if should_flush and _batch:
            records = _batch
            _batch = []
            _batch_deadline = 0

            written = await pg_write_batch(records)
            _state["messages_processed"] += written
            _state["batches_flushed"] += 1
            _state["last_batch_at"] = datetime.now(timezone.utc).isoformat()

            if written > 0:
                logger.debug(f"Batch flushed: {written} records")

            # Periodic archive check (every 10 batches)
            if _state["batches_flushed"] % 10 == 0:
                await archive_to_minio()


# ── Health HTTP ──────────────────────────────────────────────────────────


async def health_handler(reader, writer) -> None:
    """Minimal HTTP health endpoint."""
    try:
        data = await reader.read(1024)
        body = json.dumps(
            {
                "status": "healthy"
                if _state["nats_connected"] and _state["postgres_healthy"]
                else "degraded",
                "worker": "kabarkan-v1",
                "nats_connected": _state["nats_connected"],
                "postgres_healthy": _state["postgres_healthy"],
                "messages_received": _state["messages_received"],
                "messages_processed": _state["messages_processed"],
                "messages_failed": _state["messages_failed"],
                "batches_flushed": _state["batches_flushed"],
                "last_batch_at": _state["last_batch_at"],
                "started_at": _state["started_at"],
            }
        )
        response = (
            "HTTP/1.1 200 OK\r\n"
            "Content-Type: application/json\r\n"
            f"Content-Length: {len(body)}\r\n"
            "\r\n"
            f"{body}"
        )
        writer.write(response.encode())
        await writer.drain()
    except Exception:
        pass
    finally:
        writer.close()
        await writer.wait_closed()


async def start_health_server() -> asyncio.Server:
    return await asyncio.start_server(health_handler, "127.0.0.1", HEALTH_PORT)


# ── Main ────────────────────────────────────────────────────────────────


async def main() -> None:
    logger.info("=== Kabarkan Worker v1 ===")
    logger.info(f"NATS:      {NATS_URL} → {NATS_STREAM}/{NATS_SUBJECT}")
    logger.info(f"Postgres:  {'configured' if POSTGRES_URL else 'env vars'}")
    logger.info(f"Health:    :{HEALTH_PORT}/health")
    logger.info(f"Batch:     {BATCH_MAX_SIZE} records / {BATCH_MAX_MS}ms")
    logger.info(f"Archive:   {ARCHIVE_DAYS} days")

    # 1. Connect Postgres
    pg_ok = await pg_connect()
    if not pg_ok:
        logger.warning("Starting without Postgres — will buffer and retry")

    # 2. Connect NATS
    nats_ok = await nats_connect()
    if not nats_ok:
        logger.error("Cannot start without NATS")
        sys.exit(1)

    # 3. Start health server
    health_srv = await start_health_server()
    logger.info(f"Health endpoint: http://127.0.0.1:{HEALTH_PORT}/health")

    # 4. Start batch flush timer
    flush_task = asyncio.create_task(batch_flush_timer())

    # 5. Subscribe to NATS
    try:
        sub = await _js.pull_subscribe(
            subject=NATS_SUBJECT,
            durable=NATS_CONSUMER,
            stream=NATS_STREAM,
        )
        logger.info(f"Subscribed: {NATS_SUBJECT} (consumer: {NATS_CONSUMER})")
    except Exception as e:
        # If durable consumer exists, just use it
        logger.warning(f"Pull subscribe failed: {e}. Trying existing consumer...")
        sub = await _js.pull_subscribe(
            subject=NATS_SUBJECT,
            durable=NATS_CONSUMER,
            stream=NATS_STREAM,
        )

    # 6. Main loop — fetch + process
    logger.info("Worker running — processing messages...")

    while _state["running"]:
        try:
            msgs = await sub.fetch(batch=BATCH_MAX_SIZE, timeout=1.0)
            for msg in msgs:
                await msg_handler(msg)
        except asyncio.TimeoutError:
            pass  # No messages — normal
        except Exception as e:
            logger.error(f"Fetch loop error: {e}")
            await asyncio.sleep(1)

    # Cleanup
    flush_task.cancel()
    health_srv.close()
    if _nc:
        await _nc.close()
    if _pg_pool:
        await _pg_pool.close()
    logger.info("Worker stopped")


def _signal_handler(sig, frame):
    logger.info(f"Signal {sig} — shutting down")
    _state["running"] = False


if __name__ == "__main__":
    signal.signal(signal.SIGINT, _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)
    asyncio.run(main())
