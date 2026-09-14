/**
 * Records a narrated product demo video.
 *
 *   npm run record                 # scripted mode (deterministic, no model calls)
 *   DEMO_MODE=live npm run record  # live Claude replies
 *
 * Pipeline: Playwright drives the simulator + dashboard and records the screen (webm) ->
 * captions are injected into the page -> narration is synthesised per scene (macOS `say`, or
 * pre-rendered files in demo-video/narration/<index>.wav) -> ffmpeg muxes to demo-video/demo.mp4.
 */
import "dotenv/config";
import { chromium, type Page } from "playwright";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:3055";
const MODE = (process.env.DEMO_MODE ?? "scripted") as "scripted" | "live";
const SLUG = process.env.DEMO_SLUG ?? "kfc";
const PHONE = "923001234567";
const VOICE = process.env.DEMO_VOICE ?? "Daniel";
const RATE = process.env.DEMO_RATE ?? "192";
const VENDOR = { name: "Kodevengers", site: "kodevengers.com", url: "https://kodevengers.com", email: "imran@kodevengers.com" };
const OUT = path.resolve("demo-video");
const WORK = path.join(OUT, "work");
fs.mkdirSync(WORK, { recursive: true });

type Scene =
  | { kind: "intro"; narration: string; hold?: number }
  | { kind: "outro"; narration: string; hold?: number }
  | { kind: "caption"; narration: string; caption?: string; hold?: number }
  | { kind: "say"; text: string; narration: string; caption?: string }
  | { kind: "dashboard"; narration: string; caption?: string; tab: "orders" | "overview"; advance?: number; hold?: number }
  | { kind: "back"; narration: string; caption?: string; hold?: number };

const SCENES: Scene[] = [
  { kind: "intro", narration: "This is the AI Ordering Agent for KFC, a concept built by Kodevengers. An AI employee on WhatsApp that takes a complete order, from the first message to a confirmed ticket in the kitchen.", hold: 1 },
  { kind: "caption", narration: "On the left is the customer's WhatsApp. On the right, what happens behind the scenes: the live cart, the session, and every backend call. The AI only talks. KFC's order engine decides the menu, the prices, the branches and the availability.", caption: "The AI talks. KFC's backend decides." },
  { kind: "say", text: "Hi", narration: "A returning customer says hi, is recognised by phone number, and is offered the menu.", caption: "Customers recognised by phone number" },
  { kind: "say", text: "Show me the menu", narration: "The full KFC menu, straight from the catalogue and formatted for WhatsApp. The customer can also just type what they want.", caption: "Menu on demand, from the live catalogue" },
  { kind: "say", text: "2 Zinger combos", narration: "Two Zinger combos become two structured lines in the cart. The backend reports that the drink is missing, so the agent asks exactly that.", caption: "Natural language becomes a priced cart" },
  { kind: "say", text: "One Pepsi one 7UP", narration: "Two combos, two different drinks. Watch the cart split into two lines.", caption: "Per-unit options: one line becomes two" },
  { kind: "say", text: "Make the 7UP one large", narration: "Only the combo the customer meant is upgraded, and the price comes from the backend.", caption: "Corrections apply to the right item" },
  { kind: "say", text: "Add 10 hot wings, and no mayo on the Pepsi one", narration: "Two changes in one sentence, both mapped correctly, plus one upsell chosen by a backend rule, never invented.", caption: "Upsells come from KFC's rules, not the model" },
  { kind: "say", text: "No thanks. Delivery to House 12, Street 4, DHA Phase 6", narration: "The routing engine picks the nearest open KFC branch and quotes the delivery fee and the estimated time.", caption: "Branch routing, fee and ETA from the backend" },
  { kind: "say", text: "Apply SAVE20", narration: "Promo codes are validated by the backend: minimum order, cap, and one use per customer.", caption: "Promotions decided by the backend" },
  { kind: "say", text: "Cash", narration: "An itemised summary and an explicit yes before anything reaches the kitchen.", caption: "Explicit confirmation before ordering" },
  { kind: "say", text: "Yes", narration: "Order confirmed, with a number and an estimated delivery time.", caption: "Order confirmed" },
  { kind: "dashboard", tab: "orders", advance: 3, narration: "On the KFC dashboard, the order is already on the live board, tagged as an AI order from WhatsApp. As staff move it to preparing, ready, and rider assigned, each step becomes an automatic WhatsApp message.", caption: "Restaurant dashboard: one click per status" },
  { kind: "back", narration: "Back on the customer's phone, every update has arrived automatically.", caption: "Automatic status updates on WhatsApp", hold: 1 },
  { kind: "say", text: "Where's my order?", narration: "Order questions are answered from the live status.", caption: "Order tracking in the same chat" },
  { kind: "say", text: "Order my usual again", narration: "Order history makes repeat orders effortless.", caption: "Repeat a previous order" },
  { kind: "say", text: "Yes but 7UP instead of Pepsi", narration: "The previous order is rebuilt and edited in one go.", caption: "Reorder with changes" },
  { kind: "dashboard", tab: "overview", narration: "And the overview shows what the AI is worth: WhatsApp orders, AI revenue, conversion, upsell acceptance and response time. Everything is measurable.", caption: "Analytics: AI revenue, conversion, upsell acceptance", hold: 4 },
  { kind: "outro", narration: "Natural for the customer. Deterministic for the business. Straight into the kitchen. Built by Kodevengers. Get in touch at imran at kodevengers dot com.", hold: 2 },
];

