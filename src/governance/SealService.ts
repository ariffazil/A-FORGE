import { createHash } from 'node:crypto';
import type { PlanDAG, PlanNode, StructuralValidationResult, RiskTier } from '../types/plan.js';
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
  confidence: Record<RiskTier, number>;
  maxUnknowns: number;
  minEvidence: Record<RiskTier, number>;
}

export class SealService {
  private readonly validator: PlanValidator;
  private readonly thresholds: EpistemicThresholds;

  constructor(validator: PlanValidator, thresholds?: Partial<EpistemicThresholds>) {
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
   * Delegates to arifOS Kernel for constitutional verdict.
   */
  public async authorizeNode(context: SealContext): Promise<SealVerdict> {
    const sealId = this.computeSealId(context);

    // Architectural Law: A-FORGE NEVER computes constitutional verdicts.
    // In this foundation phase, we assume the need for arifOS authorization.
    console.log(`[A-FORGE] Requesting arifOS Kernel authorization for node: ${context.node.id}`);
    
    // Placeholder for arifOS MCP call
    const arifOSVerdict = { 
        status: 'HOLD' as SealStatus, 
        message: 'Pending arifOS Kernel adjudication (Architectural Law)' 
    };

    return this.createVerdict(
        arifOSVerdict.status, 
        sealId, 
        context.node.id, 
        1.0, 
        { structural: { isValid: true, errors: [] }, epistemic: { status: 'HOLD' } },
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
