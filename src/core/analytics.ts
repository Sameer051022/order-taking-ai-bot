import { getDb } from "../db/index.js";

function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400_000).toISOString();
}

export function overview(restaurantId: string) {
  const db = getDb();
  const today = startOfToday();
  const week = daysAgo(7);
  const q = (sql: string, ...p: unknown[]) => db.prepare(sql).get(...p) as any;

  const t = q(`SELECT COUNT(*) n, COALESCE(SUM(json_extract(totals,'$.total')),0) rev,
                 SUM(CASE WHEN channel='whatsapp' THEN 1 ELSE 0 END) wa,
                 COALESCE(SUM(CASE WHEN source='ai' THEN json_extract(totals,'$.total') ELSE 0 END),0) ai_rev,
                 SUM(CASE WHEN source='ai' THEN 1 ELSE 0 END) ai_n
               FROM orders WHERE restaurant_id=? AND created_at>=? AND status<>'CANCELLED'`, restaurantId, today);
  const w = q(`SELECT COUNT(*) n, COALESCE(SUM(json_extract(totals,'$.total')),0) rev,
                 COALESCE(SUM(CASE WHEN source='ai' THEN json_extract(totals,'$.total') ELSE 0 END),0) ai_rev,
                 SUM(CASE WHEN source='ai' THEN 1 ELSE 0 END) ai_n
               FROM orders WHERE restaurant_id=? AND created_at>=? AND status<>'CANCELLED'`, restaurantId, week);
  const conv = q(`SELECT COUNT(*) total, SUM(CASE WHEN order_count>0 THEN 1 ELSE 0 END) converted,
                    SUM(CASE WHEN status='human' THEN 1 ELSE 0 END) human
                  FROM conversations WHERE restaurant_id=? AND created_at>=?`, restaurantId, week);
  const abandoned = q(`SELECT COUNT(*) n FROM conversations c JOIN carts k ON k.id=c.cart_id
                       WHERE c.restaurant_id=? AND c.order_count=0 AND c.created_at>=? AND EXISTS (SELECT 1 FROM cart_items i WHERE i.cart_id=k.id)`, restaurantId, week);
  const ups = q(`SELECT COUNT(*) offered, SUM(CASE WHEN accepted_at IS NOT NULL THEN 1 ELSE 0 END) accepted FROM upsell_events WHERE restaurant_id=? AND offered_at>=?`, restaurantId, week);
  const latency = q(`SELECT AVG(m.latency_ms) ms FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.restaurant_id=? AND m.role='assistant' AND m.latency_ms IS NOT NULL AND m.created_at>=?`, restaurantId, week);
  const takeovers = q(`SELECT COUNT(*) n FROM conversations WHERE restaurant_id=? AND status='human' AND created_at>=?`, restaurantId, week);

  const popular = db.prepare(`SELECT json_extract(value,'$.product_name') name, SUM(json_extract(value,'$.quantity')) qty, SUM(json_extract(value,'$.line_total')) revenue
      FROM orders, json_each(orders.items) WHERE orders.restaurant_id=? AND orders.created_at>=? AND orders.status<>'CANCELLED'
      GROUP BY name ORDER BY qty DESC LIMIT 8`).all(restaurantId, week) as any[];
  const hours = db.prepare(`SELECT CAST(strftime('%H', created_at, 'localtime') AS INTEGER) hour, COUNT(*) n FROM orders WHERE restaurant_id=? AND created_at>=? GROUP BY hour ORDER BY hour`).all(restaurantId, week) as any[];
  const channels = db.prepare(`SELECT channel, COUNT(*) n, COALESCE(SUM(json_extract(totals,'$.total')),0) rev FROM orders WHERE restaurant_id=? AND created_at>=? AND status<>'CANCELLED' GROUP BY channel ORDER BY n DESC`).all(restaurantId, week) as any[];
  const daily = db.prepare(`SELECT date(created_at,'localtime') day, COUNT(*) n, COALESCE(SUM(json_extract(totals,'$.total')),0) rev,
      SUM(CASE WHEN source='ai' THEN 1 ELSE 0 END) ai_n FROM orders WHERE restaurant_id=? AND created_at>=? AND status<>'CANCELLED' GROUP BY day ORDER BY day`).all(restaurantId, week) as any[];
  const statusCounts = db.prepare(`SELECT status, COUNT(*) n FROM orders WHERE restaurant_id=? AND status NOT IN ('DELIVERED','COLLECTED','CANCELLED') GROUP BY status`).all(restaurantId) as any[];

  const hourMap = new Map<number, number>(hours.map((h) => [h.hour, h.n]));
  return {
    today: { orders: t.n, whatsapp_orders: t.wa ?? 0, revenue: t.rev, ai_revenue: t.ai_rev, ai_orders: t.ai_n ?? 0, avg_order: t.n ? Math.round(t.rev / t.n) : 0 },
    week: {
      orders: w.n, revenue: w.rev, ai_revenue: w.ai_rev, ai_orders: w.ai_n ?? 0, avg_order: w.n ? Math.round(w.rev / w.n) : 0,
      conversations: conv.total ?? 0, converted: conv.converted ?? 0,
      conversion_rate: conv.total ? Math.round(((conv.converted ?? 0) / conv.total) * 100) : 0,
      abandoned: abandoned.n ?? 0,
      upsell_offered: ups.offered ?? 0, upsell_accepted: ups.accepted ?? 0,
      upsell_rate: ups.offered ? Math.round(((ups.accepted ?? 0) / ups.offered) * 100) : 0,
      avg_response_ms: Math.round(latency.ms ?? 0),
      human_takeovers: takeovers.n ?? 0,
      takeover_rate: conv.total ? Math.round(((takeovers.n ?? 0) / conv.total) * 100) : 0,
    },
    popular,
    peak_hours: Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: hourMap.get(h) ?? 0 })),
    channels,
    daily,
    live_status: statusCounts,
  };
}
