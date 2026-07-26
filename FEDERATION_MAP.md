# FEDERATION_MAP.md — A-FORGE

```yaml
layer: L1
role: GOVERNANCE
function: Execution
status: ACTIVE
canon: arif-fazil.com/forge/

identity:
  repository: ariffazil/A-FORGE
  organ: A-FORGE Execution Shell
  floor_range: F1 (AMANAH — reversible-first)

function: |
  A-FORGE is the execution shell of the arifOS Federation.
  It owns: build, deploy, orchestration, shell execution, filesystem mutation,
  and the forge gate (4-layer: AmanahLock → ModelCapability → GovernanceBridge → ApprovalBoundary).

  A-FORGE executes. It does NOT self-authorize.
  Every mutation requires a SEAL verdict from arifOS (L0).

upstream:
  - ariffazil/arifos       # L0 — constitutional kernel (SEAL authority)

peers:
  - ariffazil/AAA          # L1 — control plane
  - ariffazil/APEX         # L1 — judgment engine
  - ariffazil/arifFlow     # L1 — coordination

downstream:
  - ariffazil/geox         # L2 — earth evidence
  - ariffazil/wealth       # L2 — capital evidence
  - ariffazil/well         # L2 — human readiness
  - ariffazil/HERMES       # L2 — multi-modal bridge

federation_surface: https://arif-fazil.com/forge/
```

**DITEMPA BUKAN DIBERI — Forged, Not Given.**
