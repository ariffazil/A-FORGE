# A-FORGE — Infrastructure & Deployment Shell

> **Status:** OPERATIONAL | **Organ:** FORGE (A) | **Authority:** arifOS

## 🏛️ What this repo is
The centralized deployment and infrastructure orchestration shell for the entire federation.

## 📦 Ownership
- **Owns**: Docker Compose manifests, Caddy routing configuration, Prometheus/Grafana monitoring stacks.
- **Does NOT own**: Application logic (AAA), Kernel logic (arifOS).

## 🏗️ Current Structure
- deploy/: Centralized Docker Compose and Caddy manifests.
- infra/: System-level configurations (monitoring/systemd).
- docs/: Infrastructure map and topology specs.

## 🚀 Verified Commands
- `docker-compose -f deploy/docker-compose.yml up`: Launch the federation substrate.

## 🔗 Federation Loop
- [arifOS](https://github.com/ariffazil/arifOS) (Kernel)
- [AAA](https://github.com/ariffazil/AAA) (Body)

---
*Last Verified: 2026.05.16 | 999 SEAL ALIVE*
