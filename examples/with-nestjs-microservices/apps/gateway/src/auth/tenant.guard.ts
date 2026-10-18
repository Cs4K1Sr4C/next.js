import {
  Injectable,
  Logger,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Response } from "express";
import type { GatewayRequest } from "../gateway-request.js";
import { IS_PUBLIC_KEY } from "./public.decorator.js";
import { TenantTokens } from "./tenant-tokens.js";

const BEARER_TOKEN = /^Bearer\s+(\S+)\s*$/i;

/**
 * Global guard: every route needs `Authorization: Bearer <token>` unless it is
 * marked `@Public()`. The token is the only source of the tenant id.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TenantTokens,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      return true;
    }

    const http = context.switchToHttp();
    const request = http.getRequest<GatewayRequest>();
    const token = BEARER_TOKEN.exec(request.get("authorization") ?? "")?.[1];
    const tenantId =
      token === undefined ? undefined : this.tokens.resolve(token);
    if (tenantId === undefined) {
      this.logger.warn(
        `Rejected ${request.method} ${request.path}: missing or invalid bearer token (requestId=${request.requestId})`,
      );
      http.getResponse<Response>().setHeader("WWW-Authenticate", "Bearer");
      throw new UnauthorizedException("Missing or invalid bearer token");
    }

    request.tenantId = tenantId;
    return true;
  }
}
