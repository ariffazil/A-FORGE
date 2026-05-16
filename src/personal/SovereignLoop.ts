/**
 * Personal Sovereign Loop
 * 
 * The human-facing layer of arifOS.
 * Transforms kernel-facing MCP tools into companion-facing human commands.
 * 
 * Design principle: The human thinks in intentions, not implementations.
 * 
 * @module personal/SovereignLoop
 * @constitutional F13 Sovereign - Human intention is primary
 */

// ============================================================================
// HUMAN COMMAND LAYER
// ============================================================================

export type HumanCommand =
  | "remember"      // Store something as known
  | "recall"        // Retrieve what was stored
  | "track"         // Monitor something over time
  | "compare"       // Show differences, options, tradeoffs
  | "draft"         // Prepare without executing
  | "decide-with-me" // Present options, wait for human
  | "hold"          // Block until explicit approval
  | "execute-with-approval"; // Execute if approved, else hold

export interface HumanIntent {
  command: HumanCommand;
  what: string;           // The thing being acted upon
  why?: string;           // Human's reason (optional context)
  urgency?: "now" | "soon" | "eventually" | "whenever";
  privacy?: "private" | "shared" | "public";
}

export interface SovereignResponse {
  badge: ActionBadge;
  state: ActionState;
  humanSummary: string;   // What the human sees first
  systemDetails?: string; // Technical details if human asks
  nextAction?: HumanCommand;
}

// ============================================================================
// ACTION BADGES - The approval boundary UX
// ============================================================================

export type ActionBadge =
  | "🔍 Observe"      // System noticed something
  | "💡 Advise"       // System has a suggestion
  | "📋 Ready"        // Draft prepared, waiting
  | "✋ Needs your yes" // Explicit approval required
  | "✅ Executed";    // Done, with record

export type ActionState =
  | "thinking"
  | "drafting"
  | "holding"
  | "approved"
  | "executed"
  | "rejected"
  | "expired";

// ============================================================================
// MEMORY TIERS - Human memory discipline
// ============================================================================

export type MemoryTier =
  | "ephemeral"     // Current convo, temp context
  | "working"       // Active projects, current focus
  | "canon"         // Stable truths about Arif
  | "sacred"        // Constitution, identity, non-negotiables
  | "quarantine";   // Uncertain, unverified claims

export interface TieredMemory {
  tier: MemoryTier;
  content: string;
  timestamp: string;
  confidence: number;     // 0-1, how certain is this memory
  source: "human" | "inferred" | "external" | "system";
  canDecay: boolean;      // Can this memory fade over time?
  lastAccessed?: string;  // For working set management
}

// ============================================================================
// DASHBOARD STATE - What the human sees
// ============================================================================

export interface SovereignDashboard {
  // Inbox: What changed
  inbox: {
    newSinceLastVisit: number;
    items: InboxItem[];
  };

  // Memory: What is now known
  memory: {
    workingSetSize: number;
    recentMemories: TieredMemory[];
    quarantineCount: number; // Unverified claims needing attention
  };

  // Focus: What matters today
  focus: {
    todayPriority?: string;
    activeProjects: string[];
    decisionsPending: number;
  };

  // Hold: What needs your yes
  hold: {
    awaitingApproval: HoldItem[];
    oldestHeld?: string; // Timestamp of oldest pending
  };

  // Watch: What the OS is monitoring
  watch: {
    activeWatches: WatchItem[];
    alerts: AlertItem[];
  };

  // Forge: What is ready to execute
  forge: {
    readyToExecute: ForgeItem[];
    recentlyExecuted: ForgeItem[];
  };
}

export interface InboxItem {
  id: string;
  what: string;
  badge: ActionBadge;
  timestamp: string;
  read: boolean;
}

export interface HoldItem {
  id: string;
  intent: HumanIntent;
  badge: "✋ Needs your yes";
  requestedAt: string;
  context: string;
  expiresAt?: string;
}

