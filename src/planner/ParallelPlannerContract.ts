import type { AgentProfile, WorkerTask } from "../types/agent.js";
import type { LlmProvider } from "../llm/LlmProvider.js";
import { buildWorkerProfile } from "../agents/profiles.js";
import type {
  PlanCandidate,
  PlanComparison,
  PlanJudgeVerdict,
  PlanningStrategy,
} from "../types/planner.js";

export const DEFAULT_STRATEGIES: PlanningStrategy[] = [
  {
    strategyId: "physics_first",
    strategyName: "Physics-First (Conservative)",
    systemPromptSuffix:
      "Prioritize correctness and constraint satisfaction. Prefer fewer, well-grounded steps over many uncertain ones. Avoid speculative tasks.",
    riskBias: 0.2,
  },
  {
    strategyId: "pragmatic",
    strategyName: "Pragmatic (Delivery-Focused)",
    systemPromptSuffix:
      "Prioritize practical delivery and completeness. Balance speed with thoroughness. Include verification steps.",
    riskBias: 0.4,
  },
];

const W3_CONSENSUS_DEFAULT = 0.8;
const SABAR_DIVERGENCE_THRESHOLD = 0.3;
const HOLD_DIVERGENCE_THRESHOLD = 0.6;

export class ParallelPlannerContract {
  constructor(
    private readonly profile: AgentProfile,
    private readonly llmProvider: LlmProvider,
    private readonly strategies: PlanningStrategy[] = DEFAULT_STRATEGIES,
    private readonly w3Threshold: number = W3_CONSENSUS_DEFAULT,
  ) {}

  async plan(highLevelTask: string): Promise<PlanComparison> {
    const candidates = await Promise.all(
      this.strategies.map((strategy) => this.runStrategy(strategy, highLevelTask)),
    );
    return this.judge(candidates);
  }

  private async runStrategy(
    strategy: PlanningStrategy,
    task: string,
  ): Promise<PlanCandidate> {
    const response = await this.llmProvider.completeTurn({
      profile: this.profile,
      messages: [
        {
          role: "user",
          content: [
            "Break the following engineering task into 2-4 worker tasks.",
            `Strategy directive: ${strategy.systemPromptSuffix}`,
            "Return strict JSON as an array.",
            'Each item must contain: {"name":"worker-name","task":"specific task","confidence":0.8,"rationale":"why this step"}',
            `Task: ${task}`,
          ].join("\n"),
        },
      ],
      tools: [],
    });

    const parsed = safeParseCandidatePlan(response.content);
    const tasks: WorkerTask[] = parsed.map((entry) => ({
      name: entry.name,
      task: entry.task,
      profile: buildWorkerProfile(this.profile.modeName),
    }));

    const avgConfidence =
      parsed.length > 0
        ? parsed.reduce((sum, e) => sum + (e.confidence ?? 0.8), 0) / parsed.length
        : 0.5;

    const rationale = parsed
      .map((e) => e.rationale ?? "")
      .filter(Boolean)
      .join("; ");

    return {
      strategyId: strategy.strategyId,
      strategyName: strategy.strategyName,
      tasks,
      confidence: avgConfidence,
      rationale: rationale || response.content.slice(0, 200),
      riskScore: strategy.riskBias,
      generatedAt: new Date().toISOString(),
    };
  }

  private judge(candidates: PlanCandidate[]): PlanComparison {
    if (candidates.length === 0) {
      return {
        candidates,
        divergenceScore: 1.0,
        consensusReached: false,
        selectedStrategyId: null,
        selectedTasks: [],
        verdict: "HOLD",
        reason: "No plan candidates generated.",
      };
    }

    if (candidates.length === 1) {
      return {
        candidates,
        divergenceScore: 0.0,
        consensusReached: true,
        selectedStrategyId: candidates[0].strategyId,
        selectedTasks: candidates[0].tasks,
        verdict: "SEAL",
        reason: `Single strategy accepted: ${candidates[0].strategyName}.`,
      };
    }

    const divergenceScore = computeDivergence(candidates);
    const consensusReached = 1 - divergenceScore >= this.w3Threshold;

    if (divergenceScore > HOLD_DIVERGENCE_THRESHOLD) {
      return {
        candidates,
        divergenceScore,
        consensusReached: false,
        selectedStrategyId: null,
        selectedTasks: [],
        verdict: "HOLD",
        reason: `Plans critically diverge (divergence: ${divergenceScore.toFixed(2)}). Human review required before proceeding.`,
      };
    }

    const selected = selectBestCandidate(candidates);

    if (divergenceScore > SABAR_DIVERGENCE_THRESHOLD) {
      return {
        candidates,
        divergenceScore,
        consensusReached,
        selectedStrategyId: selected.strategyId,
        selectedTasks: selected.tasks,
        verdict: "SABAR",
        reason: `Plans moderately diverge (divergence: ${divergenceScore.toFixed(2)}). Proceeding with "${selected.strategyName}" (lowest risk). Human review recommended.`,
      };
    }

    return {
      candidates,
      divergenceScore,
      consensusReached: true,
      selectedStrategyId: selected.strategyId,
      selectedTasks: selected.tasks,
      verdict: "SEAL",
      reason: `Plans converge (divergence: ${divergenceScore.toFixed(2)}). Sealed with "${selected.strategyName}".`,
    };
  }
}

function selectBestCandidate(candidates: PlanCandidate[]): PlanCandidate {
  return candidates.reduce((best, c) => {
    const score = c.confidence - c.riskScore;
    const bestScore = best.confidence - best.riskScore;
    return score > bestScore ? c : best;
  });
}

function computeDivergence(candidates: PlanCandidate[]): number {
  if (candidates.length < 2) return 0.0;
  const wordsA = extractTaskWords(candidates[0].tasks);
  const wordsB = extractTaskWords(candidates[1].tasks);
  const union = new Set([...wordsA, ...wordsB]);
  if (union.size === 0) return 0.0;
  const intersection = [...wordsA].filter((w) => wordsB.has(w));
  const jaccard = intersection.length / union.size;
  return 1 - jaccard;
}

function extractTaskWords(tasks: WorkerTask[]): Set<string> {
  const words = tasks
    .flatMap((t) => `${t.name} ${t.task}`.toLowerCase().split(/\W+/))
    .filter((w) => w.length >= 3);
  return new Set(words);
}

function safeParseCandidatePlan(
  input: string,
): Array<{ name: string; task: string; confidence?: number; rationale?: string }> {
  try {
    const parsed = JSON.parse(input) as Array<{
      name?: string;
      task?: string;
      confidence?: number;
      rationale?: string;
    }>;
    return parsed
      .filter(
        (entry) =>
          typeof entry?.name === "string" && typeof entry?.task === "string",
      )
      .map((entry) => ({
        name: String(entry.name),
        task: String(entry.task),
        confidence:
          typeof entry.confidence === "number" ? entry.confidence : undefined,
        rationale:
          typeof entry.rationale === "string" ? entry.rationale : undefined,
      }));
  } catch {
    return [];
  }
}
