/**
 * Memory Contract
 * 
 * P0.4: Ship a real personal memory contract
 * 
 * Defines memory classes with source, timestamp, confidence, editability.
 * Provides explicit actions: correct, pin, forget, downgrade.
 * Exposes memory as MCP resources with stable IDs.
 * 
 * @module memory-contract/MemoryContract
 * @constitutional Ω Stability - Memory discipline is the product
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { homedir } from "node:os";

// ============================================================================
// MEMORY TIERS
// ============================================================================

export type MemoryTier = 
  | "ephemeral"     // Current convo / temporary context (decays)
  | "working"       // Active projects, current focus (decays)
  | "canon"         // Stable truths about Arif (permanent, correctable)
  | "sacred"        // Constitution, identity, non-negotiables (immutable)
  | "quarantine";   // Uncertain or unverified claims (isolated)

export interface MemoryEntry {
  /** Stable unique identifier */
  memoryId: string;
  
  /** Memory tier */
  tier: MemoryTier;
  
  /** The memory content */
  content: string;
  
  /** When this memory was created */
  createdAt: string;
  
  /** When this memory was last modified */
  modifiedAt: string;
  
  /** When this memory was last accessed (for working set management) */
  lastAccessedAt?: string;
  
  /** Source of this memory */
  source: {
    type: "human" | "inferred" | "external" | "system";
    /** Human-readable description of source */
    description: string;
    /** Optional reference (URL, conversation ID, etc.) */
    reference?: string;
  };
  
  /** Confidence level (0-1) */
  confidence: number;
  
  /** Whether this memory can be edited */
  editable: boolean;
  
  /** Whether this memory can decay (be forgotten) */
  canDecay: boolean;
  
  /** Why this memory was stored (human's reason or system rationale) */
  reason: string;
  
  /** Tags for categorization */
  tags: string[];
  
  /** Version history for tracking changes */
  history: MemoryVersion[];
  
  /** Verification status for quarantine entries */
  verification?: {
    status: "pending" | "verified" | "rejected";
    verifiedAt?: string;
    verifiedBy?: string;
  };
  
  /** For canon/sacred: whether this is pinned (protected from decay) */
  pinned?: boolean;
}

export interface MemoryVersion {
  version: number;
  content: string;
  modifiedAt: string;
  modifiedBy: string;
  reason: string;
}

// ============================================================================
// MEMORY ACTIONS
// ============================================================================

export interface StoreRequest {
  content: string;
  tier?: MemoryTier;
  source?: MemoryEntry["source"];
  confidence?: number;
  reason: string;
  tags?: string[];
}

export interface CorrectRequest {
  memoryId: string;
  newContent: string;
  reason: string;
}

export interface PinRequest {
  memoryId: string;
  reason: string;
}

export interface ForgetRequest {
  memoryId: string;
  reason: string;
}

export interface DowngradeRequest {
  memoryId: string;
  toTier: "quarantine";
  reason: string;
}

export interface VerifyRequest {
  memoryId: string;
  verified: boolean;
  reason: string;
}

// ============================================================================
// MEMORY QUERY
// ============================================================================

export interface MemoryQuery {
  /** Text to search for */
  query: string;
  
  /** Specific tiers to search (default: all) */
  tiers?: MemoryTier[];
  
  /** Minimum confidence level */
  minConfidence?: number;
  
  /** Tags to filter by */
  tags?: string[];
  
  /** Source types to include */
  sources?: MemoryEntry["source"]["type"][];
  
  /** Maximum number of results */
  limit?: number;
  
  /** Include quarantined memories */
  includeQuarantine?: boolean;
}

export interface MemoryQueryResult {
  memories: MemoryEntry[];
  total: number;
  query: MemoryQuery;
}

// ============================================================================
// MEMORY CONTRACT CLASS
// ============================================================================

export class MemoryContract {
  private storePath: string;
  private memories: Map<string, MemoryEntry> = new Map();
  private initialized = false;

  constructor(options?: { storePath?: string }) {
    this.storePath = options?.storePath ?? `${homedir()}/.arifos/memory.jsonl`;
  }

