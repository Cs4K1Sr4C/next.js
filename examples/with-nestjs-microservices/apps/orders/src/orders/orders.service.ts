import { createHash, randomUUID } from "node:crypto";
import {
  FULFILL_JOB,
  FULFILLMENT_QUEUE,
  RpcErrorCode,
  type CreateOrderInput,
  type CreateOrderResponse,
  type FulfillmentJob,
  type ListOrdersResponse,
  type Order,
  type RpcContext,
} from "@example/contracts";
import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { Queue, type JobsOptions } from "bullmq";
import { rpcError } from "../rpc/rpc-error.js";
import { OrdersRepository } from "./orders.repository.js";

const LIST_LIMIT = 50;
const FULFILL_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 1000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly orders: OrdersRepository,
    @InjectQueue(FULFILLMENT_QUEUE)
    private readonly fulfillment: Queue<FulfillmentJob>,
  ) {}

  async create(
    ctx: RpcContext,
    idempotencyKey: string,
    input: CreateOrderInput,
  ): Promise<CreateOrderResponse> {
    const fingerprint = fingerprintOf(input);
    const order: Order = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      sku: input.sku,
      quantity: input.quantity,
      status: "pending",
      createdAt: new Date().toISOString(),
      fulfilledAt: null,
    };

    const result = await this.orders.createIdempotent(order, {
      key: idempotencyKey,
      fingerprint,
    });
    if (result.created) {
      await this.enqueueFulfillment(ctx, order);
      this.log(ctx, `Created order ${order.id}`);
      return { order, replayed: false };
    }

    if (result.existing.fingerprint !== fingerprint) {
      throw rpcError(
        RpcErrorCode.IdempotencyMismatch,
        "This idempotency key was already used with a different request",
      );
    }
    const original = await this.orders.findById(
      ctx.tenantId,
      result.existing.orderId,
    );
    if (!original) {
      throw new Error(
        `Idempotency key points at missing order ${result.existing.orderId}`,
      );
    }
    if (original.status === "pending") {
      // Storing the order and enqueueing its job are two separate writes, so a
      // crash in between strands a pending order with no job. Enqueueing again
      // on replay heals that: BullMQ ignores an add whose jobId already exists.
      // A transactional outbox would close the gap without needing a retry.
      await this.enqueueFulfillment(ctx, original);
    }
    this.log(ctx, `Replayed order ${original.id}`);
    return { order: original, replayed: true };
  }

  async list(ctx: RpcContext): Promise<ListOrdersResponse> {
    return { orders: await this.orders.listNewest(ctx.tenantId, LIST_LIMIT) };
  }

  async markFulfilled(ctx: RpcContext, orderId: string): Promise<Order> {
    const order = await this.orders.markFulfilled(
      ctx.tenantId,
      orderId,
      new Date().toISOString(),
    );
    if (!order) {
      throw rpcError(RpcErrorCode.NotFound, `Order ${orderId} was not found`);
    }
    this.log(ctx, `Order ${order.id} is fulfilled`);
    return order;
  }

  private async enqueueFulfillment(
    ctx: RpcContext,
    order: Order,
  ): Promise<void> {
    const job: FulfillmentJob = {
      tenantId: order.tenantId,
      orderId: order.id,
      requestId: ctx.requestId,
    };
    await this.fulfillment.add(FULFILL_JOB, job, {
      ...FULFILL_JOB_OPTIONS,
      jobId: order.id,
    });
  }

  private log(ctx: RpcContext, message: string): void {
    this.logger.log(
      `${message} (tenant=${ctx.tenantId} requestId=${ctx.requestId})`,
    );
  }
}

// Hashes the validated input, not the raw request, so a retry that differs
// only in formatting (whitespace, "3" vs 3) still counts as the same request.
function fingerprintOf(input: CreateOrderInput): string {
  return createHash("sha256")
    .update(JSON.stringify([input.sku, input.quantity]))
    .digest("hex");
}
