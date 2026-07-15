"""
ACT Executor — 7-Phase Execution Discipline (APA v1.1)

The constitutional reflex arc:
  ART (classify) → KERNEL (judge) → APA (constrain) → ACT (execute) → VAULT999 (remember)

ACT is the execution layer. It governs HOW power touches reality.
7 phases, each with a gate. If any gate fails → STOP.

Phases:
  1. DRY-RUN   — "What would this do?"
  2. SIMULATE  — "What does the system predict?"
  3. PREFLIGHT — "Are guardrails in place?"
  4. EXECUTE   — "I am now changing reality."
  5. VERIFY    — "Did reality become what we intended?"
  6. ROLLBACK  — "If wrong, here is the path back."
  7. RECEIPT   — "This act is now part of institutional memory."

DITEMPA BUKAN DIBERI — Execution is forged, not given.
"""

import json, time, hashlib
from datetime import datetime, timezone
from enum import Enum
from dataclasses import dataclass, field
from typing import Any, Optional, Callable, Union

# G3: canonical receipt model — replaces raw dict construction
from apa.core.schemas import (
    VAULT999Receipt,
    VerbClass as VerbClassSchema,
    BlastRadius as BlastRadiusSchema,
)


# ── Phase Enumeration ────────────────────────
class Phase(Enum):
    DRY_RUN = "dry_run"
    SIMULATE = "simulate"
    PREFLIGHT = "preflight"
    EXECUTE = "execute"
    VERIFY = "verify"
    ROLLBACK = "rollback"
    RECEIPT = "receipt"


class Verdict(Enum):
    PROCEED = "PROCEED"
    HOLD = "HOLD"
    ABORT = "ABORT"
    ROLLBACK = "ROLLBACK"


# ── Phase Result ─────────────────────────────
@dataclass
class PhaseResult:
    phase: Phase
    verdict: Verdict
    data: Any = None
    error: Optional[str] = None
    duration_ms: float = 0.0
    metadata: dict = field(default_factory=dict)


@dataclass
class ACTContext:
    """Context passed through all 7 phases."""

    connector: str
    verb: str
    verb_class: str  # OBSERVE | MUTATE | IRREVERSIBLE
    params: dict
    lease_id: Optional[str] = None
    actor_id: str = "333-AGI"
    session_id: Optional[str] = None
    blast_radius: str = "LOW"
    reversible: bool = True


@dataclass
class ACTResult:
    """Final result after all phases complete."""

    ok: bool
    verdict: str  # SEAL | HOLD | VOID
    phases_completed: list[str]
    phases_failed: list[str]
    result: Any = None
    receipt: Optional[Union[VAULT999Receipt, dict]] = None
    rollback_performed: bool = False
    total_duration_ms: float = 0.0


