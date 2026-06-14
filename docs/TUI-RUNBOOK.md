# A-FORGE TUI Runbook

## Quick Start
```bash
cd /root/A-FORGE
npm run tui
```

## Prerequisites
- A-FORGE server running (`systemctl status a-forge`)
- Terminal with 256-color support (set `TERM=xterm-256color`)

## Controls
| Key | Action |
|-----|--------|
| `q` | Quit |
| `p` | Pause/resume auto-refresh (3s interval) |
| `Tab` | Cycle focus between panels |
| `f` | Cycle filter: ALL → RUNNING → FAILED → PENDING |
| `r` | Manual refresh |
| `c` | Clear log |
| `↑/↓` | Scroll focused panel |
| `Ctrl+C` | Force quit |

## Architecture
- **Model**: MVU (Model-Update-View) in `src/infrastructure/tui/model.ts`
- **View**: blessed + blessed-contrib in `src/infrastructure/tui/forge-tui.ts`
- **Data**: Polls `localhost:7071/jobs`, `/api/federation-probe`, `/jobs/metrics`
- **Validation**: Zod schemas at adapter boundary (F9 ANTI-HANTU)

## Files
- `src/infrastructure/tui/forge-tui.ts` — Main TUI dashboard
- `src/infrastructure/tui/model.ts` — State, messages, update function, Zod schemas
- `src/infrastructure/tui/theme.ts` — Federation colors
- `src/infrastructure/tui/adapters/status-adapter.ts` — HTTP polling adapters
- `src/interfaces/routes/jobsRoutes.ts` — Backend job endpoints
- `src/application/jobs/AgentManagerSingleton.ts` — Shared AgentManager

## Constitutional
- Read-only by default (MONITOR mode)
- Governance state carries `source` + `staleness` provenance
- F13/MONITOR guard rejects mutation messages
- Phase 3 (OPERATOR mode) requires separate ratification
