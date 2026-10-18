import type { Order } from "@example/contracts";

export interface IdempotencyClaim {
  key: string;
  /** Hash of the validated input, to detect a key reused for another body. */
  fingerprint: string;
}

/** What an idempotency key remembers about the request that first used it. */
export interface IdempotencyRecord {
  orderId: string;
  fingerprint: string;
}

export type CreateIdempotentResult =
  | { created: true }
  | { created: false; existing: IdempotencyRecord };

/**
 * Storage port for orders. Every method is scoped to a tenant, and the
 * abstract class doubles as the DI token so the service never depends on a
 * concrete database.
 */
export abstract class OrdersRepository {
  /**
   * Claims the idempotency key (remembered for 24 hours) and stores the order
   * as one atomic step. If the key is already claimed nothing is written and
   * the earlier record is returned instead.
   */
  abstract createIdempotent(
    order: Order,
    idempotency: IdempotencyClaim,
  ): Promise<CreateIdempotentResult>;

  abstract findById(tenantId: string, orderId: string): Promise<Order | null>;

  /** Returns at most `limit` orders, newest first. */
  abstract listNewest(tenantId: string, limit: number): Promise<Order[]>;

  /**
   * Atomically moves a pending order to fulfilled and leaves a fulfilled one
   * untouched. Resolves to the stored order, or `null` if it does not exist.
   */
  abstract markFulfilled(
    tenantId: string,
    orderId: string,
    fulfilledAt: string,
  ): Promise<Order | null>;
}
