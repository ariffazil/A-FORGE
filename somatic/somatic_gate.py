#!/usr/bin/env python3
"""
Somatic Gate — CLI/HTTP entry point for wiring into forge_* calls.

This is the integration point between the somatic kernel (Python) and
the A-FORGE execution shell (TypeScript). Every forge_* tool call can
route through this gate before execution.

CLI Usage:
  python3 somatic_gate.py --tool forge_shell --action MUTATE --args '{"command":"ls"}'
  python3 somatic_gate.py --tool arif_observe --action OBSERVE --args '{"query":"test"}'
  python3 somatic_gate.py --serve  # start HTTP server on :18099

HTTP Usage:
  POST http://localhost:18099/gate
  Body: {"tool_name": "forge_shell", "arguments": {...}, "action_class": "MUTATE"}

Output: JSON with verdict, allowed, phases, adaptations, preparations.

F9 ANTI-HANTU: Gate is deterministic. No inference. No feelings.
DITEMPA BUKAN DIBERI — Forged 2026-07-12.
"""

import json
import sys
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from somatic_envelope import SomaticEnvelope, wrap_call
from coregulation import CoRegulator, get_adaptations
from allostatic import AllostaticPlanner, prepare_for_task


def run_gate(
    tool_name: str,
    arguments: dict,
    action_class: str = "OBSERVE",
    ack_irreversible: bool = False,
    message: str | None = None,
    tools_needed: list[str] | None = None,
) -> dict:
    """
    Run the full somatic gate pipeline.

    Steps:
      1. Somatic envelope (SENSE→ORIENT→PREDICT→GATE→ACT stub)
      2. Co-regulation (WELL human state → adaptations)
      3. Allostatic preparation (pre-allocate resources)

    Returns: {
      verdict, allowed, reflexes, scars, adaptations, preparations,
      envelope_result, human_state, total_duration_ms
    }
    """
    start = time.monotonic()

    # 1. Somatic envelope (without executing — we just want the gate)
    envelope = SomaticEnvelope()
    action_ctx = {
        "action_class": action_class,
        "ack_irreversible": ack_irreversible,
        "tool_name": tool_name,
    }

    # SENSE
    sense = envelope._phase_sense()
    somatic_state = sense.data.get("somatic_state", {}) if sense.status == "OK" else {}

    # ORIENT
    orient = envelope._phase_orient(somatic_state, action_ctx)

    # PREDICT
    predict = envelope._phase_predict(somatic_state, action_ctx)

    # GATE (reflexes + scars)
    gate = envelope._phase_gate(somatic_state, action_ctx)

    gate_data = gate.data if gate.status == "OK" else {}
    reflex_verdict = gate_data.get("reflex_verdict", "ALLOW")
    scar_result = gate_data.get("scar_result", {})
    combined_verdict = gate_data.get("combined_verdict", "ALLOW")

    # 2. Co-regulation
    coreg = CoRegulator()
    human_state = coreg.sense_human_state(message)
    adaptations = coreg.compute_adaptations(human_state)

    # Apply vitality gate to verdict
    if human_state.vitality_gate == "BLOCK":
        combined_verdict = "BLOCK"
    elif human_state.vitality_gate == "RECOVER" and combined_verdict == "ALLOW":
        combined_verdict = "WARN"

    # 3. Allostatic preparation
    allostatic_planner = AllostaticPlanner()
    preparation = allostatic_planner.prepare(
        task_description=f"Tool call: {tool_name}",
        action_class=action_class,
        reversibility="FULL" if action_class == "OBSERVE" else "PARTIAL",
        tools_needed=tools_needed or [tool_name],
    )

    # Determine if allowed
    allowed = combined_verdict not in ("BLOCK", "HOLD")

    total_ms = (time.monotonic() - start) * 1000

    return {
        "verdict": combined_verdict,
        "allowed": allowed,
        "tool_name": tool_name,
        "action_class": action_class,
        "reflexes": gate_data.get("reflex_result", {}),
        "scars": {
            "fired": scar_result.get("total_fired", 0),
            "constraints": scar_result.get("constraint_summary", []),
            "highest_pressure": scar_result.get("highest_pressure", 0),
        },
        "adaptations": adaptations.to_dict(),
        "preparations": [p.__dict__ for p in preparation.preparations],
        "transport_state": preparation.transport_state,
        "autonomy_adjustment": preparation.autonomy_adjustment,
        "human_state": {
            "polyvagal": human_state.polyvagal,
            "fatigue": human_state.fatigue,
            "stress": human_state.stress,
            "vitality_color": human_state.vitality_color,
            "vitality_gate": human_state.vitality_gate,
        },
        "prediction": predict.data if predict.status == "OK" else {},
        "orient": orient.data if orient.status == "OK" else {},
        "total_duration_ms": round(total_ms, 2),
    }


# --- HTTP Server ---


class SomaticGateHandler(BaseHTTPRequestHandler):
    """HTTP handler for somatic gate."""

    def do_POST(self):
        if self.path != "/gate":
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'{"error":"not found"}')
            return

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)

            result = run_gate(
                tool_name=data.get("tool_name", "unknown"),
                arguments=data.get("arguments", {}),
                action_class=data.get("action_class", "OBSERVE"),
                ack_irreversible=data.get("ack_irreversible", False),
                message=data.get("message"),
                tools_needed=data.get("tools_needed"),
            )

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(result, indent=2).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(
                json.dumps(
                    {
                        "status": "ok",
                        "service": "somatic-gate",
                        "version": "P6",
                        "modules": ["envelope", "coregulation", "allostatic"],
                    }
                ).encode()
            )
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        """Suppress default logging."""
        pass