  /**
   * Initialize the memory store, loading existing memories.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await this.ensureStoreDirectory();
    await this.loadMemories();
    this.initialized = true;
  }

  /**
   * Store a new memory.
   */
  async store(request: StoreRequest): Promise<MemoryEntry> {
    this.ensureInitialized();
    
    // Auto-select tier if not specified
    const tier = request.tier ?? this.inferTier(request.content);
    
    // Auto-set properties based on tier
    const canDecay = tier === "ephemeral" || tier === "working";
    const editable = tier !== "sacred"; // Sacred is immutable
    const confidence = request.confidence ?? (request.source?.type === "human" ? 1.0 : 0.7);
    
    const memory: MemoryEntry = {
      memoryId: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tier,
      content: request.content,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
      source: request.source ?? { type: "human", description: "Stated by operator" },
      confidence,
      editable,
      canDecay,
      reason: request.reason,
      tags: request.tags ?? [],
      history: [],
      pinned: tier === "sacred", // Sacred is always pinned
    };
    
    // Quarantine has special verification tracking
    if (tier === "quarantine") {
      memory.verification = { status: "pending" };
    }
    
    this.memories.set(memory.memoryId, memory);
    await this.persistMemory(memory);
    
    return memory;
  }

  /**
   * Correct an existing memory (creates version history).
   */
  async correct(request: CorrectRequest): Promise<MemoryEntry> {
    this.ensureInitialized();
    
    const memory = this.memories.get(request.memoryId);
    if (!memory) {
      throw new Error(`Memory not found: ${request.memoryId}`);
    }
    
    if (!memory.editable) {
      throw new Error(`Memory ${request.memoryId} is not editable (tier: ${memory.tier})`);
    }
    
    // Save current version to history
    memory.history.push({
      version: memory.history.length + 1,
      content: memory.content,
      modifiedAt: memory.modifiedAt,
      modifiedBy: memory.source.description,
      reason: memory.reason,
    });
    
    // Apply correction
    memory.content = request.newContent;
    memory.modifiedAt = new Date().toISOString();
    memory.reason = request.reason;
    
    await this.persistAllMemories();
    
    return memory;
  }

  /**
   * Pin a memory (prevent decay).
   */
  async pin(request: PinRequest): Promise<MemoryEntry> {
    this.ensureInitialized();
    
    const memory = this.memories.get(request.memoryId);
    if (!memory) {
      throw new Error(`Memory not found: ${request.memoryId}`);
    }
    
    memory.pinned = true;
    memory.canDecay = false;
    memory.modifiedAt = new Date().toISOString();
    
    await this.persistAllMemories();
    
    return memory;
  }

  /**
   * Forget (soft-delete) a memory.
   */
  async forget(request: ForgetRequest): Promise<void> {
    this.ensureInitialized();
    
    const memory = this.memories.get(request.memoryId);
    if (!memory) {
      throw new Error(`Memory not found: ${request.memoryId}`);
    }
    
    if (memory.tier === "sacred") {
      throw new Error(`Cannot forget sacred memory: ${request.memoryId}`);
    }
    
    // Actually remove for now (could be soft-delete with tombstone)
    this.memories.delete(request.memoryId);
    await this.persistAllMemories();
  }

  /**
   * Downgrade a memory to quarantine.
   */
  async downgrade(request: DowngradeRequest): Promise<MemoryEntry> {
    this.ensureInitialized();
    
    const memory = this.memories.get(request.memoryId);
    if (!memory) {
      throw new Error(`Memory not found: ${request.memoryId}`);
    }
    
    memory.tier = "quarantine";
    memory.verification = { status: "pending" };
    memory.confidence = 0.3; // Low confidence in quarantine
    memory.modifiedAt = new Date().toISOString();
    memory.reason = request.reason;
    
    await this.persistAllMemories();
    
    return memory;
  }

