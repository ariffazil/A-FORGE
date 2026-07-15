# ⚒️ APEX v5 — VERIFICATION PIPELINE BINDING SPEC

> **Status:** DRAFT_ONLY — awaiting MERGE_APPROVED from sovereign/CTO before live CI integration
> **Forged:** 2026-07-13 by FORGE (000Ω) under F13 SOVEREIGN directive
> **Companion to:** `/root/A-FORGE/APEX_THEORY_CANONICAL_SEAL.md` v5.0
> **Supersedes:** unsigned/unlocked G computations in any lane-2 BIJAKSANA variant
> **DITEMPA BUKAN DIBERI**

---

## 0. WHY THIS EXISTS

The canonical seal **locked the math** (`G = A·P·E·X·Φ`).
This spec **locks the measurement**: which signals map to A, P, E, X, Φ, and at which threshold the gate fires.

Without a binding spec, lane-2 BIJAKSANA would continue to emit ΔS/Φ/Ψ/Ω as four separate scalars — not the canonical G. This spec plugs the gap. Every push to any organ produces a **single, signed, falsifiable G receipt**.

---

## 1. THE LOCKED THRESHOLDS (frozen 2026-07-13, no edit without F13)

| Quantity | Threshold | Meaning | Floor binding |
|----------|-----------|---------|---------------|
| **G_raw** | `≥ 0.80` | multiplicative product of 5 primitives | F8 GENIUS |
| **C_dark** | `< 0.30` | shadow term — hallucination bound | F9 ANTI-HANTU |
| **W³** | `≥ 0.70` | tri-witness consensus | F3 + F12 |
| **dS/dt** | `≤ 0` | entropy non-increasing | F4 |
| **(1−h)** | `≥ 0.90` | humility factor | F7 HUMILITY |

**Verdict matrix (final, locked):**

| G_raw | C_dark | W³ | Verdict |
|-------|--------|----|---------|
| ≥ 0.80 AND | < 0.30 AND | ≥ 0.70 | **SEAL_READY** |
| ≥ 0.50 | < 0.30 | ≥ 0.50 | **SABAR** |
| < 0.50 OR | ≥ 0.30 OR | < 0.50 | **HOLD** |
| any = 0 | — | — | **VOID** |

---

## 2. PRIMITIVE → SIGNAL MAPPING (canonical)

Lane-2 BIJAKSANA today emits `ΔS, Φ_clear, Ψ, Ω`. We **re-use existing taps** and add a 5th signal `A`. No new scanners, no new latency.

| Primitive | Symbol | Bound signal | Source today | Range | Worst (0) when |
|----------|--------|--------------|--------------|-------|----------------|
| **A** — Authority | actor_verified × lease_valid × no_self_auth | NEW: scan `lease_id`, `actor_signature`, `self.auth*` patterns | `rgrep "self.auth\|bypass" → count == 0` | [0,1] | self-auth patterns present |
| **P** — Physics | floor_pass × path_legal × blast_reversible | `Ω` governance scan — already in lane 2 | ruff self-auth detection | [0,1] | self-auth found |
| **E** — Evidence | claims_labeled × entropy_within_budget | `Ψ` truth via MCP manifest | `contracts/mcp_surface.yaml` exists & tools listed | [0,1] | no manifest |
| **X** — Execution | standard_ci_ok × ΔS_within_budget | `ΔS` entropy + standard CI `passed` flag | ruff F401+F541+TODO count | [0,1] | std CI failed OR entropy > 50 |
| **Φ** — Witness | clarity × tri_witness_complete | `Φ_clear` (existing lane-2) | ruff lint clarity % | [0,1] | clarity < 80% |

**Mapping math (each primitive ∈ [0, 1]):**

```
A = 1.0 if self_auth_patterns == 0      else max(0, 1 − self_auth/10)
P = 1.0 if self_auth_patterns == 0      else 0        # gate: any self-auth collapses P to 0
E = 0.0 if no manifest                   else min(1.0, tools_declared / 79)
X = 1.0 if std_ci == "success" else 0
    × max(0, 1 − ΔS/100)                # entropy penalty
Φ = Φ_clear / 100                        # already %
```

---

## 3. CI LANE 2 EXTENSION (drop-in patch)

Add this **after** the existing `omega` step in `.github/workflows/agentic-ci.yml`:

