import { z } from "zod";
import type { CreateOrderInput } from "./orders.js";

/** DI token for the `ClientProxy` that talks to the orders service. */
export const ORDERS_SERVICE = "ORDERS_SERVICE";

/** Request/response message patterns served by `apps/orders`. */
export const OrdersPatterns = {
  Create: "orders.create",
  List: "orders.list",
  MarkFulfilled: "orders.markFulfilled",
} as const;

/** BullMQ queue that `apps/orders` produces to and `apps/worker` consumes. */
export const FULFILLMENT_QUEUE = "fulfillment";
export const FULFILL_JOB = "fulfill";

/**
 * Custom BullMQ backoff type set on fulfillment jobs. `apps/worker` registers
 * `fulfillmentRetryDelay` as its strategy.
 */
export const FULFILLMENT_BACKOFF = "capped-exponential";

/**
 * Delay before the next attempt: exponential from one second, capped at one
 * minute so that a long outage is retried steadily instead of ever more
 * rarely.
 */
export function fulfillmentRetryDelay(attemptsMade: number): number {
  return Math.min(1000 * 2 ** Math.max(0, attemptsMade - 1), 60_000);
}

/** HTTP headers shared by the gateway and its callers. */
export const HttpHeaders = {
  IdempotencyKey: "idempotency-key",
  IdempotentReplayed: "idempotent-replayed",
  RequestId: "x-request-id",
  /**
   * Identifies the end user a trusted caller (the Next.js app) is acting for,
   * so the gateway can rate-limit each of them separately.
   */
  ClientId: "x-client-id",
} as const;

// Tenant ids are embedded in Redis keys, so the character set is restricted.
export const TenantId = z.string().regex(/^[a-z0-9-]{1,32}$/);

// Request ids end up in log lines and response headers.
export const RequestId = z.string().regex(/^[A-Za-z0-9_-]{8,128}$/);

// Client ids are embedded in rate-limit keys. IPv4 and IPv6 addresses fit.
export const ClientId = z.string().regex(/^[A-Za-z0-9.:_-]{1,64}$/);

/**
 * Minted by the gateway for every create request. The Redis transport
 * delivers each request to every orders instance, so this tells a second
 * instance handling the same delivery apart from a client retrying.
 */
export const DeliveryId = z.uuid();

/**
 * Carried by every message. The tenant is always taken from the authenticated
 * gateway request, never from a client-supplied body.
 */
export const RpcContext = z.object({
  tenantId: TenantId,
  requestId: RequestId,
});
export type RpcContext = z.infer<typeof RpcContext>;

export interface CreateOrderCommand {
  ctx: RpcContext;
  deliveryId: string;
  idempotencyKey: string;
  input: CreateOrderInput;
}

export interface ListOrdersQuery {
  ctx: RpcContext;
}

export interface MarkFulfilledCommand {
  ctx: RpcContext;
  orderId: string;
}

export interface FulfillmentJob {
  tenantId: string;
  orderId: string;
  requestId: string;
}

export const RpcErrorCode = {
  Validation: "VALIDATION",
  NotFound: "NOT_FOUND",
  /** Same idempotency key reused with a different request body. */
  IdempotencyMismatch: "IDEMPOTENCY_MISMATCH",
} as const;
export type RpcErrorCode = (typeof RpcErrorCode)[keyof typeof RpcErrorCode];

/** Payload of every `RpcException` thrown by the services. */
export interface RpcErrorPayload {
  code: RpcErrorCode;
  message: string;
}

export function isRpcErrorPayload(value: unknown): value is RpcErrorPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as RpcErrorPayload).code === "string" &&
    typeof (value as RpcErrorPayload).message === "string" &&
    Object.values(RpcErrorCode).includes((value as RpcErrorPayload).code)
  );
}
