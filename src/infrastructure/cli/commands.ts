import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { AgentEngine } from "../../domain/engine/AgentEngine.js";
import {
  buildExploreProfile,
  buildFixProfile,
  buildTestProfile,
} from "../../domain/agents/profiles.js";
import type { AgentModeName, AgentProfile } from "../../domain/types/agent.js";
import type { LlmProvider } from "../../infrastructure/llm/LlmProvider.js";
import type { RuntimeConfig } from "../../interfaces/config/RuntimeConfig.js";
import { ForgeScoreboard } from "../../domain/scoreboard/ForgeScoreboard.js";
import { getTicketStore } from "../../application/approval/index.js";
import { FileVaultClient } from "../../infrastructure/vault/index.js";
import {
  parseRiskLevel,
  parseTicketStatus,
  parseVaultVerdict,
} from "../../application/approval/filterParsing.js";
import { runBackup } from "./backup.js";
import { runVerify } from "./verify.js";
import { runProvider } from "./provider.js";
import { ConvergenceEngine } from "../../domain/engine/ConvergenceEngine.js";
import type { SovereignAgentEnvelope } from "../../domain/types/sovereign.js";
import { CodeModeExecutor } from "../code-mode/CodeModeExecutor.js";
import { createTelegramNotifier, WebhookNotifier } from "../notifier/index.js";
import { createSandbox, runInSandbox } from "../../domain/containment/ExecutionSandbox.js";
import { PRESETS, type SandboxPolicy } from "../../domain/containment/SandboxPolicy.js";
import { checkGitDiff, detectCollision, rollbackFile } from "../../domain/governance/GitDiffGuard.js";
import { validateInputClarityAdaptive } from "../../domain/governance/f3InputClarity.js";
import {
  arifos_epoch_create,
  arifos_epoch_start,
  arifos_epoch_complete,
  arifos_epoch_status,
} from "../../interfaces/mcp/tools/arifos-epoch.js";
import { recordExternalContact, checkRealityQuota, checkRetirement, createRealityLoopState, DEFAULT_ANTISINK_CONFIG } from "../../interfaces/mcp/shell/antiSink.js";
import { ConstitutionalBoundary } from "../../interfaces/middleware/ConstitutionalBoundary.js";

function getMode(
  options: Record<string, string | boolean>,
  runtimeConfig: RuntimeConfig,
): AgentModeName {
  if (options.mode === "internal") {
    return "internal_mode";
  }

  if (options.mode === "external") {
    return "external_safe_mode";
  }

  return runtimeConfig.defaultMode;
}

function applyTrustLocalVps(profile: AgentProfile, runtimeConfig: RuntimeConfig): AgentProfile {
  if (!runtimeConfig.trustLocalVps) {
    return profile;
  }

  return {
    ...profile,
    modeName: "internal_mode",
    allowedTools: [
      ...new Set([
        ...profile.allowedTools,
        "write_file",
        "run_tests",
        "run_command",
      ]),
    ],
  };
}

