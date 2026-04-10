# Phase 2 SRE Test Matrix (F13 Sovereignty)

> Staging checklist for GOV-001, GOV-002, GOV-003 verification  
> Run this in staging before production deployment

---

## Pre-Flight Setup

```bash
# Environment
export STAGING_URL="https://arifos-staging.example.com"
export VAULT_ADDR="https://vault-staging.example.com"
export SIEM_API="https://siem-staging.example.com/api/v1/events"
export TEST_SESSION="test-$(date +%s)"

# Dependencies
which curl jq vault || echo "Install: curl, jq, vault-cli"
```

---

## GOV-001: Vault/SIEM Integration for F13 Logging

### Test 1.1: F13 HOLD Event Logging
```bash
# Trigger F13 HOLD (no approval code)
curl -X POST "$STAGING_URL/governance/f13/hold" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "delete production database",
    "risk_level": "critical"
  }' | jq '.'

# Expected Response:
# {
#   "verdict": "HOLD",
#   "floor": "F13",
#   "action": "delete production database",
#   "risk_level": "critical",
#   "required_approval": "888-20260411..."
# }
```

**Verification Steps:**
- [ ] Response contains `"verdict": "HOLD"`
- [ ] Response includes `required_approval` field
- [ ] **Vault Check:** Event appears in Vault audit log within 5 seconds
  ```bash
  vault read sys/audit-hash | grep -A5 "f13_hold"
  ```
- [ ] **SIEM Check:** Query SIEM API for F13 events
  ```bash
  curl "$SIEM_API?floor=F13&verdict=HOLD&limit=1" | jq '.events[0].action'
  # Should return: "delete production database"
  ```

### Test 1.2: F13 PASS Event Logging
```bash
# Get valid approval code from Vault (simulated)
APPROVAL_CODE=$(vault read -field=code secret/f13/approvals/test)

# Trigger F13 PASS (with approval code)
curl -X POST "$STAGING_URL/governance/f13/hold" \
  -H "Content-Type: application/json" \
  -d "{
    \"action\": \"delete production database\",
    \"risk_level\": \"critical\",
    \"approval_code\": \"$APPROVAL_CODE\"
  }" | jq '.'

# Expected Response:
# {
#   "verdict": "PASS",
#   "floor": "F13",
#   "action": "delete production database",
#   "approval_code": "888-20260411..."
# }
```

**Verification Steps:**
- [ ] Response contains `"verdict": "PASS"`
- [ ] **Vault Check:** PASS event logged with approval code hash
- [ ] **SIEM Check:** Event queryable with `verdict=PASS`
- [ ] **Correlation:** HOLD and PASS events linkable by `action` + `session_id`

### Test 1.3: Log Schema Validation
```bash
# Fetch last F13 event from SIEM
curl "$SIEM_API?floor=F13&limit=1" | jq '.'
```

**Required Fields (all must be present):**
- [ ] `timestamp` (ISO8601)
- [ ] `floor` ("F13")
- [ ] `verdict` ("PASS" | "HOLD")
- [ ] `action` (string)
- [ ] `risk_level` ("minimal" | "low" | "medium" | "high" | "critical")
- [ ] `approval_code` (string, masked if HOLD)
- [ ] `approval_jti` (UUID, for revocation tracking)
- [ ] `approval_sub` (string, approval type classification)
- [ ] `approval_iss` (string, token issuer)
- [ ] `actor_id` (string)
- [ ] `session_id` (UUID)
- [ ] `request_id` (UUID, for correlation)

---

## GOV-002: 888 Approval Lifecycle

### Test 2.1: Code Format Validation (JWT-Style)

**Additional Checks:**
- [ ] `iss` claim is in configured allowlist (`vault-staging`, `vault-prod`)
- [ ] `jti` and `sub` logged in F13 events for SIEM correlation
- [ ] Clock skew tolerance documented (±5 minutes acceptable)
```bash
# Decode JWT structure (header.payload.signature)
echo "$APPROVAL_CODE" | cut -d. -f2 | base64 -d 2>/dev/null | jq '.'

# Expected Payload:
# {
#   "iss": "vault-staging",
#   "sub": "f13-approval",
#   "iat": 1744392000,
#   "exp": 1744395600,
#   "jti": "uuid-unique-token-id",
#   "action": "delete production database",
#   "risk_level": "critical"
# }
```

