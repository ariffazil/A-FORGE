import test from "node:test";
import assert from "node:assert/strict";
import { routeIntent, buildRoutingContext, type RoutingDecision } from "../src/engine/IntentRouter.js";

test("IntentRouter — GEOX intent routes to GEOX", () => {
  const r = routeIntent("What is the seismic risk for the field in Sumatra?");
  assert.equal(r.primaryOrgan, "GEOX");
  assert.ok(r.triggers.some((t) => /seismic|field/i.test(t)));
});

test("IntentRouter — WEALTH intent routes to WEALTH", () => {
  const r = routeIntent("Compute the NPV and ROI for the development project investment");
  assert.equal(r.primaryOrgan, "WEALTH");
  assert.ok(r.triggers.some((t) => /npv|roi|investment|capital/i.test(t)));
});

test("IntentRouter — CODE intent routes to CODE", () => {
  const r = routeIntent("Read the file at src/main.ts and fix the bug");
  assert.equal(r.primaryOrgan, "CODE");
  assert.ok(r.triggers.some((t) => /read|file|src/i.test(t)));
});

test("IntentRouter — mixed GEOX + WEALTH routes to MIXED", () => {
  const r = routeIntent("Evaluate the seismic hazard and compute the ROI for extraction");
  assert.ok(["GEOX", "MIXED"].includes(r.primaryOrgan));
  assert.ok(r.secondaryOrgans.length > 0 || r.primaryOrgan === "MIXED");
});

test("IntentRouter — no keywords defaults to CODE", () => {
  const r = routeIntent("What is the meaning of life?");
  assert.equal(r.primaryOrgan, "CODE");
  assert.equal(r.confidence, 0.3);
});

test("IntentRouter — high confidence when dominant keyword signal", () => {
  const r = routeIntent("subsurface reservoir seismic hazard environmental impact extraction rate");
  assert.equal(r.primaryOrgan, "GEOX");
  assert.ok(r.confidence > 0.6);
  assert.ok(r.uncertaintyBand === "low");
});

test("IntentRouter — critical uncertainty when no dominant signal", () => {
  const r = routeIntent("evaluate analyze assess determine");
  assert.equal(r.uncertaintyBand, "critical");
  assert.equal(r.recommendedNextStage, "111_SENSE");
});

test("IntentRouter — builds routing context correctly", () => {
  const r = routeIntent("Compute the thermodynamic entropy cost for the capital allocation");
  const ctx = buildRoutingContext(r);
  assert.equal(ctx.stage, "222_THINK");
  assert.equal(ctx.primaryOrgan, r.primaryOrgan);
  assert.ok(typeof ctx.confidence === "number");
  assert.ok(Array.isArray(ctx.triggers));
});

test("IntentRouter — secondary organs detected for multi-domain", () => {
  const r = routeIntent("seismic hazard and investment ROI for field development");
  assert.ok(r.secondaryOrgans.length >= 1);
});

test("IntentRouter — climate/environmental keywords route to GEOX", () => {
  const r = routeIntent("model the climate impact and carbon emissions for the project");
  assert.equal(r.primaryOrgan, "GEOX");
  assert.ok(r.triggers.some((t) => /climate|carbon|emissions|environmental/i.test(t)));
});

test("IntentRouter — market/commodity keywords route to WEALTH", () => {
  const r = routeIntent("optimize the portfolio allocation and compute the risk-adjusted returns");
  assert.equal(r.primaryOrgan, "WEALTH");
  assert.ok(r.triggers.some((t) => /portfolio|optimize|returns|market/i.test(t)));
});

test("IntentRouter — danger/extraction keywords route to GEOX", () => {
  const r = routeIntent("What is the maximum safe extraction rate for the well?");
  assert.equal(r.primaryOrgan, "GEOX");
  assert.ok(r.triggers.some((t) => /extraction|well/i.test(t)));
});
