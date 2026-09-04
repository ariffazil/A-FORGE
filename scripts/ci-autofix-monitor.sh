#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Autonomous CI Monitor + Autofix for arifOS Federation
# DITEMPA BUKAN DIBERI
# ═══════════════════════════════════════════════════════════════════════════
#
# Runs on VPS af-forge (scheduled via cron or systemd timer).
# Monitors CI status across all 6 organs. When RED detected:
#   1. Classifies failure pattern
#   2. Auto-fixes common failures
#   3. Creates PR with fix
#   4. Notifies via Hermes/Telegram
#
# Usage:
#   ./ci-autofix-monitor.sh              # check all organs
#   ./ci-autofix-monitor.sh arifos       # check one organ
#   ./ci-autofix-monitor.sh --fix arifos # auto-fix RED CI
#
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Locate A-FORGE root from this script: scripts/ci-autofix-monitor.sh → ..
A_FORGE_ROOT="$(cd "$(dirname "$0")" && cd .. && pwd)"
# Resolve organ paths via paths_resolver (single source of truth).
PATH_R() { python3 -c "import sys; sys.path.insert(0, '$A_FORGE_ROOT/paradox-engine'); from paths_resolver import org_path; print(org_path('$1'))"; }

# ── Config ────────────────────────────────────────────────────────────────
VAULT_ENV="/root/.secrets/vault.env"
WORKDIR="/root"
LOG_DIR="$(PATH_R forge_work)/ci-autofix"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
DATE=$(date -u +%Y-%m-%d)
LOG_FILE="$LOG_DIR/ci-autofix-$DATE.log"

# Source secrets
set -a && source "$VAULT_ENV" && set +a

mkdir -p "$LOG_DIR"

log() { echo "[$TIMESTAMP] $*" | tee -a "$LOG_FILE"; }

# ── Organ registry ────────────────────────────────────────────────────────
declare -A ORG_REPO ORG_ROLE ORG_LAYER ORG_MCP ORG_DIR ORG_BRANCH

ORG_REPO[arifos]="ariffazil/arifos"
ORG_REPO[aforge]="ariffazil/A-FORGE"
ORG_REPO[aaa]="ariffazil/AAA"
ORG_REPO[geox]="ariffazil/geox"
ORG_REPO[wealth]="ariffazil/wealth"
ORG_REPO[well]="ariffazil/well"

ORG_ROLE[arifos]="ROOT"
ORG_ROLE[aforge]="EXECUTIVE"
ORG_ROLE[aaa]="COCKPIT"
ORG_ROLE[geox]="EARTH"
ORG_ROLE[wealth]="CAPITAL"
ORG_ROLE[well]="VITALITY"

ORG_LAYER[arifos]="L1"
ORG_LAYER[aforge]="L2"
ORG_LAYER[aaa]="L3"
ORG_LAYER[geox]="L4"
ORG_LAYER[wealth]="L5"
ORG_LAYER[well]="L6"

ORG_MCP[arifos]="arif_* — https://arifos.arif-fazil.com/mcp"
ORG_MCP[aforge]="forge_* — https://mcp.arif-fazil.com/mcp"
ORG_MCP[aaa]="A2A — https://aaa.arif-fazil.com"
ORG_MCP[geox]="geox_* — https://geox.arif-fazil.com/mcp"
ORG_MCP[wealth]="capital_* — https://wealth.arif-fazil.com/mcp"
ORG_MCP[well]="well_* — https://well.arif-fazil.com/mcp"

ORG_DIR[arifos]="/root/arifOS"
ORG_DIR[aforge]="/root/A-FORGE"
ORG_DIR[aaa]="/root/AAA"
ORG_DIR[geox]="/root/GEOX"
ORG_DIR[wealth]="/root/WEALTH"
ORG_DIR[well]="/root/WELL"

# ── Check CI status ──────────────────────────────────────────────────────
check_ci_status() {
    local organ="$1"
    local repo="${ORG_REPO[$organ]}"

    log "🔍 Checking CI status for $organ ($repo)..."

    # Get latest workflow runs
    local runs_json
    runs_json=$(gh api "repos/$repo/actions/runs?per_page=5&status=completed" \
        --jq '.workflow_runs[] | select(.conclusion=="failure") | {id: .id, name: .name, conclusion: .conclusion, html_url: .html_url, head_branch: .head_branch, created_at: .created_at}' 2>/dev/null || echo "[]")

    if [ "$runs_json" = "[]" ] || [ -z "$runs_json" ]; then
        log "   ✅ $organ — all recent CI green"
        return 0
    fi

    local failure_count
    failure_count=$(echo "$runs_json" | jq -s 'length')
    log "   🔴 $organ — $failure_count recent CI failures"

    # Return the latest failure run ID
    echo "$runs_json" | jq -s '.[0]'
    return 1
}