def serve(port: int = 18099):
    """Start the somatic gate HTTP server."""
    server = HTTPServer(("127.0.0.1", port), SomaticGateHandler)
    print(f"Somatic Gate listening on http://127.0.0.1:{port}")
    print(f"  POST /gate  — run somatic pipeline")
    print(f"  GET  /health — health check")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()


# --- CLI ---


def main():
    args = sys.argv[1:]

    if not args:
        print("Somatic Gate — P0-P6 integration point")
        print()
        print("CLI:")
        print(
            '  python3 somatic_gate.py --tool forge_shell --action MUTATE --args \'{"command":"ls"}\''
        )
        print("  python3 somatic_gate.py --serve              # start HTTP on :18099")
        print("  python3 somatic_gate.py --test               # run integration test")
        print()
        print("HTTP:")
        print("  POST http://localhost:18099/gate")
        print(
            '  Body: {"tool_name":"forge_shell","arguments":{},"action_class":"MUTATE"}'
        )
        return

    if "--serve" in args:
        port = 18099
        for i, a in enumerate(args):
            if a == "--port" and i + 1 < len(args):
                port = int(args[i + 1])
        serve(port)
        return

    if "--test" in args:
        run_integration_test()
        return

    # CLI mode
    tool_name = "unknown"
    action_class = "OBSERVE"
    tool_args = {}
    message = None

    for i, a in enumerate(args):
        if a == "--tool" and i + 1 < len(args):
            tool_name = args[i + 1]
        elif a == "--action" and i + 1 < len(args):
            action_class = args[i + 1]
        elif a == "--args" and i + 1 < len(args):
            try:
                tool_args = json.loads(args[i + 1])
            except json.JSONDecodeError:
                tool_args = {}
        elif a == "--message" and i + 1 < len(args):
            message = args[i + 1]

    result = run_gate(
        tool_name=tool_name,
        arguments=tool_args,
        action_class=action_class,
        message=message,
    )
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["allowed"] else 1)


def run_integration_test():
    """Test the gate with various scenarios."""
    print("Somatic Gate — Integration Test")
    print("=" * 50)

    tests = []

    # Test 1: OBSERVE should be allowed
    r1 = run_gate("arif_observe", {"query": "test"}, "OBSERVE")
    tests.append(("OBSERVE → allowed", r1["allowed"]))

    # Test 2: MUTATE should be blocked (OBSERVE_ONLY)
    r2 = run_gate("forge_shell", {"command": "ls"}, "MUTATE")
    tests.append(("MUTATE with OBSERVE_ONLY → blocked", not r2["allowed"]))
    tests.append(
        (
            "MUTATE → R01 fires",
            any(r["id"] == "R01" for r in r2["reflexes"].get("triggered", [])),
        )
    )

    # Test 3: IRREVERSIBLE should be blocked
    r3 = run_gate("forge_filesystem_delete", {"path": "/tmp/test"}, "IRREVERSIBLE")
    tests.append(("IRREVERSIBLE → blocked", not r3["allowed"]))

    # Test 4: Gate returns adaptations
    tests.append(("Has adaptations", "adaptations" in r1))
    tests.append(("Has human_state", "human_state" in r1))

    # Test 5: Gate returns preparations
    tests.append(("Has preparations", "preparations" in r1))

    # Test 6: Gate returns reflexes
    tests.append(("Has reflexes", "reflexes" in r2))

    # Test 7: Gate returns scars
    tests.append(("Has scars", "scars" in r2))

    # Test 8: Gate returns prediction
    tests.append(("Has prediction", "prediction" in r1))

    # Test 9: Duration is positive
    tests.append(("Duration > 0", r1["total_duration_ms"] > 0))

    # Test 10: Verdict is valid
    valid_verdicts = {"ALLOW", "BLOCK", "HOLD", "WARN", "RECOVER"}
    tests.append(("Verdict is valid", r1["verdict"] in valid_verdicts))

    # Print results
    passed = sum(1 for _, ok in tests if ok)
    failed = len(tests) - passed
    for name, ok in tests:
        mark = "✅" if ok else "❌"
        print(f"  {mark} {name}")

    print(f"\n  Results: {passed}/{len(tests)} passed")

    # Print sample output
    print("\n--- Sample: OBSERVE ---")
    print(
        json.dumps(
            {
                "verdict": r1["verdict"],
                "allowed": r1["allowed"],
                "adaptations": {
                    "response_length": r1["adaptations"]["response_length"],
                    "tool_tier_ceiling": r1["adaptations"]["tool_tier_ceiling"],
                },
                "human_state": r1["human_state"],
                "preparations_count": len(r1["preparations"]),
            },
            indent=2,
        )
    )

    print("\n--- Sample: MUTATE (blocked) ---")
    print(
        json.dumps(
            {
                "verdict": r2["verdict"],
                "allowed": r2["allowed"],
                "reflexes_triggered": [
                    r["id"] for r in r2["reflexes"].get("triggered", [])
                ],
                "scars_fired": r2["scars"]["fired"],
            },
            indent=2,
        )
    )

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
