.PHONY: build up down logs test clean install

# AF FORGE — Makefile for local dev and VPS ops

build: security-audit
	npm run build

# Deploy to /opt and sync commit markers (prevents deployment_drift)
deploy: build
	@GIT_SHA=$$(git rev-parse --short HEAD); \
	echo "$$GIT_SHA" > /root/A-FORGE/.git_commit; \
	rsync -av --delete dist/ /opt/a-forge/app/dist/; \
	rsync -av package.json /opt/a-forge/app/; \
	echo "$$GIT_SHA" > /opt/a-forge/app/.git_commit; \
	systemctl restart a-forge.service a-forge-mcp.service; \
	echo "✅ A-FORGE deployed: $$GIT_SHA"

up:
	docker compose up -d --build --remove-orphans

down:
	docker compose down

logs:
	docker compose logs -f A-FORGE-bridge

test: security-audit
	npm run build
	# Capability ecology P0 + P1 + P2 (2026-07-31)
	node dist/test/gAuthority.test.js
	node dist/test/ephemeralSandboxProbe.test.js
	node dist/test/ephemeralNoAmbientSecrets.test.js
	node dist/test/ephemeralExitCodes.test.js
	node dist/test/ephemeralRegistrationOrder.test.js
	node dist/test/ephemeralForgeRunnerDelegation.test.js
	node dist/test/ephemeralVerifier.test.js
	node dist/test/evidencePromotion.test.js
	node dist/test/ephemeralComputeFn.test.js
	node dist/test/capabilityAbi.test.js
	node dist/test/missionContract.test.js
	node dist/test/secretBroker.test.js
	node dist/test/trafficShadow.test.js
	node dist/test/evaluator.test.js
	node dist/test/capabilityMarket.test.js
	node dist/test/a2aOfferBridge.test.js
	node dist/test/wmPromotionGate.test.js
	node dist/test/retirementGate.test.js
	node dist/test/EphemeralGenesisRunner.test.js
	# Existing governance / lifecycle / world-model coverage
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
