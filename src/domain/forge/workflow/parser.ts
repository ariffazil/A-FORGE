/**
 * arifOS Workflow Validator — Parser
 *
 * Parses Markdown + YAML front matter from a workflow file.
 * Port of Symphony SPEC §5.2 File Format to TypeScript.
 *
 * Parsing rules (verbatim from SPEC):
 *   - If file starts with `---`, parse lines until next `---` as YAML front matter
 *   - Remaining lines become the prompt body
 *   - If front matter absent, treat entire file as prompt body, config = {}
 *   - YAML front matter MUST decode to a map/object; non-map is an error
 *   - Prompt body is trimmed before use
 *
 * Returns { config, prompt_template } per SPEC §5.2.
 */

import { parse as parseYaml } from "yaml";
import {
  WorkflowParseError,
  WorkflowFrontMatterNotAMapError,
} from "./errors.js";

export interface ParsedWorkflow {
  /** Raw config map (will be schema-validated separately). */
  config: Record<string, unknown>;
  /** Trimmed Markdown body (the prompt template). */
  promptTemplate: string;
}

const FRONT_MATTER_DELIM = "---";

/**
 * Parse the front matter + body split from a workflow file string.
 *
 * @throws {WorkflowParseError} if front matter delimiters are malformed
 * @throws {WorkflowFrontMatterNotAMapError} if YAML decodes to non-map
 */
export function parseWorkflowFile(content: string, filePath: string | null): ParsedWorkflow {
  const trimmed = content.trimStart();

  // No front matter → whole file is prompt body, empty config.
  if (!trimmed.startsWith(FRONT_MATTER_DELIM)) {
    return { config: {}, promptTemplate: trimmed.trim() };
  }

  // Strip the leading `---` and find the closing `---`.
  const afterOpening = trimmed.slice(FRONT_MATTER_DELIM.length);
  // Allow newline right after `---`.
  const normalized = afterOpening.startsWith("\n") ? afterOpening.slice(1) : afterOpening;

  // Find the closing `---` at the start of a line.
  const lines = normalized.split("\n");
  let closingLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    if (line.trim() === FRONT_MATTER_DELIM) {
      closingLineIdx = i;
      break;
    }
  }

  if (closingLineIdx === -1) {
    throw new WorkflowParseError(
      filePath,
      new Error("closing `---` delimiter not found"),
      "Ensure YAML front matter is wrapped between two `---` lines.",
    );
  }

  const yamlText = lines.slice(0, closingLineIdx).join("\n");
  const bodyText = lines.slice(closingLineIdx + 1).join("\n");

  let parsed: unknown;
  try {
    parsed = parseYaml(yamlText);
  } catch (e) {
    throw new WorkflowParseError(filePath, e, "YAML front matter failed to parse.");
  }

  if (parsed === null || parsed === undefined) {
    // Empty front matter is allowed; SPEC says config = {}.
    return { config: {}, promptTemplate: bodyText.trim() };
  }

  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new WorkflowFrontMatterNotAMapError(
      filePath,
      Array.isArray(parsed) ? "array" : typeof parsed,
    );
  }

  return {
    config: parsed as Record<string, unknown>,
    promptTemplate: bodyText.trim(),
  };
}

/**
 * Load and parse a workflow file from disk.
 *
 * @throws {MissingWorkflowFileError} if file does not exist or cannot be read
 */
export async function loadWorkflowFile(filePath: string): Promise<ParsedWorkflow> {
  const fs = await import("node:fs/promises");
  let content: string;
  try {
    content = await fs.readFile(filePath, "utf-8");
  } catch (e) {
    const { MissingWorkflowFileError } = await import("./errors.js");
    throw new MissingWorkflowFileError(filePath);
  }
  return parseWorkflowFile(content, filePath);
}