import { getCart, pricedLines } from "./cart.js";
import { getRestaurant } from "./menu.js";
import { evaluatePromotion } from "./promotions.js";
import type { LineIssue, PricedCart } from "./types.js";

export interface PricingContext {
  branchId: string | null;
  fulfilment: "delivery" | "pickup" | null;
  deliveryFee: number; // 0 when pickup / unknown
  customerId: string | null;
}

/** Price the whole cart. Every number the customer sees comes from here. */
export function priceCart(cartId: string, ctx: PricingContext): PricedCart {
  const cart = getCart(cartId);
  const restaurant = getRestaurant(cart.restaurant_id)!;
  const lines = pricedLines(cartId, ctx.branchId);
  const subtotal = lines.reduce((s, l) => s + l.line_total, 0);

  let discount = 0;
  let discount_label: string | null = null;
  let promo_error: string | null = null;
  let delivery_fee = ctx.fulfilment === "delivery" && lines.length ? ctx.deliveryFee : 0;

  if (cart.promo_code && lines.length) {
    const res = evaluatePromotion(cart.promo_code, {
      restaurantId: cart.restaurant_id, lines, subtotal, deliveryFee: delivery_fee,
      branchId: ctx.branchId, fulfilment: ctx.fulfilment, customerId: ctx.customerId,
    });
    if (res.ok) {
      discount = res.discount;
      discount_label = res.label;
      if (res.free_delivery) { discount_label = res.label; delivery_fee = 0; }
    } else {
      promo_error = res.error;
    }
  }

  const taxable = Math.max(0, subtotal - discount);
  const tax = Math.round(taxable * restaurant.tax_rate);
  const total = taxable + tax + delivery_fee;
  const issues: LineIssue[] = lines.flatMap((l) => l.issues.map((i) => ({ ...i, message: `${l.product_name}: ${i.message}` })));

  return {
    cart_id: cartId,
    lines,
    totals: { subtotal, discount, discount_label, tax, tax_rate: restaurant.tax_rate, delivery_fee, total, currency: restaurant.currency },
    promo_code: cart.promo_code,
    promo_error,
    is_valid: lines.length > 0 && issues.length === 0,
    issues,
    item_count: lines.reduce((s, l) => s + l.quantity, 0),
  };
}

export function money(amount: number, currency = "Rs"): string {
  return `${currency} ${amount.toLocaleString("en-PK")}`;
}
