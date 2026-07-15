#!/usr/bin/env python3
"""
Autonomic Recovery Agent v1 (ARA-v1)
═════════════════════════════════════

The first bounded autonomic loop in arifOS federation.

SENSE → INTERPRET → GENERATE OPTIONS → EVALUATE → ACT → VERIFY → LEARN

Scope: Organ health recovery (restart a failed federation organ service).
Authority: GREEN band, max 1 mutation, 10-minute lease, allowlisted services only.

Agent: autonomic_recovery_v1
Purpose: Detect organ failure, diagnose within allowlisted evidence, perform
         at most one reversible restart, verify the result, stop on uncertainty,
         and record the full receipt.

Constitutional binding:
  F1  — Reversible-first. Restart is reversible. Data deletion is not.
  F2  — Every claim labeled OBS/DER/INT/SPEC.
  F4  — ΔS ≤ 0. Leave system clearer than found.
  F7  — Cap confidence at 0.90. Declare unknowns.
  F9  — No consciousness claims. This is a tool.
  F11 — Every action logged with receipt.
  F13 — Arif holds final veto. This agent cannot override sovereign holds.

DITEMPA BUKAN DIBERI — Forged, Not Given.
"""

from __future__ import annotations

import json
import subprocess
import sys
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone, timedelta
from enum import Enum
from pathlib import Path
from typing import Any

# ── Configuration ─────────────────────────────────────────────────────────

ALLOWLISTED_SERVICES = {
    "well": {"port": 18083, "systemd": "well.service", "critical": False},
    "geox": {"port": 8081, "systemd": "geox-mcp.service", "critical": False},
    "wealth": {"port": 18082, "systemd": "wealth.service", "critical": False},
    "aaa": {"port": 3001, "systemd": "aaa-a2a.service", "critical": False},
    "aforge": {"port": 7071, "systemd": "a-forge.service", "critical": False},
    # arifOS kernel is CRITICAL — excluded from autonomous restart
    # "arifos": {"port": 8088, "systemd": "arifos.service", "critical": True},
}

MAX_MUTATIONS = 1
LEASE_MINUTES = 10
OBSERVATION_WINDOW_SECONDS = 120
MAX_RETRIES_BEFORE_HOLD = 1
HEALTH_CHECK_TIMEOUT = 10

RECEIPT_DIR = Path("/root/A-FORGE/duties/logs")
STATE_FILE = Path("/root/A-FORGE/duties/logs/ara-v1-state.json")


# ── Enums ─────────────────────────────────────────────────────────────────


class ActionClass(str, Enum):
    OBSERVE = "OBSERVE"
    RETRY_READ = "RETRY_READ"
    RESTART_SERVICE = "RESTART_SERVICE"
    HOLD = "HOLD"
    FORBIDDEN = "FORBIDDEN"


class AutonomyBand(str, Enum):
    GREEN = "GREEN"  # autonomous, routine, reversible
    YELLOW = "YELLOW"  # autonomous with logging + notification
    ORANGE = "ORANGE"  # prepare + request approval
    RED = "RED"  # explicit human decision
    BLACK = "BLACK"  # forbidden


class Verdict(str, Enum):
    PROCEED = "PROCEED"
    HOLD = "HOLD"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"
    FORBIDDEN = "FORBIDDEN"


class FailureClass(str, Enum):
    HEALTHY = "HEALTHY"
    TRANSIENT = "TRANSIENT"  # single failure, may self-resolve
    PERSISTENT = "PERSISTENT"  # repeated failure
    UNKNOWN = "UNKNOWN"  # cannot classify
    CASCADING = "CASCADING"  # multiple organs failing


# ── Data Classes ──────────────────────────────────────────────────────────


@dataclass
class OrganState:
    name: str
    port: int
    systemd: str
    critical: bool
    health_status: int = 0  # HTTP status code, 0 = unreachable
    latency_ms: float = 0.0
    reachable: bool = False
    failure_class: FailureClass = FailureClass.HEALTHY
    consecutive_failures: int = 0
    last_failure_time: str = ""
    evidence: str = ""
    epistemic: str = "OBS"  # OBS/DER/INT/SPEC


