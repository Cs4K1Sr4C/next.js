import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { ClientProxy } from "@nestjs/microservices";
import {
  ORDERS_SERVICE,
  OrdersPatterns,
  RpcErrorCode,
  isRpcErrorPayload,
  type CreateOrderCommand,
  type CreateOrderResponse,
  type ListOrdersQuery,
  type ListOrdersResponse,
  type RpcContext,
} from "@example/contracts";
import { TimeoutError, firstValueFrom, timeout } from "rxjs";

const RPC_TIMEOUT_MS = 5000;

const EXCEPTION_BY_RPC_ERROR: Record<
  RpcErrorCode,
  new (message: string) => HttpException
> = {
  [RpcErrorCode.Validation]: BadRequestException,
  [RpcErrorCode.NotFound]: NotFoundException,
  [RpcErrorCode.IdempotencyMismatch]: UnprocessableEntityException,
};

/** Typed request/response calls to the orders service over Redis. */
@Injectable()
export class OrdersClient {
  private readonly logger = new Logger(OrdersClient.name);

  constructor(@Inject(ORDERS_SERVICE) private readonly client: ClientProxy) {}

  create(command: CreateOrderCommand): Promise<CreateOrderResponse> {
    return this.send(OrdersPatterns.Create, command);
  }

  list(query: ListOrdersQuery): Promise<ListOrdersResponse> {
    return this.send(OrdersPatterns.List, query);
  }

  private async send<TResult>(
    pattern: string,
    payload: { ctx: RpcContext },
  ): Promise<TResult> {
    try {
      return await firstValueFrom(
        this.client
          .send<TResult>(pattern, payload)
          .pipe(timeout(RPC_TIMEOUT_MS)),
      );
    } catch (error) {
      throw this.toHttpException(pattern, payload.ctx.requestId, error);
    }
  }

  private toHttpException(
    pattern: string,
    requestId: string,
    error: unknown,
  ): HttpException {
    if (isRpcErrorPayload(error)) {
      return new EXCEPTION_BY_RPC_ERROR[error.code](error.message);
    }
    if (error instanceof TimeoutError) {
      // A timeout does not mean the command failed: the orders service may
      // still process it. Retrying POST /orders with the same Idempotency-Key
      // is safe because it cannot create a second order.
      this.logger.error(
        `${pattern} timed out after ${RPC_TIMEOUT_MS}ms (requestId=${requestId})`,
      );
      return new GatewayTimeoutException(
        "The orders service did not respond in time",
      );
    }
    // The details stay in the log; clients only learn that the upstream failed.
    this.logger.error(
      `${pattern} failed (requestId=${requestId})`,
      error instanceof Error ? error.stack : JSON.stringify(error),
    );
    return new BadGatewayException("The orders service is unavailable");
  }
}