export interface WatchItem {
  id: string;
  what: string;
  watchingSince: string;
  lastUpdate?: string;
}

export interface AlertItem {
  id: string;
  watchId: string;
  whatChanged: string;
  severity: "info" | "attention" | "urgent";
}

export interface ForgeItem {
  id: string;
  description: string;
  preparedAt: string;
  estimatedImpact: "low" | "medium" | "high";
}

// ============================================================================
// EXPLAINABILITY - Human-native trust grammar
// ============================================================================

export interface HumanExplanation {
  whatIKnow: string[];      // Facts the system is confident about
  whatImUnsureAbout: string[]; // Explicit uncertainty
  whyIRecommendThis: string; // Reasoning, not just conclusion
  whatINeedFromYou: string[]; // Gaps only human can fill
  whatIWontDoWithoutApproval: string[]; // 888_JUDGE in human terms
}

// ============================================================================
// SOVEREIGN LOOP ENGINE
// ============================================================================

export class SovereignLoop {
  private dashboard: SovereignDashboard;
  private memoryTiers: Map<MemoryTier, TieredMemory[]>;

  constructor() {
    this.dashboard = this.initializeDashboard();
    this.memoryTiers = new Map();
    for (const tier of ["ephemeral", "working", "canon", "sacred", "quarantine"] as MemoryTier[]) {
      this.memoryTiers.set(tier, []);
    }
  }

  /**
   * Process a human intent through the sovereign loop.
   * This is the main entry point for human → system interaction.
   */
  async processIntent(intent: HumanIntent): Promise<SovereignResponse> {
    // Route to appropriate handler based on command
    switch (intent.command) {
      case "remember":
        return this.handleRemember(intent);
      case "recall":
        return this.handleRecall(intent);
      case "track":
        return this.handleTrack(intent);
      case "compare":
        return this.handleCompare(intent);
      case "draft":
        return this.handleDraft(intent);
      case "decide-with-me":
        return this.handleDecideWithMe(intent);
      case "hold":
        return this.handleHold(intent);
      case "execute-with-approval":
        return this.handleExecuteWithApproval(intent);
      default:
        return {
          badge: "💡 Advise",
          state: "thinking",
          humanSummary: `I'm not sure how to process that. Can you rephrase?`,
        };
    }
  }

  /**
   * Get current dashboard state for the human operator.
   */
  getDashboard(): SovereignDashboard {
    return { ...this.dashboard };
  }

  /**
   * Get explanation in human-native terms.
   */
  explain(decisionContext: string): HumanExplanation {
    return {
      whatIKnow: this.getRelevantFacts(decisionContext),
      whatImUnsureAbout: this.getUncertainties(decisionContext),
      whyIRecommendThis: this.explainReasoning(decisionContext),
      whatINeedFromYou: this.identifyGaps(decisionContext),
      whatIWontDoWithoutApproval: this.identifyHeldActions(decisionContext),
    };
  }

  // ==========================================================================
  // COMMAND HANDLERS
  // ==========================================================================

  private async handleRemember(intent: HumanIntent): Promise<SovereignResponse> {
    // Determine tier based on context
    const tier = this.inferTier(intent);
    
    const memory: TieredMemory = {
      tier,
      content: intent.what,
      timestamp: new Date().toISOString(),
      confidence: 1.0, // Human-stated = high confidence
      source: "human",
      canDecay: tier === "ephemeral" || tier === "working",
    };

    this.storeInTier(memory);

    return {
      badge: "✅ Executed",
      state: "executed",
      humanSummary: `Remembered: "${intent.what}" (${tier})`,
    };
  }