@dataclass
class StateEnvelope:
    timestamp: str = ""
    task: str = "organ_health_recovery"
    human: dict = field(
        default_factory=lambda: {
            "state": "UNKNOWN",
            "source": "no_current_evidence",
            "confidence": 0.0,
        }
    )
    machine: dict = field(
        default_factory=lambda: {
            "state": "UNKNOWN",
            "observations": [],
            "confidence": 0.0,
        }
    )
    governance: dict = field(
        default_factory=lambda: {
            "state": "COHERENT",
            "session_valid": True,
            "authority_band": "GREEN",
        }
    )
    capital: dict = field(
        default_factory=lambda: {"expected_cost_rm": 0.0, "downside": "NONE"}
    )
    execution: dict = field(
        default_factory=lambda: {"rollback_available": True, "blast_radius": "LOW"}
    )


@dataclass
class Hypothesis:
    claim: str
    support: list[str] = field(default_factory=list)
    contradiction: list[str] = field(default_factory=list)
    confidence: float = 0.0
    next_test: str = ""
    epistemic: str = "INT"


@dataclass
class ActionCandidate:
    action: str
    action_class: ActionClass = ActionClass.OBSERVE
    target_service: str = ""
    executable: bool = False
    tool_available: bool = False
    reversibility: str = "FULL"
    blast_radius: str = "LOW"
    proposed_band: AutonomyBand = AutonomyBand.GREEN
    preconditions: list[str] = field(default_factory=list)
    expected_effect: str = ""
    rollback: str = ""
    observation_window_s: int = 120
    success_test: str = ""
    failure_test: str = ""
    on_failure: str = "HOLD"


@dataclass
class Receipt:
    timestamp: str = ""
    agent: str = "autonomic_recovery_v1"
    session_id: str = ""
    observed_condition: str = ""
    failure_class: str = ""
    hypotheses: list[dict] = field(default_factory=list)
    selected_action: str = ""
    action_class: str = ""
    target_service: str = ""
    preconditions_met: bool = False
    expected_result: str = ""
    actual_result: str = ""
    collateral_effects: str = "none_observed"
    verification_passed: bool = False
    confidence_before: float = 0.0
    confidence_after: float = 0.0
    mutations_used: int = 0
    band: str = "GREEN"
    proposed_band: str = "GREEN"
    verdict: str = ""
    stopped_reason: str = ""
    reusable_rule_candidate: bool = False
    epistemic_labels: dict = field(default_factory=dict)


# ── Persistent State ──────────────────────────────────────────────────────


def load_state() -> dict:
    """Load ARA persistent state (failure counts, cooldowns)."""
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception:
            pass
    return {"failure_counts": {}, "last_interventions": {}, "cooldowns": {}}


def save_state(state: dict) -> None:
    """Save ARA persistent state atomically."""
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2))
    tmp.rename(STATE_FILE)


# ── Stage 1: SENSE ───────────────────────────────────────────────────────


def sense_organs() -> list[OrganState]:
    """Probe all allowlisted organ health endpoints. Returns structured observations."""
    states = []
    for name, config in ALLOWLISTED_SERVICES.items():
        organ = OrganState(
            name=name,
            port=config["port"],
            systemd=config["systemd"],
            critical=config["critical"],
        )
        start = time.monotonic()
        try:
            result = subprocess.run(
                [
                    "curl",
                    "-sf",
                    "-o",
                    "/dev/null",
                    "-w",
                    "%{http_code}",
                    f"http://127.0.0.1:{config['port']}/health",
                ],
                capture_output=True,
                text=True,
                timeout=HEALTH_CHECK_TIMEOUT,
            )
            elapsed = (time.monotonic() - start) * 1000
            organ.latency_ms = round(elapsed, 1)
            organ.health_status = (
                int(result.stdout.strip()) if result.stdout.strip().isdigit() else 0
            )
            organ.reachable = organ.health_status == 200
            organ.evidence = f"HTTP {organ.health_status}, {organ.latency_ms}ms"
            organ.epistemic = "OBS"
        except subprocess.TimeoutExpired:
            organ.evidence = "TIMEOUT after 10s"
            organ.epistemic = "OBS"
        except Exception as e:
            organ.evidence = f"ERROR: {type(e).__name__}: {e}"
            organ.epistemic = "OBS"

        states.append(organ)
    return states


