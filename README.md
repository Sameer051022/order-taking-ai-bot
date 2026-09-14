# AI Ordering Agent

Built by **Kodevengers** · [kodevengers.com](https://kodevengers.com) · imran@kodevengers.com

An enterprise-shaped, WhatsApp-first AI ordering agent for restaurants. Claude is the **conversation layer only**; this backend is authoritative for the menu, pricing, deals, promotions, branches, availability, delivery quotes, orders and order status.

```
Customer → WhatsApp → AI agent (Claude + tools) → Order engine → Branch / Cart / Pricing / Promotions → POS / KDS
```

Four demo brands run on the same engine so you can pitch to any chain:

| Brand | Inspired by | Menu shape |
|---|---|---|
| **KFC** (concept) 🍗 | KFC Pakistan, for pitching KFC | Zinger / Mighty Zinger / Krunch, combos, Twister, Rice & Spice, Hot Wings, Family Festival, Crispy Duo Box, Wow Box. KFC red/black theme, `public/brands/kfc.svg` wordmark placeholder (swap for the official asset when pitching). |
| **CrunchBird** 🍗 | KFC | Zinger/Mighty burgers and meals, wings, hot shots, twister wraps, rice, buckets, family/duo/combo deals |
| **Golden Bun** 🍔 | McDonald's | Big Stack / Quarter Grill burgers, meal sizes, nuggets with dips, kids box with toy, family box, breakfast, swirl desserts |
| **Slice House** 🍕 | a pizzeria | Sizes, crusts, toppings |

The KFC tenant is a concept prepared for a pitch to KFC and is labelled as such in the presentation; the other brands are fictional.

## Quick start

```bash
cp .env.example .env         # put your ANTHROPIC_API_KEY in .env
npm install
npm run dev                  # seeds demo data on first start
```

- **Client presentation**: http://localhost:3000/presentation/ (pitch, live stage, scripted demo with talking points)
- WhatsApp simulator: http://localhost:3000/demo/ (demo without a Meta account)
- Restaurant dashboard: http://localhost:3000/dashboard/
- `npm run reset` wipes the database and re-seeds (menus, branches, a week of synthetic orders, a returning customer with past orders).

Without an API key the backend, dashboard and simulator still run; the agent replies "The AI agent is not configured yet".

## What is in the box

| Area | Where | Notes |
|---|---|---|
| Menu model | `src/db/schema.sql`, `src/core/menu.ts` | categories → products (item/deal) → modifier groups (min/max/repeat) → modifiers (price delta, default, keywords). Per-branch availability. |
| Cart engine | `src/core/cart.ts` | Server-side, deterministic. Identical configs merge; `units` splits a line so "2 meals, one Sprite" and "make one large" map to the right unit. Option names resolve fuzzily server-side (`no mayo`, `large`, `2x fries`). Required options are reported as `missing` so the agent asks. |
| Pricing | `src/core/pricing.ts` | subtotal → promo discount → tax → delivery fee → total. All integers. |
| Promotions | `src/core/promotions.ts` | percent / fixed / free delivery, min order, max discount, product/category/branch/fulfilment scope, per-customer limit, date window. The LLM never decides eligibility. |
| Branch routing | `src/core/branches.ts` | Typed area ("DHA Phase 6") or WhatsApp location pin → nearest open branch in radius → zone fee + ETA. Seeded `areas` table stands in for a geocoder. |
| Orders | `src/core/orders.ts` | Snapshot of items/totals, status machine CONFIRMED → PREPARING → READY → RIDER_ASSIGNED → ON_THE_WAY → DELIVERED (pickup: READY → COLLECTED), CANCELLED. Every transition sends the customer a backend-generated WhatsApp message. |
| Upsell | `src/core/upsell.ts` | Rule table (cart has/lacks category or product, subtotal band) → product + pitch. Offered once per conversation, acceptance tracked for analytics. |
| Analytics | `src/core/analytics.ts` | Orders, WhatsApp/AI orders and revenue, AOV, conversion, abandoned carts, upsell acceptance, popular products, peak hours, channel mix, AI response time, human takeover rate. |
| Agent | `src/agent/` | Claude Opus 5, manual tool-use loop, 21 tools that wrap the engine. Stable prompt block is cached; session state (branch, fulfilment, cart) is injected uncached. Per-conversation queue. Roman-Urdu tolerant. |
| Channels | `src/channels/` | WhatsApp Cloud API webhook (`/webhooks/whatsapp`) + browser simulator (`/api/r/:slug/demo/*`). Outbound routing picks the right transport. |
| Scripted demo | `src/demo/` | Replay engine + per-brand scripts. Placeholders `$line[N]`, `$added[N]`, `$order[N]` resolve to live ids; `{{last.cart.total}}` fills replies from tool results. |
| Presentation | `public/presentation/` | Client-facing pitch page with embedded live stage and the script's talking points. |
| Dashboard | `public/dashboard/` | Overview KPIs and charts, live order board (advance status → customer notified), conversations with human takeover, menu/branch controls (toggle stock-outs live). |

## Presenting to a client

Open http://localhost:3000/presentation/. It has the pitch, an architecture explanation, a **live stage** (simulator + dashboard side by side) and the full demo script with a talking point per step.

Two modes in the simulator:

- **Scripted demo** (default): the customer messages and the agent's replies are pre-written in `src/demo/scripts.ts`, but every tool call runs on the real order engine, so the cart, prices, promo, branch routing and orders are live. Press **▶ Next step** or **Autoplay**. It never depends on a model call, so it cannot fail mid-pitch. Free-typed messages still go to the live AI.
- **Live AI**: everything is generated by Claude. Use it to let the client type their own orders.

The 17-step CrunchBird script covers: per-unit drinks and sizes, two changes in one sentence, backend upsell, address routing with fee/ETA, promo code, itemised confirmation, order placed, status check, reorder-with-edit, sold-out at a branch, pickup flow, a second order, Roman Urdu and human handoff. The Golden Bun script shows a family order with a kids box, dips, a shared location pin and a promo.

## Recording a demo video

```bash
npm run dev                      # in one terminal (or any server on DEMO_BASE_URL)
DEMO_BASE_URL=http://localhost:3000 npm run record                  # KFC, scripted replies, real engine (free)
DEMO_BASE_URL=http://localhost:3000 DEMO_MODE=live npm run record   # live Claude replies (spends API credits)
DEMO_SLUG=goldenbun npm run record                                   # another brand (needs a script in src/demo/scripts.ts)
```

The simulator has a presentation layout for recordings and big screens: `/demo/?present=1&tenant=kfc&phone=923001234567` (large type, no operator controls).

`scripts/record-demo.ts` drives the simulator and dashboard with Playwright at 1920×1080, adds Kodevengers/KFC title and end cards, on-screen captions and a narrated voice-over (macOS `say`, voice via `DEMO_VOICE`, default Daniel; speed via `DEMO_RATE`), and writes `demo-video/demo-<mode>.mp4` with ffmpeg. Scenes and narration live at the top of that file. To use a studio voice instead, drop pre-rendered WAV files as `demo-video/narration/<sceneIndex>.wav` and they are used in place of the synthesised ones.

## Manual demo script (CrunchBird, Live AI mode)

Open the simulator as **Ahmed (returning)** and the dashboard side by side.

1. `Hi` → greeting.
2. `2 spicy chicken burger meals` → agent asks for drinks (the backend reported the missing option).
3. `One Coke one Sprite` → watch the cart panel split into two lines.
4. `Make the Sprite one large` → only that unit changes.
5. `Add 6 hot wings` → then `No mayo on the Coke meal`.
6. `Delivery to House 12, Street 4, DHA Phase 6` → routed to the DHA branch with fee and ETA.
7. `Apply SAVE20` → discount computed and capped by the backend. Try `Apply EID15` to show an expired code being refused.
8. `Yes confirm, cash` → order appears on the dashboard's live board instantly.
9. On the dashboard, click **→ Preparing**, **→ Ready**, **→ Rider assigned**: each step lands as a WhatsApp status message in the simulator.
10. `Same order as last time` → the agent reads Ahmed's past orders and rebuilds the cart.
11. Sold out: in **Menu & branches** mark Zinger Meal sold out at DHA, then order a Zinger Meal to DHA Phase 6 → the agent offers alternatives.
12. Roman Urdu: `2 zinger meal dedo, aik large, dono coke`.
13. **Take over**: from the Conversations tab, take over a chat, reply as staff, then return it to the AI.

Switch the restaurant dropdown to **Golden Bun** for the McDonald's-style menu (meal sizes, nuggets with dips, kids box, family box, breakfast) or **Slice House** for pizza (sizes, crusts, toppings).

## Connecting real WhatsApp

1. In Meta for Developers, create a WhatsApp Business app and note the **phone number id** and a permanent **access token**.
2. Set `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_VERIFY_TOKEN` in `.env`, and put the phone number id on the restaurant (`whatsapp_phone_number_id` column, or `WHATSAPP_PHONE_NUMBER_ID` before the first seed).
3. Expose the server (for example `ngrok http 3000`) and register `https://<host>/webhooks/whatsapp` with the verify token, subscribed to `messages`.
4. Message the number. Text, location pins and button replies are handled.

One restaurant per WhatsApp number; the webhook resolves the tenant from `phone_number_id`.

## Verification

```bash
npm test          # engine + tool-layer tests (no API key needed)
npm run typecheck
npm run eval      # live scripted conversations against the real agent (needs a key)
```

`npm run eval` replays the scenarios from the brief (per-unit drinks and sizes, the six-step correction sequence, family bucket configuration, reorder, Roman Urdu) and asserts on backend state, not on wording.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Claude credentials (an `ant auth login` profile also works) |
| `AGENT_MODEL` | `claude-opus-5` | Model id |
| `AGENT_EFFORT` | `medium` | `low` for fastest replies, `high` for hardest orders |
| `PORT` | `3000` | HTTP port |
| `DATABASE_PATH` | `./data/app.db` | SQLite file |
| `DEMO_TOKEN` | — | If set, `/api/*` requires `?token=` or `x-demo-token` |
| `WHATSAPP_*` | — | Cloud API access token, verify token, Graph version |

## Going to production

- **Database**: every query is behind `src/core/*`; swap SQLite for Postgres without touching the agent.
- **Geocoding**: replace `geocode()` in `src/core/branches.ts` with Google/Mapbox; routing logic stays.
- **POS / KDS**: subscribe to `order.created` on the event bus (`src/core/events.ts`) and push to the chain's ordering API. The status API (`POST /api/r/:slug/orders/:id/advance`) is where POS callbacks land.
- **Payments**: `place_order` accepts `cash | card`; add an `online` method that creates a payment link before confirming.
- **Model behaviour**: the safety `fallbacks` parameter is not enabled (it needs the beta client). Refusals on this workload are essentially nonexistent; add it if the chain's policy requires it.
