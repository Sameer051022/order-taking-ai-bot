import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";
import { getDb } from "../db/index.js";
import { handleIncoming, recordHumanReply } from "../agent/agent.js";
import { getConversation, listConversations, listMessages, updateConversation } from "../agent/conversations.js";
import { getBranch, listBranches, setBranchOpen } from "../core/branches.js";
import { getCustomer } from "../core/customers.js";
import { bus, type AppEvent } from "../core/events.js";
import { overview } from "../core/analytics.js";
import { getProduct, getRestaurantBySlug, listCategories, listProducts, listRestaurants, listUnavailable, setBranchAvailability, setProductActive } from "../core/menu.js";
import { getOrder, listOrderEvents, listOrders, nextStatus, transitionOrder } from "../core/orders.js";
import { priceCart } from "../core/pricing.js";
import { listActivePromotions } from "../core/promotions.js";
import { DomainError, type OrderStatus } from "../core/types.js";
import { deliverToCustomer } from "../channels/outbound.js";
import { processWebhook } from "../channels/whatsapp.js";
import { SCRIPTS } from "../demo/scripts.js";
import { VENDOR } from "../brand.js";
import { runReplayStep } from "../demo/replay.js";

function requireRestaurant(req: FastifyRequest) {
  const slug = (req.params as any).slug as string;
  const r = getRestaurantBySlug(slug);
  if (!r) throw new DomainError(`Unknown restaurant ${slug}`, "NOT_FOUND");
  return r;
}

