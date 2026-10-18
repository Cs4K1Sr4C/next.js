import { Order } from "@example/contracts";
import { Inject, Injectable } from "@nestjs/common";
import { Redis } from "ioredis";
import { REDIS_CLIENT } from "../redis/redis.module.js";
import type {
  CreateIdempotentResult,
  IdempotencyClaim,
  IdempotencyRecord,
  OrdersRepository,
} from "./orders.repository.js";

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

// The tenant is wrapped in a `{hash tag}` so all of a tenant's keys map to the
// same Redis Cluster slot, which the multi-key script and MGET below require.
const orderKey = (tenantId: string, orderId: string): string =>
  `order:{${tenantId}}:${orderId}`;
const tenantIndexKey = (tenantId: string): string => `orders:{${tenantId}}`;
const idempotencyKey = (tenantId: string, key: string): string =>
  `idem:{${tenantId}}:${key}`;

// KEYS: idempotency key, order key, tenant index
// ARGV: idempotency record, TTL, order JSON, createdAt (ms), order id
// Claiming the key and writing the order run as one script, so a claimed key
// always points at a stored order and there is no "in progress" state for a
// concurrent retry to observe.
const CREATE_IDEMPOTENT = `
if redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', ARGV[2]) then
  redis.call('SET', KEYS[2], ARGV[3])
  redis.call('ZADD', KEYS[3], ARGV[4], ARGV[5])
  return false
end
return redis.call('GET', KEYS[1])
`;

// KEYS: order key
// ARGV: fulfilledAt
// A read-modify-write in one script, so concurrent deliveries of the same job
// cannot overwrite each other's fulfilledAt.
const MARK_FULFILLED = `
local raw = redis.call('GET', KEYS[1])
if not raw then
  return false
end
local order = cjson.decode(raw)
if order.status == 'pending' then
  order.status = 'fulfilled'
  order.fulfilledAt = ARGV[1]
  raw = cjson.encode(order)
  redis.call('SET', KEYS[1], raw)
end
return raw
`;

@Injectable()
export class RedisOrdersRepository implements OrdersRepository {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async createIdempotent(
    order: Order,
    idempotency: IdempotencyClaim,
  ): Promise<CreateIdempotentResult> {
    const record: IdempotencyRecord = {
      orderId: order.id,
      fingerprint: idempotency.fingerprint,
    };
    const existing = await this.redis.eval(
      CREATE_IDEMPOTENT,
      3,
      idempotencyKey(order.tenantId, idempotency.key),
      orderKey(order.tenantId, order.id),
      tenantIndexKey(order.tenantId),
      JSON.stringify(record),
      IDEMPOTENCY_TTL_SECONDS,
      JSON.stringify(order),
      Date.parse(order.createdAt),
      order.id,
    );
    return typeof existing === "string"
      ? { created: false, existing: JSON.parse(existing) as IdempotencyRecord }
      : { created: true };
  }

  async findById(tenantId: string, orderId: string): Promise<Order | null> {
    const raw = await this.redis.get(orderKey(tenantId, orderId));
    return raw === null ? null : parseOrder(raw);
  }

  async listNewest(tenantId: string, limit: number): Promise<Order[]> {
    const ids = await this.redis.zrevrange(
      tenantIndexKey(tenantId),
      0,
      limit - 1,
    );
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.redis.mget(ids.map((id) => orderKey(tenantId, id)));
    return rows
      .filter((raw): raw is string => raw !== null)
      .map((raw) => parseOrder(raw));
  }

  async markFulfilled(
    tenantId: string,
    orderId: string,
    fulfilledAt: string,
  ): Promise<Order | null> {
    const raw = await this.redis.eval(
      MARK_FULFILLED,
      1,
      orderKey(tenantId, orderId),
      fulfilledAt,
    );
    return typeof raw === "string" ? parseOrder(raw) : null;
  }
}

// Parsing through the contracts schema validates what storage returned and
// restores the field order that the Lua cjson round-trip does not preserve.
function parseOrder(raw: string): Order {
  return Order.parse(JSON.parse(raw));
}
