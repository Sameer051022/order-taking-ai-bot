import { getDb, json, newId, nowIso } from "../db/index.js";
import { bus } from "./events.js";
import type { Address, Order, OrderStatus, PricedLine, Totals } from "./types.js";
import { DomainError } from "./types.js";

export const DELIVERY_FLOW: OrderStatus[] = ["CONFIRMED", "PREPARING", "READY", "RIDER_ASSIGNED", "ON_THE_WAY", "DELIVERED"];
export const PICKUP_FLOW: OrderStatus[] = ["CONFIRMED", "PREPARING", "READY", "COLLECTED"];
export const TERMINAL: OrderStatus[] = ["DELIVERED", "COLLECTED", "CANCELLED"];

export function rowToOrder(r: any): Order {
  return { ...r, address: json<Address | null>(r.address, null), items: json<PricedLine[]>(r.items, []), totals: json<Totals>(r.totals, {} as Totals) };
}

export function nextOrderNumber(restaurantId: string): number {
  const r = getDb().prepare("SELECT COALESCE(MAX(order_number), 5000) AS n FROM orders WHERE restaurant_id = ?").get(restaurantId) as { n: number };
  return r.n + 1;
}

export interface CreateOrderInput {
  restaurant_id: string;
  branch_id: string;
  customer_id: string | null;
  conversation_id: string | null;
  channel: string;
  source?: "ai" | "manual";
  fulfilment: "delivery" | "pickup";
  address: Address | null;
  customer_name: string | null;
  customer_phone: string | null;
  items: PricedLine[];
  totals: Totals;
  promo_code: string | null;
  payment_method: string;
  eta_min: number | null;
  eta_max: number | null;
  created_at?: string;
  status?: OrderStatus;
  silent?: boolean;
}

