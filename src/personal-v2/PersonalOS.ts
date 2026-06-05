/**
 * Personal OS v2
 * 
 * Wave 1: Trust Foundation
 * - P0.1: Continuity Store (persistent sessions)
 * - P0.2: Discovery Surface (A2A card, MCP manifest)
 * - P0.3: Human Command Layer (6 verbs)
 * - P0.4: Memory Contract (5 tiers with correction)
 * - P0.5: Approval Boundaries (preview objects, hold queue)
 * 
 * @module personal-v2/PersonalOS
 * @constitutional F13 Sovereign - Human is primary
 */

import { ContinuityStore, type ContinuityStatus } from "../continuity/ContinuityStore.js";
import { MemoryContract, type MemoryEntry, type MemoryTier } from "../memory-contract/MemoryContract.js";
import { ApprovalBoundary, type HoldQueueItem, type ActionPreview } from "../approval/ApprovalBoundary.js";
import { createArifOSAgentCard, createMCPManifest, type A2AAgentCard, type MCPManifest } from "../discovery/A2ACard.js";

// ============================================================================
// HUMAN COMMANDS (6 verbs)
// ============================================================================

export type HumanCommand =
  | "remember"        // Store in memory
  | "recall"          // Retrieve from memory
  | "track"           // Monitor over time
  | "think"           // Reason/compare (was "compare")
  | "hold"            // Block for approval
  | "execute";        // Run with approval

export interface HumanIntent {
  command: HumanCommand;
  what: string;
  why?: string;
  urgency?: "now" | "soon" | "later";
}

// ============================================================================
// RESPONSE ENVELOPE (P1.6: Explainability)
// ============================================================================

export interface HumanResponse {
  /** Action badge */
  badge: "🔍 Observe" | "💡 Advise" | "📋 Ready" | "✋ Needs Yes" | "🤖 AFK-Auto" | "✅ Executed" | "❌ Rejected";
  
  /** System state */
  state: "thinking" | "drafting" | "holding" | "ready" | "approved" | "executing" | "executed" | "rejected" | "expired";
  
  /** Primary human-facing message */
  summary: string;
  
  /** Explainability envelope */
  explanation?: {
    whatIKnow: string[];
    whatImUnsureAbout: string[];
    whyIRecommendThis: string;
    whatINeedFromYou: string[];
    whatIWontDoWithoutApproval: string[];
  };
  
  /** Action IDs for follow-up */
  holdId?: string;
  memoryId?: string;
  
  /** Next suggested action */
  next?: HumanCommand;
}

// ============================================================================
// PERSONAL OS CLASS
// ============================================================================

export class PersonalOS {
  private continuity: ContinuityStore;
  private memory: MemoryContract;
  private approval: ApprovalBoundary;
  private actorId: string;
  private initialized = false;

  constructor(options?: {
    continuity?: ContinuityStore;
    memory?: MemoryContract;
    approval?: ApprovalBoundary;
  }) {
    this.continuity = options?.continuity ?? new ContinuityStore();
    this.memory = options?.memory ?? new MemoryContract();
    this.approval = options?.approval ?? new ApprovalBoundary();
    this.actorId = "ARIF"; // Personal OS = single sovereign
  }

  /**
   * Initialize the Personal OS.
   */
  async initialize(): Promise<ContinuityStatus> {
    await this.memory.initialize();
    await this.approval.initialize();
    
    const status = await this.continuity.initialize(this.actorId, "ARIF");
    this.initialized = true;
    
    return status;
  }

  /**
   * Process a human intent through the 6-verb interface.
   */
  async process(intent: HumanIntent): Promise<HumanResponse> {
    this.ensureInitialized();
    
    switch (intent.command) {
      case "remember":
        return this.handleRemember(intent);
      case "recall":
        return this.handleRecall(intent);
      case "track":
        return this.handleTrack(intent);
      case "think":
        return this.handleThink(intent);
      case "hold":
        return this.handleHold(intent);
      case "execute":
        return this.handleExecute(intent);
      default:
        return {
          badge: "💡 Advise",
          state: "thinking",
          summary: `I don't know how to "${(intent as HumanIntent).command}". Try: remember, recall, track, think, hold, execute`,
        };
    }
  }

  /**
   * Get current dashboard state.
   */
  getDashboard(): {
    continuity: ContinuityStatus;
    memory: ReturnType<MemoryContract["getStats"]>;
    approvals: ReturnType<ApprovalBoundary["getSummary"]>;
  } {
    this.ensureInitialized();
    
    return {
      continuity: this.continuity.getStatus(),
      memory: this.memory.getStats(),
      approvals: this.approval.getSummary(),
    };
  }

