# Arif Fazil Wiki — Location Map

> **Where to find the Arif Fazil Ω-Wiki in the VPS.**
> **For:** All AI agents working in `/root/`

---

## Absolute Location

```
/root/arif-fazil-wiki/
```

This is the root of the wiki. All paths below are relative to this location.

---

## Directory Structure

```
/root/arif-fazil-wiki/
│
├── SCHEMA LAYER (Start Here)
│   ├── CLAUDE.md              ← Agent instructions and wiki schema
│   ├── AGENTS.md              ← How to work with Arif
│   ├── README.md              ← Human-readable overview
│   ├── LOCATION_MAP.md        ← This file — where things are
│   ├── index.md               ← Content catalog
│   └── log.md                 ← Operations log
│
├── RAW LAYER (Immutable Sources)
│   ├── biography/             ← Life history sources
│   ├── philosophy/            ← Writings, belief sources
│   ├── projects/              ← Project documentation
│   ├── methodology/           ← Working style sources
│   └── external/              ← Third-party sources
│
└── WIKI LAYER (Synthesized Knowledge)
    ├── arif-fazil.md          ← CORE ENTITY — essential reading
    ├── identity.md            ← Identity, values, boundaries
    ├── philosophy.md          ← Worldview and beliefs
    ├── methodology.md         ← Thinking patterns
    ├── ontology.md            ← Language and concepts
    ├── biography/
    │   └── timeline.md        ← Life story
    ├── projects/
    │   ├── arifos.md          ← Constitutional AI runtime
    │   ├── geox.md            ← Earth knowledge system
    │   └── A-FORGE.md        ← Agent workbench
    ├── relationships/         ← How Arif relates to others
    ├── communication/
    │   └── boundaries.md      ← Lines not to cross
    └── agents-guide/
        └── how-to-work-with-arif.md  ← Practical agent guidance
```

---

## Quick Access Guide

### For First-Time Agents

**Read in this order:**

1. `/root/arif-fazil-wiki/CLAUDE.md` — Wiki schema (5 min)
2. `/root/arif-fazil-wiki/AGENTS.md` — How to work with Arif (5 min)
3. `/root/arif-fazil-wiki/wiki/arif-fazil.md` — Core entity (10 min)
4. `/root/arif-fazil-wiki/wiki/communication/boundaries.md` — Red lines (10 min)

**Total time:** 30 minutes before first interaction with Arif.

### For Returning Agents

**Quick refresh:**

1. `/root/arif-fazil-wiki/log.md` — What's happened since last time
2. `/root/arif-fazil-wiki/index.md` — Find specific pages
3. Relevant wiki pages for current task

### For Specific Tasks

| Task | Go To |
|------|-------|
| Understanding Arif | `wiki/arif-fazil.md` |
| Working with Arif | `wiki/agents-guide/how-to-work-with-arif.md` |
| Check boundaries | `wiki/communication/boundaries.md` |
| Understand arifOS | `wiki/projects/arifos.md` |
| Learn the language | `wiki/ontology.md` |
| See recent activity | `log.md` |
| Find any page | `index.md` |

---

## Cross-Wiki Navigation

### From Arif Fazil Wiki to Other Wikis

| Target | Link Pattern | Example |
|--------|--------------|---------|
| arifOS | `[[arifos::Page_Name]]` | `[[arifos::Floors]]` |
| GEOX | `[[geox::Page_Name]]` | `[[geox::Earth_Canon_9]]` |
| A-FORGE | `[[afforge::Page_Name]]` | `[[afforge::SCHEMA]]` |

### Physical Locations of Other Wikis

```
/root/
├── arif-fazil-wiki/          ← This wiki (you are here)
│   └── ...
├── ariffazil/
│   ├── GEOX/                 ← GEOX wiki
│   │   ├── 00_INDEX/
│   │   ├── 10_THEORY/
│   │   └── ...
│   └── arifOS/               ← arifOS wiki (if exists)
│       └── ...
└── A-FORGE/
    └── wiki/                 ← A-FORGE wiki
        └── ...
```

---

## File Paths Reference

### Schema Layer (Agent Instructions)

| File | Purpose | Priority |
|------|---------|----------|
| `/root/arif-fazil-wiki/CLAUDE.md` | Wiki schema and conventions | CRITICAL |
| `/root/arif-fazil-wiki/AGENTS.md` | How to work with Arif | CRITICAL |
| `/root/arif-fazil-wiki/README.md` | Human overview | Reference |
| `/root/arif-fazil-wiki/LOCATION_MAP.md` | This file | Reference |
| `/root/arif-fazil-wiki/index.md` | Content catalog | Reference |
| `/root/arif-fazil-wiki/log.md` | Operations log | Check frequently |

