/**
 * Human CLI
 * 
 * The simplified command interface for personal AI OS.
 * No flags, no paths, no technical jargon.
 * Just human intentions.
 * 
 * @module personal/HumanCLI
 * @constitutional F13 Sovereign - Human intention is primary
 */

import { SovereignLoop, type HumanIntent, type HumanCommand } from "./SovereignLoop.js";
import { DailyLoop } from "./DailyLoop.js";

// ============================================================================
// COMMAND PATTERNS
// ============================================================================

interface CommandPattern {
  command: HumanCommand;
  patterns: RegExp[];
  description: string;
  examples: string[];
}

const COMMAND_PATTERNS: CommandPattern[] = [
  {
    command: "remember",
    patterns: [
      /^remember\s+that\s+(.+)/i,
      /^remember\s+(.+)/i,
      /^i\s+(?:want\s+to\s+)?remember\s+(.+)/i,
      /^store\s+that\s+(.+)/i,
      /^note\s+that\s+(.+)/i,
      /^my\s+(.+?)\s+(?:is|are)\s+(.+)/i, // "my birthday is..."
    ],
    description: "Store something in memory",
    examples: [
      "remember that I prefer dark mode",
      "my laptop password hint is...",
      "note that the meeting is Thursday",
    ],
  },
  {
    command: "recall",
    patterns: [
      /^what\s+(?:do\s+you\s+)?know\s+about\s+(.+)/i,
      /^recall\s+(.+)/i,
      /^what\s+(?:did\s+)?i\s+(?:say|tell\s+you)\s+about\s+(.+)/i,
      /^tell\s+me\s+about\s+(.+)/i,
      /^what\s+is\s+my\s+(.+)/i, // "what is my..."
      /^do\s+you\s+remember\s+(.+)/i,
    ],
    description: "Retrieve something from memory",
    examples: [
      "what do you know about the project?",
      "recall my preferences",
      "what did I say about the budget?",
    ],
  },
  {
    command: "track",
    patterns: [
      /^track\s+(.+)/i,
      /^watch\s+(.+)/i,
      /^monitor\s+(.+)/i,
      /^keep\s+an\s+eye\s+on\s+(.+)/i,
      /^let\s+me\s+know\s+if\s+(.+)/i,
    ],
    description: "Monitor something over time",
    examples: [
      "track the price of flights to Tokyo",
      "watch for changes to that file",
      "let me know if the server goes down",
    ],
  },
  {
    command: "compare",
    patterns: [
      /^compare\s+(.+)/i,
      /^should\s+i\s+(.+)\s+or\s+(.+)/i,
      /^which\s+(?:is\s+)?better[,:]?\s+(.+)/i,
      /^pros?\s+and\s+cons?\s+of\s+(.+)/i,
      /^help\s+me\s+decide\s+between\s+(.+)/i,
    ],
    description: "Compare options or show tradeoffs",
    examples: [
      "compare option A vs option B",
      "should I use React or Vue?",
      "pros and cons of working remotely",
    ],
  },
  {
    command: "draft",
    patterns: [
      /^draft\s+(.+)/i,
      /^prepare\s+(.+)/i,
      /^write\s+a\s+draft\s+of\s+(.+)/i,
      /^help\s+me\s+write\s+(.+)/i,
      /^create\s+a\s+draft\s+for\s+(.+)/i,
    ],
    description: "Prepare something without executing",
    examples: [
      "draft an email to the team",
      "prepare a proposal for the client",
      "help me write my resignation letter",
    ],
  },
  {
    command: "decide-with-me",
    patterns: [
      /^help\s+me\s+decide/i,
      /^decide\s+with\s+me/i,
      /^what\s+should\s+i\s+do/i,
      /^i\s+need\s+to\s+decide/i,
      /^walk\s+me\s+through\s+this\s+decision/i,
    ],
    description: "Present options and wait for human decision",
    examples: [
      "help me decide whether to take the job",
      "what should I do about the conflict?",
      "walk me through this career decision",
    ],
  },
  {
    command: "hold",
    patterns: [
      /^hold\s+on\s+(.+)/i,
      /^wait\s+for\s+my\s+(?:approval|yes)\s+before\s+(.+)/i,
      /^don't\s+(.+)\s+until\s+i\s+say/i,
      /^block\s+(.+)/i,
      /^pause\s+(.+)/i,
    ],
    description: "Block action until explicit approval",
    examples: [
      "hold on sending that email",
      "wait for my approval before making changes",
      "don't delete anything until I say so",
    ],
  },
  {
    command: "execute-with-approval",
    patterns: [
      /^execute\s+(.+)/i,
      /^do\s+it/i,
      /^go\s+ahead/i,
      /^proceed\s+with\s+(.+)/i,
      /^run\s+(.+)/i,
      /^make\s+it\s+happen/i,
    ],
    description: "Execute if approved, else hold",
    examples: [
      "execute the plan",
      "do it",
      "proceed with the deployment",
    ],
  },
];

