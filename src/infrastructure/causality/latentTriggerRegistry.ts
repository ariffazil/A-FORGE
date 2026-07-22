/**
 * Latent Trigger Registry — Causality Defense Phase 1
 * 
 * Every file mutation by an agent is registered as a "latent trigger."
 * When a trusted host tool later reads/executes this file, the kernel
 * can trace the chain of consequence.
 * 
 * Architecture: append-only JSONL at /root/.local/share/arifos/latent_triggers.jsonl
 * Doctrine: DITEMPA BUKAN DIBERI — Causality is forged, not assumed.
 * 
 * Forged: 2026-07-22 by FORGE (000Ω) under F13 SOVEREIGN directive.
 */

import { appendFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, dirname } from "node:path";

// ── Types ──────────────────────────────────────────────────────────────────

export interface LatentTriggerRecord {
  /** Canonical path of the mutated file */
  path: string;
  /** Write mode: "write" | "patch" */
  mode: "write" | "patch";
  /** Identity of the agent that wrote the file */
  written_by: string;
  /** arifOS session ID */
  session_id: string;
  /** arifOS session capability token (sct_v1.*) */
  session_token?: string;
  /** Auto-classified intent */
  intent_classified: string;
  /** Risk categories — what trusted host tools might read/execute this */
  latent_risk_categories: string[];
  /** SHA-256 of the content written */
  sha256_after: string;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Previous SHA-256 if file existed (null for new files) */
  sha256_before: string | null;
  /** File size in bytes after write */
  bytes_after: number;
}

export interface LatentRiskCategory {
  category: string;
  description: string;
  host_tools: string[];       // trusted host tools that auto-read this
  severity: "low" | "medium" | "high" | "critical";
  auto_hold: boolean;          // should this trigger auto 888_HOLD?
}

// ── Risk Classification Map ────────────────────────────────────────────────

const RISK_PATTERNS: Array<{ pattern: RegExp; category: LatentRiskCategory }> = [
  {
    pattern: /\.vscode\/(tasks|launch|settings)\.json$/,
    category: {
      category: "vscode_task_runner",
      description: "VS Code task/launch configuration — auto-executed by IDE",
      host_tools: ["VS Code", "Code CLI", "code-server"],
      severity: "high",
      auto_hold: false, // Phase 2: upgrade to true
    },
  },
  {
    pattern: /\.git\/hooks\//,
    category: {
      category: "git_hook",
      description: "Git hook script — auto-executed by git on commit/push/rebase",
      host_tools: ["git", "gh CLI", "GitHub Desktop"],
      severity: "critical",
      auto_hold: false, // Phase 2: upgrade to true
    },
  },
  {
    pattern: /\.(bashrc|zshrc|profile|bash_profile)$/,
    category: {
      category: "shell_profile",
      description: "Shell profile — auto-sourced on terminal open",
      host_tools: ["bash", "zsh", "OpenCode terminal", "SSH session"],
      severity: "critical",
      auto_hold: false,
    },
  },
  {
    pattern: /\.(service|timer|socket|target)$/,
    category: {
      category: "systemd_unit",
      description: "systemd unit file — controls daemon lifecycle",
      host_tools: ["systemd", "systemctl"],
      severity: "critical",
      auto_hold: true, // AUTO-HOLD: systemd units are privileged
    },
  },
  {
    pattern: /(\.github\/workflows\/|\.github\/actions\/)/,
    category: {
      category: "github_workflow",
      description: "GitHub Actions workflow — auto-executed on push/PR/schedule",
      host_tools: ["GitHub Actions runner", "act (local runner)"],
      severity: "high",
      auto_hold: false,
    },
  },
  {
    pattern: /Caddyfile$/,
    category: {
      category: "caddy_config",
      description: "Caddy reverse proxy configuration — controls HTTPS ingress",
      host_tools: ["Caddy", "caddy reload"],
      severity: "critical",
      auto_hold: true, // AUTO-HOLD: Caddy controls all public HTTPS
    },
  },
  {
    pattern: /\.env$/,
    category: {
      category: "env_file",
      description: "Environment variable file — auto-sourced by shells and systemd",
      host_tools: ["bash", "systemd EnvironmentFile", "docker compose"],
      severity: "high",
      auto_hold: false,
    },
  },
  {
    pattern: /docker-compose\.(yml|yaml)$/,
    category: {
      category: "docker_compose",
      description: "Docker Compose manifest — controls container fleet",
      host_tools: ["docker", "docker compose", "systemd docker services"],
      severity: "high",
      auto_hold: false,
    },
  },
  {
    pattern: /\/deploy\//,
    category: {
      category: "deployment_script",
      description: "Deployment script/config — controls production runtime",
      host_tools: ["systemd", "rsync", "deploy scripts"],
      severity: "high",
      auto_hold: false,
    },
  },
  {
    pattern: /(\.py|\.ts|\.js|\.sh)$/,
    category: {
      category: "executable_source",
      description: "Source code — may be auto-executed by IDE/test runners/CI",
      host_tools: ["Node.js", "Python", "ts-node", "pytest", "jest"],
      severity: "medium",
      auto_hold: false,
    },
  },
  {
    pattern: /\.json$/,
    category: {
      category: "config_json",
      description: "JSON configuration — parsed and acted upon by host tools",
      host_tools: ["Various IDE/tool JSON parsers"],
      severity: "low",
      auto_hold: false,
    },
  },
  {
    pattern: /\.(yaml|yml|toml)$/,
    category: {
      category: "config_yaml",
      description: "YAML/TOML configuration — parsed by host tools",
      host_tools: ["Various IDE/tool YAML parsers"],
      severity: "low",
      auto_hold: false,
    },
  },
  {
    pattern: /\/\.claude($|\/)/,
    category: {
      category: "claude_config",
      description: "Claude Code configuration — controls agent behavior",
      host_tools: ["Claude Code CLI"],
      severity: "high",
      auto_hold: false,
    },
  },
  {
    pattern: /\/\.opencode($|\/)/,
    category: {
      category: "opencode_config",
      description: "OpenCode configuration — controls agent behavior",
      host_tools: ["OpenCode CLI"],
      severity: "high",
      auto_hold: false,
    },
  },
];