// ---------------------------------------------------------------------------
// Narration
// ---------------------------------------------------------------------------

function synth(index: number, text: string): { file: string; seconds: number } {
  const pre = path.join(OUT, "narration", `${index}.wav`);
  const file = fs.existsSync(pre) ? pre : path.join(WORK, `n${index}.wav`);
  if (!fs.existsSync(pre)) {
    const aiff = path.join(WORK, `n${index}.aiff`);
    execFileSync("say", ["-v", VOICE, "-r", RATE, "-o", aiff, text]);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", aiff, "-ar", "48000", "-ac", "2", file]);
  }
  const seconds = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim());
  return { file, seconds };
}

// ---------------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------------

const OVERLAY_CSS = `
  #dv-caption { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); max-width: 70%; background: rgba(12,14,18,.86); color: #fff; font: 600 27px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 12px 22px; border-radius: 12px; z-index: 99999; opacity: 0; transition: opacity .35s; letter-spacing: -.01em; box-shadow: 0 10px 30px rgba(0,0,0,.35); }
  #dv-caption.on { opacity: 1; }
  #dv-caption { pointer-events: none; }
  #dv-card { position: fixed; inset: 0; background: radial-gradient(1200px 700px at 30% 20%, #3a0a12, #0b0d12 70%); color: #fff; z-index: 100000; display: flex; flex-direction: column; justify-content: center; padding: 0 12%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; opacity: 0; visibility: hidden; pointer-events: none; transition: opacity .5s, visibility .5s; }
  #dv-card.on { opacity: 1; visibility: visible; }
  #dv-card .eyebrow { color: #ff6b81; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; font-size: 16px; margin-bottom: 18px; }
  #dv-card h1 { font-size: 64px; line-height: 1.08; margin: 0 0 22px; letter-spacing: -.02em; font-weight: 800; }
  #dv-card p { font-size: 26px; color: #b9c0cc; margin: 0; max-width: 900px; line-height: 1.4; }
  #dv-card ul { font-size: 24px; color: #d7dbe3; line-height: 1.7; margin: 26px 0 0; padding-left: 26px; }
  #dv-card .foot { position: absolute; bottom: 40px; left: 12%; color: #8b93a1; font-size: 18px; line-height: 1.6; }
  #dv-card .foot b { color: #fff; }
  #dv-card .brand { display: inline-flex; align-items: center; gap: 14px; margin-bottom: 26px; }
  #dv-card .brand img { width: 84px; height: 84px; border-radius: 18px; }
  #dv-card .brand span { font-size: 22px; color: #b9c0cc; }
  #dv-vendor { position: fixed; right: 26px; bottom: 26px; z-index: 99999; background: rgba(12,14,18,.82); color: #e5e7eb; font: 500 15px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 10px 14px; border-radius: 10px; letter-spacing: .01em; pointer-events: none; }
  #dv-vendor b { color: #fff; font-weight: 700; }
  body.present .vendor { display: none !important; }
  #dv-cursor { position: fixed; width: 18px; height: 18px; border-radius: 50%; background: rgba(42,120,214,.85); border: 2px solid #fff; box-shadow: 0 0 0 6px rgba(42,120,214,.25); z-index: 99998; pointer-events: none; transform: translate(-50%,-50%); transition: left .5s ease, top .5s ease; display: none; }
`;

