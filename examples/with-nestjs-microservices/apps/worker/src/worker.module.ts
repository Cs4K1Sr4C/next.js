import {
  FULFILLMENT_QUEUE,
  ORDERS_SERVICE,
  redisConnectionOptions,
} from "@example/contracts";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { FulfillmentProcessor } from "./fulfillment.processor.js";

@Module({
  imports: [
    BullModule.forRoot({ connection: redisConnectionOptions() }),
    BullModule.registerQueue({ name: FULFILLMENT_QUEUE }),
    ClientsModule.register([
      {
        name: ORDERS_SERVICE,
        transport: Transport.REDIS,
        options: redisConnectionOptions(),
      },
    ]),
  ],
  providers: [FulfillmentProcessor],
})
export class WorkerModule {}
