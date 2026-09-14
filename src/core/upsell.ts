import { getDb, json, nowIso } from "../db/index.js";
import { getProduct, isAvailableAtBranch } from "./menu.js";
import type { PricedCart } from "./types.js";

interface Trigger {
  cart_has_category?: string;
  cart_lacks_category?: string;
  cart_has_product?: string;
  cart_lacks_product?: string;
  min_subtotal?: number;
  max_subtotal?: number;
}

export interface UpsellRule {
  id: string;
  restaurant_id: string;
  name: string;
  trigger: Trigger;
  suggest_product_id: string;
  pitch: string;
  priority: number;
  is_active: number;
}

export interface UpsellSuggestion {
  rule_id: string;
  product_id: string;
  product_name: string;
  price: number;
  pitch: string;
}

export function listRules(restaurantId: string): UpsellRule[] {
  return (getDb().prepare("SELECT * FROM upsell_rules WHERE restaurant_id = ? AND is_active = 1 ORDER BY priority DESC").all(restaurantId) as any[]).map((r) => ({ ...r, trigger: json<Trigger>(r.trigger, {}) }));
}

/**
 * Evaluate rules against a priced cart. Suggestions already offered in this conversation are excluded.
 * Products already in the cart are never suggested.
 */
export function suggestUpsells(restaurantId: string, conversationId: string, cart: PricedCart, branchId: string | null, max = 2): UpsellSuggestion[] {
  const db = getDb();
  const cats = new Map<string, string>();
  for (const r of db.prepare("SELECT p.id, c.name FROM products p JOIN categories c ON c.id = p.category_id WHERE p.restaurant_id = ?").all(restaurantId) as any[]) cats.set(r.id, r.name.toLowerCase());
  const inCart = new Set(cart.lines.map((l) => l.product_id));
  const cartCats = new Set(cart.lines.map((l) => cats.get(l.product_id) ?? ""));
  const offered = new Set((db.prepare("SELECT rule_id FROM upsell_events WHERE conversation_id = ?").all(conversationId) as any[]).map((r) => r.rule_id));

  const out: UpsellSuggestion[] = [];
  for (const rule of listRules(restaurantId)) {
    if (offered.has(rule.id) || inCart.has(rule.suggest_product_id)) continue;
    const t = rule.trigger;
    if (t.cart_has_category && !cartCats.has(t.cart_has_category.toLowerCase())) continue;
    if (t.cart_lacks_category && cartCats.has(t.cart_lacks_category.toLowerCase())) continue;
    if (t.cart_has_product && !inCart.has(t.cart_has_product)) continue;
    if (t.cart_lacks_product && inCart.has(t.cart_lacks_product)) continue;
    if (t.min_subtotal != null && cart.totals.subtotal < t.min_subtotal) continue;
    if (t.max_subtotal != null && cart.totals.subtotal > t.max_subtotal) continue;
    const product = getProduct(rule.suggest_product_id);
    if (!product || !product.is_active || !isAvailableAtBranch(product.id, branchId)) continue;
    out.push({ rule_id: rule.id, product_id: product.id, product_name: product.name, price: product.base_price, pitch: rule.pitch });
    if (out.length >= max) break;
  }
  for (const s of out) {
    db.prepare("INSERT INTO upsell_events (restaurant_id, conversation_id, rule_id, product_id, offered_at) VALUES (?,?,?,?,?)").run(restaurantId, conversationId, s.rule_id, s.product_id, nowIso());
  }
  return out;
}

/** Called when a product is added: if it was offered as an upsell in this conversation, mark accepted. */
export function markUpsellAccepted(conversationId: string, productId: string): void {
  getDb().prepare("UPDATE upsell_events SET accepted_at = ? WHERE conversation_id = ? AND product_id = ? AND accepted_at IS NULL").run(nowIso(), conversationId, productId);
}
