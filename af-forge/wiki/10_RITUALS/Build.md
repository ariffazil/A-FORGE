---
type: Ritual
tags: [build, deploy, verify, rollback, vps, operations]
sources: [raw/README.md, raw/ARCHITECTURE.md, raw/ROADMAP.md]
last_sync: 2026-04-10
confidence: 0.92
status: active
operator: arifOS_bot
---

# Ritual: Build, Deploy, Verify

This is the default AF-FORGE ritual for changing the VPS stack without creating chaos.

## Intent
- build or update a component
- deploy with the smallest reasonable blast radius
- verify the machine still works
- keep rollback clear

## Flow

```text
observe -> plan -> hold if risky -> deploy -> verify -> seal or rollback
```

## Safe order

1. **Observe first**
   - identify the component
   - identify its compose/native boundary
   - identify exposed ports, dependencies, and data paths

2. **Ground against the wiki**
   - read [[20_BLUEPRINTS/Stack_Components]]
   - read relevant crack pages in `50_CRACKS/`
   - check `raw/` source docs if the blueprint is stale

3. **Pick the smallest action**
   - config-only restart if possible
   - single-service recreate before multi-service churn
   - no broad cleanup unless explicitly required

4. **Verify after change**
   - service reachable
   - dependencies reachable
   - logs sane
   - no new unexpected public exposure

5. **Write back**
   - update the relevant page
   - add a log entry

## Build classes

### Class A, low-risk
- documentation only
- read-only inspection
- internal config verification

### Class B, controlled change
- single container restart
- compose recreate of one service
- safe config patch with rollback

### Class C, high-risk
- network changes
- firewall changes
- secrets rotation
- volume/schema migration
- multi-service rename or topology shift

Class C should trigger a clear human hold unless already explicitly authorized.

## Verification checklist
- [ ] intended service is up
- [ ] related services still healthy
- [ ] logs do not show new obvious faults
- [ ] ports/exposure match expectation
- [ ] rollback path is still available

## Rollback posture
Always know which of these applies before touching the machine:
- restart old container
- revert compose/config file
- restore previous image tag
- restore from volume/data snapshot

## Related
- [[00_OPERATORS/Reconnect_Recovery_Runbook]]
- [[20_BLUEPRINTS/Stack_Components]]
- [[50_CRACKS/Intelligence_Gaps]]
- [[60_TEMPERATURES/Live_Status]]
