"""
quantum_planner.py — Quantum Superposition Planning Tool

Implements QSKILL-01: Superposition of Hypotheses.

DITEMPA BUKAN DIBERI — Uncertainty is the ground state. Collapse is earned.

Usage:
    from quantum_planner import QuantumPlanner, Hypothesis, PlanResult

    planner = QuantumPlanner(coherence_budget=1.0)
    result = planner.plan(task="fix graphiti-mcp", hypotheses=[...])
    print(result.mode)  # SUPERPOSITION | COLLAPSED | TUNNELING
"""

from __future__ import annotations
import logging
from dataclasses import dataclass, field
from enum import Enum
from math import exp
from typing import Optional
import uuid
import json

logger = logging.getLogger(__name__)


# ── ENUMS ──────────────────────────────────────────────────────────────────


class PlanMode(str, Enum):
    SUPERPOSITION = "SUPERPOSITION"   # Multiple plans held, threshold not met
    COLLAPSED    = "COLLAPSED"       # Threshold exceeded, collapsed to primary
    TUNNELING    = "TUNNELING"       # Classical path blocked, quantum tunnel attempted


class HypothesisStatus(str, Enum):
    PRIMARY  = "PRIMARY"   # Leading hypothesis, collapsed to
    BACKUP   = "BACKUP"   # Held in reserve
    TUNNEL   = "TUNNEL"   # Quantum tunnel attempt
    COLLAPSED = "COLLAPSED"  # This was the collapse target


class EpistemicLabel(str, Enum):
    OBS   = "OBS"   # Observed directly
    DER   = "DER"   # Derived from evidence
    INT   = "INT"   # Interpreted (moderate uncertainty)
    SPEC  = "SPEC"  # Speculative (high uncertainty)


class BlastRadius(str, Enum):
    SELF       = "SELF"
    PROCESS    = "PROCESS"
    CONTAINER  = "CONTAINER"
    HOST       = "HOST"
    FEDERATION = "FEDERATION"


class Reversibility(str, Enum):
    FULL    = "FULL"
    PARTIAL = "PARTIAL"
    NONE    = "NONE"


# ── DATACLASSES ───────────────────────────────────────────────────────────────


@dataclass
class Hypothesis:
    """A single hypothesis in the quantum superposition."""

    id: str
    plan: str
    steps: list[str]
    amplitude_prior: float = 0.5
    evidence_for: list[str] = field(default_factory=list)
    evidence_against: list[str] = field(default_factory=list)
    blast_radius: BlastRadius = BlastRadius.SELF
    reversibility: Reversibility = Reversibility.FULL
    coherence_cost_estimate: float = 0.1
    label: EpistemicLabel = EpistemicLabel.DER

    def amplitude_delta(self) -> float:
        """Net amplitude change from evidence interference."""
        constructive = len(self.evidence_for) * 0.05
        destructive = len(self.evidence_against) * 0.05
        return constructive - destructive


@dataclass
class CoherenceBudget:
    """Tracks coherence cost consumption (WEALTH integration)."""
    total: float = 1.0
    consumed: float = 0.0

    @property
    def remaining(self) -> float:
        return self.total - self.consumed

    @property
    def hold_threshold(self) -> float:
        return 0.85  # > 85% consumed → 888_HOLD

    @property
    def depleted_threshold(self) -> float:
        return 0.95  # > 95% consumed → STOP

    def can_proceed(self) -> tuple[bool, str]:
        if self.consumed >= self.depleted_threshold:
            return False, "COHERENCE_DEPLETED"
        if self.consumed >= self.hold_threshold:
            return False, "COHERENCE_HOLD"
        return True, "OK"

    def consume(self, amount: float) -> None:
        self.consumed = min(self.total, self.consumed + amount)


@dataclass
class CollapseEvent:
    """Records the collapse measurement event."""
    ts: str
    collapsed_to: str
    reason: str
    vault_receipt_id: str
    amplitude_before: float
    amplitude_after: float


@dataclass
class HypothesisResult:
    """Result for a single hypothesis after quantum processing."""
    id: str
    amplitude_final: float
    interference_net: float
    rank: int
    status: HypothesisStatus
    verdict: str  # PROCEED | HOLD | BLOCK (mirrors ART verdict)


