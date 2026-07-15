# P1 Task 2: Tool Fingerprinting on forge_registry Startup

**Date:** 2026-07-07
**Status:** FORGED ✅
**Files changed:** 3 + 1 new

---

## What Was Built

### 1. Domain service: `tool-fingerprint.ts` (NEW)

`/root/A-FORGE/src/domain/governance/tool-fingerprint.ts`

- `computeToolFingerprint(toolName, inputSchema)` — SHA-256 of `name + "::" + normalizedSchema`
- `checkToolFingerprints(tools[])` — scans all tools for collisions
- Schema normalization: handles ZodObject, ZodRawShape, and raw JSON Schema
- Stable sort: JSON.stringify with sorted keys for reproducible hashes

### 2. Registry upgrade: `forge_registry_status` + `forge_fingerprint_check`

Two tools added to A-FORGE surface:

| Tool | Purpose |
|------|---------|
| `forge_registry_status` | Now includes fingerprint section (total, unique, duplicates, pass/fail) |
| `forge_fingerprint_check` | Standalone fingerprint audit tool |

### 3. Startup hook: `startupFingerprintCheck(server)`

Runs after all tool registrations + elicitation gate. Logs to stderr:
- Total tools, unique fingerprints, collision count
- If duplicates found: lists each collision
- Non-blocking: diagnostic only, never stops startup

### 4. Pre-existing test fixes

`test/mcp-conformance.test.ts` — 2 type errors from SDK upgrade fixed (content type, reason.includes)

## Architecture

```
Server startup:
  registerAllTools() → installPolicyInterceptor() → installElicitationGate()
  → startupFingerprintCheck(server)
     ├── iterates _registeredTools
     ├── computes sha256(name + "::" + normalizedSchema) per tool
     ├── detects collisions (same fingerprint = duplicate)
     └── logs result to stderr

Runtime:
  forge_fingerprint_check → re-runs fingerprint scan → returns JSON report
  forge_registry_status → includes fingerprint section
```

---

**DITEMPA BUKAN DIBERI 🔥⚒️**
