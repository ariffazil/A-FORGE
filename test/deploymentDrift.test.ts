#!/usr/bin/env node
/**
 * deploymentDrift.test.ts — E1b regression (fedstab-2026-10-08, F13-approved).
 * Invariant: drift must be TRUE when the deployed stamp differs from live git
 * HEAD — even when the stale source marker still matches (the F-01 blindspot).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDeploymentDrift } from "../src/infrastructure/attestation/deploymentDrift.js";

const D = "b8ed01e";
const H = "8eeca7c";

test("stale deployed stamp vs advanced HEAD ⇒ drift TRUE (F-01 blindspot)", () => {
  assert.equal(computeDeploymentDrift(D, D, H), true);
});

test("deployed == source == HEAD ⇒ no drift", () => {
  assert.equal(computeDeploymentDrift(H, H, H), false);
});

test("deployed == HEAD with stale source marker ⇒ no drift (marker is secondary)", () => {
  assert.equal(computeDeploymentDrift(H, D, H), false);
});

test("HEAD UNAVAILABLE (git failure) ⇒ legacy marker-pair fallback", () => {
  assert.equal(computeDeploymentDrift(D, D, "UNAVAILABLE"), false);
  assert.equal(computeDeploymentDrift(D, H, "UNAVAILABLE"), true);
});

test("deployed UNAVAILABLE ⇒ never assert drift (no invented signal)", () => {
  assert.equal(computeDeploymentDrift("UNAVAILABLE", D, H), false);
  assert.equal(computeDeploymentDrift("UNAVAILABLE", D, "UNAVAILABLE"), false);
});
