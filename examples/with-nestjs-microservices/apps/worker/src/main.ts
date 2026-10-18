import "reflect-metadata";
import { FULFILLMENT_QUEUE } from "@example/contracts";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { WorkerModule } from "./worker.module.js";

// No HTTP server: the worker only consumes the queue.
const app = await NestFactory.createApplicationContext(WorkerModule);
// On SIGTERM, closing the BullMQ worker lets in-flight jobs finish instead of
// leaving them locked until another worker picks them up as stalled.
app.enableShutdownHooks();
Logger.log(`Worker consuming the "${FULFILLMENT_QUEUE}" queue`, "Bootstrap");
