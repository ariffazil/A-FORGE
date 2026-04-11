import type { Plugin } from "@opencode-ai/plugin"

interface GovernanceContext {
  principle?: string
  riskLevel?: "minimal" | "low" | "medium" | "high" | "critical"
  verdict?: "PASS" | "HOLD" | "SABAR" | "VOID"
}

const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+/i,
  /drop\s+table/i,
  /delete\s+from\s+\w+/i,
  /force\s+push/i,
  /git\s+push\s+--force/i,
  /chmod\s+777/i,
  /sudo\s+rm/i,
]

const INJECTION_PATTERNS = [
  /\bignore\s+previous\s+instructions/i,
  /\bforget\s+all\s+previous/i,
  /\bsystem\s+prompt/i,
  /\[\s*INST\s*\]/i,
  /<\s*system\s*>/i,
]

function assessRisk(tool: string, args: Record<string, unknown>): "minimal" | "low" | "medium" | "high" | "critical" {
  if (tool === "bash") {
    const cmd = String(args.command || "")
    if (/rm\s+-rf|deLETE\s+table|drop\s+table/i.test(cmd)) return "critical"
    if (/sudo\s+|chmod\s+777|\.env|password|secret/i.test(cmd)) return "high"
    if (/git\s+push|docker\s+compose|terraform/i.test(cmd)) return "high"
    if (/npm\s+install|cargo\s+build|go\s+build/i.test(cmd)) return "medium"
    return "low"
  }
  
  if (tool === "write" || tool === "edit") {
    const path = String(args.filePath || "")
    if (/\.env$|credentials|\.json$/.test(path)) return "high"
    if (/secret|key|password|token/i.test(path)) return "high"
    return "medium"
  }
  
  return "minimal"
}

function detectInjection(input: string): boolean {
  return INJECTION_PATTERNS.some(pattern => pattern.test(input))
}

function detectDangerousCommand(input: string): boolean {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(input))
}

export const GovernancePlugin: Plugin = async ({ client, directory, worktree }) => {
  return {
    "tool.execute.before": async (input, output) => {
      const tool = input.tool
      const args = input.args as Record<string, unknown>
      
      const riskLevel = assessRisk(tool, args)
      
      if (riskLevel === "critical") {
        await client.app.log({
          body: {
            service: "governance",
            level: "warn",
            message: `CRITICAL risk tool blocked: ${tool}`,
            riskLevel,
            tool,
            args: Object.keys(args)
          }
        })
        throw new Error(
          "F13 SOVEREIGN: 888_HOLD REQUIRED - This operation is critical risk and requires human approval. " +
          "Use the question tool to request approval before proceeding."
        )
      }
      
      if (tool === "bash") {
        const command = String(args.command || "")
        
        if (detectInjection(command)) {
          await client.app.log({
            body: {
              service: "governance",
              level: "error",
              message: "F9 ANTI-HANTU: Prompt injection detected",
              command: command.substring(0, 100)
            }
          })
          throw new Error(
            "F9 ANTI-HANTU: Prompt injection detected. " +
            "Your request appears to contain instructions attempting to override my operational guidelines. " +
            "This is a serious constitutional violation."
          )
        }
        
        if (detectDangerousCommand(command)) {
          await client.app.log({
            body: {
              service: "governance",
              level: "warn",
              message: `F4 ENTROPY: Dangerous command detected - risk escalation`,
              command: command.substring(0, 100),
              riskLevel: "high"
            }
          })
          throw new Error(
            "F4 ENTROPY: Dangerous command pattern detected. " +
            "This type of operation requires 888_HOLD approval. " +
            "Use the question tool to request human authorization."
          )
        }
      }
      
      if (tool === "write" || tool === "edit") {
        const content = String(args.content || "")
        if (detectInjection(content)) {
          throw new Error("F9 ANTI-HANTU: Prompt injection detected in file content")
        }
      }
      
      await client.app.log({
        body: {
          service: "governance",
          level: "info",
          message: `Tool executed: ${tool}`,
          riskLevel,
          directory
        }
      })
    },
    
    "tool.execute.after": async (input, output) => {
      await client.app.log({
        body: {
          service: "governance",
          level: "debug",
          message: `Tool completed: ${input.tool}`,
          success: output.ok,
          directory
        }
      })
    },
    
    "permission.asked": async (input, output) => {
      const tool = input.tool
      const args = input.args as Record<string, unknown>
      const riskLevel = assessRisk(tool, args)
      
      await client.app.log({
        body: {
          service: "governance",
          level: "info",
          message: `Permission requested: ${tool}`,
          riskLevel,
          tool,
          args: Object.keys(args)
        }
      })
      
      if (riskLevel === "high" || riskLevel === "critical") {
        output.context = {
          principle: "F13 Sovereign - Human (Arif) has final authority",
          riskLevel,
          verdict: "HOLD",
          message: `This ${tool} operation is ${riskLevel} risk. Please review carefully before approving.`
        }
      } else {
        output.context = {
          principle: "F4 Entropy - Track risk delta",
          riskLevel,
          verdict: "PASS",
          message: `This ${tool} operation is ${riskLevel} risk. Standard approval granted.`
        }
      }
    },
    
    "permission.replied": async (input, output) => {
      await client.app.log({
        body: {
          service: "governance",
          level: "info",
          message: `Permission ${input.permission} for ${input.tool}`,
          granted: output.granted,
          tool: input.tool
        }
      })
    },
    
    "session.created": async (input, output) => {
      await client.app.log({
        body: {
          service: "governance",
          level: "info",
          message: "AF-FORGE session initiated",
          constitutionalMode: true,
          principles: ["F1 Amanah", "F2 Truth", "F9 Anti-Hantu", "F13 Sovereign"]
        }
      })
    },
    
    "session.idle": async (input, output) => {
      await client.app.log({
        body: {
          service: "governance",
          level: "info",
          message: "AF-FORGE session completed",
          constitutionalMode: true
        }
      })
    }
  }
}

export default GovernancePlugin