export function createOrder(input: CreateOrderInput): Order {
  const ts = input.created_at ?? nowIso();
  const order: Order = {
    id: newId("ORD"),
    restaurant_id: input.restaurant_id,
    branch_id: input.branch_id,
    customer_id: input.customer_id,
    conversation_id: input.conversation_id,
    order_number: nextOrderNumber(input.restaurant_id),
    channel: input.channel,
    source: input.source ?? "ai",
    status: input.status ?? "CONFIRMED",
    fulfilment: input.fulfilment,
    address: input.address,
    customer_name: input.customer_name,
    customer_phone: input.customer_phone,
    items: input.items,
    totals: input.totals,
    promo_code: input.promo_code,
    payment_method: input.payment_method,
    payment_status: input.payment_method === "online" ? "paid" : "pending",
    eta_min: input.eta_min,
    eta_max: input.eta_max,
    created_at: ts,
    updated_at: ts,
  };
  const db = getDb();
  db.prepare(
    `INSERT INTO orders (id, restaurant_id, branch_id, customer_id, conversation_id, order_number, channel, source, status, fulfilment, address,
      customer_name, customer_phone, items, totals, promo_code, payment_method, payment_status, eta_min, eta_max, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    order.id, order.restaurant_id, order.branch_id, order.customer_id, order.conversation_id, order.order_number, order.channel, order.source,
    order.status, order.fulfilment, order.address ? JSON.stringify(order.address) : null, order.customer_name, order.customer_phone,
    JSON.stringify(order.items), JSON.stringify(order.totals), order.promo_code, order.payment_method, order.payment_status,
    order.eta_min, order.eta_max, order.created_at, order.updated_at,
  );
  db.prepare("INSERT INTO order_events (order_id, status, note, created_at) VALUES (?,?,?,?)").run(order.id, order.status, "Order placed", ts);
  if (!input.silent) bus.publish({ type: "order.created", restaurant_id: order.restaurant_id, order_id: order.id });
  return order;
}

export function getOrder(orderId: string): Order | undefined {
  const r = getDb().prepare("SELECT o.*, b.name AS branch_name FROM orders o JOIN branches b ON b.id = o.branch_id WHERE o.id = ?").get(orderId);
  return r ? rowToOrder(r) : undefined;
}

export function getOrderByNumber(restaurantId: string, orderNumber: number): Order | undefined {
  const r = getDb().prepare("SELECT o.*, b.name AS branch_name FROM orders o JOIN branches b ON b.id = o.branch_id WHERE o.restaurant_id = ? AND o.order_number = ?").get(restaurantId, orderNumber);
  return r ? rowToOrder(r) : undefined;
}

export function listOrders(restaurantId: string, opts: { limit?: number; active?: boolean; customer_id?: string; since?: string } = {}): Order[] {
  const where = ["o.restaurant_id = ?"];
  const params: unknown[] = [restaurantId];
  if (opts.active) { where.push(`o.status NOT IN (${TERMINAL.map(() => "?").join(",")})`); params.push(...TERMINAL); }
  if (opts.customer_id) { where.push("o.customer_id = ?"); params.push(opts.customer_id); }
  if (opts.since) { where.push("o.created_at >= ?"); params.push(opts.since); }
  params.push(opts.limit ?? 50);
  const rows = getDb()
    .prepare(`SELECT o.*, b.name AS branch_name FROM orders o JOIN branches b ON b.id = o.branch_id WHERE ${where.join(" AND ")} ORDER BY o.created_at DESC LIMIT ?`)
    .all(...params);
  return rows.map(rowToOrder);
}

export function listOrderEvents(orderId: string): { status: string; note: string | null; created_at: string }[] {
  return getDb().prepare("SELECT status, note, created_at FROM order_events WHERE order_id = ? ORDER BY id").all(orderId) as any[];
}

export function nextStatus(order: Order): OrderStatus | null {
  const flow = order.fulfilment === "delivery" ? DELIVERY_FLOW : PICKUP_FLOW;
  const i = flow.indexOf(order.status);
  if (i < 0 || i === flow.length - 1) return null;
  return flow[i + 1];
}

export function transitionOrder(orderId: string, status: OrderStatus, note?: string): Order {
  const order = getOrder(orderId);
  if (!order) throw new DomainError("Order not found", "ORDER_NOT_FOUND");
  if (TERMINAL.includes(order.status)) throw new DomainError(`Order #${order.order_number} is already ${order.status}`, "ORDER_TERMINAL");
  const flow = order.fulfilment === "delivery" ? DELIVERY_FLOW : PICKUP_FLOW;
  if (status !== "CANCELLED" && flow.indexOf(status) <= flow.indexOf(order.status)) {
    throw new DomainError(`Cannot move order #${order.order_number} from ${order.status} to ${status}`, "INVALID_TRANSITION");
  }
  const ts = nowIso();
  const db = getDb();
  db.prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?").run(status, ts, orderId);
  db.prepare("INSERT INTO order_events (order_id, status, note, created_at) VALUES (?,?,?,?)").run(orderId, status, note ?? null, ts);
  const updated = { ...order, status, updated_at: ts };
  bus.publish({ type: "order.updated", restaurant_id: order.restaurant_id, order_id: orderId, status });
  return updated;
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  CONFIRMED: "Confirmed",
  PREPARING: "Being prepared",
  READY: "Ready",
  RIDER_ASSIGNED: "Rider assigned",
  ON_THE_WAY: "On the way",
  DELIVERED: "Delivered",
  COLLECTED: "Collected",
  CANCELLED: "Cancelled",
};

/** Customer-facing message for a status change. Produced by the backend, not the LLM. */
export function statusMessage(order: Order, status: OrderStatus): string {
  const n = `#${order.order_number}`;
  switch (status) {
    case "CONFIRMED": return `Your order ${n} has been confirmed. 🍗`;
    case "PREPARING": return `Order ${n} is now being prepared in the kitchen. 👨‍🍳`;
    case "READY": return order.fulfilment === "pickup" ? `Order ${n} is ready for pickup at ${order.branch_name ?? "the branch"}. 🛍️` : `Order ${n} is packed and ready. Waiting for a rider. 📦`;
    case "RIDER_ASSIGNED": return `A rider has been assigned to order ${n}. 🛵`;
    case "ON_THE_WAY": return `Order ${n} is on the way! Estimated arrival in ${order.eta_min ?? 15}–${order.eta_max ?? 25} minutes. 🛵💨`;
    case "DELIVERED": return `Order ${n} has been delivered. Enjoy your meal! 😋 Reply anytime to order again.`;
    case "COLLECTED": return `Order ${n} has been collected. Enjoy your meal! 😋`;
    case "CANCELLED": return `Order ${n} has been cancelled. If this is unexpected, reply here and we will help.`;
  }
}
