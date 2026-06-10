/**
 * A2A Agent Card
 * 
 * P0.2: Make discovery surface truthful, consistent, and 200 OK
 * 
 * Publishes /.well-known/agent-card.json per A2A spec.
 * 
 * @module discovery/A2ACard
 * @constitutional F2 Truth - Public claims match reality
 */

// ============================================================================
// A2A AGENT CARD TYPES
// ============================================================================

export interface A2AAgentCard {
  name: string;
  description: string;
  supportedInterfaces: A2AAgentInterface[];
  provider?: A2AAgentProvider;
  version: string;
  documentationUrl?: string;
  capabilities: A2ACapabilities;
  securitySchemes?: Record<string, unknown>;
  securityRequirements?: Array<Record<string, string[]>>;
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: A2ASkill[];
  iconUrl?: string;
}

export interface A2AAgentInterface {
  url: string;
  protocolBinding: "JSONRPC" | "GRPC" | "HTTP+JSON" | string;
  protocolVersion: string;
  tenant?: string;
}

export interface A2AAgentProvider {
  organization: string;
  url: string;
}

export interface A2ACapabilities {
  streaming?: boolean;
  pushNotifications?: boolean;
  extendedAgentCard?: boolean;
  extensions?: Array<{
    uri: string;
    description?: string;
    required?: boolean;
    params?: Record<string, unknown>;
  }>;
}

export interface A2ASkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples?: string[];
  inputModes?: string[];
  outputModes?: string[];
  securityRequirements?: Array<Record<string, string[]>>;
}

// ============================================================================
// ARIFOS A2A CARD
// ============================================================================

export function createArifOSAgentCard(baseUrl: string): A2AAgentCard {
  return {
    name: "arifOS Personal",
    description: 
      "A personal AI operating system for sovereign human cognition. " +
      "Provides memory management, decision support, bounded execution, " +
      "and continuity across sessions. Designed for one human operator.",
    supportedInterfaces: [
      {
        url: `${baseUrl}/a2a`,
        protocolBinding: "JSONRPC",
        protocolVersion: "1.0",
      },
    ],
    provider: {
      organization: "ARIF",
      url: "https://arif-fazil.com",
    },
    version: "1.0.0",
    documentationUrl: `${baseUrl}/contract`,
    capabilities: {
      streaming: false,
      pushNotifications: false,
      extendedAgentCard: false,
    },
    defaultInputModes: ["text/plain", "application/json"],
    defaultOutputModes: ["text/plain", "application/json"],
    skills: [
      {
        id: "memory.remember",
        name: "Remember",
        description: "Store facts, preferences, and context in personal memory tiers",
        tags: ["memory", "personal", "continuity"],
        examples: [
          "Remember that I prefer dark mode",
          "Note that my sister's birthday is in March",
          "Store this API key as 'production'",
        ],
      },
      {
        id: "memory.recall",
        name: "Recall",
        description: "Retrieve previously stored memories and context",
        tags: ["memory", "retrieval", "context"],
        examples: [
          "What do you know about the project?",
          "Recall my preferences",
          "What did I say about the budget?",
        ],
      },
      {
        id: "watch.monitor",
        name: "Watch",
        description: "Monitor conditions and alert on changes",
        tags: ["monitoring", "alerts", "continuity"],
        examples: [
          "Watch for changes to that file",
          "Track the price of flights to Tokyo",
          "Let me know if the server goes down",
        ],
      },
      {
        id: "decision.support",
        name: "Decide-with-me",
        description: "Present options and tradeoffs for human decision",
        tags: ["decision", "comparison", "advisory"],
        examples: [
          "Help me decide whether to take the job",
          "Compare React vs Vue for this project",
          "Walk me through this career decision",
        ],
      },
      {
        id: "action.hold",
        name: "Hold",
        description: "Block actions awaiting explicit human approval",
        tags: ["governance", "approval", "safety"],
        examples: [
          "Hold on sending that email",
          "Don't delete anything until I say so",
          "Wait for my approval before deploying",
        ],
      },
      {
        id: "action.execute",
        name: "Execute-with-approval",
        description: "Execute prepared actions with proper authorization",
        tags: ["execution", "forge", "action"],
        examples: [
          "Execute the prepared plan",
          "Proceed with deployment",
          "Send the draft email",
        ],
      },
      {
        id: "context.morning",
        name: "Morning Context",
        description: "Provide daily orientation with priorities and changes",
        tags: ["daily", "routine", "planning"],
        examples: [
          "Good morning",
          "What's on for today?",
          "Start my day",
        ],
      },
      {
        id: "context.evening",
        name: "Evening Closure",
        description: "Summarize day and prepare carry-forward items",
        tags: ["daily", "routine", "closure"],
        examples: [
          "Good evening",
          "Wrap up my day",
          "What did I accomplish today?",
        ],
      },
    ],
  };
}

