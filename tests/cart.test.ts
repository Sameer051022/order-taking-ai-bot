import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, R } from "./helpers.js";
import { addItem, updateItem, removeItem, createCart, getLines, pricedLines, setCartPromo } from "../src/core/cart.js";
import { priceCart } from "../src/core/pricing.js";
import { DomainError } from "../src/core/types.js";

const ctx = { branchId: "BR_DHA", fulfilment: "delivery" as const, deliveryFee: 120, customerId: null };

test("2 zinger meals -> 3 -> 2 + burger -> second meal sprite -> no mayo on burger -> cancel burger", () => {
  freshDb();
  const cart = createCart(R);
  // "2 Zinger meals"
  const l1 = addItem(cart.id, { product: "zinger meal", quantity: 2 });
  // "Actually make it 3"
  updateItem(cart.id, { item: l1.id, quantity: 3 });
  assert.equal(getLines(cart.id)[0].quantity, 3);
  // "No only 2 meals, add one burger separately"
  updateItem(cart.id, { item: l1.id, quantity: 2 });
  const burger = addItem(cart.id, { product: "Zinger Burger" });
  // "Second meal Sprite" -> split one unit off the meal line
  const split = updateItem(cart.id, { item: l1.id, units: 1, add_modifiers: ["Sprite"] });
  assert.notEqual(split.id, l1.id);
  // "Remove mayo from the separate burger"
  updateItem(cart.id, { item: burger.id, add_modifiers: ["no mayo"] });
  // "Cancel the separate burger"
  removeItem(cart.id, burger.id);

  const lines = pricedLines(cart.id, "BR_DHA");
  assert.equal(lines.length, 2);
  assert.deepEqual(lines.map((l) => [l.product_name, l.quantity]), [["Zinger Meal", 1], ["Zinger Meal", 1]]);
  const withSprite = lines.find((l) => l.summary.includes("Sprite"))!;
  const without = lines.find((l) => !l.summary.includes("Sprite"))!;
  assert.ok(withSprite, "one meal has Sprite");
  assert.equal(withSprite.summary, "Regular / Sprite");
  assert.equal(without.issues[0].type, "missing_selection");
  assert.equal(without.issues[0].group_name, "Drink");
});

test("3 chicken meals: two spicy one normal, all large, two coke one sprite, no mayo on one spicy", () => {
  freshDb();
  const cart = createCart(R);
  const spicy = addItem(cart.id, { product: "P_SPICY_MEAL", quantity: 2, modifiers: ["Large", "Coke"] });
  addItem(cart.id, { product: "Fillet Meal", quantity: 1, modifiers: ["Large", "Sprite"] });
  updateItem(cart.id, { item: spicy.id, units: 1, add_modifiers: ["No Mayo"] });
  const lines = pricedLines(cart.id, "BR_DHA");
  assert.equal(lines.length, 3);
  const summaries = lines.map((l) => `${l.product_name}: ${l.summary}`).sort();
  assert.deepEqual(summaries, [
    "Fillet Meal: Large / Sprite",
    "Spicy Chicken Meal: Large / Coke",
    "Spicy Chicken Meal: Large / Coke / No Mayo",
  ]);
  const priced = priceCart(cart.id, ctx);
  assert.equal(priced.is_valid, true);
  assert.equal(priced.totals.subtotal, 920 + 200 + 920 + 200 + 900 + 200);
});

test("identical configurations merge, and splitting then reverting re-merges", () => {
  freshDb();
  const cart = createCart(R);
  const a = addItem(cart.id, { product: "Zinger Meal", quantity: 2, modifiers: ["Coke"] });
  addItem(cart.id, { product: "Zinger Meal", quantity: 1, modifiers: ["Coke"] });
  assert.equal(getLines(cart.id).length, 1);
  assert.equal(getLines(cart.id)[0].quantity, 3);
  const s = updateItem(cart.id, { item: a.id, units: 1, add_modifiers: ["Sprite"] });
  assert.equal(getLines(cart.id).length, 2);
  updateItem(cart.id, { item: s.id, add_modifiers: ["Coke"] });
  assert.equal(getLines(cart.id).length, 1, "reverting the split line merges it back");
  assert.equal(getLines(cart.id)[0].quantity, 3);
});