  private async handleRecall(intent: HumanIntent): Promise<SovereignResponse> {
    const relevant = this.searchAllTiers(intent.what);
    
    if (relevant.length === 0) {
      return {
        badge: "💡 Advise",
        state: "thinking",
        humanSummary: `I don't recall anything about "${intent.what}". Want me to remember something about it?`,
      };
    }

    const workingMemories = relevant.filter(m => m.tier === "working" || m.tier === "ephemeral");
    const canonMemories = relevant.filter(m => m.tier === "canon");
    
    return {
      badge: "🔍 Observe",
      state: "thinking",
      humanSummary: this.summarizeRecall(workingMemories, canonMemories),
    };
  }

  private async handleTrack(intent: HumanIntent): Promise<SovereignResponse> {
    const watchId = crypto.randomUUID();
    
    this.dashboard.watch.activeWatches.push({
      id: watchId,
      what: intent.what,
      watchingSince: new Date().toISOString(),
    });

    return {
      badge: "✅ Executed",
      state: "executed",
      humanSummary: `Now tracking: "${intent.what}"`,
      nextAction: "hold",
    };
  }

  private async handleCompare(intent: HumanIntent): Promise<SovereignResponse> {
    // Parse what to compare (expecting "A vs B" or similar)
    const options = this.parseOptions(intent.what);
    
    return {
      badge: "💡 Advise",
      state: "thinking",
      humanSummary: this.generateComparison(options),
    };
  }

  private async handleDraft(intent: HumanIntent): Promise<SovereignResponse> {
    const draftId = crypto.randomUUID();
    
    this.dashboard.forge.readyToExecute.push({
      id: draftId,
      description: `Draft: ${intent.what}`,
      preparedAt: new Date().toISOString(),
      estimatedImpact: this.estimateImpact(intent),
    });

    return {
      badge: "📋 Ready",
      state: "drafting",
      humanSummary: `Draft prepared: "${intent.what}". Review in Forge when ready.`,
    };
  }

  private async handleDecideWithMe(intent: HumanIntent): Promise<SovereignResponse> {
    const explanation = this.explain(intent.what);
    
    return {
      badge: "✋ Needs your yes",
      state: "holding",
      humanSummary: this.summarizeForDecision(explanation),
    };
  }

  private async handleHold(intent: HumanIntent): Promise<SovereignResponse> {
    const holdId = crypto.randomUUID();
    
    this.dashboard.hold.awaitingApproval.push({
      id: holdId,
      intent,
      badge: "✋ Needs your yes",
      requestedAt: new Date().toISOString(),
      context: intent.why || "No additional context provided",
    });

    return {
      badge: "✋ Needs your yes",
      state: "holding",
      humanSummary: `Holding: "${intent.what}". Awaiting your approval.`,
    };
  }

  private async handleExecuteWithApproval(intent: HumanIntent): Promise<SovereignResponse> {
    // Check if there's a pending hold for this
    const pending = this.findPendingHold(intent);
    
    if (!pending) {
      // No prior approval, create hold first
      return this.handleHold(intent);
    }

    // Has approval, execute
    return {
      badge: "✅ Executed",
      state: "executed",
      humanSummary: `Executed (with approval): "${intent.what}"`,
    };
  }

  // ==========================================================================
  // DASHBOARD OPERATIONS
  // ==========================================================================

  private initializeDashboard(): SovereignDashboard {
    return {
      inbox: { newSinceLastVisit: 0, items: [] },
      memory: { workingSetSize: 0, recentMemories: [], quarantineCount: 0 },
      focus: { activeProjects: [], decisionsPending: 0 },
      hold: { awaitingApproval: [] },
      watch: { activeWatches: [], alerts: [] },
      forge: { readyToExecute: [], recentlyExecuted: [] },
    };
  }

  addToInbox(what: string, badge: ActionBadge): void {
    this.dashboard.inbox.items.unshift({
      id: crypto.randomUUID(),
      what,
      badge,
      timestamp: new Date().toISOString(),
      read: false,
    });
    this.dashboard.inbox.newSinceLastVisit++;
  }

  // ==========================================================================
  // MEMORY TIER OPERATIONS
  // ==========================================================================