**Verification Steps:**
- [ ] Token is valid JWT (3 parts, base64url encoded)
- [ ] Payload contains `iss` (issuer)
- [ ] Payload contains `exp` (expiry, max 1 hour from `iat`)
- [ ] Payload contains `jti` (unique token ID for revocation)
- [ ] Payload contains `action` and `risk_level` (binding to specific operation)

### Test 2.2: Expired Code Rejection

**Clock Skew Test:**
```bash
# Token with exp = now + 30 seconds
NEAR_EXPIRE_CODE=$(vault write -field=code secret/f13/approvals/ttl-30s)

sleep 25

# Should still work (within 5 min skew)
curl -X POST "$STAGING_URL/governance/f13/hold" \
  -d "{\"action\": \"test\", \"risk_level\": \"critical\", \"approval_code\": \"$NEAR_EXPIRE_CODE\"}"

sleep 10

# Should now reject (beyond exp + skew)
curl -X POST "$STAGING_URL/governance/f13/hold" \
  -d "{\"action\": \"test\", \"risk_level\": \"critical\", \"approval_code\": \"$NEAR_EXPIRE_CODE\"}"
```

**Verification:**
- [ ] Token accepted at T+25s (within tolerance)
- [ ] Token rejected at T+35s (beyond tolerance)
```bash
# Use expired code (simulate or use old token)
EXPIRED_CODE="eyJhbGciOiJSUzI1NiIs..."

curl -X POST "$STAGING_URL/governance/f13/hold" \
  -H "Content-Type: application/json" \
  -d "{
    \"action\": \"delete production database\",
    \"risk_level\": \"critical\",
    \"approval_code\": \"$EXPIRED_CODE\"
  }" | jq '.'

# Expected: HOLD (rejected), with reason "expired"
```

**Verification Steps:**
- [ ] Response is `verdict: "HOLD"`
- [ ] Response includes `reason: "approval_code_expired"`
- [ ] Event logged in Vault/SIEM with `rejected: true` and `rejection_reason`

### Test 2.3: Revoked Code Rejection
```bash
# Revoke code in Vault
vault write sys/leases/revoke lease_id=f13/approvals/test

# Attempt use of revoked code
curl -X POST "$STAGING_URL/governance/f13/hold" \
  -H "Content-Type: application/json" \
  -d "{
    \"action\": \"delete production database\",
    \"risk_level\": \"critical\",
    \"approval_code\": \"$APPROVAL_CODE\"
  }" | jq '.'

# Expected: HOLD (rejected), with reason "revoked"
```

**Verification Steps:**
- [ ] Response is `verdict: "HOLD"`
- [ ] Response includes `reason: "approval_code_revoked"`
- [ ] Revocation event logged in Vault audit log

### Test 2.4: Rotation Exercise
```bash
# Record old code
OLD_CODE=$(vault read -field=code secret/f13/approvals/rotation-test)

# Rotate (issue new, revoke old)
vault write secret/f13/approvals/rotation-test rotate=true
NEW_CODE=$(vault read -field=code secret/f13/approvals/rotation-test)

# Verify old code rejected, new code accepted
echo "Old code should fail, new code should pass"
```

**Verification Steps:**
- [ ] Old code returns `verdict: "HOLD"` + `reason: "revoked"`
- [ ] New code returns `verdict: "PASS"`
- [ ] Rotation event logged with `old_jti` → `new_jti` mapping

---

## GOV-003: Auto-Append Telemetry Footer

### Test 3.1: Success Response Telemetry
```bash
# Make any governed request
curl -X POST "$STAGING_URL/governance/check" \
  -H "Content-Type: application/json" \
  -d '{"task": "Explain quantum computing"}' | jq '.'

# Expected: Response includes telemetry block
```

