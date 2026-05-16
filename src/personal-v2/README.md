# Personal OS v2 — Wave 1: Trust Foundation

## Overview

Implements the **4 P0 priorities** for arifOS as a Personal Human AI OS:

- **P0.1**: Stabilize continuity across restarts
- **P0.2**: Make discovery surface truthful (A2A card, MCP manifest)
- **P0.4**: Ship real memory contract (5 tiers with correction)
- **P0.5**: Make approval boundaries first-class (preview objects, hold queue)

Plus **P0.3** (Human Command Layer) which was started in `src/personal/` and is now the primary interface.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     HUMAN INTERFACE                         │
│   6 Verbs: remember | recall | track | think | hold | execute│
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                  PersonalOS (v2)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Continuity │  │    Memory   │  │     Approval        │  │
│  │    Store    │  │   Contract  │  │    Boundary         │  │
│  │             │  │             │  │                     │  │
│  │ • Persistent│  │ • 5 Tiers   │  │ • Preview Objects   │  │
│  │ • Resume    │  │ • Correct   │  │ • Hold Queue        │  │
│  │ • State     │  │ • Pin/Forget│  │ • Risk Assessment   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                  DISCOVERY SURFACE                          │
│   • A2A Agent Card (/.well-known/agent-card.json)          │
│   • MCP Manifest (/.well-known/mcp)                         │
│   • Honest /health endpoint                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## P0.1: Continuity Store (`src/continuity/`)

**Problem**: `/health` reports `governed_continuity: degraded` with ephemeral process-local signing.

**Solution**:
- Persistent JSON store at `~/.arifos/continuity.json`
- Auto-checkpoint every 30 seconds
- Recovery on restart: `stable` → `recovering` → `rebound`
- Human-visible states: `stable`, `recovering`, `degraded`, `lost`, `rebound`

**API**:
```typescript
const store = new ContinuityStore();
const status = await store.initialize("ARIF", "ARIF");
// status.state: "stable" | "recovering" | "degraded" | "lost" | "rebound"

store.addWatch("price of Bitcoin");
store.updateFocus({ todayPriority: "ship v2" });
await store.checkpoint(); // Manual checkpoint
await store.shutdown();   // Graceful shutdown
```

---

## P0.2: Discovery Surface (`src/discovery/`)

**Problem**: MCP discovery 404s, llms.txt 502s, A2A card at wrong path.

**Solution**:
- `/.well-known/agent-card.json` — A2A-compliant Agent Card
- `/.well-known/mcp` — MCP Manifest with instructions
- Honest `/health` that reports actual status

**A2A Skills Declared**:
- `memory.remember` — Store in personal memory
- `memory.recall` — Retrieve context
- `watch.monitor` — Monitor conditions
- `decision.support` — Compare options
- `action.hold` — Block for approval
- `action.execute` — Run with approval
- `context.morning` — Daily orientation
- `context.evening` — Day closure

---

## P0.4: Memory Contract (`src/memory-contract/`)

**Problem**: Memory is "vector store exists" not human memory discipline.

**Solution**: 5 Memory Tiers with explicit actions.

| Tier | Decay? | Editable? | Use Case |
|------|--------|-----------|----------|
| **Ephemeral** | Yes | Yes | Current convo, temp context |
| **Working** | Yes | Yes | Active projects |
| **Canon** | No | Yes | Stable truths about you |
| **Sacred** | No | No | Constitution, identity |
| **Quarantine** | No | Yes (verify) | Uncertain claims |

**Actions**:
- `store()` — Store with auto-tier inference
- `correct()` — Edit with version history
- `pin()` — Prevent decay
- `forget()` — Remove
- `downgrade()` — Move to quarantine
- `verify()` — Promote from quarantine

**MCP Resources**: Every memory exposed as `memory://{id}`

---

## P0.5: Approval Boundary (`src/approval/`)

**Problem**: Approval is internal parameter, not human UX.

**Solution**: First-class approval with preview objects.

**Action Badges**:
- 🔍 **Observe** — System noticed
- 💡 **Advise** — System suggests
- 📋 **Ready** — Prepared, low risk
- ✋ **Needs Yes** — Explicit approval required
- ✅ **Executed** — Done
- ❌ **Rejected** — Declined

**Preview Object**:
```typescript
interface ActionPreview {
  whatWillHappen: string;      // Plain language
  sideEffects: string[];       // What will change
  modifications: {...};        // Files/data affected
  commands: {...};             // Commands to run
  rollbackPlan?: string;       // How to undo
  estimatedDuration?: string;  // Time estimate
  riskAssessment: {
    level: "minimal" | "low" | "medium" | "high" | "critical";
    concerns: string[];
    mitigations: string[];
  };
}
```

**Hold Queue**: Single queue for all pending approvals, sorted by risk.

---

## Human Interface (6 Verbs)

| Verb | Intent | Badge |
|------|--------|-------|
| `remember` | Store something | ✅ Executed |
| `recall` | Retrieve context | 🔍 Observe |
| `track` | Monitor over time | ✅ Executed |
| `think` | Compare/reason | 💡 Advise |
| `hold` | Block for approval | ✋ Needs Yes |
| `execute` | Run approved | ✅ Executed |

---

## Usage

```typescript
import { PersonalOS } from "./personal-v2/PersonalOS.js";

const os = new PersonalOS();
await os.initialize();

// Remember something
const response = await os.process({
  command: "remember",
  what: "I prefer dark mode in all apps",
});
// → ✅ Executed: "Remembered... (canon)"

// Recall
await os.process({ command: "recall", what: "my preferences" });

// Hold for approval
const hold = await os.process({
  command: "hold",
  what: "deploy to production",
});
// → ✋ Needs Yes

// Approve and execute
os.approve(hold.holdId!);
await os.process({ command: "execute", what: "deploy" });

// Get dashboard
const dashboard = os.getDashboard();
// { continuity, memory, approvals }
```

---

## Files

| Module | Path | Purpose |
|--------|------|---------|
| Continuity | `src/continuity/` | P0.1 - Persistent sessions |
| Discovery | `src/discovery/` | P0.2 - A2A/MCP/Health |
| Memory | `src/memory-contract/` | P0.4 - 5-tier memory |
| Approval | `src/approval/` | P0.5 - Hold queue, previews |
| Personal OS | `src/personal-v2/` | Integration + 6 verbs |

---

## Status

- ✅ Build: Passing
- ✅ Tests: 7/7 passing
- ✅ TypeScript: Strict mode, no errors
- 🔄 Integration: Needs CLI wiring

---

*Ditempa, Bukan Diberi.*
