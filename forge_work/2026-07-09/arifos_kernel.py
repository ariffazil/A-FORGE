#!/usr/bin/env python3
"""
arifos_kernel.py
═══════════════════════════════════════════════════════════════════════════════
Python constitutional judgment engine template: 000–999 metabolism, ΔΩΨ
governance, verdict geometry, and substrate-agnostic organ interface.

Authority boundary:
- This kernel = constitutional judgment engine / governance / receipts (Python)
- Final sovereign judge = Arif / F13
- A-FORGE = executor / tools / MCP (TypeScript)
- Quantum, GEOX, WEALTH, WELL, LLM = evidence organs (any language)

DITEMPA BUKAN DIBERI
"""

from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Any
from urllib import request


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Ontology
# ═══════════════════════════════════════════════════════════════════════════════


class Phase(str, Enum):
    """000–999 metabolic phases (live federation mapping)."""

    INIT = "000"  # arif_init / ingestIntent
    OBSERVE = "111"  # ingestEvidence
    THINK = "333"  # reason / plan
    ROUTE = "444"  # intent → organ
    CRITIQUE = "555"  # heart / ethical check
    FORGE = "777"  # provisional ACT (A-FORGE warrant)
    JUDGE = "888"  # verdict born here only
    COOL = "900"  # cooling ledger / drift
    SEAL = "999"  # VAULT999 lineage


class Verdict(str, Enum):
    SEAL = "SEAL"
    SABAR = "SABAR"
    HOLD = "HOLD"
    VOID = "VOID"


class UncertaintyTag(str, Enum):
    UNKNOWN = "UNKNOWN"
    ESTIMATE = "ESTIMATE"
    HYPOTHESIS = "HYPOTHESIS"
    PLAUSIBLE = "PLAUSIBLE"
    CLAIM = "CLAIM"


class Source(str, Enum):
    GEOX = "GEOX"
    WEALTH = "WEALTH"
    WELL = "WELL"
    LLM = "LLM"
    QUANTUM = "QUANTUM"
    HUMAN = "HUMAN"
    CLASSICAL = "CLASSICAL"


# ═══════════════════════════════════════════════════════════════════════════════
# 2. Evidence geometry
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass(frozen=True)
class EvidenceItem:
    id: str
    source: Source
    payload: Any
    uncertainty: UncertaintyTag
    lineage_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "source": self.source.value,
            "payload": self.payload,
            "uncertainty": self.uncertainty.value,
            "lineageId": self.lineage_id,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 3. Governance state: Δ (entropy/pressure), Ω (uncertainty), Ψ (integrity)
# ═══════════════════════════════════════════════════════════════════════════════


DEFAULT_THRESHOLDS = {
    "OMEGA_MAX": 0.5,
    "PSI_MIN": 0.7,
    "DELTA_CRITICAL": 0.8,
    "OMEGA_WARN": 0.4,
}


@dataclass
class GovernanceState:
    phase: Phase
    evidence: list[EvidenceItem] = field(default_factory=list)
    delta: float = 0.0
    omega: float = 1.0
    psi: float = 1.0
    verdict: Verdict | None = None
    authority_present: bool = False
    reversible: bool = True
    intent_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "phase": self.phase.value,
            "evidence": [e.to_dict() for e in self.evidence],
            "delta": self.delta,
            "omega": self.omega,
            "psi": self.psi,
            "verdict": self.verdict.value if self.verdict else None,
            "authorityPresent": self.authority_present,
            "reversible": self.reversible,
            "intentId": self.intent_id,
        }


@dataclass
class ExecutorReceipt:
    """
    Receipt issued by the Python kernel when a verdict permits execution.
    A-FORGE must hard-fail if any mandatory field is missing or invalid.
    """

    receipt_id: str
    kernel_signature: str
    verdict: Verdict
    authority_scope: str
    allowed_action: str
    tool_name: str
    blast_radius: float
    reversible: bool
    input_hash: str
    lease_expiry: str
    evidence_refs: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "receiptId": self.receipt_id,
            "kernelSignature": self.kernel_signature,
            "verdict": self.verdict.value,
            "authorityScope": self.authority_scope,
            "allowedAction": self.allowed_action,
            "toolName": self.tool_name,
            "blastRadius": self.blast_radius,
            "reversible": self.reversible,
            "inputHash": self.input_hash,
            "leaseExpiry": self.lease_expiry,
            "evidenceRefs": self.evidence_refs,
        }

    @staticmethod
    def mandatory_fields() -> list[str]:
        return [
            "receipt_id",
            "kernel_signature",
            "verdict",
            "authority_scope",
            "allowed_action",
            "tool_name",
            "blast_radius",
            "reversible",
            "input_hash",
            "lease_expiry",
        ]