// ============================================================================
// MCP MANIFEST
// ============================================================================

export interface MCPManifest {
  /** MCP protocol version */
  protocolVersion: string;
  
  /** Server capabilities */
  capabilities: {
    /** Supports logging to client */
    logging?: {};
    /** Supports prompting */
    prompts?: {
      listChanged?: boolean;
    };
    /** Supports resources */
    resources?: {
      subscribe?: boolean;
      listChanged?: boolean;
    };
    /** Supports tools */
    tools?: {
      listChanged?: boolean;
    };
  };
  
  /** Server information */
  serverInfo: {
    name: string;
    version: string;
  };
  
  /** Instructions for LLM on how to use this server */
  instructions?: string;
}

export function createMCPManifest(): MCPManifest {
  return {
    protocolVersion: "2025-11-05",
    capabilities: {
      logging: {},
      prompts: { listChanged: false },
      resources: { subscribe: true, listChanged: true },
      tools: { listChanged: false },
    },
    serverInfo: {
      name: "arifos-personal",
      version: "2.0.0",
    },
    instructions: 
      "arifOS Personal is a sovereign AI operating system for one human operator. " +
      "It provides memory management across tiers (ephemeral, working, canon, sacred, quarantine), " +
      "decision support with explicit approval boundaries, bounded execution with safety controls, " +
      "and session continuity across restarts.\n\n" +
      "Key patterns:\n" +
      "- Use memory.remember/memory.recall for personal context\n" +
      "- All side-effectful actions require human approval\n" +
      "- Actions show badges: Observe → Advise → Ready → Needs Yes → Executed\n" +
      "- Morning/evening routines provide daily continuity",
  };
}

// ============================================================================
// HEALTH STATUS
// ============================================================================

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  version: string;
  timestamp: string;
  checks: {
    continuity: {
      state: "stable" | "recovering" | "degraded" | "lost" | "rebound";
      signing: "persistent" | "ephemeral_process_local";
      lastCheckpoint: string;
    };
    memory: {
      vectorStore: boolean;
      continuityStore: boolean;
    };
    discovery: {
      a2aCard: boolean;
      mcpManifest: boolean;
      openApi: boolean;
    };
  };
  governedContinuity: "healthy" | "degraded";
}

export function createHealthStatus(
  continuityState: { state: string; signing: string; lastCheckpoint: string },
  discoveryStatus: { a2aCard: boolean; mcpManifest: boolean; openApi: boolean }
): HealthStatus {
  const isContinuityHealthy = continuityState.state === "stable" || 
                               continuityState.state === "rebound";
  
  const isDiscoveryHealthy = discoveryStatus.a2aCard && 
                              discoveryStatus.mcpManifest && 
                              discoveryStatus.openApi;
  
  const overallStatus: HealthStatus["status"] = 
    isContinuityHealthy && isDiscoveryHealthy ? "healthy" :
    isContinuityHealthy || isDiscoveryHealthy ? "degraded" : "unhealthy";
  
  return {
    status: overallStatus,
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    checks: {
      continuity: {
        state: continuityState.state as HealthStatus["checks"]["continuity"]["state"],
        signing: continuityState.signing as HealthStatus["checks"]["continuity"]["signing"],
        lastCheckpoint: continuityState.lastCheckpoint,
      },
      memory: {
        vectorStore: true,
        continuityStore: true,
      },
      discovery: {
        a2aCard: discoveryStatus.a2aCard,
        mcpManifest: discoveryStatus.mcpManifest,
        openApi: discoveryStatus.openApi,
      },
    },
    governedContinuity: isContinuityHealthy ? "healthy" : "degraded",
  };
}
