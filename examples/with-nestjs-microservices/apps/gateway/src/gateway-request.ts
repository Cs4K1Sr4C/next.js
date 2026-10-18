import type { Request } from "express";

/** An Express request after the gateway's middleware and guards have run. */
export interface GatewayRequest extends Request {
  /** Set by `RequestIdMiddleware` on every request. */
  requestId: string;
  /** Set by `TenantGuard` from the bearer token; absent on `@Public()` routes. */
  tenantId?: string;
}
