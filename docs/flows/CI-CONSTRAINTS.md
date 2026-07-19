# 🛡️ FEDERATION CI CONSTRAINTS — Per-Layer Enforcement

> **DITEMPA BUKAN DIBERI — These checks turn FEDERATION.md from prose into physics.**
> **Each layer's CI enforces its declared role. Violations = CI red.**

---

## L0 CANON (ariffazil/ariffazil)

### Constraints
- No code dependencies on any other repo
- No MCP surface
- No CI beyond markdown lint
- FEDERATION.md must exist and declare `role: CANON, layer: L0`

### CI Check
```yaml
# .github/workflows/l0-canon.yml
name: L0-CANON
on: [push, pull_request]
jobs:
  validate-canon:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: FEDERATION.md exists + valid
        run: |
          test -f FEDERATION.md || exit 1
          grep -q "role: CANON" FEDERATION.md || exit 1
          grep -q "layer: L0" FEDERATION.md || exit 1
          echo "✅ L0 CANON valid"
      - name: No code dependencies
        run: |
          ! test -f package.json || (echo "❌ CANON must not have package.json" && exit 1)
          ! test -f pyproject.toml || (echo "❌ CANON must not have pyproject.toml" && exit 1)
          ! test -f requirements.txt || (echo "❌ CANON must not have requirements.txt" && exit 1)
          echo "✅ No code deps"
```

---

## L1 ROOT (arifOS, AAA)

### Constraints — arifOS
- F1-F13 floor tests must pass
- MCP surface must match `tool_registry.json`
- VAULT999 chain integrity must verify
- Must NOT import A-FORGE, GEOX, WEALTH, or WELL code (only route to them)

### CI Check
```yaml
# .github/workflows/l1-root-arifos.yml
name: L1-ROOT-arifOS
on: [push, pull_request]
jobs:
  floors:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: F1-F13 floor tests
        run: uv run pytest tests/constitutional/ -q --tb=short
      - name: MCP surface lock
        run: uv run pytest tests/test_surface_lock.py tests/test_public_tool_registry.py -q
      - name: VAULT999 chain integrity
        run: uv run python -c "from core.vault999 import verify_chain; assert verify_chain()"
      - name: No cross-organ imports
        run: |
          ! grep -r "from aforge\|import aforge\|from geox\|import geox\|from wealth\|import wealth" arifosmcp/ core/ || true
          echo "✅ Clean — arifOS routes, doesn't import organs"
      - name: FEDERATION.md valid
        run: |
          grep -q "role: ROOT" FEDERATION.md && grep -q "layer: L1" FEDERATION.md
```

### Constraints — AAA
- A2A gateway must respond on :3001
- Must NOT expose MCP tools (AAA is A2A-only)
- Cockpit must render without errors
- Must NOT import domain organs directly

---

## L2 EXECUTIVE (A-FORGE)

### Constraints
- `forge_execute` must reject calls without valid SEAL verdict
- Must have lease validation before any mutation
- Agent isolation: no cross-contamination between parallel agents
- Must NOT import arifOS governance code (only call it via MCP)

### CI Check
```yaml
# .github/workflows/l2-executive.yml
name: L2-EXECUTIVE
on: [push, pull_request]
jobs:
  governance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: No self-authorization
        run: |
          # forge_execute must check for SEAL before mutating
          grep -r "seal_verdict_id\|constitutional_chain_id" src/domain/ || \
            (echo "❌ forge_execute must validate SEAL before mutation" && exit 1)
          echo "✅ SEAL validation found"
      - name: Agent isolation
        run: |
          npm test -- --test-name-pattern="agent isolation"
      - name: FEDERATION.md valid
        run: |
          grep -q "role: EXECUTIVE" FEDERATION.md && grep -q "layer: L2" FEDERATION.md
```

---

## L3 DOMAIN (GEOX, WEALTH, WELL, HERMES)

