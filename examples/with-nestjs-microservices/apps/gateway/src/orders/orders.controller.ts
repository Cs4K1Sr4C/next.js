import { randomUUID } from "node:crypto";
import { Body, Controller, Get, HttpStatus, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import {
  CreateOrderInput,
  HttpHeaders,
  IdempotencyKey,
  type CreateOrderResponse,
  type ListOrdersResponse,
} from "@example/contracts";
import { CurrentTenant } from "../auth/current-tenant.decorator.js";
import { RequestHeader } from "../common/request-header.decorator.js";
import { RequestId } from "../common/request-id.decorator.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { OrdersClient } from "./orders.client.js";

@Controller("orders")
export class OrdersController {
  constructor(private readonly orders: OrdersClient) {}

  @Get()
  list(
    @CurrentTenant() tenantId: string,
    @RequestId() requestId: string,
  ): Promise<ListOrdersResponse> {
    return this.orders.list({ ctx: { tenantId, requestId } });
  }

  /** Responds 201 for a new order and 200 when the key replays an earlier one. */
  @Post()
  async create(
    @CurrentTenant() tenantId: string,
    @RequestId() requestId: string,
    @RequestHeader(
      HttpHeaders.IdempotencyKey,
      new ZodValidationPipe(IdempotencyKey),
    )
    idempotencyKey: string,
    @Body(new ZodValidationPipe(CreateOrderInput)) input: CreateOrderInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CreateOrderResponse> {
    const result = await this.orders.create({
      ctx: { tenantId, requestId },
      deliveryId: randomUUID(),
      idempotencyKey,
      input,
    });
    if (result.replayed) {
      response
        .status(HttpStatus.OK)
        .setHeader(HttpHeaders.IdempotentReplayed, "true");
    }
    return result;
  }
}
