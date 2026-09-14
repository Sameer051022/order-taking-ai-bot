import type Anthropic from "@anthropic-ai/sdk";
import { addItem, addLinesFromSnapshot, clearCart, findLine, removeItem, setCartPromo, setCartStatus, updateItem } from "../core/cart.js";
import { getBranch, listBranches, pickupBranch, routeDelivery } from "../core/branches.js";
import { updateCustomer } from "../core/customers.js";
import { getProduct, isAvailableAtBranch, listCategories, listProducts, searchProducts } from "../core/menu.js";
import { createOrder, getOrderByNumber, listOrderEvents, listOrders, STATUS_LABEL } from "../core/orders.js";
import { money, priceCart } from "../core/pricing.js";
import { evaluatePromotion, listActivePromotions, recordPromotionUsage } from "../core/promotions.js";
import { markUpsellAccepted, suggestUpsells } from "../core/upsell.js";
import { DomainError, type Conversation, type Customer, type PricedCart, type Restaurant } from "../core/types.js";
import { rotateCart, updateConversation } from "./conversations.js";

export interface ToolContext {
  restaurant: Restaurant;
  conversation: Conversation;
  customer: Customer;
}

// ---------------------------------------------------------------------------
// Tool definitions (what Claude sees)
// ---------------------------------------------------------------------------