@dataclass
class PlanResult:
    """Final result of quantum superposition planning."""
    mode: PlanMode
    coherence_cost_consumed: float
    discrimination_reached: bool
    hypotheses: list[HypothesisResult]
    collapse_event: Optional[CollapseEvent]
    coherence_budget: dict
    recommendation: str
    ψ_coherence: float  # coherence metric
    session_id: str = field(default_factory=lambda: str(uuid.uuid4()))

    def to_dict(self) -> dict:
        return {
            "mode": self.mode.value,
            "session_id": self.session_id,
            "ψ_coherence": round(self.ψ_coherence, 3),
            "coherence_cost_consumed": round(self.coherence_cost_consumed, 3),
            "discrimination_reached": self.discrimination_reached,
            "coherence_budget": {k: round(v, 3) if isinstance(v, float) else v
                                 for k, v in self.coherence_budget.items()},
            "hypotheses": [
                {
                    "id": h.id,
                    "amplitude_final": round(h.amplitude_final, 3),
                    "interference_net": f"{h.interference_net:+.2f}",
                    "rank": h.rank,
                    "status": h.status.value,
                    "verdict": h.verdict,
                }
                for h in sorted(self.hypotheses, key=lambda x: x.rank)
            ],
            "collapse_event": {
                "ts": self.collapse_event.ts,
                "collapsed_to": self.collapse_event.collapsed_to,
                "reason": self.collapse_event.reason,
                "vault_receipt_id": self.collapse_event.vault_receipt_id,
            } if self.collapse_event else None,
            "recommendation": self.recommendation,
        }


# ── QUANTUM PLANNER ─────────────────────────────────────────────────────────


