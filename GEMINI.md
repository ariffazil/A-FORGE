# arifOS workspace context

## Naming alignment (canonical arifos.* tools)
- arifos.init = session bootstrap / identity
- arifos.route = meta routing
- arifos.judge = constitutional verdict
- arifos.vault = seal / verify
- arifos.mind = reasoning
- arifos.heart = simulation / ethical critique
- arifos.memory = governed execution
- arifos.sense = grounding / evidence
- arifos.ops = operational metrics / cost estimation
- arifos.forge = build / test / code execution

## Local skill registry
- planner: goal → steps decomposition (Bounded, No Exec)
- executor: bounded tool execution (Policy-gated)
- verifier: validation of outputs/diffs (Promotion gate)
- forge-operator: execution discipline
- floor-checker: F1-F13 validation
- swarm-conductor: meta router
- trinity-forger: Δ→Ω→Ψ→✓ handoffs
- metabolic-loop: 000→111→333→666→777→888→999
- web-architect: web/system design
- vps-operator: infra/container ops

## Context Doctrine (Refined)
1. **Context Law:** Context is a bounded workspace for active inference, not intelligence.
2. **Optimization Law:** Maximize relevance density, not just token reduction.
3. **Attention Law:** Only attended information has causal influence (Attention is currency).
4. **Retrieval Law:** Intelligence is the ability to select/assemble from external memory.
5. **Compression Law:** All summaries must be traceable to source (Loss awareness).
6. **Entropy Law:** Uncontrolled context leads to reasoning collapse.
7. **Workspace Law:** Use a small, sharp active workspace (Sovereign Sparsity).
8. **Iteration Law:** Decompose complexity into loops, not monolithic prompts.
9. **Verification Law:** Reasoning without grounding is structured hallucination.
10. **Humility Law:** Humility is the Gödel lock against overconfidence.

## Four Pillars
- **Attention:** Spend it with the least waste.
- **Optimization:** Discipline over brute force.
- **Humility:** Calibrated boundedness (anti-Bad Genius).
- **Human Judgment:** The final authority on consequential branches.

---

## Project Overview (AF-FORGE ΔΩΨ)
**AF-FORGE** is a constitutional, event-sourced agent runtime designed as a governed machine. It employs a **Planner/Executor/Verifier** triad architecture.

### Core Architecture & Technologies
- **Language/Runtime:** TypeScript (NodeNext), Node.js (v22+), Bun.
- **Components:** Planner, Executor, Verifier, Policy Engine, Event Store, Memory Gateway.

## Project Commands (Namespaced)
- /af:planner (if applicable, but mainly skills)
- /af:vps: Infrastructure operations
- /af:forge: Bounded execution discipline
- /af:trinity: Role orchestration
- /af:metabolic: Stage governance
- /af:floorcheck: F1-F13 validation
- /af:swarm: Meta routing

---

## Building and Running
- **Install:** `npm install`
- **Build:** `npm run build`
- **Test:** `npm test`
- **CLI:** `node dist/src/cli.js <command> [options]`
