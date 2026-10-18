import {
  CreateOrderInput,
  IdempotencyKey,
  Order,
  OrdersPatterns,
  RpcContext,
  type CreateOrderResponse,
  type ListOrdersResponse,
} from "@example/contracts";
import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { OrdersService } from "./orders.service.js";

// Every field is validated again here even though the gateway already checked
// it: this service must not trust whoever can publish to its Redis channels.
@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /** Handles a `CreateOrderCommand`. */
  @MessagePattern(OrdersPatterns.Create)
  create(
    @Payload("ctx", { schema: RpcContext }) ctx: RpcContext,
    @Payload("idempotencyKey", { schema: IdempotencyKey })
    idempotencyKey: string,
    @Payload("input", { schema: CreateOrderInput }) input: CreateOrderInput,
  ): Promise<CreateOrderResponse> {
    return this.orders.create(ctx, idempotencyKey, input);
  }

  /** Handles a `ListOrdersQuery`. */
  @MessagePattern(OrdersPatterns.List)
  list(
    @Payload("ctx", { schema: RpcContext }) ctx: RpcContext,
  ): Promise<ListOrdersResponse> {
    return this.orders.list(ctx);
  }

  /** Handles a `MarkFulfilledCommand`. */
  @MessagePattern(OrdersPatterns.MarkFulfilled)
  markFulfilled(
    @Payload("ctx", { schema: RpcContext }) ctx: RpcContext,
    @Payload("orderId", { schema: Order.shape.id }) orderId: string,
  ): Promise<Order> {
    return this.orders.markFulfilled(ctx, orderId);
  }
}
