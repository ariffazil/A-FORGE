#!/usr/bin/env python3
"""arifFlow adapter — governed bridge between Rust core and arifOS federation.

Phase 2 target. 888-HOLD on production deploy until three conditions pass:
  1. FFI ke arif_judge stabil (100 calls, 0 failures)
  2. Verdict timeout + retry jelas (arifOS down → HOLD <15s)
  3. Crash recovery dari checkpoint terbukti selamat

DITEMPA BUKAN DIBERI — Invariants A1-A5 enforced at every function boundary.
"""

from __future__ import annotations

import json
import logging
import os
import select
import signal
import subprocess
import sys
import time
import uuid
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Optional

import requests

logger = logging.getLogger("ariflow_adapter")

# ─── Types ──────────────────────────────────────────────────────────────

ARIF_JUDGE_TIMEOUT = 10  # seconds per call
MAX_RETRIES = 3
RETRY_BACKOFF = [1, 2, 4]  # seconds
RUST_BINARY = os.environ.get(
    "ARIFLOW_BINARY",
    "/root/arifFlow/target/release/ariflow",
)
_raw_arifos_url = os.environ.get("ARIFOS_MCP_URL", "http://localhost:8088/mcp")
# Ensure /mcp path suffix — env var may point to root :port only
ARIFOS_MCP_URL = (
    _raw_arifos_url
    if _raw_arifos_url.rstrip("/").endswith("/mcp")
    else _raw_arifos_url.rstrip("/") + "/mcp"
)
KABARKAN_URL = os.environ.get(
    "KABARKAN_URL",
    None,  # optional — emit to stderr if unset
)
VAULT999_WRITER = os.environ.get(
    "VAULT999_WRITER",
    "/root/.local/share/arifos/vault999/",  # directory for micro-receipts
)


@dataclass
class VerdictResult:
    """Result from arifOS 888-JUDGE."""

    verdict: str  # SEAL | HOLD | VOID | SABAR
    verdict_id: str
    hash: str
    chain_id: str


@dataclass
class CheckpointEnvelope:
    """One super-step checkpoint (matches Rust CheckpointEnvelope)."""

    step: int
    state_root: str
    lease_id: str
    chain_id: str
    verdict_id: Optional[str] = None
    verdict_class: Optional[str] = None
    previous_hash: str = "0" * 64
    timestamp_ns: int = 0

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class CoolingReceipt:
    """Final receipt for one arifFlow run (A5 metabolic closure)."""

    total_steps: int
    final_state_root: str
    lease_id: str
    chain_id: str
    actor_id: str
    leases_closed: int = 1
    verdicts_seal: int = 0
    verdicts_hold: int = 0
    verdicts_void: int = 0

    def to_dict(self) -> dict:
        return asdict(self)


# ─── Core Adapter ────────────────────────────────────────────────────────


