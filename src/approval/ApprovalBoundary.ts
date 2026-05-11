/**
 * Approval Boundary
 * 
 * P0.5: Make approval boundaries first-class and dead simple
 * 
 * Standardizes action states: Observe, Advise, Ready, Needs Yes, Executed.
 * Requires preview object before any side-effectful action.
 * Single Hold Queue for all actions awaiting approval.
 * 
 * @module approval/ApprovalBoundary
 * @constitutional Ψ Sovereignty - Human is final authority
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { homedir } from "node:os";

// ============================================================================
// ACTION BADGES (Human-visible states)
// ============================================================================

export type ActionBadge =
  | "🔍 Observe"      // System noticed something
  | "💡 Advise"       // System has a suggestion
  | "📋 Ready"        // Draft prepared, waiting for human
  | "✋ Needs Yes"    // Explicit approval required
  | "✅ Executed"     // Done, with record
  | "❌ Rejected";    // Human declined

export type ActionState = 
  | "thinking"        // System is processing
  | "drafting"        // Preparing preview
  | "holding"         // Awaiting approval
  | "ready"           // Prepared, no approval needed (low risk)
  | "approved"        // Approved, ready to execute
  | "executing"       // Currently executing
  | "executed"        // Complete
  | "rejected"        // Declined by human
  | "expired";        // Approval window expired

// ============================================================================
// PREVIEW OBJECT
// ============================================================================

export interface ActionPreview {
  /** What will happen in plain language */
  whatWillHappen: string;
  
  /** List of specific side effects */
  sideEffects: string[];
  
  /** What files/data will be modified */
  modifications?: {
    path: string;
    operation: "create" | "modify" | "delete";
    preview?: string; // Preview of changes
  }[];
  
  /** Commands that will be run */
  commands?: {
    command: string;
    purpose: string;
    risk: "low" | "medium" | "high" | "critical";
  }[];
  
  /** How to undo this action */
  rollbackPlan?: string;
  
  /** Estimated time to complete */
  estimatedDuration?: string;
  
  /** Cost estimate if applicable */
  estimatedCost?: {
    tokens?: number;
    compute?: string;
    apiCalls?: number;
  };
  
  /** Risk assessment */
  riskAssessment: {
    level: "minimal" | "low" | "medium" | "high" | "critical";
    concerns: string[];
    mitigations: string[];
  };
  
  /** Why this action is recommended */
  reasoning: string;
}

// ============================================================================
// HOLD QUEUE ITEM
// ============================================================================

export interface HoldQueueItem {
  /** Unique identifier */
  holdId: string;
  
  /** Current badge/state */
  badge: ActionBadge;
  state: ActionState;
  
  /** Human description */
  description: string;
  
  /** The preview of what will happen */
  preview: ActionPreview;
  
  /** When this was created */
  createdAt: string;
  
  /** When this will expire if not approved */
  expiresAt?: string;
  
  /** When approved/rejected */
  decidedAt?: string;
  
  /** Decision by human */
  decision?: "approved" | "rejected";
  
  /** Human's reason for decision */
  decisionReason?: string;
  
  /** Risk tier */
  riskTier: ActionPreview["riskAssessment"]["level"];
  
  /** Context from conversation */
  context?: string;
  
  /** Reference to staged action (if any) */
  stagedActionId?: string;
}

// ============================================================================
// EXECUTION RECORD
// ============================================================================

export interface ExecutionRecord {
  /** Unique execution ID */
  executionId: string;
  
  /** Reference to hold item */
  holdId: string;
  
  /** When executed */
  executedAt: string;
  
  /** Result */
  result: "success" | "partial" | "failure";
  
  /** Output/logs */
  output?: string;
  
  /** Errors if any */
  errors?: string[];
  
  /** Actual side effects that occurred */
  actualSideEffects: string[];
}

// ============================================================================
// APPROVAL BOUNDARY CLASS
// ============================================================================

export class ApprovalBoundary {
  private holdQueue: Map<string, HoldQueueItem> = new Map();
  private executionHistory: ExecutionRecord[] = [];
  private storePath: string;
  private defaultExpiryHours = 24;

