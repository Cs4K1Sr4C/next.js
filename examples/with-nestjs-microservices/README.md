# Next.js with NestJS microservices

This example puts a Next.js App Router frontend in front of a NestJS backend made of three independently deployable services:

| App            | What it is                                                                   | Talks to                                       |
| -------------- | ---------------------------------------------------------------------------- | ---------------------------------------------- |
| `apps/web`     | Next.js 16 app. Server Components read orders, a Server Action places them.  | `apps/gateway` over HTTP, from the server only |
| `apps/gateway` | NestJS HTTP API. Authenticates tenants, rate-limits, validates and forwards. | `apps/orders` over the Nest Redis transport    |
| `apps/orders`  | NestJS microservice. Owns all order data and enqueues background work.       | Redis (data), BullMQ (jobs)                    |
| `apps/worker`  | NestJS application context running a BullMQ worker.                          | `apps/orders` over the Nest Redis transport    |

`packages/contracts` is the only code the apps share: zod schemas, message patterns, queue names and header names, so validation rules and payload shapes cannot drift between services.

```
browser ──▶ web (Next.js) ──HTTP──▶ gateway (Nest) ──RPC──▶ orders (Nest) ──▶ Redis
                                                              │
                                                              └──job──▶ BullMQ ──▶ worker (Nest) ──RPC──▶ orders
```

## What it demonstrates

- **Backend-for-frontend.** The browser only talks to Next.js. The gateway URL and its bearer token are read in `lib/gateway.ts`, which imports `server-only`, so they can never reach a client bundle.
- **Validation at every edge.** The Server Action, the gateway and the orders service each validate input with the same schemas from `@example/contracts`. A service never trusts its caller, even an internal one.
- **Tenant isolation.** The tenant id comes only from the bearer token the gateway verifies, never from a request body or header. Every Redis key in the orders service is scoped to the tenant.
- **Idempotent writes.** `POST /orders` requires an `Idempotency-Key`. Claiming the key and storing the order happen in one Redis Lua script, so concurrent retries create exactly one order. Reusing a key with a different body returns `422`. The form sends one key per render and keeps it when a submission fails, so a retry after a timeout cannot create a duplicate.
- **Distributed rate limiting.** `@nestjs/throttler` with a Redis-backed storage gives each tenant one budget shared by every gateway instance.
- **Durable background work.** The orders service enqueues a BullMQ job per order (deduplicated by `jobId`, retried with exponential backoff). The worker confirms fulfillment through the orders service instead of writing its data, and the confirmation is idempotent, so at-least-once delivery is safe.
- **Enforced boundaries.** `pnpm lint:boundaries` runs [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) with rules that forbid cross-app imports, circular imports, backend libraries in the Next.js app and frontend libraries in the services.
- **Correlation ids.** Each request gets an `x-request-id` that is logged by the gateway, the orders service and the worker.

## How to use

This example is a [pnpm workspace](https://pnpm.io/workspaces), so bootstrap it with pnpm:

```bash
pnpm create next-app --example with-nestjs-microservices with-nestjs-microservices-app
```

You need Node.js 20.19 or later and a Redis server. To start Redis with Docker:

```bash
docker compose up -d redis
```

Then build the shared contracts and start every app in watch mode:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and place an order. It shows as `pending` and switches to `fulfilled` once the worker has processed it.

For a production build, run `pnpm build` and then `pnpm start`. With the stack running, `pnpm smoke` checks it end to end: authentication, idempotent replays, tenant isolation, validation and background fulfillment.

## Configuration

| Variable                   | Used by                 | Default                                       |
| -------------------------- | ----------------------- | --------------------------------------------- |
| `REDIS_URL`                | gateway, orders, worker | `redis://127.0.0.1:6379`                      |
| `GATEWAY_URL`              | web                     | `http://127.0.0.1:4000`                       |
| `GATEWAY_TOKEN`            | web                     | `dev-token-acme`                              |
| `GATEWAY_PORT`             | gateway                 | `4000`                                        |
| `GATEWAY_HOST`             | gateway                 | `0.0.0.0`                                     |
| `GATEWAY_TOKENS`           | gateway                 | `acme:dev-token-acme,globex:dev-token-globex` |
| `RATE_LIMIT_PER_MINUTE`    | gateway                 | `120` per tenant                              |
| `FULFILLMENT_DELAY_MS`     | worker                  | `1500`                                        |
| `FULFILLMENT_FAILURE_RATE` | worker                  | `0` (set to e.g. `0.3` to watch retries)      |
| `WORKER_CONCURRENCY`       | worker                  | `5`                                           |

`GATEWAY_TOKENS` is a comma-separated list of `tenantId:token` pairs. The defaults are public, so the gateway refuses to start without `GATEWAY_TOKENS` when `NODE_ENV=production`. Use long random tokens there.

## Before you take this to production

The example keeps the moving parts small. These are the places a production system usually goes further:

- **Transport.** The Nest Redis transport uses pub/sub, so every running instance of the orders service receives every request. The idempotent handlers keep that correct, but to scale out with competing consumers, switch the transport to NATS with a `queue` group, RabbitMQ or Kafka. Only `main.ts` and the client registrations change.
- **Outbox.** Storing an order and enqueueing its job are two writes. The example heals a crash between them by re-enqueueing when the same idempotency key is retried. A transactional outbox removes the gap without relying on a retry.
- **Storage.** Orders live in Redis to keep the example self-contained. The service depends on the abstract `OrdersRepository`, so a SQL implementation can replace `RedisOrdersRepository` without touching the service.
- **Authentication.** Static per-tenant tokens stand in for real service credentials, such as OAuth client credentials or mTLS between services, plus user sessions in the Next.js app.
- **Tracing.** Correlation ids give you one id to search across logs. For distributed traces, register OpenTelemetry in the Next.js app with [`instrumentation.ts`](https://nextjs.org/docs/app/guides/open-telemetry) and in each Nest service with the OpenTelemetry Node SDK.

## Learn more

- [Next.js: Mutating data with Server Actions](https://nextjs.org/docs/app/getting-started/mutating-data)
- [Next.js: Backend for Frontend guide](https://nextjs.org/docs/app/guides/backend-for-frontend)
- [NestJS: Microservices](https://docs.nestjs.com/microservices/basics)
- [NestJS: Queues](https://docs.nestjs.com/techniques/queues)
- [NestJS: Rate limiting](https://docs.nestjs.com/security/rate-limiting)