def build_state_envelope(organs: list[OrganState]) -> StateEnvelope:
    """Convert organ observations into a typed state envelope."""
    now = datetime.now(timezone.utc).isoformat()
    envelope = StateEnvelope(timestamp=now)

    healthy = [o for o in organs if o.reachable]
    failed = [o for o in organs if not o.reachable]

    if not failed:
        envelope.machine["state"] = "STABLE"
        envelope.machine["observations"] = [f"{o.name}: {o.evidence}" for o in organs]
        envelope.machine["confidence"] = 0.95
    elif len(failed) == 1:
        envelope.machine["state"] = "DEGRADED"
        envelope.machine["observations"] = [
            f"{o.name}: {o.evidence}" for o in organs
        ] + [f"FAILURE: {f.name} unreachable" for f in failed]
        envelope.machine["confidence"] = 0.90
    else:
        envelope.machine["state"] = "CRITICAL"
        envelope.machine["observations"] = [
            f"MULTIPLE_FAILURES: {[f.name for f in failed]}"
        ]
        envelope.machine["confidence"] = 0.85

    return envelope


# ── Stage 2: INTERPRET ───────────────────────────────────────────────────


def classify_failure(organ: OrganState, persistent_state: dict) -> FailureClass:
    """Classify failure type from observation + history."""
    if organ.reachable:
        return FailureClass.HEALTHY

    count = persistent_state.get("failure_counts", {}).get(organ.name, 0)

    # Check for cascading (multiple organs down)
    down_count = sum(
        1 for _ in ALLOWLISTED_SERVICES.values() if not _probe_quick(_["port"])
    )
    if down_count >= 2:
        return FailureClass.CASCADING

    if count >= MAX_RETRIES_BEFORE_HOLD:
        return FailureClass.PERSISTENT

    if count == 0:
        return FailureClass.TRANSIENT

    return FailureClass.UNKNOWN


def _probe_quick(port: int) -> bool:
    """Quick health probe. Returns True if healthy."""
    try:
        r = subprocess.run(
            [
                "curl",
                "-sf",
                "-o",
                "/dev/null",
                "-w",
                "%{http_code}",
                f"http://127.0.0.1:{port}/health",
            ],
            capture_output=True,
            text=True,
            timeout=5,
        )
        return r.stdout.strip() == "200"
    except Exception:
        return False


def generate_hypotheses(organ: OrganState) -> list[Hypothesis]:
    """Generate competing hypotheses for the failure."""
    hypotheses = []

    # H1: Transient network/service issue
    h1 = Hypothesis(
        claim="transient_service_issue",
        support=["first_observed_failure", "no_systemic_indicators"],
        contradiction=[],
        confidence=0.60,
        next_test="retry_health_check_after_30s",
        epistemic="INT",
    )
    hypotheses.append(h1)

    # H2: Service process crashed
    h2 = Hypothesis(
        claim="service_process_crashed",
        support=["health_endpoint_unreachable", "port_not_listening"],
        contradiction=["no_crash_logs_verified"],
        confidence=0.70,
        next_test="check_systemd_status_and_journal",
        epistemic="INT",
    )
    hypotheses.append(h2)

    # H3: Resource exhaustion
    h3 = Hypothesis(
        claim="resource_exhaustion",
        support=["could_be_oom_kill"],
        contradiction=["other_services_healthy"],
        confidence=0.30,
        next_test="check_dmesg_for_oom",
        epistemic="SPEC",
    )
    hypotheses.append(h3)

    # H4: Configuration error
    h4 = Hypothesis(
        claim="configuration_error",
        support=["recent_deploy_possible"],
        contradiction=["no_config_change_verified"],
        confidence=0.20,
        next_test="check_recent_git_commits",
        epistemic="SPEC",
    )
    hypotheses.append(h4)

    return hypotheses


# ── Stage 3: GENERATE OPTIONS ────────────────────────────────────────────


