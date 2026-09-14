import { bus } from "../core/events.js";
import { getOrder, statusMessage } from "../core/orders.js";
import { getConversation } from "../agent/conversations.js";
import { recordNotification } from "../agent/agent.js";
import { deliverToCustomer } from "./outbound.js";

/** Turn order status transitions into customer messages. Backend-generated text, never the LLM. */
export function installNotifications(): void {
  bus.subscribe((e) => {
    if (e.type !== "order.updated") return;
    const order = getOrder(e.order_id);
    if (!order?.conversation_id) return;
    const conversation = getConversation(order.conversation_id);
    if (!conversation) return;
    const text = statusMessage(order, order.status);
    recordNotification(conversation.id, text);
    void deliverToCustomer(conversation, text, "notification");
  });
}
