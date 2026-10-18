import { FULFILLMENT_QUEUE } from "@example/contracts";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { RedisModule } from "../redis/redis.module.js";
import { OrdersController } from "./orders.controller.js";
import { OrdersRepository } from "./orders.repository.js";
import { OrdersService } from "./orders.service.js";
import { RedisOrdersRepository } from "./redis-orders.repository.js";

@Module({
  imports: [RedisModule, BullModule.registerQueue({ name: FULFILLMENT_QUEUE })],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    { provide: OrdersRepository, useClass: RedisOrdersRepository },
  ],
})
export class OrdersModule {}