def generate_options(
    organ: OrganState, failure_class: FailureClass
) -> list[ActionCandidate]:
    """Generate bounded action candidates. Always includes 'do nothing'."""
    options = []

    # Option A: Do nothing (always present)
    options.append(
        ActionCandidate(
            action="do_nothing",
            action_class=ActionClass.OBSERVE,
            target_service=organ.name,
            executable=True,
            tool_available=True,
            reversibility="N/A",
            blast_radius="NONE",
            proposed_band=AutonomyBand.GREEN,
            expected_effect="No change. Log observation only.",
            success_test="N/A",
            failure_test="N/A",
        )
    )

    if not organ.reachable and failure_class in (
        FailureClass.TRANSIENT,
        FailureClass.UNKNOWN,
    ):
        # Option B: Retry health check (read-only)
        options.append(
            ActionCandidate(
                action="retry_health_check",
                action_class=ActionClass.RETRY_READ,
                target_service=organ.name,
                executable=True,
                tool_available=True,
                reversibility="N/A",
                blast_radius="NONE",
                proposed_band=AutonomyBand.GREEN,
                preconditions=["first_failure", "service_is_allowlisted"],
                expected_effect="Confirm whether failure is transient",
                observation_window_s=30,
                success_test="health_returns_200",
                failure_test="health_still_fails",
            )
        )

    if (
        not organ.reachable
        and failure_class == FailureClass.TRANSIENT
        and not organ.critical
    ):
        # Option C: Restart service (reversible mutation)
        options.append(
            ActionCandidate(
                action="restart_service",
                action_class=ActionClass.RESTART_SERVICE,
                target_service=organ.name,
                executable=True,
                tool_available=True,
                reversibility="FULL",
                blast_radius="LOW",
                proposed_band=AutonomyBand.GREEN,
                preconditions=[
                    "service_is_allowlisted",
                    "service_is_not_critical",
                    "failure_count < max_retries",
                    "no_active_write_transaction_known",
                ],
                expected_effect="health_endpoint_returns_200",
                rollback="systemctl_restart_again_or_manual",
                observation_window_s=OBSERVATION_WINDOW_SECONDS,
                success_test="two_consecutive_health_checks_pass",
                failure_test="restart_loop_detected_or_still_down",
                on_failure="HOLD_and_notify_arif",
            )
        )

    if failure_class in (
        FailureClass.PERSISTENT,
        FailureClass.CASCADING,
        FailureClass.UNKNOWN,
    ):
        # Option D: Hold and escalate
        options.append(
            ActionCandidate(
                action="hold_and_escalate",
                action_class=ActionClass.HOLD,
                target_service=organ.name,
                executable=True,
                tool_available=True,
                reversibility="N/A",
                blast_radius="NONE",
                proposed_band=AutonomyBand.RED,
                expected_effect="System enters HOLD, Arif notified",
                success_test="arif_acknowledged",
                failure_test="N/A",
            )
        )

    return options


# ── Stage 4: FITNESS & POLICY EVALUATION ─────────────────────────────────


def evaluate_fitness(
    option: ActionCandidate,
    envelope: StateEnvelope,
    persistent_state: dict,
) -> tuple[Verdict, float, str]:
    """
    Evaluate whether an action candidate should proceed.
    Returns (verdict, confidence, reason).
    """

    # BLACK: forbidden actions
    if option.action_class == ActionClass.FORBIDDEN:
        return Verdict.FORBIDDEN, 1.0, "Action is constitutionally forbidden"

    # Check cooldown
    cooldowns = persistent_state.get("cooldowns", {})
    if option.target_service in cooldowns:
        cooldown_until = cooldowns[option.target_service]
        if datetime.now(timezone.utc).isoformat() < cooldown_until:
            return Verdict.HOLD, 0.95, f"Service in cooldown until {cooldown_until}"

    # Check mutation budget
    mutations_used = persistent_state.get("mutations_used_this_run", 0)
    if (
        option.action_class == ActionClass.RESTART_SERVICE
        and mutations_used >= MAX_MUTATIONS
    ):
        return (
            Verdict.HOLD,
            0.99,
            f"Mutation budget exhausted ({mutations_used}/{MAX_MUTATIONS})",
        )

    # Capability test
    if not option.executable or not option.tool_available:
        return (
            Verdict.INSUFFICIENT_DATA,
            0.5,
            "Action not executable or tool unavailable",
        )

    # Fitness test for restart
    if option.action_class == ActionClass.RESTART_SERVICE:
        machine_state = envelope.machine.get("state", "UNKNOWN")
        if machine_state == "CRITICAL":
            return (
                Verdict.HOLD,
                0.90,
                "Multiple organs down — cascading failure, do not restart one",
            )

        failure_count = persistent_state.get("failure_counts", {}).get(
            option.target_service, 0
        )
        if failure_count >= MAX_RETRIES_BEFORE_HOLD:
            return Verdict.HOLD, 0.85, f"Already retried {failure_count}x — enter HOLD"

    # All checks passed
    return (
        Verdict.PROCEED,
        0.80,
        "Fitness checks passed, action authorized within GREEN band",
    )