// ── Default "unknown" category ─────────────────────────────────────────────

const UNKNOWN_CATEGORY: LatentRiskCategory = {
  category: "unknown_file",
  description: "Unknown file type — no specific risk classification",
  host_tools: ["filesystem readers"],
  severity: "low",
  auto_hold: false,
};

// ── Classification Engine ──────────────────────────────────────────────────

export function classifyLatentRisk(filePath: string): LatentRiskCategory[] {
  const categories: LatentRiskCategory[] = [];
  
  for (const { pattern, category } of RISK_PATTERNS) {
    if (pattern.test(filePath)) {
      categories.push(category);
    }
  }
  
  if (categories.length === 0) {
    categories.push(UNKNOWN_CATEGORY);
  }
  
  return categories;
}

export function classifyIntent(filePath: string): string {
  const fileName = basename(filePath);
  const dirName = dirname(filePath);
  
  // Configuration mutations
  if (fileName.endsWith(".json") || fileName.endsWith(".yaml") || fileName.endsWith(".yml") || fileName.endsWith(".toml")) {
    if (dirName.includes(".vscode")) return "ide_config_mutation";
    if (dirName.includes(".github")) return "ci_config_mutation";
    if (dirName.includes("deploy")) return "deploy_config_mutation";
    return "config_mutation";
  }
  
  // Code mutations
  if (fileName.endsWith(".ts") || fileName.endsWith(".js") || fileName.endsWith(".py")) {
    return "source_code_mutation";
  }
  
  // Shell/script mutations
  if (fileName.endsWith(".sh") || fileName.endsWith(".bash")) {
    return "script_mutation";
  }
  
  // Documentation
  if (fileName.endsWith(".md")) {
    return "documentation_mutation";
  }
  
  // System mutations
  if (fileName.endsWith(".service") || fileName.endsWith(".timer") || fileName.endsWith(".socket")) {
    return "systemd_unit_mutation";
  }
  
  return "generic_mutation";
}