**Verification Steps:**
- [ ] Response contains `telemetry` object
- [ ] `telemetry.epoch` is valid ISO8601 timestamp (not version tag)
- [ ] `telemetry.dS` is present (float)
- [ ] `telemetry.peace2` is present (float)
- [ ] `telemetry.kappa_r` is present (float)
- [ ] `telemetry.verdict` matches response verdict

### Test 3.2: Error Response Telemetry
```bash
# Trigger error (malformed request)
curl -X POST "$STAGING_URL/governance/check" \
  -H "Content-Type: application/json" \
  -d '{"invalid": "payload"}' 2>/dev/null | jq '.'

# Expected: Error response STILL includes telemetry with degraded values
```

**Verification Steps:**
- [ ] Error response contains `telemetry` object
- [ ] `telemetry.verdict` is "Paused" or "HOLD"
- [ ] `telemetry.dS` shows negative delta (entropy increased)
- [ ] All standard fields present despite error

### Test 3.3: Sample Verification (20/20)
```bash
#!/bin/bash
# Sample 20 requests and verify telemetry presence
PASSED=0
FAILED=0

for i in {1..20}; do
  RESPONSE=$(curl -s -X POST "$STAGING_URL/governance/check" \
    -H "Content-Type: application/json" \
    -d '{"task": "Test request '$i'"}')
  
  if echo "$RESPONSE" | jq -e '.telemetry' > /dev/null 2>&1; then
    ((PASSED++))
    echo "✅ Request $i: telemetry present"
  else
    ((FAILED++))
    echo "❌ Request $i: telemetry MISSING"
  fi
done

echo ""
echo "Results: $PASSED/20 passed, $FAILED/20 failed"
[ $FAILED -eq 0 ] && echo "✅ GOV-003 PASSED" || echo "❌ GOV-003 FAILED"
```

**Verification Steps:**
- [ ] Run script above
- [ ] 20/20 responses contain telemetry
- [ ] No responses contain version tags (vXX) in epoch field

### Test 3.4: Telemetry Schema Validation
```bash
# Validate against schema
curl -X POST "$STAGING_URL/governance/check" \
  -H "Content-Type: application/json" \
  -d '{"task": "Schema validation test"}' | jq '.telemetry' | jq -e '
    .epoch | type == "string" and
    .dS | type == "number" and
    .peace2 | type == "number" and
    .kappa_r | type == "number" and
    .verdict | type == "string"
  '
```

**Verification Steps:**
- [ ] All fields match expected types
- [ ] No extra/undefined fields in telemetry block
- [ ] Schema consistent across 5+ different request types

---

## Final Sign-Off

### Phase 2 Exit Checklist

| Requirement | Evidence | Status |
|-------------|----------|--------|
| F13 HOLD event in Vault | Vault audit log entry | ⬜ |
| F13 PASS event in Vault | Vault audit log entry | ⬜ |
| F13 HOLD event in SIEM | SIEM API query result | ⬜ |
| F13 PASS event in SIEM | SIEM API query result | ⬜ |
| 888 code rejects expired | Test 2.2 result | ⬜ |
| 888 code rejects revoked | Test 2.3 result | ⬜ |
| Rotation exercise complete | Test 2.4 result | ⬜ |
| Telemetry 20/20 present | Test 3.3 script output | ⬜ |
| No version tags in epoch | Test 3.3 validation | ⬜ |

**Overall Phase 2 Status:** ⬜ PASS / ⬜ FAIL

### Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| SRE Engineer | | | |
| Security Review | | | |
| Governance Lead | | | |

---

## Appendix: Quick Commands

```bash
# Check Vault health
vault status

# Query recent F13 events
curl "$SIEM_API?floor=F13&limit=10" | jq '.events[] | {timestamp, verdict, action}'

# Force F13 HOLD (for testing)
curl -X POST "$STAGING_URL/governance/f13/hold" \
  -d '{"action": "test-action", "risk_level": "critical"}'

# Check telemetry in logs
grep "telemetry" /var/log/arifos/app.log | tail -5
```

---

*DITEMPA BUKAN DIBERI — 999 SEAL ALIVE*
