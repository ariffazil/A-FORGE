#!/usr/bin/env python3
"""
quantum_organ.py
═══════════════════════════════════════════════════════════════════════════════
Minimal quantum compute organ for A-FORGE.

- No governance. No verdict. No seal.
- Pure statevector simulation using only stdlib complex numbers.
- Exposes one endpoint: POST /compute
- Returns EvidenceItem-shaped JSON that the TS kernel ingests at phase 111.
- Labels every result with backend, backend_class, and evidence_rank so the
  kernel never treats a simulator output as physical quantum evidence.

DITEMPA BUKAN DIBERI
"""

import json
import math
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Tiny linear-algebra helpers (no external deps)
# ═══════════════════════════════════════════════════════════════════════════════


def zeros(n: int) -> list[complex]:
    return [0j for _ in range(n)]


def eye(d: int) -> list[list[complex]]:
    return [[1j if i == j else 0j for j in range(d)] for i in range(d)]


def mat_mul(A: list[list[complex]], B: list[complex]) -> list[complex]:
    return [sum(A[i][j] * B[j] for j in range(len(B))) for i in range(len(A))]


def kron(A: list[list[complex]], B: list[list[complex]]) -> list[list[complex]]:
    ra, ca = len(A), len(A[0])
    rb, cb = len(B), len(B[0])
    return [
        [
            A[i // rb][j // cb] * B[i % rb][j % cb]
            for j in range(ca * cb)
        ]
        for i in range(ra * rb)
    ]


# ═══════════════════════════════════════════════════════════════════════════════
# 2. Statevector simulator (software geometry, not hardware cosplay)
# ═══════════════════════════════════════════════════════════════════════════════

GATES: dict[str, list[list[complex]]] = {
    "H": [[1 / math.sqrt(2), 1 / math.sqrt(2)], [1 / math.sqrt(2), -1 / math.sqrt(2)]],
    "X": [[0j, 1j], [1j, 0j]],
    "Y": [[0j, -1j], [1j, 0j]],
    "Z": [[1j, 0j], [0j, -1j]],
    "I": eye(2),
}


def basis_state(n_qubits: int, idx: int) -> list[complex]:
    s = zeros(2**n_qubits)
    s[idx] = 1j
    return s


def single_gate_matrix(gate: str, target: int, n_qubits: int) -> list[list[complex]]:
    # Build I ⊗ ... ⊗ gate_target ⊗ ... ⊗ I with qubit 0 as the least-significant bit.
    mat = eye(1)
    for q in range(n_qubits - 1, -1, -1):
        mat = kron(mat, GATES[gate] if q == target else GATES["I"])
    return mat


def cnot_matrix(control: int, target: int, n_qubits: int) -> list[list[complex]]:
    dim = 2**n_qubits
    mat = [[0j for _ in range(dim)] for _ in range(dim)]
    for i in range(dim):
        c_bit = (i >> control) & 1
        j = i ^ (1 << target) if c_bit else i
        mat[j][i] = 1j
    return mat


def run_circuit(n_qubits: int, ops: list[dict[str, Any]]) -> list[complex]:
    state = basis_state(n_qubits, 0)
    for op in ops:
        t = op["type"]
        if t == "single":
            state = mat_mul(single_gate_matrix(op["gate"], op["target"], n_qubits), state)
        elif t == "cnot":
            state = mat_mul(cnot_matrix(op["control"], op["target"], n_qubits), state)
        else:
            raise ValueError(f"Unknown op type: {t}")
    return state


def measure_probabilities(state: list[complex]) -> list[float]:
    return [abs(x) ** 2 for x in state]


# ═══════════════════════════════════════════════════════════════════════════════
# 3. Backend dispatch + evidence formatter
# ═══════════════════════════════════════════════════════════════════════════════

# backend_class: physical = real quantum device; simulator = noiseless/noisy model;
# mock = placeholder / random / stub. Never let simulator/mock pass as physical.
BACKEND_REGISTRY: dict[str, str] = {
    "qiskit": "physical",
    "cirq": "physical",
    "braket": "physical",
    "simulator": "simulator",
    "mock": "mock",
}


def execute_backend(
    backend: str, n_qubits: int, ops: list[dict[str, Any]]
) -> tuple[list[complex], str]:
    """Run the requested backend. Only 'simulator' is implemented here."""
    backend_class = BACKEND_REGISTRY.get(backend, "mock")

    if backend_class == "physical":
        # Real quantum backends are not wired in this minimal organ.
        raise NotImplementedError(
            f"Physical backend '{backend}' requires provider credentials and runtime. "
            "Falling back is not allowed without explicit re-labeling."
        )

    if backend_class == "mock":
        raise ValueError(
            f"Backend '{backend}' is not available. Use 'simulator' for statevector evidence."
        )

    # simulator path
    state = run_circuit(n_qubits, ops)
    return state, backend_class


def format_evidence(
    req: dict[str, Any], state: list[complex], backend_class: str
) -> dict[str, Any]:
    """Return EvidenceItem with explicit backend class and evidence rank."""
    probs = measure_probabilities(state)
    dominant = max(range(len(probs)), key=lambda i: probs[i])

    # evidence_rank: simulator outputs are never OBSERVED physical evidence.
    if backend_class == "simulator":
        uncertainty = "ESTIMATE"
        evidence_rank = "SIMULATED"
    elif backend_class == "mock":
        uncertainty = "UNKNOWN"
        evidence_rank = "SPECULATED"
    else:
        uncertainty = "ESTIMATE"
        evidence_rank = "OBSERVED"

    return {
        "id": req.get("id", "quantum-evidence-1"),
        "source": "QUANTUM",
        "payload": {
            "n_qubits": req["n_qubits"],
            "ops": req["ops"],
            "statevector_real": [x.real for x in state],
            "statevector_imag": [x.imag for x in state],
            "probabilities": probs,
            "dominant_outcome": dominant,
            "backend": req.get("backend", "simulator"),
            "backend_class": backend_class,
            "evidence_rank": evidence_rank,
            "note": "statevector simulation; not physical quantum execution",
        },
        "uncertainty": uncertainty,
        "lineageId": req.get("lineageId"),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 4. HTTP server — dumb pipe
# ═══════════════════════════════════════════════════════════════════════════════

class QuantumOrganHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args: Any) -> None:
        # quiet logs; A-FORGE handles observability
        pass

    def _json_response(self, status: int, body: dict[str, Any]) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode())

    def do_POST(self) -> None:
        if self.path != "/compute":
            self._json_response(404, {"error": "only /compute is supported"})
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
            backend = body.get("backend", "simulator")
            state, backend_class = execute_backend(
                backend, body["n_qubits"], body["ops"]
            )
            evidence = format_evidence(body, state, backend_class)
            self._json_response(200, {"evidence": [evidence]})
        except Exception as exc:
            self._json_response(500, {"error": str(exc)})

    def do_GET(self) -> None:
        if self.path == "/health":
            self._json_response(200, {"status": "ok", "organ": "QUANTUM"})
        else:
            self._json_response(404, {"error": "not found"})


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8100
    server = HTTPServer(("127.0.0.1", port), QuantumOrganHandler)
    print(f"quantum_organ listening on http://127.0.0.1:{port}", file=sys.stderr)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nshutting down", file=sys.stderr)


if __name__ == "__main__":
    main()
