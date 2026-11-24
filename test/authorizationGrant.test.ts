import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateAuthorizationGrant,
  recordGrantUsage,
  resetGrantUsage,
  createTestGrant,
  type AuthorizationGrant,
  type ValidationResult,
} from "../src/domain/governance/AuthorizationGrant.js";

test("AuthorizationGrant validation — valid grant passes", () => {
  resetGrantUsage();

  const grant: AuthorizationGrant = {
    grant_id: "grant-test-001",
    candidate_digest: "abc123def456",
    repository: "ariffazil/a-forge",
    operation: "release",
    service_scope: "aforge-release",
    baseline_digest: "baseline789",
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
    use_limit: 1,
    authorized_by: "F13",
  };

  const result = validateAuthorizationGrant(grant, "abc123def456", "aforge-release", "baseline789");
  assert.equal(result.valid, true, "valid grant should pass");
  assert.equal(result.reason, undefined, "no reason for valid grant");
});

test("AuthorizationGrant validation — digest mismatch rejected", () => {
  resetGrantUsage();

  const grant = createTestGrant({
    candidate_digest: "digest-x",
    baseline_digest: "baseline-y",
  });

  // Grant authorizes digest-x, but we're checking against digest-y
  const result = validateAuthorizationGrant(grant, "digest-y", "aforge-release", "baseline-y");
  assert.equal(result.valid, false, "digest mismatch should fail");
  assert.equal(result.code, "DIGEST_MISMATCH", "correct error code");
  assert.ok(result.reason?.includes("digest-x"), "reason mentions grant digest");
  assert.ok(result.reason?.includes("digest-y"), "reason mentions expected digest");
});

test("AuthorizationGrant validation — baseline digest mismatch rejected", () => {
  resetGrantUsage();

  const grant = createTestGrant({
    candidate_digest: "digest-x",
    baseline_digest: "baseline-y",
  });

  // Grant expects baseline-y, but current baseline is baseline-z
  const result = validateAuthorizationGrant(grant, "digest-x", "aforge-release", "baseline-z");
  assert.equal(result.valid, false, "baseline digest mismatch should fail");
  assert.equal(result.code, "DIGEST_MISMATCH", "correct error code");
});

test("AuthorizationGrant validation — expired grant rejected", () => {
  resetGrantUsage();

  const grant = createTestGrant({
    candidate_digest: "digest-x",
    baseline_digest: "baseline-y",
    expires_at: new Date(Date.now() - 60 * 1000).toISOString(), // 1 minute ago
  });

  const result = validateAuthorizationGrant(grant, "digest-x", "aforge-release", "baseline-y");
  assert.equal(result.valid, false, "expired grant should fail");
  assert.equal(result.code, "EXPIRED", "correct error code");
  assert.ok(result.reason?.includes("expired"), "reason mentions expiration");
});

test("AuthorizationGrant validation — reuse denied (use_limit=1)", () => {
  resetGrantUsage();

  const grant = createTestGrant({
    candidate_digest: "digest-x",
    baseline_digest: "baseline-y",
    use_limit: 1,
  });

  // First use - should pass
  const result1 = validateAuthorizationGrant(grant, "digest-x", "aforge-release", "baseline-y");
  assert.equal(result1.valid, true, "first use should pass");

  // Record usage
  recordGrantUsage(grant.grant_id);

  // Second use - should fail
  const result2 = validateAuthorizationGrant(grant, "digest-x", "aforge-release", "baseline-y");
  assert.equal(result2.valid, false, "second use should fail");
  assert.equal(result2.code, "REUSED", "correct error code");
  assert.ok(result2.reason?.includes("exhausted"), "reason mentions exhaustion");
});

test("AuthorizationGrant validation — mismatched scope denied", () => {
  resetGrantUsage();

  const grant = createTestGrant({
    candidate_digest: "digest-x",
    baseline_digest: "baseline-y",
    service_scope: "other-scope",
  });

  const result = validateAuthorizationGrant(grant, "digest-x", "aforge-release", "baseline-y");
  assert.equal(result.valid, false, "scope mismatch should fail");
  assert.equal(result.code, "SCOPE_MISMATCH", "correct error code");
  assert.ok(result.reason?.includes("other-scope"), "reason mentions grant scope");
  assert.ok(result.reason?.includes("aforge-release"), "reason mentions expected scope");
});

