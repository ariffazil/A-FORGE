/**
 * @file domLinter.ts — W₂ Structural Witness (Deterministic)
 * @description Parses HTML and checks structural/a11y constraints.
 *              100% deterministic — no model involvement.
 *              Confidence always 0.90 (deterministic = known).
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 *
 * F2 TRUTH: All deviations labeled OBS (directly observable).
 * F7 HUMILITY: Confidence capped at 0.90.
 *
 * @author arifOS Federation
 * @version 1.0.0
 */

import * as parse5 from "parse5";
import type { Deviation } from "./ForgeVisualQA.js";

// ============================================================================
// TYPES
// ============================================================================

export interface DomLinterConstraints {
  max_nav_links?: number;
  required_elements?: string[];
  min_contrast_ratio?: number;
  max_depth?: number;
  banned_elements?: string[];
  require_alt_on_images?: boolean;
  require_aria_labels?: boolean;
}

export interface DomLinterResult {
  deviations: Deviation[];
  confidence: number;
}

// ============================================================================
// DOM TRAVERSAL HELPERS
// ============================================================================

type Parse5Node = {
  nodeName: string;
  tagName?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: Parse5Node[];
  parentNode?: Parse5Node;
};

function walkNodes(node: Parse5Node, fn: (node: Parse5Node) => void): void {
  fn(node);
  if (node.childNodes) {
    for (const child of node.childNodes) {
      walkNodes(child, fn);
    }
  }
}

function findElements(doc: Parse5Node, tagName: string): Parse5Node[] {
  const results: Parse5Node[] = [];
  walkNodes(doc, (node) => {
    if (node.tagName === tagName) {
      results.push(node);
    }
  });
  return results;
}

function getAttr(node: Parse5Node, name: string): string | undefined {
  return node.attrs?.find(a => a.name === name)?.value;
}

function countDescendants(node: Parse5Node, tagName: string): number {
  let count = 0;
  walkNodes(node, (n) => {
    if (n.tagName === tagName) count++;
  });
  return count;
}

function getElementDepth(node: Parse5Node): number {
  let depth = 0;
  let current = node.parentNode;
  while (current) {
    depth++;
    current = current.parentNode;
  }
  return depth;
}

// ============================================================================
// A11Y CHECKS (Deterministic)
// ============================================================================

function checkAccessibility(
  doc: Parse5Node,
  constraints: DomLinterConstraints,
): Deviation[] {
  const deviations: Deviation[] = [];

  // Check images for alt text
  if (constraints.require_alt_on_images !== false) {
    const images = findElements(doc, "img");
    for (const img of images) {
      const alt = getAttr(img, "alt");
      if (alt === undefined) {
        deviations.push({
          type: "MISSING_ALT_TEXT",
          severity: "HIGH",
          description: "Image element missing alt attribute",
          element: "img",
          epistemic_label: "OBS",
        });
      } else if (alt === "") {
        const role = getAttr(img, "role");
        if (role !== "presentation" && role !== "none") {
          deviations.push({
            type: "EMPTY_ALT_TEXT",
            severity: "MEDIUM",
            description: "Image has empty alt text without presentation role",
            element: "img",
            epistemic_label: "OBS",
          });
        }
      }
    }
  }

  // Check interactive elements for aria labels
  if (constraints.require_aria_labels !== false) {
    const interactiveElements = ["button", "a", "input", "select", "textarea"];
    for (const tagName of interactiveElements) {
      const elements = findElements(doc, tagName);
      for (const elem of elements) {
        const ariaLabel = getAttr(elem, "aria-label");
        const ariaLabelledBy = getAttr(elem, "aria-labelledby");
        const title = getAttr(elem, "title");

        // Skip if has any accessible name
        if (ariaLabel || ariaLabelledBy || title) continue;

        // Skip links with text content (simplified check)
        if (tagName === "a" && elem.childNodes && elem.childNodes.length > 0) continue;

        // Skip inputs with type="hidden"
        if (tagName === "input" && getAttr(elem, "type") === "hidden") continue;

        deviations.push({
          type: "MISSING_ACCESSIBLE_NAME",
          severity: "HIGH",
          description: `Interactive <${tagName}> has no accessible name (aria-label, aria-labelledby, or title)`,
          element: tagName,
          epistemic_label: "OBS",
        });
      }
    }
  }

  // Check buttons for type attribute
  const buttons = findElements(doc, "button");
  for (const btn of buttons) {
    const type = getAttr(btn, "type");
    if (!type) {
      deviations.push({
        type: "MISSING_BUTTON_TYPE",
        severity: "LOW",
        description: "Button element missing type attribute (defaults to 'submit')",
        element: "button",
        epistemic_label: "OBS",
      });
    }
  }

  // Check for tabindex > 0 (anti-pattern)
  const allElements: Parse5Node[] = [];
  walkNodes(doc, (node) => {
    if (node.tagName) allElements.push(node);
  });

  for (const elem of allElements) {
    const tabindex = getAttr(elem, "tabindex");
    if (tabindex && parseInt(tabindex, 10) > 0) {
      deviations.push({
        type: "POSITIVE_TABINDEX",
        severity: "MEDIUM",
        description: `Element has tabindex="${tabindex}" — positive tabindex disrupts natural tab order`,
        element: elem.tagName ?? "unknown",
        epistemic_label: "OBS",
      });
    }
  }

  return deviations;
}

