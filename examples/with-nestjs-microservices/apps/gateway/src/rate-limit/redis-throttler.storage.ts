import { Logger, type OnApplicationShutdown } from "@nestjs/common";
import type { ThrottlerStorage } from "@nestjs/throttler";
import type { RedisConnectionOptions } from "@example/contracts";
import { Redis, type Result } from "ioredis";

type ThrottlerStorageRecord = Awaited<
  ReturnType<ThrottlerStorage["increment"]>
>;

// Runs atomically, so concurrent requests on any number of gateway instances
// cannot both read the same count and slip past the limit.
//   KEYS: hit counter, block marker
//   ARGV: ttl (ms), limit, block duration (ms)
//   Returns: hits, ms left in the window, blocked (0 or 1), ms left blocked
const THROTTLE_SCRIPT = `
local blockLeft = redis.call('PTTL', KEYS[2])
if blockLeft > 0 then
  return { tonumber(redis.call('GET', KEYS[1]) or 0), blockLeft, 1, blockLeft }
end

local hits = redis.call('INCR', KEYS[1])
if hits == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local windowLeft = redis.call('PTTL', KEYS[1])
if hits <= tonumber(ARGV[2]) then
  return { hits, windowLeft, 0, 0 }
end

local blockDuration = tonumber(ARGV[3])
if blockDuration <= 0 then
  return { hits, windowLeft, 1, windowLeft }
end
redis.call('SET', KEYS[2], '1', 'PX', blockDuration)
-- Start a fresh window once the block lifts, as the in-memory storage does.
redis.call('PEXPIRE', KEYS[1], blockDuration)
return { hits, blockDuration, 1, blockDuration }
`;

declare module "ioredis" {
  interface RedisCommander<Context> {
    throttle(
      hitsKey: string,
      blockKey: string,
      ttlMs: number,
      limit: number,
      blockDurationMs: number,
    ): Result<[number, number, number, number], Context>;
  }
}

/** `ThrottlerGuard` reports remaining times in seconds (`Retry-After`). */
function toSeconds(ms: number): number {
  return Math.max(0, Math.ceil(ms / 1000));
}

/** Shares rate-limit counters between every gateway instance through Redis. */
export class RedisThrottlerStorage
  implements ThrottlerStorage, OnApplicationShutdown
{
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly redis: Redis;

  constructor(connection: RedisConnectionOptions) {
    this.redis = new Redis({
      ...connection,
      // Fail fast, and closed: while Redis is unreachable a request errors
      // after one reconnect attempt instead of waiting behind ioredis' default
      // of 20, and is never served without being counted.
      maxRetriesPerRequest: 1,
    });
    this.redis.on("error", (error: Error) =>
      this.logger.error(`Redis connection error: ${error.message}`),
    );
    this.redis.defineCommand("throttle", {
      numberOfKeys: 2,
      lua: THROTTLE_SCRIPT,
    });
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    // The {hash tag} keeps both keys in one Redis Cluster slot, which a script
    // that touches several keys requires.
    const prefix = `gateway:throttle:{${throttlerName}:${key}}`;
    const [totalHits, windowLeft, blocked, blockLeft] =
      await this.redis.throttle(
        `${prefix}:hits`,
        `${prefix}:block`,
        ttl,
        limit,
        blockDuration,
      );
    return {
      totalHits,
      timeToExpire: toSeconds(windowLeft),
      isBlocked: blocked === 1,
      timeToBlockExpire: toSeconds(blockLeft),
    };
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }
}
