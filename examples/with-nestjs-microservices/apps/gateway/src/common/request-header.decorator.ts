import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

/**
 * Injects a single request header. Unlike `@Headers()`, it accepts pipes, so
 * the value can be validated: `@RequestHeader('Idempotency-Key', pipe)`.
 */
export const RequestHeader = createParamDecorator(
  (name: string, context: ExecutionContext): string | undefined =>
    context.switchToHttp().getRequest<Request>().get(name),
);