test("AuthorizationGrant validation — invalid structure rejected", () => {
  resetGrantUsage();

  // Missing grant_id
  const grant1 = createTestGrant({});
  delete (grant1 as any).grant_id;
  const result1 = validateAuthorizationGrant(grant1 as any, "digest-x", "aforge-release", "baseline-y");
  assert.equal(result1.valid, false, "missing grant_id should fail");
  assert.equal(result1.code, "INVALID_STRUCTURE", "correct error code");

  // Invalid use_limit
  const grant2 = createTestGrant({ use_limit: 0 });
  const result2 = validateAuthorizationGrant(grant2, "digest-x", "aforge-release", "baseline-y");
  assert.equal(result2.valid, false, "use_limit=0 should fail");
  assert.equal(result2.code, "INVALID_STRUCTURE", "correct error code");

  // Invalid expires_at
  const grant3 = createTestGrant({ expires_at: "not-a-date" });
  const result3 = validateAuthorizationGrant(grant3, "digest-x", "aforge-release", "baseline-y");
  assert.equal(result3.valid, false, "invalid expires_at should fail");
  assert.equal(result3.code, "INVALID_STRUCTURE", "correct error code");
});

test("AuthorizationGrant validation — use_limit > 1 allows multiple uses", () => {
  resetGrantUsage();

  const grant = createTestGrant({
    candidate_digest: "digest-x",
    baseline_digest: "baseline-y",
    use_limit: 3,
  });

  // First use
  assert.equal(validateAuthorizationGrant(grant, "digest-x", "aforge-release", "baseline-y").valid, true);
  recordGrantUsage(grant.grant_id);

  // Second use
  assert.equal(validateAuthorizationGrant(grant, "digest-x", "aforge-release", "baseline-y").valid, true);
  recordGrantUsage(grant.grant_id);

  // Third use
  assert.equal(validateAuthorizationGrant(grant, "digest-x", "aforge-release", "baseline-y").valid, true);
  recordGrantUsage(grant.grant_id);

  // Fourth use - should fail
  assert.equal(validateAuthorizationGrant(grant, "digest-x", "aforge-release", "baseline-y").valid, false);
});

test("AuthorizationGrant validation — resetGrantUsage clears tracking", () => {
  resetGrantUsage();

  const grant = createTestGrant({ use_limit: 1 });

  assert.equal(validateAuthorizationGrant(grant, "digest-x", "aforge-release", "baseline-y").valid, true);
  recordGrantUsage(grant.grant_id);
  assert.equal(validateAuthorizationGrant(grant, "digest-x", "aforge-release", "baseline-y").valid, false);

  resetGrantUsage();
  assert.equal(validateAuthorizationGrant(grant, "digest-x", "aforge-release", "baseline-y").valid, true);
});

test("AuthorizationGrant schema — type exports exist", () => {
  // This test ensures the types are properly exported
  const grant: AuthorizationGrant = createTestGrant();
  const result: ValidationResult = validateAuthorizationGrant(grant, "x", "y", "z");

  assert.ok(typeof grant.grant_id === "string");
  assert.ok(typeof grant.candidate_digest === "string");
  assert.ok(typeof grant.repository === "string");
  assert.ok(typeof grant.operation === "string");
  assert.ok(typeof grant.service_scope === "string");
  assert.ok(typeof grant.baseline_digest === "string");
  assert.ok(typeof grant.expires_at === "string");
  assert.ok(typeof grant.use_limit === "number");
  assert.ok(typeof grant.authorized_by === "string");
  assert.ok(typeof result.valid === "boolean");
  assert.ok(result.reason === undefined || typeof result.reason === "string");
  assert.ok(result.code === undefined || typeof result.code === "string");
});

test("AuthorizationGrant — signature field optional and not validated", () => {
  resetGrantUsage();

  const grantWithSig = createTestGrant({ signature: "some-signature" });
  const grantWithoutSig = createTestGrant({});

  const resultWith = validateAuthorizationGrant(grantWithSig, "digest-x", "aforge-release", "baseline-y");
  const resultWithout = validateAuthorizationGrant(grantWithoutSig, "digest-x", "aforge-release", "baseline-y");

  assert.equal(resultWith.valid, true, "grant with signature passes");
  assert.equal(resultWithout.valid, true, "grant without signature passes");
});