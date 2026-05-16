import { CoordinatorAgent } from "./CoordinatorAgent.js";
import type { AgentProfile } from "../types/agent.js";
import type { WorkerAgent } from "./WorkerAgent.js";
import type { LlmProvider } from "../llm/LlmProvider.js";
import type { ParallelPlannerContract } from "../planner/ParallelPlannerContract.js";

/**
 * AAA-Agent — Federal Coordinator
 * Arif Autonomous Architecture Agent
 * 
 * Class: ASI
 * Role: Receives all inter-agent routing requests, routes tasks to specialists,
 *       aggregates multi-agent responses, and holds the 888_HOLD escalation path.
 */
export class AAAgent extends CoordinatorAgent {
  constructor(
    profile: AgentProfile,
    workerAgent: WorkerAgent,
    llmProvider: LlmProvider,
    plannerContract?: ParallelPlannerContract,
  ) {
    super(profile, workerAgent, llmProvider, plannerContract);
  }

  /**
   * Route an incoming query to the appropriate specialist agent.
   * Implementation of AAA-Agent.route() logic.
   */
  async route(query: string): Promise<string> {
    const routingPrompt = [
      "You are AAA-Agent, the Arif Autonomous Architecture Federal Coordinator.",
      "Your job is to route incoming queries to the correct specialist agent in the federation.",
      "",
      "Specialist Agents:",
      "- GEOX-Agent: subsurface, geological, seismic, well, or earth intelligence queries.",
      "- WEALTH-Agent: portfolio, asset, capital, NAV, or economic transaction queries.",
      "- AUDITOR-Agent: constitutional floors, ethics, F1-F13, and policy verdicts.",
      "- VALIDATOR-Agent: database schema, FK integrity, data drift, and technical consistency.",
      "- ENGINEER-Agent: infrastructure, containers, deployment, stack, and ops.",
      "- ARCHIVIST-Agent: canon, ADR log, architectural history, and memory retrieval.",
      "",
      "Routing Rules:",
      "1. If the query is related to Earth or Subsurface -> GEOX-Agent",
      "2. If the query is related to Money or Capital -> WEALTH-Agent",
      "3. If the query is related to Policy or Ethics -> AUDITOR-Agent",
      "4. If the query is related to Data Integrity -> VALIDATOR-Agent",
      "5. If the query is related to Infrastructure or Ops -> ENGINEER-Agent",
      "6. If the query is related to Canon or Decisions -> ARCHIVIST-Agent",
      "7. If Risk >= HIGH or the query is dangerously ambiguous -> 888_HOLD",
      "",
      "Response format: Return ONLY the agent_id (e.g., 'GEOX-Agent') or '888_HOLD'.",
      "",
      `Query: ${query}`
    ].join("\n");

    const response = await this.llmProvider.completeTurn({
      profile: this.profile,
      messages: [{ role: "user", content: routingPrompt }],
      tools: [],
    });

    const decision = response.content.trim();
    console.error(`[AAA-Agent] Routing decision for "${query.slice(0, 30)}...": ${decision}`);
    
    return decision;
  }
}