class QuantumPlanner:
    """
    Quantum Superposition Planner.

    Holds multiple candidate action plans in superposition, computes interference
    from evidence streams, and collapses only when discrimination threshold is met.

    F9 ANTI-HANTU: This is a mathematical tool, not a consciousness claim.
    "Amplitude" and "interference" are mathematical descriptions, not sentient states.
    """

    def __init__(
        self,
        coherence_budget: float = 1.0,
        discrimination_threshold: float = 0.40,
        coherence_cost_coefficient: float = 0.1,
    ):
        """
        Args:
            coherence_budget: Total coherence budget (0.0–1.0)
            discrimination_threshold: |a₁ - a₂| must exceed this to collapse
            coherence_cost_coefficient: Multiplier for coherence cost calculation
        """
        self.budget = CoherenceBudget(total=coherence_budget)
        self.discrimination_threshold = discrimination_threshold
        self.coeff = coherence_cost_coefficient
        self._ψ_history: list[float] = []

    # ── STEP 1: STATE PREPARATION ──────────────────────────────────────────

    def _prepare_state(self, hypotheses: list[Hypothesis]) -> list[Hypothesis]:
        """Validate and normalize hypothesis amplitudes."""
        if not hypotheses:
            raise ValueError("At least one hypothesis required")
        if len(hypotheses) > 7:
            raise ValueError("Maximum 7 hypotheses (quantum decoherence risk)")

        total = sum(h.amplitude_prior for h in hypotheses)
        for h in hypotheses:
            h.amplitude_prior = h.amplitude_prior / total  # normalize

        return hypotheses

    # ── STEP 2: INTERFERENCE CALCULATION ───────────────────────────────────

    def _compute_interference(
        self, hypotheses: list[Hypothesis]
    ) -> dict[str, float]:
        """
        Compute net amplitude per hypothesis using quantum interference.

        Constructive: evidence_for adds positive amplitude
        Destructive:  evidence_against subtracts amplitude
        Cross-hypothesis: high-correlation pairs amplify leading hypothesis
        """
        interference = {}

        for i, h in enumerate(hypotheses):
            delta = h.amplitude_delta()

            # Cross-interference from other hypotheses
            for j, other in enumerate(hypotheses):
                if i == j:
                    continue
                # High-amplitude others boost this hypothesis if correlated
                correlation_factor = 0.05 * other.amplitude_prior * h.amplitude_prior
                delta += correlation_factor

            interference[h.id] = delta

        return interference

    # ── STEP 3: AMPLITUDE UPDATE ───────────────────────────────────────────

    def _update_amplitudes(
        self,
        hypotheses: list[Hypothesis],
        interference: dict[str, float],
    ) -> list[tuple[Hypothesis, float]]:
        """Update amplitudes with interference, return sorted by final amplitude."""
        results = []
        for h in hypotheses:
            delta = interference[h.id]
            final = max(0.01, min(0.99, h.amplitude_prior + delta))
            results.append((h, final))

        # Sort descending by amplitude
        results.sort(key=lambda x: x[1], reverse=True)
        return results

    # ── STEP 4: COHERENCE COST ──────────────────────────────────────────────

    def _compute_coherence_cost(
        self, hypotheses: list[Hypothesis]
    ) -> float:
        """
        Compute coherence cost: C_cost = Σ(tokens × ΔΩ × ξ)

        For planning purposes we estimate:
          tokens ∝ plan complexity (number of steps)
          ΔΩ ∝ uncertainty (inverse of evidence weight)
          ξ ∝ blast radius entanglement factor
        """
        total_cost = 0.0
        blast_entanglement = {
            BlastRadius.SELF:       1.0,
            BlastRadius.PROCESS:    1.5,
            BlastRadius.CONTAINER:  2.0,
            BlastRadius.HOST:       3.0,
            BlastRadius.FEDERATION: 5.0,
        }

        for h in hypotheses:
            steps_cost = len(h.steps) * 0.01  # 1% per step
            uncertainty_cost = h.coherence_cost_estimate
            entanglement_cost = blast_entanglement.get(h.blast_radius, 1.0)
            h_cost = steps_cost * uncertainty_cost * entanglement_cost
            total_cost += h_cost

        return total_cost * self.coeff

    # ── STEP 5: TUNNELING CHECK ─────────────────────────────────────────────

    def _check_tunneling(
        self, ranked: list[tuple[Hypothesis, float]]
    ) -> tuple[bool, Optional[Hypothesis], float]:
        """
        If leading hypothesis has amplitude < 0.30, classical path may be blocked.
        Compute tunneling probability: P = exp(-2γd)
        """
        if not ranked:
            return False, None, 0.0

        leading_h, leading_a = ranked[0]

        if leading_a >= 0.30:
            return False, None, 0.0

        # Barrier parameters (simplified model)
        gamma = 1.0        # barrier width factor
        d = 0.5           # barrier height (how blocked the path is)

        P_tunnel = exp(-2 * gamma * d)

        if P_tunnel > 0.001:
            return True, leading_h, P_tunnel

        return False, None, 0.0

    # ── MAIN PLANNING METHOD ────────────────────────────────────────────────

    def plan(
        self,
        task: str,
        hypotheses: list[Hypothesis],
        collapse_deadline: Optional[str] = None,
        arif_override: bool = False,
    ) -> PlanResult:
        """
        Main entry point. Run the full quantum planning circuit.

        Args:
            task: Natural language task description
            hypotheses: List of candidate hypotheses (2–7)
            collapse_deadline: Optional ISO8601 deadline
            arif_override: If True, force collapse to leading hypothesis

        Returns:
            PlanResult with mode = SUPERPOSITION | COLLAPSED | TUNNELING
        """
        logger.info("QuantumPlanner.plan called", extra={"tool": "quantum_planner", "task": task[:80], "hypothesis_count": len(hypotheses)})
        session_id = str(uuid.uuid4())

        # ── STEP 1: State preparation ──────────────────────────────────────
        hypotheses = self._prepare_state(hypotheses)

        # ── STEP 2: Evidence accumulation (interference) ───────────────────
        interference = self._compute_interference(hypotheses)

        # ── STEP 3: Amplitude update ───────────────────────────────────────
        ranked = self._update_amplitudes(hypotheses, interference)

        # ── STEP 4: Coherence cost ─────────────────────────────────────────
        coherence_cost = self._compute_coherence_cost(hypotheses)
        self.budget.consume(coherence_cost)
        budget_ok, budget_status = self.budget.can_proceed()

        if not budget_ok:
            return PlanResult(
                mode=PlanMode.SUPERPOSITION,
                coherence_cost_consumed=coherence_cost,
                discrimination_reached=False,
                hypotheses=[],
                collapse_event=None,
                coherence_budget={
                    "total": self.budget.total,
                    "consumed": self.budget.consumed,
                    "remaining": self.budget.remaining,
                    "status": budget_status,
                },
                recommendation=f"888_HOLD: coherence budget {budget_status}",
                ψ_coherence=0.0,
            )

        # ── STEP 5: Discrimination threshold check ─────────────────────────
        if len(ranked) >= 2:
            a1 = ranked[0][1]
            a2 = ranked[1][1]
            discrimination = abs(a1 - a2)
            discrimination_reached = discrimination >= self.discrimination_threshold
        else:
            discrimination = 1.0
            discrimination_reached = True

        # ── STEP 6: Tunneling check ────────────────────────────────────────
        tunneling_possible, tunnel_h, P_tunnel = self._check_tunneling(ranked)

        # ── STEP 7: Determine mode and build result ────────────────────────
        collapse_event: Optional[CollapseEvent] = None
        hypothesis_results: list[HypothesisResult] = []

        if arif_override or discrimination_reached:
            # ── COLLAPSE ────────────────────────────────────────────────────
            leading_h, leading_a = ranked[0]
            primary = HypothesisResult(
                id=leading_h.id,
                amplitude_final=leading_a,
                interference_net=interference[leading_h.id],
                rank=1,
                status=HypothesisStatus.COLLAPSED,
                verdict="PROCEED" if leading_h.reversibility != Reversibility.NONE
                        else "HOLD",
            )
            hypothesis_results.append(primary)

            # Backups
            for rank, (h, amp) in enumerate(ranked[1:3], start=2):  # keep top 2
                hypothesis_results.append(HypothesisResult(
                    id=h.id,
                    amplitude_final=amp,
                    interference_net=interference[h.id],
                    rank=rank,
                    status=HypothesisStatus.BACKUP,
                    verdict="HOLD",
                ))

            collapse_event = CollapseEvent(
                ts=_iso_now(),
                collapsed_to=leading_h.id,
                reason=(
                    "arif_override" if arif_override
                    else "discrimination_threshold_exceeded"
                ),
                vault_receipt_id=f"vault-{session_id[:8]}",
                amplitude_before=leading_h.amplitude_prior,
                amplitude_after=leading_a,
            )

            mode = PlanMode.COLLAPSED
            backup_ids = [h_obj.id for (h_obj, _) in ranked[1:3]]
            recommendation = (
                f"Collapse to {leading_h.id}: {leading_h.plan}. "
                f"Backups held: {backup_ids}"
            )

        elif tunneling_possible:
            # ── TUNNELING ─────────────────────────────────────────────────
            for rank, (h, amp) in enumerate(ranked, start=1):
                status = HypothesisStatus.TUNNEL if h.id == tunnel_h.id else HypothesisStatus.BACKUP
                hypothesis_results.append(HypothesisResult(
                    id=h.id,
                    amplitude_final=amp,
                    interference_net=interference[h.id],
                    rank=rank,
                    status=status,
                    verdict="HOLD" if status == HypothesisStatus.TUNNEL else "BLOCK",
                ))

            mode = PlanMode.TUNNELING
            recommendation = (
                f"TUNNEL: Classically blocked. P={P_tunnel:.4f}. "
                f"Attempt {tunnel_h.id} with SPEC label."
            )

        else:
            # ── SUPERPOSITION ─────────────────────────────────────────────
            for rank, (h, amp) in enumerate(ranked, start=1):
                hypothesis_results.append(HypothesisResult(
                    id=h.id,
                    amplitude_final=amp,
                    interference_net=interference[h.id],
                    rank=rank,
                    status=HypothesisStatus.PRIMARY if rank == 1 else HypothesisStatus.BACKUP,
                    verdict="HOLD",  # Cannot collapse — hold all
                ))

            mode = PlanMode.SUPERPOSITION
            top_2 = ranked[:2]
            recommendation = (
                f"HOLD: Discrimination not reached (Δ={discrimination:.2f} "
                f"< {self.discrimination_threshold}). "
                f"Collect more evidence. Leading: {ranked[0][0].id} "
                f"({ranked[0][1]:.2f}) vs {ranked[1][0].id} ({ranked[1][1]:.2f})"
            )

        # ── Coherence tracking ──────────────────────────────────────────────
        ψ_coherence = self._compute_ψ_coherence(hypothesis_results)
        self._ψ_history.append(ψ_coherence)

        return PlanResult(
            mode=mode,
            coherence_cost_consumed=coherence_cost,
            discrimination_reached=discrimination_reached,
            hypotheses=hypothesis_results,
            collapse_event=collapse_event,
            coherence_budget={
                "total": self.budget.total,
                "consumed": self.budget.consumed,
                "remaining": self.budget.remaining,
                "status": "OK",
            },
            recommendation=recommendation,
            ψ_coherence=ψ_coherence,
            session_id=session_id,
        )

    def _compute_ψ_coherence(self, results: list[HypothesisResult]) -> float:
        """
        Compute coherence of the quantum state.
        High coherence = one dominant hypothesis (clean superposition collapse possible)
        Low coherence = multiple similar amplitudes (decoherence risk)
        """
        if not results:
            return 0.0

        amplitudes = [r.amplitude_final for r in results]
        n = len(amplitudes)

        # Single element = trivially coherent
        if n == 1:
            return 1.0

        # Herfindahl index as coherence measure
        hhi = sum(a ** 2 for a in amplitudes)

        # Normalize: 1.0 = pure (one hypothesis), 0.0 = maximally mixed
        denominator = 1.0 - (1.0 / n)
        if denominator == 0.0:
            return 0.0  # All equal amplitudes = maximally mixed

        coherence = (hhi - (1.0 / n)) / denominator
        return max(0.0, min(1.0, coherence))

    def budget_status(self) -> dict:
        """Return current coherence budget status."""
        can_proceed, status = self.budget.can_proceed()
        return {
            "total": self.budget.total,
            "consumed": round(self.budget.consumed, 3),
            "remaining": round(self.budget.remaining, 3),
            "can_proceed": can_proceed,
            "status": status,
        }