async function installOverlay(page: Page, zoom: number): Promise<void> {
  await page.addStyleTag({ content: OVERLAY_CSS + `\n body { zoom: ${zoom}; }` });
  await page.evaluate(() => {
    if (!document.getElementById("dv-caption")) {
      const c = document.createElement("div"); c.id = "dv-caption"; document.body.appendChild(c);
      const card = document.createElement("div"); card.id = "dv-card"; document.body.appendChild(card);
      const cur = document.createElement("div"); cur.id = "dv-cursor"; document.body.appendChild(cur);
      const v = document.createElement("div"); v.id = "dv-vendor"; document.body.appendChild(v);
    }
  });
  await page.evaluate((v) => { document.getElementById("dv-vendor")!.innerHTML = `Built by <b>${v.name}</b> · ${v.site} · ${v.email}`; }, VENDOR);
}

async function caption(page: Page, text?: string): Promise<void> {
  await page.evaluate((t) => {
    const c = document.getElementById("dv-caption")!;
    if (!t) { c.classList.remove("on"); return; }
    c.textContent = t; c.classList.add("on");
  }, text ?? "");
}

async function card(page: Page, html: string | null): Promise<void> {
  await page.evaluate((h) => {
    const c = document.getElementById("dv-card")!;
    if (!h) { c.classList.remove("on"); return; }
    c.innerHTML = h; c.classList.add("on");
  }, html);
  await page.waitForTimeout(600);
}

async function pointAt(page: Page, selector: string): Promise<void> {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) return;
  await page.evaluate(({ x, y }) => { const c = document.getElementById("dv-cursor")!; c.style.display = "block"; c.style.left = `${x}px`; c.style.top = `${y}px`; }, { x: (box.x + box.width / 2), y: (box.y + box.height / 2) });
  await page.waitForTimeout(600);
}

