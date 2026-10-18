import { Module } from "@nestjs/common";
import {
  ThrottlerModule,
  type ThrottlerModuleOptions,
} from "@nestjs/throttler";
import { redisConnectionOptions } from "@example/contracts";
import { positiveIntFromEnv } from "../env.js";
import type { GatewayRequest } from "../gateway-request.js";
import { RedisThrottlerStorage } from "./redis-throttler.storage.js";
import { clientTracker } from "./tenant-throttler.guard.js";

const ONE_MINUTE_MS = 60_000;

/** Configures the throttlers that `TenantThrottlerGuard` enforces, in order. */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      useFactory: (): ThrottlerModuleOptions => ({
        throttlers: [
          {
            // Each end user of a tenant, so one visitor of the Next.js app
            // cannot use up the budget every other visitor depends on. Named
            // "default" so its 429s carry the standard Retry-After header.
            name: "default",
            ttl: ONE_MINUTE_MS,
            limit: positiveIntFromEnv("CLIENT_RATE_LIMIT_PER_MINUTE", 120),
            getTracker: (request) => clientTracker(request as GatewayRequest),
          },
          {
            // The tenant as a whole. Callers choose their own client ids, so
            // this ceiling is what bounds a tenant's total load. It has no
            // lockout: requests pass again as soon as the window has room.
            name: "tenant",
            ttl: ONE_MINUTE_MS,
            limit: positiveIntFromEnv("RATE_LIMIT_PER_MINUTE", 1200),
            blockDuration: 0,
          },
        ],
        storage: new RedisThrottlerStorage(redisConnectionOptions()),
      }),
    }),
  ],
})
export class RateLimitModule {}
