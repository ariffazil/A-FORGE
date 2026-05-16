# Personal Sovereign Loop

The human-facing layer of arifOS.

## Philosophy

> The human thinks in intentions, not implementations.

This module transforms kernel-facing MCP tools into companion-facing human commands.

## Human Command Layer

Instead of flags and paths, the human simply says:

| Human Says | System Does |
|------------|-------------|
| "remember that..." | Stores in appropriate memory tier |
| "recall..." | Retrieves relevant memories |
| "track..." | Monitors over time |
| "compare A vs B" | Shows tradeoffs |
| "draft..." | Prepares without executing |
| "decide-with-me..." | Presents options, waits |
| "hold..." | Blocks until approval |
| "execute-with-approval..." | Runs if approved |

## Memory Tiers

| Tier | Purpose | Decay? |
|------|---------|--------|
| **Ephemeral** | Current convo, temp context | Yes |
| **Working** | Active projects, current focus | Yes |
| **Canon** | Stable truths about Arif | No |
| **Sacred** | Constitution, identity, non-negotiables | No |
| **Quarantine** | Uncertain, unverified claims | Until verified |

## Dashboard: The 6-Pane View

```
📬 Inbox       — What changed
🧠 Memory      — What is now known  
🎯 Focus        — What matters today
✋ Hold         — What needs your yes
👁️ Watch        — What I'm monitoring
🔨 Forge        — What is ready to execute
```

## Daily Life Loop

### Morning Context
- Overnight changes
- Top priorities
- Decisions pending
- Things to watch
- Memory updates

### Evening Closure
- Completed today
- Carried forward
- New commitments
- Tomorrow preview
- Memory to consolidate

### Project Loop
- Goal
- Open questions
- Artifacts
- Next actions
- Risks

### Life Memory Loop
- Stable facts
- Evolving preferences
- Commitments
- Lessons learned

## Usage

```bash
# Show dashboard
agent me

# Say something in natural language
agent me "remember that I prefer dark mode"
agent me "what do you know about the project?"
agent me "track the price of flights to Tokyo"
agent me "good morning"
agent me "good evening"
```

## Action Badges

Every action shows its status:

- 🔍 **Observe** — System noticed something
- 💡 **Advise** — System has a suggestion
- 📋 **Ready** — Draft prepared, waiting
- ✋ **Needs your yes** — Explicit approval required
- ✅ **Executed** — Done, with record

## Constitutional Alignment

- **F13 Sovereign** — Human intention is primary
- **F1 Amanah** — Faithful stewardship of human time
- **F2 Truth** — Explicit uncertainty, no false confidence
- **F9 Anti-Hantu** — No deception in human-facing layer

## Files

- `SovereignLoop.ts` — Core engine with memory tiers and dashboard
- `DailyLoop.ts` — Morning/evening rituals and project rhythms
- `HumanCLI.ts` — Natural language command parser
- `index.ts` — Module exports

---

*Ditempa, Bukan Diberi.*
