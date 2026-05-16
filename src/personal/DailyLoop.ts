/**
 * Daily Life Loop
 * 
 * The recurring human rhythm for a personal AI OS.
 * Not features — habits. Not capabilities — companionship.
 * 
 * @module personal/DailyLoop
 * @constitutional F1 Amanah - Faithful stewardship of human time
 */

import type { SovereignLoop, HumanIntent, SovereignDashboard } from "./SovereignLoop.js";

// ============================================================================
// DAILY LOOP TYPES
// ============================================================================

export interface MorningContext {
  date: string;
  overnightChanges: ChangeSummary[];
  topPriorities: string[];
  decisionsPending: DecisionItem[];
  thingsToWatch: WatchReminder[];
  memoryUpdates: MemoryDigest;
}

export interface EveningClosure {
  date: string;
  completedToday: string[];
  carriedForward: string[];
  newCommitments: string[];
  tomorrowPreview: string[];
  memoryToConsolidate: string[];
}

export interface ProjectLoop {
  projectId: string;
  goal: string;
  openQuestions: string[];
  artifacts: Artifact[];
  nextActions: ActionItem[];
  risks: RiskItem[];
  lastUpdated: string;
}

export interface LifeMemoryLoop {
  stableFacts: FactItem[];
  evolvingPreferences: PreferenceItem[];
  commitments: CommitmentItem[];
  lessonsLearned: LessonItem[];
  lastReviewed: string;
}

// ============================================================================
// SUPPORTING TYPES
// ============================================================================

export interface ChangeSummary {
  what: string;
  source: "watch" | "inbox" | "external" | "system";
  severity: "info" | "attention" | "urgent";
}

export interface DecisionItem {
  id: string;
  question: string;
  context: string;
  options: string[];
  heldSince: string;
}

export interface WatchReminder {
  watchId: string;
  what: string;
  whyItMatters: string;
  lastAlert?: string;
}

export interface MemoryDigest {
  newMemories: number;
  quarantinedClaims: number;
  canonUpdates: number;
  suggestionsForReview: string[];
}

export interface Artifact {
  id: string;
  name: string;
  type: "doc" | "code" | "note" | "link" | "data";
  lastModified: string;
}

export interface ActionItem {
  id: string;
  description: string;
  status: "ready" | "blocked" | "pending";
  blockedBy?: string;
}

export interface RiskItem {
  id: string;
  description: string;
  likelihood: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  mitigation?: string;
}

export interface FactItem {
  id: string;
  fact: string;
  confidence: number;
  establishedDate: string;
  sources: string[];
}

export interface PreferenceItem {
  id: string;
  preference: string;
  strength: "weak" | "moderate" | "strong";
  evolution: PreferenceEvolution[];
}

export interface PreferenceEvolution {
  date: string;
  value: string;
  trigger?: string;
}

export interface CommitmentItem {
  id: string;
  commitment: string;
  madeDate: string;
  toWhom: string;
  deadline?: string;
  status: "active" | "fulfilled" | "at-risk" | "broken";
}

export interface LessonItem {
  id: string;
  lesson: string;
  learnedFrom: string;
  date: string;
  appliedCount: number;
}

// ============================================================================
// DAILY LOOP ENGINE
// ============================================================================

export class DailyLoop {
  private sovereign: SovereignLoop;
  private projects: Map<string, ProjectLoop>;
  private lifeMemory: LifeMemoryLoop;

  constructor(sovereign: SovereignLoop) {
    this.sovereign = sovereign;
    this.projects = new Map();
    this.lifeMemory = this.initializeLifeMemory();
  }

  // ==========================================================================
  // MORNING CONTEXT
  // ==========================================================================

  /**
   * Generate morning context — what the human needs to know to start the day.
   * Call this at the start of each session or scheduled morning time.
   */
  generateMorningContext(): MorningContext {
    const dashboard = this.sovereign.getDashboard();
    const today = new Date().toISOString().split("T")[0];

    return {
      date: today,
      overnightChanges: this.summarizeChanges(dashboard),
      topPriorities: this.extractTopPriorities(dashboard),
      decisionsPending: this.formatDecisions(dashboard.hold.awaitingApproval),
      thingsToWatch: this.formatWatches(dashboard.watch),
      memoryUpdates: this.summarizeMemory(dashboard.memory),
    };
  }

