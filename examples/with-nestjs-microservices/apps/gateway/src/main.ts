import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";
import { positiveIntFromEnv } from "./env.js";

const port = positiveIntFromEnv("GATEWAY_PORT", 4000);
const host = process.env.GATEWAY_HOST ?? "0.0.0.0";

const app = await NestFactory.create<NestExpressApplication>(AppModule, {
  // The API only accepts JSON, through the parser registered below.
  bodyParser: false,
});
app.disable("x-powered-by");
// Bodies are parsed before any guard runs, so unauthenticated callers reach
// the parser too. An order is a few short fields; keep the cap small.
app.useBodyParser("json", { limit: "16kb" });
app.enableShutdownHooks();

await app.listen(port, host);
Logger.log(`Gateway listening on ${await app.getUrl()}`, "Bootstrap");
