import { bus } from "../core/events.js";
import { getCustomer } from "../core/customers.js";
import { getRestaurant } from "../core/menu.js";
import type { Conversation } from "../core/types.js";
import { sendWhatsAppText } from "./whatsapp.js";

/** Deliver a backend- or human-originated message to the customer on whatever channel they used. */
export async function deliverToCustomer(conversation: Conversation, text: string, kind: "reply" | "notification" = "notification"): Promise<void> {
  const customer = getCustomer(conversation.customer_id);
  const restaurant = getRestaurant(conversation.restaurant_id);
  if (!customer || !restaurant) return;
  bus.publish({ type: "customer.message", restaurant_id: restaurant.id, conversation_id: conversation.id, customer_key: customer.external_id, text, kind });
  if (conversation.channel === "whatsapp" && restaurant.whatsapp_phone_number_id) {
    await sendWhatsAppText(restaurant.whatsapp_phone_number_id, customer.external_id, text);
  }
}
