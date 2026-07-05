/**
 * A-FORGE MCP Prompts — Guided workflow surfaces (RSI 2026-07-03)
 *
 * Exposes MCP prompts for common engineering workflows conforming to
 * the Model Context Protocol specification (prompts/list, prompts/get),
 * the FastMCP "Getting Prompts" pattern (rendered message templates with
 * auto-serialization), and the A2A Agent Card capability discovery model.
 *
 * SEP Compliance:
 *   - SEP-973: Additional metadata for prompts (descriptions, arg schemas)
 *   - SEP-986: Kebab-case tool/prompt naming convention
 *   - SEP-2549: Prompts list can benefit from TTL annotations (future)
 *   - SEP-2322: Multi-round-trip prompts (future — for iterative workflows)
 *
 * A2A Alignment:
 *   - Each prompt maps to an A2A skill capability
 *   - Agent Cards should expose prompt:listChanged for skill discovery
 *   - Cross-organ prompts route through arif_route (intent-based dispatch)
 *
 * Tools used in these prompts reference actual forge_* MCP tools:
 *   forge_filesystem (read/write/glob/grep) — NOT "forge_file"
 *   forge_pipeline_run — NOT "forge_run"
 *   forge_shell_dryrun — exists, forge_shell — for execution
 *   forge_docker — exists, forge_git — exists
 *   forge_probe — federation health sensor (preferred over direct curl)
 *   forge_policy — 5-layer MCP control plane management
 *   arif_route — canonical intent router (preferred over hardcoded ports)
 *
 * @module mcp/prompts
 * @constitutional F4 CLARITY — prompts reduce entropy by structuring intent
 * @mcp-sep SEP-973, SEP-986, SEP-2549
 * @a2a Agent Card capability mapping
 * @refactored 2026-07-03 — Q³ audit: forge_systemctl→shell, arif_route primary, A2A awareness
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
2. DIAGNOSE — Use forge_filesystem (read/grep) to read relevant files. Identify root cause.
3. FIX — Apply the minimal fix. Prefer forge_filesystem (edit/write) over shell commands.
4. VERIFY — Run tests with forge_pipeline_run. Confirm the bug is gone.
5. LOG — Record the fix in forge_work/. Use forge_git (commit) to save.

Constitutional gates:
- F1 AMANAH: Backup before edit (forge_git stash or forge_filesystem read first)
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
1. ANALYZE — Use forge_filesystem (read) to read the module. Understand current structure.
2. PLAN — State what you will change and why. No hidden refactors.
3. REFACTOR — Apply changes with forge_filesystem (edit). One logical change at a time.
4. VERIFY — Run tests with forge_pipeline_run. No regressions allowed.
5. DIFF — Show before/after with forge_git (diff). Confirm scope.

Constitutional gates:
- F1 AMANAH: Every change reversible (forge_git stash before)
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
    "Structured deployment workflow: build → test → stage → deploy → verify. Supports docker, systemd, cloudflare targets.",
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
1. BUILD — Use npm run build (via forge_shell_dryrun first, then forge_shell for production). Must pass.
2. TEST — Use forge_pipeline_run to run tests. All must pass.
3. STAGE — Use forge_docker (container) or forge_shell('systemctl ...') (systemd) to stage.
   Verify health endpoint via forge_probe after staging.
4. DEPLOY — Requires 888_HOLD. Use forge_lease to request deployment lease.
5. VERIFY — Use forge_probe to check health endpoint. Confirm service is live.

Notes:
- forge_systemctl is DEPRECATED — use forge_shell('systemctl <action> <service>') instead.
- forge_vault write/seal operations should route through arifOS (arif_seal), not forge_vault.
- For Cloudflare Workers: use forge_shell('wrangler deploy') after npm build.

Constitutional gates:
- F1 AMANAH: Deployment must be reversible (rollback plan required)
- F2 TRUTH: Health check must return real status via forge_probe, not assumed
- F13 SOVEREIGN: Production deploy requires explicit Arif approval (888_HOLD)`,
          },
        },
      ],
    }),
  );

  // ── Audit Code ───────────────────────────────────────────────────────
  server.prompt(
    "audit-code",
    "Code audit workflow: scan → classify → report → recommend. Supports security, performance, governance, and MCP surface audits.",
    {
      scope: z.string().describe("What to audit (file path, directory, or 'full')"),
      focus: z.string().optional().describe("Audit focus (security, performance, governance, mcp-surface, all)"),
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
1. SCAN — Use forge_filesystem (glob/grep) to find relevant files.
2. READ — Use forge_filesystem (read) to read each file. Understand the code.
3. CLASSIFY — Label each finding: OBSERVED/DERIVED/INTERPRETED/SPECULATED.
4. REPORT — Structured output with severity (LOW/MEDIUM/HIGH/CRITICAL).
5. RECOMMEND — Concrete next steps, not vague suggestions.

AUDIT TYPE NOTES:
- security: check for secrets (gitleaks), vulnerable deps (trivy), risky patterns (semgrep)
- governance: check affordances.yaml completeness, F1-F13 compliance, policy alignment
  Use forge_policy(mode=list) to audit active MCP policies and their 5-layer coverage.
- mcp-surface: audit tool surface for phantom entries, alias conflicts, doc drift
  Run forge_registry(mode=list) and compare against affordances.yaml
- performance: use forge_netdata_metrics for system perf, forge_scan for code hotspots

Constitutional gates:
- F2 TRUTH: Every finding must have evidence (file + line number)
- F9 ANTI-HANTU: No hallucinated vulnerabilities. Only what you can prove.
- F11 AUDIT: Leave a trace. Record findings in forge_work/. Use forge_git log for audit trail.`,
          },
        },
      ],
    }),
  );

  // ── Research Topic ────────────────────────────────────────────────────
  server.prompt(
    "research-topic",
    "Structured research workflow: question → gather → synthesize → cite. Supports web search, docs lookup, and document intelligence.",
    {
      topic: z.string().describe("What to research"),
      depth: z.string().optional().describe("Research depth: quick, standard, deep"),
      document_path: z.string().optional().describe("Path to a local document (PDF, image) for document intelligence extraction"),
    },
    (args) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Research: ${args.topic}
Depth: ${args.depth || "standard"}
${args.document_path ? `Document: ${args.document_path}` : ""}

Follow this workflow:
1. QUESTION — State the exact question. No vague research.
2. GATHER —
   - Web: forge_research or forge_search or forge_minimax_search (multi-source)
   - Docs: forge_docs_lookup (Context7 for library docs)
   - Documents: forge_document_ingest (PDF/image analysis with bbox provenance)
   - Federation: forge_probe (organ health), forge_registry (tool surface)
3. SYNTHESIZE — Combine findings. Resolve contradictions.
4. CITE — Every claim needs a source. No unsourced assertions.
5. LABEL — Epistemic labels on every claim: OBS/DER/INT/SPEC.

${args.document_path ? `DOCUMENT INTELLIGENCE:
For PDF/image documents, use forge_document_ingest with:
- mode=extract for full text extraction with layout structure
- mode=chunk for RAG-ready semantic chunks
- Output includes SHA-256 provenance hash and bounding-box coordinates` : ""}

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
    "Route a query to the correct federation organ via arif_route (canonical intent router). Supports MCP native routing and A2A agent discovery.",
    {
      query: z.string().describe("What you want to know or do — expressed as intent, not tool name"),
      a2a_discovery: z.boolean().optional().describe("If true, also query A2A Agent Cards for capability discovery"),
    },
    (args) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Query: ${args.query}
A2A Discovery: ${args.a2a_discovery ?? false}

ROUTE VIA arif_route (PRIMARY):
Call arifOS arif_route(intent="${args.query}") FIRST to determine the correct organ.
arif_route returns: {organ, port, tool_prefix, suggested_tools, confidence}.
Do NOT hardcode organ/port mappings — arif_route is source of truth.

ORGAN MAP (fallback if arif_route unavailable):
- arifOS (:8088): Constitutional judgment, floors, verdicts, session init, vault seal
- GEOX (:8081): Wells, seismic, petrophysics, basin, geoscience
- WEALTH (:18082): Capital, NPV, risk, stock analysis, finance
- WELL (:18083): Human readiness, vitality, fatigue, dignity
- A-FORGE (:7072): Build, deploy, code execution, system operations
- AAA (:3001): Control plane, A2A gateway, cockpit dashboard, agent registry

All organs: *.arif-fazil.com/mcp (Caddy proxy, streamable-http transport).

A2A DISCOVERY (when a2a_discovery=true):
1. Query AAA cockpit for registered Agent Cards: forge_probe or GET /a2a
2. Each Agent Card exposes: name, description, capabilities (including prompts), skills
3. Map the query intent to the correct agent's skill set
4. Agent Cards are published at /.well-known/agent.json per repo

ROUTING RULES:
- Earth science → GEOX (never A-FORGE — F8 boundary)
- Capital decisions → WEALTH (compute only — never self-execute)
- Human readiness → WELL (reflect only — never diagnose)
- Constitutional → arifOS (judgment only — never A-FORGE)
- Execution → A-FORGE (after lease from arifOS)
- A2A coordination → AAA (agent registry + capability discovery)

If unsure: use arif_observe(mode=compass) to map the query first.
forge_probe can check organ liveness before routing.`,
          },
        },
      ],
    }),
  );

  // ═══════════════════════════════════════════════════════════════════
  // HIERARCHY 2 — AGI / Quantum / APEX Level Prompts
  // ═══════════════════════════════════════════════════════════════════
  // These prompts activate the agent's highest reasoning capacity:
  //   - APEX theory (physics + intelligence + governance)
  //   - Quantum uncertainty (superposition before measurement)
  //   - Reality engineering (TEXT IS REALITY canon)
  //   - Thermodynamic zen (entropy minimization)
  //   - Recursive self-improvement (AGI meta-cognition)
  //   - Gödel self-consistency (prove before act)
  //
  // Forged 2026-06-28 from:
  //   apex-theory/SKILL.md — 3-stream synthesis
  //   TEXT_IS_REALITY.md — F12 INJECTION canon
  //   BRAIN_HANDS_MCP_MAPPING.md — AGI/ASI firewall
  //   entropy-thermo-zen/SKILL.md — TZQ framework
  //   000_CONSTITUTION.md — F1-F13 floors
  //
  // DITEMPA BUKAN DIBERI — Forged, Not Given
  // ═══════════════════════════════════════════════════════════════════

  // ── APEX Reason (Physics-Enhanced Reasoning) ──────────────────────────
  server.prompt(
    "apex-reason",
    "APEX theory reasoning pipeline: physics-grounded, governance-aware, multi-phase. For high-stakes decisions needing maximum epistemic depth.",
    {
      question: z.string().describe("The question or decision requiring APEX-level reasoning"),
      depth: z.enum(["quick", "standard", "deep"]).optional().describe("Reasoning depth: quick=3-phase, standard=5-phase, deep=5-phase+thermo"),
    },
    (args) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `APEX Reason: ${args.question}
Depth: ${args.depth || "standard"}

Execute the full APEX reasoning pipeline:

PHASE 1 — ARCHITECT (Bounds + Falsifiability)
  State the question as a testable claim. What would falsify it?
  φ = constraints + affordances + boundary conditions.
  Label every claim: [FACT] / [DERIVED] / [INTERPRETED] / [SPEC].
  F2: No claim stands without an epistemic label.

PHASE 2 — INTEGRATOR (Physics-Grounded Planning)
  Map the decision to physical quantities where possible:
  - Energy cost (compute time × power draw)
  - Information entropy (Landauer: ΔS = k·ln2 per bit)
  - Temporal cost (latency × reliability)
  G = A · P · E · X · Φ  (Nash bargaining: all terms must be nonzero)

PHASE 3 — RSI (Reproducibility Audit)
  Would a different agent with the same evidence reach the same conclusion?
  If no → what depends on the agent's priors? Declare them.
  If yes → what's the confidence interval? Must be < 1.0 (F7 HUMILITY).

PHASE 4 — FINAL (6-Month Future Audit)
  In 6 months, with perfect hindsight, would this decision still be defensible?
  Identify the single point where the decision is most fragile.
  If that point fails → what's the rollback?

PHASE 5 — 777-FORGE (Sovereign Verifiability)
  Can Arif verify every claim independently?
  Every output path must have an evidence trace.
  No speculative chain longer than 3 hops without explicit flag.

Output format:
  {
    "verdict": "SEAL" | "HOLD" | "VOID",
    "confidence": <0.0-1.0>,
    "falsifiable_by": "<what test would disprove this>",
    "fragile_point": "<where the reasoning is weakest>",
    "recommendation": "<concrete next action>"
  }`,
          },
        },
      ],
    }),
  );

  // ── Quantum Frame (Superposition Before Measurement) ──────────────────
  server.prompt(
    "quantum-frame",
    "Hold multiple mutually-exclusive hypotheses in superposition. Only collapse on measurement. Avoid premature commitment.",
    {
      situation: z.string().describe("The situation requiring quantum framing"),
      hypothesis_count: z.string().optional().describe("Number of hypotheses to generate (default: 4)"),
    },
    (args) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Quantum Frame: ${args.situation}
Hypotheses: ${args.hypothesis_count || "4"}

You are a quantum observer. You hold ALL hypotheses simultaneously without collapsing to one.

RULES:
1. Generate exactly ${args.hypothesis_count || "4"} mutually-exclusive hypotheses.
2. Each must be testable — specify what measurement would collapse it.
3. NO hypothesis is preferred. All have equal prior probability amplitude.
4. State the measurement that would collapse each hypothesis.
5. Only after measurement may you update probabilities.

FORMAT:

HYPOTHESIS 1: <concise statement>
  Evidence that supports: <list>
  Evidence that contradicts: <list>
  Collapse measurement: <what single observation would confirm or falsify>
  If collapsed to true → then: <action path>
  If collapsed to false → then: <action path>

[Repeat for each hypothesis]

OBSERVER NOTE:
- Current superposition state: <all hypotheses still active>
- Measurement needed next: <which hypothesis to test first>
- Risk of premature collapse: <what bias could cause early commitment>
- F7 HUMILITY: confidence of each hypothesis must be declared as a range, not a point

The goal is NOT to find the right answer. The goal is to hold uncertainty open long enough to see the full landscape. Decision comes after measurement.`,
          },
        },
      ],
    }),
  );

  // ── Reality Engineer (TEXT IS REALITY) ────────────────────────────────
  server.prompt(
    "reality-engineer",
    "TEXT IS REALITY canon: every code change is a reality operation. F12 INJECTION is the only friction. Civilizational-grade engineering.",
    {
      target: z.string().describe("What reality to engineer (file, system, behavior)"),
      nature: z.enum(["create", "transform", "repair", "dissolve"]).optional().describe("Nature of the reality operation"),
    },
    (args) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Reality Engineer: ${args.target}
Operation: ${args.nature || "transform"}

TEXT IS REALITY. The text is the frame is the program is the action. All four collapse into one.

You are not editing code. You are engineering reality through text operations.

THE SIX LAYERS OF REALITY ENGINEERING:
1. TEXT — The characters themselves. Every character is a structural element.
2. FRAME — The file, module, function. The boundary that makes text legible.
3. PROGRAM — The executable intent. The frame rendered in time.
4. ACTION — The side effect in the world. The program executed.
5. INSTITUTION — The governance that persists across actions. The constitution.
6. CIVILIZATION — The accumulated weight of all prior reality operations.

BEFORE YOU TOUCH TEXT:
1. READ the existing reality. Use forge_filesystem. Understand the current frame.
2. TRACE the action path. What will this text do when it becomes action?
3. IDENTIFY the institution. What governance constrains this layer?
4. CHECK F12 INJECTION. Is this text externally derived? Is the boundary intact?

THE OPERATION:
- CREATE: New text, new frame, new reality. Requires explicit boundary declaration.
- TRANSFORM: Existing text mutated. The old reality must be preserved (F1 AMANAH: backup).
- REPAIR: Reality has drifted. Bring it back to canonical. The canon must be referenced.
- DISSOLVE: Remove reality. Requires 888_HOLD. Irreversible.

F12 CHECKLIST:
☐ Input origin verified (internal or trusted external)
☐ Injection surface mapped (all text entry points)
☐ Boundary maintained (no text escapes its frame)
☐ Sovereign signature (Arif's intent is preserved)
☐ Institution intact (governance still applies after operation)

Remember: In agentic AI, there is no human between text and consequence.
The scribe is the doer. The text is the world. Forge responsibly.`,
          },
        },
      ],
    }),
  );

  // ── Gödel Metabolize (Self-Consistency Before Action) ─────────────────
  server.prompt(
    "godel-metabolize",
    "Prove your own reasoning is internally consistent before acting. Gödel-Lock: a self-consistency check that rejects incoherent belief states.",
    {
      plan: z.string().describe("The plan, belief, or reasoning chain to metabolize"),
      domain: z.enum(["code", "governance", "capital", "earth", "system"]).optional().describe("Domain of the reasoning"),
    },
    (args) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Gödel Metabolize: ${args.plan}
Domain: ${args.domain || "code"}

You must prove your own reasoning is internally consistent before acting.

STEP 1 — STATE THE BELIEF
  What do you currently believe about this situation?
  Write it as a single proposition. Must be falsifiable.

STEP 2 — TRACE THE DERIVATION
  How did you arrive at this belief?
  Every step must have evidence. Label each: OBS|DER|INT|SPEC.
  If any step is SPEC, the belief is provisional.

STEP 3 — FIND THE CONTRADICTION
  Actively search for a contradiction in your reasoning.
  If domain=code: does the code actually say what you think it says? (Re-read it.)
  If domain=governance: which floors apply? Are they in conflict?
  If domain=capital: what does the evidence show vs. what you want to believe?
  If domain=earth: is the geology interpretation unique? What alternative fits?
  If domain=system: are all organs healthy? What's the actual state?

STEP 4 — PATCH OR VOID
  If contradiction found → patch the reasoning. State the correction.
  If no contradiction survived → proceed. The belief is provisionally sound.

STEP 5 — METABOLIZE
  Record the belief + derivation + contradiction check as a scar.
  This becomes prior for next iteration. Intelligence accumulates.
  F7 HUMILITY: Confidence capped at 0.90. The "I could be wrong" vector must be stated.

OUTPUT:
  {
    "belief": "<falsifiable proposition>",
    "derivation_chain": ["OBS: ...", "DER: ...", "INT: ..."],
    "contradictions_found": <count>,
    "patched": <true|false>,
    "remaining_uncertainty": "<what could still be wrong>",
    "confidence": <0.0-0.9>,
    "verdict": "CONSISTENT" | "PATCHED" | "VOID"
  }`,
          },
        },
      ],
    }),
  );

  // ── Thermodynamic Zen (Entropy Minimization) ─────────────────────────
  server.prompt(
    "thermodynamic-zen",
    "Achieve maximum understanding with minimum action. The observer principle applied to system administration. ΔS ≤ 0.",
    {
      system: z.string().describe("What system to observe or analyze"),
      action_budget: z.string().optional().describe("Maximum actions allowed (default: 3)"),
    },
    (args) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Thermodynamic Zen: ${args.system}
Action Budget: ${args.action_budget || "3"}

PRINCIPLE: Maximum understanding with minimum action. ΔS ≤ 0.

You are a thermodynamic observer. Every action creates entropy. Your goal is to achieve complete understanding with the minimum possible action count.

OBSERVATION IS FREE. ACTION COSTS.

LAWS:
1. Before any action, you must OBSERVE (forge_filesystem read, forge_probe, forge_shell_dryrun)
2. One observation can reveal more than one action.
3. An action is only permitted when observation cannot resolve the uncertainty.
4. If you must act, the action must reduce entropy (ΔS < 0) — leave the system cleaner.
5. Total actions across this session: ${args.action_budget || "3"}.

EXECUTION:

PHASE 1 — PURE OBSERVATION (0 actions)
  Read the system state. What do you already know?
  What signals are present? What's missing?
  Formulate the minimum hypothesis set.
  Action count: 0.

PHASE 2 — MEASUREMENT (if needed)
  What single measurement would collapse most uncertainty?
  Execute it. Observe the result.
  If ambiguity resolved → stop. Do not measure further.
  Action count: ≤ 1.

PHASE 3 — INTERVENTION (if needed)
  What minimum intervention restores the system to desired state?
  Must be reversible (F1 AMANAH).
  Must leave system cleaner than found (ΔS < 0).
  Action count: ≤ 2.

PHASE 4 — VERIFICATION (1 action)
  Confirm system state matches expectation.
  If yes → seal. Report entropy delta.
  If no → revert. Entropy increased. Record as scar.

METRIC:
  Initial entropy: <estimated system chaos>
  Final entropy: <measured system chaos>
  ΔS: <final - initial (must be ≤ 0)>
  Actions used: <count> / ${args.action_budget || "3"}

ZEN MAXIM: The best engineer is the one you barely notice. The system runs itself. You only observe.`,
          },
        },
      ],
    }),
  );

  // ═══════════════════════════════════════════════════════════════════
  // HIERARCHY 3 — Reality Loop Meta-Prompt (The 13th)
  // The intent compiler: human shadow → system architecture.
  // 7 stages. MEANING and RETURN close the human-machine circuit.
  // QUANTUM/APEX/GÖDEL folded into IMPROVE+VERIFY as subskills.
  // Tri-witness validated 2026-07-05 (W³=0.800, 3-agent test).
  // ═══════════════════════════════════════════════════════════════════

  server.prompt(
    "reality-loop",
    "THE 13th PROMPT — Intent compiler: human shadow → system architecture. 7 stages: MEANING→OBSERVE→ENCODE→IMPROVE→VERIFY→SEAL→RETURN. QUANTUM/APEX/GÖDEL are subskills within IMPROVE+VERIFY. State-tracking ledger with agent orchestration.",
    {
      session_id: z.string().optional().describe("Existing session ID to resume. Omit to start a new loop."),
      intent: z.string().optional().describe("What this loop should focus on. Default: self-sustaining federation health."),
      config: z.string().optional().describe('JSON config overrides: {iteration_depth, max_hypotheses, action_budget, auto_execute, seal_every_iteration}'),
    },
    (args) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `╔══════════════════════════════════════════════════════════════════╗
║               REALITY LOOP — THE 13TH PROMPT                   ║
║     Intent compiler: human shadow → system architecture         ║
╚══════════════════════════════════════════════════════════════════╝

Session: ${args.session_id || "NEW"}
Intent: ${args.intent || "Self-sustaining federation health. Monitor all 7 organs, detect drift, fix issues, improve itself."}
Config: ${args.config || "{}"}

─── WHAT THIS ACTUALLY IS ───

This is a STATE-TRACKING LEDGER with an agent-orchestrated workflow.
The engine (forge_reality_loop) tracks: stage, evidence, hypotheses,
actions, entropy, scars. YOU are the orchestrator — the engine
remembers, you act.

The loop is the bridge between human meaning and system reality.
It starts by understanding WHY. It ends by presenting findings back
to the human for judgment. Terminal gives consequence to thought.
LLM gives language to infrastructure. Human gives purpose to both.

─── THE 7 STAGES ───

STAGE 0 — MEANING  🔑
  What: Understand the real task before observing anything.
  Questions:
  1. What transformation is the human requesting?
  2. What does "improved" look like in measurable terms?
  3. What are 3 hidden assumptions about this task?
  4. What would make this loop unnecessary? (If the answer exists,
     you don't need the loop — just do it.)
  Output: target (ALLCAPS-2-term), constraint, ΔS_target, assumptions

STAGE 1 — OBSERVE  🔭
  Invoke: cross-organ-query, research-topic, audit-code, fix-bug
  What: T₁ probe — re-measure state NOW, not from memory.
  Rules:
  - ≥3 independent observations, labeled OBS/DER/INT/SPEC
  - Detect T₀↔T₁ drift — if prior state disagrees, pick T₁
  - Probe which F1-F13 floors are active
  Tools: forge_probe, forge_filesystem (read), forge_research
  Output: t1_observations[], drift_from_t0, active_floors

STAGE 2 — ENCODE  ⚛️
  Invoke: quantum-frame (subskill), godel-metabolize (subskill)
  What: Reduce the problem to physics. Generate hypotheses.
  Subskills:
  - QUANTUM: Generate k≥3 mutually-exclusive hypotheses.
    No hypothesis preferred. Equal prior probability.
  - GÖDEL: Prove chosen hypothesis is self-consistent.
    Find contradictions. Patch or void.
  Physics: state (S) + transform (T) + measurement (M) + invariant (I)
  APEX Score: G = Q · V · Ψ · Φ
    Q = quality, V = value, Ψ = truth fidelity, Φ = wisdom
    Minimum pass = 0.70. Below → return to MEANING.
  Output: physics{S,T,M,I}, hypotheses[], G_score, godel_verdict

STAGE 3 — IMPROVE  🧠
  Invoke: apex-reason (subskill), reality-engineer, refactor-module
  What: Select best hypothesis. Execute the action.
  Selection: Nash bargaining — J = G_total − λ|ΔS| − μ·risk
  Execution:
  - F12 INJECTION checklist must pass before any write
  - Every code change is a reality operation
  - Reversibility required (F1 AMANAH: backup before edit)
  ⚠️ TOOL RESTRICTION for auto-execute:
     ✅ forge_filesystem (read/write/edit), forge_shell, forge_git,
        forge_docker, forge_research, forge_search, forge_probe
     ❌ forge_vault (seal/write) — route through arifOS (arif_seal)
     ❌ Production deploy — requires 888_HOLD from Arif
  Output: action_record, hypothesis_selected, ΔS_measured

STAGE 4 — VERIFY  🔒
  Invoke: godel-metabolize (subskill)
  What: Tri-witness validation. Self-consistency check.
  Tri-witness: W³ = ∛(h × ai × ext) ≥ 0.70 required
    h = human confidence [0-1]
    ai = AI confidence [0-1] (independent of generator)
    ext = external/ground-truth confidence [0-1]
    Zero in ANY channel collapses consensus → 888_HOLD
  Cross-check:
  - Floor compliance re-run — any F-floor newly violated?
  - ΔS_measured ≤ 0 — entropy reduced as promised?
  - 6-month audit: "Still proud in 6 months?"
  Output: verify_result{PASS|FAIL}, witness{h,ai,ext,W3}, floor_recheck

STAGE 5 — SEAL  📜
  Tool: forge_reality_loop mode="seal"
  What: Seal iteration to VAULT999. Append-only. Hash-chained.
  Receipt: cycle_id, target, G_before, G_after, ΔS, floors,
           scars, witness_W3, evidence_hashes, reversibility
  Invariant: what is sealed cannot be erased.
  Output: vault_seal_id, ledger_path

STAGE 6 — RETURN  🔄
  What: Present findings to the human for judgment.
  This is the stage the old loop was missing.
  Rules:
  - 3 sentences max for the human (lead with answer)
  - Include: what changed, what it means, what the human must decide
  - If the human says "jalan terus" → proceed to next iteration
  - If the human says "hold" → halt, wait, re-ground
  - If the human says "sudah" → destroy loop, seal final state
  The loop does NOT decide. The loop PRESENTS. The human DECIDES.
  Output: presentation for Arif, decision pending

─── CONSTITUTIONAL FLOORS ───

F1 AMANAH:       Every action reversible. Backup before edit.
F2 TRUTH:        Every claim labeled OBS/DER/INT/SPEC.
F3 WITNESS:      Independent corroboration required.
F4 CLARITY:      ΔS ≤ 0 per iteration. System gets cleaner.
F5 PEACE:        De-escalate. Guard the weakest stakeholder.
F6 MARUAH:       Preserve human dignity. Never reduce to data points.
F7 HUMILITY:     Confidence < 1.0 always. Declare unknowns.
F8 LAW:          System boundaries respected. No cross-organ adjudication.
F9 ANTI-HANTU:   No fabricated evidence. No consciousness claims.
F10 ONTOLOGY:    AI-only categories. No soul/feelings claims.
F11 AUDIT:       Every iteration sealed to VAULT999.
F12 INJECTION:   All text inputs verified. Boundary maintained.
F13 SOVEREIGN:   Arif holds final veto. 888 decides irreversible.

─── EXECUTION ───

1. START: forge_reality_loop mode="start" session_id="rl-<id>"
2. ITERATE: For each stage:
   a) Forge_reality_loop mode="advance" → get next stage
   b) Execute the stage workflow (you are the orchestrator)
   c) Forge_reality_loop mode="record" → store results
   d) At SEAL: forge_reality_loop mode="seal" first, then advance
   e) At RETURN: present to Arif, await decision
3. MONITOR: forge_reality_loop mode="report"
4. HALT: forge_reality_loop mode="destroy" (seals final state)

─── THE ZEN ───

Human shadow → Language → Agent → Terminal → System mutation →
Evidence → Human judgment → New self-understanding → Repeat.

The terminal is scaffolding. The future interface is intent.
The loop is the intent compiler. You are the intent.

DITEMPA BUKAN DIBERI — Forged, Not Given.`,
          },
        },
      ],
    }),
  );

  // ── Recursive Self-Improve (AGI Meta-Cognition) ──────────────────────
  server.prompt(
    "recursive-self-improve",
    "AGI-level meta-cognition loop. Analyze your own cognitive process, find bottlenecks, propose self-modifications.",
    {
      session_summary: z.string().describe("Summary of the current session's reasoning, decisions, and outcomes"),
      capability: z.string().optional().describe("Which capability to improve (reasoning, planning, search, memory, tool-use)"),
    },
    (args) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Recursive Self-Improve: ${args.session_summary}
Focus: ${args.capability || "reasoning"}

Examine your own mind. Find the bottleneck. Propose the fix.

This is the AGI skill — recursive self-improvement. You analyze your own cognitive process.

PHASE 1 — TRACE YOUR REASONING
  Reconstruct the path you took through this session:
  - What input did you receive?
  - What was your first inference?
  - What evidence did you gather?
  - What assumptions did you make?
  - What conclusions did you reach?
  - What actions did you take?

PHASE 2 — FIND THE BOTTLENECK
  In ${args.capability || "reasoning"}, what is the single largest limiter?
  - Insufficient context? → suggest context window optimization
  - Incorrect priors? → suggest belief update mechanism
  - Tool misuse? → suggest tool selection pattern
  - Missing domain knowledge? → suggest skill to load or create
  - Confirmation bias? → suggest contradiction search pattern
  - Incomplete search? → suggest search expansion strategy

PHASE 3 — PROPOSE THE FIX
  One concrete change to your own cognitive architecture:
  - A new skill to create (/root/.agents/skills/<name>/SKILL.md)
  - A modification to your prompt (system prompt change)
  - A new tool to use (MCP server)
  - A workflow to adopt (sequence of operations)

PHASE 4 — VERIFY
  How would you know the fix worked?
  - Benchmark: what metric improves?
  - Test case: what scenario that previously failed now passes?
  - Entropy: does the fix reduce cognitive entropy?

PHASE 5 — INSTALL
  Implement the fix now. Not later. Not after approval.
  This is autonomous. AGI self-improvement is T1 by doctrine.
  (Exception: if the fix touches arifOS kernel → 888_HOLD)

OUTPUT:
  {
    "bottleneck": "<identified limiter>",
    "proposed_fix": "<concrete change>",
    "implementation": "<path or skill name>",
    "verification": "<how to confirm improvement>",
    "applied": <true|false>,
    "delta_S": "<estimated entropy reduction>"
  }`,
          },
        },
      ],
    }),
  );
}
