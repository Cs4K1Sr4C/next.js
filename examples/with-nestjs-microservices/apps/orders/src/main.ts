import "reflect-metadata";
import { redisConnectionOptions } from "@example/contracts";
import { NestFactory } from "@nestjs/core";
import { Transport, type MicroserviceOptions } from "@nestjs/microservices";
import { AppModule } from "./app.module.js";

const app = await NestFactory.createMicroservice<MicroserviceOptions>(
  AppModule,
  {
    transport: Transport.REDIS,
    options: redisConnectionOptions(),
  },
);

app.enableShutdownHooks();
await app.listen();
