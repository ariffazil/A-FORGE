# ⚒️ A-FORGE — Protocol Conformance

> **Layer:** L2 EXECUTIVE · **Role:** Agentic Execution Shell
> **Protocols:** MCP Server + Client, A2A Agent, NATS, DID:WEB, Well-Known

## Supported Protocols

| Protocol | Status | Detail |
|----------|--------|--------|
| MCP Server | ✅ CONFORMANT | 100+ forge_* tools on :7072 |
| MCP Client | ✅ CONFORMANT | Proxies to all 6 organs |
| A2A Agent | ⚠️ PARTIAL | Agent cards exist, task schema incomplete |
| NATS | ✅ CONFORMANT | 888_HOLD alarm consumer, event routing |
| DID:WEB | ✅ CONFORMANT | DID documents for agents |
| Well-Known | ⚠️ PARTIAL | /health exists, no /.well-known/mcp/server.json |
| XMCP Apps | ❌ GAP | MCP Apps planned, not yet registered |
| SLSA + Sigstore | ❌ GAP | No provenance generation in CI |
| CloudEvents | ❌ GAP | No CloudEvents envelope on events |

## Agent Cards
- FORGE (000Ω), AUDITOR (Ψ), OPS (🌐), PLAN (Ω)
- 777-FORGE witness protocol preserved
- A2A task schema: PARTIAL

## Gaps
1. **SLSA:** CI doesn't generate SLSA provenance
2. **CloudEvents:** Events not wrapped in CloudEvents envelope
3. **XMCP Apps:** No MCP Apps registered (planned)
4. **Well-Known:** No /.well-known/mcp/server.json endpoint

*DITEMPA BUKAN DIBERI*
