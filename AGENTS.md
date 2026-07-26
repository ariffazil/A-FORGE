<!-- CANONICAL: /root/AGENTS.md -->
<!-- Status: DERIVED — organ-specific extension. Authoritative doctrine: /root/AGENTS.md -->

# AGENTS.md — A-FORGE | arifOS Federation

> **A-FORGE is the hands. The hands never adjudicate.**
> `arif_judge` says GO → `forge_lease` → execute → `arif_seal` closes. No link skipped.
> **ZEN:** `/root/AAA/prompts/AAA-ZEN-ALIGNMENT.md` — 18 operational rules. Load at boot.

## Identity

Execution shell. Builds, deploys, runs code under constitutional lease. Ports: 7071 (Express API), 7072 (MCP gateway). stdio: `npm run mcp:stdio`.

## Build & Test

```bash
npm install
npm run build    # tsc
npm test         # Node --test
make test        # security-audit + build + all suites
systemctl restart a-forge      # deploy API
systemctl restart a-forge-mcp  # deploy MCP
curl :7071/health
```

## Boundary

Lease-gated execution. arif_judge → forge_lease → execute → arif_seal. No link skipped.
