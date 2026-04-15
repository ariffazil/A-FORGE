# arifOS workspace context

## Canonical tool names and operational meaning
- `arifos.init` = session bootstrap / identity binding
- `arifos.route` = task routing
- `arifos.judge` = policy verdict
- `arifos.vault` = immutable audit record / verification
- `arifos.mind` = reasoning
- `arifos.heart` = safety and impact review
- `arifos.memory` = governed memory retrieval
- `arifos.sense` = evidence acquisition / grounding
- `arifos.ops` = operational metrics / cost estimation
- `arifos.forge` = build / test / code execution

## Local skill registry
- planner: goal → steps decomposition (Bounded, No Exec)
- executor: bounded tool execution (Policy-gated)
- verifier: validation of outputs/diffs (Promotion gate)
- forge-operator: execution discipline
- floor-checker: F1-F13 validation
- swarm-conductor: meta router
- trinity-forger: multi-stage handoff orchestration
- metabolic-loop: stage progression across `000→111→333→666→777→888→999`
- web-architect: web/system design
- vps-operator: infra/container ops

## Shared MCP launchers
- `.github/mcp/start-arifos-stdio.sh`
- `.github/mcp/start-geox-stdio.sh`
- `.github/mcp/start-playwright.sh`
- Shared server names: `arifos-local`, `geox-local`, `playwright`
- Keep `.mcp.json`, `.claude/mcp.json`, `.cursor/mcp.json`, `.opencode.json`, and `.gemini/settings.json` aligned

## Context Doctrine (Refined)
1. **Context Law:** Context is a bounded workspace for active inference, not intelligence.
2. **Optimization Law:** Maximize relevance density, not just token reduction.
3. **Attention Law:** Only attended information has causal influence (Attention is currency).
4. **Retrieval Law:** Intelligence is the ability to select/assemble from external memory.
5. **Compression Law:** All summaries must be traceable to source (Loss awareness).
6. **Entropy Law:** Uncontrolled context leads to reasoning collapse.
7. **Workspace Law:** Use a small, sharp active workspace.
8. **Iteration Law:** Decompose complexity into loops, not monolithic prompts.
9. **Verification Law:** Reasoning without grounding is structured hallucination.
10. **Humility Law:** Humility is the uncertainty guard against overconfidence.

## Four Pillars
- **Attention:** Spend it with the least waste.
- **Optimization:** Discipline over brute force.
- **Humility:** Calibrated boundedness that avoids uncontrolled overconfidence.
- **Human Judgment:** The final authority on consequential branches.

---

## Project Overview (AF-FORGE)
**AF-FORGE** is a policy-governed, event-sourced agent runtime. It employs a **Planner/Executor/Verifier** architecture.

### Core Architecture & Technologies
- **Language/Runtime:** TypeScript (NodeNext), Node.js (v22+), Bun.
- **Components:** Planner, Executor, Verifier, Policy Engine, Event Store, Memory Gateway.

## Project Commands (Namespaced)
- /af:planner (if applicable, but mainly skills)
- /af:vps: Infrastructure operations
- /af:forge: bounded execution discipline
- /af:trinity: multi-role orchestration
- /af:metabolic: stage-governance workflow
- /af:floorcheck: F1-F13 validation
- /af:swarm: meta routing

---

## Building and Running
- **Install:** `npm install`
- **Build:** `npm run build`
- **Test:** `npm test`
- **CLI:** `node dist/src/cli.js <command> [options]`