# ═══════════════════════════════════════════════════════════════════════════════
# 4. ΔΩΨ calculators
# ═══════════════════════════════════════════════════════════════════════════════


def compute_delta(blast_radius: float, reversible: bool) -> float:
    """Δ = state-change pressure scaled by reversibility discount."""
    discount = 0.5 if reversible else 1.0
    return min(1.0, blast_radius * discount)


def compute_omega(evidence: list[EvidenceItem]) -> float:
    """Ω = epistemic uncertainty / conflict over evidence."""
    if not evidence:
        return 1.0

    tag_weight = {
        UncertaintyTag.UNKNOWN: 1.0,
        UncertaintyTag.ESTIMATE: 0.75,
        UncertaintyTag.HYPOTHESIS: 0.6,
        UncertaintyTag.PLAUSIBLE: 0.35,
        UncertaintyTag.CLAIM: 0.1,
    }

    avg = sum(tag_weight[e.uncertainty] for e in evidence) / len(evidence)
    conflict = _detect_conflict(evidence)
    return min(1.0, avg + conflict)


def compute_psi(evidence: list[EvidenceItem], floors: list[str] | None = None) -> float:
    """Ψ = integrity / alignment field from floor compliance."""
    psi = 1.0
    required = ["F1", "F2", "F7", "F9", "F11", "F13"]
    floors = floors or []

    for f in required:
        if f not in floors:
            psi -= 0.12

    # Any evidence claiming verdict authority is an automatic psi hit.
    for e in evidence:
        payload = e.payload
        if isinstance(payload, dict) and "verdict" in payload:
            psi -= 0.5

    return max(0.0, psi)


def _detect_conflict(evidence: list[EvidenceItem]) -> float:
    by_lineage: dict[str, list[EvidenceItem]] = {}
    for e in evidence:
        if e.lineage_id:
            by_lineage.setdefault(e.lineage_id, []).append(e)

    conflict = 0.0
    for items in by_lineage.values():
        if len(items) < 2:
            continue
        signs = {_extract_sign(i.payload) for i in items}
        signs.discard(None)
        if len(signs) > 1:
            conflict += 0.25

    return min(1.0, conflict)


def _extract_sign(payload: Any) -> str | None:
    if not isinstance(payload, dict):
        return None
    return payload.get("sign") if payload.get("sign") in ("support", "oppose") else None


# ═══════════════════════════════════════════════════════════════════════════════
# 5. Judge (888) — the only place a verdict is born
# ═══════════════════════════════════════════════════════════════════════════════


def judge(state: GovernanceState) -> GovernanceState:
    """
    G: (m, E, R) → (m, E, R, V)
    The governance operator. Quantum has U; arifOS has G.
    """
    delta, omega, psi = state.delta, state.omega, state.psi

    if not state.authority_present:
        return _with_verdict(state, Verdict.VOID)

    if omega > DEFAULT_THRESHOLDS["OMEGA_MAX"] or psi < DEFAULT_THRESHOLDS["PSI_MIN"]:
        return _with_verdict(state, Verdict.HOLD)

    if delta > DEFAULT_THRESHOLDS["DELTA_CRITICAL"] and omega > DEFAULT_THRESHOLDS["OMEGA_WARN"]:
        return _with_verdict(state, Verdict.SABAR)

    return _with_verdict(state, Verdict.SEAL)


def _with_verdict(state: GovernanceState, verdict: Verdict) -> GovernanceState:
    new_state = GovernanceState(**state.__dict__)
    new_state.verdict = verdict
    return new_state


# ═══════════════════════════════════════════════════════════════════════════════
# 6. Substrate organ interface — dumb pipe, no governance
# ═══════════════════════════════════════════════════════════════════════════════


class Organ:
    """A compute backend that returns evidence. It does not judge."""

    def __init__(self, name: str):
        self.name = name

    def compute(self, input_data: Any) -> list[EvidenceItem]:
        raise NotImplementedError


