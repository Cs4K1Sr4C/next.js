import type { Order } from "@example/contracts";
import { connection } from "next/server";
import { listOrders } from "../lib/gateway";
import { AutoRefresh } from "./auto-refresh";
import { OrderForm } from "./order-form";

const createdAtFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "UTC",
});

export default async function Page() {
  await connection();
  const result = await listOrders();
  const pending = result.ok ? pendingIds(result.data.orders) : "";

  return (
    <main>
      <header>
        <h1>Orders</h1>
        <p>
          This page calls the NestJS gateway from the server. The gateway
          forwards each order to the orders microservice over Redis, and a
          BullMQ worker fulfills it in the background.
        </p>
      </header>

      <section aria-labelledby="new-order-heading">
        <h2 id="new-order-heading">New order</h2>
        <OrderForm idempotencyKey={crypto.randomUUID()} />
      </section>

      <section aria-labelledby="orders-heading">
        <h2 id="orders-heading">Recent orders</h2>
        {result.ok ? (
          <>
            <OrdersTable orders={result.data.orders} />
            <AutoRefresh
              // A new set of pending orders remounts it, restarting polling.
              key={pending}
              active={pending !== ""}
            />
          </>
        ) : (
          <div className="notice">
            <strong>{result.message}</strong>
            <p>
              Your orders could not be loaded. Reload the page to try again.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function pendingIds(orders: Order[]): string {
  return orders
    .filter((order) => order.status === "pending")
    .map((order) => order.id)
    .join(",");
}

function OrdersTable({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return <p className="empty">No orders yet.</p>;
  }
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">SKU</th>
          <th scope="col">Quantity</th>
          <th scope="col">Status</th>
          <th scope="col">Created (UTC)</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr key={order.id}>
            <td>
              <code>{order.sku}</code>
            </td>
            <td>{order.quantity}</td>
            <td>
              <span className="status" data-status={order.status}>
                {order.status}
              </span>
            </td>
            <td>
              <time dateTime={order.createdAt}>
                {createdAtFormat.format(new Date(order.createdAt))}
              </time>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
