import { Injectable, type ExecutionContext } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { ClientId, HttpHeaders } from "@example/contracts";
import type { GatewayRequest } from "../gateway-request.js";

/**
 * Enforces the throttlers configured in `RateLimitModule`. Its own tracker,
 * used by the per-tenant ceiling, is the tenant rather than the client IP:
 * one tenant's traffic can come from many addresses, and many tenants can
 * share one egress address. Must run after `TenantGuard`, which sets the
 * tenant id.
 */
@Injectable()
export class TenantThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(
    request: GatewayRequest,
  ): Promise<string> {
    return request.tenantId !== undefined
      ? `tenant:${request.tenantId}`
      : `ip:${await super.getTracker(request)}`;
  }

  // The default key is per route; keying by tracker alone gives each tracker a
  // single budget across the whole API.
  protected override generateKey(
    _context: ExecutionContext,
    tracker: string,
  ): string {
    return tracker;
  }
}

/**
 * Tracker for one end user of a tenant. A tenant like the Next.js app serves
 * many people with one token, so it says whom each request is for in
 * `x-client-id`. Requests without a valid id share one bucket per tenant.
 */
export function clientTracker(request: GatewayRequest): string {
  const clientId = ClientId.safeParse(request.get(HttpHeaders.ClientId));
  return `tenant:${request.tenantId ?? "none"}:client:${clientId.success ? clientId.data : "unknown"}`;
}