class ArifFlowAdapter:
    """Supervises a Rust arifFlow subprocess.

    Governed invariants:
      A1 — No step without lease. spawn() generates lease, Rust rejects nil.
      A2 — State crosses planes via signed envelopes only (JSON-L proof).
      A3 — Every step produces a checkpoint. Crash recovery re-verifies authority.
      A4 — Merge is deterministic. Divergence → HOLD.
      A5 — Every run ends with cooling receipt. No orphaned channels.
    """

    def __init__(
        self,
        binary_path: str = RUST_BINARY,
        actor_id: str = "333-AGI",
    ):
        self.binary_path = Path(binary_path)
        self.actor_id = actor_id
        self.process: Optional[subprocess.Popen] = None
        self.lease_id: Optional[str] = None
        self.chain_id: Optional[str] = None
        self.current_topology: Optional[str] = None
        self.checkpoints: list[CheckpointEnvelope] = []
        self._cooling: Optional[CoolingReceipt] = None

        # Counters for cooling receipt
        self._total_steps = 0
        self._seal_count = 0
        self._hold_count = 0
        self._void_count = 0

    # ── Lifecycle ────────────────────────────────────────────────────

    def spawn(self, topology: str) -> str:
        """Start Rust subprocess. Returns lease_id (A1)."""
        if not self.binary_path.exists():
            raise FileNotFoundError(
                f"arifFlow binary not found at {self.binary_path}. "
                f"Run: cargo build --release in /root/arifFlow/"
            )

        self.current_topology = topology
        self.lease_id = str(uuid.uuid4())
        self.chain_id = str(uuid.uuid4())
        self.checkpoints = []

        self.process = subprocess.Popen(
            [str(self.binary_path)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,  # line-buffered
        )

        # Configure the Rust core
        self._send(
            {
                "type": "configure",
                "topology": topology,
                "lease_id": self.lease_id,
                "actor_id": self.actor_id,
                "chain_id": self.chain_id,
            }
        )

        self._emit_kabarkan(
            "flow_started",
            {
                "topology": topology,
                "lease_id": self.lease_id,
                "chain_id": self.chain_id,
                "actor_id": self.actor_id,
            },
        )

        logger.info("arifFlow spawned: topology=%s lease=%s", topology, self.lease_id)
        return self.lease_id

    def close(self) -> CoolingReceipt:
        """Graceful shutdown. Sends stop, waits for cooling receipt (A5)."""
        if not self.process:
            raise RuntimeError("No process to close")

        self._send({"type": "stop"})
        cooling_msg = self._recv(timeout=5.0)

        # Terminate process
        self.process.wait(timeout=5)

        self._cooling = CoolingReceipt(
            total_steps=self._total_steps,
            final_state_root=cooling_msg.get("final_root", "0" * 64),
            lease_id=self.lease_id or "",
            chain_id=self.chain_id or "",
            actor_id=self.actor_id,
            leases_closed=1,
            verdicts_seal=self._seal_count,
            verdicts_hold=self._hold_count,
            verdicts_void=self._void_count,
        )

        self._emit_kabarkan("flow_completed", self._cooling.to_dict())
        self._write_vault999_receipt(self._cooling)
        logger.info(
            "arifFlow closed: %d steps, %d SEAL, %d HOLD, %d VOID",
            self._total_steps,
            self._seal_count,
            self._hold_count,
            self._void_count,
        )

        return self._cooling

    # ── Execution ────────────────────────────────────────────────────

    def seed_channel(self, channel: str, data: str):
        """Seed initial data into a channel before running steps."""
        self._send({"type": "seed", "channel": channel, "data": data})

    def run_step(self, nodes: list[dict]) -> dict:
        """Execute one governed super-step.

        Protocol (A3):
          1. Send nodes to Rust (stdin)
          2. Receive `need_verdict` from Rust (stdout)
          3. Call arifOS 888-JUDGE
          4. Send verdict back to Rust (stdin)
          5. Receive `step_result` from Rust (stdout)
          6. If SEAL: write checkpoint, emit VAULT999 micro-seal
          7. If HOLD/VOID: discard deltas, log breach
        """
        if not self.process:
            raise RuntimeError("Adapter not spawned. Call spawn() first.")

        # ── Step 1: Dispatch to Rust ──
        self._send({"type": "step", "nodes": nodes})

        # ── Step 2: Wait for verdict request ──
        msg = self._recv()
        if msg.get("type") != "need_verdict":
            # Could be divergence or error
            if msg.get("type") == "divergence":
                self._handle_divergence(msg)
                return {"verdict": "HOLD", "reason": "divergence", "detail": msg}
            raise RuntimeError(
                f"Expected need_verdict, got: {msg.get('type')}: {msg.get('error', '')}"
            )

        # ── Step 3: Call arifOS 888-JUDGE ──
        verdict = self._call_arif_judge(
            state_root=msg["state_root"],
            lease_id=msg["lease_id"],
            chain_id=msg["chain_id"],
        )

        # ── Step 4: Send verdict to Rust ──
        self._send(
            {
                "type": "verdict",
                "class": verdict.verdict,
                "verdict_id": verdict.verdict_id,
                "hash": verdict.hash,
            }
        )

        # ── Step 5: Receive result ──
        result = self._recv()

        # Update counters
        self._total_steps += 1
        if verdict.verdict == "SEAL":
            self._seal_count += 1
        elif verdict.verdict in ("HOLD", "SABAR"):
            self._hold_count += 1
        elif verdict.verdict == "VOID":
            self._void_count += 1

        # ── Step 6+7: Post-verdict actions ──
        envelope = CheckpointEnvelope(
            step=result.get("step", self._total_steps),
            state_root=result.get("state_root", "0" * 64),
            lease_id=self.lease_id or "",
            chain_id=self.chain_id or "",
            verdict_id=verdict.verdict_id,
            verdict_class=verdict.verdict,
            timestamp_ns=time.time_ns(),
        )

        # A3: Every step produces a checkpoint — even HOLD/VOID/SABAR
        # Crash recovery needs state for restoration regardless of verdict
        self.checkpoints.append(envelope)

        if verdict.verdict == "SEAL":
            self._write_vault999_micro_seal(envelope)
            self._emit_kabarkan("super_step_sealed", envelope.to_dict())
        else:
            self._emit_kabarkan(
                "super_step_blocked",
                {
                    **envelope.to_dict(),
                    "reason": verdict.verdict,
                },
            )

        return {
            "step": envelope.step,
            "verdict": verdict.verdict,
            "verdict_id": verdict.verdict_id,
            "state_root": envelope.state_root,
            "deltas": result.get("deltas", {}),
        }

    # ── Crash Recovery (A3) ──────────────────────────────────────────

    def restore_from_checkpoint(self, step_index: int) -> bool:
        """Re-verify authority and restore state from checkpoint.

        A3 invariant: Crash recovery MUST re-verify authority via arifOS
        before resuming. If the constitutional_chain_id has been voided
        by post-hoc audit, the checkpoint is invalidated.
        """
        if step_index >= len(self.checkpoints):
            logger.error(
                "Checkpoint %d not found (have %d)", step_index, len(self.checkpoints)
            )
            return False

        cp = self.checkpoints[step_index]

        # Re-verify authority
        validation = self._call_validate_checkpoint(cp.chain_id, cp.verdict_id or "")
        if not validation.get("allowed", False):
            logger.critical(
                "Checkpoint %d INVALID: chain_id=%s verdict_id=%s — BREACH",
                step_index,
                cp.chain_id,
                cp.verdict_id,
            )
            self._emit_kabarkan(
                "breach",
                {
                    "reason": "checkpoint_invalid",
                    "step": step_index,
                    "chain_id": cp.chain_id,
                },
            )
            return False

        # Re-spawn and replay checkpoints up to this step
        self.spawn(self.current_topology or "fan_out")
        for i, saved_cp in enumerate(self.checkpoints):
            if i > step_index:
                break
            self._send({"type": "restore", "checkpoint": saved_cp.to_dict()})
            self._recv()  # ack

        logger.info("Restored to checkpoint %d (chain_id=%s)", step_index, cp.chain_id)
        return True

    # ── Internal: FFI to arifOS ──────────────────────────────────────

    def _call_arif_judge(
        self,
        state_root: str,
        lease_id: str,
        chain_id: str,
    ) -> VerdictResult:
        """Call arifOS 888-JUDGE via MCP. Retry with backoff on failure.

        If arifOS is unreachable after MAX_RETRIES, return HOLD (safe fallback).
        """
        last_error = None
        for attempt in range(MAX_RETRIES):
            try:
                resp = requests.post(
                    ARIFOS_MCP_URL,
                    json={
                        "jsonrpc": "2.0",
                        "method": "tools/call",
                        "params": {
                            "name": "arif_judge",
                            "arguments": {
                                "mode": "intercept",
                                "session_token": lease_id,
                                "intent": f"arifFlow super-step {self._total_steps} for chain {chain_id}",
                                "evidence": [{"state_root": state_root}],
                            },
                        },
                        "id": str(uuid.uuid4()),
                    },
                    headers={"Accept": "application/json"},
                    timeout=ARIF_JUDGE_TIMEOUT,
                )
                data = resp.json()
                # Parse verdict from MCP response
                # arifOS returns verdict in result.content[0].text as JSON string
                result_text = (
                    data.get("result", {}).get("content", [{}])[0].get("text", "{}")
                )
                verdict_data = json.loads(result_text)

                # Extract verdict: try multiple paths
                vclass = "HOLD"
                # Path 1: verdicts.action.state
                action_state = (
                    verdict_data.get("verdicts", {}).get("action", {}).get("state", "")
                )
                if action_state in ("APPROVED", "PROCEED"):
                    vclass = "SEAL"
                elif action_state in ("HOLD", "SABAR"):
                    vclass = action_state
                elif action_state == "VOID":
                    vclass = "VOID"
                # Path 2: canonical_verdict
                canonical = verdict_data.get("canonical_verdict", "")
                if canonical in ("SEAL", "HOLD", "VOID", "SABAR"):
                    vclass = canonical

                vid = verdict_data.get("verdict_id", str(uuid.uuid4()))
                vhash = verdict_data.get(
                    "state_hash", verdict_data.get("call_hash", "0" * 64)
                )

                logger.debug(
                    "888-JUDGE: %s (lease=%s, step=%d)",
                    vclass,
                    lease_id,
                    self._total_steps,
                )
                return VerdictResult(
                    verdict=vclass,
                    verdict_id=vid,
                    hash=vhash,
                    chain_id=chain_id,
                )

            except (requests.Timeout, ConnectionError, json.JSONDecodeError) as e:
                last_error = e
                if attempt < MAX_RETRIES - 1:
                    delay = RETRY_BACKOFF[attempt]
                    logger.warning(
                        "arif_judge call %d/%d failed: %s. Retrying in %ds...",
                        attempt + 1,
                        MAX_RETRIES,
                        e,
                        delay,
                    )
                    self._emit_kabarkan(
                        "verdict_retry",
                        {
                            "attempt": attempt + 1,
                            "error": str(e),
                            "backoff_s": delay,
                        },
                    )
                    time.sleep(delay)

        # All retries exhausted — safe HOLD (A1: constitutional-first)
        logger.error(
            "arif_judge unreachable after %d retries. Forcing HOLD.", MAX_RETRIES
        )
        self._emit_kabarkan(
            "verdict_timeout_hold",
            {
                "lease_id": lease_id,
                "chain_id": chain_id,
                "step": self._total_steps,
                "last_error": str(last_error),
            },
        )
        return VerdictResult(
            verdict="HOLD",
            verdict_id=str(uuid.uuid4()),
            hash="0" * 64,
            chain_id=chain_id,
        )

    def _call_validate_checkpoint(self, chain_id: str, verdict_id: str) -> dict:
        """Call arifOS to validate a checkpoint's constitutional authority.

        Returns {"allowed": True/False}.
        """
        try:
            resp = requests.post(
                ARIFOS_MCP_URL,
                json={
                    "jsonrpc": "2.0",
                    "method": "tools/call",
                    "params": {
                        "name": "arif_judge",
                        "arguments": {
                            "mode": "validate",
                            "verdict_id": verdict_id,
                            "intent": f"validate checkpoint for chain {chain_id}",
                        },
                    },
                    "id": str(uuid.uuid4()),
                },
                timeout=ARIF_JUDGE_TIMEOUT,
            )
            data = resp.json()
            result_text = (
                data.get("result", {}).get("content", [{}])[0].get("text", "{}")
            )
            result = json.loads(result_text)
            allowed = result.get("allowed", result.get("valid", False))
            return {"allowed": allowed}

        except (requests.Timeout, ConnectionError, json.JSONDecodeError) as e:
            logger.error("Checkpoint validation failed: %s", e)
            return {"allowed": False}

    # ── Internal: Divergence Handling (A4) ───────────────────────────

    def _handle_divergence(self, msg: dict):
        """Handle divergent merge from Rust core.

        A4: Divergence → emit signal → 888-HOLD.
        """
        logger.warning(
            "DIVERGENCE at step %s: expected=%s actual=%s",
            msg.get("step"),
            msg.get("expected"),
            msg.get("actual"),
        )
        self._emit_kabarkan(
            "divergence",
            {
                "step": msg.get("step"),
                "expected_root": msg.get("expected"),
                "actual_root": msg.get("actual"),
                "nodes": msg.get("nodes", []),
            },
        )

    # ── Internal: I/O ────────────────────────────────────────────────

    def _send(self, msg: dict):
        """Write JSON-L to Rust stdin."""
        if not self.process or not self.process.stdin:
            raise RuntimeError("Process not running")
        line = json.dumps(msg) + "\n"
        self.process.stdin.write(line)
        self.process.stdin.flush()

    def _recv(self, timeout: float = 10.0) -> dict:
        """Read JSON-L from Rust stdout with timeout."""
        if not self.process or not self.process.stdout:
            raise RuntimeError("Process not running")

        readable, _, _ = select.select([self.process.stdout], [], [], timeout)
        if readable:
            line = self.process.stdout.readline()
            if not line:
                # Process died
                stderr_output = (
                    self.process.stderr.read() if self.process.stderr else ""
                )
                raise RuntimeError(
                    f"arifFlow process died unexpectedly.\n"
                    f"Return code: {self.process.returncode}\n"
                    f"Stderr: {stderr_output}"
                )
            return json.loads(line)

        raise TimeoutError(
            f"No response from arifFlow after {timeout}s "
            f"(step={self._total_steps}, topology={self.current_topology})"
        )

    # ── Internal: Kabarkan Observability ─────────────────────────────

    def _emit_kabarkan(self, event_type: str, data: dict):
        """Emit trace event to Kabarkan (or stderr if not configured)."""
        event = {
            "source": "arifflow",
            "type": event_type,
            "timestamp": time.time_ns(),
            "lease_id": self.lease_id,
            "chain_id": self.chain_id,
            "data": data,
        }
        line = json.dumps(event)
        if KABARKAN_URL:
            try:
                requests.post(KABARKAN_URL, json=event, timeout=2)
            except Exception:
                logger.debug("Kabarkan unavailable: %s", event_type)
        else:
            print(line, file=sys.stderr, flush=True)

    # ── Internal: VAULT999 Micro-Seals ───────────────────────────────

    def _write_vault999_micro_seal(self, envelope: CheckpointEnvelope):
        """Write one per-step envelope to VAULT999 (A3)."""
        vault_dir = Path(VAULT999_WRITER)
        vault_dir.mkdir(parents=True, exist_ok=True)
        receipt_path = vault_dir / f"flow_step_{envelope.step}.json"
        receipt_path.write_text(json.dumps(envelope.to_dict(), indent=2))

    def _write_vault999_receipt(self, cooling: CoolingReceipt):
        """Write cooling receipt to VAULT999 (A5)."""
        vault_dir = Path(VAULT999_WRITER)
        vault_dir.mkdir(parents=True, exist_ok=True)
        receipt_path = vault_dir / f"flow_cooling_{cooling.lease_id[:8]}.json"
        receipt_path.write_text(json.dumps(cooling.to_dict(), indent=2))


# ─── CLI Entry Point ─────────────────────────────────────────────────────


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="arifFlow adapter — governed bridge between Rust core and arifOS federation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Invariants:
  A1 — No step without lease. Every run is bound to actor_id + lease_id.
  A2 — State crosses planes via signed envelopes (JSON-L on stdin/stdout).
  A3 — Every step produces a checkpoint. Crash recovery re-verifies authority.
  A4 — Merge is deterministic. Divergence → HOLD.
  A5 — Every run ends with cooling receipt. No orphaned channels.

888-HOLD on production deploy until:
  1. FFI ke arif_judge stabil (100 calls, 0 failures)
  2. Verdict timeout jelas (arifOS down → HOLD <15s)
  3. Crash recovery terbukti selamat
        """,
    )
    parser.add_argument(
        "--topology",
        required=True,
        choices=["fan_out", "pipeline", "cascade"],
        help="Topology to execute",
    )
    parser.add_argument(
        "--actor",
        default="333-AGI",
        help="Actor ID for lease binding (A1)",
    )
    parser.add_argument(
        "--binary",
        default=RUST_BINARY,
        help="Path to arifFlow Rust binary",
    )
    parser.add_argument(
        "--seed",
        type=str,
        default=None,
        help='JSON: {"channel_name": "data", ...}',
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable debug logging",
    )

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        stream=sys.stderr,
    )

    # Parse seed data
    seed_data = {}
    if args.seed:
        seed_data = json.loads(args.seed)

    # ── Run ──
    adapter = ArifFlowAdapter(binary_path=args.binary, actor_id=args.actor)
    lease_id = adapter.spawn(args.topology)
    print(json.dumps({"status": "spawned", "lease_id": lease_id}), flush=True)

    # Seed channels
    for channel, data in seed_data.items():
        adapter.seed_channel(channel, data)

    try:
        # Read node definitions from stdin (one JSON array per line)
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                nodes = json.loads(line)
            except json.JSONDecodeError as e:
                logger.error("Invalid input: %s", e)
                continue

            result = adapter.run_step(nodes)
            print(json.dumps(result), flush=True)
    except EOFError:
        pass
    except KeyboardInterrupt:
        logger.info("Interrupted — closing...")
    finally:
        cooling = adapter.close()
        print(json.dumps({"type": "cooling", "receipt": cooling.to_dict()}), flush=True)
        logger.info(
            "Done: %d steps (%d SEAL, %d HOLD, %d VOID)",
            cooling.total_steps,
            cooling.verdicts_seal,
            cooling.verdicts_hold,
            cooling.verdicts_void,
        )


if __name__ == "__main__":
    main()
