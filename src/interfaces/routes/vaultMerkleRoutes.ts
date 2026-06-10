import { Router } from "express";
import type { Request, Response } from "express";
import { MerkleV3Service, getPostgresVaultClient } from "../../infrastructure/vault/index.js";

export function createVaultMerkleRouter(): Router {
  const router = Router();

  router.get("/verify", async (req: Request, res: Response) => {
    try {
      const dateStr = typeof req.query.date === "string" ? req.query.date : undefined;
      const date = dateStr ? new Date(dateStr) : new Date();
      const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
      if (!postgresUrl) {
        res.status(503).json({ ok: false, error: { type: "unavailable", message: "No database connection" } });
        return;
      }
      const vault = getPostgresVaultClient(postgresUrl);
      const merkle = new MerkleV3Service(vault);
      const result = await merkle.verifyChain(date);
      res.json({ ok: true, ...result, date: date.toISOString().split("T")[0] });
    } catch (error) {
      console.error("[A-FORGE] /vault/merkle/verify error:", error);
      res.status(500).json({ ok: false, error: { type: "internal_error", message: String(error) } });
    }
  });

  router.post("/seal", async (req: Request, res: Response) => {
    try {
      const dateStr = (req.body as { date?: string }).date;
      const date = dateStr ? new Date(dateStr) : new Date();
      const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
      if (!postgresUrl) {
        res.status(503).json({ ok: false, error: { type: "unavailable", message: "No database connection" } });
        return;
      }
      const vault = getPostgresVaultClient(postgresUrl);
      const merkle = new MerkleV3Service(vault);
      const result = await merkle.dailySeal(date);
      console.error(`[MerkleV3] dailySeal ${date.toISOString().split("T")[0]}: valid=${result.valid} rows=${result.rowCount}`);
      res.json({ ok: true, ...result, date: date.toISOString().split("T")[0] });
    } catch (error) {
      console.error("[A-FORGE] /vault/merkle/seal error:", error);
      res.status(500).json({ ok: false, error: { type: "internal_error", message: String(error) } });
    }
  });

  return router;
}