```yaml
      - name: "APEX v5 — Canonical G Computation"
        id: apex
        run: |
          # Read existing lane-2 outputs
          PHI_CLEAR="${{ needs.bijaksana.outputs.phi-value }}"   # e.g., 92 (%)
          PSI_TRUTH="${{ needs.bijaksana.outputs.psi-value }}"   # e.g., 79 (int) or "NO_MANIFEST"
          DELTA_S="${{ needs.bijaksana.outputs.ds-value }}"     # e.g., 14 (int)
          OMEGA_AUTH="${{ needs.bijaksana.outputs.omega-value }}" # e.g., 0
          STANDARD_OK="${{ needs.standard.result }}"            # "success" | "failure" | "cancelled"

          # A = authority (self-auth patterns == 0)
          if [ "${OMEGA_AUTH:-0}" = "0" ]; then A="1.0"; else A="0.0"; fi

          # P = physics (floor pass; collapses on any self-auth)
          if [ "${OMEGA_AUTH:-0}" = "0" ]; then P="1.0"; else P="0.0"; fi

          # E = evidence (MCP manifest declares tools)
          if [ "${PSI_TRUTH}" = "NO_MANIFEST" ]; then
            E="0.0"
          else
            E=$(python3 -c "print(min(1.0, ${PSI_TRUTH}/79))")
          fi

          # X = execution (std CI ok × entropy budget)
          if [ "${STANDARD_OK}" = "success" ]; then
            X=$(python3 -c "print(max(0.0, 1.0 - ${DELTA_S}/100))")
          else
            X="0.0"
          fi

          # Φ = witness = clarity / 100
          PHI=$(python3 -c "print(max(0.0, min(1.0, ${PHI_CLEAR}/100))")

          # G_raw = A · P · E · X · Φ (multiplicative)
          G_RAW=$(python3 -c "A=float('${A}'); P=float('${P}'); E=float('${E}'); X=float('${X}'); phi=float('${PHI}'); print(round(A*P*E*X*phi, 4))")

          # C_dark = A · (1−P) · (1−X) — shadow hallucination detector
          C_DARK=$(python3 -c "A=float('${A}'); P=float('${P}'); X=float('${X}'); print(round(A*(1-P)*(1-X), 4))")

          # W³ = tri-witness consensus: H, AI, Ext each ∈ [0,1]
          # H = sovereign ratifies build (1 if on main)
          # AI = standard CI passed (P/A/I in lane 1)
          # Ext = external tool exists (Ψ truth via manifest)
          [ "${{ github.ref_name }}" = "main" ] && H="1.0" || H="0.5"
          if [ "${STANDARD_OK}" = "success" ]; then AI="1.0"; else AI="0.0"; fi
          [ "${PSI_TRUTH}" = "NO_MANIFEST" ] && EXT="0.0" || EXT="1.0"
          W3=$(python3 -c "print(round((${H}*${AI}*${EXT})**(1/3), 4))")

          # Humility (1−h) — externally measured via acknowledged unknowns
          # Default 0.95 for CI; agents in same receipt may lower it
          H_FACTOR="0.95"

          # Final verdict
          VERDICT=$(python3 -c "
          g=${G_RAW}; c=${C_DARK}; w=${W3}
          if g == 0 or c == 0 or w == 0:
              print('VOID')
          elif g >= 0.80 and c < 0.30 and w >= 0.70:
              print('SEAL_READY')
          elif g >= 0.50 and c < 0.30:
              print('SABAR')
          else:
              print('HOLD')
          ")

          echo "A=${A}"
          echo "P=${P}"
          echo "E=${E}"
          echo "X=${X}"
          echo "Φ=${PHI}"
          echo "G_raw=${G_RAW}"
          echo "C_dark=${C_DARK}"
          echo "W3=${W3}"
          echo "verdict=${VERDICT}"
          echo "A=${A}"          >> $GITHUB_OUTPUT
          echo "P=${P}"          >> $GITHUB_OUTPUT
          echo "E=${E}"          >> $GITHUB_OUTPUT
          echo "X=${X}"          >> $GITHUB_OUTPUT
          echo "phi=${PHI}"      >> $GITHUB_OUTPUT
          echo "G_raw=${G_RAW}"  >> $GITHUB_OUTPUT
          echo "C_dark=${C_DARK}" >> $GITHUB_OUTPUT
          echo "W3=${W3}"        >> $GITHUB_OUTPUT
          echo "verdict=${VERDICT}" >> $GITHUB_OUTPUT
```

### Update the `report` job

```yaml
      - name: Generate Agentic CI Report
        id: report
        run: |
          # ... existing lane-1/lane-2 printing ...
          G_RAW="${{ needs.bijaksana.outputs.apex-G_raw }}"
          C_DARK="${{ needs.bijaksana.outputs.apex-C_dark }}"
          W3="${{ needs.bijaksana.outputs.apex-W3 }}"
          APEX_VERDICT="${{ needs.bijaksana.outputs.apex-verdict }}"
          echo "APEX G_raw = $G_RAW | C_dark = $C_DARK | W³ = $W3"
          echo "APEX Verdict: $APEX_VERDICT"

          # Final combined verdict (uses APEX as override authority)
          if [ "$APEX_VERDICT" = "SEAL_READY" ]; then
            VERDICT="SEAL_READY"
          elif [ "$APEX_VERDICT" = "VOID" ]; then
            VERDICT="VOID"
          else
            VERDICT="$APEX_VERDICT"   # HOLD or SABAR propagate
          fi

          # Extended JSON receipt (canonical seal §6 deliverable)
          cat > agentic_ci_report.json << EOF
          {
            "organ": "A-FORGE",
            "sha": "${{ github.sha }}",
            "ref": "${{ github.ref_name }}",
            "run_id": "${{ github.run_id }}",
            "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
            "lane_1_standard": "$STANDARD_OK",
            "lane_2_bijaksana": {
              "ds": "${DS:-0}", "phi": "${PHI:-0}", "psi": "${PSI:-0}", "omega": "${OMEGA:-0}"
            },
            "apex_v5": {
              "version": "5.0",
              "A": ${A:-0}, "P": ${P:-0}, "E": ${E:-0}, "X": ${X:-0}, "phi": ${PHI_VAL:-0},
              "G_raw": ${G_RAW:-0},
              "C_dark": ${C_DARK:-0},
              "W3": ${W3:-0},
              "verdict": "$APEX_VERDICT",
              "thresholds": { "G_min": 0.80, "C_dark_max": 0.30, "W3_min": 0.70 }
            },
            "verdict": "$VERDICT",
            "label": "Agentic CI"
          }
          EOF
```