  /**
   * Get A2A Agent Card for discovery.
   */
  getA2ACard(baseUrl: string): A2AAgentCard {
    return createArifOSAgentCard(baseUrl);
  }

  /**
   * Get MCP Manifest for discovery.
   */
  getMCPManifest(): MCPManifest {
    return createMCPManifest();
  }

  /**
   * Approve a held action.
   */
  approve(holdId: string, reason?: string): HumanResponse {
    const item = this.approval.approve(holdId, reason);
    
    return {
      badge: "📋 Ready",
      state: "approved",
      summary: `Approved: ${item.description}. Ready to execute.`,
      holdId,
      next: "execute",
    };
  }

  /**
   * Reject a held action.
   */
  reject(holdId: string, reason?: string): HumanResponse {
    const item = this.approval.reject(holdId, reason);
    
    return {
      badge: "❌ Rejected",
      state: "rejected",
      summary: `Rejected: ${item.description}. Nothing will happen.`,
      holdId,
    };
  }

  /**
   * Get the hold queue formatted for human.
   */
  getHoldQueue(): string {
    return this.approval.formatHoldQueue();
  }

  /**
   * Graceful shutdown.
   */
  async shutdown(): Promise<void> {
    await this.continuity.shutdown();
    this.approval.shutdown();
  }

  // ==========================================================================
  // COMMAND HANDLERS
  // ==========================================================================

  private async handleRemember(intent: HumanIntent): Promise<HumanResponse> {
    // Infer tier from content
    const tier = this.inferTier(intent.what);
    
    const entry = await this.memory.store({
      content: intent.what,
      tier,
      reason: intent.why ?? "Stated by operator",
      source: { type: "human", description: "Operator statement" },
    });
    
    // Update continuity
    this.continuity.updateFocus({
      activeProjects: this.memory.getByTier("working").map(m => m.content),
    });
    
    return {
      badge: "✅ Executed",
      state: "executed",
      summary: `Remembered: "${intent.what}" (${tier})`,
      memoryId: entry.memoryId,
      explanation: {
        whatIKnow: [intent.what],
        whatImUnsureAbout: tier === "quarantine" ? ["Verification pending"] : [],
        whyIRecommendThis: "You asked me to remember this",
        whatINeedFromYou: tier === "quarantine" ? ["Verify this information"] : [],
        whatIWontDoWithoutApproval: [],
      },
    };
  }

  private async handleRecall(intent: HumanIntent): Promise<HumanResponse> {
    const results = this.memory.query({
      query: intent.what,
      limit: 5,
    });
    
    if (results.memories.length === 0) {
      return {
        badge: "💡 Advise",
        state: "thinking",
        summary: `I don't recall anything about "${intent.what}". Want me to remember something about it?`,
        explanation: {
          whatIKnow: [],
          whatImUnsureAbout: [`No memories matching "${intent.what}"`],
          whyIRecommendThis: "No relevant memories found",
          whatINeedFromYou: ["Tell me what to remember"],
          whatIWontDoWithoutApproval: [],
        },
      };
    }
    
    const top = results.memories[0];
    const others = results.memories.slice(1);
    
    return {
      badge: "🔍 Observe",
      state: "thinking",
      summary: `${top.content}${others.length > 0 ? ` (+ ${others.length} more)` : ""}`,
      explanation: {
        whatIKnow: results.memories.map(m => m.content),
        whatImUnsureAbout: results.memories
          .filter(m => m.confidence < 0.8)
          .map(m => `Uncertain: ${m.content}`),
        whyIRecommendThis: `Found ${results.total} relevant memories`,
        whatINeedFromYou: results.memories.some(m => m.tier === "quarantine") 
          ? ["Verify quarantined memories"] 
          : [],
        whatIWontDoWithoutApproval: [],
      },
    };
  }

  private async handleTrack(intent: HumanIntent): Promise<HumanResponse> {
    const watch = this.continuity.addWatch(intent.what);
    
    return {
      badge: "✅ Executed",
      state: "executed",
      summary: `Now tracking: "${intent.what}"`,
      explanation: {
        whatIKnow: [`Tracking: ${intent.what}`],
        whatImUnsureAbout: [],
        whyIRecommendThis: "You asked me to monitor this",
        whatINeedFromYou: [],
        whatIWontDoWithoutApproval: ["Alert you on changes", "Take action without approval"],
      },
    };
  }