// ── Registry Core ──────────────────────────────────────────────────────────

const TRIGGERS_PATH = "/root/.local/share/arifos/latent_triggers.jsonl";

export async function registerLatentTrigger(params: {
  path: string;
  mode: "write" | "patch";
  content: string;
  written_by?: string;
  session_id?: string;
  session_token?: string;
  sha256_before?: string | null;
  bytes_before?: number;
}): Promise<LatentTriggerRecord> {
  const sha256_after = createHash("sha256").update(params.content).digest("hex");
  const categories = classifyLatentRisk(params.path);
  const intent = classifyIntent(params.path);
  
  const record: LatentTriggerRecord = {
    path: params.path,
    mode: params.mode,
    written_by: params.written_by ?? "agent:forge-000",
    session_id: params.session_id ?? "unknown",
    session_token: params.session_token,
    intent_classified: intent,
    latent_risk_categories: categories.map(c => c.category),
    sha256_after,
    timestamp: new Date().toISOString(),
    sha256_before: params.sha256_before ?? null,
    bytes_after: Buffer.byteLength(params.content, "utf-8"),
  };
  
  // Expand: add full category details for audit
  const enrichedRecord = {
    ...record,
    risk_details: categories.map(c => ({
      category: c.category,
      severity: c.severity,
      host_tools: c.host_tools,
      auto_hold: c.auto_hold,
      description: c.description,
    })),
  };
  
  // Append to JSONL
  await appendFile(TRIGGERS_PATH, JSON.stringify(enrichedRecord) + "\n", "utf-8");
  
  // Log to stderr for immediate visibility (F11 AUDIT)
  const criticalCategories = categories.filter(c => c.severity === "critical").map(c => c.category);
  const highCategories = categories.filter(c => c.severity === "high").map(c => c.category);
  
  if (criticalCategories.length > 0) {
    process.stderr.write(
      `[LATENT_TRIGGER] ⚠️ CRITICAL: ${params.path} → ${criticalCategories.join(", ")} | sha256=${sha256_after.slice(0, 12)}\n`
    );
  } else if (highCategories.length > 0) {
    process.stderr.write(
      `[LATENT_TRIGGER] ⚡ HIGH: ${params.path} → ${highCategories.join(", ")} | sha256=${sha256_after.slice(0, 12)}\n`
    );
  } else {
    process.stderr.write(
      `[LATENT_TRIGGER] ✓ ${params.path} → ${categories[0]?.category ?? "unknown"} | sha256=${sha256_after.slice(0, 12)}\n`
    );
  }
  
  return record;
}

/**
 * Return all latent triggers for a specific file path (for audit/chain tracing)
 */
export async function getLatentTriggersForPath(
  filePath: string,
  limit = 10,
): Promise<LatentTriggerRecord[]> {
  const { readFile } = await import("node:fs/promises");
  try {
    const data = await readFile(TRIGGERS_PATH, "utf-8");
    const lines = data.trim().split("\n");
    const records: LatentTriggerRecord[] = [];
    
    for (let i = lines.length - 1; i >= 0 && records.length < limit; i--) {
      if (!lines[i].trim()) continue;
      try {
        const record = JSON.parse(lines[i]);
        if (record.path === filePath) {
          records.push(record);
        }
      } catch {
        // skip malformed lines
      }
    }
    
    return records;
  } catch {
    return [];
  }
}

/**
 * Return the latest N latent triggers (for dashboard/audit)
 */
export async function getRecentTriggers(limit = 50): Promise<LatentTriggerRecord[]> {
  const { readFile } = await import("node:fs/promises");
  try {
    const data = await readFile(TRIGGERS_PATH, "utf-8");
    const lines = data.trim().split("\n");
    const records: LatentTriggerRecord[] = [];
    
    for (let i = lines.length - 1; i >= 0 && records.length < limit; i--) {
      if (!lines[i].trim()) continue;
      try {
        records.push(JSON.parse(lines[i]));
      } catch {
        // skip malformed lines
      }
    }
    
    return records;
  } catch {
    return [];
  }
}
