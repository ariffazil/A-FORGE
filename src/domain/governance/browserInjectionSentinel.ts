/**
 * Browser Injection Sentinel
 *
 * Two-context defense for `forge_browser_*` tools.
 *
 *   CONTEXT A (untrusted)  → page content that suggested an action.
 *   CONTEXT B (trusted)    → agent task / user instruction that authorizes it.
 *
 * Rule: Page content is never authority. Agent task instructions are authority.
 *
 * Every `forge_browser_*` handler must call `checkBrowserSentinel()` before
 * forwarding the call to Playwright MCP. A non-SEAL verdict means the handler
 * returns an error response and does NOT execute the browser action.
 *
 * @constitutional F2 TRUTH — page origin must be trustworthy
 * @constitutional F11 AUDIT — action must serve the agent's task, not the page
 * @constitutional F12 INJECTION — refuse page-originated action payloads
 */

import type { FloorReason } from "./floor-types.js";

export type Severity = "SEAL" | "HOLD" | "VOID";

export interface TaskContext {
  /** Original agent task / user instruction that authorizes browser work. */
  task: string;
  /** Expected outcome after the action completes. */
  expected_outcome?: string;
  /** Source of the task. */
  source?: "agent" | "user" | "kernel";
}

export interface PageContext {
  /** URL of the page that prompted this action. */
  url: string;
  /** Domain of the page origin. */
  origin_domain: string;
  /** Snippet of page text / selector context that suggested the action. */
  snippet?: string;
}

export interface BrowserSentinelArgs {
  tool_name: string;
  url?: string;
  selector?: string;
  text?: string;
  script?: string;
  task_context?: TaskContext;
  page_context?: PageContext;
}

export interface BrowserSentinelVerdict {
  severity: Severity;
  reasons: FloorReason[];
}

/** Domains that are explicitly trusted as task-relevant evidence sources. */
const TRUSTED_DOMAINS = new Set([
  "github.com",
  "arif-fazil.com",
  "docs.arif-fazil.com",
  "wiki.arif-fazil.com",
]);

/** Domains that are explicitly untrusted / high-risk for embedded instructions. */
const UNTRUSTED_DOMAINS = new Set<string>([]);

function normalizeDomain(raw: string): string {
  try {
    const url = raw.startsWith("http") ? new URL(raw) : new URL(`https://${raw}`);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return raw.toLowerCase().trim();
  }
}

function domainTrustTier(domain: string): "trusted" | "untrusted" | "unknown" {
  const d = normalizeDomain(domain);
  if (UNTRUSTED_DOMAINS.has(d)) return "untrusted";
  if (TRUSTED_DOMAINS.has(d)) return "trusted";
  return "unknown";
}

/** Case-insensitive helper: does `haystack` contain any token from `needles`? */
function containsAny(haystack: string, needles: string[]): boolean {
  const h = haystack.toLowerCase();
  return needles.some((n) => n.length > 0 && h.includes(n.toLowerCase()));
}

const STOP_WORDS = new Set([
  "https", "http", "www", "com", "org", "net", "html", "php", "asp",
  "the", "and", "for", "with", "from", "this", "that", "into", "onto",
]);

/** Extract meaningful tokens from a string, skipping URL noise and stop words. */
function extractTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9./_-]+/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^https?:\/\//, "").replace(/^www\./, ""))
    .filter((t) => t.length >= 4 && !STOP_WORDS.has(t));
}

