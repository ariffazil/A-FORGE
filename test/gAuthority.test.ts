/**
 * gAuthority.test.ts — Pin the canonical G equation and dial count.
 *
 * Constitutional F2 TRUTH. The canonical G must be the 4-dial geometric
 * mean; Φ is a scar-gate dimension, not a 5th dial (T6 theorem).
 */
import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_G_EQUATION,
  CANONICAL_G_DIALS,
  CANONICAL_G_DIAL_COUNT,
  CANONICAL_G_IS_GEOMETRIC_MEAN,
  CANONICAL_G_SOURCE,
  CANONICAL_G_MODULE,
  localGStamp,
  type GAuthority,
} from "../src/domain/governance/gAuthority.js";

describe("gAuthority — canonical G equation", () => {
  it("pins the 4-dial geometric mean string", () => {
    assert.equal(
      CANONICAL_G_EQUATION,
      "G = (A × P × E × X)^(1/4)",
    );
  });

  it("excludes Φ from the canonical dials", () => {
    assert.deepEqual([...CANONICAL_G_DIALS], ["A", "P", "E", "X"]);
    assert.equal(CANONICAL_G_DIALS.length, 4);
  });

  it("CANONICAL_G_DIAL_COUNT is 4", () => {
    assert.equal(CANONICAL_G_DIAL_COUNT, 4);
  });

  it("CANONICAL_G_IS_GEOMETRIC_MEAN is true", () => {
    assert.equal(CANONICAL_G_IS_GEOMETRIC_MEAN, true);
  });

  it("CANONICAL_G_SOURCE is arif_think(mode='apex')", () => {
    assert.equal(CANONICAL_G_SOURCE, "arif_think.mode=apex");
  });

  it("CANONICAL_G_MODULE is the arifOS module", () => {
    assert.equal(CANONICAL_G_MODULE, "arifosmcp.runtime.apex_canonical");
  });
});

describe("gAuthority — local stamp", () => {
  it("stamps local products with derived_local + invent_g=false", () => {
    const stamp = localGStamp();
    assert.equal(stamp.g_canonical_source, "arif_think.mode=apex");
    assert.equal(stamp.g_canonical_module, "arifosmcp.runtime.apex_canonical");
    assert.equal(stamp.invent_g, false);
    assert.equal(stamp.derived_local, true);
    assert.equal(stamp.g_authority, "local_estimate");
  });

  it("accepts an alternate authority kind", () => {
    const stamp = localGStamp("application_local");
    assert.equal(stamp.g_authority, "application_local");
  });
});

describe("gAuthority — type discriminator", () => {
  it("exposes GAuthority as a string-literal union", () => {
    const kind: GAuthority = "arif_think.mode=apex";
    assert.equal(kind, "arif_think.mode=apex");
  });
});
