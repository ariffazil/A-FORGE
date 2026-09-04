# Deployment — A-FORGE (Execution Engine)

## Prerequisites

- Docker 24+ and Docker Compose v2
- 4 CPU cores, 8GB RAM
- GitHub CLI (`gh`) for CI/CD integration
- Ports: `7071` (primary), `7072` (secondary)

## Quick Start

```bash
git clone https://github.com/arif-fazil/A-FORGE.git
cd A-FORGE
docker compose up -d

# Verify
curl http://localhost:7071/health
```

## Docker Compose

```yaml
services:
  aforge:
    image: arifazil/aforge:latest
    ports:
      - "7071:7071"
      - "7072:7072"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - forge-receipts:/var/lib/aforge/receipts
    environment:
      - AFORGE_KERNEL_URL=http://arifos-kernel:8088
    restart: unless-stopped

volumes:
  forge-receipts:
```

## Capabilities

- 200+ tools across 50+ sub-skills
- GitHub Actions CI/CD pipeline management
- Docker orchestration
- MCP server building and testing
- Code analysis and review
- Infrastructure management

## Federation Role

A-FORGE executes actions approved by the arifOS kernel. It cannot self-certify —
all execution results are returned to the kernel for verification and sealing.