function sse(reply: FastifyReply, filter: (e: AppEvent) => boolean, map: (e: AppEvent) => unknown = (e) => e) {
  reply.raw.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "Access-Control-Allow-Origin": "*" });
  reply.raw.write(`: connected\n\n`);
  const unsub = bus.subscribe((e) => {
    if (!filter(e)) return;
    reply.raw.write(`data: ${JSON.stringify(map(e))}\n\n`);
  });
  const ping = setInterval(() => reply.raw.write(`: ping\n\n`), 25_000);
  reply.raw.on("close", () => { clearInterval(ping); unsub(); });
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.setErrorHandler((err: unknown, _req, reply) => {
    if (err instanceof DomainError) return reply.status(err.code === "NOT_FOUND" ? 404 : 400).send({ error: err.message, code: err.code });
    app.log.error(err);
    return reply.status(500).send({ error: err instanceof Error ? err.message : String(err) });
  });

  // Optional shared-secret gate for the demo/dashboard APIs.
  app.addHook("onRequest", async (req, reply) => {
    if (!config.demoToken || !req.url.startsWith("/api/")) return;
    const token = (req.headers["x-demo-token"] as string) ?? (req.query as any)?.token;
    if (token !== config.demoToken) return reply.status(401).send({ error: "unauthorized" });
  });

  app.get("/api/vendor", async () => VENDOR);
  app.get("/api/health", async () => ({ ok: true, model: config.claudeModel, ai_configured: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) || "profile" }));
  app.get("/api/restaurants", async () => listRestaurants().map((r) => ({ id: r.id, slug: r.slug, name: r.name, tagline: r.tagline, emoji: r.emoji, currency: r.currency, greeting: r.greeting, theme: r.theme ? JSON.parse(r.theme) : null })));

  // ---- Demo chat (WhatsApp simulator) ------------------------------------
  app.post("/api/r/:slug/demo/message", async (req) => {
    const r = requireRestaurant(req);
    const body = req.body as { phone: string; text?: string; location?: { lat: number; lng: number; name?: string }; name?: string };
    if (!body?.phone) throw new DomainError("phone is required");
    const result = await handleIncoming({ restaurant: r, channel: "web", customerKey: body.phone.replace(/\D/g, ""), text: body.text, location: body.location, customerName: body.name ?? null });
    const cart = result.conversation.cart_id ? safePrice(result.conversation) : null;
    return {
      replies: result.replies, handled_by_ai: result.handled_by_ai, latency_ms: result.latency_ms, tools: result.tools,
      conversation: convPayload(result.conversation),
      cart,
    };
  });
  app.get("/api/r/:slug/demo/state", async (req) => {
    const r = requireRestaurant(req);
    const phone = String((req.query as any).phone ?? "").replace(/\D/g, "");
    const conv = listConversations(r.id, 500).find((c) => c.customer_phone === phone && c.status !== "closed");
    if (!conv) return { conversation: null, messages: [], cart: null };
    return {
      conversation: convPayload(conv),
      messages: listMessages(conv.id).filter((m) => m.display_text).map((m) => ({ role: m.role, text: m.display_text, at: m.created_at })),
      cart: safePrice(conv),
    };
  });
  app.post("/api/r/:slug/demo/reset", async (req) => {
    const r = requireRestaurant(req);
    const phone = String((req.body as any)?.phone ?? "").replace(/\D/g, "");
    const convs = listConversations(r.id, 500).filter((c) => c.customer_phone === phone);
    for (const c of convs.filter((c) => c.status !== "closed")) updateConversation(c.id, { status: "closed" });
    // Demo convenience: let the same customer reuse one-per-customer promo codes on the next run.
    if (convs[0]) getDb().prepare("DELETE FROM promotion_usages WHERE customer_id = ?").run(convs[0].customer_id);
    return { ok: true };
  });
  app.get("/api/r/:slug/demo/scripts", async (req) => {
    const r = requireRestaurant(req);
    return (SCRIPTS[r.slug] ?? []).map((s, i) => ({ id: i, title: s.title, phone: s.phone, steps: s.steps.map((st) => ({ say: st.say, note: st.note ?? null, tools: (st.tools ?? []).map((t) => t.name) })) }));
  });
  app.post("/api/r/:slug/demo/replay", async (req) => {
    const r = requireRestaurant(req);
    const body = req.body as { script?: number; step: number; phone?: string };
    const script = (SCRIPTS[r.slug] ?? [])[body.script ?? 0];
    if (!script) throw new DomainError("No script for this restaurant", "NOT_FOUND");
    const result = await runReplayStep(r, script, Number(body.step), body.phone);
    return {
      replies: result.replies, handled_by_ai: true, latency_ms: result.latency_ms, tools: result.tools, scripted: true,
      conversation: convPayload(result.conversation),
      cart: safePrice(result.conversation), step: Number(body.step), total_steps: script.steps.length,
    };
  });
  app.get("/api/r/:slug/demo/events", async (req, reply) => {
    const r = requireRestaurant(req);
    const phone = String((req.query as any).phone ?? "").replace(/\D/g, "");
    sse(reply, (e) => e.restaurant_id === r.id && ((e.type === "customer.message" && e.customer_key === phone) || (e.type === "agent.tool" && e.customer_key === phone)));
  });

  // ---- Dashboard ----------------------------------------------------------
  app.get("/api/r/:slug/analytics", async (req) => overview(requireRestaurant(req).id));
  app.get("/api/r/:slug/orders", async (req) => {
    const r = requireRestaurant(req);
    const q = req.query as any;
    return listOrders(r.id, { active: q.active === "1", limit: Number(q.limit ?? 60) }).map((o) => ({ ...o, next_status: nextStatus(o) }));
  });
  app.get("/api/r/:slug/orders/:id", async (req) => {
    const o = getOrder((req.params as any).id);
    if (!o) throw new DomainError("Order not found", "NOT_FOUND");
    return { ...o, events: listOrderEvents(o.id), next_status: nextStatus(o) };
  });
  app.post("/api/r/:slug/orders/:id/advance", async (req) => {
    const o = getOrder((req.params as any).id);
    if (!o) throw new DomainError("Order not found", "NOT_FOUND");
    const target = ((req.body as any)?.status as OrderStatus | undefined) ?? nextStatus(o);
    if (!target) throw new DomainError("Order is already complete");
    return transitionOrder(o.id, target, (req.body as any)?.note);
  });
  app.get("/api/r/:slug/conversations", async (req) => listConversations(requireRestaurant(req).id, 60));
  app.get("/api/r/:slug/conversations/:id", async (req) => {
    const c = getConversation((req.params as any).id);
    if (!c) throw new DomainError("Conversation not found", "NOT_FOUND");
    const customer = getCustomer(c.customer_id);
    return {
      ...c, customer,
      cart: safePrice(c),
      messages: listMessages(c.id).map((m) => ({ id: m.id, role: m.role, text: m.display_text, content: m.content, latency_ms: m.latency_ms, at: m.created_at })),
      orders: listOrders(c.restaurant_id, { customer_id: c.customer_id, limit: 5 }).map((o) => ({ id: o.id, order_number: o.order_number, status: o.status, total: o.totals.total })),
    };
  });
  app.post("/api/r/:slug/conversations/:id/takeover", async (req) => {
    const c = getConversation((req.params as any).id);
    if (!c) throw new DomainError("Conversation not found", "NOT_FOUND");
    const resume = (req.body as any)?.resume === true;
    return updateConversation(c.id, { status: resume ? "active" : "human" });
  });
  app.post("/api/r/:slug/conversations/:id/reply", async (req) => {
    const c = getConversation((req.params as any).id);
    if (!c) throw new DomainError("Conversation not found", "NOT_FOUND");
    const text = String((req.body as any)?.text ?? "").trim();
    if (!text) throw new DomainError("text is required");
    const updated = recordHumanReply(c.id, text);
    await deliverToCustomer(updated, text, "reply");
    return { ok: true };
  });
  app.get("/api/r/:slug/menu", async (req) => {
    const r = requireRestaurant(req);
    const branches = listBranches(r.id).map((b) => ({ ...b, unavailable: listUnavailable(b.id) }));
    return { categories: listCategories(r.id), products: listProducts(r.id, { activeOnly: false }).map((p) => ({ ...p, groups: getProduct(p.id)!.groups })), branches, promotions: listActivePromotions(r.id) };
  });
  app.post("/api/r/:slug/menu/availability", async (req) => {
    const r = requireRestaurant(req);
    const b = req.body as { branch_id: string; product_id: string; available: boolean };
    setBranchAvailability(b.branch_id, b.product_id, b.available);
    bus.publish({ type: "menu.updated", restaurant_id: r.id });
    return { ok: true };
  });
  app.post("/api/r/:slug/menu/products/:id/active", async (req) => {
    const r = requireRestaurant(req);
    setProductActive((req.params as any).id, Boolean((req.body as any)?.active));
    bus.publish({ type: "menu.updated", restaurant_id: r.id });
    return { ok: true };
  });
  app.post("/api/r/:slug/branches/:id/open", async (req) => {
    const r = requireRestaurant(req);
    setBranchOpen((req.params as any).id, Boolean((req.body as any)?.open));
    bus.publish({ type: "menu.updated", restaurant_id: r.id });
    return { ok: true };
  });
  app.get("/api/r/:slug/events", async (req, reply) => {
    const r = requireRestaurant(req);
    sse(reply, (e) => e.restaurant_id === r.id && e.type !== "agent.tool" && e.type !== "customer.message");
  });

  // ---- WhatsApp Cloud API webhook ----------------------------------------
  app.get("/webhooks/whatsapp", async (req, reply) => {
    const q = req.query as Record<string, string>;
    if (q["hub.mode"] === "subscribe" && q["hub.verify_token"] === config.whatsapp.verifyToken) return reply.send(q["hub.challenge"]);
    return reply.status(403).send("forbidden");
  });
  app.post("/webhooks/whatsapp", async (req, reply) => {
    void processWebhook(req.body).catch((e) => app.log.error(e));
    return reply.send({ ok: true });
  });
}

function convPayload(c: { id: string; status: string; fulfilment: string | null; branch_id: string | null; address: unknown }) {
  return { id: c.id, status: c.status, fulfilment: c.fulfilment, branch_id: c.branch_id, branch_name: c.branch_id ? getBranch(c.branch_id)?.name ?? null : null, address: c.address };
}

function safePrice(c: { cart_id: string | null; branch_id: string | null; fulfilment: "delivery" | "pickup" | null; address: { delivery_fee?: number } | null; customer_id: string }) {
  if (!c.cart_id) return null;
  try {
    return priceCart(c.cart_id, { branchId: c.branch_id, fulfilment: c.fulfilment, deliveryFee: c.address?.delivery_fee ?? 0, customerId: c.customer_id });
  } catch {
    return null;
  }
}
