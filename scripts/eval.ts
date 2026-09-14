/**
 * Live end-to-end evaluation: scripted WhatsApp conversations run through the real agent (needs Claude credentials).
 * Each scenario sends messages in order and asserts on backend state (cart / order), not on the wording of replies.
 *
 *   npm run eval            # all scenarios
 *   npm run eval -- deals   # scenarios whose name contains "deals"
 */
import "dotenv/config";
import { openMemoryDb } from "../src/db/index.js";
import { seedAll } from "../src/seed/index.js";
import { handleIncoming } from "../src/agent/agent.js";
import { getRestaurantBySlug } from "../src/core/menu.js";
import { listOrders } from "../src/core/orders.js";
import { priceCart } from "../src/core/pricing.js";
import type { PricedCart } from "../src/core/types.js";

openMemoryDb();
seedAll({ history: false });
const restaurant = getRestaurantBySlug("crunchbird")!;

interface Scenario { name: string; phone: string; steps: { say: string | { lat: number; lng: number }; expect?: (cart: PricedCart | null, replies: string[]) => void }[]; expectOrder?: (o: ReturnType<typeof listOrders>[number]) => void }

const summaries = (c: PricedCart | null) => (c?.lines ?? []).map((l) => `${l.quantity}×${l.product_name}[${l.summary}]`).sort();
const assert = (cond: unknown, msg: string) => { if (!cond) throw new Error(msg); };

const scenarios: Scenario[] = [
  {
    name: "meals with per-unit drinks and size, delivery, promo, confirm",
    phone: "923330000001",
    steps: [
      { say: "Hi" },
      { say: "2 spicy chicken burger meals", expect: (c) => assert(c?.item_count === 2 && c.lines[0].product_name === "Spicy Chicken Meal", `expected 2 spicy meals, got ${summaries(c)}`) },
      { say: "One Coke one Sprite", expect: (c) => assert(c?.lines.length === 2 && summaries(c).join() === "1×Spicy Chicken Meal[Regular / Coke],1×Spicy Chicken Meal[Regular / Sprite]", `drinks not split correctly: ${summaries(c)}`) },
      { say: "Make the Sprite one large", expect: (c) => assert(summaries(c).includes("1×Spicy Chicken Meal[Large / Sprite]") && summaries(c).includes("1×Spicy Chicken Meal[Regular / Coke]"), `size mapping wrong: ${summaries(c)}`) },
      { say: "Delivery to House 12, Street 4, DHA Phase 6" },
      { say: "Apply SAVE20", expect: (c) => assert(c?.promo_code === "SAVE20" && c.totals.discount === 408, `promo not applied: ${c?.promo_code} ${c?.totals.discount}`) },
      { say: "Yes confirm, cash on delivery" },
    ],
    expectOrder: (o) => { assert(o.items.length === 2, "order should have 2 lines"); assert(o.totals.discount === 408, "order discount"); assert(o.fulfilment === "delivery", "delivery"); },
  },
  {
    name: "corrections sequence from the brief",
    phone: "923330000002",
    steps: [
      { say: "2 Zinger meals, both Coke" },
      { say: "Actually make it 3", expect: (c) => assert(c?.item_count === 3, `expected 3 meals: ${summaries(c)}`) },
      { say: "No only 2 meals, add one zinger burger separately", expect: (c) => assert(c?.item_count === 3 && c.lines.some((l) => l.product_name === "Zinger Burger"), `expected 2 meals + burger: ${summaries(c)}`) },
      { say: "Second meal Sprite", expect: (c) => assert(summaries(c).includes("1×Zinger Meal[Regular / Sprite]"), `second meal should be Sprite: ${summaries(c)}`) },
      { say: "Remove mayo from the separate burger", expect: (c) => assert(c?.lines.find((l) => l.product_name === "Zinger Burger")?.summary === "No Mayo", `burger should have No Mayo: ${summaries(c)}`) },
      { say: "Cancel the separate burger", expect: (c) => assert(summaries(c).join() === "1×Zinger Meal[Regular / Coke],1×Zinger Meal[Regular / Sprite]", `final cart wrong: ${summaries(c)}`) },
    ],
  },
  {
    name: "deals: family bucket configured step by step",
    phone: "923330000003",
    steps: [
      { say: "Family deal please", expect: (c) => assert(c?.lines[0]?.product_name === "Family Bucket Deal", `expected family bucket: ${summaries(c)}`) },
      { say: "Fries and coleslaw", expect: (c) => assert(c?.lines[0].summary.includes("Regular Fries") && c.lines[0].summary.includes("Coleslaw"), `sides missing: ${summaries(c)}`) },
      { say: "Sprite", expect: (c) => assert(c?.is_valid === true, `deal should be complete: ${summaries(c)} issues=${c?.issues.map((i) => i.message)}`) },
    ],
  },
  {
    name: "sold out at branch and reorder",
    phone: "923001234567",
    steps: [
      { say: "Same order as last time" },
      { say: "Yes, deliver to my usual address", expect: (c) => assert((c?.item_count ?? 0) >= 3, `reorder should populate cart: ${summaries(c)}`) },
    ],
  },
  {
    name: "roman urdu",
    phone: "923330000005",
    steps: [
      { say: "2 zinger meal dedo, aik large, dono coke", expect: (c) => assert(c?.item_count === 2 && summaries(c).includes("1×Zinger Meal[Large / Coke]") && summaries(c).includes("1×Zinger Meal[Regular / Coke]"), `roman urdu parse: ${summaries(c)}`) },
    ],
  },
];

const filter = process.argv[2]?.toLowerCase();
let failed = 0;
for (const sc of scenarios) {
  if (filter && !sc.name.toLowerCase().includes(filter)) continue;
  console.log(`\n=== ${sc.name}`);
  try {
    let last: Awaited<ReturnType<typeof handleIncoming>> | undefined;
    for (const step of sc.steps) {
      const res = await handleIncoming({ restaurant, channel: "web", customerKey: sc.phone, text: typeof step.say === "string" ? step.say : undefined, location: typeof step.say === "string" ? undefined : step.say });
      last = res;
      const cart = res.conversation.cart_id ? priceCart(res.conversation.cart_id, { branchId: res.conversation.branch_id, fulfilment: res.conversation.fulfilment, deliveryFee: res.conversation.address?.delivery_fee ?? 0, customerId: null }) : null;
      console.log(`> ${typeof step.say === "string" ? step.say : JSON.stringify(step.say)}`);
      console.log(`< ${res.replies.join(" | ").replace(/\n/g, " ")}   [${res.tools.map((t) => t.tool).join(", ")}] ${(res.latency_ms / 1000).toFixed(1)}s`);
      step.expect?.(cart, res.replies);
    }
    if (sc.expectOrder) {
      const orders = listOrders(restaurant.id, { limit: 1 });
      assert(orders[0] && orders[0].conversation_id === last?.conversation.id, "no order was placed");
      sc.expectOrder(orders[0]);
    }
    console.log("PASS");
  } catch (e) {
    failed++;
    console.log(`FAIL: ${(e as Error).message}`);
  }
}
console.log(`\n${failed ? `${failed} scenario(s) failed` : "All scenarios passed"}`);
process.exit(failed ? 1 : 0);
