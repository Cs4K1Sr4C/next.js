import { Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { ORDERS_SERVICE, redisConnectionOptions } from "@example/contracts";
import { OrdersClient } from "./orders.client.js";
import { OrdersController } from "./orders.controller.js";

/** The gateway holds no order data: every route is forwarded to the orders service. */
@Module({
  imports: [
    ClientsModule.register([
      {
        name: ORDERS_SERVICE,
        transport: Transport.REDIS,
        options: redisConnectionOptions(),
      },
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersClient],
})
export class OrdersModule {}
