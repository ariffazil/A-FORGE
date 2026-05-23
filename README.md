<!-- SOT-MANIFEST
owner: Arif
last_verified: 2026-05-23
valid_from: 2026-05-23
valid_until: 2026-06-23
confidence: high
scope: /root/A-FORGE
epistemic_status: CLAIM
-->

# A-FORGE — Governed Execution Runtime

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8%2B-3178C6?style=flat-square)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?style=flat-square)](https://nodejs.org/)
[![arifOS](https://img.shields.io/badge/arifOS-F1%E2%80%93F13_Governed-FF6B00?style=flat-square)](https://github.com/ariffazil/arifos)

> **In one sentence:** A-FORGE is the engine — when arifOS says "SEAL," A-FORGE is what actually runs the code, builds the artifact, or executes the task on the VPS.

**Status:** EXECUTION (Current L3 State) | **Organ:** FORGE (Ξ)
**Target State:** [AAA² Execution Substrate](../AAA/docs/architecture/AAA2_Kernel_UAA_PSP_v2026.05.md)

---

## 🏛️ What this repo IS
- The **Execution runtime** for governed agents.
- The **AgentEngine** that orchestrates tools, plans, and budget.
- The **Enforcement bridge** that physically gates execution based on arifOS verdicts.

## 🚫 What this repo is NOT
- **The Law:** A-FORGE executes under governance. It does not grant itself authority.
- **The Cockpit:** A-FORGE is headless. Interfaces live in [AAA](../AAA).

*Important:* We run the code upon SEAL. We do not claim judgment or law authority.

---

## 🔄 Execution Flow

```mermaid
graph TD
    A[Human / Agent Request] --> B[CLI / MCP / HTTP Bridge]
    B --> C[AgentEngine - Budget / Routing]
    C --> D[Governance Gates F3-F13]
    D -->|Request Verdict| E((arifOS Kernel))
    E -->|SEAL| F[Tool Execution]
    E -->|HOLD| G[Approval Boundary]
    F --> H[(VAULT999)]
```

---

## 🗺️ Canonical Repo Contents

- **`src/`**: The ONLY canonical TypeScript source. Contains `engine/`, `mcp/`, `governance/`, `tools/`.
- **`dist/`**: Compiled NodeNext ESM resolution builds. Never edit directly.
- **`test/`**: Node.js built-in `node:test` suite.

### 📌 The AAA² Target State
*In the AAA² roadmap, A-FORGE will evolve into the Execution Substrate (Ξ), abstracting Docker/Process/WASM environments to execute governed actions passed via the Portable State Protocol.*

---
*Last Verified: 2026-05-23 | 999 SEAL ALIVE*
