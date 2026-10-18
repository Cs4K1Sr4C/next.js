import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { GatewayRequest } from "../gateway-request.js";

/** Injects the id that `RequestIdMiddleware` assigned to the current request. */
export const RequestId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string =>
    context.switchToHttp().getRequest<GatewayRequest>().requestId,
);
