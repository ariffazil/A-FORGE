/**
 * @file visionAnalyze.test.ts — Tests for W₁ Vision Witness (Pixel-Level Evidence)
 * @description Tests the deterministic pixelmatch-based vision analysis.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 *
 * F2 TRUTH: All deviations labeled OBS.
 * F7 HUMILITY: Confidence capped at 0.90.
 * F9 ANTI-HANTU: No semantic interpretation. Pure pixel math.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PNG } from "pngjs";
import { visionAnalyze } from "../src/infrastructure/tools/visionAnalyze.js";

// ============================================================================
// HELPERS
// ============================================================================

const TEST_DIR = join(tmpdir(), `vision-analyze-test-${Date.now()}`);

function createPngBuffer(width: number, height: number, fill: [number, number, number, number] = [255, 0, 0, 255]): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      png.data[idx] = fill[0];     // R
      png.data[idx + 1] = fill[1]; // G
      png.data[idx + 2] = fill[2]; // B
      png.data[idx + 3] = fill[3]; // A
    }
  }
  return PNG.sync.write(png);
}

/**
 * Create a modified PNG buffer by modifying specific pixels.
 * Properly deserializes → modifies → re-serializes.
 */
function createModifiedPng(baseBuffer: Buffer, modifications: Array<{ pixel: number; color: [number, number, number, number] }>): Buffer {
  const png = PNG.sync.read(baseBuffer);
  for (const mod of modifications) {
    const idx = mod.pixel * 4;
    png.data[idx] = mod.color[0];
    png.data[idx + 1] = mod.color[1];
    png.data[idx + 2] = mod.color[2];
    png.data[idx + 3] = mod.color[3];
  }
  return PNG.sync.write(png);
}

async function savePng(buffer: Buffer, filename: string): Promise<string> {
  const path = join(TEST_DIR, filename);
  await writeFile(path, buffer);
  return path;
}

// ============================================================================
// TESTS
// ============================================================================

