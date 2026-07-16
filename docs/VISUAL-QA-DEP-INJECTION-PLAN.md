<!-- SOT-MANIFEST
project: arifOS Federation — A-FORGE
tool: forge_visual_qa
spec: dependency injection plan
owner: Muhammad Arif bin Fazil (F13 SOVEREIGN)
created: 2026-07-16
status: READY_FOR_IMPLEMENTATION
core_axiom: Stubs are validated. Now wire the physics.
-->

# forge_visual_qa — Dependency Injection Plan

**Status:** Contract validated (65/65 tests). Stubs wired in MCP. Now: real implementations.

---

## The Four Dependencies

The tool uses dependency injection. Four functions must be implemented:

```
forgeVisualQA(input, {
  visionAnalyze,   ← W₁: pixel-level evidence
  domLinter,       ← W₂: deterministic structural linting
  scarQuery,       ← temporal memory (past failures)
  generateFix,     ← scar-informed code mutation
  request888Hold,  ← sovereign gate (already wired → arifOS)
  sealToVault,     ← VAULT999 seal (already wired → arifOS)
  notifyWell,      ← operator fatigue signal (already wired → WELL)
})
```

Three are already wired (888, vault, well). Four need real implementations.

---

## Dependency 1: `visionAnalyze` — W₁ Vision Witness

**Contract:**
```typescript
async function visionAnalyze(
  screenshotPath: string,
  constraints: Constraints,
): Promise<{ deviations: Deviation[]; confidence: number }>
```

**What it does:**
- Takes a screenshot file path + constraints
- Returns pixel-level deviations with OBS epistemic labels
- Confidence capped at 0.90 (F7 HUMILITY)

**Implementation options (ranked by fidelity):**

| Option | Fidelity | Latency | Cost | Notes |
|--------|----------|---------|------|-------|
| **Playwright + pixelmatch** | High | ~2s | Free | Deterministic pixel diff against baseline |
| **MiniMax vision API** | High | ~3s | ~$0.01 | VLM-based, needs prompt engineering |
| **Claude vision** | Very high | ~4s | ~$0.03 | Best spatial reasoning |
| **GPT-4V** | High | ~3s | ~$0.02 | Good but less deterministic |

**Recommended:** Playwright + pixelmatch for deterministic baselines, MiniMax for semantic deviations.

**Implementation sketch:**
```typescript
async function visionAnalyze(screenshotPath, constraints) {
  // 1. Load screenshot as PNG buffer
  const screenshot = await readFile(screenshotPath);

  // 2. If baseline exists, compute pixel diff
  const baselinePath = screenshotPath.replace('.png', '.baseline.png');
  if (existsSync(baselinePath)) {
    const baseline = await readFile(baselinePath);
    const { diff, mismatches } = pixelmatch(screenshot, baseline, { threshold: 0.1 });
    if (mismatches > 0) {
      return {
        deviations: [{
          type: "PIXEL_DIFF",
          severity: mismatches > 1000 ? "HIGH" : mismatches > 100 ? "MEDIUM" : "LOW",
          description: `${mismatches} pixels differ from baseline`,
          epistemic_label: "OBS",
        }],
        confidence: 0.85,
      };
    }
    return { deviations: [], confidence: 0.90 };
  }

  // 3. No baseline → use VLM for semantic analysis
  const vlmResult = await callVisionAPI(screenshot, constraints);
  return vlmResult;
}
```

---

## Dependency 2: `domLinter` — W₂ Structural Witness

**Contract:**
```typescript
async function domLinter(
  domPayload: string,
  requiredElements: string[],
): Promise<{ deviations: Deviation[]; confidence: number }>
```

**What it does:**
- Takes raw HTML + required element list
- Returns structural/a11y deviations with OBS epistemic labels
- 100% deterministic — no model involvement
- Confidence always 0.90 (deterministic = known)

**Implementation:**
```typescript
async function domLinter(domPayload, requiredElements) {
  const deviations = [];
  const doc = parse5.parse(domPayload);  // deterministic HTML parser

  // 1. Required elements check
  for (const elem of requiredElements) {
    if (!findElement(doc, elem)) {
      deviations.push({
        type: "MISSING_REQUIRED_ELEMENT",
        severity: "HIGH",
        description: `Required element <${elem}> not found in DOM`,
        element: elem,
        epistemic_label: "OBS",
      });
    }
  }

  // 2. Accessibility checks (deterministic)
  const a11yViolations = checkAccessibility(doc);
  deviations.push(...a11yViolations);

  // 3. Structural constraints
  if (constraints.max_nav_links) {
    const navLinks = countNavLinks(doc);
    if (navLinks > constraints.max_nav_links) {
      deviations.push({
        type: "NAV_LINK_COUNT_EXCEEDED",
        severity: "MEDIUM",
        description: `Navigation has ${navLinks} links, max is ${constraints.max_nav_links}`,
        element: "nav",
        expected: String(constraints.max_nav_links),
        actual: String(navLinks),
        epistemic_label: "OBS",
      });
    }
  }

  // 4. Contrast ratio (deterministic via computed styles)
  if (constraints.min_contrast_ratio) {
    const lowContrast = findLowContrastElements(doc, constraints.min_contrast_ratio);
    deviations.push(...lowContrast);
  }

  return { deviations, confidence: 0.90 };
}
```

