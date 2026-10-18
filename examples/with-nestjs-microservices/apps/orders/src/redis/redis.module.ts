import { redisConnectionOptions } from "@example/contracts";
import {
  Inject,
  Logger,
  Module,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { Redis } from "ioredis";

/** Injection token for the shared ioredis client that stores order data. */
export const REDIS_CLIENT = Symbol("REDIS_CLIENT");

@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (): Redis => {
        const logger = new Logger("Redis");
        const client = new Redis(redisConnectionOptions());
        client.on("error", (error: Error) => logger.error(error.message));
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}