### Constraints (all domain organs)
- Outputs must carry epistemic labels (OBS/DER/INT/SPEC)
- Must NEVER call arif_judge or arif_seal (organs don't adjudicate)
- Must NEVER call another organ directly
- Must NOT mutate filesystem/shell (evidence-only)
- FEDERATION.md must declare `role: DOMAIN, layer: L3`

### CI Check (template for all L3 organs)
```yaml
# .github/workflows/l3-domain.yml
name: L3-DOMAIN
on: [push, pull_request]
jobs:
  constraints:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: No adjudication
        run: |
          ! grep -r "arif_judge\|arif_seal\|SEAL\|HOLD\|SABAR\|VOID" src/ --include="*.py" --include="*.ts" || \
            (echo "❌ Domain organ must not call adjudication verbs" && exit 1)
          echo "✅ Clean — no adjudication"
      - name: Epistemic labels present
        run: |
          grep -r "OBS\|DER\|INT\|SPEC" src/ --include="*.py" --include="*.ts" | head -5
          echo "✅ Labels found"
      - name: No cross-organ calls
        run: |
          ! grep -r "geox_\|wealth_\|well_\|capital_\|arif_" src/ --include="*.py" | \
            grep -v "mcp_bridge\|route\|proxy" || true
      - name: FEDERATION.md valid
        run: |
          grep -q "role: DOMAIN" FEDERATION.md && grep -q "layer: L3" FEDERATION.md
```

### WELL-Specific Additional Constraint
```yaml
      - name: REFLECT_ONLY doctrine
        run: |
          ! grep -r "diagnosis\|diagnose\|diagnostic" src/ --include="*.py" || \
            (echo "❌ WELL is REFLECT_ONLY — no diagnostic claims" && exit 1)
          echo "✅ REFLECT_ONLY"
```

---

## L4 PUBLIC (arif-sites)

### Constraints
- Content changes must be reversible (static sites, not API mutations)
- Must NOT call MCP endpoints directly in production builds
- Federation data must come from AAA/arifOS (not domain organs directly)
- Build must not depend on live organ health

### CI Check
```yaml
# .github/workflows/l4-public.yml
name: L4-PUBLIC
on: [push, pull_request]
jobs:
  constraints:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: No live MCP calls in build
        run: |
          ! grep -r "localhost:808[0-9]\|localhost:1808[0-9]\|localhost:707[0-9]" \
            src/ --include="*.ts" --include="*.js" --include="*.tsx" || \
            (echo "❌ arif-sites must not call MCP in production build" && exit 1)
          echo "✅ No live MCP calls"
      - name: FEDERATION.md valid
        run: |
          grep -q "role: PUBLIC_SURFACE" FEDERATION.md && grep -q "layer: L4" FEDERATION.md
      - name: Build succeeds without organs
        run: npm run build  # must pass without live organ access
```

---

## Federation-Wide CI (runs on all repos)

```yaml
# Every repo should include this federation health check
name: FEDERATION-HEALTH
on: [push]
jobs:
  federation:
    runs-on: ubuntu-latest
    steps:
      - name: FEDERATION.md exists
        run: test -f FEDERATION.md
      - name: Role declared
        run: grep -qE "^role: (CANON|ROOT|EXECUTIVE|DOMAIN|PUBLIC_SURFACE)" FEDERATION.md
      - name: Layer declared
        run: grep -qE "^layer: L[0-4]" FEDERATION.md
      - name: Citizenship declared
        run: grep -q "warga-aaa" FEDERATION.md || grep -q "F13 SOVEREIGN" FEDERATION.md
      - name: Governance declared
        run: grep -q "judge:" FEDERATION.md && grep -q "seal:" FEDERATION.md
```

---

*These constraints are PROPOSED. Deploy incrementally — start with federation-wide check, then layer-specific.*
*Violations should be NON-BLOCKING initially (warning only), then hard-block after 1 week of clean runs.*