  /**
   * Format morning context for human consumption.
   */
  formatMorningContext(context: MorningContext): string {
    const lines: string[] = [
      `🌅 Morning Context — ${context.date}`,
      "",
    ];

    if (context.overnightChanges.length > 0) {
      lines.push("📬 What Changed:");
      for (const change of context.overnightChanges) {
        const icon = change.severity === "urgent" ? "🔴" : change.severity === "attention" ? "🟡" : "🟢";
        lines.push(`  ${icon} ${change.what}`);
      }
      lines.push("");
    }

    if (context.topPriorities.length > 0) {
      lines.push("🎯 Top Priorities Today:");
      for (const priority of context.topPriorities.slice(0, 3)) {
        lines.push(`  • ${priority}`);
      }
      lines.push("");
    }

    if (context.decisionsPending.length > 0) {
      lines.push(`✋ Decisions Awaiting You (${context.decisionsPending.length}):`);
      for (const decision of context.decisionsPending.slice(0, 3)) {
        lines.push(`  • ${decision.question}`);
      }
      lines.push("");
    }

    if (context.memoryUpdates.quarantinedClaims > 0) {
      lines.push(`⚠️  Memory: ${context.memoryUpdates.quarantinedClaims} claims need your verification`);
      lines.push("");
    }

    lines.push("What would you like to focus on?");

    return lines.join("\n");
  }

  // ==========================================================================
  // EVENING CLOSURE
  // ==========================================================================

  /**
   * Generate evening closure — what to carry forward, what to remember.
   */
  generateEveningClosure(completedItems: string[]): EveningClosure {
    const dashboard = this.sovereign.getDashboard();
    const today = new Date().toISOString().split("T")[0];

    const carriedForward = dashboard.hold.awaitingApproval
      .filter(h => !completedItems.includes(h.intent.what))
      .map(h => h.intent.what);

    return {
      date: today,
      completedToday: completedItems,
      carriedForward,
      newCommitments: this.extractCommitments(dashboard),
      tomorrowPreview: this.previewTomorrow(dashboard),
      memoryToConsolidate: dashboard.memory.quarantineCount > 0 
        ? ["Review quarantined memory claims"]
        : [],
    };
  }

  /**
   * Format evening closure for human consumption.
   */
  formatEveningClosure(closure: EveningClosure): string {
    const lines: string[] = [
      `🌆 Evening Closure — ${closure.date}`,
      "",
      `✅ Completed Today (${closure.completedToday.length}):`,
      ...closure.completedToday.map(c => `  • ${c}`),
      "",
    ];

    if (closure.carriedForward.length > 0) {
      lines.push(`📦 Carrying Forward (${closure.carriedForward.length}):`);
      for (const item of closure.carriedForward.slice(0, 5)) {
        lines.push(`  • ${item}`);
      }
      lines.push("");
    }

    if (closure.newCommitments.length > 0) {
      lines.push("🤝 New Commitments Made:");
      for (const commitment of closure.newCommitments) {
        lines.push(`  • ${commitment}`);
      }
      lines.push("");
    }

    if (closure.tomorrowPreview.length > 0) {
      lines.push("📅 Tomorrow Preview:");
      for (const item of closure.tomorrowPreview.slice(0, 3)) {
        lines.push(`  • ${item}`);
      }
      lines.push("");
    }

    lines.push("Good work today. Rest well.");

    return lines.join("\n");
  }

  // ==========================================================================
  // PROJECT LOOP
  // ==========================================================================

  /**
   * Create or update a project loop.
   */
  updateProject(projectId: string, updates: Partial<ProjectLoop>): void {
    const existing = this.projects.get(projectId);
    if (existing) {
      this.projects.set(projectId, {
        ...existing,
        ...updates,
        lastUpdated: new Date().toISOString(),
      });
    } else {
      this.projects.set(projectId, {
        projectId,
        goal: updates.goal || "",
        openQuestions: updates.openQuestions || [],
        artifacts: updates.artifacts || [],
        nextActions: updates.nextActions || [],
        risks: updates.risks || [],
        lastUpdated: new Date().toISOString(),
      });
    }
  }