// ============================================================================
// SPECIAL COMMANDS
// ============================================================================

const SPECIAL_COMMANDS = [
  {
    patterns: [/^good\s+morning/i, /^morning$/i, /^start\s+day/i, /^what\s+is\s+today/i],
    handler: "morning",
    description: "Show morning context",
  },
  {
    patterns: [/^good\s+(?:evening|night)/i, /^end\s+day/i, /^done\s+for\s+today/i, /^wrap\s+up/i],
    handler: "evening",
    description: "Show evening closure",
  },
  {
    patterns: [/^dashboard/i, /^status/i, /^what\s+is\s+happening/i, /^show\s+me\s+everything/i],
    handler: "dashboard",
    description: "Show full dashboard",
  },
  {
    patterns: [/^help/i, /^what\s+can\s+you\s+do/i, /^commands/i, /^how\s+do\s+i/i],
    handler: "help",
    description: "Show help",
  },
];

// ============================================================================
// HUMAN CLI CLASS
// ============================================================================

export class HumanCLI {
  private sovereign: SovereignLoop;
  private daily: DailyLoop;
  private sessionStartTime: string;

  constructor(sovereign: SovereignLoop, daily: DailyLoop) {
    this.sovereign = sovereign;
    this.daily = daily;
    this.sessionStartTime = new Date().toISOString();
  }

  /**
   * Process raw human input and return human-friendly output.
   * This is the main entry point — no parsing flags, no technical details.
   */
  async process(input: string): Promise<string> {
    const trimmed = input.trim();
    
    if (!trimmed) {
      return "I'm listening. What would you like to do?";
    }

    // Check special commands first
    const special = this.matchSpecialCommand(trimmed);
    if (special) {
      return this.handleSpecialCommand(special, trimmed);
    }

    // Try to match to a human command
    const matched = this.matchCommand(trimmed);
    if (matched) {
      const response = await this.sovereign.processIntent(matched.intent);
      return this.formatResponse(response);
    }

    // Unknown input — be helpful
    return this.handleUnknownInput(trimmed);
  }

  /**
   * Show the human-facing dashboard.
   */
  showDashboard(): string {
    const dashboard = this.sovereign.getDashboard();
    
    const lines: string[] = [
      "═══════════════════════════════════════",
      "     🜂 PERSONAL SOVEREIGN DASHBOARD",
      "═══════════════════════════════════════",
      "",
    ];

    // Inbox
    const unread = dashboard.inbox.newSinceLastVisit;
    lines.push(`📬 Inbox: ${unread} new`);
    if (unread > 0) {
      for (const item of dashboard.inbox.items.filter(i => !i.read).slice(0, 3)) {
        lines.push(`   ${item.badge} ${item.what.substring(0, 50)}${item.what.length > 50 ? "..." : ""}`);
      }
    }
    lines.push("");

    // Hold
    const holding = dashboard.hold.awaitingApproval.length;
    lines.push(`✋ Awaiting Your Yes: ${holding}`);
    if (holding > 0) {
      for (const hold of dashboard.hold.awaitingApproval.slice(0, 3)) {
        lines.push(`   • ${hold.intent.what.substring(0, 40)}${hold.intent.what.length > 40 ? "..." : ""}`);
      }
    }
    lines.push("");

    // Watch
    const watching = dashboard.watch.activeWatches.length;
    const alerts = dashboard.watch.alerts.length;
    lines.push(`👁️  Watching: ${watching} (${alerts} alerts)`);
    lines.push("");

    // Forge
    const ready = dashboard.forge.readyToExecute.length;
    lines.push(`🔨 Forge: ${ready} ready to execute`);
    lines.push("");

    // Focus
    lines.push(`🎯 Active Projects: ${dashboard.focus.activeProjects.length}`);
    if (dashboard.focus.todayPriority) {
      lines.push(`   Priority: ${dashboard.focus.todayPriority}`);
    }
    lines.push("");

    // Memory
    lines.push(`🧠 Memory: ${dashboard.memory.workingSetSize} items`);
    if (dashboard.memory.quarantineCount > 0) {
      lines.push(`   ⚠️  ${dashboard.memory.quarantineCount} need verification`);
    }
    lines.push("");

    lines.push('Type "help" for what you can say to me.');

    return lines.join("\n");
  }

