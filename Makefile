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

clean:
	docker compose down -v
	rm -rf dist/

install:
	npm install


include /root/arifOS/scripts/security_audit.mk