  private async handleThink(intent: HumanIntent): Promise<HumanResponse> {
    // This is the comparison/reasoning handler
    const options = this.parseOptions(intent.what);
    
    // Get relevant context from memory
    const context = this.memory.query({ 
      query: options.join(" "),
      limit: 3,
    });
    
    return {
      badge: "💡 Advise",
      state: "thinking",
      summary: this.generateComparison(options, context.memories),
      explanation: {
        whatIKnow: context.memories.map(m => m.content),
        whatImUnsureAbout: context.memories.length < 2 ? ["Limited context available"] : [],
        whyIRecommendThis: options.length > 1 
          ? `Comparing ${options.join(" vs ")}` 
          : "Analyzing your request",
        whatINeedFromYou: ["Your priorities", "Constraints I should know"],
        whatIWontDoWithoutApproval: ["Make the decision for you"],
      },
    };
  }

  private async handleHold(intent: HumanIntent): Promise<HumanResponse> {
    // Create preview for what will be held
    const preview: ActionPreview = {
      whatWillHappen: `Block: ${intent.what}`,
      sideEffects: ["Action will not proceed until you approve"],
      riskAssessment: {
        level: "low",
        concerns: [],
        mitigations: ["Explicit hold placed", "Requires your approval"],
      },
      reasoning: intent.why ?? "You requested a hold",
    };
    
    const item = this.approval.stageAction(
      intent.what,
      preview,
      intent.why
    );
    
    return {
      badge: item.badge,
      state: item.state,
      summary: `Holding: "${intent.what}". ${item.badge === "✋ Needs Yes" ? "Awaiting your approval." : "Ready when you are."}`,
      holdId: item.holdId,
      explanation: {
        whatIKnow: [intent.what],
        whatImUnsureAbout: [],
        whyIRecommendThis: "You asked me to hold",
        whatINeedFromYou: ["Your approval to proceed"],
        whatIWontDoWithoutApproval: [intent.what],
      },
    };
  }

  private async handleExecute(intent: HumanIntent): Promise<HumanResponse> {
    // Check if there's a staged action matching this
    const holding = this.approval.getHoldQueue({ state: "approved" });
    
    if (holding.length === 0) {
      return {
        badge: "💡 Advise",
        state: "thinking",
        summary: "Nothing approved to execute. Use 'hold' first, then approve.",
      };
    }
    
    // Execute the first approved item
    const toExecute = holding[0];
    this.approval.markExecuting(toExecute.holdId);
    
    // Simulate execution (in real implementation, this would call the actual action)
    this.approval.markExecuted(
      toExecute.holdId,
      "success",
      `Executed: ${toExecute.description}`,
      undefined,
      toExecute.preview.sideEffects
    );
    
    return {
      badge: "✅ Executed",
      state: "executed",
      summary: `Executed: ${toExecute.description}`,
      holdId: toExecute.holdId,
      explanation: {
        whatIKnow: [toExecute.description],
        whatImUnsureAbout: [],
        whyIRecommendThis: "Approved by you",
        whatINeedFromYou: [],
        whatIWontDoWithoutApproval: [],
      },
    };
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error("PersonalOS not initialized. Call initialize() first.");
    }
  }

  private inferTier(content: string): MemoryTier {
    const lower = content.toLowerCase();
    
    if (lower.includes("constitution") || lower.includes("sovereign") || 
        lower.includes("never ") || lower.includes("always ")) {
      return "sacred";
    }
    
    if (lower.includes("i am ") || lower.includes("my ") || 
        lower.includes("i prefer") || lower.includes("my name")) {
      return "canon";
    }
    
    if (lower.includes("temp") || lower.includes("now")) {
      return "ephemeral";
    }
    
    return "working";
  }

  private parseOptions(what: string): string[] {
    return what.split(/\s+(?:vs|versus|or)\s+/i).map(s => s.trim());
  }

  private generateComparison(options: string[], memories: MemoryEntry[]): string {
    if (options.length < 2) {
      return `Thinking about: ${options[0] || "your request"}...\n\nBased on your memories, I can see context but need more to compare.`;
    }
    
    const lines = [
      `Comparing: ${options.join(" vs ")}`,
      "",
      "Based on your memory and context:",
    ];
    
    for (const memory of memories.slice(0, 2)) {
      lines.push(`• ${memory.content} (${memory.tier})`);
    }
    
    lines.push("");
    lines.push("Tradeoffs to consider:");
    
    for (let i = 0; i < options.length; i++) {
      lines.push(`${i + 1}. ${options[i]}: [would analyze based on your preferences]`);
    }
    
    return lines.join("\n");
  }
}

// ============================================================================
// FACTORY
// ============================================================================

let globalOS: PersonalOS | null = null;

export async function createPersonalOS(): Promise<PersonalOS> {
  if (!globalOS) {
    globalOS = new PersonalOS();
    await globalOS.initialize();
  }
  return globalOS;
}

export async function shutdownPersonalOS(): Promise<void> {
  if (globalOS) {
    await globalOS.shutdown();
    globalOS = null;
  }
}