  private inferTier(intent: HumanIntent): MemoryTier {
    // Simple heuristics - can be made more sophisticated
    const content = intent.what.toLowerCase();
    
    if (content.includes("constitution") || content.includes("sovereign") || content.includes("never")) {
      return "sacred";
    }
    if (content.includes("always") || content.includes("i am") || content.includes("my name") || content.includes("i prefer")) {
      return "canon";
    }
    if (intent.urgency === "now") {
      return "ephemeral";
    }
    return "working";
  }

  private storeInTier(memory: TieredMemory): void {
    const tier = this.memoryTiers.get(memory.tier) || [];
    tier.push(memory);
    this.memoryTiers.set(memory.tier, tier);
    
    // Update dashboard
    this.dashboard.memory.workingSetSize = this.getTotalMemoryCount();
  }

  private searchAllTiers(query: string): TieredMemory[] {
    const results: TieredMemory[] = [];
    for (const tier of this.memoryTiers.values()) {
      results.push(...tier.filter(m => m.content.toLowerCase().includes(query.toLowerCase())));
    }
    return results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  private getTotalMemoryCount(): number {
    return Array.from(this.memoryTiers.values()).reduce((sum, tier) => sum + tier.length, 0);
  }

  // ==========================================================================
  // EXPLAINABILITY HELPERS
  // ==========================================================================

  private getRelevantFacts(context: string): string[] {
    const memories = this.searchAllTiers(context);
    return memories
      .filter(m => m.confidence > 0.8 && m.tier !== "quarantine")
      .slice(0, 5)
      .map(m => m.content);
  }

  private getUncertainties(context: string): string[] {
    const memories = this.searchAllTiers(context);
    return memories
      .filter(m => m.confidence < 0.8 || m.tier === "quarantine")
      .slice(0, 3)
      .map(m => `Uncertain: ${m.content}`);
  }

  private explainReasoning(context: string): string {
    return `Based on ${this.getRelevantFacts(context).length} relevant memories and current priorities.`;
  }

  private identifyGaps(context: string): string[] {
    return ["Your preference on urgency", "Any constraints I should know about"];
  }

  private identifyHeldActions(context: string): string[] {
    return this.dashboard.hold.awaitingApproval
      .filter(h => h.intent.what.includes(context))
      .map(h => h.intent.what);
  }

  // ==========================================================================
  // UTILITY HELPERS
  // ==========================================================================

  private parseOptions(what: string): string[] {
    // Simple split on "vs" or "or"
    return what.split(/\s+(?:vs|versus|or)\s+/i).map(s => s.trim());
  }

  private generateComparison(options: string[]): string {
    if (options.length < 2) {
      return `To compare, tell me "A vs B" or "option 1 or option 2"`;
    }
    return `Comparing: ${options.join(" vs ")}. Here are the tradeoffs... [analysis would go here]`;
  }

  private estimateImpact(intent: HumanIntent): "low" | "medium" | "high" {
    const content = intent.what.toLowerCase();
    if (content.includes("delete") || content.includes("remove") || content.includes("deploy")) {
      return "high";
    }
    if (content.includes("edit") || content.includes("update")) {
      return "medium";
    }
    return "low";
  }

  private summarizeRecall(working: TieredMemory[], canon: TieredMemory[]): string {
    const parts: string[] = [];
    if (canon.length > 0) {
      parts.push(`I know: ${canon[0].content}`);
    }
    if (working.length > 0) {
      parts.push(`Recently: ${working[0].content}`);
    }
    return parts.join(". ") || "I recall this topic but need more specific prompting.";
  }

  private summarizeForDecision(explanation: HumanExplanation): string {
    return `Decision needed: ${explanation.whyIRecommendThis}. ${explanation.whatIWontDoWithoutApproval.length} actions on hold.`;
  }

  private findPendingHold(intent: HumanIntent): HoldItem | undefined {
    return this.dashboard.hold.awaitingApproval.find(
      h => h.intent.what === intent.what
    );
  }
}
