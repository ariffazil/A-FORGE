import { createHash } from 'node:crypto';
import type { PlanDAG, PlanNode, StructuralValidationResult, RiskTier, LegacyRiskTier } from '../types/plan.js';
import { PlanValidator } from '../planner/PlanValidator.js';

export type SealStatus = 'PASS' | 'HOLD' | 'VOID' | 'SABAR';

export interface SealContext {
  goalId: string;
  dag: PlanDAG;
  node: PlanNode;
  memoryHash: string;
  selfModelSnapshot?: any; // To be defined in Phase 5
  timestamp: string;
}

export interface EpistemicVerdict {
  status: 'PASS' | 'HOLD';
  reason?: string;
  weight?: number;
}

export interface SealVerdict {
  status: SealStatus;
  sealId: string;
  nodeId: string;
  riskScore: number;
  verdicts: {
    structural: StructuralValidationResult;
    epistemic: EpistemicVerdict;
  };
  escalation: {
    humanRequired: boolean;
    reflectionDepth: number;
    auditTier: 'standard' | 'vault999';
  };
  message?: string;
}

export interface EpistemicThresholds {
  // NOTE: pre-W2 SealService used { safe, guarded, dangerous }.
  // We reference LegacyRiskTier here (defined in src/types/plan.ts) so the
  // pre-existing confidence/minEvidence shape continues to compile under
  // the W2 canonical RiskTier (LOW | MEDIUM | HIGH | CRITICAL).
  confidence: Record<LegacyRiskTier, number>;
  maxUnknowns: number;
  minEvidence: Record<LegacyRiskTier, number>;
}

export class SealService {
  private readonly validator: PlanValidator;
  private readonly thresholds: EpistemicThresholds;
  private readonly arifOSBaseUrl: string;

  constructor(validator: PlanValidator, thresholds?: Partial<EpistemicThresholds>, arifOSBaseUrl?: string) {
    this.validator = validator;
    this.thresholds = {
      confidence: {
        safe: 0.6,
        guarded: 0.75,
        dangerous: 0.85
      },
      maxUnknowns: 5,
      minEvidence: {
        safe: 0,
        guarded: 1,
        dangerous: 3
      },
      ...thresholds
    };
    // Default: live VPS localhost. Override via env ARIFOS_MCP_URL for Docker (http://arifosmcp:8080).
    this.arifOSBaseUrl = arifOSBaseUrl ?? process.env.ARIFOS_MCP_URL ?? 'http://127.0.0.1:8088';
  }

  /**
   * Validate an entire PlanDAG by authorizing every node.
   * Returns the first non-PASS verdict, or PASS if all nodes pass.
   */
  public async validateDag(goalId: string, dag: PlanDAG, memoryHash: string): Promise<SealVerdict> {
    const structural = this.validator.validate(dag);
    if (!structural.isValid) {
      return this.createVerdict('VOID', this.computeSealId({ goalId, dag, node: dag.nodes.get(dag.rootId)!, memoryHash, timestamp: new Date().toISOString() }), dag.rootId, 1.0, {
        structural,
        epistemic: { status: 'HOLD', reason: 'Structural failure' }
      }, `Structural failure: ${structural.errors.join('; ')}`);
    }

    for (const [, node] of dag.nodes) {
      const context: SealContext = {
        goalId,
        dag,
        node,
        memoryHash,
        timestamp: new Date().toISOString(),
      };
      const verdict = await this.authorizeNode(context);
      if (verdict.status !== 'PASS') {
        return verdict;
      }
    }

    return this.createVerdict('PASS', this.computeSealId({ goalId, dag, node: dag.nodes.get(dag.rootId)!, memoryHash, timestamp: new Date().toISOString() }), dag.rootId, 0.0, {
      structural,
      epistemic: { status: 'PASS' }
    }, 'All nodes authorized');
  }

