"use client";

import { useActionState } from "react";
import { createOrderAction, type OrderFormState } from "./actions";

const initialState: OrderFormState = { status: "idle", message: "" };

export function OrderForm({ idempotencyKey }: { idempotencyKey: string }) {
  const [state, formAction, pending] = useActionState(
    createOrderAction,
    initialState,
  );

  return (
    <form action={formAction} className="order-form">
      {/*
        A double submit or a retried POST sends the same key, so the gateway
        returns the original order instead of creating a second one. A
        successful order re-renders the page, which issues a new key.
      */}
      <input
        type="hidden"
        name="idempotencyKey"
        value={state.retryKey ?? idempotencyKey}
      />
      <label>
        SKU
        <input
          name="sku"
          required
          maxLength={64}
          pattern="[A-Za-z0-9\-]+"
          title='Letters, digits and "-"'
          placeholder="WIDGET-1"
          autoComplete="off"
          defaultValue={state.fields?.sku}
        />
      </label>
      <label>
        Quantity
        <input
          name="quantity"
          type="number"
          required
          min={1}
          max={100}
          step={1}
          defaultValue={state.fields?.quantity ?? "1"}
        />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Placing order…" : "Place order"}
      </button>
      <p className="form-message" data-status={state.status} aria-live="polite">
        {state.message}
      </p>
    </form>
  );
}