# ── Classify failure pattern ─────────────────────────────────────────────
classify_failure() {
    local organ="$1"
    local run_id="$2"
    local repo="${ORG_REPO[$organ]}"

    log "🔬 Classifying failure for $organ run #$run_id..."

    local patterns=""

    # Fetch failed job logs
    local jobs_json
    jobs_json=$(gh api "repos/$repo/actions/runs/$run_id/jobs" --jq '.jobs[] | select(.conclusion=="failure") | {id: .id, name: .name}' 2>/dev/null || echo "[]")

    for job_id in $(echo "$jobs_json" | jq -r '.id'); do
        local log_text
        log_text=$(gh api "repos/$repo/actions/jobs/$job_id/logs" 2>/dev/null || echo "")

        if echo "$log_text" | grep -q "Missing FEDERATION.md\|Missing role:\|Missing layer:"; then
            patterns="$patterns FEDERATION_MISSING"
        fi
        if echo "$log_text" | grep -q "Kernel ABI drift\|generated-surface drift"; then
            patterns="$patterns ABI_DRIFT"
        fi
        if echo "$log_text" | grep -q "would be reformatted\|ruff format\|prettier"; then
            patterns="$patterns FORMAT_LINT"
        fi
        if echo "$log_text" | grep -q "Surface drift\|surface_lock"; then
            patterns="$patterns SURFACE_DRIFT"
        fi
        if echo "$log_text" | grep -q "GITLEAKS\|secret\|credential"; then
            patterns="$patterns SECRET_LEAK"
        fi
        if echo "$log_text" | grep -q "npm ERR!\|error TS\|Build failed"; then
            patterns="$patterns BUILD_FAILURE"
        fi
        if echo "$log_text" | grep -q "FAIL\|AssertionError\|Error:"; then
            patterns="$patterns TEST_FAILURE"
        fi
    done

    # Deduplicate
    patterns=$(echo "$patterns" | tr ' ' '\n' | sort -u | tr '\n' ' ' | xargs)
    echo "$patterns"
}