  /**
   * Hardened Authorization Loop
   * Delegates to arifOS Kernel via arif_judge_deliberate JSON-RPC call.
   *
   * arifOS Architectural Law: A-FORGE NEVER computes constitutional verdicts.
   * This method is the sole wired call-site — do not add fallbacks that bypass arifOS.
   */
  public async authorizeNode(context: SealContext): Promise<SealVerdict> {
    const sealId = this.computeSealId(context);

    console.log(`[A-FORGE] Requesting arifOS Kernel authorization for node: ${context.node.id}`);

    // Build candidate description from PlanNode
    const candidate = [
      `goal: ${context.node.goal}`,
      `dependencies: [${context.node.dependencies.join(', ')}]`,
      `epistemic state: ${JSON.stringify(context.node.epistemic)}`,
      `metadata: ${JSON.stringify(context.node.metadata ?? {})}`,
    ].join('\n');

    let arifOSVerdict: { status: SealStatus; message: string; riskScore?: number };

    try {
      const rpcId = `seal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const response = await fetch(`${this.arifOSBaseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'A2A-Version': '1.0',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: rpcId,
          method: 'tools/call',
          params: {
            name: 'arif_judge_deliberate',
            arguments: {
              mode: 'judge',
              candidate,
              actor_id: 'a-forge::seal-service',
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`arifOS MCP HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as { result?: { content?: Array<{ type: string; text: string }>; isError?: boolean }; error?: { message?: string } };

      if (data.error) {
        throw new Error(`arifOS JSON-RPC error: ${data.error.message}`);
      }

      const result = data.result;
      const rawText = result?.content?.[0]?.text ?? '';
      const isError = result?.isError ?? false;

      // Map arifOS verdict text to SealStatus
      // Expected text patterns: "SEAL", "SABAR", "HOLD", "VOID"
      const normalized = rawText.toUpperCase().trim();
      let status: SealStatus;
      let riskScore = 0.5;

      if (normalized.startsWith('SEAL')) {
        status = 'PASS';
        riskScore = 0.1;
      } else if (normalized.startsWith('SABAR')) {
        status = 'SABAR';
        riskScore = 0.6;
      } else if (normalized.startsWith('HOLD') || normalized.startsWith('888_HOLD')) {
        status = 'HOLD';
        riskScore = 0.85;
      } else if (normalized.startsWith('VOID') || isError) {
        status = 'VOID';
        riskScore = 1.0;
      } else {
        // Unexpected format — treat as HOLD, not as PASS
        status = 'HOLD';
        riskScore = 0.85;
        console.warn(`[A-FORGE] Unexpected arifOS verdict format: "${rawText.slice(0, 100)}"`);
      }

      arifOSVerdict = { status, message: rawText || 'arifOS Kernel adjudicated', riskScore };

    } catch (err) {
      // Network or parse failure — Architectural Law: A-FORGE must not auto-approve on error.
      // Default to HOLD; do NOT fall back to local heuristics.
      console.error(`[A-FORGE] arifOS MCP call failed: ${err}`);
      arifOSVerdict = {
        status: 'HOLD',
        message: `arifOS unreachable (${err instanceof Error ? err.message : String(err)}). Node ${context.node.id} awaiting manual adjudication.`,
        riskScore: 1.0,
      };
    }

    return this.createVerdict(
      arifOSVerdict.status,
      sealId,
      context.node.id,
      arifOSVerdict.riskScore ?? 1.0,
      { structural: { isValid: true, errors: [] }, epistemic: { status: arifOSVerdict.status === 'PASS' ? 'PASS' : 'HOLD' } },
      arifOSVerdict.message
    );
  }

  private computeSealId(context: SealContext): string {
    const data = JSON.stringify({
      goalId: context.goalId,
      dagId: context.dag.id,
      nodeId: context.node.id,
      memoryHash: context.memoryHash,
      timestamp: context.timestamp
    });
    return createHash('sha256').update(data).digest('hex');
  }

  private createVerdict(
    status: SealStatus,
    sealId: string,
    nodeId: string,
    riskScore: number,
    verdicts: any,
    message?: string
  ): SealVerdict {
    return {
      status,
      sealId,
      nodeId,
      riskScore,
      verdicts,
      escalation: {
        humanRequired: riskScore > 0.85,
        reflectionDepth: Math.ceil(riskScore * 5),
        auditTier: riskScore > 0.75 ? 'vault999' : 'standard'
      },
      message
    };
  }
}
