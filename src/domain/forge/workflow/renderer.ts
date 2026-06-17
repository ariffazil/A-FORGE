/**
 * arifOS Workflow Validator — Template Renderer
 *
 * Minimal Liquid-compatible template renderer with STRICT variable checking.
 * Port of Symphony SPEC §5.4 Prompt Template Contract.
 *
 * Supported syntax:
 *   {{ variable.path }}        — variable substitution (strict: unknown = error)
 *   {% if variable %}...{% endif %}  — conditional block
 *
 * Unknown variables MUST fail rendering (SPEC requirement).
 * Unknown filters MUST fail rendering (SPEC requirement).
 *
 * This is intentionally NOT a full Liquid implementation — only what Symphony
 * requires. For richer templating, swap to liquidjs.
 */

import { TemplateParseError, TemplateRenderError } from "./errors.js";

export type TemplateContext = Record<string, unknown>;

/** Reserved tokens that must NEVER be treated as variable references. */
const RESERVED_KEYWORDS = new Set(["true", "false", "null", "nil", "undefined"]);

/**
 * Render a Liquid-compatible template against a strict context.
 *
 * @throws {TemplateParseError} if template syntax is malformed
 * @throws {TemplateRenderError} if a referenced variable is missing or a filter is unknown
 */
export function renderTemplate(
  template: string,
  context: TemplateContext,
  filePath: string | null = null,
): string {
  // Tokenize. We process the template left-to-right.
  let cursor = 0;
  let output = "";

  while (cursor < template.length) {
    const varOpenIdx = template.indexOf("{{", cursor);
    const tagOpenIdx = template.indexOf("{%", cursor);

    // Pick the next construct; if none, emit rest of template.
    const nextIdx = Math.min(
      varOpenIdx === -1 ? Infinity : varOpenIdx,
      tagOpenIdx === -1 ? Infinity : tagOpenIdx,
    );

    if (nextIdx === Infinity) {
      output += template.slice(cursor);
      break;
    }

    // Emit plain text up to the next construct.
    output += template.slice(cursor, nextIdx);

    if (nextIdx === varOpenIdx) {
      // Variable substitution
      const closeIdx = template.indexOf("}}", nextIdx + 2);
      if (closeIdx === -1) {
        throw new TemplateParseError(
          "Unclosed `{{` variable expression",
          filePath,
        );
      }
      const expr = template.slice(nextIdx + 2, closeIdx).trim();
      const value = resolveStrict(expr, context, filePath);
      output += formatValue(value);
      cursor = closeIdx + 2;
    } else {
      // Tag — currently only `{% if VAR %} ... {% endif %}` and `{% else %}`
      const closeIdx = template.indexOf("%}", nextIdx + 2);
      if (closeIdx === -1) {
        throw new TemplateParseError("Unclosed `{%` tag", filePath);
      }
      const tagBody = template.slice(nextIdx + 2, closeIdx).trim();
      const tagResult = processTag(tagBody, template, closeIdx + 2, context, filePath);
      output += tagResult.output;
      cursor = tagResult.nextCursor;
    }
  }

  return output;
}

interface TagResult {
  output: string;
  nextCursor: number;
}

function processTag(
  tagBody: string,
  template: string,
  afterClose: number,
  context: TemplateContext,
  filePath: string | null,
): TagResult {
  // {% if EXPR %} ... {% endif %}
  const ifMatch = /^if\s+(.+)$/.exec(tagBody);
  if (ifMatch) {
    const expr = ifMatch[1]?.trim() ?? "";
    // {% if %} semantics: undefined variable is falsy, NOT an error.
    // Strict checking only applies to {{ var }} substitution.
    const cond = resolveLenient(expr, context);
    const truthy = isTruthy(cond);

    // Find matching {% endif %}, handling optional {% else %}
    const block = collectBlock(template, afterClose, filePath);

    let chosen: string;
    if (truthy) {
      chosen = block.ifContent;
    } else {
      chosen = block.elseContent;
    }
    return { output: renderTemplate(chosen, context, filePath), nextCursor: block.endCursor };
  }

  throw new TemplateParseError(`Unknown tag: {% ${tagBody} %}`, filePath);
}

interface BlockResult {
  ifContent: string;
  elseContent: string;
  endCursor: number;
}