export async function runCliCommand(
  command: string,
  options: Record<string, string | boolean>,
  engineFactory: (profile: AgentProfile) => AgentEngine,
  llmProviderFactory: () => LlmProvider,
  runtimeConfig: RuntimeConfig,
  rawArgv: string[] = process.argv,
): Promise<string> {
  const modeName = getMode(options, runtimeConfig);
  const cwd = typeof options.cwd === "string" ? resolve(options.cwd) : process.cwd();
  const scoreboard = new ForgeScoreboard(runtimeConfig.scoreboardPath);
  const baseTaskOptions = {
    taskId: typeof options["task-id"] === "string" ? options["task-id"] : undefined,
    humanMinutes: toNumberOption(options["human-minutes"]),
    lintIssuesDelta: toNumberOption(options["lint-issues-delta"]) ?? 0,
    attemptNumber: toNumberOption(options.attempt) ?? 1,
    maxAttempts: toNumberOption(options["max-attempts"]) ?? 1,
  };

  if (command === "fix") {
    const file = String(options.file ?? "");
    const issue = String(options.issue ?? `Fix issues in ${file}.`);
    const profile = applyTrustLocalVps(buildFixProfile(modeName), runtimeConfig);
    return (
      await engineFactory(profile).run({
        task: `${issue}\nTarget file: ${file}`,
        workingDirectory: cwd,
        taskCommand: "fix",
        taskType: "bugfix",
        testsPassed: toBooleanOption(options["tests-passed"]),
        ...baseTaskOptions,
      })
    ).finalText;
  }

  if (command === "explore") {
    const goal = String(options.goal ?? "Explain this repository.");
    const profile = applyTrustLocalVps(buildExploreProfile(modeName), runtimeConfig);
    return (
      await engineFactory(profile).run({
        task: goal,
        workingDirectory: cwd,
        taskCommand: "explore",
        taskType: "explore",
        ...baseTaskOptions,
      })
    ).finalText;
  }

  if (command === "test") {
    const task = String(options.goal ?? "Run the test suite and summarize the result.");
    const profile = applyTrustLocalVps(buildTestProfile(modeName), runtimeConfig);
    return (
      await engineFactory(profile).run({
        task,
        workingDirectory: cwd,
        taskCommand: "test",
        taskType: "test",
        testsPassed: toBooleanOption(options["tests-passed"]),
        ...baseTaskOptions,
      })
    ).finalText;
  }

  if (command === "operator") {
    const subcommand = String(options.cmd ?? "");
    if (subcommand === "approvals") {
      const store = getTicketStore();
      try {
        await store.initialize();
      } catch (err) {
        // Postgres unreachable — fall back to file-based store
        process.stderr.write(
          `[WARN] Ticket store initialize failed (${err instanceof Error ? err.message : String(err)}), ` +
          `falling back to FileTicketStore\n`
        );
        const { FileTicketStore } = await import("../../application/approval/TicketStore.js");
        const fileStore = new FileTicketStore();
        await fileStore.initialize();
        const status = parseTicketStatus(typeof options.status === "string" ? options.status : undefined);
        const sessionId = typeof options.sessionId === "string" ? options.sessionId : undefined;
        const riskLevel = parseRiskLevel(typeof options.riskLevel === "string" ? options.riskLevel : undefined);
        const tickets = await fileStore.query({ status, sessionId, riskLevel });
        return JSON.stringify({ ok: true, count: tickets.length, tickets }, null, 2);
      }
      const status = parseTicketStatus(typeof options.status === "string" ? options.status : undefined);
      const sessionId = typeof options.sessionId === "string" ? options.sessionId : undefined;
      const riskLevel = parseRiskLevel(typeof options.riskLevel === "string" ? options.riskLevel : undefined);
      const tickets = await store.query({
        status,
        sessionId,
        riskLevel,
      });
      return JSON.stringify({ ok: true, count: tickets.length, tickets }, null, 2);
    }
    if (subcommand === "vault") {
      const vaultClient = new FileVaultClient();
      const sessionId = typeof options.sessionId === "string" ? options.sessionId : undefined;
      const verdict = parseVaultVerdict(
        typeof options.verdict === "string" ? options.verdict : undefined,
      );
      const since = typeof options.since === "string" ? options.since : undefined;
      const until = typeof options.until === "string" ? options.until : undefined;
      const limit = toNumberOption(options.limit);
      const records = await vaultClient.query({
        sessionId,
        verdict,
        since,
        until,
        limit,
      });
      return JSON.stringify({ ok: true, count: records.length, records }, null, 2);
    }
    return [
      "Usage:",
      '  agent operator approvals [--status PENDING|DISPATCHED|APPROVED|REJECTED|MODIFY_REQUIRED|ACKED|EXPIRED|REPLAYED] [--sessionId <id>] [--riskLevel low|medium|high|critical]',
      '  agent operator vault [--verdict SEAL|HOLD|SABAR|VOID] [--sessionId <id>] [--since <iso>] [--until <iso>] [--limit <n>]',
    ].join("\n");
  }

  if (command === "scoreboard") {
    const period = String(options.period ?? "weekly");
    if (period !== "weekly") {
      throw new Error(`Unsupported scoreboard period: ${period}`);
    }

    const taskCommand =
      typeof options.command === "string" ? options.command : undefined;
    const trustMode =
      options["trust-mode"] === "local_vps" || options["trust-mode"] === "default"
        ? (options["trust-mode"] as "local_vps" | "default")
        : undefined;

    return JSON.stringify(
      await scoreboard.summarizeCurrentWeek(new Date(), {
        taskCommand,
        trustMode,
      }),
      null,
      2,
    );
  }

  if (command === "backup") {
    const cmd = typeof options.cmd === "string" ? options.cmd : undefined;
    return await runBackup({ cmd });
  }

  if (command === "verify") {
    const { text } = await runVerify({});
    return text;
  }

  if (command === "provider") {
    // Pass through all original argv so provider.ts can re-parse subcommand + flags.
    const startIdx = rawArgv.findIndex((a) => a === "provider" || a.endsWith("/agent") || a.endsWith("\\agent")) + 1;
    const providerArgs = startIdx > 0 ? rawArgv.slice(startIdx) : ["provider", "list"];
    return await runProvider(providerArgs);
  }

  if (command === "converge") {
    const envelopesJson = typeof options.envelopes === "string" ? options.envelopes : "";
    let envelopes: SovereignAgentEnvelope[] = [];
    if (envelopesJson) {
      try {
        envelopes = JSON.parse(envelopesJson) as SovereignAgentEnvelope[];
      } catch {
        throw new Error("--envelopes must be valid JSON array of SovereignAgentEnvelope");
      }
    }
    if (envelopes.length === 0) {
      // Demo convergence with one envelope to prove the engine is wired
      envelopes = [{
        agentId: "demo-agent",
        dimension: "Abstract",
        operationType: "judge",
        assumptions: ["Demo convergence check"],
        transformStack: ["raw_input"],
        uncertainty: { uPhys: 0.1, confidence: 0.9 },
        acRisk: 0.1,
        constraintCheck: { physicsPassed: true, topologyPassed: true },
        temporalStatus: "static",
        recommendation: { action: "PROCEED", rationale: "Demo envelope passes all checks" },
      }];
    }
    const engine = new ConvergenceEngine();
    const result = engine.evaluate(envelopes);
    return JSON.stringify(result, null, 2);
  }

  if (command === "code") {
    const file = typeof options.file === "string" ? options.file : undefined;
    const scriptInput = typeof options.script === "string" ? options.script : undefined;
    const mode = typeof options.mode === "string" ? options.mode : "analyze";
    const exec = options.exec === true || options.execute === true;

    let script: string;
    if (scriptInput) {
      script = scriptInput;
    } else if (file) {
      script = readFileSync(resolve(process.cwd(), file), "utf8");
    } else {
      throw new Error("agent code requires --file <path> or --script <string>");
    }

    const cwd = process.cwd();
    const executor = new CodeModeExecutor({
      gateways: [{ name: "geox", toolNames: ["geox_basin"], resourceUris: ["geox://basins"] }],
      defaultTimeoutMs: 30_000,
      defaultMemoryLimitMb: 128,
      governanceBridgeUrl: process.env.ARIFOS_BRIDGE_URL,
      holdEnabled: true,
    });

    if (mode === "analyze" || !exec) {
      const analysis = executor.analyzeScript(script);
      return JSON.stringify(analysis, null, 2);
    }

    if (mode === "execute" && !exec) {
      return "Use --exec to execute after analysis passes.";
    }

    const result = await executor.executeScript({
      script,
      context: {
        sessionId: randomUUID(),
        workingDirectory: cwd,
        modeName: "cli",
        allowedGateways: ["geox"],
      },
    });
    return JSON.stringify(result, null, 2);
  }

  if (command === "notify-test") {
    const target = typeof options.target === "string" ? options.target : "all";
    const telegram = createTelegramNotifier();
    const webhook = new WebhookNotifier();
    const results: string[] = [];

    if (target === "telegram" || target === "all") {
      await telegram.sendHold({
        jobId: "notify-test",
        task: "Test 888_HOLD notification from A-FORGE",
        priority: "high",
        profile: "notify-test",
      });
      results.push("telegram: dispatched (no-op if env vars missing)");
    }

    if (target === "webhook" || target === "all") {
      await webhook.sendHold({
        jobId: "notify-test",
        task: "Test 888_HOLD webhook from A-FORGE",
        priority: "high",
        profile: "notify-test",
      });
      results.push("webhook: dispatched");
    }

    return JSON.stringify({ target, results }, null, 2);
  }

  if (command === "sandbox") {
    const shellCommand = typeof options.command === "string" ? options.command : undefined;
    const policyName = typeof options.policy === "string" ? options.policy : "READONLY_BUILD";
    const allowedPolicies = new Set<string>(["READONLY_BUILD", "NETWORKED_LLM", "FULL_ISOLATED", "VOID"]);

    if (!shellCommand) {
      throw new Error("agent sandbox requires --command '<cmd>'");
    }
    if (!allowedPolicies.has(policyName)) {
      throw new Error(`Unknown policy: ${policyName}. Use READONLY_BUILD|NETWORKED_LLM|FULL_ISOLATED|VOID.`);
    }

    const session = await createSandbox("SEAL" as const, {
      customPolicy: PRESETS[policyName] as SandboxPolicy | undefined,
    });

    const result = await runInSandbox(session, shellCommand);
    return JSON.stringify({
      sandboxId: session.sandboxId,
      backend: result.backend,
      policy: session.policy.name,
      exitCode: result.exitCode,
      wallTimeMs: result.wallTimeMs,
      stdout: result.stdout,
      stderr: result.stderr,
      killed: result.killed,
    }, null, 2);
  }

  if (command === "diff-check") {
    const file = typeof options.file === "string" ? options.file : undefined;
    if (!file) {
      throw new Error("agent diff-check requires --file <path>");
    }
    const cwd = process.cwd();
    const diff = checkGitDiff(file, cwd);
    if (options.rollback === true && !diff.clean) {
      const rollback = rollbackFile(file, cwd);
      return JSON.stringify({ diff, rollback }, null, 2);
    }
    return JSON.stringify(diff, null, 2);
  }

  if (command === "clarity") {
    const task = typeof options.task === "string" ? options.task : "";
    const intent =
      typeof options.intent === "string" &&
      ["informational", "advisory", "execution", "speculative"].includes(options.intent)
        ? (options.intent as "informational" | "advisory" | "execution" | "speculative")
        : "advisory";
    const risk =
      typeof options.risk === "string" && ["low", "medium", "high", "critical"].includes(options.risk)
        ? (options.risk as "low" | "medium" | "high" | "critical")
        : "medium";
    const result = validateInputClarityAdaptive(task, intent, risk);
    return JSON.stringify(result, null, 2);
  }

  if (command === "epoch") {
    const action = typeof options.action === "string" ? options.action : "status";
    const name = typeof options.name === "string" ? options.name : `cli-epoch-${Date.now()}`;

    const now = new Date().toISOString();
    const plan = {
      plan_id: `PLAN-${name}`,
      mission_id: `MISSION-${name}`,
      outcome_spec_id: `OUTCOME-${name}`,
      tasks: [],
      edges: [],
      reversibility_class: "reversible" as const,
      risk_tier: "LOW" as const,
      plan_state: "APPROVED" as const,
      veto_points: [],
      created_at: now,
      created_by: runtimeConfig.actorId,
      judge_verdict: "SEAL" as const,
      judge_state_hash: null,
      notes: [],
      name,
    };

    if (action === "create") {
      const result = arifos_epoch_create(plan, runtimeConfig.actorId, { name });
      return JSON.stringify(result, null, 2);
    }

    if (action === "start" || action === "complete") {
      const created = arifos_epoch_create(plan, runtimeConfig.actorId, { name });
      if (!created.ok) return JSON.stringify(created, null, 2);
      if (action === "start") {
        return JSON.stringify(arifos_epoch_start(created.epoch, runtimeConfig.actorId), null, 2);
      }
      const started = arifos_epoch_start(created.epoch, runtimeConfig.actorId);
      if (!started.ok) return JSON.stringify(started, null, 2);
      return JSON.stringify(arifos_epoch_complete(started.epoch, runtimeConfig.actorId), null, 2);
    }

    if (action === "status") {
      const created = arifos_epoch_create(plan, runtimeConfig.actorId, { name });
      if (!created.ok) return JSON.stringify(created, null, 2);
      return JSON.stringify(arifos_epoch_status(created.epoch), null, 2);
    }

    throw new Error(`Unknown epoch action: ${action}`);
  }

  if (command === "antisink") {
    const taskType = typeof options["task-type"] === "string" ? options["task-type"] : "cli-task";
    const description = typeof options.description === "string" ? options.description : "External contact from agent CLI";
    const state = recordExternalContact(
      createRealityLoopState(),
      { taskType, description, outcome: "dispatched" },
    );
    const quota = checkRealityQuota(state);
    const retirement = checkRetirement(state, quota);
    return JSON.stringify({ state, quota, retirement }, null, 2);
  }

  if (command === "boundary-check") {
    const toolName = typeof options.tool === "string" ? options.tool : "unknown";
    const boundary = new ConstitutionalBoundary();
    await boundary.enforce(toolName, {}, {
      verdict: "SEAL",
      passed: true,
      failed_floors: [],
      reason: "Synthetic SEAL for boundary wiring check",
      proof: { signature: "demo-signature", intent_hash: "demo-hash", witness_type: "agent", timestamp: new Date().toISOString() },
    });
    return JSON.stringify({ tool: toolName, boundary: "SEAL accepted (demo proof)" }, null, 2);
  }

  return [
    "Usage:",
    "  agent explore --goal \"explain this repo\" [--mode internal|external] [--cwd path]",
    "  agent fix --file src/file.ts [--issue \"what to fix\"] [--mode internal|external] [--cwd path]",
    "  agent test [--goal \"what to validate\"] [--mode internal|external] [--cwd path]",
    "  agent scoreboard [--period weekly] [--command explore|fix|test] [--trust-mode local_vps|default]",
    "  agent operator approvals [--status <status>] [--sessionId <id>] [--riskLevel <level>]",
    "  agent operator vault [--verdict <verdict>] [--sessionId <id>] [--since <iso>] [--until <iso>] [--limit <n>]",
    "  agent backup [daily|verify|list]",
    "  agent verify",
    "  agent provider <list|health|swap|validate> [flags]",
    "  agent converge [--envelopes '<json>']",
    "  agent code --file <path> [--mode analyze|execute]",
    "  agent notify-test [telegram|webhook|all]",
    "  agent sandbox --command '<cmd>' [--policy READONLY_BUILD|NETWORKED_LLM|FULL_ISOLATED|VOID]",
    "  agent diff-check --file <path> [--rollback]",
    "  agent clarity --task '<text>' [--intent informational|advisory|execution|speculative] [--risk low|medium|high|critical]",
    "  agent epoch --action create|start|complete|status [--name '<name>']",
    "  agent antisink --task-type '<type>' [--description '<desc>']",
    "  agent boundary-check --tool <name>",

    "Environment:",
    "  AGENT_WORKBENCH_TRUST_LOCAL_VPS=1 enables internal mode, dangerous tools, and broad command policy defaults for your own VPS.",
  ].join("\n");
}

function toNumberOption(value: string | boolean | undefined): number | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toBooleanOption(value: string | boolean | undefined): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value === "1" || value.toLowerCase() === "true") {
      return true;
    }
    if (value === "0" || value.toLowerCase() === "false") {
      return false;
    }
  }

  return undefined;
}