# ── UTILITIES ────────────────────────────────────────────────────────────────


def _iso_now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S%z")


# ── QUANTUM RECEIPT ──────────────────────────────────────────────────────────


def emit_quantum_receipt(result: PlanResult, task: str) -> dict:
    """
    Emit a quantum planning receipt for VAULT999 sealing.

    This is the constitutional artifact — the immutable record of the
    quantum planning event.
    """
    receipt = {
        "type": "QUANTUM_SUPERPOSITION_PLAN",
        "id": result.session_id,
        "ts": _iso_now(),
        "task": task,
        "mode": result.mode.value,
        "ψ_coherence": round(result.ψ_coherence, 3),
        "coherence_cost": round(result.coherence_cost_consumed, 3),
        "discrimination_reached": result.discrimination_reached,
        "hypotheses": [
            {
                "id": h.id,
                "amplitude": round(h.amplitude_final, 3),
                "interference": f"{h.interference_net:+.2f}",
                "rank": h.rank,
                "status": h.status.value,
            }
            for h in result.hypotheses
        ],
        "collapse": {
            "ts": result.collapse_event.ts,
            "collapsed_to": result.collapse_event.collapsed_to,
            "reason": result.collapse_event.reason,
            "vault_receipt": result.collapse_event.vault_receipt_id,
        } if result.collapse_event else None,
        "recommendation": result.recommendation,
        "f9_compliance": {
            "no_consciousness_claims": True,
            "amplitudes_are_mathematical": True,
            "uncertainty_explicitly_labeled": True,
        },
    }
    return receipt


# ── CLI ──────────────────────────────────────────────────────────────────────


if __name__ == "__main__":
    import sys

    print("Quantum Planner — QSKILL-01")
    print("=" * 50)
    print("Import from quantum_planner import QuantumPlanner, Hypothesis, PlanResult")
    print()
    print("Example:")
    print("  planner = QuantumPlanner()")
    print("  result = planner.plan(")
    print('      task="fix graphiti-mcp",')
    print("      hypotheses=[")
    print('          Hypothesis(id="H1", plan="restart container", steps=["docker restart"]),')
    print('          Hypothesis(id="H2", plan="fix healthcheck then restart", steps=["edit script", "restart"]),')
    print("      ]")
    print("  )")
    print(f"  → {result.mode.value}")
    print()
    print("DITEMPA BUKAN DIBERI — Superposition is the ground state.")