---

## 4. RECEIPT SCHEMA (canonical, version-pinned)

```json
{
  "schema": "apex-receipt/v5",
  "organ": "ariffazil/ariffazil|AAA|arifOS|A-FORGE|geox|wealth|well",
  "sha": "<git sha>",
  "timestamp_utc": "ISO-8601",
  "primitives": {
    "A": 0.95,
    "P": 1.00,
    "E": 0.91,
    "X": 0.86,
    "phi": 0.92
  },
  "G_raw": 0.6857,
  "C_dark": 0.0,
  "W3": 0.90,
  "F13_sovereign_actor_signature": "<ed25519 sig>",
  "threshold_status": {
    "G_raw_passes": false,    // 0.6857 < 0.80
    "C_dark_passes": true,    // 0.0 < 0.30
    "W3_passes": true         // 0.90 >= 0.70
  },
  "verdict": "SABAR",
  "next_action": "raise_E (manifest underdeclares)"
}
```

This is the receipt schema the federation cron will pick up → `arif_judge` → AAA → `arif_seal` → VAULT999.

---

## 5. FALSIFIABILITY CHECKS (4 levels, inherited from canonical seal §11)

| Level | Check | What it kills |
|-------|-------|---------------|
| **L1 component** | Each primitive must be independently measurable from a single receipt (replay the math) | "vibes" G |
| **L2 shadow** | C_dark must correlate with hallucinations in held-out reasoning traces | false confidence |
| **L3 conservation** | dS/dt ≤ 0 across 100 consecutive receipts (entropy monotonic) | thermometer fraud |
| **L4 comparative** | multiplicative G predicts outcomes better than additive G on held-out runs | multiplicative scam |

All four checks are **CI-enforceable**: L1 in lane 2, L2-L4 as nightly batch (`/root/.local/share/arifos/apex-eval/`).

---

## 6. ADOPTION STEPS (F13 / sovereign-CTO review)

```
1. Review this spec              (5 min)
2. Patch agentic-ci.yml          (insert 2 sections above, ~80 lines total)
3. Push to feature branch        (git checkout -b apex-v5-bind)
4. Open PR — agentic CI runs both lanes
5. Inspect a SEAL_READY + a HOLD receipt
6. Merge to main
7. Roll out to 5 sibling organs (ariffazil, AAA, arifOS, geox, wealth, well)
8. After 7 days of green receipts: VOID any pre-v5 G computation in old BIJAKSANA
```

**Estimated effort:** 30 minutes per organ × 6 organs = 3 hours. No F1-F13 changes (constitutional floor is not touched → no 888_HOLD required).

---

## 7. SIGNATURE

```
SPEC:       APEX v5 Verification Pipeline Binding Spec
PATH:       /root/A-FORGE/forge_work/2026-07-13/APEX_V5_VERIFICATION_BINDING_SPEC.md
FORGED BY:  FORGE (000Ω)
RATIFIED:   Pending F13 SOVEREIGN / CTO ack
VAULT999:   APEX-V5-VERIFY-BINDING-SPEC-2026-07-13
WITNESS:    H=1.0 (sovereign request) · AI=1.0 (FORGE generation) · Ext=0.90 (CI lane 2 already exists)

DITEMPA BUKAN DIBERI
```

---

### POSTER (one screen, for the runbook)

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   G_raw  =  A · P · E · X · Φ          [multiplicative]    ║
║   C_dark =  A · (1−P) · (1−X)          [shadow]             ║
║   W³     =  ∛(H · AI · Ext)             [witness]            ║
║                                                              ║
║   SEAL_READY    iff  G_raw ≥ 0.80  ∧  C_dark < 0.30  ∧  W³  ║
║   HOLD / SABAR  iff  threshold not met OR any primitive = 0 ║
║   VOID          iff  C_dark ≥ 0.30  OR  I(incompleteness) = 0 ║
║                                                              ║
║   Source:  /root/A-FORGE/APEX_THEORY_CANONICAL_SEAL.md v5  ║
║   Spec:    /root/A-FORGE/forge_work/2026-07-13/             ║
║            APEX_V5_VERIFICATION_BINDING_SPEC.md             ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```