describe("visionAnalyze — W₁ Vision Witness", () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  // --------------------------------------------------------------------------
  // Test 1: Identical images → 0 deviations, confidence 0.90
  // --------------------------------------------------------------------------
  it("identical images → 0 deviations, confidence 0.90", async () => {
    const buffer = createPngBuffer(100, 100, [255, 0, 0, 255]);
    const screenshotPath = await savePng(buffer, "test1.png");
    await savePng(buffer, "test1.baseline.png");

    const result = await visionAnalyze(screenshotPath);

    assert.equal(result.deviations.length, 0);
    assert.equal(result.confidence, 0.90);
    assert.equal(result.metadata.baseline_used, true);
    assert.equal(result.metadata.diff_pixels, 0);
    assert.equal(result.metadata.diff_percentage, 0);
    assert.ok(result.metadata.screenshot_hash.match(/^[a-f0-9]{64}$/));
  });

  // --------------------------------------------------------------------------
  // Test 2: Different images → PIXEL_DRIFT deviation
  // --------------------------------------------------------------------------
  it("different images → PIXEL_DIFF_EXCEEDED deviation", async () => {
    const red = createPngBuffer(100, 100, [255, 0, 0, 255]);
    const blue = createPngBuffer(100, 100, [0, 0, 255, 255]);
    const screenshotPath = await savePng(red, "test2.png");
    await savePng(blue, "test2.baseline.png");

    const result = await visionAnalyze(screenshotPath);

    assert.equal(result.deviations.length, 1);
    assert.equal(result.deviations[0].type, "PIXEL_DIFF_EXCEEDED");
    assert.equal(result.deviations[0].epistemic_label, "OBS");
    assert.equal(result.deviations[0].severity, "CRITICAL"); // 100% diff
    assert.equal(result.confidence, 0.90);
    assert.equal(result.metadata.diff_pixels, 10000); // 100x100
    assert.equal(result.metadata.diff_percentage, 100);
  });

  // --------------------------------------------------------------------------
  // Test 3: Partial diff → severity classification
  // --------------------------------------------------------------------------
  it("partial diff → correct severity classification", async () => {
    // Create a 100x100 image, change only 200 pixels (2%)
    const baseline = createPngBuffer(100, 100, [255, 0, 0, 255]);
    const modifications = Array.from({ length: 200 }, (_, i) => ({
      pixel: i,
      color: [0, 0, 0, 255] as [number, number, number, number],
    }));
    const modified = createModifiedPng(baseline, modifications);

    const screenshotPath = await savePng(modified, "test3.png");
    await savePng(baseline, "test3.baseline.png");

    const result = await visionAnalyze(screenshotPath, { pixel_tolerance: 50 });

    assert.equal(result.deviations.length, 1);
    assert.equal(result.deviations[0].type, "PIXEL_DIFF_EXCEEDED");
    assert.equal(result.deviations[0].severity, "MEDIUM"); // 2% > 1% but < 5%
    assert.equal(result.deviations[0].epistemic_label, "OBS");
  });

  // --------------------------------------------------------------------------
  // Test 4: No baseline → empty deviations, confidence 0.50 (UNKNOWN)
  // --------------------------------------------------------------------------
  it("no baseline → empty deviations, confidence 0.50", async () => {
    const buffer = createPngBuffer(100, 100, [255, 0, 0, 255]);
    const screenshotPath = await savePng(buffer, "test4.png");
    // No baseline file created

    const result = await visionAnalyze(screenshotPath);

    assert.equal(result.deviations.length, 0);
    assert.equal(result.confidence, 0.50); // UNKNOWN — no baseline
    assert.equal(result.metadata.baseline_used, false);
    assert.equal(result.metadata.total_pixels, 10000);
  });

  // --------------------------------------------------------------------------
  // Test 5: Missing screenshot → error, not crash
  // --------------------------------------------------------------------------
  it("missing screenshot → SCREENSHOT_LOAD_FAILED deviation", async () => {
    const result = await visionAnalyze("/nonexistent/path/screenshot.png");

    assert.equal(result.deviations.length, 1);
    assert.equal(result.deviations[0].type, "SCREENSHOT_LOAD_FAILED");
    assert.equal(result.deviations[0].severity, "CRITICAL");
    assert.equal(result.deviations[0].epistemic_label, "OBS");
    assert.equal(result.confidence, 0);
  });

  // --------------------------------------------------------------------------
  // Test 6: Dimension mismatch → DIMENSION_MISMATCH deviation
  // --------------------------------------------------------------------------
  it("dimension mismatch → DIMENSION_MISMATCH deviation", async () => {
    const small = createPngBuffer(50, 50, [255, 0, 0, 255]);
    const large = createPngBuffer(100, 100, [255, 0, 0, 255]);
    const screenshotPath = await savePng(small, "test6.png");
    await savePng(large, "test6.baseline.png");

    const result = await visionAnalyze(screenshotPath);

    assert.equal(result.deviations.length, 1);
    assert.equal(result.deviations[0].type, "DIMENSION_MISMATCH");
    assert.equal(result.deviations[0].severity, "HIGH");
    assert.equal(result.deviations[0].epistemic_label, "OBS");
    assert.ok(result.deviations[0].description?.includes("50x50"));
    assert.ok(result.deviations[0].description?.includes("100x100"));
  });

  // --------------------------------------------------------------------------
  // Test 7: Threshold sensitivity — low threshold catches more diffs
  // --------------------------------------------------------------------------
  it("threshold sensitivity — low threshold catches more diffs", async () => {
    // Create images with subtle color difference
    const baseline = createPngBuffer(100, 100, [100, 100, 100, 255]);
    const modifications = Array.from({ length: 500 }, (_, i) => ({
      pixel: i,
      color: [110, 110, 110, 255] as [number, number, number, number], // +10 per channel
    }));
    const modified = createModifiedPng(baseline, modifications);

    const screenshotPath = await savePng(modified, "test7.png");
    await savePng(baseline, "test7.baseline.png");

    // Low threshold (0.01) — catches subtle differences
    const resultLow = await visionAnalyze(screenshotPath, {
      pixel_threshold: 0.01,
      pixel_tolerance: 100,
    });

    // High threshold (0.5) — ignores subtle differences
    const resultHigh = await visionAnalyze(screenshotPath, {
      pixel_threshold: 0.5,
      pixel_tolerance: 100,
    });

    // Low threshold should detect more differences
    assert.ok(resultLow.metadata.diff_pixels >= resultHigh.metadata.diff_pixels);
  });

  // --------------------------------------------------------------------------
  // Test 8: Confidence always 0.90 when baseline used (F7 HUMILITY)
  // --------------------------------------------------------------------------
  it("confidence always 0.90 when baseline used (F7)", async () => {
    const red = createPngBuffer(100, 100, [255, 0, 0, 255]);
    const blue = createPngBuffer(100, 100, [0, 0, 255, 255]);
    const screenshotPath = await savePng(red, "test8.png");
    await savePng(blue, "test8.baseline.png");

    const result = await visionAnalyze(screenshotPath);

    // Even with 100% diff, confidence is 0.90 (deterministic = known)
    assert.equal(result.confidence, 0.90);
    assert.ok(result.confidence <= 0.90, "F7: confidence must be ≤ 0.90");
  });

  // --------------------------------------------------------------------------
  // Test 9: Tolerance — within tolerance → no deviation
  // --------------------------------------------------------------------------
  it("within tolerance → no deviation", async () => {
    const baseline = createPngBuffer(100, 100, [255, 0, 0, 255]);
    const modifications = Array.from({ length: 10 }, (_, i) => ({
      pixel: i,
      color: [0, 0, 0, 255] as [number, number, number, number],
    }));
    const modified = createModifiedPng(baseline, modifications);

    const screenshotPath = await savePng(modified, "test9.png");
    await savePng(baseline, "test9.baseline.png");

    const result = await visionAnalyze(screenshotPath, { pixel_tolerance: 100 });

    // 10 pixels < 100 tolerance → no deviation
    assert.equal(result.deviations.length, 0);
    assert.equal(result.metadata.diff_pixels, 10);
  });

  // --------------------------------------------------------------------------
  // Test 10: SHA256 hash is deterministic
  // --------------------------------------------------------------------------
  it("SHA256 hash is deterministic", async () => {
    const buffer = createPngBuffer(100, 100, [255, 0, 0, 255]);
    const screenshotPath = await savePng(buffer, "test10.png");
    await savePng(buffer, "test10.baseline.png");

    const result1 = await visionAnalyze(screenshotPath);
    const result2 = await visionAnalyze(screenshotPath);

    assert.equal(result1.metadata.screenshot_hash, result2.metadata.screenshot_hash);
    assert.ok(result1.metadata.screenshot_hash.match(/^[a-f0-9]{64}$/));
  });
});
