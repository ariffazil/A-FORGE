import type { Request, Response, NextFunction } from "express";
import { getDpopMode, verifyRequestDpop } from "./dpop.js";

export function createOperatorAuthMiddleware(token?: string) {
  return async function requireOperatorAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!token) {
      next();
      return;
    }
    const authHeader = req.headers.authorization;
    const expected = `Bearer ${token}`;
    if (!authHeader || authHeader !== expected) {
      res.status(401).json({
        ok: false,
        error: { type: "unauthorized", message: "Missing or invalid bearer token" },
      });
      return;
    }
    const dpopMode = getDpopMode();
    if (dpopMode !== "off") {
      const dpop = await verifyRequestDpop(req);
      if (!dpop.ok) {
        if (dpopMode === "enforce") {
          res.status(401).json({
            ok: false,
            error: { type: "unauthorized", message: dpop.error ?? "DPoP verification failed" },
          });
          return;
        }
        res.setHeader("X-DPoP-Status", `OBSERVE:${dpop.error ?? "failed"}`);
      } else if (dpop.jwkThumbprint) {
        res.setHeader("X-DPoP-Status", "VERIFIED");
      }
    }
    next();
  };
}
