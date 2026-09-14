import { getDb, json } from "../db/index.js";
import type { PricedLine, Promotion } from "./types.js";

function rowToPromo(r: any): Promotion {
  return {
    ...r,
    product_scope: json<string[]>(r.product_scope, []),
    category_scope: json<string[]>(r.category_scope, []),
    branch_scope: json<string[]>(r.branch_scope, []),
  };
}

export function listActivePromotions(restaurantId: string, now = new Date()): Promotion[] {
  const rows = getDb().prepare("SELECT * FROM promotions WHERE restaurant_id = ? AND is_active = 1").all(restaurantId) as any[];
  const iso = now.toISOString();
  return rows.map(rowToPromo).filter((p) => (!p.starts_at || p.starts_at <= iso) && (!p.ends_at || p.ends_at >= iso));
}

export function findPromotionByCode(restaurantId: string, code: string): Promotion | undefined {
  const row = getDb().prepare("SELECT * FROM promotions WHERE restaurant_id = ? AND UPPER(code) = UPPER(?)").get(restaurantId, code.trim());
  return row ? rowToPromo(row) : undefined;
}

export interface PromoContext {
  restaurantId: string;
  lines: PricedLine[];
  subtotal: number;
  deliveryFee: number;
  branchId: string | null;
  fulfilment: "delivery" | "pickup" | null;
  customerId: string | null;
  now?: Date;
}

export interface PromoResult {
  ok: boolean;
  discount: number;
  free_delivery: boolean;
  label: string | null;
  error: string | null;
  promotion?: Promotion;
}

const NONE: PromoResult = { ok: false, discount: 0, free_delivery: false, label: null, error: null };

function customerUsageCount(promotionId: string, customerId: string): number {
  const r = getDb().prepare("SELECT COUNT(*) AS n FROM promotion_usages WHERE promotion_id = ? AND customer_id = ?").get(promotionId, customerId) as { n: number };
  return r.n;
}

/** Deterministic eligibility + discount computation. The LLM never decides this. */
export function evaluatePromotion(code: string, ctx: PromoContext): PromoResult {
  const promo = findPromotionByCode(ctx.restaurantId, code);
  if (!promo) return { ...NONE, error: `Code ${code.toUpperCase()} is not valid.` };
  const now = (ctx.now ?? new Date()).toISOString();
  if (!promo.is_active) return { ...NONE, error: `Code ${promo.code} is no longer active.` };
  if (promo.starts_at && promo.starts_at > now) return { ...NONE, error: `Code ${promo.code} is not active yet.` };
  if (promo.ends_at && promo.ends_at < now) return { ...NONE, error: `Code ${promo.code} has expired.` };
  if (promo.branch_scope.length && ctx.branchId && !promo.branch_scope.includes(ctx.branchId)) {
    return { ...NONE, error: `Code ${promo.code} is not accepted at this branch.` };
  }
  if (promo.fulfilment_scope && ctx.fulfilment && promo.fulfilment_scope !== ctx.fulfilment) {
    return { ...NONE, error: `Code ${promo.code} is only valid for ${promo.fulfilment_scope} orders.` };
  }
  if (promo.per_customer_limit != null && ctx.customerId && customerUsageCount(promo.id, ctx.customerId) >= promo.per_customer_limit) {
    return { ...NONE, error: `Code ${promo.code} has already been used the maximum number of times on this account.` };
  }

  // Qualifying lines: scope by product or category if set.
  let qualifying = ctx.lines;
  if (promo.product_scope.length || promo.category_scope.length) {
    const cats = new Map<string, string>();
    if (promo.category_scope.length) {
      for (const r of getDb().prepare("SELECT id, category_id FROM products WHERE restaurant_id = ?").all(ctx.restaurantId) as any[]) cats.set(r.id, r.category_id);
    }
    qualifying = ctx.lines.filter((l) => promo.product_scope.includes(l.product_id) || promo.category_scope.includes(cats.get(l.product_id) ?? ""));
    if (qualifying.length === 0) return { ...NONE, error: `Code ${promo.code} only applies to specific items that are not in the cart.` };
  }
  const qualifyingSubtotal = qualifying.reduce((s, l) => s + l.line_total, 0);
  if (ctx.subtotal < promo.min_subtotal) {
    return { ...NONE, error: `Code ${promo.code} needs a minimum order of ${promo.min_subtotal}. Current subtotal is ${ctx.subtotal}.` };
  }

  let discount = 0;
  let free_delivery = false;
  if (promo.type === "percent") discount = Math.round((qualifyingSubtotal * promo.value) / 100);
  else if (promo.type === "fixed") discount = Math.min(promo.value, qualifyingSubtotal);
  else if (promo.type === "free_delivery") {
    if (ctx.fulfilment === "pickup") return { ...NONE, error: `Code ${promo.code} is a delivery offer and does not apply to pickup.` };
    free_delivery = true;
  }
  if (promo.max_discount != null) discount = Math.min(discount, promo.max_discount);
  return { ok: true, discount, free_delivery, label: promo.name, error: null, promotion: promo };
}

export function recordPromotionUsage(promotionId: string, customerId: string, orderId: string): void {
  getDb()
    .prepare("INSERT INTO promotion_usages (promotion_id, customer_id, order_id, created_at) VALUES (?,?,?,?)")
    .run(promotionId, customerId, orderId, new Date().toISOString());
}
