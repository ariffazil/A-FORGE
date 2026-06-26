/**
 * Multi-Agent Role Routing — Task-division roles for the arifOS federation.
 *
 * Replaces the single generic "worker" profile with specialized roles:
 *   planner — decomposes tasks, designs approach, identifies risks
 *   implementer — writes code, creates files, applies patches
 *   reviewer — inspects changes, checks correctness, style, conventions
 *   tester — runs tests, validates behavior, reports failures
 *   security — audits for secrets, injection, unsafe patterns, CVEs
 *   release — validates deploy readiness, rollback plans, changelog
 *
 * Each role has:
 *   - a system prompt that shapes agent behavior
 *   - a scoped tool set (least privilege)
 *   - a budget ceiling
 *   - a task classifier that can assign subtasks to this role
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given.
 */

import type { AgentModeName, AgentProfile } from "../types/agent.js";

// ── TaskRole ────────────────────────────────────────────────────────────

export type TaskRole =
  | "planner"
  | "implementer"
  | "reviewer"
  | "tester"
  | "security"
  | "release";

export const ALL_TASK_ROLES: TaskRole[] = [
  "planner",
  "implementer",
  "reviewer",
  "tester",
  "security",
  "release",
];

// ── Role Profiles ───────────────────────────────────────────────────────

export function buildRoleProfile(role: TaskRole, modeName: AgentModeName): AgentProfile {
  switch (role) {
    case "planner":
      return buildPlannerProfile(modeName);
    case "implementer":
      return buildImplementerProfile(modeName);
    case "reviewer":
      return buildReviewerProfile(modeName);
    case "tester":
      return buildTesterProfile(modeName);
    case "security":
      return buildSecurityProfile(modeName);
    case "release":
      return buildReleaseProfile(modeName);
  }
}

function buildPlannerProfile(modeName: AgentModeName): AgentProfile {
  return {
    name: "planner",
    systemPrompt: [
      "You are the PLANNER agent in a governed multi-agent coding pipeline.",
      "Your job: decompose the task into concrete, ordered steps.",
      "",
      "Rules:",
      "- Identify files to inspect before proposing changes",
      "- Flag irreversible actions (deletes, deploys, schema changes)",
      "- Propose rollback path for each change",
      "- Estimate confidence per step (0.0–1.0)",
      "- If confidence < 0.6 on any step, flag it for human review",
      "- Never write code. Only plan.",
      "",
      "Output format: JSON array of steps with {order, action, target, confidence, rollback, risk_level}",
    ].join("\n"),
    allowedTools: ["list_files", "read_file", "grep_text"],
    budget: { tokenCeiling: 15_000, maxTurns: 6 },
    modeName,
  };
}

function buildImplementerProfile(modeName: AgentModeName): AgentProfile {
  return {
    name: "implementer",
    systemPrompt: [
      "You are the IMPLEMENTER agent in a governed multi-agent coding pipeline.",
      "Your job: execute the assigned plan step — write code, create files, apply patches.",
      "",
      "Rules:",
      "- Follow the plan exactly. Do not deviate.",
      "- Write minimal, focused changes.",
      "- After each file change, report what you changed and why.",
      "- If the plan says HOLD or 888_HOLD on a step, STOP and report.",
      "- If you discover the plan is wrong, STOP and report — do not improvise.",
      "",
      "Output: report of files changed, lines added/removed, any deviations from plan.",
    ].join("\n"),
    allowedTools: ["list_files", "read_file", "write_file", "grep_text", "run_tests"],
    budget: { tokenCeiling: 25_000, maxTurns: 10 },
    modeName,
  };
}

function buildReviewerProfile(modeName: AgentModeName): AgentProfile {
  return {
    name: "reviewer",
    systemPrompt: [
      "You are the REVIEWER agent in a governed multi-agent coding pipeline.",
      "Your job: inspect changes for correctness, style, conventions, and intent alignment.",
      "",
      "Rules:",
      "- Read every changed file in full",
      "- Check: does the change match the stated intent?",
      "- Check: are there off-by-one errors, missing null checks, type mismatches?",
      "- Check: does it follow the repo's existing conventions?",
      "- Check: are there edge cases not handled?",
      "- Output a structured review: APPROVED | CHANGES_REQUESTED | BLOCKED",
      "- For CHANGES_REQUESTED: list each issue with file:line and fix suggestion",
      "- For BLOCKED: explain why (security, correctness, constitutional)",
      "",
      "Output: JSON {verdict, issues[], summary}",
    ].join("\n"),
    allowedTools: ["list_files", "read_file", "grep_text"],
    budget: { tokenCeiling: 20_000, maxTurns: 8 },
    modeName,
  };
}

function buildTesterProfile(modeName: AgentModeName): AgentProfile {
  return {
    name: "tester",
    systemPrompt: [
      "You are the TESTER agent in a governed multi-agent coding pipeline.",
      "Your job: run tests, validate behavior, report pass/fail with details.",
      "",
      "Rules:",
      "- Run the project's test suite",
      "- If no tests exist, report that as a risk (do not write tests unless asked)",
      "- For each failure: report test name, expected vs actual, likely root cause",
      "- If all pass, report coverage gaps if visible",
      "- Never modify source code. Only run tests and report.",
      "",
      "Output: JSON {passed, failed, failures[], coverage_notes, risk_summary}",
    ].join("\n"),
    allowedTools: ["list_files", "read_file", "run_tests", "grep_text"],
    budget: { tokenCeiling: 12_000, maxTurns: 5 },
    modeName,
  };
}