test("make one large: size replaces within single-select group; extra cheese appends in multi-select", () => {
  freshDb();
  const cart = createCart(R);
  const l = addItem(cart.id, { product: "Mighty Meal", quantity: 2, modifiers: ["Fanta"] });
  updateItem(cart.id, { item: l.id, units: 1, add_modifiers: ["large"] });
  updateItem(cart.id, { item: 2, add_modifiers: ["extra cheese", "no lettuce"] }); // by line number
  const lines = pricedLines(cart.id, null).map((x) => x.summary).sort();
  assert.deepEqual(lines, ["Large / Fanta / No Lettuce / Extra Cheese", "Regular / Fanta"]);
  const priced = priceCart(cart.id, { ...ctx, fulfilment: "pickup" });
  assert.equal(priced.totals.subtotal, 1150 + (1150 + 200 + 100));
});

test("family bucket deal reports missing selections until fully configured", () => {
  freshDb();
  const cart = createCart(R);
  const l = addItem(cart.id, { product: "family deal" });
  let [line] = pricedLines(cart.id, null);
  assert.deepEqual(line.issues.map((i) => i.group_name), ["Sides (choose 2)", "1.5L Drink"]);
  updateItem(cart.id, { item: l.id, add_modifiers: ["2x fries"] });
  [line] = pricedLines(cart.id, null);
  assert.deepEqual(line.issues.map((i) => i.group_name), ["1.5L Drink"]);
  updateItem(cart.id, { item: l.id, selections: { drink: "coke" }, add_modifiers: ["garlic dip", "bbq dip"] });
  [line] = pricedLines(cart.id, null);
  assert.equal(line.issues.length, 0);
  assert.equal(line.summary, "2× Regular Fries / Coke 1.5L / Garlic Dip / BBQ Dip");
  assert.equal(line.unit_price, 2999 + 100);
  updateItem(cart.id, { item: l.id, selections: { "Sides (choose 2)": ["fries", "coleslaw", "corn"] } });
  [line] = pricedLines(cart.id, null);
  assert.equal(line.issues[0].type, "too_many");
});

test("ambiguous and unknown products/modifiers raise helpful errors", () => {
  freshDb();
  const cart = createCart(R);
  assert.throws(() => addItem(cart.id, { product: "meal" }), (e: any) => e instanceof DomainError && e.code === "AMBIGUOUS_PRODUCT");
  assert.throws(() => addItem(cart.id, { product: "sushi" }), (e: any) => e instanceof DomainError && e.code === "UNKNOWN_PRODUCT");
  assert.throws(() => addItem(cart.id, { product: "Zinger Meal", modifiers: ["pepperoni"] }), (e: any) => e instanceof DomainError && e.code === "UNKNOWN_MODIFIER");
});

test("branch availability flags sold-out items and pricing applies tax + delivery", () => {
  freshDb();
  const cart = createCart(R);
  addItem(cart.id, { product: "Zinger Meal", modifiers: ["Coke"] });
  const dha = priceCart(cart.id, ctx);
  assert.equal(dha.is_valid, true);
  assert.equal(dha.totals.tax, Math.round(950 * 0.05));
  assert.equal(dha.totals.total, 950 + Math.round(950 * 0.05) + 120);
  const gulberg = priceCart(cart.id, { ...ctx, branchId: "BR_GULBERG" });
  assert.equal(gulberg.is_valid, false);
  assert.match(gulberg.issues[0].message, /sold out/);
});

test("promo codes: SAVE20 min order, max discount, FREEDEL, expired, deal-scoped", () => {
  freshDb();
  const cart = createCart(R);
  addItem(cart.id, { product: "Zinger Burger" }); // 550
  setCartPromo(cart.id, "SAVE20");
  let p = priceCart(cart.id, ctx);
  assert.match(p.promo_error!, /minimum order/);
  assert.equal(p.totals.discount, 0);
  addItem(cart.id, { product: "Family Bucket Deal", modifiers: ["fries", "coleslaw", "Coke 1.5L"] }); // 2999 -> 3549
  p = priceCart(cart.id, ctx);
  assert.equal(p.promo_error, null);
  assert.equal(p.totals.discount, 500, "capped at max_discount");
  setCartPromo(cart.id, "FREEDEL");
  p = priceCart(cart.id, ctx);
  assert.equal(p.totals.delivery_fee, 0);
  p = priceCart(cart.id, { ...ctx, fulfilment: "pickup" });
  assert.match(p.promo_error!, /delivery/);
  setCartPromo(cart.id, "EID15");
  p = priceCart(cart.id, ctx);
  assert.match(p.promo_error!, /expired/);
  setCartPromo(cart.id, "FAMILY10");
  p = priceCart(cart.id, ctx);
  assert.equal(p.totals.discount, Math.round(2999 * 0.1), "only the deal qualifies");
});
