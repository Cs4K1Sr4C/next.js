import { setTimeout as sleep } from "node:timers/promises";
import {
  FULFILLMENT_QUEUE,
  ORDERS_SERVICE,
  OrdersPatterns,
  isRpcErrorPayload,
  type FulfillmentJob,
  type MarkFulfilledCommand,
} from "@example/contracts";
import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger, type BeforeApplicationShutdown } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { UnrecoverableError, type Job } from "bullmq";
import { TimeoutError, firstValueFrom, timeout } from "rxjs";
import { fractionFromEnv, integerFromEnv } from "./env.js";

// Read when this module loads, so a bad value stops the worker at startup.
const CONCURRENCY = integerFromEnv("WORKER_CONCURRENCY", 5, 1);
const CARRIER_DELAY_MS = integerFromEnv("FULFILLMENT_DELAY_MS", 1500, 0);
const CARRIER_FAILURE_RATE = fractionFromEnv("FULFILLMENT_FAILURE_RATE", 0);
// The Redis transport is pub/sub: a request published while no orders
// instance is subscribed is dropped, not queued. Only this timeout turns that
// silence into a failed attempt that BullMQ can retry.
const CONFIRM_TIMEOUT_MS = 5000;

@Processor(FULFILLMENT_QUEUE, { concurrency: CONCURRENCY })
export class FulfillmentProcessor
  extends WorkerHost
  implements BeforeApplicationShutdown
{
  private readonly logger = new Logger(FulfillmentProcessor.name);

  constructor(@Inject(ORDERS_SERVICE) private readonly orders: ClientProxy) {
    super();
  }

  // Nest closes the RPC client before the BullMQ worker, both in the
  // `onApplicationShutdown` phase. Draining the worker first lets in-flight
  // jobs confirm over a live connection instead of failing mid-call (and being
  // retried) or reopening a connection that nothing closes.
  async beforeApplicationShutdown(): Promise<void> {
    await this.worker.close();
  }

  async process(job: Job<FulfillmentJob>): Promise<void> {
    const { tenantId, orderId, requestId } = job.data;
    await this.shipWithCarrier();

    // BullMQ delivers a job at least once: a failed or timed-out confirmation
    // is retried, and so is a job whose worker died before acknowledging it.
    // That is safe because MarkFulfilled is idempotent. The worker never
    // writes the order itself, since the orders service owns that data.
    const reply = this.orders
      .send(OrdersPatterns.MarkFulfilled, {
        ctx: { tenantId, requestId },
        orderId,
      } satisfies MarkFulfilledCommand)
      .pipe(timeout(CONFIRM_TIMEOUT_MS));
    try {
      await firstValueFrom(reply);
    } catch (error) {
      throw toJobError(error);
    }
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job<FulfillmentJob>): void {
    this.logger.log(
      withContext(job.data, `Fulfilled order ${job.data.orderId}`),
    );
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<FulfillmentJob> | undefined, error: Error): void {
    if (!job) {
      // BullMQ passes no job when one that kept stalling was already removed.
      this.logger.error(`A fulfillment job failed: ${error.message}`);
      return;
    }
    // `attemptsMade` already counts the attempt that just failed.
    const attempts = job.opts.attempts ?? 1;
    const willRetry =
      job.attemptsMade < attempts && !(error instanceof UnrecoverableError);
    const message = withContext(
      job.data,
      `Fulfilling order ${job.data.orderId} failed on attempt ${job.attemptsMade}/${attempts}` +
        `, ${willRetry ? "retrying" : "giving up"}: ${error.message}`,
    );
    if (willRetry) {
      this.logger.warn(message);
    } else {
      this.logger.error(message);
    }
  }

  // Without a listener, BullMQ reports Redis connection errors through
  // `console.error`, bypassing the application logger.
  @OnWorkerEvent("error")
  onError(error: Error): void {
    this.logger.error(`Worker error: ${error.message}`, error.stack);
  }

  /** Stands in for a call to a shipping carrier's API. */
  private async shipWithCarrier(): Promise<void> {
    await sleep(CARRIER_DELAY_MS);
    if (Math.random() < CARRIER_FAILURE_RATE) {
      throw new Error("Simulated carrier outage");
    }
  }
}

/**
 * The orders service rejects with a plain `{ code, message }` object rather
 * than an Error. Its codes describe a request that was refused (unknown order,
 * invalid payload), which no retry can fix, so the job fails for good instead
 * of spending its remaining attempts. Timeouts and transport errors stay
 * retryable.
 */
function toJobError(error: unknown): Error {
  if (error instanceof TimeoutError) {
    return new Error(
      `No reply to ${OrdersPatterns.MarkFulfilled} within ${CONFIRM_TIMEOUT_MS} ms`,
    );
  }
  if (error instanceof Error) {
    return error;
  }
  if (isRpcErrorPayload(error)) {
    return new UnrecoverableError(`${error.code}: ${error.message}`);
  }
  return new Error(
    `Unexpected error from the orders service: ${JSON.stringify(error)}`,
  );
}

function withContext(job: FulfillmentJob, message: string): string {
  return `${message} (tenant=${job.tenantId} requestId=${job.requestId})`;
}
