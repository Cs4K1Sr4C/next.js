import { z } from 'zod'

// Schemas are shared by every edge that accepts input (the Server Action in
// `apps/web`, the HTTP gateway and the orders service), so validation rules
// cannot drift between them.

export const CreateOrderInput = z.object({
  sku: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9-]+$/, 'SKU may only contain letters, digits and "-"'),
  quantity: z.coerce.number().int().min(1).max(100),
})
export type CreateOrderInput = z.infer<typeof CreateOrderInput>

export const OrderStatus = z.enum(['pending', 'fulfilled'])
export type OrderStatus = z.infer<typeof OrderStatus>

export const Order = z.object({
  id: z.uuid(),
  tenantId: z.string(),
  sku: z.string(),
  quantity: z.number().int(),
  status: OrderStatus,
  createdAt: z.iso.datetime(),
  fulfilledAt: z.iso.datetime().nullable(),
})
export type Order = z.infer<typeof Order>

/**
 * Client-chosen key that makes `POST /orders` safe to retry. Replaying the
 * same key with the same body returns the original order instead of creating
 * a second one.
 */
export const IdempotencyKey = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/)

export interface ListOrdersResponse {
  orders: Order[]
}

export interface CreateOrderResponse {
  order: Order
  /** `true` when the idempotency key matched an earlier request. */
  replayed: boolean
}
