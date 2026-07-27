.PHONY: build up down logs test clean install

# AF FORGE — Makefile for local dev and VPS ops

build: security-audit
	npm run build

up:
	docker compose up -d --build --remove-orphans

down:
	docker compose down

logs:
	docker compose logs -f A-FORGE-bridge

test: security-audit
	npm run build
	npm test
	node dist/test/PlanValidator.test.js
	node dist/test/GovernanceCardGate.test.js
	node dist/test/ParallelPlannerContract.test.js
	node dist/test/confidence.test.js
	node dist/test/sense.test.js
	node dist/test/governanceViolation.test.js
	node dist/test/ticketStore.test.js
	node dist/test/operatorConsole.test.js
	node dist/test/thermodynamic.test.js
	node dist/test/operatorAuth.test.js
	node dist/test/intentRouter.test.js
	node dist/test/engine.test.js
	node dist/test/goxWealthTools.test.js
	node dist/test/AmanahLockManager.test.js
	node dist/test/CoolingGate.test.js
	node dist/test/ModelCapabilityGate.test.js
	node dist/test/ApprovalBoundary.test.js
	node dist/test/GovernanceBridge.test.js
	node dist/test/a2a.test.js


clean:
	docker compose down -v
	rm -rf dist/

install:
	npm install


# ─── Governance Gate Eval (Phase 1 — 2026-07-27) ────────────────────────────
# Toggle each gate ON/OFF and measure pass-rate delta across the test suite.
# Phase 1: existing test suite. Phase 2: dedicated fixtures.
.PHONY: eval-governance eval-governance-quick eval-governance-json
eval-governance:
	@bash scripts/eval_governance.sh
eval-governance-quick:
	@bash scripts/eval_governance.sh --quick
eval-governance-json:
	@bash scripts/eval_governance.sh --json
eval-governance-repeat:
	@bash scripts/eval_governance.sh --repeat 3

include /root/arifOS/scripts/forge.mk
include /root/arifOS/scripts/security_audit.mk
