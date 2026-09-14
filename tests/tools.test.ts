/**
 * Exercises the exact tool surface Claude sees, end to end, without calling Claude:
 * add items -> resolve options -> route delivery -> promo -> checkout -> place order -> notification -> reorder.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, R } from "./helpers.js";
import { executeTool, type ToolContext } from "../src/agent/tools.js";
import { getOrCreateConversation, listMessages } from "../src/agent/conversations.js";
import { getOrCreateCustomer } from "../src/core/customers.js";
import { getRestaurant } from "../src/core/menu.js";
import { getOrderByNumber, transitionOrder } from "../src/core/orders.js";
import { installNotifications } from "../src/channels/notifications.js";

function ctxFor(phone = "923001234567"): ToolContext {
  const restaurant = getRestaurant(R)!;
  const customer = getOrCreateCustomer(R, "whatsapp", phone, "Ahmed");
  const conversation = getOrCreateConversation(R, customer.id, "web");
  return { restaurant, conversation, customer };
}
const run = (ctx: ToolContext, name: string, input: unknown = {}) => executeTool(name, input, ctx) as Promise<any>;

test("full ordering flow through the tool layer", async () => {
  freshDb();
  installNotifications();
  const ctx = ctxFor();

  const s = await run(ctx, "search_menu", { query: "spicy chicken burger meal" });
  assert.equal(s.results[0].id, "P_SPICY_MEAL");
  assert.deepEqual(s.results[0].asks_for, ["Drink"]);

  let r = await run(ctx, "add_cart_item", { product: "P_SPICY_MEAL", quantity: 2 });
  assert.equal(r.cart.items[0].needs_attention[0].ask_for, "Drink");
  assert.ok(r.cart.items[0].needs_attention[0].options.includes("Coke"));
  const lineId = r.added.id;

  // "One Coke one Sprite"
  r = await run(ctx, "update_cart_item", { item: lineId, add_modifiers: ["Coke"] });
  r = await run(ctx, "update_cart_item", { item: lineId, units: 1, add_modifiers: ["Sprite"] });
  assert.equal(r.cart.items.length, 2);
  // "Make one large" -> the Sprite one
  r = await run(ctx, "update_cart_item", { item: r.updated.id, add_modifiers: ["Large"] });
  assert.equal(r.updated.options, "Large / Sprite");
  assert.equal(r.cart.ready_to_order, true);
  assert.equal(r.cart.subtotal, 920 + 920 + 200);

  // Checkout blocked until fulfilment is known
  let c = await run(ctx, "get_checkout_summary");
  assert.equal(c.ready, false);
  assert.ok(c.blockers.some((b: string) => /delivery or pickup/.test(b)));

  r = await run(ctx, "set_fulfilment", { type: "delivery", address_text: "House 12, Street 4, DHA Phase 6, Lahore" });
  assert.equal(r.branch, "DHA Phase 5");
  assert.ok(r.delivery_fee > 0);
  assert.equal(ctx.conversation.fulfilment, "delivery");

  r = await run(ctx, "apply_promo_code", { code: "save20" });
  assert.equal(r.applied, true);
  assert.equal(r.cart.discount, Math.round(2040 * 0.2));

  const up = await run(ctx, "get_upsell_suggestions");
  assert.ok(up.suggestions.length >= 1);

  c = await run(ctx, "get_checkout_summary");
  assert.equal(c.ready, true);
  assert.equal(c.address, "House 12, Street 4, DHA Phase 6, Lahore");

  const blocked = await run(ctx, "place_order", { payment_method: "cash", customer_confirmed: false });
  assert.match(blocked.error, /explicit yes/);

  const placed = await run(ctx, "place_order", { payment_method: "cash", customer_confirmed: true });
  assert.equal(placed.placed, true);
  const order = getOrderByNumber(R, placed.order_number)!;
  assert.equal(order.items.length, 2);
  assert.equal(order.totals.discount, Math.round(2040 * 0.2));
  assert.equal(order.status, "CONFIRMED");
  assert.equal(ctx.conversation.order_count, 1);

  // Fresh cart after ordering; SAVE20 is now used up for this customer
  const cart = await run(ctx, "get_cart");
  assert.equal(cart.items.length, 0);
  await run(ctx, "add_cart_item", { product: "Family Bucket Deal", modifiers: ["fries", "coleslaw", "coke 1.5l"] });
  const again = await run(ctx, "apply_promo_code", { code: "SAVE20" });
  assert.equal(again.applied, false);
  assert.match(again.reason, /already been used/);

  // Status transition produces a customer notification in the transcript
  transitionOrder(order.id, "PREPARING");
  const msgs = listMessages(ctx.conversation.id);
  assert.match(msgs.at(-1)!.display_text!, /being prepared/);

  // Reorder a previous order (seeded 3 days ago)
  await run(ctx, "clear_cart");
  const recent = await run(ctx, "get_recent_orders");
  const seeded = recent.orders.find((o: any) => o.items.some((i: string) => i.includes("Large Fries")));
  assert.ok(seeded, "seeded order visible");
  const re = await run(ctx, "reorder", { order_number: seeded.order_number });
  assert.equal(re.added, 2);
  assert.equal(re.cart.items.reduce((s: number, i: any) => s + i.quantity, 0), 3);
});

test("branch stock-outs surface when the customer picks that branch", async () => {
  freshDb();
  const ctx = ctxFor("923219876543");
  await run(ctx, "add_cart_item", { product: "Zinger Meal", modifiers: ["Coke"] });
  const r = await run(ctx, "set_fulfilment", { type: "delivery", address_text: "MM Alam Road, Gulberg" });
  assert.equal(r.branch, "Gulberg");
  assert.deepEqual(r.unavailable_items, ["Zinger Meal"]);
  const c = await run(ctx, "get_checkout_summary");
  assert.equal(c.ready, false);
  assert.match(c.blockers[0], /sold out/);
  const far = await run(ctx, "set_fulfilment", { type: "delivery", address_text: "Bahria Town" });
  assert.match(far.error, /outside our delivery zones/);
  const pickup = await run(ctx, "set_fulfilment", { type: "pickup" });
  assert.equal(pickup.needs_branch, true);
  const chosen = await run(ctx, "set_fulfilment", { type: "pickup", branch: "Johar" });
  assert.equal(chosen.branch.name, "Johar Town");
});

test("human handoff stops the AI from answering", async () => {
  freshDb();
  const ctx = ctxFor("923219876543");
  const h = await run(ctx, "request_human_agent", { reason: "customer asked" });
  assert.equal(h.handed_over, true);
  assert.equal(ctx.conversation.status, "human");
});