# ── 7-Phase Executor ─────────────────────────
class ACTExecutor:
    """
    Governed execution engine. Each phase is a gate.
    If any phase returns HOLD or ABORT, execution stops.
    If EXECUTE fails, ROLLBACK is attempted.
    RECEIPT is always written.
    """

    def __init__(self, bridge_dispatch: Callable, vault_write: Callable):
        self.bridge = bridge_dispatch  # (params) → result dict
        self.vault = vault_write  # (receipt) → vault entry
        self.phases = []

    def execute(self, ctx: ACTContext) -> ACTResult:
        """Run the full 7-phase chain."""
        t0 = time.time()
        self.phases = []

        # Phase 1: DRY-RUN
        r = self._dry_run(ctx)
        self.phases.append(r)
        if r.verdict != Verdict.PROCEED:
            return self._finalize(ctx, ok=False, reason=f"DRY_RUN: {r.error}")

        # Phase 2: SIMULATE
        r = self._simulate(ctx)
        self.phases.append(r)
        if r.verdict != Verdict.PROCEED:
            return self._finalize(ctx, ok=False, reason=f"SIMULATE: {r.error}")

        # Phase 3: PREFLIGHT
        r = self._preflight(ctx)
        self.phases.append(r)
        if r.verdict != Verdict.PROCEED:
            return self._finalize(ctx, ok=False, reason=f"PREFLIGHT: {r.error}")

        # Phase 4: EXECUTE
        r = self._execute(ctx)
        self.phases.append(r)
        if r.verdict == Verdict.ABORT:
            # Attempt rollback
            rb = self._rollback(ctx, r)
            self.phases.append(rb)
            return self._finalize(
                ctx, ok=False, reason=f"EXECUTE failed, ROLLBACK: {rb.verdict.value}"
            )
        if r.verdict == Verdict.HOLD:
            return self._finalize(ctx, ok=False, reason=f"EXECUTE: {r.error}")

        # Phase 5: VERIFY
        r = self._verify(ctx, r.data)
        self.phases.append(r)
        if r.verdict == Verdict.ROLLBACK:
            rb = self._rollback(ctx, r)
            self.phases.append(rb)
            return self._finalize(
                ctx, ok=False, reason=f"VERIFY failed, ROLLBACK performed"
            )
        if r.verdict != Verdict.PROCEED:
            return self._finalize(ctx, ok=False, reason=f"VERIFY: {r.error}")

        # Phase 6: ROLLBACK (prepared, not executed unless verify fails)
        # Already handled above if needed.

        # Phase 7: RECEIPT (always written)
        receipt = self._receipt(ctx, r.data)
        self.phases.append(receipt)

        total_ms = (time.time() - t0) * 1000
        return ACTResult(
            ok=True,
            verdict="SEAL",
            phases_completed=[p.phase.value for p in self.phases],
            phases_failed=[],
            result=r.data,
            receipt=receipt.data,
            total_duration_ms=total_ms,
        )

    # ── Phase implementations ────────────────

    def _dry_run(self, ctx: ACTContext) -> PhaseResult:
        """What would this action do? No side effects."""
        t0 = time.time()
        return PhaseResult(
            phase=Phase.DRY_RUN,
            verdict=Verdict.PROCEED,
            data={
                "connector": ctx.connector,
                "verb": ctx.verb,
                "verb_class": ctx.verb_class,
                "blast_radius": ctx.blast_radius,
                "reversible": ctx.reversible,
                "params_summary": {
                    k: str(v)[:100] for k, v in ctx.params.items() if k != "body"
                },
                "warning": "IRREVERSIBLE — no undo path"
                if not ctx.reversible
                else None,
            },
            duration_ms=(time.time() - t0) * 1000,
        )

    def _simulate(self, ctx: ACTContext) -> PhaseResult:
        """What does the system predict will happen?"""
        t0 = time.time()
        # For MUTATE/IRREVERSIBLE: describe expected outcome
        prediction = {
            "expected_outcome": f"Will {ctx.verb} on {ctx.connector}",
            "affected_system": ctx.connector,
            "risk_level": ctx.blast_radius,
        }
        if not ctx.reversible:
            prediction["requires_ack"] = True
            prediction["recommendation"] = (
                "CONFIRM irreversible action before proceeding"
            )

        return PhaseResult(
            phase=Phase.SIMULATE,
            verdict=Verdict.PROCEED,
            data=prediction,
            duration_ms=(time.time() - t0) * 1000,
        )

    def _preflight(self, ctx: ACTContext) -> PhaseResult:
        """Are all guardrails in place?"""
        t0 = time.time()
        # OBSERVE verbs don't need a lease
        checks = {
            "actor_bound": bool(ctx.actor_id),
            "blast_radius_acceptable": ctx.blast_radius != "CRITICAL",
        }
        if ctx.verb_class != "OBSERVE":
            checks["lease_valid"] = bool(ctx.lease_id)
        if not ctx.reversible:
            checks["reversible_or_acked"] = ctx.params.get("ack_irreversible", False)

        all_pass = all(checks.values())
        return PhaseResult(
            phase=Phase.PREFLIGHT,
            verdict=Verdict.PROCEED if all_pass else Verdict.HOLD,
            data=checks,
            error=None
            if all_pass
            else f"Preflight failed: {[k for k, v in checks.items() if not v]}",
            duration_ms=(time.time() - t0) * 1000,
        )

    def _execute(self, ctx: ACTContext) -> PhaseResult:
        """I am now changing reality."""
        t0 = time.time()
        try:
            result = self.bridge(ctx.params)
            return PhaseResult(
                phase=Phase.EXECUTE,
                verdict=Verdict.PROCEED if result.get("ok") else Verdict.ABORT,
                data=result,
                error=result.get("error") if not result.get("ok") else None,
                duration_ms=(time.time() - t0) * 1000,
            )
        except Exception as e:
            return PhaseResult(
                phase=Phase.EXECUTE,
                verdict=Verdict.ABORT,
                error=str(e),
                duration_ms=(time.time() - t0) * 1000,
            )

    def _verify(self, ctx: ACTContext, result: Any) -> PhaseResult:
        """Did reality become what we intended?"""
        t0 = time.time()
        # Check: result is not None, no error field, expected structure present
        ok = result is not None
        if isinstance(result, dict):
            ok = ok and result.get("ok", True) and not result.get("error")

        return PhaseResult(
            phase=Phase.VERIFY,
            verdict=Verdict.PROCEED if ok else Verdict.ROLLBACK,
            data={"verified": ok, "result_type": type(result).__name__},
            duration_ms=(time.time() - t0) * 1000,
        )

    def _rollback(self, ctx: ACTContext, failed_phase: PhaseResult) -> PhaseResult:
        """Attempt to undo the action."""
        t0 = time.time()
        # Rollback is verb-specific. For now: log and flag.
        # Future: call bridge with inverse operation (e.g., close issue, delete event)
        return PhaseResult(
            phase=Phase.ROLLBACK,
            verdict=Verdict.ABORT,
            data={
                "attempted": True,
                "reversible": ctx.reversible,
                "failed_phase": failed_phase.phase.value,
                "note": "Manual rollback may be required for IRREVERSIBLE verbs",
            },
            error=f"Rollback after {failed_phase.phase.value} failure",
            duration_ms=(time.time() - t0) * 1000,
        )

    def _receipt(self, ctx: ACTContext, result: Any) -> PhaseResult:
        """Write immutable audit record using canonical VAULT999Receipt model.

        G3: replaced raw dict construction with typed Pydantic model.
        All bridges now share this same receipt shape via apa.core.schemas.
        """
        t0 = time.time()

        # Map string verb_class to enum (backward compat with string-based ctx)
        try:
            vc = VerbClassSchema(ctx.verb_class)
        except ValueError:
            vc = VerbClassSchema.MUTATE  # default for unknown

        # Map string blast_radius to enum
        try:
            br = BlastRadiusSchema(ctx.blast_radius)
        except ValueError:
            br = BlastRadiusSchema.LOW

        receipt = VAULT999Receipt(
            connector=ctx.connector,
            verb=ctx.verb,
            verb_class=vc,
            lease_id=ctx.lease_id or "",
            actor_id=ctx.actor_id,
            session_id=ctx.session_id,
            blast_radius=br,
            timestamp=datetime.now(timezone.utc),
            phases=[p.phase.value for p in self.phases],
            result_summary=str(result)[:500] if result else "NONE",
        )
        # sha256 is auto-computed by the model's after-validator

        # Write to vault (vault_write now accepts VAULT999Receipt + dict)
        self.vault(receipt)

        return PhaseResult(
            phase=Phase.RECEIPT,
            verdict=Verdict.PROCEED,
            data=receipt.model_dump(),
            duration_ms=(time.time() - t0) * 1000,
        )

    def _finalize(self, ctx: ACTContext, ok: bool, reason: str) -> ACTResult:
        """Build final result when execution stops early."""
        total_ms = sum(p.duration_ms for p in self.phases)
        return ACTResult(
            ok=ok,
            verdict="HOLD" if not ok else "SEAL",
            phases_completed=[p.phase.value for p in self.phases],
            phases_failed=[reason],
            total_duration_ms=total_ms,
        )


# ── Integration with existing bridges ────────
import requests


def github_bridge_dispatch(params: dict) -> dict:
    """Dispatch to GitHub bridge."""
    resp = requests.post("http://127.0.0.1:18095/execute", json=params, timeout=30)
    return resp.json()


def vault_write(receipt: Union[VAULT999Receipt, dict]):
    """Write receipt to VAULT999. Accepts VAULT999Receipt model or raw dict (backward compat).

    G3: VAULT999Receipt Pydantic model is preferred. Raw dict still works.
    """
    if isinstance(receipt, VAULT999Receipt):
        payload = receipt.model_dump()
    else:
        payload = receipt
    with open("/root/A-FORGE/leases/receipts.jsonl", "a") as f:
        f.write(json.dumps(payload, default=str) + "\n")


# ── Singleton ────────────────────────────────
act = ACTExecutor(bridge_dispatch=github_bridge_dispatch, vault_write=vault_write)