  /**
   * Get project status formatted for human.
   */
  getProjectStatus(projectId: string): string {
    const project = this.projects.get(projectId);
    if (!project) {
      return `Project "${projectId}" not found.`;
    }

    const lines: string[] = [
      `📁 Project: ${project.goal}`,
      `   Last updated: ${project.lastUpdated}`,
      "",
    ];

    if (project.openQuestions.length > 0) {
      lines.push("❓ Open Questions:");
      for (const q of project.openQuestions) {
        lines.push(`  • ${q}`);
      }
      lines.push("");
    }

    if (project.nextActions.length > 0) {
      const ready = project.nextActions.filter(a => a.status === "ready");
      const blocked = project.nextActions.filter(a => a.status === "blocked");
      
      lines.push(`⚡ Next Actions (${ready.length} ready, ${blocked.length} blocked):`);
      for (const action of project.nextActions.slice(0, 5)) {
        const icon = action.status === "ready" ? "▶️" : action.status === "blocked" ? "🚫" : "⏳";
        lines.push(`  ${icon} ${action.description}`);
      }
      lines.push("");
    }

    if (project.risks.length > 0) {
      const highRisks = project.risks.filter(r => r.likelihood === "high" || r.impact === "high");
      if (highRisks.length > 0) {
        lines.push("⚠️  High Risks:");
        for (const risk of highRisks) {
          lines.push(`  • ${risk.description}`);
        }
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  // ==========================================================================
  // LIFE MEMORY LOOP
  // ==========================================================================

  /**
   * Add a stable fact to personal canon.
   */
  addStableFact(fact: string, sources: string[]): void {
    this.lifeMemory.stableFacts.push({
      id: crypto.randomUUID(),
      fact,
      confidence: 1.0,
      establishedDate: new Date().toISOString(),
      sources,
    });
  }

  /**
   * Record an evolving preference (with history).
   */
  recordPreference(preference: string, value: string, strength: "weak" | "moderate" | "strong", trigger?: string): void {
    const existing = this.lifeMemory.evolvingPreferences.find(p => p.preference === preference);
    
    if (existing) {
      existing.evolution.push({
        date: new Date().toISOString(),
        value,
        trigger,
      });
      existing.strength = strength;
    } else {
      this.lifeMemory.evolvingPreferences.push({
        id: crypto.randomUUID(),
        preference,
        strength,
        evolution: [{
          date: new Date().toISOString(),
          value,
          trigger,
        }],
      });
    }
  }

  /**
   * Record a commitment made.
   */
  recordCommitment(commitment: string, toWhom: string, deadline?: string): void {
    this.lifeMemory.commitments.push({
      id: crypto.randomUUID(),
      commitment,
      madeDate: new Date().toISOString(),
      toWhom,
      deadline,
      status: "active",
    });
  }

  /**
   * Record a lesson learned.
   */
  recordLesson(lesson: string, learnedFrom: string): void {
    this.lifeMemory.lessonsLearned.push({
      id: crypto.randomUUID(),
      lesson,
      learnedFrom,
      date: new Date().toISOString(),
      appliedCount: 0,
    });
  }

  /**
   * Get life memory summary.
   */
  getLifeMemorySummary(): string {
    const lines: string[] = [
      "🧠 Life Memory Summary",
      `   Last reviewed: ${this.lifeMemory.lastReviewed}`,
      "",
      `📌 Stable Facts: ${this.lifeMemory.stableFacts.length}`,
      `💭 Evolving Preferences: ${this.lifeMemory.evolvingPreferences.length}`,
      `🤝 Active Commitments: ${this.lifeMemory.commitments.filter(c => c.status === "active").length}`,
      `🎓 Lessons Learned: ${this.lifeMemory.lessonsLearned.length}`,
    ];

    return lines.join("\n");
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private summarizeChanges(dashboard: SovereignDashboard): ChangeSummary[] {
    const changes: ChangeSummary[] = [];
    
    for (const item of dashboard.inbox.items.filter(i => !i.read)) {
      changes.push({
        what: item.what,
        source: "inbox",
        severity: item.badge === "✋ Needs your yes" ? "attention" : "info",
      });
    }

    for (const alert of dashboard.watch.alerts) {
      changes.push({
        what: alert.whatChanged,
        source: "watch",
        severity: alert.severity,
      });
    }

    return changes;
  }

  private extractTopPriorities(dashboard: SovereignDashboard): string[] {
    const priorities: string[] = [];
    
    if (dashboard.focus.todayPriority) {
      priorities.push(dashboard.focus.todayPriority);
    }
    
    // Add items needing approval as implicit priorities
    for (const hold of dashboard.hold.awaitingApproval.slice(0, 2)) {
      priorities.push(`Decide: ${hold.intent.what}`);
    }
    
    return priorities;
  }

  private formatDecisions(holds: { intent: HumanIntent; requestedAt: string }[]): DecisionItem[] {
    return holds.map(h => ({
      id: crypto.randomUUID(),
      question: h.intent.what,
      context: h.intent.why || "",
      options: [], // Could be extracted from context
      heldSince: h.requestedAt,
    }));
  }

  private formatWatches(watch: SovereignDashboard["watch"]): WatchReminder[] {
    return watch.activeWatches.map(w => ({
      watchId: w.id,
      what: w.what,
      whyItMatters: "Monitoring for changes",
      lastUpdate: w.lastUpdate,
    }));
  }

  private summarizeMemory(memory: SovereignDashboard["memory"]): MemoryDigest {
    return {
      newMemories: memory.recentMemories.length,
      quarantinedClaims: memory.quarantineCount,
      canonUpdates: 0, // Would track separately
      suggestionsForReview: memory.quarantineCount > 0 
        ? ["Review quarantined claims for accuracy"]
        : [],
    };
  }

  private extractCommitments(dashboard: SovereignDashboard): string[] {
    // Extract from recent executed items that sound like commitments
    return [];
  }

  private previewTomorrow(dashboard: SovereignDashboard): string[] {
    const preview: string[] = [];
    
    for (const forge of dashboard.forge.readyToExecute) {
      preview.push(`Forge: ${forge.description}`);
    }
    
    return preview;
  }

  private initializeLifeMemory(): LifeMemoryLoop {
    return {
      stableFacts: [],
      evolvingPreferences: [],
      commitments: [],
      lessonsLearned: [],
      lastReviewed: new Date().toISOString(),
    };
  }
}