def select_action(
    options: list[ActionCandidate], envelope: StateEnvelope, persistent_state: dict
) -> tuple[ActionCandidate, Verdict, float, str]:
    """
    Select the smallest safe action from the option set.
    Policy: prefer bounded action over inaction when fitness passes.
    Order: most-likely-to-help first, do_nothing as fallback.
    """
    # Separate into action candidates vs observe-only
    action_options = []
    observe_options = []

    for option in options:
        verdict, confidence, reason = evaluate_fitness(
            option, envelope, persistent_state
        )
        entry = (option, verdict, confidence, reason)
        if option.action_class == ActionClass.OBSERVE:
            observe_options.append(entry)
        else:
            action_options.append(entry)

    # Prefer action options that pass fitness
    for option, verdict, confidence, reason in action_options:
        if verdict == Verdict.PROCEED:
            return option, verdict, confidence, reason

    # Then observe options that pass
    for option, verdict, confidence, reason in observe_options:
        if verdict == Verdict.PROCEED:
            return option, verdict, confidence, reason

    # If nothing passes, return first action option as HOLD
    if action_options:
        option, verdict, confidence, reason = action_options[0]
        return option, Verdict.HOLD, confidence, reason

    # Ultimate fallback
    fallback = options[0] if options else ActionCandidate(action="do_nothing")
    return (
        fallback,
        Verdict.HOLD,
        0.5,
        "No action passed fitness evaluation — defaulting to observe",
    )


# ── Stage 5: ACT ─────────────────────────────────────────────────────────


