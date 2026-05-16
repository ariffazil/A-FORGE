/**
 * Continuity Store
 * 
 * P0.1: Stabilize continuity across restarts and replicas
 * 
 * Moves session continuity from ephemeral process-local state to 
 * persistent/shared continuity store.
 * 
 * @module continuity/ContinuityStore
 * @constitutional Ψ Sovereignty - Session integrity is paramount
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { homedir } from "node:os";

// ============================================================================
// TYPES
// ============================================================================

export type ContinuityState = 
  | "stable"        // Session active, all systems normal
  | "recovering"    // Restart detected, restoring session
  | "degraded"      // Partial data loss, working with what we have
  | "lost"          // Session unrecoverable
  | "rebound";      // Successfully recovered from restart

export interface SessionContext {
  sessionId: string;
  actorId: string;
  declaredName: string;
  conversationId?: string;
  establishedAt: string;
  lastActivityAt: string;
  continuityVersion: number;
}

export interface ActiveWatch {
  watchId: string;
  what: string;
  createdAt: string;
  lastCheckAt?: string;
}

export interface PendingApproval {
  holdId: string;
  intent: string;
  context: string;
  requestedAt: string;
  riskTier: "minimal" | "low" | "medium" | "high" | "critical";
  preview?: Record<string, unknown>;
}

export interface CurrentFocus {
  todayPriority?: string;
  activeProjects: string[];
  activeTask?: string;
}

export interface ContinuitySnapshot {
  session: SessionContext;
  focus: CurrentFocus;
  watches: ActiveWatch[];
  pendingApprovals: PendingApproval[];
  memoryHighWaterMark: number; // Last known memory position
  stagedActions: StagedAction[];
  checkpointAt: string;
}

export interface StagedAction {
  actionId: string;
  description: string;
  stagedAt: string;
  preview: ActionPreview;
  requiresApproval: boolean;
  approvedAt?: string;
  executedAt?: string;
}

export interface ActionPreview {
  whatWillHappen: string;
  sideEffects: string[];
  rollbackPlan?: string;
  estimatedDuration?: string;
}

export interface ContinuityStatus {
  state: ContinuityState;
  sessionId: string;
  since: string;
  lastCheckpoint: string;
  canResume: boolean;
  items: {
    watches: number;
    pendingApprovals: number;
    stagedActions: number;
  };
  message: string;
}

// ============================================================================
// CONTINUITY STORE
// ============================================================================

export class ContinuityStore {
  private storePath: string;
  private currentSnapshot: ContinuitySnapshot | null = null;
  private state: ContinuityState = "stable";
  private checkpointIntervalMs: number;
  private checkpointTimer: NodeJS.Timeout | null = null;

  constructor(options?: { 
    storePath?: string;
    checkpointIntervalMs?: number;
  }) {
    this.storePath = options?.storePath ?? `${homedir()}/.arifos/continuity.json`;
    this.checkpointIntervalMs = options?.checkpointIntervalMs ?? 30000; // 30s
  }

  /**
   * Initialize the continuity store.
   * Checks for existing session and attempts recovery if found.
   */
  async initialize(actorId: string, declaredName: string): Promise<ContinuityStatus> {
    await this.ensureStoreDirectory();
    
    const existing = await this.loadSnapshot();
    
    if (existing && existing.session.actorId === actorId) {
      // Potential recovery scenario
      this.state = "recovering";
      const recovered = await this.attemptRecovery(existing);
      return this.buildStatus(recovered);
    }
    
    // Fresh session
    const now = new Date().toISOString();
    this.currentSnapshot = {
      session: {
        sessionId: this.generateSessionId(),
        actorId,
        declaredName,
        establishedAt: now,
        lastActivityAt: now,
        continuityVersion: 1,
      },
      focus: { activeProjects: [] },
      watches: [],
      pendingApprovals: [],
      memoryHighWaterMark: 0,
      stagedActions: [],
      checkpointAt: now,
    };
    
    this.state = "stable";
    await this.checkpoint();
    this.startAutoCheckpoint();
    
    return this.buildStatus(this.currentSnapshot);
  }

  /**
   * Get current continuity status for human visibility.
   */
  getStatus(): ContinuityStatus {
    return this.buildStatus(this.currentSnapshot);
  }

  /**
   * Store a checkpoint immediately.
   */
  async checkpoint(): Promise<void> {
    if (!this.currentSnapshot) return;
    
    this.currentSnapshot.checkpointAt = new Date().toISOString();
    this.currentSnapshot.session.lastActivityAt = new Date().toISOString();
    
    const tempPath = `${this.storePath}.tmp`;
    await writeFile(tempPath, JSON.stringify(this.currentSnapshot, null, 2));
    await writeFile(this.storePath, await readFile(tempPath));
  }

  /**
   * Update current focus.
   */
  updateFocus(focus: Partial<CurrentFocus>): void {
    if (!this.currentSnapshot) return;
    
    this.currentSnapshot.focus = {
      ...this.currentSnapshot.focus,
      ...focus,
    };
  }

  /**
   * Add an active watch.
   */
  addWatch(what: string): ActiveWatch {
    if (!this.currentSnapshot) throw new Error("No active session");
    
    const watch: ActiveWatch = {
      watchId: `watch_${Date.now()}`,
      what,
      createdAt: new Date().toISOString(),
    };
    
    this.currentSnapshot.watches.push(watch);
    return watch;
  }

  /**
   * Remove a watch.
   */
  removeWatch(watchId: string): boolean {
    if (!this.currentSnapshot) return false;
    
    const idx = this.currentSnapshot.watches.findIndex(w => w.watchId === watchId);
    if (idx >= 0) {
      this.currentSnapshot.watches.splice(idx, 1);
      return true;
    }
    return false;
  }

  /**
   * Stage an action for potential execution.
   */
  stageAction(
    description: string, 
    preview: ActionPreview, 
    requiresApproval: boolean
  ): StagedAction {
    if (!this.currentSnapshot) throw new Error("No active session");
    
    const action: StagedAction = {
      actionId: `action_${Date.now()}`,
      description,
      stagedAt: new Date().toISOString(),
      preview,
      requiresApproval,
    };
    
    this.currentSnapshot.stagedActions.push(action);
    return action;
  }

  /**
   * Add pending approval.
   */
  addPendingApproval(
    intent: string, 
    context: string, 
    riskTier: PendingApproval["riskTier"],
    preview?: Record<string, unknown>
  ): PendingApproval {
    if (!this.currentSnapshot) throw new Error("No active session");
    
    const approval: PendingApproval = {
      holdId: `hold_${Date.now()}`,
      intent,
      context,
      requestedAt: new Date().toISOString(),
      riskTier,
      preview,
    };
    
    this.currentSnapshot.pendingApprovals.push(approval);
    return approval;
  }

  /**
   * Resolve pending approval.
   */
  resolveApproval(holdId: string, approved: boolean): boolean {
    if (!this.currentSnapshot) return false;
    
    const idx = this.currentSnapshot.pendingApprovals.findIndex(h => h.holdId === holdId);
    if (idx >= 0) {
      this.currentSnapshot.pendingApprovals.splice(idx, 1);
      
      // Mark associated staged action if exists
      const action = this.currentSnapshot.stagedActions.find(a => 
        a.description.includes(holdId) || a.actionId === holdId
      );
      if (action) {
        if (approved) {
          action.approvedAt = new Date().toISOString();
        } else {
          // Remove rejected action
          const actionIdx = this.currentSnapshot.stagedActions.indexOf(action);
          this.currentSnapshot.stagedActions.splice(actionIdx, 1);
        }
      }
      
      return true;
    }
    return false;
  }

  /**
   * Mark action as executed.
   */
  markExecuted(actionId: string): void {
    if (!this.currentSnapshot) return;
    
    const action = this.currentSnapshot.stagedActions.find(a => a.actionId === actionId);
    if (action) {
      action.executedAt = new Date().toISOString();
    }
  }

  /**
   * Graceful shutdown - final checkpoint.
   */
  async shutdown(): Promise<void> {
    this.stopAutoCheckpoint();
    await this.checkpoint();
  }

  /**
   * Get current snapshot (for recovery/debugging).
   */
  getSnapshot(): ContinuitySnapshot | null {
    return this.currentSnapshot;
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private async ensureStoreDirectory(): Promise<void> {
    await mkdir(dirname(this.storePath), { recursive: true });
  }

  private async loadSnapshot(): Promise<ContinuitySnapshot | null> {
    try {
      const data = await readFile(this.storePath, "utf-8");
      return JSON.parse(data) as ContinuitySnapshot;
    } catch {
      return null;
    }
  }

  private async attemptRecovery(existing: ContinuitySnapshot): Promise<ContinuitySnapshot> {
    // Check how old the checkpoint is
    const checkpointAge = Date.now() - new Date(existing.checkpointAt).getTime();
    const maxRecoveryAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (checkpointAge > maxRecoveryAge) {
      // Too old, start fresh but note the loss
      this.state = "lost";
      return this.startFreshFromLoss(existing);
    }
    
    // Recoverable - restore with fresh timestamps
    this.currentSnapshot = {
      ...existing,
      session: {
        ...existing.session,
        lastActivityAt: new Date().toISOString(),
        continuityVersion: existing.session.continuityVersion + 1,
      },
      checkpointAt: new Date().toISOString(),
    };
    
    this.state = "rebound";
    await this.checkpoint();
    this.startAutoCheckpoint();
    
    return this.currentSnapshot;
  }

  private startFreshFromLoss(previous: ContinuitySnapshot): ContinuitySnapshot {
    const now = new Date().toISOString();
    this.currentSnapshot = {
      session: {
        sessionId: this.generateSessionId(),
        actorId: previous.session.actorId,
        declaredName: previous.session.declaredName,
        establishedAt: now,
        lastActivityAt: now,
        continuityVersion: 1,
      },
      focus: { activeProjects: [] },
      watches: [], // Lost watches
      pendingApprovals: [], // Lost approvals
      memoryHighWaterMark: 0,
      stagedActions: [],
      checkpointAt: now,
    };
    
    return this.currentSnapshot;
  }

  private startAutoCheckpoint(): void {
    this.stopAutoCheckpoint();
    this.checkpointTimer = setInterval(() => {
      this.checkpoint().catch(console.error);
    }, this.checkpointIntervalMs);
  }

  private stopAutoCheckpoint(): void {
    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer);
      this.checkpointTimer = null;
    }
  }

  private generateSessionId(): string {
    const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
    return `sess_${date}_${random}`;
  }

  private buildStatus(snapshot: ContinuitySnapshot | null): ContinuityStatus {
    if (!snapshot) {
      return {
        state: "lost",
        sessionId: "none",
        since: new Date().toISOString(),
        lastCheckpoint: "never",
        canResume: false,
        items: { watches: 0, pendingApprovals: 0, stagedActions: 0 },
        message: "No session active. Please initialize.",
      };
    }

    const messages: Record<ContinuityState, string> = {
      stable: "Session active and stable.",
      recovering: "Recovering session from checkpoint...",
      degraded: "Session recovered with some data loss.",
      lost: "Previous session lost. Starting fresh.",
      rebound: "Session successfully recovered from restart.",
    };

    return {
      state: this.state,
      sessionId: snapshot.session.sessionId,
      since: snapshot.session.establishedAt,
      lastCheckpoint: snapshot.checkpointAt,
      canResume: this.state === "stable" || this.state === "rebound",
      items: {
        watches: snapshot.watches.length,
        pendingApprovals: snapshot.pendingApprovals.length,
        stagedActions: snapshot.stagedActions.filter(a => !a.executedAt).length,
      },
      message: messages[this.state],
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalStore: ContinuityStore | null = null;

export function getContinuityStore(): ContinuityStore {
  if (!globalStore) {
    globalStore = new ContinuityStore();
  }
  return globalStore;
}

export function resetContinuityStore(): void {
  globalStore = null;
}
