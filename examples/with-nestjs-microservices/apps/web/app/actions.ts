"use server";

import { revalidatePath } from "next/cache";
import { CreateOrderInput, IdempotencyKey } from "@example/contracts";
import { createOrder } from "../lib/gateway";

export interface OrderFormState {
  status: "idle" | "success" | "error";
  message: string;
  /** Echoed back on error because React resets the form after every action. */
  fields?: { sku: string; quantity: string };
  /**
   * The idempotency key to submit next after a failure. Background refreshes
   * render a new key, so without this a retry after an ambiguous failure (a
   * gateway timeout after the order was stored) could create a duplicate.
   */
  retryKey?: string;
}

// Server Actions are public POST endpoints: everything in `formData` is
// validated with the shared schemas, whatever the browser already checked.
export async function createOrderAction(
  _prevState: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  const fields = {
    sku: String(formData.get("sku") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
  };

  const key = IdempotencyKey.safeParse(formData.get("idempotencyKey"));
  if (!key.success) {
    return {
      status: "error",
      message: "This form has expired. Reload the page and try again.",
      fields,
    };
  }

  const input = CreateOrderInput.safeParse(fields);
  if (!input.success) {
    return {
      status: "error",
      message:
        'Enter a SKU made of letters, digits and "-", and a quantity from 1 to 100.',
      fields,
      retryKey: key.data,
    };
  }

  const result = await createOrder(input.data, key.data);
  if (!result.ok) {
    if (result.status === 422) {
      // The key is now bound to a different order body. Re-rendering issues
      // a fresh key, so the next submission is treated as a new order.
      revalidatePath("/");
      return { status: "error", message: result.message, fields };
    }
    if (result.status === 503 || result.status === 504) {
      // The order may have been stored even though no answer arrived.
      // Re-rendering shows it if so, and the kept key makes a retry safe.
      revalidatePath("/");
    }
    return {
      status: "error",
      message: result.message,
      fields,
      retryKey: key.data,
    };
  }

  revalidatePath("/");
  const { order, replayed } = result.data;
  return {
    status: "success",
    message: replayed
      ? `Your order for ${order.quantity} × ${order.sku} was already placed, so no duplicate was created.`
      : `Placed an order for ${order.quantity} × ${order.sku}.`,
  };
}
