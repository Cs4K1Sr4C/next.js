import "reflect-metadata";
import { redisConnectionOptions } from "@example/contracts";
import { NestFactory } from "@nestjs/core";
import { Transport, type MicroserviceOptions } from "@nestjs/microservices";
import { AppModule } from "./app.module.js";

const app = await NestFactory.createMicroservice<MicroserviceOptions>(
  AppModule,
  {
    transport: Transport.REDIS,
    options: {
      ...redisConnectionOptions(),
      // Without retry options the transport's pub/sub connections give up
      // after the first disconnect: the process keeps running but never
      // answers another request.
      retryAttempts: Number.MAX_SAFE_INTEGER,
      retryDelay: 1000,
    },
  },
);

app.enableShutdownHooks();
await app.listen();