async function hideCursor(page: Page): Promise<void> {
  await page.evaluate(() => { document.getElementById("dv-cursor")!.style.display = "none"; });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function openDemo(page: Page): Promise<void> {
  await page.goto(`${BASE}/demo/?present=1&tenant=${SLUG}&phone=${PHONE}`);
  await page.waitForSelector("#chat");
  await page.waitForFunction(() => document.getElementById("waName")!.textContent !== "CrunchBird" || location.search.includes("tenant=crunchbird"));
  await page.waitForTimeout(600);
  await page.evaluate((m) => { const el = document.getElementById("mode") as HTMLSelectElement; el.value = m; el.dispatchEvent(new Event("change")); }, MODE);
  await installOverlay(page, 1.2);
}


async function openDashboard(page: Page, tab: "orders" | "overview"): Promise<void> {
  await page.goto(`${BASE}/dashboard/?tenant=${SLUG}#${tab}`);
  await page.waitForSelector(tab === "orders" ? ".order" : ".kpi", { timeout: 15000 });
  await page.evaluate((slug) => window.postMessage({ type: "demo:tenant", slug }, "*"), SLUG);
  await page.waitForTimeout(1800);
  await page.waitForSelector(tab === "orders" ? ".order" : ".kpi", { timeout: 15000 });
  await installOverlay(page, 1.15);
}

/** Send one customer message and wait for the reply bubble. */
async function customerSays(page: Page, text: string): Promise<void> {
  const before = await page.locator(".bubble.in").count();
  if (MODE === "live") {
    await page.click("#input");
    await page.type("#input", text, { delay: 45 + Math.random() * 30 });
    await page.waitForTimeout(350);
    await page.click("#send");
  } else {
    await page.evaluate(() => window.postMessage({ type: "demo:next" }, "*"));
  }
  await page.waitForFunction((n) => document.querySelectorAll(".bubble.in").length > n && !document.querySelector(".typing"), before, { timeout: 120_000 });
  await page.waitForTimeout(900);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Clean demo state for the returning customer.
  await fetch(`${BASE}/api/r/${SLUG}/demo/reset`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: PHONE }) });

  console.log(`Synthesising narration with voice "${VOICE}"…`);
  const narration = SCENES.map((s, i) => synth(i, s.narration));

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: WORK, size: { width: 1920, height: 1080 } }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const t0 = Date.now();
  const timeline: { index: number; at: number }[] = [];

  await openDemo(page);
  let orderNumber: string | null = null;

  for (const [i, scene] of SCENES.entries()) {
    const start = Date.now();
    timeline.push({ index: i, at: (start - t0) / 1000 });
    const minHold = narration[i].seconds + (("hold" in scene && scene.hold) || 1);
    console.log(`[${((start - t0) / 1000).toFixed(1)}s] scene ${i} (${scene.kind}) narration ${narration[i].seconds.toFixed(1)}s`);

    switch (scene.kind) {
      case "intro":
        await card(page, `<div class="brand"><img src="/brands/kfc.svg" alt="KFC"><span>× ${VENDOR.name}</span></div><div class="eyebrow">Concept for KFC Pakistan</div><h1>AI Ordering Agent<br>on WhatsApp</h1><p>An AI employee that takes a complete KFC order — from first message to confirmed ticket in the kitchen.</p><div class="foot">Built by <b>${VENDOR.name}</b> · ${VENDOR.site} · ${VENDOR.email}</div>`);
        break;
      case "outro":
        await card(page, `<div class="eyebrow">AI Ordering Agent for KFC</div><h1>Natural for the customer.<br>Deterministic for the business.</h1><ul><li>Orders, corrections, deals and promotions in plain language</li><li>Menu, prices, branches and stock always from KFC's backend</li><li>Straight to the live board, POS and kitchen</li><li>Measurable: AI revenue, conversion, upsell acceptance</li></ul><div class="foot">Let's talk — <b>${VENDOR.name}</b><br>${VENDOR.url} · <b>${VENDOR.email}</b></div>`);
        break;
      case "caption":
        await card(page, null);
        await caption(page, scene.caption);
        break;
      case "say":
        await caption(page, scene.caption);
        await customerSays(page, scene.text);
        break;
      case "dashboard": {
        await caption(page);
        await openDashboard(page, scene.tab);
        await caption(page, scene.caption);
        if (scene.tab === "orders" && scene.advance) {
          // The AI order is the newest card in the NEW lane.
          const cardSel = ".col:nth-child(1) .order:has(.tag.ai)";
          await page.waitForSelector(cardSel, { timeout: 10000 });
          orderNumber = await page.locator(`${cardSel} .num`).first().textContent();
          await page.waitForTimeout(1500);
          for (let k = 0; k < scene.advance; k++) {
            const btn = page.locator(`.order:has-text("${orderNumber}") .adv`).first();
            await pointAt(page, `.order:has-text("${orderNumber}") .adv`);
            await btn.click();
            await page.waitForTimeout(350);
            await hideCursor(page);
            await page.waitForTimeout(2300);
          }
          await hideCursor(page);
        }
        break;
      }
      case "back":
        await caption(page);
        await openDemo(page);
        await caption(page, scene.caption);
        await page.evaluate(() => { const c = document.getElementById("chat")!; c.scrollTop = c.scrollHeight; });
        break;
    }
    const elapsed = (Date.now() - start) / 1000;
    if (elapsed < minHold) await sleep((minHold - elapsed) * 1000);
  }
  await sleep(1200);
  const total = (Date.now() - t0) / 1000;
  await context.close();
  await browser.close();

  const webm = fs.readdirSync(WORK).filter((f) => f.endsWith(".webm")).map((f) => path.join(WORK, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
  fs.writeFileSync(path.join(WORK, "timeline.json"), JSON.stringify({ mode: MODE, total, timeline, narration }, null, 2));

  // Mix narration at each scene's offset, then mux with the screen recording.
  const inputs = narration.flatMap((n) => ["-i", n.file]);
  const filters = narration.map((_, i) => `[${i + 1}:a]adelay=${Math.round(timeline[i].at * 1000)}|${Math.round(timeline[i].at * 1000)}[a${i}]`);
  const mix = `${filters.join(";")};${narration.map((_, i) => `[a${i}]`).join("")}amix=inputs=${narration.length}:normalize=0:dropout_transition=0,volume=1.0[aout]`;
  const mp4 = path.join(OUT, `${SLUG}-demo-${MODE}.mp4`);
  console.log("Encoding video…");
  await new Promise<void>((resolve, reject) => {
    const p = spawn("ffmpeg", ["-y", "-loglevel", "error", "-i", webm, ...inputs, "-filter_complex", mix, "-map", "0:v", "-map", "[aout]", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "160k", "-t", String(total + 0.5), "-movflags", "+faststart", mp4], { stdio: "inherit" });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
  });
  console.log(`\nDone: ${mp4} (${total.toFixed(0)}s)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