# ── Auto-fix: FEDERATION.md ──────────────────────────────────────────────
autofix_federation() {
    local organ="$1"
    local dir="${ORG_DIR[$organ]}"
    local role="${ORG_ROLE[$organ]}"
    local layer="${ORG_LAYER[$organ]}"
    local mcp="${ORG_MCP[$organ]}"

    log "🔧 Auto-fixing FEDERATION.md for $organ..."

    cd "$dir"

    # Create branch
    local branch="ci-autofix/federation-$(date -u +%Y%m%d-%H%M%S)"
    git checkout -b "$branch" 2>/dev/null || git checkout main

    # Generate FEDERATION.md
    cat > FEDERATION.md << FEDEOF
# Federation Contract v2 — $organ

> SOT: $DATE | seal_seq: fed-phase-7-zen
> Authority: F13 SOVEREIGN — Muhammad Arif bin Fazil
> Canonical location: /root/FEDERATION_CONTRACT.md
> role: $role
> layer: $layer
> mcp: $mcp

---

## 1. Federation Identity

The **arifOS Federation** is a governed intelligence system comprising 7 core organs, 31 GitHub repositories, and a single sovereign (Arif, F13). It operates on a single VPS (72.62.71.199) with Cloudflare Tunnel + Caddy ingress.

**Governing principle:** No organ may seal without arifOS. No organ may self-authorize mutation.

---

## 2. Organs — Authority Boundaries

| Organ | Role | Port | MCP Prefix | Permissions |
|-------|------|------|-----------|-------------|
| **arifOS** | Constitutional kernel | 8088 | \`arif_*\` | Judges, seals, routes. NEVER executes. |
| **A-FORGE** | Execution shell | 7071/7072 | \`forge_*\` | Executes after SEAL. NEVER adjudicates. |
| **AAA** | Cockpit + A2A | 3001 | — | Routes, displays. NEVER adjudicates. |
| **GEOX** | Earth intelligence | 8081 | \`geox_*\` | Computes earth evidence. NEVER decides. |
| **WEALTH** | Capital intelligence | 18082 | \`capital_*\` | Computes capital math. NEVER allocates. |
| **WELL** | Vitality guard | 18083 | \`well_*\` | Reflects readiness. NEVER diagnoses. |
| **HERMES** | Multi-modal bridge | Telegram | — | Routes signals. NEVER adjudicates. |

---

## 3. Authority Chain
No link may be skipped. No organ may self-authorize.

## 4. CI/CD Standards
- Every organ runs gitleaks secret scanning
- Every organ uses date-stamp tags (\`vYYYY.MM.DD\`)
- Conventional commits with organ prefix

---

*DITEMPA BUKAN DIBERI — Auto-generated by CI Autofix ($DATE)*
FEDEOF

    git add FEDERATION.md
    git commit -m "[REPAIR] autofix: generate FEDERATION.md for $organ — CI autofix

    - role: $role
    - layer: $layer
    - mcp: $mcp

    Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"

    git push origin "$branch" 2>&1

    # Create PR
    gh pr create \
        --base main \
        --head "$branch" \
        --title "🤖 [AUTOFIX] FEDERATION.md — $organ CI heal" \
        --body "## 🤖 Autonomous CI Fix

**Detected:** Missing or malformed FEDERATION.md
**Organ:** $organ ($role, $layer)
**MCP:** $mcp

Auto-generated FEDERATION.md with correct markers.

**SOT:** $DATE | Auto-generated by CI Autofix

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>" \
        --label "ci-autofix,automated" 2>&1

    log "   ✅ FEDERATION.md fix PR created for $organ"
}

# ── Auto-fix: ABI drift (arifOS) ─────────────────────────────────────────
autofix_abi_drift() {
    local organ="$1"
    local dir="${ORG_DIR[$organ]}"

    log "🔧 Auto-fixing ABI drift for $organ..."

    cd "$dir"

    local branch="ci-autofix/abi-drift-$(date -u +%Y%m%d-%H%M%S)"
    git checkout -b "$branch" 2>/dev/null || git checkout main

    # Run ABI sync
    uv run python scripts/sync_kernel_abi.py 2>&1

    git add arifosmcp/abi/generated/ static/.well-known/mcp/ mcp-arifos.json smithery.yaml 2>/dev/null || true
    git commit -m "[REPAIR] autofix: regenerate ABI surface files — CI autofix

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"

    git push origin "$branch" 2>&1

    gh pr create \
        --base main \
        --head "$branch" \
        --title "🤖 [AUTOFIX] Kernel ABI drift — surface sync" \
        --body "## 🤖 Autonomous CI Fix

**Detected:** Kernel ABI generated-surface drift
**Organ:** $organ

Ran \`scripts/sync_kernel_abi.py\` to regenerate all surface files.

**SOT:** $DATE | Auto-generated by CI Autofix" \
        --label "ci-autofix,automated" 2>&1

    log "   ✅ ABI drift fix PR created for $organ"
}

# ── Auto-fix: Format/Lint ────────────────────────────────────────────────
autofix_format() {
    local organ="$1"
    local dir="${ORG_DIR[$organ]}"

    log "🔧 Auto-fixing format/lint for $organ..."

    cd "$dir"

    local branch="ci-autofix/format-$(date -u +%Y%m%d-%H%M%S)"
    git checkout -b "$branch" 2>/dev/null || git checkout main

    if [ -f "pyproject.toml" ]; then
        uv run ruff format . 2>&1 || ruff format . 2>&1
        uv run ruff check --fix . 2>&1 || ruff check --fix . 2>&1
    elif [ -f "package.json" ]; then
        npx prettier --write "src/**/*.{ts,tsx,js,jsx}" "test/**/*.{ts,tsx,js,jsx}" 2>/dev/null || true
        npx eslint --fix "src/**/*.{ts,tsx}" 2>/dev/null || true
    fi

    if ! git diff --quiet; then
        git add -A
        git commit -m "[REPAIR] autofix: format/lint — CI autofix

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
        git push origin "$branch" 2>&1

        gh pr create \
            --base main \
            --head "$branch" \
            --title "🤖 [AUTOFIX] Format/Lint — $organ auto-format" \
            --body "## 🤖 Autonomous CI Fix

**Detected:** Format/lint violations
**Organ:** $organ

Auto-formatted code to comply with lint rules.

**SOT:** $DATE | Auto-generated by CI Autofix" \
            --label "ci-autofix,automated" 2>&1

        log "   ✅ Format fix PR created for $organ"
    else
        log "   ℹ️  No format changes needed for $organ"
    fi
}

# ── Diagnostic issue for non-auto-fixable failures ───────────────────────
create_diagnostic_issue() {
    local organ="$1"
    local run_id="$2"
    local patterns="$3"
    local repo="${ORG_REPO[$organ]}"

    log "📋 Creating diagnostic issue for $organ..."

    local title="🤖 [CI AUTOFIX] Diagnostic: $patterns — run #$run_id"
    local body="## 🤖 Autonomous CI Diagnostic

**Failure patterns:** $patterns
**Organ:** $organ
**CI run:** https://github.com/$repo/actions/runs/$run_id

These failures could not be auto-fixed. Manual investigation needed.

**SOT:** $DATE | Auto-generated by CI Autofix"

    gh issue create \
        --repo "$repo" \
        --title "$title" \
        --body "$body" \
        --label "ci-autofix,automated,bug" 2>&1

    log "   ✅ Diagnostic issue created for $organ"
}

# ── Federation health report ─────────────────────────────────────────────
federation_health_report() {
    log ""
    log "══════════════════════════════════════════════════════"
    log "FEDERATION CI HEALTH REPORT — $DATE"
    log "══════════════════════════════════════════════════════"

    local total=0
    local red=0
    local green=0
    local auto_fixed=0

    for organ in arifos aforge aaa geox wealth well; do
        total=$((total + 1))
        local result
        if result=$(check_ci_status "$organ" 2>&1); then
            green=$((green + 1))
        else
            red=$((red + 1))
            local run_id
            run_id=$(echo "$result" | jq -r '.id // empty' 2>/dev/null || echo "")
            if [ -n "$run_id" ]; then
                local patterns
                patterns=$(classify_failure "$organ" "$run_id")
                log "   🔴 $organ — patterns: $patterns"
            fi
        fi
    done

    log ""
    log "Summary: $green/$total green, $red/$total red, $auto_fixed auto-fixed"
    log "══════════════════════════════════════════════════════"
}

# ── Main ─────────────────────────────────────────────────────────────────
main() {
    local mode="${1:-check}"
    local target="${2:-all}"

    log "🚀 CI Autofix Monitor starting — mode=$mode target=$target"

    case "$mode" in
        check)
            if [ "$target" = "all" ]; then
                federation_health_report
            else
                check_ci_status "$target"
            fi
            ;;

        fix)
            if [ "$target" = "all" ]; then
                for organ in arifos aforge aaa geox wealth well; do
                    local result
                    if ! result=$(check_ci_status "$organ" 2>&1); then
                        local run_id
                        run_id=$(echo "$result" | jq -r '.id // empty' 2>/dev/null || echo "")
                        if [ -n "$run_id" ]; then
                            local patterns
                            patterns=$(classify_failure "$organ" "$run_id")

                            for pattern in $patterns; do
                                case "$pattern" in
                                    FEDERATION_MISSING) autofix_federation "$organ" ;;
                                    ABI_DRIFT)          autofix_abi_drift "$organ" ;;
                                    FORMAT_LINT)        autofix_format "$organ" ;;
                                    SURFACE_DRIFT)      autofix_abi_drift "$organ" ;;
                                    TEST_FAILURE|BUILD_FAILURE|SECRET_LEAK)
                                        create_diagnostic_issue "$organ" "$run_id" "$pattern"
                                        ;;
                                esac
                            done
                        fi
                    fi
                done
            else
                local result
                if ! result=$(check_ci_status "$target" 2>&1); then
                    local run_id
                    run_id=$(echo "$result" | jq -r '.id // empty' 2>/dev/null || echo "")
                    if [ -n "$run_id" ]; then
                        local patterns
                        patterns=$(classify_failure "$target" "$run_id")
                        for pattern in $patterns; do
                            case "$pattern" in
                                FEDERATION_MISSING) autofix_federation "$target" ;;
                                ABI_DRIFT)          autofix_abi_drift "$target" ;;
                                FORMAT_LINT)        autofix_format "$target" ;;
                                SURFACE_DRIFT)      autofix_abi_drift "$target" ;;
                                *)
                                    create_diagnostic_issue "$target" "$run_id" "$pattern"
                                    ;;
                            esac
                        done
                    fi
                fi
            fi
            ;;

        *)
            echo "Usage: $0 {check|fix} [organ|all]"
            exit 1
            ;;
    esac

    log "✅ CI Autofix Monitor complete"
}

main "$@"
