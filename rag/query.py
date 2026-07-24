#!/usr/bin/env python3
"""
RAG Query Tool — A-FORGE Federation
====================================
Embeds a user query via Ollama bge-m3, searches Qdrant federation_documents,
returns top-K chunks with metadata. Optional FLAME answer synthesis.

Usage:
  python query.py "What is the Amanah floor rule?"                    # search only
  python query.py "What is Amanah?" --synthesize --model bge-m3       # search + FLAME answer
  python query.py "What is Amanah?" --top-k 5 --source "/docs/ag.md"  # filter by source
  python query.py --health                                             # probe pipeline

DITEMPA BUKAN DIBERI — Forged, Not Given.
"""

import json
import sys
import time
import subprocess
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError

OLLAMA_EMBED = "http://localhost:11434/api/embed"
QDRANT_SEARCH = "http://localhost:6333/collections/rag_federation_docs/points/search"
DEFAULT_MODEL = "bge-m3"
DEFAULT_TOP_K = 5


def http_post(url: str, payload: dict) -> dict | None:
    req = Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urlopen(req, timeout=60) as r:
            return json.loads(r.read())
    except URLError as e:
        print(f"[ERROR] {url}: {e}", file=sys.stderr)
        return None


def ollama_embed_query(query: str, model: str = DEFAULT_MODEL) -> list[float] | None:
    resp = http_post(OLLAMA_EMBED, {"model": model, "input": [query]})
    if resp is None:
        return None
    embeddings = resp.get("embeddings", [])
    if not embeddings or not embeddings[0]:
        print("[ERROR] Ollama returned empty embedding", file=sys.stderr)
        return None
    return embeddings[0]


def qdrant_search(
    vector: list[float], top_k: int = DEFAULT_TOP_K, source_filter: str = ""
) -> list[dict]:
    payload = {
        "vector": vector,
        "limit": top_k,
        "with_payload": True,
        "score_threshold": 0.3,
    }
    if source_filter:
        payload["filter"] = {
            "must": [{"key": "source", "match": {"value": source_filter}}]
        }

    resp = http_post(QDRANT_SEARCH, payload)
    if resp is None:
        return []
    return resp.get("result", [])


def flame_synthesize(query: str, chunks: list[dict]) -> str:
    context = "\n\n---\n\n".join(
        f"[{c.get('payload', {}).get('chunk_id', '?')}] {c.get('payload', {}).get('text', '')[:2000]}"
        for c in chunks
    )
    prompt = f"""Answer the question using ONLY the context below. If the context does not contain the answer, say "Not found in indexed documents."

Context:
{context}

Question: {query}

Answer:"""

    try:
        result = subprocess.run(
            ["free-llm", prompt, "--mode", "probe"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode == 0:
            return result.stdout.strip()
        return f"[FLAME error: {result.stderr.strip()[:200]}]"
    except Exception as e:
        return f"[FLAME unavailable: {e}]"


def format_results(query: str, results: list[dict], top_k: int) -> str:
    lines = [
        f"# RAG Query Results",
        f"",
        f"**Query:** {query}",
        f"**Results:** {len(results)}/{top_k}",
        "",
    ]
    for i, hit in enumerate(results):
        score = hit.get("score", 0)
        payload = hit.get("payload", {})
        source = payload.get("source", "?")
        heading = payload.get("heading", "")
        text = payload.get("text", "")[:500]
        chunk_id = payload.get("chunk_id", "?")
        lines.append(f"## Result {i + 1} — score: {score:.3f}")
        lines.append(f"**Source:** {source} | **Chunk:** {chunk_id}")
        if heading:
            lines.append(f"**Section:** {heading}")
        lines.append(f"```\n{text}\n```")
        lines.append("")
    return "\n".join(lines)


def main():
    import argparse

    parser = argparse.ArgumentParser(description="A-FORGE RAG Query Tool")
    parser.add_argument("query", nargs="?", help="Natural language query")
    parser.add_argument(
        "--top-k",
        type=int,
        default=DEFAULT_TOP_K,
        help=f"Results to return (default: {DEFAULT_TOP_K})",
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"Ollama embedding model (default: {DEFAULT_MODEL})",
    )
    parser.add_argument("--source", default="", help="Filter by document source")
    parser.add_argument(
        "--synthesize",
        action="store_true",
        help="Pass results to FLAME for answer synthesis",
    )
    parser.add_argument("--json", action="store_true", help="Output raw JSON")
    parser.add_argument("--health", action="store_true", help="Probe pipeline health")
    args = parser.parse_args()

    if args.health:
        from embed_store import health_check as hc  # type: ignore

        h = hc()
        print(json.dumps(h, indent=2))
        sys.exit(0 if all(v for k, v in h.items() if isinstance(v, bool)) else 1)

    if not args.query:
        parser.print_help()
        sys.exit(1)

    t0 = time.monotonic()

    vector = ollama_embed_query(args.query, args.model)
    if vector is None:
        print("[FATAL] Embedding failed", file=sys.stderr)
        sys.exit(1)

    embed_ms = (time.monotonic() - t0) * 1000

    results = qdrant_search(vector, args.top_k, args.source)

    search_ms = (time.monotonic() - t0) * 1000 - embed_ms

    answer = ""
    if args.synthesize and results:
        answer = flame_synthesize(args.query, results)

    total_ms = (time.monotonic() - t0) * 1000

    if args.json:
        output = {
            "query": args.query,
            "model": args.model,
            "top_k": args.top_k,
            "results_count": len(results),
            "results": [
                {
                    "score": round(h.get("score", 0), 4),
                    "chunk_id": (h.get("payload") or {}).get("chunk_id", ""),
                    "source": (h.get("payload") or {}).get("source", ""),
                    "heading": (h.get("payload") or {}).get("heading", ""),
                    "text": ((h.get("payload") or {}).get("text", "") or "")[:1000],
                    "pages": (h.get("payload") or {}).get("pages", []),
                }
                for h in results
            ],
            "answer": answer if args.synthesize else None,
            "timing_ms": {
                "embed": round(embed_ms, 1),
                "search": round(search_ms, 1),
                "total": round(total_ms, 1),
            },
        }
        print(json.dumps(output, indent=2))
    else:
        print(format_results(args.query, results, args.top_k))
        if answer:
            print(f"\n---\n**FLAME Synthesis:**\n{answer}")
        print(
            f"\n*{total_ms:.0f}ms total ({embed_ms:.0f}ms embed + {search_ms:.0f}ms search)*"
        )


if __name__ == "__main__":
    main()
