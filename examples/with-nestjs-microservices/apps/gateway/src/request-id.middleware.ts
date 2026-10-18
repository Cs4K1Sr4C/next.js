import { randomUUID } from "node:crypto";
import { HttpHeaders, RequestId } from "@example/contracts";
import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Response } from "express";
import type { GatewayRequest } from "./gateway-request.js";

// Caller-supplied ids end up in log lines and response headers, so only a
// conservative character set is accepted; anything else gets a fresh id.

@Injectable()
export class RequestIdMiddleware
  implements NestMiddleware<GatewayRequest, Response>
{
  use(request: GatewayRequest, response: Response, next: NextFunction): void {
    const incoming = RequestId.safeParse(request.get(HttpHeaders.RequestId));
    request.requestId = incoming.success ? incoming.data : randomUUID();
    response.setHeader(HttpHeaders.RequestId, request.requestId);
    next();
  }
}
