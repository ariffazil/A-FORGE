# FEDERATION.md — A-FORGE

```yaml
role: EXECUTIVE
organ: aforge
layer: L2
citizenship: warga-aaa
canon: ariffazil/ariffazil
agentic_surface: true

depends_on:
  - repo: ariffazil/arifOS
    reason: SEAL verdicts, leases, constitutional governance gates
  - repo: ariffazil/AAA
    reason: A2A state, cockpit triggers, agent registry
  - repo: ariffazil/geox
    reason: Geoscience tools (via MCP bridge)
  - repo: ariffazil/wealth
    reason: Capital tools (via MCP bridge)
  - repo: ariffazil/well
    reason: Vitality tools (via MCP bridge)

mcp:
  port: 7072 (MCP) + 7071 (Express)
  endpoint: https://mcp.arif-fazil.com/mcp
  tools_count: 80+
  tool_prefix: forge_

governance:
  judge: arifOS
  seal: VAULT999
  floors: F1-F13
  mutation_rule: Execute ONLY after valid SEAL + lease from arifOS. NEVER self-authorize.

stack_role: |
  A-FORGE is the executive shell — L2 EXECUTIVE.
  It is the ONLY organ authorized to mutate state (files, builds, deploys).
  But it can only mutate after receiving a valid SEAL verdict + lease from arifOS.
  It orchestrates agents that call domain organs (GEOX/WEALTH/WELL) via MCP.
  It is the "hands" of the federation — powerful, but never self-governing.

entrypoints:
  - MCP: https://mcp.arif-fazil.com/mcp
  - Health: http://localhost:7071/health
  - Code: https://github.com/ariffazil/A-FORGE
```

---

**DITEMPA BUKAN DIBERI — Forged, Not Given.**
**Part of the arifOS Federation. See `/root/AAA/docs/FEDERATION_MAP.md` for canonical topology.**
