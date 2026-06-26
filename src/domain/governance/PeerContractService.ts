/**
 * PeerContractService — Governed P2P Federation Contract v1
 *
 * Validates peer contracts for A-FORGE. Enforces:
 *   - Schema shape (Zod)
 *   - Only arifOS may hold authority_class === "judge"
 *   - A-FORGE itself is authority_class === "execute"
 *   - human_veto.f13_absolute must be true
 *   - Forbidden actions are non-empty
 *
 * DITEMPA BUKAN DIBERI
 */

import { z } from "zod";
import { readFileSync } from "fs";
import { resolve } from "path";

const PeerIdSchema = z.object({
  organ: z.enum(["arifOS", "AAA", "A-FORGE", "GEOX", "WEALTH", "WELL", "APEX", "HERMES"]),
  instance_id: z.string().uuid(),
  did: z.string().regex(/^did:arifos:[a-z0-9_-]+$/),
  public_key_fingerprint: z.string().min(16),
});

const CapabilityCardSchema = z.object({
  schema_hash: z.string().min(8),
  constitution_hash: z.string().optional(),
  tool_manifest_url: z.string().url(),
  allowed_action_classes: z.array(z.enum(["OBSERVE", "PREPARE", "MUTATE", "ATOMIC"])).min(1),
  max_risk_tier: z.enum(["T0", "T1", "T2", "T3", "T4", "T5"]),
  skills: z.array(z.string()).optional(),
});

const AcceptedInputSchema = z.object({
  schema_id: z.string(),
  schema_url: z.string().url(),
});

const AuditSinkSchema = z.object({
  vault999_endpoint: z.string().url(),
  receipt_format: z.literal("arifos_vault999_v2"),
  nats_subject: z.string().optional(),
});

const HumanVetoSchema = z.object({
  f13_absolute: z.literal(true),
  override_paths: z.array(
    z.object({
      channel: z.enum(["telegram", "a2a_task", "mcp_tool", "voice"]),
      endpoint: z.string(),
    })
  ),
});

const SignedAttestationSchema = z.object({
  issuer: z.literal("arifOS-888-JUDGE"),
  signature: z.string(),
  issued_at: z.string().datetime(),
  expires_at: z.string().datetime(),
});

export const PeerFederationContractSchema = z.object({
  contract_version: z.literal("1.0.0"),
  peer_id: PeerIdSchema,
  authority_class: z.enum(["evidence", "advisory", "route", "execute", "judge"]),
  capability_card: CapabilityCardSchema,
  lease_required: z.boolean(),
  reversibility_score: z.number().min(0).max(1),
  accepted_inputs: z.array(AcceptedInputSchema).optional(),
  forbidden_actions: z.array(z.string()).min(1),
  audit_sink: AuditSinkSchema,
  human_veto: HumanVetoSchema,
  trust_score: z.number().min(0).max(1).optional(),
  signed_attestation: SignedAttestationSchema.optional(),
});

export type PeerFederationContract = z.infer<typeof PeerFederationContractSchema>;

export interface ContractValidationResult {
  ok: boolean;
  contract?: PeerFederationContract;
  errors: string[];
}

const SELF_CONTRACT_PATH = resolve(
  process.cwd(),
  "../AAA/a2a/peer-contracts/a-forge-executor.json"
);

export class PeerContractService {
  private selfContract: PeerFederationContract | null = null;

  constructor(private readonly selfContractPath: string = SELF_CONTRACT_PATH) {}

  loadSelfContract(): ContractValidationResult {
    try {
      const raw = JSON.parse(readFileSync(this.selfContractPath, "utf-8"));
      return this.validate(raw);
    } catch (err) {
      return {
        ok: false,
        errors: [`Failed to load self contract: ${(err as Error).message}`],
      };
    }
  }

  getSelfContract(): PeerFederationContract {
    if (!this.selfContract) {
      const result = this.loadSelfContract();
      if (!result.ok || !result.contract) {
        throw new Error(`Self contract invalid: ${result.errors.join(", ")}`);
      }
      this.selfContract = result.contract;
    }
    return this.selfContract;
  }

  validate(input: unknown): ContractValidationResult {
    const parseResult = PeerFederationContractSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        ok: false,
        errors: parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      };
    }

    const contract = parseResult.data;
    const errors: string[] = [];

    // Constitutional hard rule: only arifOS may judge
    if (contract.authority_class === "judge" && contract.peer_id.organ !== "arifOS") {
      errors.push(`authority_class 'judge' is exclusive to arifOS; found organ '${contract.peer_id.organ}'`);
    }

    // Self-identity consistency for A-FORGE
    if (contract.peer_id.organ === "A-FORGE" && contract.authority_class !== "execute") {
      errors.push(`A-FORGE organ must have authority_class 'execute'`);
    }

    // F13 veto is non-negotiable
    if (contract.human_veto.f13_absolute !== true) {
      errors.push("human_veto.f13_absolute must be true");
    }

    // Non-judge peers must require a lease
    if (contract.authority_class !== "judge" && !contract.lease_required) {
      errors.push(`non-judge authority_class '${contract.authority_class}' must set lease_required=true`);
    }

    return {
      ok: errors.length === 0,
      contract: errors.length === 0 ? contract : undefined,
      errors,
    };
  }

  /**
   * Check whether a proposed action class is permitted under a peer contract.
   */
  isActionPermitted(contract: PeerFederationContract, actionClass: string): boolean {
    return contract.capability_card.allowed_action_classes.includes(actionClass as any);
  }

  /**
   * Check whether a proposed risk tier exceeds the contract ceiling.
   */
  isRiskPermitted(contract: PeerFederationContract, tier: string): boolean {
    const tiers = ["T0", "T1", "T2", "T3", "T4", "T5"];
    const maxIdx = tiers.indexOf(contract.capability_card.max_risk_tier);
    const tierIdx = tiers.indexOf(tier);
    if (tierIdx === -1 || maxIdx === -1) return false;
    return tierIdx <= maxIdx;
  }

  /**
   * Check whether an action is explicitly forbidden by the contract.
   */
  isForbidden(contract: PeerFederationContract, action: string): boolean {
    return contract.forbidden_actions.includes(action);
  }
}