const selectionsSchema = {
  type: "object",
  description: 'Options keyed by option group name, e.g. {"Size": "Large", "Drink": "Sprite"} or for deals {"Sides": [{"modifier": "Fries", "quantity": 2}]}',
  additionalProperties: true,
};

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_menu_overview",
    description: "Compact overview of the whole menu: categories with item names and prices. Use when the customer asks what is available or for recommendations.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "search_menu",
    description: "Search menu items by name, keyword or category (e.g. 'zinger', 'wings', 'family deal', 'drinks'). Returns ids, prices, which options are required and availability at the customer's branch. Use this before add_cart_item when unsure of the exact item.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What the customer said, e.g. 'spicy burger meal'" },
        category: { type: "string", description: "Optional category filter, e.g. 'Deals'" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_product",
    description: "Full details of one item: description, price and all option groups (required/optional, choices, extra cost). Use to explain an item or to see valid options before configuring it.",
    input_schema: { type: "object", properties: { product: { type: "string", description: "Product id or exact name" } }, required: ["product"], additionalProperties: false },
  },
  {
    name: "add_cart_item",
    description: "Add an item to the cart. Options can be given as a flat list of option names in `modifiers` (e.g. [\"Large\", \"Sprite\", \"No Mayo\"]) or structured in `selections`. Missing required options are reported back so you can ask the customer. Identical configurations merge into one line; to give different units different options, add them separately or split later with update_cart_item.",
    input_schema: {
      type: "object",
      properties: {
        product: { type: "string", description: "Product id (preferred) or exact product name" },
        quantity: { type: "integer", minimum: 1, default: 1 },
        modifiers: { type: "array", items: { type: "string" }, description: "Option names as the customer said them, e.g. ['large', 'coke', 'no mayo']" },
        selections: selectionsSchema,
        notes: { type: "string", description: "Free-text kitchen note only when no option matches, e.g. 'cut in half'" },
      },
      required: ["product"],
      additionalProperties: false,
    },
  },
  {
    name: "update_cart_item",
    description: "Change a cart line: quantity, options or notes. Set `units` to change only some of the units on a line (they are split into a separate line), e.g. '2 meals, one with Sprite' -> units=1, add_modifiers=['Sprite']. add_modifiers replaces the current choice in single-choice groups (size, drink) and appends in multi-choice groups (customisation). remove_modifiers removes an option (e.g. to undo 'No Mayo').",
    input_schema: {
      type: "object",
      properties: {
        item: { type: "string", description: "Cart line id from get_cart / add_cart_item (e.g. LN_...)" },
        quantity: { type: "integer", minimum: 0, description: "New quantity for the line (0 removes it)" },
        units: { type: "integer", minimum: 1, description: "How many units of the line the option change applies to (default: all)" },
        add_modifiers: { type: "array", items: { type: "string" } },
        remove_modifiers: { type: "array", items: { type: "string" } },
        selections: selectionsSchema,
        notes: { type: "string" },
      },
      required: ["item"],
      additionalProperties: false,
    },
  },
  {
    name: "remove_cart_item",
    description: "Remove a cart line, or only some units of it.",
    input_schema: {
      type: "object",
      properties: { item: { type: "string", description: "Cart line id" }, units: { type: "integer", minimum: 1, description: "Units to remove (default: whole line)" } },
      required: ["item"],
      additionalProperties: false,
    },
  },
  { name: "clear_cart", description: "Empty the cart (customer wants to start over).", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "get_cart", description: "Current cart with line ids, options, prices, totals and anything still missing.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  {
    name: "set_fulfilment",
    description: "Choose delivery or pickup. For delivery pass the address text and/or the shared location coordinates; the backend picks the serving branch, delivery fee and ETA, and reports any cart items unavailable at that branch. For pickup pass the branch the customer chose (see list_branches). Use use_saved_address=true when the customer wants their usual address.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["delivery", "pickup"] },
        address_text: { type: "string", description: "Delivery address as typed, including area, e.g. 'House 12, Street 4, DHA Phase 6'" },
        lat: { type: "number" },
        lng: { type: "number" },
        use_saved_address: { type: "boolean" },
        branch: { type: "string", description: "Pickup branch id or name" },
      },
      required: ["type"],
      additionalProperties: false,
    },
  },
  { name: "list_branches", description: "Branches with addresses, opening hours and whether they are open now.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "get_active_promotions", description: "Currently active deals and promo codes with their conditions.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  {
    name: "apply_promo_code",
    description: "Validate and apply a promo code to the cart. The backend checks validity, minimum order, scope and usage; relay its verdict.",
    input_schema: { type: "object", properties: { code: { type: "string" } }, required: ["code"], additionalProperties: false },
  },
  { name: "remove_promo_code", description: "Remove the promo code from the cart.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  {
    name: "get_upsell_suggestions",
    description: "Backend-selected add-on suggestions for the current cart (at most two, never repeated). Offer at most one, naturally, once per conversation. Returns an empty list if nothing fits.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_checkout_summary",
    description: "Everything needed to confirm: itemised cart, totals, fulfilment, address/branch, ETA, payment options and any blockers. Call before asking the customer to confirm.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "place_order",
    description: "Create the order. Only call after the customer has explicitly confirmed the checkout summary you showed them.",
    input_schema: {
      type: "object",
      properties: {
        payment_method: { type: "string", enum: ["cash", "card"], description: "cash = cash on delivery / pay at pickup; card = card on delivery / at counter" },
        customer_confirmed: { type: "boolean", description: "Must be true: the customer explicitly said yes to the summary" },
      },
      required: ["payment_method", "customer_confirmed"],
      additionalProperties: false,
    },
  },
  { name: "get_recent_orders", description: "The customer's recent orders (for 'same as last time' / 'repeat my order').", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  {
    name: "reorder",
    description: "Copy the items of a previous order into the cart. Then adjust with the cart tools if the customer wants changes.",
    input_schema: { type: "object", properties: { order_number: { type: "integer" } }, required: ["order_number"], additionalProperties: false },
  },
  {
    name: "get_order_status",
    description: "Status and timeline of an order (latest order if no number given).",
    input_schema: { type: "object", properties: { order_number: { type: "integer" } }, additionalProperties: false },
  },
  {
    name: "update_customer_name",
    description: "Save the customer's name when they tell you it.",
    input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"], additionalProperties: false },
  },
  {
    name: "request_human_agent",
    description: "Hand the conversation to a human team member. Use when the customer asks for a person, is upset, or you cannot resolve the issue.",
    input_schema: { type: "object", properties: { reason: { type: "string" } }, required: ["reason"], additionalProperties: false },
  },
];

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

function pricingCtx(ctx: ToolContext) {
  return {
    branchId: ctx.conversation.branch_id,
    fulfilment: ctx.conversation.fulfilment,
    deliveryFee: ctx.conversation.address?.delivery_fee ?? 0,
    customerId: ctx.customer.id,
  };
}

export function currentCart(ctx: ToolContext): PricedCart {
  return priceCart(ctx.conversation.cart_id!, pricingCtx(ctx));
}

function compactCart(ctx: ToolContext, cart: PricedCart) {
  const cur = ctx.restaurant.currency;
  return {
    items: cart.lines.map((l) => ({
      id: l.id,
      quantity: l.quantity,
      product: l.product_name,
      options: l.summary || null,
      unit_price: l.unit_price,
      line_total: l.line_total,
      ...(l.issues.length
        ? {
            needs_attention: l.issues.map((i) =>
              i.type === "missing_selection"
                ? { ask_for: i.group_name, choose: `${i.min}${i.max !== i.min ? `-${i.max}` : ""}`, options: i.options!.map((o) => (o.price_delta ? `${o.name} (+${money(o.price_delta, cur)})` : o.name)) }
                : { problem: i.message },
            ),
          }
        : {}),
    })),
    subtotal: cart.totals.subtotal,
    discount: cart.totals.discount || undefined,
    discount_label: cart.totals.discount_label || undefined,
    tax: cart.totals.tax,
    delivery_fee: ctx.conversation.fulfilment === "delivery" ? cart.totals.delivery_fee : undefined,
    total: cart.totals.total,
    promo_code: cart.promo_code || undefined,
    promo_error: cart.promo_error || undefined,
    ready_to_order: cart.is_valid,
  };
}

function requireProductRef(ctx: ToolContext, ref: string) {
  const byId = getProduct(ref);
  if (byId && byId.restaurant_id === ctx.restaurant.id) return byId;
  const ranked = searchProducts(ctx.restaurant.id, ref);
  if (ranked[0] && ranked[0].score >= 70) return getProduct(ranked[0].product.id)!;
  throw new DomainError(`No product "${ref}". Use search_menu.`, "UNKNOWN_PRODUCT");
}

function fmtProductBrief(ctx: ToolContext, p: ReturnType<typeof listProducts>[number]) {
  const full = getProduct(p.id)!;
  const required = full.groups.filter((g) => g.min_select > 0 && !g.modifiers.some((m) => m.is_default)).map((g) => g.name);
  const optional = full.groups.filter((g) => !required.includes(g.name)).map((g) => g.name);
  return {
    id: p.id,
    name: p.name,
    category: p.category_name,
    price: p.base_price,
    description: p.description ?? undefined,
    asks_for: required.length ? required : undefined,
    optional_options: optional.length ? optional : undefined,
    available: isAvailableAtBranch(p.id, ctx.conversation.branch_id) ? undefined : false,
  };
}

export async function executeTool(name: string, rawInput: unknown, ctx: ToolContext): Promise<unknown> {
  const input = (rawInput ?? {}) as Record<string, any>;
  const R = ctx.restaurant;
  const cartId = ctx.conversation.cart_id!;

  switch (name) {
    case "get_menu_overview": {
      const products = listProducts(R.id);
      const unavailable = new Set(products.filter((p) => !isAvailableAtBranch(p.id, ctx.conversation.branch_id)).map((p) => p.id));
      return {
        categories: listCategories(R.id).map((c) => ({
          name: c.name,
          items: products.filter((p) => p.category_id === c.id).map((p) => `${p.name} — ${money(p.base_price, R.currency)}${unavailable.has(p.id) ? " (sold out here)" : ""}`),
        })),
        note: "Meals include fries and a drink. Prices in " + R.currency + ".",
      };
    }
    case "search_menu": {
      const ranked = searchProducts(R.id, String(input.query ?? ""), input.category ? String(input.category) : undefined).slice(0, 8);
      if (!ranked.length) return { results: [], hint: "No match. Try a broader word or get_menu_overview." };
      return { results: ranked.map((r) => fmtProductBrief(ctx, r.product)) };
    }
    case "get_product": {
      const p = requireProductRef(ctx, String(input.product));
      return {
        id: p.id, name: p.name, price: p.base_price, description: p.description, type: p.type,
        available: isAvailableAtBranch(p.id, ctx.conversation.branch_id),
        options: p.groups.map((g) => ({
          group: g.name,
          rule: g.min_select === 0 ? `optional, up to ${g.max_select}` : g.min_select === g.max_select ? `choose ${g.min_select}` : `choose ${g.min_select}-${g.max_select}`,
          choices: g.modifiers.map((m) => `${m.name}${m.price_delta ? ` (+${money(m.price_delta, R.currency)})` : ""}${m.is_default ? " [default]" : ""}`),
        })),
      };
    }
    case "add_cart_item": {
      const line = addItem(cartId, { product: String(input.product), quantity: input.quantity, modifiers: input.modifiers, selections: input.selections, notes: input.notes });
      markUpsellAccepted(ctx.conversation.id, line.product_id);
      const cart = currentCart(ctx);
      const added = cart.lines.find((l) => l.id === line.id);
      return { added: added ? { id: added.id, quantity: added.quantity, product: added.product_name, options: added.summary || null } : null, cart: compactCart(ctx, cart) };
    }
    case "update_cart_item": {
      const line = updateItem(cartId, {
        item: String(input.item), quantity: input.quantity, units: input.units, selections: input.selections,
        add_modifiers: input.add_modifiers, remove_modifiers: input.remove_modifiers, notes: input.notes,
      });
      const cart = currentCart(ctx);
      const changed = cart.lines.find((l) => l.id === line.id);
      return { updated: changed ? { id: changed.id, quantity: changed.quantity, product: changed.product_name, options: changed.summary || null } : { removed: true }, cart: compactCart(ctx, cart) };
    }
    case "remove_cart_item": {
      findLine(cartId, String(input.item));
      removeItem(cartId, String(input.item), input.units);
      return { removed: true, cart: compactCart(ctx, currentCart(ctx)) };
    }
    case "clear_cart": {
      clearCart(cartId);
      return { cleared: true, cart: compactCart(ctx, currentCart(ctx)) };
    }
    case "get_cart":
      return compactCart(ctx, currentCart(ctx));

    case "set_fulfilment": {
      if (input.type === "pickup") {
        const { branch, candidates } = pickupBranch(R.id, input.branch ? String(input.branch) : undefined);
        if (!branch) {
          return { needs_branch: true, branches: candidates.map((b) => ({ id: b.id, name: b.name, address: b.address, open: !!b.is_open })) };
        }
        if (!branch.is_open) return { error: `${branch.name} is currently closed. Offer another branch.`, branches: candidates.filter((b) => b.is_open).map((b) => ({ id: b.id, name: b.name })) };
        ctx.conversation = updateConversation(ctx.conversation.id, { fulfilment: "pickup", branch_id: branch.id, address: null });
        const cart = currentCart(ctx);
        return { fulfilment: "pickup", branch: { id: branch.id, name: branch.name, address: branch.address }, ready_in_minutes: branch.prep_minutes, unavailable_items: unavailableItems(cart), cart: compactCart(ctx, cart) };
      }
      let addressText = input.address_text ? String(input.address_text) : undefined;
      let lat = input.lat, lng = input.lng;
      if (input.use_saved_address && ctx.customer.last_address) {
        addressText = ctx.customer.last_address.text;
        lat = ctx.customer.last_address.lat; lng = ctx.customer.last_address.lng;
      }
      if (!addressText && lat == null) return { error: "Ask the customer for their delivery address (with area) or to share their location." };
      const route = routeDelivery(R.id, { text: addressText, lat, lng });
      if (!route.ok) {
        return { error: route.reason, offer_pickup_at: route.alternatives?.map((a) => `${a.branch.name} (${a.distance_km.toFixed(1)} km)`) };
      }
      const address = { ...route.address!, distance_km: route.distance_km, delivery_fee: route.zone?.fee ?? 0, eta_min: route.zone?.eta_min, eta_max: route.zone?.eta_max };
      ctx.conversation = updateConversation(ctx.conversation.id, { fulfilment: "delivery", branch_id: route.branch!.id, address });
      updateCustomer(ctx.customer.id, { last_address: address });
      ctx.customer.last_address = address;
      const cart = currentCart(ctx);
      return {
        fulfilment: "delivery", address: address.text, area: address.area, branch: route.branch!.name,
        delivery_fee: address.delivery_fee, eta: `${address.eta_min}-${address.eta_max} minutes`,
        unavailable_items: unavailableItems(cart), cart: compactCart(ctx, cart),
      };
    }
    case "list_branches":
      return { branches: listBranches(R.id).map((b) => ({ id: b.id, name: b.name, address: b.address, hours: `${b.opens_at}-${b.closes_at}`, open_now: !!b.is_open })) };

    case "get_active_promotions":
      return { promotions: listActivePromotions(R.id).map((p) => ({ code: p.code, name: p.name, conditions: p.description })) };
    case "apply_promo_code": {
      const cart = currentCart(ctx);
      const res = evaluatePromotion(String(input.code), {
        restaurantId: R.id, lines: cart.lines, subtotal: cart.totals.subtotal, deliveryFee: cart.totals.delivery_fee,
        branchId: ctx.conversation.branch_id, fulfilment: ctx.conversation.fulfilment, customerId: ctx.customer.id,
      });
      if (!res.ok) return { applied: false, reason: res.error };
      setCartPromo(cartId, res.promotion!.code);
      return { applied: true, promotion: res.label, cart: compactCart(ctx, currentCart(ctx)) };
    }
    case "remove_promo_code":
      setCartPromo(cartId, null);
      return { removed: true, cart: compactCart(ctx, currentCart(ctx)) };

    case "get_upsell_suggestions": {
      const cart = currentCart(ctx);
      if (!cart.lines.length) return { suggestions: [] };
      return { suggestions: suggestUpsells(R.id, ctx.conversation.id, cart, ctx.conversation.branch_id).map((s) => ({ product_id: s.product_id, product: s.product_name, price: s.price, pitch: s.pitch })) };
    }

    case "get_checkout_summary": {
      const cart = currentCart(ctx);
      const c = ctx.conversation;
      const blockers: string[] = [];
      if (!cart.lines.length) blockers.push("Cart is empty.");
      for (const i of cart.issues) blockers.push(i.message);
      if (cart.promo_error) blockers.push(`Promo problem: ${cart.promo_error} (remove the code or fix the cart).`);
      if (!c.fulfilment) blockers.push("Ask: delivery or pickup?");
      if (c.fulfilment === "delivery" && !c.address) blockers.push("Delivery address missing.");
      if (c.fulfilment && !c.branch_id) blockers.push("No branch selected.");
      const branch = c.branch_id ? getBranch(c.branch_id) : undefined;
      return {
        ready: blockers.length === 0,
        blockers: blockers.length ? blockers : undefined,
        cart: compactCart(ctx, cart),
        fulfilment: c.fulfilment,
        address: c.address?.text,
        branch: branch?.name,
        eta: c.fulfilment === "delivery" && c.address?.eta_min ? `${c.address.eta_min}-${c.address.eta_max} minutes` : c.fulfilment === "pickup" && branch ? `ready in about ${branch.prep_minutes} minutes` : undefined,
        payment_options: c.fulfilment === "pickup" ? ["cash (pay at pickup)", "card (at counter)"] : ["cash (cash on delivery)", "card (card on delivery)"],
        customer_name: ctx.customer.name ?? undefined,
      };
    }
    case "place_order": {
      if (input.customer_confirmed !== true) return { error: "Show the checkout summary and get an explicit yes from the customer first." };
      const cart = currentCart(ctx);
      const c = ctx.conversation;
      if (!cart.lines.length) return { error: "Cart is empty." };
      if (!cart.is_valid) return { error: `Cart is not complete: ${cart.issues.map((i) => i.message).join("; ")}` };
      if (cart.promo_error) return { error: `Promo code problem: ${cart.promo_error}` };
      if (!c.fulfilment || !c.branch_id) return { error: "Fulfilment (delivery/pickup) is not set. Call set_fulfilment first." };
      if (c.fulfilment === "delivery" && !c.address) return { error: "Delivery address missing." };
      const branch = getBranch(c.branch_id)!;
      const payment = input.payment_method === "card" ? "card" : "cash";
      const order = createOrder({
        restaurant_id: R.id, branch_id: branch.id, customer_id: ctx.customer.id, conversation_id: c.id, channel: "whatsapp", source: "ai",
        fulfilment: c.fulfilment, address: c.fulfilment === "delivery" ? c.address : null,
        customer_name: ctx.customer.name, customer_phone: ctx.customer.external_id,
        items: cart.lines, totals: cart.totals, promo_code: cart.promo_code, payment_method: payment,
        eta_min: c.fulfilment === "delivery" ? c.address?.eta_min ?? null : branch.prep_minutes,
        eta_max: c.fulfilment === "delivery" ? c.address?.eta_max ?? null : branch.prep_minutes + 10,
      });
      if (cart.promo_code) {
        const promo = listActivePromotions(R.id).find((p) => p.code?.toUpperCase() === cart.promo_code!.toUpperCase());
        if (promo) recordPromotionUsage(promo.id, ctx.customer.id, order.id);
      }
      setCartStatus(cart.cart_id, "ordered");
      ctx.conversation = rotateCart(ctx.conversation);
      return {
        placed: true,
        order_number: order.order_number,
        total: order.totals.total,
        payment: payment === "cash" ? (c.fulfilment === "delivery" ? "cash on delivery" : "pay at pickup") : "card",
        eta: order.eta_min ? `${order.eta_min}-${order.eta_max} minutes` : undefined,
        branch: branch.name,
        fulfilment: order.fulfilment,
        note: "Tell the customer they will get automatic WhatsApp updates as the order progresses.",
      };
    }
    case "get_recent_orders": {
      const orders = listOrders(R.id, { customer_id: ctx.customer.id, limit: 5 });
      return {
        orders: orders.map((o) => ({
          order_number: o.order_number,
          when: new Date(o.created_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
          days_ago: Math.floor((Date.now() - new Date(o.created_at).getTime()) / 86400_000),
          fulfilment: o.fulfilment,
          items: o.items.map((i) => `${i.quantity} × ${i.product_name}${i.summary ? ` (${i.summary})` : ""}`),
          total: o.totals.total,
          status: o.status,
        })),
      };
    }
    case "reorder": {
      const o = getOrderByNumber(R.id, Number(input.order_number));
      if (!o || o.customer_id !== ctx.customer.id) return { error: "That order was not found for this customer." };
      const res = addLinesFromSnapshot(cartId, o.items);
      return { added: res.added, skipped_unavailable: res.skipped.length ? res.skipped : undefined, cart: compactCart(ctx, currentCart(ctx)) };
    }
    case "get_order_status": {
      const o = input.order_number ? getOrderByNumber(R.id, Number(input.order_number)) : listOrders(R.id, { customer_id: ctx.customer.id, limit: 1 })[0];
      if (!o || o.customer_id !== ctx.customer.id) return { error: "No such order for this customer." };
      return {
        order_number: o.order_number, status: STATUS_LABEL[o.status], fulfilment: o.fulfilment, branch: o.branch_name, total: o.totals.total,
        eta: o.eta_min && !["DELIVERED", "COLLECTED", "CANCELLED"].includes(o.status) ? `${o.eta_min}-${o.eta_max} minutes from order time` : undefined,
        timeline: listOrderEvents(o.id).map((e) => `${new Date(e.created_at).toLocaleTimeString("en-PK", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit" })} ${STATUS_LABEL[e.status as keyof typeof STATUS_LABEL] ?? e.status}`),
      };
    }
    case "update_customer_name": {
      const name = String(input.name).trim().slice(0, 60);
      updateCustomer(ctx.customer.id, { name });
      ctx.customer.name = name;
      return { saved: true, name };
    }
    case "request_human_agent": {
      ctx.conversation = updateConversation(ctx.conversation.id, { status: "human" });
      return { handed_over: true, note: "Tell the customer a team member will reply in this chat shortly. Do not continue taking the order." };
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}

function unavailableItems(cart: PricedCart): string[] | undefined {
  const u = cart.lines.filter((l) => l.issues.some((i) => i.type === "unavailable")).map((l) => l.product_name);
  return u.length ? u : undefined;
}
