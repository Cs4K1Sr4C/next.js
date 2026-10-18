import { Injectable, type ExecutionContext } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { GatewayRequest } from "../gateway-request.js";

/**
 * Rate-limits per tenant rather than per client IP: one tenant's traffic can
 * come from many addresses, and many tenants can share one egress address.
 * Must run after `TenantGuard`, which sets the tenant id.
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

  // The default key is per route; keying by tracker alone gives each tenant a
  // single budget across the whole API.
  protected override generateKey(
    _context: ExecutionContext,
    tracker: string,
  ): string {
    return tracker;
  }
}
