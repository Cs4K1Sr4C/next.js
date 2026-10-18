import "server-only";
import {
  HttpHeaders,
  type CreateOrderInput,
  type CreateOrderResponse,
  type ListOrdersResponse,
} from "@example/contracts";

// The token identifies this app's tenant to the gateway. It is read on the
// server only, and `server-only` turns any client import of this module into a
// build error, so it can never end up in a browser bundle.
const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://127.0.0.1:4000";
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN ?? "dev-token-acme";
const REQUEST_TIMEOUT_MS = 5000;

export interface GatewayFailure {
  ok: false;
  status: number;
  message: string;
}

export type GatewayResult<T> = { ok: true; data: T } | GatewayFailure;

const UNAVAILABLE: GatewayFailure = {
  ok: false,
  status: 503,
  message: "Order service unavailable",
};

// Upstream error bodies are never shown to users: they can carry internal
// details, and the gateway's wording is not written for end users.
const MESSAGE_BY_STATUS: Record<number, string> = {
  400: "The order details were rejected. Check them and try again.",
  401: "This app is not authorized to use the order service.",
  422: "This form was already submitted with different details. Submit again to place a new order.",
  429: "Too many requests. Wait a moment and try again.",
  502: "Order service unavailable",
  504: "The order service took too long to respond. Try again.",
};

interface RequestOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown;
}

async function request<T>(
  path: string,
  { method = "GET", headers = {}, body }: RequestOptions = {},
): Promise<GatewayResult<T>> {
  const requestId = crypto.randomUUID();
  try {
    const response = await fetch(new URL(path, GATEWAY_URL), {
      method,
      headers: {
        authorization: `Bearer ${GATEWAY_TOKEN}`,
        [HttpHeaders.RequestId]: requestId,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      const log = response.status >= 500 ? console.error : console.warn;
      log(
        `Gateway ${method} ${path} responded ${response.status} (requestId=${requestId})`,
      );
      return {
        ok: false,
        status: response.status,
        message:
          MESSAGE_BY_STATUS[response.status] ??
          "Something went wrong. Try again.",
      };
    }
    return { ok: true, data: (await response.json()) as T };
  } catch (error) {
    console.error(
      `Gateway ${method} ${path} failed (requestId=${requestId})`,
      error,
    );
    return UNAVAILABLE;
  }
}

export function listOrders(): Promise<GatewayResult<ListOrdersResponse>> {
  return request<ListOrdersResponse>("/orders");
}

/**
 * Responds with the original order (`replayed: true`) when `idempotencyKey`
 * was already used with the same input, so retrying cannot create a duplicate.
 */
export function createOrder(
  input: CreateOrderInput,
  idempotencyKey: string,
): Promise<GatewayResult<CreateOrderResponse>> {
  return request<CreateOrderResponse>("/orders", {
    method: "POST",
    headers: { [HttpHeaders.IdempotencyKey]: idempotencyKey },
    body: input,
  });
}
