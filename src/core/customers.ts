import { getDb, json, newId, nowIso } from "../db/index.js";
import type { Address, Customer } from "./types.js";

function rowToCustomer(r: any): Customer {
  return { ...r, last_address: json<Address | null>(r.last_address, null) };
}

export function getOrCreateCustomer(restaurantId: string, channel: string, externalId: string, name?: string | null): Customer {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM customers WHERE restaurant_id = ? AND channel = ? AND external_id = ?").get(restaurantId, channel, externalId);
  if (existing) {
    const c = rowToCustomer(existing);
    if (name && !c.name) { db.prepare("UPDATE customers SET name = ? WHERE id = ?").run(name, c.id); c.name = name; }
    return c;
  }
  const c: Customer = { id: newId("CUS"), restaurant_id: restaurantId, channel, external_id: externalId, name: name ?? null, last_address: null, created_at: nowIso() };
  db.prepare("INSERT INTO customers (id, restaurant_id, channel, external_id, name, last_address, created_at) VALUES (?,?,?,?,?,?,?)")
    .run(c.id, c.restaurant_id, c.channel, c.external_id, c.name, null, c.created_at);
  return c;
}

export function getCustomer(id: string): Customer | undefined {
  const r = getDb().prepare("SELECT * FROM customers WHERE id = ?").get(id);
  return r ? rowToCustomer(r) : undefined;
}

export function updateCustomer(id: string, patch: { name?: string | null; last_address?: Address | null }): void {
  const db = getDb();
  if (patch.name !== undefined) db.prepare("UPDATE customers SET name = ? WHERE id = ?").run(patch.name, id);
  if (patch.last_address !== undefined) db.prepare("UPDATE customers SET last_address = ? WHERE id = ?").run(patch.last_address ? JSON.stringify(patch.last_address) : null, id);
}
