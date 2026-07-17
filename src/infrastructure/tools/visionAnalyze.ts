/**
 * @file visionAnalyze.ts — W₁ Vision Witness (Pixel-Level Evidence)
 * @description Deterministic pixel diff against baseline screenshots.
 *              When baseline exists: pixelmatch for exact pixel comparison.
 *              When no baseline: returns empty (VLM fallback is separate).
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 *
 * F2 TRUTH: All deviations labeled OBS (directly observed pixel diff).
 * F7 HUMILITY: Confidence capped at 0.90.
 * F9 ANTI-HANTU: No semantic interpretation. Pure pixel math.
 *
 * @author arifOS Federation
 * @version 1.0.0
 */

import { readFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import type { Deviation } from "./ForgeVisualQA.js";

// ============================================================================
// TYPES
// ============================================================================

export interface VisionConstraints {
  max_nav_links?: number;
  min_contrast_ratio?: number;
  required_elements?: string[];
  max_deviation_score?: number;
  pixel_threshold?: number;       // pixelmatch threshold (0-1, default 0.1)
  pixel_tolerance?: number;       // max allowed differing pixels (default 100)
}

export interface VisionResult {
  deviations: Deviation[];
  confidence: number;
  metadata: {
    total_pixels: number;
    diff_pixels: number;
    diff_percentage: number;
    baseline_used: boolean;
    screenshot_hash: string;
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function sha256Hex(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function loadPng(buffer: Buffer): PNG {
  return PNG.sync.read(buffer);
}

// ============================================================================
// VISION ANALYZE — W₁ Pixel-Level Evidence
// ============================================================================

/**
 * W₁ Vision Witness — deterministic pixel diff against baseline.
 *
 * When a baseline screenshot exists:
 *   - Loads both screenshots as PNG
 *   - Computes pixel-level diff using pixelmatch
 *   - Returns deviations based on diff count
 *
 * When no baseline exists:
 *   - Returns empty deviations (no diff possible)
 *   - Confidence 0.50 (UNKNOWN — no baseline to compare against)
 *
 * This is NOT a VLM. This is pixel math. No semantic interpretation.
 * The VLM path is a separate dependency for when no baseline exists.
 */
export async function visionAnalyze(
  screenshotPath: string,
  constraints: VisionConstraints = {},
): Promise<VisionResult> {
  const threshold = constraints.pixel_threshold ?? 0.1;
  const tolerance = constraints.pixel_tolerance ?? 100;

  // Load screenshot
  let screenshotBuffer: Buffer;
  try {
    screenshotBuffer = await readFile(screenshotPath);
  } catch (err) {
    return {
      deviations: [{
        type: "SCREENSHOT_LOAD_FAILED",
        severity: "CRITICAL",
        description: `Cannot read screenshot: ${err instanceof Error ? err.message : String(err)}`,
        epistemic_label: "OBS",
      }],
      confidence: 0,
      metadata: {
        total_pixels: 0,
        diff_pixels: 0,
        diff_percentage: 0,
        baseline_used: false,
        screenshot_hash: sha256Hex(Buffer.from("invalid")),
      },
    };
  }

  const screenshotHash = sha256Hex(screenshotBuffer);

  // Look for baseline
  const baselinePath = screenshotPath.replace(/\.png$/i, ".baseline.png");
  const baselineExists = await fileExists(baselinePath);

  if (!baselineExists) {
    // No baseline — return empty (no diff possible)
    // VLM fallback is a separate concern
    const screenshot = loadPng(screenshotBuffer);
    const totalPixels = screenshot.width * screenshot.height;

    return {
      deviations: [],
      confidence: 0.50,  // UNKNOWN — no baseline to compare
      metadata: {
        total_pixels: totalPixels,
        diff_pixels: 0,
        diff_percentage: 0,
        baseline_used: false,
        screenshot_hash: screenshotHash,
      },
    };
  }

  // Load baseline
  let baselineBuffer: Buffer;
  try {
    baselineBuffer = await readFile(baselinePath);
  } catch (err) {
    return {
      deviations: [{
        type: "BASELINE_LOAD_FAILED",
        severity: "HIGH",
        description: `Cannot read baseline: ${err instanceof Error ? err.message : String(err)}`,
        epistemic_label: "OBS",
      }],
      confidence: 0,
      metadata: {
        total_pixels: 0,
        diff_pixels: 0,
        diff_percentage: 0,
        baseline_used: false,
        screenshot_hash: screenshotHash,
      },
    };
  }

  const screenshot = loadPng(screenshotBuffer);
  const baseline = loadPng(baselineBuffer);

  // Dimension mismatch
  if (screenshot.width !== baseline.width || screenshot.height !== baseline.height) {
    return {
      deviations: [{
        type: "DIMENSION_MISMATCH",
        severity: "HIGH",
        description: `Screenshot ${screenshot.width}x${screenshot.height} ≠ baseline ${baseline.width}x${baseline.height}`,
        expected: `${baseline.width}x${baseline.height}`,
        actual: `${screenshot.width}x${screenshot.height}`,
        epistemic_label: "OBS",
      }],
      confidence: 0.85,
      metadata: {
        total_pixels: screenshot.width * screenshot.height,
        diff_pixels: -1,
        diff_percentage: -1,
        baseline_used: true,
        screenshot_hash: screenshotHash,
      },
    };
  }

  // Pixel diff
  const totalPixels = screenshot.width * screenshot.height;
  const diffImage = new PNG({ width: screenshot.width, height: screenshot.height });

  const diffPixels = pixelmatch(
    screenshot.data,
    baseline.data,
    diffImage.data,
    screenshot.width,
    screenshot.height,
    { threshold },
  );

  const diffPercentage = (diffPixels / totalPixels) * 100;

  // Generate deviations based on diff count
  const deviations: Deviation[] = [];

  if (diffPixels > tolerance) {
    // Classify severity by diff magnitude
    let severity: Deviation["severity"];
    if (diffPercentage > 20) {
      severity = "CRITICAL";
    } else if (diffPercentage > 5) {
      severity = "HIGH";
    } else if (diffPercentage > 1) {
      severity = "MEDIUM";
    } else {
      severity = "LOW";
    }

    deviations.push({
      type: "PIXEL_DIFF_EXCEEDED",
      severity,
      description: `${diffPixels} pixels differ (${diffPercentage.toFixed(2)}%), tolerance is ${tolerance}`,
      expected: `≤ ${tolerance} pixels`,
      actual: `${diffPixels} pixels`,
      epistemic_label: "OBS",
    });
  }

  // Confidence: 0.90 when baseline used (deterministic = known), capped per F7
  const confidence = 0.90;

  return {
    deviations,
    confidence,
    metadata: {
      total_pixels: totalPixels,
      diff_pixels: diffPixels,
      diff_percentage: diffPercentage,
      baseline_used: true,
      screenshot_hash: screenshotHash,
    },
  };
}
