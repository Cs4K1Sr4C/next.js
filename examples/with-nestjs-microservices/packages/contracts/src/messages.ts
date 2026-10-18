import type { CreateOrderInput } from './orders.js'

/** DI token for the `ClientProxy` that talks to the orders service. */
export const ORDERS_SERVICE = 'ORDERS_SERVICE'

/** Request/response message patterns served by `apps/orders`. */
export const OrdersPatterns = {
  Create: 'orders.create',
  List: 'orders.list',
  MarkFulfilled: 'orders.markFulfilled',
} as const

/** BullMQ queue that `apps/orders` produces to and `apps/worker` consumes. */
export const FULFILLMENT_QUEUE = 'fulfillment'

/**
 * Carried by every message. The tenant is always taken from the authenticated
 * gateway request, never from a client-supplied body.
 */
export interface RpcContext {
  tenantId: string
  requestId: string
}

export interface CreateOrderCommand {
  ctx: RpcContext
  idempotencyKey: string
  input: CreateOrderInput
}

export interface ListOrdersQuery {
  ctx: RpcContext
}

export interface MarkFulfilledCommand {
  ctx: RpcContext
  orderId: string
}

export interface FulfillmentJob {
  tenantId: string
  orderId: string
  requestId: string
}

export const RpcErrorCode = {
  Validation: 'VALIDATION',
  NotFound: 'NOT_FOUND',
  /** Same idempotency key reused with a different request body. */
  IdempotencyMismatch: 'IDEMPOTENCY_MISMATCH',
} as const
export type RpcErrorCode = (typeof RpcErrorCode)[keyof typeof RpcErrorCode]

/** Payload of every `RpcException` thrown by the services. */
export interface RpcErrorPayload {
  code: RpcErrorCode
  message: string
}

export function isRpcErrorPayload(value: unknown): value is RpcErrorPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as RpcErrorPayload).code === 'string' &&
    typeof (value as RpcErrorPayload).message === 'string' &&
    Object.values(RpcErrorCode).includes((value as RpcErrorPayload).code)
  )
}