**Dependencies:** `parse5` (HTML parser, already in Node), no external APIs.

---

## Dependency 3: `scarQuery` — Temporal Memory

**Contract:**
```typescript
async function scarQuery(deviationType: string): Promise<Scar | null>
```

**What it does:**
- Looks up past failures for a deviation type
- Returns the scar with historical fix + outcome
- Read-only — no mutation

**Implementation:**
```typescript
async function scarQuery(deviationType) {
  // Query A-FORGE's existing scar system
  try {
    const scars = await callMCP("arifos.arif_memory", {
      mode: "recall",
      query: `scar deviation_type:${deviationType}`,
      tier: "L4",  // Federation tier for cross-session scars
    });
    if (scars && Array.isArray(scars) && scars.length > 0) {
      return scars[0] as Scar;
    }
  } catch { /* no scars found */ }
  return null;
}
```

**Alternative:** Query the domain `consultScars` from `domain/forge/skill/index.ts` directly.

---

## Dependency 4: `generateFix` — Scar-Informed Mutation

**Contract:**
```typescript
async function generateFix(
  domPayload: string,
  deviations: Deviation[],
  scars: ScarConsultationResult[],
): Promise<string>
```

**What it does:**
- Takes current DOM + deviations + historical scars
- Returns mutated DOM with fixes applied
- Uses scars to avoid repeating past failures

**Implementation:**
```typescript
async function generateFix(domPayload, deviations, scars) {
  let fixed = domPayload;

  for (const dev of deviations) {
    const scar = scars.find(s => s.deviation_type === dev.type);

    if (scar?.action === "APPLY_HISTORICAL" && scar.scar) {
      // Reuse proven fix
      fixed = applyHistoricalFix(fixed, scar.scar.historical_fix);
    } else if (scar?.action === "SCAR_CONFLICT") {
      // Previous fix failed — generate new with explicit deviation
      fixed = await generateNovelFix(fixed, dev, scar.scar?.historical_fix);
    } else {
      // No scar — generate fresh fix
      fixed = await generateFreshFix(fixed, dev);
    }
  }

  return fixed;
}
```

---

## Wiring Order (governance-first)

| Step | What | Why first |
|------|------|-----------|
| **1** | `domLinter` | Deterministic, no API, no model, immediate value |
| **2** | `scarQuery` | Wire to existing A-FORGE scar system (already has consultScars) |
| **3** | `visionAnalyze` (pixelmatch mode) | Deterministic pixel diff, no API cost |
| **4** | `visionAnalyze` (VLM mode) | Semantic analysis for when no baseline exists |
| **5** | `generateFix` | Requires LLM — highest blast radius, build last |

---

## Testing Strategy

Each dependency is tested independently, then integrated:

```
Unit tests (per dependency):
  domLinter → parse5-based, deterministic, no mocks needed
  scarQuery → mock arifMemory, test recall path
  visionAnalyze (pixelmatch) → test with known pixel diffs
  visionAnalyze (VLM) → mock API, test deviation extraction
  generateFix → mock LLM, test scar-informed routing

Integration tests (full pipeline):
  domLinter + visionAnalyze → W¹/W² divergence test (already passing)
  scarQuery + generateFix → scar-informed fix test
  Full pipeline → reality test suite (already passing with stubs)
```

---

## Operator Dashboard (AAA Cockpit)

After dependencies are wired, the dashboard shows:

```
┌─────────────────────────────────────────────────────┐
│  forge_visual_qa — Live Status                      │
├─────────────────────────────────────────────────────┤
│  W₁ Vision:    [CONFIRMED]  hash:a3f2...  score:0.87│
│  W₂ Linter:    [CONFIRMED]  hash:7b1c...  score:0.90│
│  W₃ Sovereign: [PENDING]    awaiting human ack      │
│  Composite:    SHA256(a3f2‖7b1c‖0000‖PASS_CANDIDATE)│
│  Entropy:      ΔS=+3 (improving)  iter=2/5          │
│  Verdict:      PASS_CANDIDATE → 888_HOLD             │
│  Scars:        2 consulted, 1 applied                │
│  Seal:         BLOCKED (routing guard: W³ not acked) │
└─────────────────────────────────────────────────────┘
```

This lives in AAA cockpit (port 3001) as a React component.

---

## Summary

| Component | Status | Next |
|-----------|--------|------|
| State machine | ✅ Done | — |
| Tri-witness W³ | ✅ Done | — |
| Entropy gate | ✅ Done | — |
| Scar consultation | ✅ Done | — |
| Composite seal | ✅ Done | — |
| Routing guard | ✅ Done | — |
| MCP wiring | ✅ Done (core.ts) | — |
| domLinter | ❌ Stub | **Build next** |
| scarQuery | ❌ Stub | Wire to arifMemory |
| visionAnalyze | ❌ Stub | pixelmatch first, VLM second |
| generateFix | ❌ Stub | LLM-based, build last |
| Dashboard | ❌ Not started | After deps wired |