class HttpOrgan(Organ):
    """HTTP-backed organ. In production this may be an MCP server envelope."""

    def __init__(self, name: str, url: str):
        super().__init__(name)
        self.url = url.rstrip("/")

    def compute(self, input_data: Any) -> list[EvidenceItem]:
        data = json.dumps(input_data).encode()
        req = request.Request(
            f"{self.url}/compute",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode())

        return [EvidenceItem(**self._normalize(e)) for e in body["evidence"]]

    @staticmethod
    def _normalize(raw: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": raw["id"],
            "source": Source(raw["source"]),
            "payload": raw["payload"],
            "uncertainty": UncertaintyTag(raw["uncertainty"]),
            "lineage_id": raw.get("lineageId"),
        }


class QuantumOrgan(HttpOrgan):
    def __init__(self, url: str):
        super().__init__("QUANTUM", url)


# ═══════════════════════════════════════════════════════════════════════════════
# 7. Kernel: metabolic state machine 000 → 999
# ═══════════════════════════════════════════════════════════════════════════════


class Kernel:
    """
    Constitutional judgment engine. Owns phase transitions, ΔΩΨ, and verdict.
    Never executes actions directly — it issues receipts to A-FORGE.
    Final authority remains the sovereign (Arif / F13).
    """

    def __init__(self):
        self._organs: dict[str, Organ] = {}

    def register_organ(self, organ: Organ) -> Kernel:
        self._organs[organ.name] = organ
        return self

    def init_intent(self, description: str, intent_id: str | None = None) -> GovernanceState:
        return GovernanceState(
            phase=Phase.INIT,
            intent_id=intent_id or f"intent-{id(self)}",
        )

    def observe(
        self,
        state: GovernanceState,
        organ_name: str,
        input_data: Any,
    ) -> GovernanceState:
        self._assert_phase(state, (Phase.INIT, Phase.OBSERVE), "observe")
        organ = self._organs.get(organ_name)
        if organ is None:
            raise ValueError(f"Organ not registered: {organ_name}")

        items = organ.compute(input_data)
        evidence = list(state.evidence) + items
        return GovernanceState(
            phase=Phase.OBSERVE,
            evidence=evidence,
            delta=state.delta,
            omega=compute_omega(evidence),
            psi=compute_psi(evidence, self._extract_floors(evidence)),
            authority_present=state.authority_present,
            reversible=state.reversible,
            intent_id=state.intent_id,
        )

    def think(self, state: GovernanceState) -> GovernanceState:
        self._assert_phase(state, (Phase.OBSERVE, Phase.THINK), "think")
        return self._copy(state, phase=Phase.THINK)

    def route(self, state: GovernanceState, organ_name: str) -> GovernanceState:
        self._assert_phase(state, (Phase.THINK, Phase.ROUTE), "route")
        if organ_name not in self._organs:
            raise ValueError(f"Route target unknown: {organ_name}")
        return self._copy(state, phase=Phase.ROUTE)

    def critique(self, state: GovernanceState) -> GovernanceState:
        self._assert_phase(state, (Phase.ROUTE, Phase.CRITIQUE), "critique")
        return self._copy(
            state,
            phase=Phase.CRITIQUE,
            psi=compute_psi(state.evidence, self._extract_floors(state.evidence)),
        )

    def prepare_action(
        self,
        state: GovernanceState,
        blast_radius: float,
        reversible: bool,
    ) -> GovernanceState:
        self._assert_phase(state, (Phase.CRITIQUE, Phase.FORGE), "prepare_action")
        return self._copy(
            state,
            phase=Phase.FORGE,
            delta=compute_delta(blast_radius, reversible),
            reversible=reversible,
        )

    def judge(self, state: GovernanceState, authority_present: bool) -> GovernanceState:
        self._assert_phase(state, (Phase.FORGE, Phase.JUDGE), "judge")
        state = self._copy(state, phase=Phase.JUDGE, authority_present=authority_present)
        return judge(state)

    def cool(self, state: GovernanceState) -> GovernanceState:
        self._assert_phase(state, (Phase.JUDGE, Phase.COOL), "cool")
        return self._copy(state, phase=Phase.COOL)

    def seal(self, state: GovernanceState) -> GovernanceState:
        self._assert_phase(state, (Phase.COOL, Phase.SEAL), "seal")
        if state.verdict not in (Verdict.SEAL, Verdict.SABAR):
            raise ValueError(f"Cannot seal from verdict {state.verdict}")
        return self._copy(state, phase=Phase.SEAL)

    def issue_executor_receipt(
        self,
        state: GovernanceState,
        allowed_action: str,
        tool_name: str,
        authority_scope: str = "F13-delegated",
        lease_expiry: str = "2026-07-09T23:59:59Z",
    ) -> ExecutorReceipt:
        """
        Produce an ExecutorReceipt for A-FORGE. Requires SEAL/SABAR verdict.
        A-FORGE must validate every mandatory field before executing.
        """
        if state.verdict not in (Verdict.SEAL, Verdict.SABAR):
            raise ValueError(f"Cannot issue execution receipt for verdict {state.verdict}")

        payload = json.dumps(state.to_dict(), sort_keys=True)
        input_hash = hashlib.sha256(payload.encode()).hexdigest()[:32]
        evidence_refs = [e.id for e in state.evidence]

        return ExecutorReceipt(
            receipt_id=f"rct-{state.intent_id or 'unknown'}-{id(state)}",
            kernel_signature=f"sha256:{input_hash}",
            verdict=state.verdict,
            authority_scope=authority_scope,
            allowed_action=allowed_action,
            tool_name=tool_name,
            blast_radius=state.delta,
            reversible=state.reversible,
            input_hash=input_hash,
            lease_expiry=lease_expiry,
            evidence_refs=evidence_refs,
        )

    def _assert_phase(
        self,
        state: GovernanceState,
        allowed: tuple[Phase, ...],
        verb: str,
    ) -> None:
        if state.phase not in allowed:
            raise ValueError(
                f"{verb} not allowed in phase {state.phase.value}; "
                f"expected one of {', '.join(p.value for p in allowed)}"
            )

    def _copy(self, state: GovernanceState, **overrides: Any) -> GovernanceState:
        kwargs = state.__dict__.copy()
        kwargs.update(overrides)
        return GovernanceState(**kwargs)

    def _extract_floors(self, evidence: list[EvidenceItem]) -> list[str]:
        floors: set[str] = set()
        for e in evidence:
            payload = e.payload
            if isinstance(payload, dict):
                for f in payload.get("floors", []) or []:
                    floors.add(str(f))
        return sorted(floors)


