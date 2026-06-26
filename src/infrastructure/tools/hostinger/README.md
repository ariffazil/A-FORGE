# Hostinger MCP Gate

> **Status:** Built and tested, but **not wired** to the A-FORGE MCP surface.
> **Blocker:** `HOSTINGER_API_TOKEN` is missing.

## Activation checklist

1. Obtain a Hostinger API token from the Hostinger panel.
2. Save it to `/root/.secrets/tokens/hostinger_api_token` with `chmod 600`.
3. Verify the binary exists: `/root/.npm-global/bin/hostinger-vps-mcp --stdio`.
4. Wire the stdio gate into A-FORGE's MCP server registry if you want agents to call it.
5. Rebuild and restart `a-forge-mcp.service`.

## Safety

- Only `VPS_get*` OBSERVE tools are whitelisted for autonomous use.
- Mutations require an EXECUTE lane + lease + judge deliberation.
- ANTI-HANTU tools (recreate, delete snapshot, resize, purchase, set panel password) are permanently blocked.

## Why optional

The federation runs fine without Hostinger automation. This gate is a future convenience, not a critical path for AGI_TOOL declaration.
