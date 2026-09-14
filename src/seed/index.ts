import { getDb, newId, nowIso } from "../db/index.js";
import { priceLine, resolveSelections } from "../core/cart.js";
import { getOrCreateCustomer, updateCustomer } from "../core/customers.js";
import { getProduct, listProducts } from "../core/menu.js";
import { createOrder } from "../core/orders.js";
import { haversineKm, listZones } from "../core/branches.js";
import type { CartLine, OrderStatus, PricedLine, Totals } from "../core/types.js";
import type { SeedProduct, TenantSeed } from "./types.js";
import { CRUNCHBIRD } from "./crunchbird.js";
import { SLICEHOUSE } from "./slicehouse.js";
import { GOLDENBUN } from "./goldenbun.js";
import { KFC } from "./kfc.js";

export const TENANTS: TenantSeed[] = [KFC, CRUNCHBIRD, GOLDENBUN, SLICEHOUSE];

// Deterministic PRNG so the demo numbers are stable between resets.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

export function seedTenant(seed: TenantSeed, opts: { history?: boolean } = {}): boolean {
  const db = getDb();
  if (db.prepare("SELECT 1 FROM restaurants WHERE id = ?").get(seed.restaurant.id)) return false;
  const r = seed.restaurant;
  const tx = db.transaction(() => {
    db.prepare("INSERT INTO restaurants (id, slug, name, tagline, currency, tax_rate, persona, greeting, whatsapp_phone_number_id, emoji, theme, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(r.id, r.slug, r.name, r.tagline, r.currency, r.tax_rate, r.persona, r.greeting, r.whatsapp_phone_number_id ?? null, r.emoji, r.theme ? JSON.stringify(r.theme) : null, nowIso());

    const catIds = new Map<string, string>();
    seed.categories.forEach((name, i) => {
      const id = `${r.id}_CAT_${i}`;
      catIds.set(name, id);
      db.prepare("INSERT INTO categories (id, restaurant_id, name, sort_order) VALUES (?,?,?,?)").run(id, r.id, name, i);
    });

    const insProduct = db.prepare("INSERT INTO products (id, restaurant_id, category_id, name, description, base_price, type, keywords, tags, is_active, sort_order) VALUES (?,?,?,?,?,?,?,?,?,1,?)");
    const insGroup = db.prepare("INSERT INTO modifier_groups (id, product_id, name, min_select, max_select, allow_repeat, sort_order) VALUES (?,?,?,?,?,?,?)");
    const insMod = db.prepare("INSERT INTO modifiers (id, group_id, name, price_delta, is_default, keywords, sort_order) VALUES (?,?,?,?,?,?,?)");
    seed.products.forEach((p: SeedProduct, i) => {
      insProduct.run(p.id, r.id, catIds.get(p.category)!, p.name, p.description ?? null, p.price, p.type ?? "item", JSON.stringify(p.keywords ?? []), JSON.stringify(p.tags ?? []), i);
      (p.groups ?? []).forEach((g, gi) => {
        const gid = `${p.id}_G${gi}`;
        insGroup.run(gid, p.id, g.name, g.min, g.max, g.allow_repeat ? 1 : 0, gi);
        g.modifiers.forEach((m, mi) => insMod.run(`${gid}_M${mi}`, gid, m.name, m.delta ?? 0, m.default ? 1 : 0, JSON.stringify(m.keywords ?? []), mi));
      });
    });

    for (const b of seed.branches) {
      db.prepare("INSERT INTO branches (id, restaurant_id, name, address, lat, lng, delivery_radius_km, is_open, opens_at, closes_at, phone, prep_minutes) VALUES (?,?,?,?,?,?,?,?,?,?,?,15)")
        .run(b.id, r.id, b.name, b.address, b.lat, b.lng, b.radius_km, b.is_open === false ? 0 : 1, b.opens ?? "11:00", b.closes ?? "02:00", b.phone ?? null);
      b.zones.forEach((z, zi) => db.prepare("INSERT INTO delivery_zones (id, branch_id, max_km, fee, eta_min, eta_max) VALUES (?,?,?,?,?,?)").run(`${b.id}_Z${zi}`, b.id, z.max_km, z.fee, z.eta_min, z.eta_max));
      for (const pid of b.unavailable ?? []) db.prepare("INSERT INTO branch_product_availability (branch_id, product_id, is_available) VALUES (?,?,0)").run(b.id, pid);
    }
    seed.areas.forEach((a, i) => db.prepare("INSERT INTO areas (id, restaurant_id, name, aliases, city, lat, lng) VALUES (?,?,?,?,?,?,?)").run(`${r.id}_AREA_${i}`, r.id, a.name, JSON.stringify(a.aliases ?? []), a.city, a.lat, a.lng));

    for (const p of seed.promotions) {
      db.prepare(`INSERT INTO promotions (id, restaurant_id, code, name, description, type, value, min_subtotal, max_discount, product_scope, category_scope, branch_scope, fulfilment_scope, per_customer_limit, starts_at, ends_at, is_active)
                  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(p.id, r.id, p.code, p.name, p.description, p.type, p.value ?? 0, p.min_subtotal ?? 0, p.max_discount ?? null, JSON.stringify(p.product_scope ?? []),
          JSON.stringify((p.category_scope ?? []).map((c) => catIds.get(c) ?? c)), "[]", p.fulfilment_scope ?? null, p.per_customer_limit ?? null, p.starts_at ?? null, p.ends_at ?? null, p.is_active === false ? 0 : 1);
    }
    for (const u of seed.upsell_rules) {
      db.prepare("INSERT INTO upsell_rules (id, restaurant_id, name, trigger, suggest_product_id, pitch, priority, is_active) VALUES (?,?,?,?,?,?,?,1)")
        .run(u.id, r.id, u.name, JSON.stringify(u.trigger), u.suggest, u.pitch, u.priority ?? 0);
    }

    for (const c of seed.demo_customers) {
      const customer = getOrCreateCustomer(r.id, "whatsapp", c.phone, c.name);
      if (c.address) updateCustomer(customer.id, { last_address: { text: c.address.text, area: c.address.area } });
      for (const po of c.past_orders ?? []) {
        const items = po.items.map((it) => buildLine(it.product, it.quantity ?? 1, it.modifiers ?? []));
        const created = new Date(Date.now() - po.days_ago * 86400_000);
        created.setHours(20, 15, 0, 0);
        const fee = po.fulfilment === "delivery" ? 120 : 0;
        createOrder({
          restaurant_id: r.id, branch_id: po.branch, customer_id: customer.id, conversation_id: null, channel: "whatsapp", source: "ai",
          fulfilment: po.fulfilment, address: c.address ? { text: c.address.text, area: c.address.area } : null, customer_name: c.name, customer_phone: c.phone,
          items, totals: totalsFor(items, r.tax_rate, fee, r.currency), promo_code: null, payment_method: "cash", eta_min: 30, eta_max: 40,
          created_at: created.toISOString(), status: po.fulfilment === "delivery" ? "DELIVERED" : "COLLECTED", silent: true,
        });
      }
    }
    if (opts.history !== false && seed.history) generateHistory(seed);
  });
  tx();
  return true;
}

function buildLine(productId: string, quantity: number, modifiers: string[]): PricedLine {
  const product = getProduct(productId);
  if (!product) throw new Error(`Seed references unknown product ${productId}`);
  const selections = resolveSelections(product, { add_modifiers: modifiers });
  const line: CartLine = { id: newId("LN"), cart_id: "seed", product_id: productId, quantity, selections, notes: null, line_no: 1 };
  return priceLine(line, null);
}

function totalsFor(items: PricedLine[], taxRate: number, deliveryFee: number, currency: string): Totals {
  const subtotal = items.reduce((s, l) => s + l.line_total, 0);
  const tax = Math.round(subtotal * taxRate);
  return { subtotal, discount: 0, discount_label: null, tax, tax_rate: taxRate, delivery_fee: deliveryFee, total: subtotal + tax + deliveryFee, currency };
}

/** Synthetic order history so the dashboard has something to show on day one. */
function generateHistory(seed: TenantSeed): void {
  const db = getDb();
  const r = seed.restaurant;
  const rand = rng(r.id.length * 7919);
  // Weighted product pool: meals and burgers dominate real fast-food mixes; drinks/sides ride along.
  const weightFor = (cat: string | undefined) => ({ Meals: 5, Burgers: 4, Deals: 3, Chicken: 3, "Chicken & Nuggets": 3, "Wraps & Rice": 2, Breakfast: 1, Pizzas: 6, Sides: 2, Drinks: 1, Desserts: 1 } as Record<string, number>)[cat ?? ""] ?? 2;
  const products = listProducts(r.id).flatMap((p) => Array.from({ length: weightFor(p.category_name) }, () => p));
  const branches = seed.branches;
  const areas = seed.areas;
  const channels: { channel: string; source: "ai" | "manual"; weight: number }[] = [
    { channel: "whatsapp", source: "ai", weight: seed.history!.whatsapp_share },
    { channel: "app", source: "manual", weight: 0.4 },
    { channel: "web", source: "manual", weight: 0.15 },
    { channel: "walk-in", source: "manual", weight: 1 - seed.history!.whatsapp_share - 0.55 },
  ];
  const pickWeighted = <T extends { weight: number }>(xs: T[]) => { let t = rand() * xs.reduce((s, x) => s + x.weight, 0); return xs.find((x) => (t -= x.weight) <= 0) ?? xs[xs.length - 1]; };
  const hourWeights = [1, 1, 0.5, 0.2, 0.1, 0.1, 0.1, 0.2, 0.4, 0.6, 0.8, 1.5, 3, 4, 3, 2, 2, 2.5, 3.5, 5, 6, 6, 4, 2].map((w, hour) => ({ hour, weight: w }));
  const names = ["Ali", "Fatima", "Usman", "Ayesha", "Bilal", "Hira", "Hamza", "Zainab", "Omar", "Maryam", "Danish", "Sana", "Taha", "Noor", "Saad", "Iqra"];

  const now = new Date();
  for (let d = seed.history!.days - 1; d >= 0; d--) {
    const count = Math.round(seed.history!.orders_per_day * (0.8 + rand() * 0.5) * (d === 0 ? (now.getHours() + 1) / 24 : 1));
    // Today also gets a handful of orders from the last 45 minutes so the live board is never empty.
    const liveExtra = d === 0 ? 7 : 0;
    for (let i = 0; i < count + liveExtra; i++) {
      const created = new Date(now);
      if (i >= count) {
        created.setTime(now.getTime() - Math.floor(rand() * 45) * 60000 - 30000);
      } else {
        const hour = pickWeighted(hourWeights).hour;
        created.setDate(now.getDate() - d);
        created.setHours(hour, Math.floor(rand() * 60), Math.floor(rand() * 60), 0);
      }
      if (created > now) continue;
      const ch = pickWeighted(channels);
      const branch = branches[Math.floor(rand() * branches.length)];
      const fulfilment: "delivery" | "pickup" = ch.channel === "walk-in" ? "pickup" : rand() < 0.7 ? "delivery" : "pickup";
      const nItems = 1 + Math.floor(rand() * 3);
      const items: PricedLine[] = [];
      for (let k = 0; k < nItems; k++) {
        const p = products[Math.floor(rand() * products.length)];
        const full = getProduct(p.id)!;
        const mods: string[] = [];
        for (const g of full.groups) {
          if (g.min_select > 0 && !g.modifiers.some((m) => m.is_default)) {
            for (let n = 0; n < g.min_select; n++) mods.push(g.modifiers[Math.floor(rand() * g.modifiers.length)].id);
          } else if (g.min_select > 0 && rand() < 0.3) mods.push(g.modifiers[Math.floor(rand() * g.modifiers.length)].id);
        }
        items.push(buildLine(p.id, 1 + (rand() < 0.3 ? 1 : 0), mods));
      }
      const area = areas.filter((a) => haversineKm(a.lat, a.lng, branch.lat, branch.lng) <= branch.radius_km)[Math.floor(rand() * 5)] ?? areas[0];
      const dist = haversineKm(area.lat, area.lng, branch.lat, branch.lng);
      const zone = listZones(branch.id).find((z) => dist <= z.max_km) ?? listZones(branch.id).at(-1)!;
      const fee = fulfilment === "delivery" ? zone.fee : 0;
      const totals = totalsFor(items, r.tax_rate, fee, r.currency);
      const name = names[Math.floor(rand() * names.length)];
      const phone = `9230${Math.floor(10000000 + rand() * 89999999)}`;

      let status: OrderStatus = fulfilment === "delivery" ? "DELIVERED" : "COLLECTED";
      const ageMin = (now.getTime() - created.getTime()) / 60000;
      if (ageMin < 8) status = "CONFIRMED";
      else if (ageMin < 20) status = "PREPARING";
      else if (ageMin < 30) status = "READY";
      else if (ageMin < 40 && fulfilment === "delivery") status = rand() < 0.5 ? "RIDER_ASSIGNED" : "ON_THE_WAY";
      else if (rand() < 0.03) status = "CANCELLED";

      let customerId: string | null = null;
      let conversationId: string | null = null;
      if (ch.channel === "whatsapp") {
        const customer = getOrCreateCustomer(r.id, "whatsapp", phone, name);
        customerId = customer.id;
        conversationId = newId("CNV");
        db.prepare("INSERT INTO conversations (id, restaurant_id, customer_id, channel, status, cart_id, branch_id, fulfilment, address, order_count, created_at, last_message_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
          .run(conversationId, r.id, customer.id, "whatsapp", "closed", null, branch.id, fulfilment, JSON.stringify({ text: area.name, area: area.name }), 1, created.toISOString(), created.toISOString());
        const latency = 1200 + Math.floor(rand() * 2200);
        db.prepare("INSERT INTO messages (conversation_id, role, content, display_text, latency_ms, created_at) VALUES (?,?,?,?,?,?)").run(conversationId, "user", JSON.stringify([{ type: "text", text: "hi" }]), "hi", null, created.toISOString());
        db.prepare("INSERT INTO messages (conversation_id, role, content, display_text, latency_ms, created_at) VALUES (?,?,?,?,?,?)").run(conversationId, "assistant", JSON.stringify([{ type: "text", text: r.greeting }]), r.greeting, latency, created.toISOString());
        // Upsell telemetry: ~45% of AI conversations were offered an upsell, ~38% of those accepted.
        if (rand() < 0.45 && seed.upsell_rules.length) {
          const rule = seed.upsell_rules[Math.floor(rand() * seed.upsell_rules.length)];
          db.prepare("INSERT INTO upsell_events (restaurant_id, conversation_id, rule_id, product_id, offered_at, accepted_at) VALUES (?,?,?,?,?,?)")
            .run(r.id, conversationId, rule.id, rule.suggest, created.toISOString(), rand() < 0.38 ? created.toISOString() : null);
        }
        // Some WhatsApp conversations that never converted (for conversion-rate realism).
        if (rand() < 0.35) {
          const c2 = getOrCreateCustomer(r.id, "whatsapp", `9231${Math.floor(10000000 + rand() * 89999999)}`, null);
          const cid = newId("CNV");
          const cartId = newId("CRT");
          db.prepare("INSERT INTO carts (id, restaurant_id, conversation_id, customer_id, promo_code, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)").run(cartId, r.id, cid, c2.id, null, "abandoned", created.toISOString(), created.toISOString());
          if (rand() < 0.5) db.prepare("INSERT INTO cart_items (id, cart_id, product_id, quantity, selections, notes, line_no) VALUES (?,?,?,?,?,?,1)").run(newId("LN"), cartId, products[0].id, 1, "{}", null);
          db.prepare("INSERT INTO conversations (id, restaurant_id, customer_id, channel, status, cart_id, branch_id, fulfilment, address, order_count, created_at, last_message_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
            .run(cid, r.id, c2.id, "whatsapp", rand() < 0.08 ? "human" : "closed", cartId, null, null, null, 0, created.toISOString(), created.toISOString());
        }
      }
      createOrder({
        restaurant_id: r.id, branch_id: branch.id, customer_id: customerId, conversation_id: conversationId, channel: ch.channel, source: ch.source,
        fulfilment, address: fulfilment === "delivery" ? { text: `${area.name}, ${area.city}`, area: area.name } : null,
        customer_name: name, customer_phone: ch.channel === "walk-in" ? null : phone, items, totals, promo_code: rand() < 0.1 ? "FREEDEL" : null,
        payment_method: ch.channel === "walk-in" ? "card" : rand() < 0.6 ? "cash" : "online", eta_min: zone.eta_min, eta_max: zone.eta_max,
        created_at: created.toISOString(), status, silent: true,
      });
    }
  }
}

export function seedAll(opts: { history?: boolean } = {}): string[] {
  const done: string[] = [];
  for (const t of TENANTS) if (seedTenant(t, opts)) done.push(t.restaurant.name);
  return done;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop()!);
if (isMain) {
  getDb();
  const done = seedAll();
  console.log(done.length ? `Seeded: ${done.join(", ")}` : "Database already seeded (run `npm run reset` to start fresh).");
}
