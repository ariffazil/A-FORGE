/**
 * Peer Contract Routes — Governed P2P Federation Contract v1
 *
 * Exposes A-FORGE's own peer contract and validates inbound peer contracts.
 * All mutating peer-proposed actions must still pass session/lease/pre-forge/arifOS-judge gates.
 *
 * DITEMPA BUKAN DIBERI
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { PeerContractService } from "../../domain/governance/PeerContractService.js";

export function createPeerContractRouter(): Router {
  const router = Router();
  const service = new PeerContractService();

  /**
   * GET /peer/contract
   * Returns A-FORGE's governed P2P federation contract.
   */
  router.get("/contract", (_req: Request, res: Response) => {
    try {
      const result = service.loadSelfContract();
      if (!result.ok || !result.contract) {
        res.status(500).json({
          ok: false,
          error: {
            type: "contract_load_failure",
            message: result.errors.join("; "),
          },
        });
        return;
      }
      res.json({ ok: true, contract: result.contract });
    } catch (error) {
      console.error("[A-FORGE] /peer/contract error:", error);
      res.status(500).json({
        ok: false,
        error: {
          type: "internal_error",
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  });

  /**
   * POST /peer/contract/validate
   * Validates an arbitrary peer contract against the v1 schema and constitutional rules.
   */
  router.post("/contract/validate", (req: Request, res: Response) => {
    try {
      const result = service.validate(req.body);
      res.status(result.ok ? 200 : 422).json({
        ok: result.ok,
        errors: result.errors,
        contract: result.contract,
      });
    } catch (error) {
      console.error("[A-FORGE] /peer/contract/validate error:", error);
      res.status(500).json({
        ok: false,
        error: {
          type: "internal_error",
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  });

  /**
   * POST /peer/execute
   * Accepts a peer-proposed execution payload.
   *
   * This endpoint is intentionally a thin gate:
   *   1. Validate the peer contract.
   *   2. Check action/risk against the contract.
   *   3. Require session_id + lease_id.
   *   4. Return a receipt; the caller must then route through arifOS judge for SEAL.
   *
   * A-FORGE does NOT execute purely from a peer proposal. arifOS SEAL is required.
   */
  router.post("/execute", async (req: Request, res: Response) => {
    try {
      const { contract, action_class, risk_tier, tool_name, session_id, lease_id, payload, peer_contract_id } = req.body;

      if (!contract || !action_class || !tool_name || !session_id) {
        res.status(400).json({
          ok: false,
          error: {
            type: "invalid_request",
            message: "contract, action_class, tool_name, session_id are required",
          },
        });
        return;
      }

      const validation = service.validate(contract);
      if (!validation.ok || !validation.contract) {
        res.status(403).json({
          ok: false,
          error: {
            type: "peer_contract_rejected",
            message: validation.errors.join("; "),
          },
        });
        return;
      }

      const peerContract = validation.contract;

      if (!service.isActionPermitted(peerContract, action_class)) {
        res.status(403).json({
          ok: false,
          error: {
            type: "action_not_permitted",
            message: `action_class '${action_class}' not in peer contract`,
          },
        });
        return;
      }

      if (risk_tier && !service.isRiskPermitted(peerContract, risk_tier)) {
        res.status(403).json({
          ok: false,
          error: {
            type: "risk_exceeds_ceiling",
            message: `risk_tier '${risk_tier}' exceeds contract max '${peerContract.capability_card.max_risk_tier}'`,
          },
        });
        return;
      }

      // Lease is required for all non-judge peers per constitutional rule
      if (!lease_id && peerContract.authority_class !== "judge") {
        res.status(403).json({
          ok: false,
          error: {
            type: "lease_required",
            message: "lease_id is required for non-judge peer actions",
          },
        });
        return;
      }

      res.json({
        ok: true,
        status: "PEER_EXECUTION_PREPARED",
        note: "This endpoint prepares only. Actual execution requires arifOS 888 JUDGE SEAL.",
        peer_id: peerContract.peer_id,
        action_class,
        risk_tier,
        tool_name,
        session_id,
        lease_id,
        payload,
        peer_contract_id,
        next_step: "POST to arifOS arif_judge_deliberate or A-FORGE /execute with hold_id",
      });
    } catch (error) {
      console.error("[A-FORGE] /peer/execute error:", error);
      res.status(500).json({
        ok: false,
        error: {
          type: "internal_error",
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  });

  return router;
}
