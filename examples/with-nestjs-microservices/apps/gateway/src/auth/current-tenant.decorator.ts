import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { GatewayRequest } from "../gateway-request.js";

/** Injects the id of the tenant that `TenantGuard` authenticated. */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const { tenantId } = context.switchToHttp().getRequest<GatewayRequest>();
    if (tenantId === undefined) {
      throw new Error(
        "@CurrentTenant() was used on a route that TenantGuard does not authenticate",
      );
    }
    return tenantId;
  },
);
