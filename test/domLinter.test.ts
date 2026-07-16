/**
 * @file domLinter.test.ts — W₂ Structural Witness Tests
 * @description Tests for deterministic DOM linting — accessibility, structure, constraints.
 *
 * RUN: npx tsx test/domLinter.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { domLinter } from "../src/infrastructure/tools/domLinter.js";

// ============================================================================
// ACCESSIBILITY CHECKS
// ============================================================================

describe("W₂: Accessibility checks", () => {
  it("image without alt → MISSING_ALT_TEXT", async () => {
    const html = '<html><body><img src="photo.jpg"></body></html>';
    const result = await domLinter(html);

    const altDev = result.deviations.find(d => d.type === "MISSING_ALT_TEXT");
    assert.ok(altDev, "Must flag image without alt");
    assert.equal(altDev!.severity, "HIGH");
    assert.equal(altDev!.epistemic_label, "OBS");
  });

  it("image with alt='' and no role → EMPTY_ALT_TEXT", async () => {
    const html = '<html><body><img src="photo.jpg" alt=""></body></html>';
    const result = await domLinter(html);

    const emptyAlt = result.deviations.find(d => d.type === "EMPTY_ALT_TEXT");
    assert.ok(emptyAlt, "Must flag empty alt without presentation role");
  });

  it("image with alt='' and role=presentation → no deviation", async () => {
    const html = '<html><body><img src="deco.png" alt="" role="presentation"></body></html>';
    const result = await domLinter(html);

    const emptyAlt = result.deviations.find(d => d.type === "EMPTY_ALT_TEXT");
    assert.equal(emptyAlt, undefined, "Presentation role exempts empty alt");
  });

  it("image with proper alt → no deviation", async () => {
    const html = '<html><body><img src="photo.jpg" alt="A sunset"></body></html>';
    const result = await domLinter(html);

    const altDevs = result.deviations.filter(d => d.type.includes("ALT"));
    assert.equal(altDevs.length, 0, "Proper alt text should pass");
  });

  it("button without type → MISSING_BUTTON_TYPE", async () => {
    const html = '<html><body><button>Click</button></body></html>';
    const result = await domLinter(html);

    const btnDev = result.deviations.find(d => d.type === "MISSING_BUTTON_TYPE");
    assert.ok(btnDev, "Must flag button without type");
    assert.equal(btnDev!.severity, "LOW");
  });

  it("button with type → no deviation", async () => {
    const html = '<html><body><button type="button">Click</button></body></html>';
    const result = await domLinter(html);

    const btnDevs = result.deviations.filter(d => d.type.includes("BUTTON"));
    assert.equal(btnDevs.length, 0);
  });

  it("positive tabindex → POSITIVE_TABINDEX", async () => {
    const html = '<html><body><div tabindex="5">Focus me</div></body></html>';
    const result = await domLinter(html);

    const tabDev = result.deviations.find(d => d.type === "POSITIVE_TABINDEX");
    assert.ok(tabDev, "Must flag positive tabindex");
    assert.equal(tabDev!.severity, "MEDIUM");
  });

  it("interactive element without accessible name → MISSING_ACCESSIBLE_NAME", async () => {
    const html = '<html><body><button></button></body></html>';
    const result = await domLinter(html);

    const nameDev = result.deviations.find(d => d.type === "MISSING_ACCESSIBLE_NAME");
    assert.ok(nameDev, "Must flag button without accessible name");
  });

  it("button with aria-label → no MISSING_ACCESSIBLE_NAME", async () => {
    const html = '<html><body><button aria-label="Close dialog">×</button></body></html>';
    const result = await domLinter(html);

    const nameDevs = result.deviations.filter(d => d.type === "MISSING_ACCESSIBLE_NAME");
    assert.equal(nameDevs.length, 0, "aria-label satisfies accessible name");
  });
});

// ============================================================================
// STRUCTURAL CHECKS
// ============================================================================

describe("W₂: Structural checks", () => {
  it("missing required element → MISSING_REQUIRED_ELEMENT", async () => {
    const html = '<html><body><div>Content</div></body></html>';
    const result = await domLinter(html, { required_elements: ["nav", "main", "footer"] });

    const missingNav = result.deviations.find(d => d.type === "MISSING_REQUIRED_ELEMENT" && d.element === "nav");
    const missingMain = result.deviations.find(d => d.type === "MISSING_REQUIRED_ELEMENT" && d.element === "main");
    const missingFooter = result.deviations.find(d => d.type === "MISSING_REQUIRED_ELEMENT" && d.element === "footer");

    assert.ok(missingNav, "Must flag missing <nav>");
    assert.ok(missingMain, "Must flag missing <main>");
    assert.ok(missingFooter, "Must flag missing <footer>");
  });

  it("all required elements present → no deviation", async () => {
    const html = '<html><body><nav><a>Link</a></nav><main>Content</main><footer>Footer</footer></body></html>';
    const result = await domLinter(html, { required_elements: ["nav", "main", "footer"] });

    const missingDevs = result.deviations.filter(d => d.type === "MISSING_REQUIRED_ELEMENT");
    assert.equal(missingDevs.length, 0, "All required elements present");
  });

  it("nav link count exceeded → NAV_LINK_COUNT_EXCEEDED", async () => {
    const links = Array.from({ length: 7 }, (_, i) => `<a href="/${i}">Link ${i}</a>`).join("");
    const html = `<html><body><nav>${links}</nav></body></html>`;
    const result = await domLinter(html, { max_nav_links: 5 });

    const navDev = result.deviations.find(d => d.type === "NAV_LINK_COUNT_EXCEEDED");
    assert.ok(navDev, "Must flag nav link count exceeded");
    assert.equal(navDev!.expected, "5");
    assert.equal(navDev!.actual, "7");
  });

  it("nav link count within limit → no deviation", async () => {
    const links = Array.from({ length: 3 }, (_, i) => `<a href="/${i}">Link ${i}</a>`).join("");
    const html = `<html><body><nav>${links}</nav></body></html>`;
    const result = await domLinter(html, { max_nav_links: 5 });

    const navDevs = result.deviations.filter(d => d.type === "NAV_LINK_COUNT_EXCEEDED");
    assert.equal(navDevs.length, 0);
  });

  it("banned element present → BANNED_ELEMENT_PRESENT", async () => {
    const html = '<html><body><iframe src="evil.html"></iframe></body></html>';
    const result = await domLinter(html, { banned_elements: ["iframe"] });

    const banDev = result.deviations.find(d => d.type === "BANNED_ELEMENT_PRESENT");
    assert.ok(banDev, "Must flag banned element");
    assert.equal(banDev!.severity, "HIGH");
  });

  it("DOM depth exceeded → DOM_DEPTH_EXCEEDED", async () => {
    // Build a deeply nested DOM
    let html = "<html><body>";
    for (let i = 0; i < 20; i++) html += "<div>";
    html += "Deep content";
    for (let i = 0; i < 20; i++) html += "</div>";
    html += "</body></html>";

    const result = await domLinter(html, { max_depth: 10 });

    const depthDev = result.deviations.find(d => d.type === "DOM_DEPTH_EXCEEDED");
    assert.ok(depthDev, "Must flag DOM depth exceeded");
  });
});

// ============================================================================
// DETERMINISM
// ============================================================================

describe("W₂: Determinism", () => {
  it("same input → same output (always)", async () => {
    const html = '<html><body><img src="x.jpg"><button>Click</button></body></html>';

    const r1 = await domLinter(html);
    const r2 = await domLinter(html);

    assert.equal(r1.deviations.length, r2.deviations.length);
    assert.equal(r1.confidence, r2.confidence);

    for (let i = 0; i < r1.deviations.length; i++) {
      assert.equal(r1.deviations[i].type, r2.deviations[i].type);
      assert.equal(r1.deviations[i].severity, r2.deviations[i].severity);
    }
  });

  it("confidence always 0.90 (deterministic = known)", async () => {
    const html = '<html><body><div>Minimal</div></body></html>';
    const result = await domLinter(html);

    assert.equal(result.confidence, 0.90,
      "F7 HUMILITY: deterministic confidence = 0.90");
  });

  it("all deviations labeled OBS (F2 TRUTH)", async () => {
    const html = '<html><body><img src="x.jpg"><iframe src="x.html"></iframe></body></html>';
    const result = await domLinter(html, { banned_elements: ["iframe"] });

    for (const dev of result.deviations) {
      assert.equal(dev.epistemic_label, "OBS",
        `Deviation ${dev.type} must be labeled OBS`);
    }
  });
});