  /**
   * Verify a quarantined memory.
   */
  async verify(request: VerifyRequest): Promise<MemoryEntry> {
    this.ensureInitialized();
    
    const memory = this.memories.get(request.memoryId);
    if (!memory) {
      throw new Error(`Memory not found: ${request.memoryId}`);
    }
    
    if (memory.tier !== "quarantine") {
      throw new Error(`Can only verify quarantined memories: ${request.memoryId}`);
    }
    
    memory.verification = {
      status: request.verified ? "verified" : "rejected",
      verifiedAt: new Date().toISOString(),
      verifiedBy: "operator",
    };
    
    if (request.verified) {
      // Promote to working memory
      memory.tier = "working";
      memory.confidence = 0.8;
    }
    
    memory.modifiedAt = new Date().toISOString();
    await this.persistAllMemories();
    
    return memory;
  }

  /**
   * Query memories.
   */
  query(query: MemoryQuery): MemoryQueryResult {
    this.ensureInitialized();
    
    let results = Array.from(this.memories.values());
    
    // Filter by query text
    if (query.query) {
      const q = query.query.toLowerCase();
      results = results.filter(m => 
        m.content.toLowerCase().includes(q) ||
        m.tags.some(t => t.toLowerCase().includes(q)) ||
        m.reason.toLowerCase().includes(q)
      );
    }
    
    // Filter by tiers
    if (query.tiers) {
      results = results.filter(m => query.tiers!.includes(m.tier));
    }
    
    // Filter out quarantine unless explicitly included
    if (!query.includeQuarantine) {
      results = results.filter(m => m.tier !== "quarantine");
    }
    
    // Filter by confidence
    if (query.minConfidence !== undefined) {
      results = results.filter(m => m.confidence >= query.minConfidence!);
    }
    
    // Filter by tags
    if (query.tags) {
      results = results.filter(m => 
        query.tags!.some(t => m.tags.includes(t))
      );
    }
    
    // Filter by source
    if (query.sources) {
      results = results.filter(m => query.sources!.includes(m.source.type));
    }
    
    // Update last accessed
    results.forEach(m => {
      m.lastAccessedAt = new Date().toISOString();
    });
    
    // Sort by confidence and recency
    results.sort((a, b) => {
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    const total = results.length;
    
    if (query.limit) {
      results = results.slice(0, query.limit);
    }
    
    return {
      memories: results,
      total,
      query,
    };
  }

  /**
   * Get a single memory by ID.
   */
  get(memoryId: string): MemoryEntry | undefined {
    this.ensureInitialized();
    const memory = this.memories.get(memoryId);
    if (memory) {
      memory.lastAccessedAt = new Date().toISOString();
    }
    return memory;
  }

  /**
   * Get all memories in a tier.
   */
  getByTier(tier: MemoryTier): MemoryEntry[] {
    this.ensureInitialized();
    return Array.from(this.memories.values())
      .filter(m => m.tier === tier)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Get memory statistics.
   */
  getStats(): Record<MemoryTier | "total", number> {
    this.ensureInitialized();
    const stats: Record<string, number> = { total: this.memories.size };
    
    for (const tier of ["ephemeral", "working", "canon", "sacred", "quarantine"] as MemoryTier[]) {
      stats[tier] = this.getByTier(tier).length;
    }
    
    return stats;
  }

  /**
   * Run decay process (remove old ephemeral/working memories).
   */
  async runDecay(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    this.ensureInitialized();
    
    const now = Date.now();
    const toRemove: string[] = [];
    
    for (const [id, memory] of this.memories) {
      if (!memory.canDecay || memory.pinned) continue;
      
      const age = now - new Date(memory.createdAt).getTime();
      const lastAccess = memory.lastAccessedAt 
        ? now - new Date(memory.lastAccessedAt).getTime()
        : age;
      
      // Remove if old AND not recently accessed
      if (age > maxAgeMs && lastAccess > maxAgeMs) {
        toRemove.push(id);
      }
    }
    
    for (const id of toRemove) {
      this.memories.delete(id);
    }
    
    if (toRemove.length > 0) {
      await this.persistAllMemories();
    }
    
    return toRemove.length;
  }

  // ==========================================================================
  // MCP RESOURCE FORMAT
  // ==========================================================================

  /**
   * Get memories formatted as MCP resources.
   */
  getMCPResources(): Array<{ uri: string; name: string; mimeType: string; text: string }> {
    this.ensureInitialized();
    
    return Array.from(this.memories.values()).map(memory => ({
      uri: `memory://${memory.memoryId}`,
      name: `${memory.tier}: ${memory.content.slice(0, 50)}${memory.content.length > 50 ? "..." : ""}`,
      mimeType: "application/json",
      text: JSON.stringify({
        memoryId: memory.memoryId,
        tier: memory.tier,
        content: memory.content,
        confidence: memory.confidence,
        source: memory.source,
        createdAt: memory.createdAt,
      }),
    }));
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error("MemoryContract not initialized. Call initialize() first.");
    }
  }

  private async ensureStoreDirectory(): Promise<void> {
    await mkdir(dirname(this.storePath), { recursive: true });
  }

  private async loadMemories(): Promise<void> {
    try {
      const data = await readFile(this.storePath, "utf-8");
      const lines = data.split("\n").filter(l => l.trim());
      
      for (const line of lines) {
        try {
          const memory = JSON.parse(line) as MemoryEntry;
          this.memories.set(memory.memoryId, memory);
        } catch {
          // Skip corrupted lines
        }
      }
    } catch {
      // No existing memories
    }
  }

  private async persistMemory(memory: MemoryEntry): Promise<void> {
    const line = JSON.stringify(memory) + "\n";
    await writeFile(this.storePath, line, { flag: "a" });
  }

  private async persistAllMemories(): Promise<void> {
    const lines = Array.from(this.memories.values())
      .map(m => JSON.stringify(m))
      .join("\n") + "\n";
    await writeFile(this.storePath, lines);
  }

  /**
   * [Q2] Explicit tier classifier for AgentEngine memory pipeline.
   * Maps content + source + confidence to the correct constitutional tier.
   */
  classify(
    content: string,
    sourceType: "human" | "inferred" | "external" | "system",
    confidence: number,
  ): MemoryTier {
    // Sacred: system-level constitution, identity, non-negotiables
    if (sourceType === "system" && confidence >= 0.95) {
      const lower = content.toLowerCase();
      if (
        lower.includes("constitution") ||
        lower.includes("sovereign") ||
        lower.includes("floor") ||
        lower.includes("never") ||
        lower.includes("always") ||
        lower.includes("must not") ||
        lower.includes("shall not")
      ) {
        return "sacred";
      }
    }

    // Canon: stable, verified facts from human or high-confidence sources
    if ((sourceType === "human" || confidence >= 0.9) && content.length < 500) {
      return "canon";
    }

    // Quarantine: unverified, conflicting, or low-confidence information
    if (confidence < 0.4) {
      return "quarantine";
    }

    // Ephemeral: temporary, turn-specific scratch
    if (sourceType === "inferred" && confidence < 0.7) {
      return "ephemeral";
    }

    // Working: active, mutable context (default for most agent memories)
    return "working";
  }

  private inferTier(content: string): MemoryTier {
    const lower = content.toLowerCase();
    
    // Sacred: constitution, identity, non-negotiables
    if (lower.includes("constitution") || 
        lower.includes("sovereign") || 
        lower.includes("i am ") ||
        lower.includes("never ") ||
        lower.includes("always ")) {
      return "sacred";
    }
    
    // Canon: stable truths
    if (lower.includes("my name") || 
        lower.includes("i prefer") ||
        lower.includes("my birthday") ||
        lower.includes("my address")) {
      return "canon";
    }
    
    // Ephemeral: temporary
    if (lower.includes("temp") || 
        lower.includes("now") ||
        lower.includes("today")) {
      return "ephemeral";
    }
    
    // Default to working
    return "working";
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let globalContract: MemoryContract | null = null;

export function getMemoryContract(): MemoryContract {
  if (!globalContract) {
    globalContract = new MemoryContract();
  }
  return globalContract;
}
