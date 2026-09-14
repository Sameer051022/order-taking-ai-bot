import type Anthropic from "@anthropic-ai/sdk";
import { getDb, json, newId, nowIso } from "../db/index.js";
import { createCart, getCart } from "../core/cart.js";
import { bus } from "../core/events.js";
import type { Address, Conversation } from "../core/types.js";

function rowToConversation(r: any): Conversation {
  return { ...r, address: json<Address | null>(r.address, null) };
}

export function getConversation(id: string): Conversation | undefined {
  const r = getDb().prepare("SELECT * FROM conversations WHERE id = ?").get(id);
  return r ? rowToConversation(r) : undefined;
}

/** Find the customer's open conversation or start a new one (with a fresh cart). */
export function getOrCreateConversation(restaurantId: string, customerId: string, channel: "whatsapp" | "web"): Conversation {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM conversations WHERE restaurant_id = ? AND customer_id = ? AND status <> 'closed' ORDER BY last_message_at DESC LIMIT 1")
    .get(restaurantId, customerId);
  if (row) {
    const c = rowToConversation(row);
    ensureCart(c);
    if (c.channel !== channel) { db.prepare("UPDATE conversations SET channel = ? WHERE id = ?").run(channel, c.id); c.channel = channel; }
    return c;
  }
  const ts = nowIso();
  const id = newId("CNV");
  const cart = createCart(restaurantId, id, customerId);
  db.prepare("INSERT INTO conversations (id, restaurant_id, customer_id, channel, status, cart_id, branch_id, fulfilment, address, order_count, created_at, last_message_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(id, restaurantId, customerId, channel, "active", cart.id, null, null, null, 0, ts, ts);
  return getConversation(id)!;
}

function ensureCart(c: Conversation): void {
  let ok = false;
  if (c.cart_id) {
    try { ok = getCart(c.cart_id).status === "open"; } catch { ok = false; }
  }
  if (!ok) {
    const cart = createCart(c.restaurant_id, c.id, c.customer_id);
    getDb().prepare("UPDATE conversations SET cart_id = ? WHERE id = ?").run(cart.id, c.id);
    c.cart_id = cart.id;
  }
}

export function updateConversation(id: string, patch: Partial<Pick<Conversation, "status" | "cart_id" | "branch_id" | "fulfilment" | "address" | "order_count">>): Conversation {
  const db = getDb();
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    sets.push(`${k} = ?`);
    params.push(k === "address" ? (v ? JSON.stringify(v) : null) : v);
  }
  sets.push("last_message_at = ?");
  params.push(nowIso(), id);
  db.prepare(`UPDATE conversations SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  const c = getConversation(id)!;
  bus.publish({ type: "conversation.updated", restaurant_id: c.restaurant_id, conversation_id: id });
  return c;
}

/** After an order is placed: mark the cart ordered and give the conversation a fresh one. */
export function rotateCart(c: Conversation): Conversation {
  const cart = createCart(c.restaurant_id, c.id, c.customer_id);
  return updateConversation(c.id, { cart_id: cart.id, order_count: c.order_count + 1 });
}

export interface StoredMessage {
  id: number;
  role: "user" | "assistant" | "system";
  content: Anthropic.MessageParam["content"];
  display_text: string | null;
  latency_ms: number | null;
  created_at: string;
}

export function appendMessage(conversationId: string, role: StoredMessage["role"], content: Anthropic.MessageParam["content"], displayText: string | null, latencyMs: number | null = null): void {
  const ts = nowIso();
  getDb().prepare("INSERT INTO messages (conversation_id, role, content, display_text, latency_ms, created_at) VALUES (?,?,?,?,?,?)")
    .run(conversationId, role, JSON.stringify(content), displayText, latencyMs, ts);
  getDb().prepare("UPDATE conversations SET last_message_at = ? WHERE id = ?").run(ts, conversationId);
}

export function listMessages(conversationId: string, limit = 200): StoredMessage[] {
  const rows = getDb().prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?").all(conversationId, limit) as any[];
  return rows.reverse().map((r) => ({ ...r, content: json(r.content, []) }));
}

/**
 * Build a replayable Claude message history. Consecutive same-role messages are merged
 * (order notifications are stored as assistant text), history starts at a plain user turn,
 * and tool_use/tool_result pairs are never split.
 */
export function buildHistory(conversationId: string, maxMessages = 40): Anthropic.MessageParam[] {
  const stored = listMessages(conversationId, 400).filter((m) => m.role !== "system");
  const merged: Anthropic.MessageParam[] = [];
  for (const m of stored) {
    const blocks = typeof m.content === "string" ? [{ type: "text" as const, text: m.content }] : (m.content as Anthropic.ContentBlockParam[]);
    if (!blocks.length) continue;
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) {
      (last.content as Anthropic.ContentBlockParam[]).push(...blocks);
    } else {
      merged.push({ role: m.role as "user" | "assistant", content: [...blocks] });
    }
  }
  // Trim from the front to a user turn made of plain text (no tool_result blocks).
  let start = Math.max(0, merged.length - maxMessages);
  while (start < merged.length) {
    const m = merged[start];
    const c = m.content as Anthropic.ContentBlockParam[];
    if (m.role === "user" && c.every((b) => b.type === "text")) break;
    start++;
  }
  return merged.slice(start);
}

export function listConversations(restaurantId: string, limit = 50): (Conversation & { customer_name: string | null; customer_phone: string; last_text: string | null; message_count: number })[] {
  const rows = getDb().prepare(`
    SELECT c.*, cu.name AS customer_name, cu.external_id AS customer_phone,
      (SELECT display_text FROM messages m WHERE m.conversation_id = c.id AND m.display_text IS NOT NULL ORDER BY m.id DESC LIMIT 1) AS last_text,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.display_text IS NOT NULL) AS message_count
    FROM conversations c JOIN customers cu ON cu.id = c.customer_id
    WHERE c.restaurant_id = ? ORDER BY c.last_message_at DESC LIMIT ?`).all(restaurantId, limit) as any[];
  return rows.map((r) => ({ ...rowToConversation(r), customer_name: r.customer_name, customer_phone: r.customer_phone, last_text: r.last_text, message_count: r.message_count }));
}