  constructor(options?: { storePath?: string; defaultExpiryHours?: number }) {
    this.storePath = options?.storePath ?? `${homedir()}/.arifos/approvals.json`;
    this.defaultExpiryHours = options?.defaultExpiryHours ?? 24;
  }

  /**
   * Initialize, loading existing approvals.
   */
  async initialize(): Promise<void> {
    await this.ensureStoreDirectory();
    await this.loadState();
    this.startExpiryCheck();
  }

  /**
   * Create a preview without staging for execution.
   * Use this for "what if" scenarios.
   */
  createPreview(
    description: string,
    previewDetails: Omit<ActionPreview, "riskAssessment"> & { riskLevel?: ActionPreview["riskAssessment"]["level"] }
  ): ActionPreview {
    // Auto-assess risk if not provided
    const riskLevel = previewDetails.riskLevel ?? this.assessRisk(previewDetails);
    
    return {
      ...previewDetails,
      riskAssessment: {
        level: riskLevel,
        concerns: this.generateConcerns(previewDetails, riskLevel),
        mitigations: this.generateMitigations(previewDetails, riskLevel),
      },
    };
  }

  /**
   * Stage an action for potential execution.
   * Returns preview with badge: 📋 Ready or ✋ Needs Yes depending on risk.
   */
  stageAction(
    description: string,
    preview: ActionPreview,
    context?: string,
    stagedActionId?: string
  ): HoldQueueItem {
    // AFK auto-approve: low/minimal risk + AFK_MODE + ENABLE_DANGEROUS_TOOLS → skip hold
    const isLowRisk =
      preview.riskAssessment.level === "minimal" ||
      preview.riskAssessment.level === "low";
    const isAfkAutoApprove =
      process.env.ENABLE_AFK_AUTO_APPROVE === "1" &&
      process.env.AFK_MODE === "true" &&
      isLowRisk &&
      process.env.ENABLE_DANGEROUS_TOOLS === "1";

    const requiresExplicitApproval =
      !isAfkAutoApprove &&
      preview.riskAssessment.level !== "minimal" &&
      preview.riskAssessment.level !== "low";

    const badge: ActionBadge = isAfkAutoApprove
      ? "🤖 AFK-Auto"
      : requiresExplicitApproval
        ? "✋ Needs Yes"
        : "📋 Ready";
    const state: ActionState = isAfkAutoApprove
      ? "approved"
      : requiresExplicitApproval
        ? "holding"
        : "ready";
    
    const holdId = `hold_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    
    const item: HoldQueueItem = {
      holdId,
      badge,
      state,
      description,
      preview,
      createdAt: new Date().toISOString(),
      expiresAt: this.calculateExpiry(),
      riskTier: preview.riskAssessment.level,
      context,
      stagedActionId,
    };
    
    this.holdQueue.set(holdId, item);
    this.persistState();
    
    return item;
  }

  /**
   * Approve an action.
   */
  approve(holdId: string, reason?: string): HoldQueueItem {
    const item = this.holdQueue.get(holdId);
    if (!item) {
      throw new Error(`Hold item not found: ${holdId}`);
    }
    
    if (item.state === "executed" || item.state === "rejected") {
      throw new Error(`Cannot approve ${item.state} action: ${holdId}`);
    }
    
    item.badge = "✅ Executed";
    item.state = "approved";
    item.decision = "approved";
    item.decidedAt = new Date().toISOString();
    item.decisionReason = reason;
    
    this.persistState();
    
    return item;
  }

  /**
   * Reject an action.
   */
  reject(holdId: string, reason?: string): HoldQueueItem {
    const item = this.holdQueue.get(holdId);
    if (!item) {
      throw new Error(`Hold item not found: ${holdId}`);
    }
    
    if (item.state === "executed") {
      throw new Error(`Cannot reject executed action: ${holdId}`);
    }
    
    item.badge = "❌ Rejected";
    item.state = "rejected";
    item.decision = "rejected";
    item.decidedAt = new Date().toISOString();
    item.decisionReason = reason;
    
    this.persistState();
    
    return item;
  }

  /**
   * Mark an action as executing.
   */
  markExecuting(holdId: string): void {
    const item = this.holdQueue.get(holdId);
    if (item) {
      item.state = "executing";
      this.persistState();
    }
  }

  /**
   * Mark an action as executed with results.
   */
  markExecuted(
    holdId: string, 
    result: ExecutionRecord["result"],
    output?: string,
    errors?: string[],
    actualSideEffects?: string[]
  ): ExecutionRecord {
    const item = this.holdQueue.get(holdId);
    if (!item) {
      throw new Error(`Hold item not found: ${holdId}`);
    }
    
    item.badge = "✅ Executed";
    item.state = "executed";
    
    const record: ExecutionRecord = {
      executionId: `exec_${Date.now()}`,
      holdId,
      executedAt: new Date().toISOString(),
      result,
      output,
      errors,
      actualSideEffects: actualSideEffects ?? [],
    };
    
    this.executionHistory.push(record);
    this.persistState();
    
    return record;
  }

  /**
   * Get current hold queue.
   */
  getHoldQueue(options?: { 
    state?: ActionState; 
    riskTier?: ActionPreview["riskAssessment"]["level"];
  }): HoldQueueItem[] {
    let items = Array.from(this.holdQueue.values());
    
    if (options?.state) {
      items = items.filter(i => i.state === options.state);
    }
    
    if (options?.riskTier) {
      items = items.filter(i => i.riskTier === options.riskTier);
    }
    
    // Sort by risk (high first) then by creation time
    items.sort((a, b) => {
      const riskOrder = { critical: 0, high: 1, medium: 2, low: 3, minimal: 4 };
      if (riskOrder[a.riskTier] !== riskOrder[b.riskTier]) {
        return riskOrder[a.riskTier] - riskOrder[b.riskTier];
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    
    return items;
  }

  /**
   * Get a specific hold item.
   */
  getHoldItem(holdId: string): HoldQueueItem | undefined {
    return this.holdQueue.get(holdId);
  }

  /**
   * Get execution history.
   */
  getExecutionHistory(holdId?: string): ExecutionRecord[] {
    if (holdId) {
      return this.executionHistory.filter(e => e.holdId === holdId);
    }
    return [...this.executionHistory];
  }

  /**
   * Get summary for dashboard.
   */
  getSummary(): {
    awaitingApproval: number;
    ready: number;
    executed: number;
    rejected: number;
    expired: number;
    highRisk: number;
  } {
    const items = Array.from(this.holdQueue.values());
    
    return {
      awaitingApproval: items.filter(i => i.state === "holding").length,
      ready: items.filter(i => i.state === "ready" || i.state === "approved").length,
      executed: items.filter(i => i.state === "executed").length,
      rejected: items.filter(i => i.state === "rejected").length,
      expired: items.filter(i => i.state === "expired").length,
      highRisk: items.filter(i => i.riskTier === "high" || i.riskTier === "critical").length,
    };
  }

  /**
   * Format hold queue for human consumption.
   */
  formatHoldQueue(): string {
    const holding = this.getHoldQueue({ state: "holding" });
    
    if (holding.length === 0) {
      return "✋ Nothing awaiting your approval.";
    }
    
    const lines: string[] = [
      `✋ ${holding.length} item${holding.length === 1 ? "" : "s"} awaiting your approval:`,
      "",
    ];
    
    for (const item of holding.slice(0, 5)) {
      const riskIcon = item.riskTier === "critical" ? "🔴" :
                       item.riskTier === "high" ? "🟠" :
                       item.riskTier === "medium" ? "🟡" : "🟢";
      
      lines.push(`${riskIcon} ${item.description}`);
      lines.push(`   ${item.preview.whatWillHappen.slice(0, 60)}${item.preview.whatWillHappen.length > 60 ? "..." : ""}`);
      
      if (item.preview.riskAssessment.concerns.length > 0) {
        lines.push(`   ⚠️  ${item.preview.riskAssessment.concerns[0]}`);
      }
      
      lines.push(`   ID: ${item.holdId}`);
      lines.push("");
    }
    
    if (holding.length > 5) {
      lines.push(`... and ${holding.length - 5} more`);
    }
    
    return lines.join("\n");
  }

  /**
   * Check if any action needs immediate attention (critical risk).
   */
  hasCriticalItems(): boolean {
    return Array.from(this.holdQueue.values())
      .some(i => i.riskTier === "critical" && i.state === "holding");
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private async ensureStoreDirectory(): Promise<void> {
    await mkdir(dirname(this.storePath), { recursive: true });
  }

  private async loadState(): Promise<void> {
    try {
      const data = await readFile(this.storePath, "utf-8");
      const state = JSON.parse(data);
      
      if (state.holdQueue) {
        this.holdQueue = new Map(Object.entries(state.holdQueue));
      }
      if (state.executionHistory) {
        this.executionHistory = state.executionHistory;
      }
    } catch {
      // No existing state
    }
  }

  private persistState(): void {
    const state = {
      holdQueue: Object.fromEntries(this.holdQueue),
      executionHistory: this.executionHistory.slice(-100), // Keep last 100
      savedAt: new Date().toISOString(),
    };
    
    writeFile(this.storePath, JSON.stringify(state, null, 2)).catch(console.error);
  }

  private calculateExpiry(): string {
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + this.defaultExpiryHours);
    return expiry.toISOString();
  }

  private startExpiryCheck(): void {
    // Check for expired items every 5 minutes
    setInterval(() => {
      const now = new Date().toISOString();
      let changed = false;
      
      for (const [id, item] of this.holdQueue) {
        if (item.expiresAt && item.expiresAt < now && 
            item.state !== "executed" && item.state !== "rejected" && item.state !== "expired") {
          (item as HoldQueueItem).state = "expired";
          (item as HoldQueueItem).badge = "❌ Rejected";
          changed = true;
        }
      }
      
      if (changed) {
        this.persistState();
      }
    }, 5 * 60 * 1000);
  }

  private assessRisk(preview: Omit<ActionPreview, "riskAssessment">): ActionPreview["riskAssessment"]["level"] {
    // Simple heuristic based on modifications and commands
    let score = 0;
    
    if (preview.modifications) {
      for (const mod of preview.modifications) {
        if (mod.operation === "delete") score += 3;
        if (mod.operation === "modify") score += 1;
      }
    }
    
    if (preview.commands) {
      for (const cmd of preview.commands) {
        if (cmd.risk === "critical") score += 5;
        if (cmd.risk === "high") score += 3;
        if (cmd.risk === "medium") score += 1;
      }
    }
    
    if (score >= 5) return "critical";
    if (score >= 3) return "high";
    if (score >= 1) return "medium";
    return "low";
  }

  private generateConcerns(
    preview: Omit<ActionPreview, "riskAssessment">, 
    riskLevel: ActionPreview["riskAssessment"]["level"]
  ): string[] {
    const concerns: string[] = [];
    
    if (preview.modifications?.some(m => m.operation === "delete")) {
      concerns.push("Will delete data");
    }
    
    if (preview.commands?.some(c => c.risk === "high" || c.risk === "critical")) {
      concerns.push("Executes high-risk commands");
    }
    
    if (!preview.rollbackPlan) {
      concerns.push("No rollback plan specified");
    }
    
    return concerns;
  }

  private generateMitigations(
    preview: Omit<ActionPreview, "riskAssessment">,
    riskLevel: ActionPreview["riskAssessment"]["level"]
  ): string[] {
    const mitigations: string[] = [];
    
    if (preview.rollbackPlan) {
      mitigations.push("Rollback plan available");
    }
    
    if (preview.modifications?.every(m => m.operation === "create")) {
      mitigations.push("Only creates new data (no modifications)");
    }
    
    return mitigations;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let globalBoundary: ApprovalBoundary | null = null;

export function getApprovalBoundary(): ApprovalBoundary {
  if (!globalBoundary) {
    globalBoundary = new ApprovalBoundary();
  }
  return globalBoundary;
}