function collectBlock(
  template: string,
  start: number,
  filePath: string | null,
): BlockResult {
  let cursor = start;
  let depth = 1;
  let elseStartIdx = -1; // position of `{%` of `{% else %}` at depth 1
  let elseEndIdx = -1; // position right after `%}` of `{% else %}` at depth 1
  let endifStartIdx = -1; // position of `{%` of outer `{% endif %}`
  let endifEndIdx = -1; // position right after `%}` of outer `{% endif %}`

  while (cursor < template.length) {
    const nextTag = template.indexOf("{%", cursor);
    if (nextTag === -1) {
      throw new TemplateParseError("Unclosed `{% if %}` block — no `{% endif %}` found", filePath);
    }
    const closeIdx = template.indexOf("%}", nextTag + 2);
    if (closeIdx === -1) {
      throw new TemplateParseError("Unclosed `{%` tag inside `{% if %}` block", filePath);
    }
    const tag = template.slice(nextTag + 2, closeIdx).trim();

    if (/^if\s+/.test(tag)) {
      depth++;
      cursor = closeIdx + 2;
      continue;
    }
    if (/^endif$/.test(tag)) {
      depth--;
      if (depth === 0) {
        endifStartIdx = nextTag;
        endifEndIdx = closeIdx + 2;
        break;
      }
      cursor = closeIdx + 2;
      continue;
    }
    if (/^else$/.test(tag) && depth === 1 && elseStartIdx === -1) {
      elseStartIdx = nextTag;
      elseEndIdx = closeIdx + 2;
      cursor = closeIdx + 2;
      continue;
    }
    cursor = closeIdx + 2;
  }

  if (endifStartIdx === -1) {
    throw new TemplateParseError("`{% if %}` block never closed", filePath);
  }

  // ifContent: from `start` (after `{% if %}` close) to either `{% else %}` start or `{% endif %}` start.
  const ifContent =
    elseStartIdx === -1
      ? template.slice(start, endifStartIdx)
      : template.slice(start, elseStartIdx);
  // elseContent: from after `{% else %}` close to `{% endif %}` start.
  const elseContent = elseEndIdx === -1 ? "" : template.slice(elseEndIdx, endifStartIdx);

  return { ifContent, elseContent, endCursor: endifEndIdx };
}

function resolveStrict(
  expr: string,
  context: TemplateContext,
  filePath: string | null,
): unknown {
  const path = expr.trim();

  if (RESERVED_KEYWORDS.has(path)) {
    if (path === "true") return true;
    if (path === "false") return false;
    return null;
  }

  // No filters in this minimal renderer — Symphony allows unknown-filter errors.
  if (path.includes("|")) {
    throw new TemplateRenderError(
      `Filters are not supported in the minimal renderer; got: ${path}`,
      filePath,
    );
  }

  const segments = path.split(".");
  let cursor: unknown = context;
  for (const seg of segments) {
    if (cursor === null || cursor === undefined) {
      throw new TemplateRenderError(
        `Unknown variable or path traversal failed at: ${path}`,
        filePath,
      );
    }
    if (typeof cursor !== "object") {
      throw new TemplateRenderError(
        `Cannot traverse non-object while resolving: ${path}`,
        filePath,
      );
    }
    const obj = cursor as Record<string, unknown>;
    if (!(seg in obj)) {
      throw new TemplateRenderError(`Unknown variable: ${path}`, filePath);
    }
    cursor = obj[seg];
  }
  return cursor;
}

/**
 * Lenient variant for {% if %} conditionals — returns undefined for missing
 * paths instead of throwing. Lets conditionals short-circuit cleanly.
 */
function resolveLenient(expr: string, context: TemplateContext): unknown {
  const path = expr.trim();

  if (RESERVED_KEYWORDS.has(path)) {
    if (path === "true") return true;
    if (path === "false") return false;
    return null;
  }

  if (path.includes("|")) return undefined;

  const segments = path.split(".");
  let cursor: unknown = context;
  for (const seg of segments) {
    if (cursor === null || cursor === undefined) return undefined;
    if (typeof cursor !== "object") return undefined;
    const obj = cursor as Record<string, unknown>;
    if (!(seg in obj)) return undefined;
    cursor = obj[seg];
  }
  return cursor;
}

function isTruthy(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (value === false) return false;
  if (value === 0) return false;
  if (typeof value === "string" && value === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    // Arrays and objects are rendered as compact JSON — better than "[object Object]".
    return JSON.stringify(value);
  }
  return String(value);
}