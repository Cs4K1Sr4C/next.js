import { redisConnectionOptions } from "@example/contracts";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { APP_PIPE } from "@nestjs/core";
import { OrdersModule } from "./orders/orders.module.js";
import { RpcValidationPipe } from "./rpc/rpc-validation.pipe.js";

@Module({
  imports: [
    BullModule.forRoot({ connection: redisConnectionOptions() }),
    OrdersModule,
  ],
  providers: [{ provide: APP_PIPE, useClass: RpcValidationPipe }],
})
export class AppModule {}
