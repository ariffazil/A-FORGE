#!/usr/bin/env python3
"""
RAG Embed-and-Store Pipeline — A-FORGE Federation
==================================================
Takes document chunks from forge_document_ingest (chunk mode JSON),
embeds via Ollama bge-m3 (:11434), stores in Qdrant federation_documents (:6333).

Usage:
  python embed_store.py chunks.json                        # from file
  cat chunks.json | python embed_store.py --stdin          # from stdin
  python embed_store.py chunks.json --source "/docs/rfc.md"  # tag source
  python embed_store.py --health                            # probe pipeline

DITEMPA BUKAN DIBERI — Forged, Not Given.
"""

import json
import sys
import time
import hashlib
import uuid
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen
from urllib.error import URLError

OLLAMA_EMBED = "http://localhost:11434/api/embed"
COLLECTION = "rag_federation_docs"
QDRANT_UPSERT = f"http://localhost:6333/collections/{COLLECTION}/points"
QDRANT_COUNT = f"http://localhost:6333/collections/{COLLECTION}/points/count"
DEFAULT_MODEL = "bge-m3"
BATCH_SIZE = 16


def http_post(url: str, payload: dict, method: str = "POST") -> dict | None:
    req = Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method=method,
    )
    try:
        with urlopen(req, timeout=120) as r:
            return json.loads(r.read())
    except URLError as e:
        print(f"[ERROR] {url}: {e}", file=sys.stderr)
        return None


def ollama_embed(
    texts: list[str], model: str = DEFAULT_MODEL
) -> list[list[float]] | None:
    payload = {"model": model, "input": texts}
    resp = http_post(OLLAMA_EMBED, payload)
    if resp is None:
        return None
    embeddings = resp.get("embeddings", [])
    if not embeddings:
        print(
            f"[ERROR] Ollama returned no embeddings for {len(texts)} texts",
            file=sys.stderr,
        )
        return None
    return embeddings


def qdrant_upsert(points: list[dict]) -> dict | None:
    payload = {"points": points}
    resp = http_post(f"{QDRANT_UPSERT}?wait=true", payload, method="PUT")
    if resp is None:
        return None
    status = resp.get("result", {}).get("status")
    if status != "completed":
        print(f"[ERROR] Qdrant upsert status: {status}", file=sys.stderr)
        return None
    return resp


def chunk_to_text(chunk: dict) -> str:
    text = chunk.get("text", "")
    heading = chunk.get("heading", "")
    if heading and heading != text[: len(heading)]:
        text = f"{heading}\n{text}"
    return text.strip()


def embed_and_store(
    chunks: list[dict], source: str = "", model: str = DEFAULT_MODEL
) -> int:
    if not chunks:
        print("[WARN] No chunks to embed", file=sys.stderr)
        return 0

    print(f"[EMBED] {len(chunks)} chunks | model={model} | batch={BATCH_SIZE}")
    stored = 0

    for i in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[i : i + BATCH_SIZE]
        texts = [chunk_to_text(c) for c in batch]
        embeddings = ollama_embed(texts, model)

        if embeddings is None:
            print(
                f"[FAIL] Batch {i // BATCH_SIZE} embedding failed, skipping",
                file=sys.stderr,
            )
            continue

        points = []
        for j, (chunk, vector) in enumerate(zip(batch, embeddings)):
            if not vector:
                continue
            chunk_id = chunk.get("chunk_id", f"chunk_{i + j}")
            point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{source}:{chunk_id}"))
            points.append(
                {
                    "id": point_id,
                    "vector": vector,
                    "payload": {
                        "chunk_id": chunk_id,
                        "source": source,
                        "text": chunk_to_text(chunk),
                        "heading": chunk.get("heading", ""),
                        "strategy": chunk.get("strategy", "semantic"),
                        "pages": chunk.get("pages", []),
                        "size_chars": chunk.get("size_chars", 0),
                        "element_count": chunk.get("element_count", 0),
                        "ingested_at": time.strftime(
                            "%Y-%m-%dT%H:%M:%SZ", time.gmtime()
                        ),
                    },
                }
            )

        if points:
            resp = qdrant_upsert(points)
            if resp:
                stored += len(points)
                print(
                    f"  [OK] batch {i // BATCH_SIZE}: {len(points)} vectors stored (total: {stored})"
                )
            else:
                print(
                    f"  [FAIL] batch {i // BATCH_SIZE}: Qdrant upsert failed",
                    file=sys.stderr,
                )

    return stored


def health_check() -> dict:
    result = {"ollama": False, "qdrant": False, "collection": "federation_documents"}
    if http_post(OLLAMA_EMBED, {"model": DEFAULT_MODEL, "input": ["health"]}):
        result["ollama"] = True
    count_resp = http_post(QDRANT_COUNT, {})
    if count_resp:
        result["qdrant"] = True
        result["vector_count"] = count_resp.get("result", {}).get("count", 0)
    return result


def main():
    import argparse

    parser = argparse.ArgumentParser(description="A-FORGE RAG Embed-and-Store Pipeline")
    parser.add_argument("input", nargs="?", help="JSON chunks file (or use --stdin)")
    parser.add_argument(
        "--stdin", action="store_true", help="Read JSON chunks from stdin"
    )
    parser.add_argument(
        "--source", default="", help="Document source label (e.g. /docs/agenda.pdf)"
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"Ollama embedding model (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--health", action="store_true", help="Probe pipeline health only"
    )
    args = parser.parse_args()

    if args.health:
        h = health_check()
        print(json.dumps(h, indent=2))
        ok = all(v for k, v in h.items() if isinstance(v, bool))
        sys.exit(0 if ok else 1)

    if args.stdin:
        raw = sys.stdin.read()
    elif args.input:
        raw = Path(args.input).read_text()
    else:
        parser.print_help()
        sys.exit(1)

    try:
        chunks = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"[ERROR] Invalid JSON: {e}", file=sys.stderr)
        sys.exit(1)

    if isinstance(chunks, dict):
        chunks = chunks.get("chunks", chunks.get("structured_content", []))

    if not isinstance(chunks, list):
        print(
            f"[ERROR] Expected list of chunks, got {type(chunks).__name__}",
            file=sys.stderr,
        )
        sys.exit(1)

    t0 = time.monotonic()
    stored = embed_and_store(chunks, args.source, args.model)
    elapsed = time.monotonic() - t0

    receipt = {
        "pipeline": "embed_store",
        "model": args.model,
        "source": args.source,
        "chunks_received": len(chunks),
        "chunks_stored": stored,
        "collection": "federation_documents",
        "elapsed_s": round(elapsed, 2),
        "vectors_per_second": round(stored / elapsed, 1) if elapsed > 0 else 0,
    }
    print(json.dumps(receipt, indent=2))
    sys.exit(0 if stored > 0 else 1)


if __name__ == "__main__":
    main()