// ============================================================================
// STRUCTURAL CHECKS
// ============================================================================

function checkStructure(
  doc: Parse5Node,
  constraints: DomLinterConstraints,
): Deviation[] {
  const deviations: Deviation[] = [];

  // Required elements
  if (constraints.required_elements) {
    for (const elem of constraints.required_elements) {
      const found = findElements(doc, elem);
      if (found.length === 0) {
        deviations.push({
          type: "MISSING_REQUIRED_ELEMENT",
          severity: "HIGH",
          description: `Required element <${elem}> not found in DOM`,
          element: elem,
          epistemic_label: "OBS",
        });
      }
    }
  }

  // Nav link count
  if (constraints.max_nav_links !== undefined) {
    const navElements = findElements(doc, "nav");
    for (const nav of navElements) {
      const links = countDescendants(nav, "a");
      if (links > constraints.max_nav_links) {
        deviations.push({
          type: "NAV_LINK_COUNT_EXCEEDED",
          severity: "MEDIUM",
          description: `Navigation has ${links} links, max is ${constraints.max_nav_links}`,
          element: "nav",
          expected: String(constraints.max_nav_links),
          actual: String(links),
          epistemic_label: "OBS",
        });
      }
    }
  }

  // Banned elements
  if (constraints.banned_elements) {
    for (const elem of constraints.banned_elements) {
      const found = findElements(doc, elem);
      if (found.length > 0) {
        deviations.push({
          type: "BANNED_ELEMENT_PRESENT",
          severity: "HIGH",
          description: `Banned element <${elem}> found in DOM (${found.length} instances)`,
          element: elem,
          epistemic_label: "OBS",
        });
      }
    }
  }

  // Max depth
  if (constraints.max_depth !== undefined) {
    let maxFound = 0;
    walkNodes(doc, (node) => {
      if (node.tagName) {
        const depth = getElementDepth(node);
        if (depth > maxFound) maxFound = depth;
      }
    });
    if (maxFound > constraints.max_depth) {
      deviations.push({
        type: "DOM_DEPTH_EXCEEDED",
        severity: "LOW",
        description: `DOM depth is ${maxFound}, max is ${constraints.max_depth}`,
        expected: String(constraints.max_depth),
        actual: String(maxFound),
        epistemic_label: "OBS",
      });
    }
  }

  return deviations;
}

// ============================================================================
// MAIN LINTER
// ============================================================================

/**
 * W₂ Structural Witness — deterministic DOM linting.
 *
 * No model involvement. Pure HTML parsing + rule checking.
 * Confidence always 0.90 (deterministic = known).
 */
export async function domLinter(
  domPayload: string,
  constraints: DomLinterConstraints = {},
): Promise<DomLinterResult> {
  const doc = parse5.parse(domPayload) as unknown as Parse5Node;

  const a11yDeviations = checkAccessibility(doc, constraints);
  const structuralDeviations = checkStructure(doc, constraints);

  return {
    deviations: [...structuralDeviations, ...a11yDeviations],
    confidence: 0.90,  // Deterministic = known
  };
}