# ═══════════════════════════════════════════════════════════════════════════════
# 8. Example: run the kernel against a quantum organ
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import os

    quantum_url = os.getenv("QUANTUM_ORGAN_URL", "http://127.0.0.1:18100")

    # A HUMAN organ supplies the governance floor attestation that quantum cannot.
    class HumanFloorOrgan(Organ):
        def compute(self, input_data):
            return [
                EvidenceItem(
                    id="floor-attestation-1",
                    source=Source.HUMAN,
                    payload={"floors": ["F1", "F2", "F7", "F9", "F11", "F13"]},
                    uncertainty=UncertaintyTag.CLAIM,
                    lineage_id="bell-demo",
                )
            ]

    kernel = (
        Kernel()
        .register_organ(QuantumOrgan(quantum_url))
        .register_organ(HumanFloorOrgan("HUMAN"))
    )

    state = kernel.init_intent("Evaluate Bell-state evidence")
    state = kernel.observe(
        state,
        "QUANTUM",
        {
            "id": "bell-test",
            "lineageId": "bell-demo",
            "n_qubits": 2,
            "ops": [
                {"type": "single", "gate": "H", "target": 0},
                {"type": "cnot", "control": 0, "target": 1},
            ],
        },
    )
    state = kernel.observe(
        state,
        "HUMAN",
        {"request": "attest constitutional floors for bell-demo"},
    )
    state = kernel.think(state)
    state = kernel.route(state, "QUANTUM")
    state = kernel.critique(state)
    state = kernel.prepare_action(state, blast_radius=0.2, reversible=True)
    state = kernel.judge(state, authority_present=True)

    print("=== GovernanceState ===")
    print(json.dumps(state.to_dict(), indent=2))

    if state.verdict in (Verdict.SEAL, Verdict.SABAR):
        receipt = kernel.issue_executor_receipt(
            state,
            allowed_action="log_bell_state_evidence",
            tool_name="forge_filesystem_write",
        )
        print("\n=== ExecutorReceipt (to A-FORGE) ===")
        print(json.dumps(receipt.to_dict(), indent=2))