  /**
   * Show help with human-friendly examples.
   */
  showHelp(): string {
    const lines: string[] = [
      "═══════════════════════════════════════",
      "     🜂 WHAT YOU CAN SAY TO ME",
      "═══════════════════════════════════════",
      "",
      "I understand these intentions:",
      "",
    ];

    for (const cmd of COMMAND_PATTERNS) {
      lines.push(`${cmd.description}:`);
      for (const example of cmd.examples) {
        lines.push(`  "${example}"`);
      }
      lines.push("");
    }

    lines.push("Special commands:");
    lines.push('  "good morning" — start your day');
    lines.push('  "good evening" — wrap up');
    lines.push('  "dashboard" — see everything');
    lines.push("");

    lines.push("═══════════════════════════════════════");
    lines.push("Just talk to me naturally. I'll figure it out.");

    return lines.join("\n");
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private matchCommand(input: string): { intent: HumanIntent; command: HumanCommand } | null {
    for (const pattern of COMMAND_PATTERNS) {
      for (const regex of pattern.patterns) {
        const match = input.match(regex);
        if (match) {
          // Extract the "what" from the match groups
          const what = match[1] || match[0];
          
          return {
            intent: {
              command: pattern.command,
              what,
              urgency: this.inferUrgency(input),
              privacy: this.inferPrivacy(input),
            },
            command: pattern.command,
          };
        }
      }
    }
    return null;
  }

  private matchSpecialCommand(input: string): string | null {
    for (const special of SPECIAL_COMMANDS) {
      for (const regex of special.patterns) {
        if (regex.test(input)) {
          return special.handler;
        }
      }
    }
    return null;
  }

  private async handleSpecialCommand(handler: string, input: string): Promise<string> {
    switch (handler) {
      case "morning": {
        const context = this.daily.generateMorningContext();
        return this.daily.formatMorningContext(context);
      }
      case "evening": {
        // Would need to track completed items in a real implementation
        const closure = this.daily.generateEveningClosure([]);
        return this.daily.formatEveningClosure(closure);
      }
      case "dashboard":
        return this.showDashboard();
      case "help":
        return this.showHelp();
      default:
        return "I'm not sure what you're asking for. Try 'help'?";
    }
  }

  private formatResponse(response: import("./SovereignLoop.js").SovereignResponse): string {
    const lines: string[] = [
      `${response.badge}`,
      "",
      response.humanSummary,
    ];

    if (response.nextAction) {
      lines.push("");
      lines.push(`Next: ${response.nextAction}`);
    }

    return lines.join("\n");
  }

  private handleUnknownInput(input: string): string {
    // Try to be helpful for common patterns
    const lower = input.toLowerCase();
    
    if (lower.includes("hello") || lower.includes("hi ") || lower === "hi") {
      return "Hello. I'm arifOS, your personal AI. What would you like to do today?";
    }
    
    if (lower.includes("thank")) {
      return "You're welcome. What else can I help with?";
    }
    
    if (lower.includes("bye") || lower.includes("goodbye")) {
      return "Goodbye. I'll keep watching what you asked me to track.";
    }

    // Fallback
    return [
      "I'm not sure I understood that.",
      "",
      `You said: "${input}"`,
      "",
      "Try saying it differently, or type 'help' to see what I can do.",
    ].join("\n");
  }

  private inferUrgency(input: string): HumanIntent["urgency"] {
    const lower = input.toLowerCase();
    if (lower.includes("now") || lower.includes("urgent") || lower.includes("asap")) {
      return "now";
    }
    if (lower.includes("soon") || lower.includes("today")) {
      return "soon";
    }
    if (lower.includes("eventually") || lower.includes("someday")) {
      return "eventually";
    }
    return "whenever";
  }

  private inferPrivacy(input: string): HumanIntent["privacy"] {
    const lower = input.toLowerCase();
    if (lower.includes("private") || lower.includes("secret") || lower.includes("personal")) {
      return "private";
    }
    if (lower.includes("share") || lower.includes("public")) {
      return "public";
    }
    return "shared";
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createPersonalOS(): HumanCLI {
  const sovereign = new SovereignLoop();
  const daily = new DailyLoop(sovereign);
  return new HumanCLI(sovereign, daily);
}