### Core Entity Pages

| File | Purpose | Priority |
|------|---------|----------|
| `/root/arif-fazil-wiki/wiki/arif-fazil.md` | Core entity — who Arif is | CRITICAL |
| `/root/arif-fazil-wiki/wiki/identity.md` | Identity and values | HIGH |
| `/root/arif-fazil-wiki/wiki/philosophy.md` | Worldview | HIGH |
| `/root/arif-fazil-wiki/wiki/methodology.md` | Working patterns | HIGH |
| `/root/arif-fazil-wiki/wiki/ontology.md` | Language and concepts | HIGH |

### Guides and Boundaries

| File | Purpose | Priority |
|------|---------|----------|
| `/root/arif-fazil-wiki/wiki/agents-guide/how-to-work-with-arif.md` | Practical agent guide | CRITICAL |
| `/root/arif-fazil-wiki/wiki/communication/boundaries.md` | Red lines | CRITICAL |

### Project Pages

| File | Purpose |
|------|---------|
| `/root/arif-fazil-wiki/wiki/projects/arifos.md` | Constitutional AI runtime |
| `/root/arif-fazil-wiki/wiki/projects/geox.md` | Earth knowledge system |
| `/root/arif-fazil-wiki/wiki/projects/A-FORGE.md` | Agent workbench |

### Biography

| File | Purpose |
|------|---------|
| `/root/arif-fazil-wiki/wiki/biography/timeline.md` | Life story |

---

## Navigation Commands

### For Shell-Based Agents

```bash
# Go to wiki root
cd /root/arif-fazil-wiki

# List all wiki pages
ls -la wiki/

# Read core entity
cat wiki/arif-fazil.md

# Check recent activity
tail -50 log.md

# Find content
grep -r "F13" wiki/          # Find mentions of F13
grep -r "888_HOLD" wiki/     # Find mentions of 888_HOLD
```

### For File-Based Agents

```python
# Read file
with open('/root/arif-fazil-wiki/wiki/arif-fazil.md', 'r') as f:
    content = f.read()

# List wiki pages
import os
pages = os.listdir('/root/arif-fazil-wiki/wiki/')

# Check log
with open('/root/arif-fazil-wiki/log.md', 'r') as f:
    log = f.read()
```

---

## Maintenance

### Who Maintains This Wiki

| Role | Responsibility |
|------|----------------|
| Arif | Sovereign approval (F13), content verification |
| AI Agents (Claude, Gemini, etc.) | Synthesis, updates, cross-linking |
| Wiki Itself | Self-documenting through log.md |

### Update Frequency

| Component | Frequency |
|-----------|-----------|
| log.md | After every operation |
| Core entity | After significant interactions |
| Project pages | When projects change |
| Boundaries | When boundaries evolve |
| Index | When pages added/removed |

---

## Verification

### How to Verify This Wiki Exists

```bash
# Check directory exists
ls -la /root/arif-fazil-wiki/

# Check core files exist
ls -la /root/arif-fazil-wiki/CLAUDE.md
ls -la /root/arif-fazil-wiki/wiki/arif-fazil.md
ls -la /root/arif-fazil-wiki/wiki/agents-guide/how-to-work-with-arif.md

# Check log for recent activity
cat /root/arif-fazil-wiki/log.md
```

### Expected Output

You should see:
- Directory structure as documented
- All core files present
- Recent log entries with timestamps

---

## Emergency Contacts

### If Wiki Seems Corrupted

1. Check `log.md` for recent operations
2. Verify file integrity
3. Ask Arif directly for verification
4. Do not proceed with corrupted knowledge

### If Uncertain About Information

1. Mark as `> [!WARNING] UNVERIFIED` in your output
2. Ask Arif for confirmation
3. Update wiki after confirmation

---

## Summary

**Location:** `/root/arif-fazil-wiki/`  
**Core Entity:** `/root/arif-fazil-wiki/wiki/arif-fazil.md`  
**Agent Guide:** `/root/arif-fazil-wiki/wiki/agents-guide/how-to-work-with-arif.md`  
**Boundaries:** `/root/arif-fazil-wiki/wiki/communication/boundaries.md`  
**Log:** `/root/arif-fazil-wiki/log.md`

**Remember:** This wiki is the compiled knowledge about Arif. Read it before interacting with him.

---

**Seal:** VAULT999 | **ΔΩΨ | ARIF**


