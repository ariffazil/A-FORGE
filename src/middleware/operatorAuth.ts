import type { Request, Response, NextFunction } from "express";

export function createOperatorAuthMiddleware(token?: string) {
  return function requireOperatorAuth(req: Request, res: Response, next: NextFunction): void {
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
    next();
  };
}
