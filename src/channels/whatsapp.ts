import { config } from "../config.js";
import { getRestaurantByPhoneNumberId } from "../core/menu.js";
import { handleIncoming } from "../agent/agent.js";

/** Send a text message through the WhatsApp Cloud API. No-op (logged) when not configured. */
export async function sendWhatsAppText(phoneNumberId: string, to: string, text: string): Promise<void> {
  if (!config.whatsapp.accessToken || phoneNumberId.startsWith("DEMO_")) {
    console.log(`[whatsapp:dry-run] -> ${to}: ${text.replace(/\n/g, " | ")}`);
    return;
  }
  const res = await fetch(`https://graph.facebook.com/${config.whatsapp.graphVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.whatsapp.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text, preview_url: false } }),
  });
  if (!res.ok) console.error(`[whatsapp] send failed ${res.status}: ${await res.text()}`);
}

async function markRead(phoneNumberId: string, messageId: string): Promise<void> {
  if (!config.whatsapp.accessToken || phoneNumberId.startsWith("DEMO_")) return;
  await fetch(`https://graph.facebook.com/${config.whatsapp.graphVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.whatsapp.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId }),
  }).catch(() => undefined);
}

/**
 * Process a Meta webhook payload. Returns immediately-processable work as a promise so the
 * HTTP handler can answer 200 before the AI finishes (Meta retries slow webhooks).
 */
export async function processWebhook(body: any): Promise<void> {
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      const pnid: string | undefined = value?.metadata?.phone_number_id;
      if (!pnid || !value?.messages) continue;
      const restaurant = getRestaurantByPhoneNumberId(pnid);
      if (!restaurant) { console.warn(`[whatsapp] no restaurant mapped to phone_number_id ${pnid}`); continue; }
      const contactName: string | undefined = value.contacts?.[0]?.profile?.name;
      for (const m of value.messages) {
        const from: string = m.from;
        let text: string | undefined;
        let location: { lat: number; lng: number; name?: string; address?: string } | undefined;
        if (m.type === "text") text = m.text?.body;
        else if (m.type === "location") location = { lat: m.location.latitude, lng: m.location.longitude, name: m.location.name, address: m.location.address };
        else if (m.type === "interactive") text = m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title;
        else if (m.type === "button") text = m.button?.text;
        else text = `[Customer sent a ${m.type} message that cannot be read. Ask them to type it.]`;
        if (!text && !location) continue;
        void markRead(pnid, m.id);
        try {
          const result = await handleIncoming({ restaurant, channel: "whatsapp", customerKey: from, text, location, customerName: contactName ?? null });
          for (const reply of result.replies) await sendWhatsAppText(pnid, from, reply);
        } catch (e) {
          console.error("[whatsapp] failed to handle message", e);
        }
      }
    }
  }
}
