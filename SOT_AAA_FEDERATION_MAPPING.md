# SOT: AAA Federation Integration Mapping
**Timestamp:** 2026-04-16
**Status:** HEADED_TRANSITION
**Seal:** PARTIAL (Cooling Required)

This document maps the required updates across the arifOS ecosystem repositories to reflect the newly integrated **AAA-Agent (Federal Coordinator)**, **ARCHIVIST-Agent (Canon Keeper)**, and **NOTIFIER-Agent (Human-Loop Delivery)**.

---

## 1. `A-FORGE` (Execution Substrate / Body)
*Location: `/root`*

### Files to Update:
*   **`README.md`**:
    *   **Update:** Declare the transition from "Headless" to "Headed" execution.
    *   **Detail:** Add AAA-Agent routing, VAULT999 automated canon writing via Archivist, and 888_HOLD webhook integration via Notifier.
    *   **Caveat:** Explicitly state that `LoopController`, `TaskGraphPlanner`, `AgentHandoff`, and `EvalHarness` remain in **HOLD** per canon v2026-04-10.
*   **`AGENTS.md`**:
    *   **Update:** Expand the agent registry to include the 9-Agent Federation.
    *   **Detail:** Add `AAA-Agent` (ASI), `ARCHIVIST-Agent` (AGI), and `NOTIFIER-Agent` (TOOL).
*   **`ARCHITECTURE.md`**:
    *   **Update:** Map the new intent routing topology (`POST /route`).
    *   **Detail:** Diagram the flow from `AAA-Agent` to Specialist Organs (GEOX/WEALTH) to VAULT999.

---

## 2. `arifOS` (Constitutional Law / Nucleus)
*Location: `/root/arifOS`*

### Files to Update:
*   **`README.md` / `ARCHITECTURE.md`**:
    *   **Update:** Acknowledge `A-FORGE` as the official **Execution Adapter** that fulfills the AAA routing and Vault persistence requirements.
    *   **Detail:** Reiterate the Gödel Lock mechanism—AAA cannot SEAL itself on high-risk paths and must defer to F13 (Human Sovereign) via the Notifier.
*   **`core/kernel/loop_controller.py`** *(New/WIP)*:
    *   **Update:** Ensure its documentation or header reflects its current **HOLD** status, pending thermal cooling of the federation.

---

## 3. `geox` (Earth/Physics Organ)
*Location: `/root/geox`*

### Files to Update:
*   **`README.md`**:
    *   **Update:** Define its role as a "Specialist Agent" in the 9-Agent Federation.
    *   **Detail:** Clarify that its inputs are routed downstream from the `AAA-Agent` Federal Coordinator after constitutional classification.

---

## 4. `WEALTH` (Economic Organ)
*Location: `/root/WEALTH`*

### Files to Update:
*   **`README.md`**:
    *   **Update:** Define its role as a "Specialist Agent" in the 9-Agent Federation.
    *   **Detail:** Clarify that its inputs are routed downstream from the `AAA-Agent` Federal Coordinator.

---

## Git Alignment Plan
To synchronize the GitHub repositories, the following sequence will be executed for each repo:
1.  Apply the markdown documentation updates described above.
2.  Stage the changes (`git add .`).
3.  Commit with standard semantic message: `docs(architecture): map AAA federation to SOT (v2026.04.16)`
4.  Push to remote (`git push origin main` or equivalent).


