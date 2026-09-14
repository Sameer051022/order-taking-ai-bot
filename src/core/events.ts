import { EventEmitter } from "node:events";

export type AppEvent =
  | { type: "order.created"; restaurant_id: string; order_id: string }
  | { type: "order.updated"; restaurant_id: string; order_id: string; status: string }
  | { type: "conversation.message"; restaurant_id: string; conversation_id: string; role: string; text: string }
  | { type: "conversation.updated"; restaurant_id: string; conversation_id: string }
  | { type: "customer.message"; restaurant_id: string; conversation_id: string; customer_key: string; text: string; kind: "reply" | "notification" }
  | { type: "agent.tool"; restaurant_id: string; conversation_id: string; customer_key: string; tool: string; input: unknown; result: unknown; ms: number }
  | { type: "menu.updated"; restaurant_id: string };

class Bus extends EventEmitter {
  publish(e: AppEvent): void {
    this.emit("event", e);
  }
  subscribe(fn: (e: AppEvent) => void): () => void {
    this.on("event", fn);
    return () => this.off("event", fn);
  }
}

export const bus = new Bus();
bus.setMaxListeners(200);
