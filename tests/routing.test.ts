import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, R } from "./helpers.js";
import { routeDelivery, pickupBranch, setBranchOpen } from "../src/core/branches.js";
import { suggestUpsells, markUpsellAccepted } from "../src/core/upsell.js";
import { addItem, createCart } from "../src/core/cart.js";
import { priceCart } from "../src/core/pricing.js";
import { getDb } from "../src/db/index.js";

test("typed address routes to nearest serviceable branch with zone fee", () => {
  freshDb();
  const r = routeDelivery(R, { text: "House 12, Street 4, DHA Phase 6 Lahore" });
  assert.equal(r.ok, true);
  assert.equal(r.branch!.id, "BR_DHA");
  assert.ok(r.zone!.fee >= 120);
  assert.equal(r.address!.area, "DHA Phase 6");
  const g = routeDelivery(R, { text: "mm alam road" });
  assert.equal(g.branch!.id, "BR_GULBERG");
});

test("shared location works, out-of-zone is rejected with pickup suggestion, closed branch explained", () => {
  freshDb();
  const loc = routeDelivery(R, { lat: 31.47, lng: 74.28 });
  assert.equal(loc.ok, true);
  assert.equal(loc.branch!.id, "BR_JOHAR");
  const far = routeDelivery(R, { text: "Bahria Town" });
  assert.equal(far.ok, false);
  assert.match(far.reason!, /outside our delivery zones/);
  setBranchOpen("BR_DHA", false);
  const closed = routeDelivery(R, { text: "DHA Phase 6" });
  assert.equal(closed.ok, false);
  assert.match(closed.reason!, /closed/);
  const unknown = routeDelivery(R, { text: "somewhere in Karachi" });
  assert.equal(unknown.ok, false);
});

test("pickup branch resolves by name", () => {
  freshDb();
  assert.equal(pickupBranch(R, "johar").branch!.id, "BR_JOHAR");
  assert.equal(pickupBranch(R, "the dha one").branch!.id, "BR_DHA");
  assert.equal(pickupBranch(R).branch, undefined);
});

test("upsell rules fire once per conversation and record acceptance", () => {
  freshDb();
  const cart = createCart(R, "CNV_TEST");
  addItem(cart.id, { product: "Zinger Burger" });
  const priced = priceCart(cart.id, { branchId: "BR_DHA", fulfilment: null, deliveryFee: 0, customerId: null });
  const s = suggestUpsells(R, "CNV_TEST", priced, "BR_DHA");
  assert.equal(s[0].product_id, "P_ZINGER_MEAL");
  const again = suggestUpsells(R, "CNV_TEST", priced, "BR_DHA");
  assert.ok(!again.some((x) => x.rule_id === "UP_MEAL"), "not offered twice");
  markUpsellAccepted("CNV_TEST", "P_ZINGER_MEAL");
  const row = getDb().prepare("SELECT accepted_at FROM upsell_events WHERE conversation_id = ? AND product_id = ?").get("CNV_TEST", "P_ZINGER_MEAL") as any;
  assert.ok(row.accepted_at);
  // Gulberg has no Zinger Meal -> rule should not suggest an unavailable product
  const cart2 = createCart(R, "CNV_2");
  addItem(cart2.id, { product: "Zinger Burger" });
  const s2 = suggestUpsells(R, "CNV_2", priceCart(cart2.id, { branchId: "BR_GULBERG", fulfilment: null, deliveryFee: 0, customerId: null }), "BR_GULBERG");
  assert.ok(!s2.some((x) => x.product_id === "P_ZINGER_MEAL"));
});
