.PHONY: build up down logs test clean install

# AF FORGE — Makefile for local dev and VPS ops

build: security-audit
	npm run build

# Deploy to /opt and sync commit markers (prevents deployment_drift)
deploy: build
	@echo "═══ F1 PRE-FLIGHT: dist/ source-of-truth check ═══"
	@if git status --porcelain dist/ | grep -q .; then \
		echo "888_HOLD: dist/ has untracked or modified build artifacts."; \
		echo "F1 AMANAH — hot-patching dist/ is BLACKLISTED. Clean build required."; \
		echo "Run: make clean && make build"; \
		exit 1; \
	fi
	@GIT_SHA=$$(git rev-parse --short HEAD); \
	echo "$$GIT_SHA" > /root/A-FORGE/.git_commit; \
	echo "$$GIT_SHA" > /root/A-FORGE/dist/build-commit.txt; \
	rsync -av --delete dist/ /opt/a-forge/app/dist/; \
	echo "$$GIT_SHA" > /opt/a-forge/app/.git_commit; \
	echo "$$GIT_SHA" > /opt/a-forge/app/dist/build-commit.txt; \
	systemctl restart a-forge-mcp.service; \
	sleep 3; \
	curl -sf http://127.0.0.1:7071/health >/dev/null && echo "✅ A-FORGE :7071 healthy" || echo "❌ A-FORGE :7071 down"; \
	curl -sf http://127.0.0.1:7072/health >/dev/null && echo "✅ A-FORGE :7072 healthy" || echo "❌ A-FORGE :7072 down"

deploy-local: verify
	@echo "═══ A-FORGE deploy-local (no rsync to /opt/) ═══"
	@GIT_SHA=$$(git rev-parse --short HEAD); \
	echo "$$GIT_SHA" > /root/A-FORGE/.git_commit; \
	echo "$$GIT_SHA" > /root/A-FORGE/dist/build-commit.txt; \
	systemctl restart a-forge-mcp.service; \
	sleep 3; \
	curl -sf http://127.0.0.1:7071/health >/dev/null && echo "✅ A-FORGE :7071 healthy" || echo "❌ A-FORGE :7071 down"; \
	curl -sf http://127.0.0.1:7072/health >/dev/null && echo "✅ A-FORGE :7072 healthy" || echo "❌ A-FORGE :7072 down"

verify:
	@echo "verifying authority_ceiling on A-FORGE..."
	@curl -sf http://127.0.0.1:7071/health | python3 -c "import json,sys;h=json.load(sys.stdin);assert h.get('authority_ceiling'),'authority_ceiling ABSENT';assert h.get('apex_scalars_policy'),'apex_scalars_policy ABSENT';print(f'✅ :7071 authority_ceiling={h[\"authority_ceiling\"]} apex_policy=present')" || echo "❌ :7071 verify failed"
	@curl -sf http://127.0.0.1:7072/health | python3 -c "import json,sys;h=json.load(sys.stdin);assert h.get('authority_ceiling'),'authority_ceiling ABSENT';print(f'✅ :7072 authority_ceiling={h[\"authority_ceiling\"]}')" || echo "❌ :7072 verify failed"
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
