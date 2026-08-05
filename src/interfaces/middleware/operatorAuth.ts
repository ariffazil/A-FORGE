/**
 * Operator Auth Middleware — Stub (module pending implementation).
 * Forged 2026-08-05 to unblock A-FORGE build for FQ gate deployment.
 */
export function operatorAuthMiddleware(_req: any, _res: any, next: () => void) {
  next();
}

export function createOperatorAuthMiddleware(_opts?: any) {
  return operatorAuthMiddleware;
}
