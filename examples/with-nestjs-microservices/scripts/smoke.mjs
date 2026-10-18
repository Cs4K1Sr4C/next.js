// End-to-end check of the running stack: `pnpm start` (or `pnpm dev`) first,
// then `pnpm smoke`. Uses the default development tokens unless overridden.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://127.0.0.1:4000";
const TOKEN_A = process.env.SMOKE_TOKEN_A ?? "dev-token-acme";
const TOKEN_B = process.env.SMOKE_TOKEN_B ?? "dev-token-globex";

async function call(path, { token, method = "GET", body, headers = {} } = {}) {
  const res = await fetch(new URL(path, GATEWAY_URL), {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  return { status: res.status, headers: res.headers, json, text };
}

async function step(name, fn) {
  await fn();
  console.log(`✓ ${name}`);
}

const key = randomUUID();
const sku = `SMOKE-${key.slice(0, 8)}`;
let orderId;

await step("health check is public", async () => {
  const res = await call("/health");
  assert.equal(res.status, 200);
});

await step("requests without a valid token are rejected", async () => {
  assert.equal((await call("/orders")).status, 401);
  assert.equal(
    (await call("/orders", { token: "not-a-real-token" })).status,
    401,
  );
});

await step("creating an order returns 201", async () => {
  const res = await call("/orders", {
    token: TOKEN_A,
    method: "POST",
    body: { sku, quantity: 2 },
    headers: { "idempotency-key": key },
  });
  assert.equal(res.status, 201, res.text);
  assert.equal(res.json.replayed, false);
  assert.equal(res.json.order.status, "pending");
  orderId = res.json.order.id;
});

await step(
  "replaying the same idempotency key returns the same order",
  async () => {
    const res = await call("/orders", {
      token: TOKEN_A,
      method: "POST",
      body: { sku, quantity: 2 },
      headers: { "idempotency-key": key },
    });
    assert.equal(res.status, 200, res.text);
    assert.equal(res.json.replayed, true);
    assert.equal(res.json.order.id, orderId);
    assert.equal(res.headers.get("idempotent-replayed"), "true");
  },
);

await step("reusing the key with a different body is rejected", async () => {
  const res = await call("/orders", {
    token: TOKEN_A,
    method: "POST",
    body: { sku, quantity: 3 },
    headers: { "idempotency-key": key },
  });
  assert.equal(res.status, 422, res.text);
});

await step(
  "missing idempotency key and invalid bodies return 400",
  async () => {
    const missingKey = await call("/orders", {
      token: TOKEN_A,
      method: "POST",
      body: { sku, quantity: 1 },
    });
    assert.equal(missingKey.status, 400, missingKey.text);
    const invalid = await call("/orders", {
      token: TOKEN_A,
      method: "POST",
      body: { sku: "not valid!", quantity: 1000 },
      headers: { "idempotency-key": randomUUID() },
    });
    assert.equal(invalid.status, 400, invalid.text);
  },
);

await step("other tenants cannot see the order", async () => {
  const res = await call("/orders", { token: TOKEN_B });
  assert.equal(res.status, 200, res.text);
  assert.ok(!res.json.orders.some((order) => order.id === orderId));
});

await step("the worker fulfills the order", async () => {
  const deadline = Date.now() + 30_000;
  for (;;) {
    const res = await call("/orders", { token: TOKEN_A });
    assert.equal(res.status, 200, res.text);
    const order = res.json.orders.find((o) => o.id === orderId);
    assert.ok(order, "order missing from list");
    if (order.status === "fulfilled") break;
    assert.ok(Date.now() < deadline, "order was not fulfilled within 30s");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
});

console.log("\nAll checks passed.");
