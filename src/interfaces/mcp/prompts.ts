/**
 * A-FORGE MCP Prompts — Guided workflow surfaces
 *
 * Exposes MCP prompts for common engineering workflows.
 * Clients can call prompts/list to discover guided workflows,
 * then prompts/get with arguments to get structured guidance.
 *
 * @module mcp/prompts
 * @constitutional F4 CLARITY — prompts reduce entropy by structuring intent
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPrompts(server: McpServer): void {
  // ── Fix Bug ──────────────────────────────────────────────────────────
  server.prompt(
    "fix-bug",
    "Structured bug-fix workflow: diagnose → reproduce → fix → verify",
    {
      description: z.string().describe("What is the bug? Include error messages, steps to reproduce"),
      file_context: z.string().optional().describe("Relevant file paths or code snippets"),
    },
    (args) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Bug to fix: ${args.description}${args.file_context ? `\nRelevant context: ${args.file_context}` : ""}

Follow this workflow:
1. REPRODUCE — Use forge_shell_dryrun to reproduce the bug. Capture the exact error.
2. DIAGNOSE — Use forge_file to read relevant files. Identify root cause.
3. FIX — Apply the minimal fix. Prefer forge_file (edit) over forge_run (shell).
4. VERIFY — Run tests with forge_run. Confirm the bug is gone.
5. LOG — Record the fix in forge_work/.

Constitutional gates:
- F1 AMANAH: Backup before edit (git stash or forge_file read first)
- F2 TRUTH: Label your confidence (OBS/DER/INT/SPEC)
- F4 CLARITY: Minimal fix only, no scope creep`,
          },
        },
      ],
    }),
  );

  // ── Refactor Module ──────────────────────────────────────────────────
  server.prompt(
    "refactor-module",
    "Structured refactoring workflow: analyze → plan → refactor → verify",
    {
      module_path: z.string().describe("Path to the module or file to refactor"),
      goal: z.string().describe("What improvement? (reduce complexity, extract functions, improve naming)"),
    },
    (args) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Refactor target: ${args.module_path}
Goal: ${args.goal}

Follow this workflow:
1. ANALYZE — Use forge_file to read the module. Understand current structure.
2. PLAN — State what you will change and why. No hidden refactors.
3. REFACTOR — Apply changes with forge_file (edit). One logical change at a time.
4. VERIFY — Run tests with forge_run. No regressions allowed.
5. DIFF — Show before/after with forge_git (diff). Confirm scope.

Constitutional gates:
- F1 AMANAH: Every change reversible (git stash before)
- F4 CLARITY: ΔS ≤ 0 — the result must be cleaner, not just different
- F7 HUMILITY: If the refactor makes things worse, revert and report`,
          },
        },
      ],
    }),
  );

  // ── Deploy Service ───────────────────────────────────────────────────
  server.prompt(
    "deploy-service",
    "Structured deployment workflow: build → test → stage → deploy → verify",
    {
      service: z.string().describe("Service name or path to deploy"),
      target: z.string().describe("Deployment target (docker, systemd, cloudflare)"),
    },
    (args) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Deploy: ${args.service} → ${args.target}

Follow this workflow:
1. BUILD — Use forge_run to build the service. Must pass.
2. TEST — Use forge_run to run tests. All must pass.
3. STAGE — Use forge_docker or forge_run to stage. Verify health.
4. DEPLOY — Requires 888_HOLD. Use forge_lease to request deployment lease.
5. VERIFY — Use forge_run to check health endpoint. Confirm service is live.

Constitutional gates:
- F1 AMANAH: Deployment must be reversible (rollback plan required)
- F2 TRUTH: Health check must return real status, not assumed
- F13 SOVEREIGN: Production deploy requires explicit Arif approval (888_HOLD)`,
          },
        },
      ],
    }),
  );

  // ── Audit Code ───────────────────────────────────────────────────────
  server.prompt(
    "audit-code",
    "Code audit workflow: scan → classify → report → recommend",
    {
      scope: z.string().describe("What to audit (file path, directory, or 'full')"),
      focus: z.string().optional().describe("Audit focus (security, performance, governance, all)"),
    },
    (args) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Audit scope: ${args.scope}
Focus: ${args.focus || "all"}

Follow this workflow:
1. SCAN — Use forge_file (glob/grep) to find relevant files.
2. READ — Use forge_file to read each file. Understand the code.
3. CLASSIFY — Label each finding: OBSERVED/DERIVED/INTERPRETED/SPECULATED.
4. REPORT — Structured output with severity (LOW/MEDIUM/HIGH/CRITICAL).
5. RECOMMEND — Concrete next steps, not vague suggestions.

Constitutional gates:
- F2 TRUTH: Every finding must have evidence (file + line number)
- F9 ANTI-HANTU: No hallucinated vulnerabilities. Only what you can prove.
- F11 AUDIT: Leave a trace. Record findings in forge_work/.`,
          },
        },
      ],
    }),
  );

  // ── Research Topic ────────────────────────────────────────────────────
  server.prompt(
    "research-topic",
    "Structured research workflow: question → gather → synthesize → cite",
    {
      topic: z.string().describe("What to research"),
      depth: z.string().optional().describe("Research depth: quick, standard, deep"),
    },
    (args) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Research: ${args.topic}
Depth: ${args.depth || "standard"}

Follow this workflow:
1. QUESTION — State the exact question. No vague research.
2. GATHER — Use forge_research or forge_docs_lookup. Multiple sources.
3. SYNTHESIZE — Combine findings. Resolve contradictions.
4. CITE — Every claim needs a source. No unsourced assertions.
5. LABEL — Epistemic labels on every claim: OBS/DER/INT/SPEC.

Constitutional gates:
- F2 TRUTH: ≥0.99 accuracy or declare uncertainty band
- F7 HUMILITY: If evidence is insufficient, say so. Don't fill gaps with speculation.
- F9 ANTI-HANTU: No fabricated sources. Every citation must be real.`,
          },
        },
      ],
    }),
  );

  // ── Cross-Organ Query ────────────────────────────────────────────────
  server.prompt(
    "cross-organ-query",
    "Route a query to the correct federation organ",
    {
      query: z.string().describe("What you want to know or do"),
    },
    (args) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Query: ${args.query}

Determine which organ to route to:
- GEOX (port 8081): Wells, seismic, petrophysics, basin, geoscience
- WEALTH (port 18082): Capital, NPV, risk, stock analysis, finance
- WELL (port 18083): Human readiness, vitality, fatigue, dignity
- arifOS (port 8088): Constitutional judgment, floors, verdicts
- A-FORGE (port 7071): Build, deploy, code execution
- AAA (port 3001): Control plane, A2A gateway, cockpit

Use arifOS arif_route to route intent to the correct organ.
If unsure, use arif_observe (compass mode) to map the query.`,
          },
        },
      ],
    }),
  );
}
