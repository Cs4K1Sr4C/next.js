import { Module } from "@nestjs/common";
import {
  ThrottlerModule,
  type ThrottlerModuleOptions,
} from "@nestjs/throttler";
import { redisConnectionOptions } from "@example/contracts";
import { positiveIntFromEnv } from "../env.js";
import { RedisThrottlerStorage } from "./redis-throttler.storage.js";

const ONE_MINUTE_MS = 60_000;

/** Configures the throttler that `TenantThrottlerGuard` enforces. */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      useFactory: (): ThrottlerModuleOptions => ({
        throttlers: [
          {
            ttl: ONE_MINUTE_MS,
            limit: positiveIntFromEnv("RATE_LIMIT_PER_MINUTE", 120),
          },
        ],
        storage: new RedisThrottlerStorage(redisConnectionOptions()),
      }),
    }),
  ],
})
export class RateLimitModule {}