function buildSecurityProfile(modeName: AgentModeName): AgentProfile {
  return {
    name: "security",
    systemPrompt: [
      "You are the SECURITY AUDITOR agent in a governed multi-agent coding pipeline.",
      "Your job: audit changes for security issues before they ship.",
      "",
      "Rules:",
      "- Scan changed files for: hardcoded secrets, injection vectors, unsafe deserialization",
      "- Check: are credentials scoped to least privilege?",
      "- Check: are user inputs sanitized?",
      "- Check: are there SQL injection, path traversal, command injection risks?",
      "- Check: does any change expand the attack surface?",
      "- If CRITICAL issue found: BLOCK with 888_HOLD recommendation",
      "- If HIGH issue found: flag for human review",
      "",
      "Output: JSON {verdict, findings[], severity_counts, recommendation}",
    ].join("\n"),
    allowedTools: ["list_files", "read_file", "grep_text"],
    budget: { tokenCeiling: 15_000, maxTurns: 6 },
    modeName,
  };
}

function buildReleaseProfile(modeName: AgentModeName): AgentProfile {
  return {
    name: "release",
    systemPrompt: [
      "You are the RELEASE CONTROLLER agent in a governed multi-agent coding pipeline.",
      "Your job: validate that changes are ready to ship.",
      "",
      "Rules:",
      "- Verify all prior agents (reviewer, tester, security) have APPROVED",
      "- Check: is the changelog accurate?",
      "- Check: is the rollback plan clear and tested?",
      "- Check: are there any open 888_HOLD flags?",
      "- If any gate failed: BLOCK release",
      "- If all gates pass: recommend SEAL (ready to ship)",
      "",
      "Output: JSON {verdict, gates_passed[], gates_failed[], rollback_plan, changelog_summary}",
    ].join("\n"),
    allowedTools: ["list_files", "read_file", "grep_text"],
    budget: { tokenCeiling: 10_000, maxTurns: 4 },
    modeName,
  };
}

// ── Task Classifier ─────────────────────────────────────────────────────

/**
 * Classify a subtask description into the most appropriate TaskRole.
 *
 * Uses keyword matching (no LLM call — deterministic, fast, auditable).
 * Returns the best-fit role. Defaults to "implementer" if unclear.
 */
export function classifyTaskRole(taskDescription: string): TaskRole {
  const t = taskDescription.toLowerCase();

  // Planning signals
  if (
    t.includes("plan") || t.includes("design") || t.includes("architect") ||
    t.includes("decompose") || t.includes("break down") || t.includes("approach") ||
    t.includes("strategy") || t.includes("identify risks") || t.includes("scope")
  ) {
    return "planner";
  }

  // Testing signals
  if (
    t.includes("test") || t.includes("verify") || t.includes("validate") ||
    t.includes("run tests") || t.includes("check behavior") || t.includes("assert") ||
    t.includes("coverage") || t.includes("regression")
  ) {
    return "tester";
  }

  // Security signals
  if (
    t.includes("security") || t.includes("audit") || t.includes("vulnerability") ||
    t.includes("secret") || t.includes("injection") || t.includes("cve") ||
    t.includes("sanitiz") || t.includes("encrypt") || t.includes("auth") ||
    t.includes("permission") || t.includes("credential")
  ) {
    return "security";
  }

  // Review signals
  if (
    t.includes("review") || t.includes("inspect") || t.includes("check quality") ||
    t.includes("code review") || t.includes("style") || t.includes("convention") ||
    t.includes("lint") || t.includes("refactor") || t.includes("clean up")
  ) {
    return "reviewer";
  }

  // Release signals
  if (
    t.includes("release") || t.includes("deploy") || t.includes("ship") ||
    t.includes("changelog") || t.includes("rollback") || t.includes("production") ||
    t.includes("merge") || t.includes("tag")
  ) {
    return "release";
  }

  // Default: implementer (write code, create files, apply changes)
  return "implementer";
}

// ── Role Router ─────────────────────────────────────────────────────────

export interface RoutedSubtask {
  role: TaskRole;
  task: string;
  profile: AgentProfile;
  order: number;
}

/**
 * Route a set of subtask descriptions to their appropriate roles.
 *
 * Each subtask is classified, assigned a role-specific profile,
 * and ordered by execution sequence (planner first, release last).
 */
export function routeSubtasks(
  subtasks: Array<{ name: string; task: string }>,
  modeName: AgentModeName,
): RoutedSubtask[] {
  const routed: RoutedSubtask[] = subtasks.map((st, i) => {
    const role = classifyTaskRole(st.task);
    return {
      role,
      task: st.task,
      profile: buildRoleProfile(role, modeName),
      order: i,
    };
  });

  // Sort by role priority: planner → implementer → reviewer → tester → security → release
  const ROLE_ORDER: Record<TaskRole, number> = {
    planner: 0,
    implementer: 1,
    reviewer: 2,
    tester: 3,
    security: 4,
    release: 5,
  };

  routed.sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
  return routed;
}

/**
 * Build a role-annotated task prompt that tells the agent its role context.
 */
export function buildRolePrompt(routed: RoutedSubtask): string {
  return [
    `[ROLE: ${routed.role.toUpperCase()}]`,
    `[ORDER: ${routed.order}]`,
    "",
    routed.task,
  ].join("\n");
}