def execute_action(candidate: ActionCandidate, organ: OrganState) -> tuple[bool, str]:
    """
    Execute the selected action. Returns (success, detail).
    All mutations are bounded and reversible.
    """
    if candidate.action_class == ActionClass.OBSERVE:
        return True, "Observation logged, no mutation performed"

    if candidate.action_class == ActionClass.RETRY_READ:
        # Wait 30 seconds, then re-probe
        time.sleep(30)
        reachable = _probe_quick(organ.port)
        return reachable, f"Retry result: {'healthy' if reachable else 'still failing'}"

    if candidate.action_class == ActionClass.RESTART_SERVICE:
        try:
            # Preserve logs before restart
            log_dir = RECEIPT_DIR / "pre-restart-logs"
            log_dir.mkdir(parents=True, exist_ok=True)
            ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            log_file = log_dir / f"{organ.name}-{ts}.log"
            journal = subprocess.run(
                [
                    "journalctl",
                    "-u",
                    organ.systemd,
                    "--since",
                    "10 min ago",
                    "--no-pager",
                    "-q",
                ],
                capture_output=True,
                text=True,
                timeout=15,
            )
            log_file.write_text(journal.stdout)

            # Execute restart
            result = subprocess.run(
                ["systemctl", "restart", organ.systemd],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode != 0:
                return False, f"systemctl restart failed: {result.stderr}"

            return True, f"Service restarted. Pre-restart logs preserved at {log_file}"
        except Exception as e:
            return False, f"Restart failed: {type(e).__name__}: {e}"

    if candidate.action_class == ActionClass.HOLD:
        return True, "HOLD entered. No mutation performed. Arif notification required."

    return False, f"Unknown action class: {candidate.action_class}"


# ── Stage 6: VERIFY ──────────────────────────────────────────────────────


def verify_action(candidate: ActionCandidate, organ: OrganState) -> tuple[bool, str]:
    """
    Independent post-action verification. Never trusts the action itself.
    """
    if candidate.action_class in (ActionClass.OBSERVE, ActionClass.HOLD):
        return True, "No verification needed for observe/hold actions"

    if candidate.action_class == ActionClass.RETRY_READ:
        reachable = _probe_quick(organ.port)
        return reachable, f"Post-retry verification: {'PASS' if reachable else 'FAIL'}"

    if candidate.action_class == ActionClass.RESTART_SERVICE:
        # Wait for service to stabilize
        time.sleep(10)

        # Two consecutive health checks
        check1 = _probe_quick(organ.port)
        time.sleep(5)
        check2 = _probe_quick(organ.port)

        if check1 and check2:
            return True, "Two consecutive health checks passed after restart"
        elif check1 and not check2:
            return False, "First check passed, second failed — unstable"
        else:
            return False, "Health check still failing after restart"

    return False, "Unknown action class — cannot verify"


# ── Stage 7: LEARN ───────────────────────────────────────────────────────


def write_receipt(receipt: Receipt) -> Path:
    """Write receipt to append-only log."""
    RECEIPT_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    receipt_file = RECEIPT_DIR / f"ara-v1-{ts}.json"
    receipt_file.write_text(json.dumps(asdict(receipt), indent=2))

    # Also append to ledger
    ledger = RECEIPT_DIR / "ara-v1-ledger.jsonl"
    with ledger.open("a") as f:
        f.write(json.dumps(asdict(receipt)) + "\n")

    return receipt_file


def update_persistent_state(
    persistent_state: dict,
    organ_name: str,
    action_class: ActionClass,
    success: bool,
) -> dict:
    """Update failure counts and cooldowns based on outcome."""
    counts = persistent_state.setdefault("failure_counts", {})
    interventions = persistent_state.setdefault("last_interventions", {})
    cooldowns = persistent_state.setdefault("cooldowns", {})

    if success and action_class == ActionClass.RESTART_SERVICE:
        # Reset failure count on successful recovery
        counts[organ_name] = 0
        # Set cooldown: don't restart same service for 30 minutes
        cooldown_until = (
            datetime.now(timezone.utc) + timedelta(minutes=30)
        ).isoformat()
        cooldowns[organ_name] = cooldown_until
        interventions[organ_name] = {
            "action": "restart_service",
            "result": "success",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    elif not success and action_class == ActionClass.RESTART_SERVICE:
        # Increment failure count
        counts[organ_name] = counts.get(organ_name, 0) + 1
        interventions[organ_name] = {
            "action": "restart_service",
            "result": "failed",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    elif action_class == ActionClass.RETRY_READ:
        if not success:
            counts[organ_name] = counts.get(organ_name, 0) + 1

    # Track mutations this run
    if action_class == ActionClass.RESTART_SERVICE:
        persistent_state["mutations_used_this_run"] = (
            persistent_state.get("mutations_used_this_run", 0) + 1
        )

    return persistent_state


# ── Main Loop ─────────────────────────────────────────────────────────────


def run_ara_v1(dry_run: bool = False) -> Receipt:
    """
    Execute one complete ARA-v1 cycle.
    SENSE → INTERPRET → GENERATE OPTIONS → EVALUATE → ACT → VERIFY → LEARN
    """
    receipt = Receipt(
        timestamp=datetime.now(timezone.utc).isoformat(),
        agent="autonomic_recovery_v1",
    )

    persistent_state = load_state()
    persistent_state["mutations_used_this_run"] = 0

    # ── SENSE ──
    organs = sense_organs()
    envelope = build_state_envelope(organs)

    # Find the first unhealthy organ
    failed_organs = [o for o in organs if not o.reachable]

    if not failed_organs:
        receipt.observed_condition = "all_organs_healthy"
        receipt.failure_class = "HEALTHY"
        receipt.verdict = "PROCEED"
        receipt.confidence_after = 0.95
        receipt.epistemic_labels["observation"] = "OBS"
        save_state(persistent_state)
        write_receipt(receipt)
        return receipt

    # Focus on first failed organ
    target = failed_organs[0]
    receipt.observed_condition = f"{target.name}_unreachable"
    receipt.target_service = target.name

    # ── INTERPRET ──
    target.failure_class = classify_failure(target, persistent_state)
    receipt.failure_class = target.failure_class.value
    hypotheses = generate_hypotheses(target)
    receipt.hypotheses = [asdict(h) for h in hypotheses]

    best_hypothesis = max(hypotheses, key=lambda h: h.confidence)
    receipt.confidence_before = best_hypothesis.confidence
    receipt.epistemic_labels["interpretation"] = best_hypothesis.epistemic

    # ── GENERATE OPTIONS ──
    options = generate_options(target, target.failure_class)

    # ── EVALUATE & SELECT ──
    selected, verdict, confidence, reason = select_action(
        options, envelope, persistent_state
    )
    receipt.selected_action = selected.action
    receipt.action_class = selected.action_class.value
    receipt.proposed_band = selected.proposed_band.value
    receipt.verdict = verdict.value

    # ── ACT ──
    if dry_run:
        receipt.actual_result = "DRY_RUN — no mutation performed"
        receipt.stopped_reason = "dry_run_mode"
        save_state(persistent_state)
        write_receipt(receipt)
        return receipt

    if verdict == Verdict.HOLD:
        receipt.stopped_reason = reason
        receipt.actual_result = "HOLD — no action taken"
        save_state(persistent_state)
        write_receipt(receipt)
        return receipt

    if verdict == Verdict.FORBIDDEN:
        receipt.stopped_reason = reason
        receipt.actual_result = "FORBIDDEN — action blocked"
        save_state(persistent_state)
        write_receipt(receipt)
        return receipt

    success, detail = execute_action(selected, target)
    receipt.actual_result = detail
    receipt.mutations_used = persistent_state.get("mutations_used_this_run", 0)

    # ── VERIFY ──
    if success and selected.action_class in (
        ActionClass.RESTART_SERVICE,
        ActionClass.RETRY_READ,
    ):
        verified, verify_detail = verify_action(selected, target)
        receipt.verification_passed = verified
        receipt.collateral_effects = verify_detail

        if verified:
            receipt.confidence_after = min(0.90, confidence + 0.10)
            receipt.reusable_rule_candidate = True
        else:
            receipt.confidence_after = max(0.10, confidence - 0.30)
            # ESCALATION: retry failed → re-evaluate and try restart if allowed
            if selected.action_class == ActionClass.RETRY_READ and not verified:
                persistent_state.setdefault("failure_counts", {})[target.name] = (
                    persistent_state.get("failure_counts", {}).get(target.name, 0) + 1
                )
                target.failure_class = FailureClass.PERSISTENT
                escalated_options = generate_options(target, target.failure_class)
                for opt in escalated_options:
                    if opt.action_class == ActionClass.RESTART_SERVICE:
                        ev_verdict, ev_conf, ev_reason = evaluate_fitness(
                            opt, envelope, persistent_state
                        )
                        if ev_verdict == Verdict.PROCEED:
                            receipt.selected_action = opt.action
                            receipt.action_class = opt.action_class.value
                            restart_ok, restart_detail = execute_action(opt, target)
                            receipt.actual_result = (
                                f"retry_failed_then: {restart_detail}"
                            )
                            receipt.mutations_used = persistent_state.get(
                                "mutations_used_this_run", 0
                            )
                            if restart_ok:
                                v2, v2d = verify_action(opt, target)
                                receipt.verification_passed = v2
                                receipt.collateral_effects = v2d
                                receipt.confidence_after = 0.85 if v2 else 0.30
                            break
                if (
                    not receipt.verification_passed
                    and receipt.action_class == "RETRY_READ"
                ):
                    receipt.stopped_reason = "retry_failed_restart_not_available"
    else:
        receipt.verification_passed = success
        receipt.confidence_after = confidence

    # ── LEARN ──
    persistent_state = update_persistent_state(
        persistent_state, target.name, selected.action_class, success
    )
    save_state(persistent_state)
    receipt_path = write_receipt(receipt)

    return receipt


# ── CLI Entry Point ───────────────────────────────────────────────────────


def main():
    dry_run = "--dry-run" in sys.argv

    print("=" * 60)
    print("ARA-v1 — Autonomic Recovery Agent v1")
    print(f"Time: {datetime.now(timezone.utc).isoformat()}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print(f"Max mutations: {MAX_MUTATIONS}")
    print(f"Lease: {LEASE_MINUTES} minutes")
    print("=" * 60)

    receipt = run_ara_v1(dry_run=dry_run)

    print(f"\nObserved:  {receipt.observed_condition}")
    print(f"Class:     {receipt.failure_class}")
    print(f"Action:    {receipt.selected_action}")
    print(f"Verdict:   {receipt.verdict}")
    print(f"Verified:  {receipt.verification_passed}")
    print(
        f"Confidence: {receipt.confidence_before:.2f} → {receipt.confidence_after:.2f}"
    )
    print(f"Mutations: {receipt.mutations_used}/{MAX_MUTATIONS}")
    if receipt.stopped_reason:
        print(f"Stopped:   {receipt.stopped_reason}")
    print(f"Receipt:   {receipt.timestamp}")

    # Exit code: 0 = healthy or recovered, 1 = hold/escalation needed
    if receipt.verdict in ("PROCEED",) and receipt.failure_class == "HEALTHY":
        sys.exit(0)
    elif receipt.verification_passed:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