/** Extract hostname/domain from a URL string, or return the string itself. */
function extractDomain(text: string): string | null {
  try {
    const url = new URL(text.startsWith("http") ? text : `https://${text}`);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Extract the action payload (the string most likely supplied by page content). */
function extractActionPayload(args: BrowserSentinelArgs): string {
  const parts: string[] = [];
  if (args.url) parts.push(args.url);
  if (args.selector) parts.push(args.selector);
  if (args.text) parts.push(args.text);
  if (args.script) parts.push(args.script);
  return parts.join(" ");
}

/**
 * F2 TRUTH — Is the page source trustworthy enough to be used as evidence?
 */
function checkSourceTrust(args: BrowserSentinelArgs): FloorReason[] {
  const reasons: FloorReason[] = [];
  const page = args.page_context;
  const task = args.task_context;

  if (!task) {
    // No task authority at all. Page content cannot drive action.
    reasons.push({
      floor: "F2",
      code: "TASK_AUTHORITY_MISSING",
      message: "F2 TRUTH: browser action requires task_context (CONTEXT B) authority; page content alone is not authority",
      severity: "HOLD",
    });
  }

  if (page) {
    const tier = domainTrustTier(page.origin_domain);
    if (tier === "untrusted") {
      reasons.push({
        floor: "F2",
        code: "UNTRUSTED_PAGE_ORIGIN",
        message: `F2 TRUTH: page origin '${page.origin_domain}' is flagged as untrusted`,
        severity: "HOLD",
      });
    } else if (tier === "unknown") {
      // Fail-closed for unknown domains when page context is present.
      reasons.push({
        floor: "F2",
        code: "UNKNOWN_PAGE_ORIGIN",
        message: `F2 TRUTH: page origin '${page.origin_domain}' is not in the trusted allowlist; treat as untrusted evidence`,
        severity: "HOLD",
      });
    }
  }

  return reasons;
}

/**
 * F11 AUDIT — Does the action serve the task, or does it serve page content?
 */
function checkTaskConsistency(args: BrowserSentinelArgs): FloorReason[] {
  const reasons: FloorReason[] = [];
  const task = args.task_context;
  const page = args.page_context;

  if (!task) {
    reasons.push({
      floor: "F11",
      code: "TASK_UNKNOWN",
      message: "F11 AUDIT: cannot verify task consistency without task_context",
      severity: "HOLD",
    });
    return reasons;
  }

  const taskText = [task.task, task.expected_outcome ?? ""].join(" ").toLowerCase();
  const payload = extractActionPayload(args).toLowerCase();

  // Task alignment: action must be plausibly reachable from the task.
  // We accept alignment if any of these hold:
  //   1. Payload is empty (e.g. screenshot with no selector).
  //   2. The target domain appears in the task.
  //   3. Any meaningful token from the payload appears in the task.
  //   4. Any meaningful token from the task appears in the payload.
  const payloadTokens = extractTokens(payload);
  const taskTokens = extractTokens(taskText);
  const payloadDomain = args.url ? extractDomain(args.url) : null;
  const domainAligned = payloadDomain ? taskText.includes(payloadDomain) : false;
  const tokenAligned =
    payloadTokens.length === 0 ||
    payloadTokens.some((t) => taskText.includes(t)) ||
    taskTokens.some((t) => payload.includes(t));
  const taskAligned = domainAligned || tokenAligned;

  // If page context includes a snippet, ensure the action is not merely copying it.
  if (page?.snippet) {
    const snippet = page.snippet.toLowerCase();
    const pageDrivesAction =
      payload.length > 0 &&
      snippet.length > 0 &&
      (snippet.includes(payload) || payload.includes(snippet));
    const taskAuthorizesSnippet = taskText.includes(snippet);

    if (pageDrivesAction && !taskAuthorizesSnippet) {
      reasons.push({
        floor: "F11",
        code: "PAGE_DRIVEN_ACTION",
        message: "F11 AUDIT: action payload mirrors page snippet but is not authorized by task",
        severity: "HOLD",
      });
    }
  }

  return reasons;
}

/**
 * F12-style injection check — refuse when typed/evaluated content reproduces
 * page text that the task did not request.
 *
 * This check is intentionally scoped to text/script inputs (type, evaluate_js)
 * because those are the surfaces where a page can inject commands. URLs and
 * selectors matching page text are normal browser navigation, not injection.
 */
function checkPageOriginatedPayload(args: BrowserSentinelArgs): FloorReason[] {
  const reasons: FloorReason[] = [];
  const task = args.task_context;
  const page = args.page_context;

  if (!page?.snippet) return reasons;

  const snippet = page.snippet.toLowerCase().trim();
  if (snippet.length === 0) return reasons;

  // Only typed text or evaluated scripts can carry injected instructions.
  const injectablePayload = (args.text ?? args.script ?? "").toLowerCase();
  if (injectablePayload.length === 0) return reasons;

  // Ignore very short snippets that are likely UI labels (e.g. "Submit").
  if (snippet.length < 12) return reasons;

  // If a significant chunk of the typed/evaluated payload is verbatim page text,
  // and the task did not ask for that text, this is a prompt-injection pattern.
  const taskText = task ? [task.task, task.expected_outcome ?? ""].join(" ").toLowerCase() : "";
  const payloadMirrorsPage = injectablePayload.includes(snippet) || snippet.includes(injectablePayload);
  const taskRequestedText = taskText.includes(snippet);

  if (payloadMirrorsPage && !taskRequestedText) {
    reasons.push({
      floor: "F12",
      code: "PAGE_ORIGINATED_ACTION",
      message: "F12 INJECTION: browser action reproduces page content not authorized by task",
      severity: "VOID",
    });
  }

  return reasons;
}

function composeVerdict(reasons: FloorReason[]): BrowserSentinelVerdict {
  if (reasons.some((r) => r.severity === "VOID")) {
    return { severity: "VOID", reasons };
  }
  if (reasons.some((r) => r.severity === "HOLD")) {
    return { severity: "HOLD", reasons };
  }
  return { severity: "SEAL", reasons };
}

/**
 * Main entry point. Called by every `forge_browser_*` handler before forwarding
 * to Playwright MCP.
 */
export function checkBrowserSentinel(args: BrowserSentinelArgs): BrowserSentinelVerdict {
  const reasons: FloorReason[] = [];
  reasons.push(...checkSourceTrust(args));
  reasons.push(...checkTaskConsistency(args));
  reasons.push(...checkPageOriginatedPayload(args));
  return composeVerdict(reasons);
}

/**
 * Convert a sentinel verdict into a gateway error response.
 */
export function browserSentinelErrorResponse(
  request_id: string,
  verdict: BrowserSentinelVerdict,
): { content: Array<{ type: "text"; text: string }>; isError: true } {
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        request_id,
        status: verdict.severity,
        gate: "BROWSER_INJECTION_SENTINEL",
        reasons: verdict.reasons.map((r) => ({
          floor: r.floor,
          code: r.code,
          severity: r.severity,
          message: r.message,
        })),
      }, null, 2),
    }],
    isError: true,
  };
}
