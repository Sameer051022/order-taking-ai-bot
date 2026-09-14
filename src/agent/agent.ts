import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { bus } from "../core/events.js";
import { getOrCreateCustomer } from "../core/customers.js";
import { listOrders } from "../core/orders.js";
import type { Conversation, Restaurant } from "../core/types.js";
import { DomainError } from "../core/types.js";
import { appendMessage, buildHistory, getConversation, getOrCreateConversation } from "./conversations.js";
import { buildSystem } from "./prompt.js";
import { currentCart, executeTool, TOOLS, type ToolContext } from "./tools.js";

const client = new Anthropic();
const MAX_ITERATIONS = 12;

export interface IncomingMessage {
  restaurant: Restaurant;
  channel: "whatsapp" | "web";
  customerKey: string; // phone number in international format without '+'
  text?: string;
  location?: { lat: number; lng: number; name?: string; address?: string };
  customerName?: string | null;
}

export interface ToolTrace { tool: string; input: unknown; result: unknown; ms: number }

export interface AgentResult {
  conversation: Conversation;
  replies: string[];
  tools: ToolTrace[];
  latency_ms: number;
  handled_by_ai: boolean;
}

// One in-flight turn per conversation; later messages queue behind it.
const locks = new Map<string, Promise<unknown>>();
async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  locks.set(key, next);
  try {
    return await next;
  } finally {
    if (locks.get(key) === next) locks.delete(key);
  }
}

export async function handleIncoming(msg: IncomingMessage): Promise<AgentResult> {
  const customer = getOrCreateCustomer(msg.restaurant.id, "whatsapp", msg.customerKey, msg.customerName ?? null);
  const conversation = getOrCreateConversation(msg.restaurant.id, customer.id, msg.channel);
  return withLock(conversation.id, () => runTurn(msg, conversation.id));
}

function userText(msg: IncomingMessage): { text: string; display: string } {
  if (msg.location) {
    const label = msg.location.name || msg.location.address ? ` (${[msg.location.name, msg.location.address].filter(Boolean).join(", ")})` : "";
    return {
      text: `[Customer shared a WhatsApp location pin: lat ${msg.location.lat}, lng ${msg.location.lng}${label}]${msg.text ? `\n${msg.text}` : ""}`,
      display: `📍 Shared location${label}`,
    };
  }
  return { text: msg.text ?? "", display: msg.text ?? "" };
}

async function runTurn(msg: IncomingMessage, conversationId: string): Promise<AgentResult> {
  const started = Date.now();
  const restaurant = msg.restaurant;
  let conversation = getConversation(conversationId)!;
  const customer = getOrCreateCustomer(restaurant.id, "whatsapp", msg.customerKey, msg.customerName ?? null);
  const { text, display } = userText(msg);

  appendMessage(conversation.id, "user", [{ type: "text", text }], display);
  bus.publish({ type: "conversation.message", restaurant_id: restaurant.id, conversation_id: conversation.id, role: "user", text: display });

  if (conversation.status === "human") {
    return { conversation, replies: [], tools: [], latency_ms: 0, handled_by_ai: false };
  }

  const ctx: ToolContext = { restaurant, conversation, customer };
  const tools: ToolTrace[] = [];
  const messages: Anthropic.MessageParam[] = buildHistory(conversation.id);
  let finalText = "";

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const cart = safeCart(ctx);
      const response = await client.messages.create({
        model: config.claudeModel,
        max_tokens: 2048,
        system: buildSystem(restaurant, ctx.conversation, ctx.customer, cart),
        tools: TOOLS,
        messages,
        output_config: { effort: config.claudeEffort },
      });

      const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text.trim()).filter(Boolean);
      const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "tool_use" && toolUses.length) {
        appendMessage(conversation.id, "assistant", response.content, null);
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const tu of toolUses) {
          const t0 = Date.now();
          let result: unknown;
          let isError = false;
          try {
            result = await executeTool(tu.name, tu.input, ctx);
            if (result && typeof result === "object" && "error" in (result as any)) isError = true;
          } catch (e) {
            isError = true;
            result = { error: e instanceof DomainError ? e.message : `Tool failed: ${(e as Error).message}` };
            if (!(e instanceof DomainError)) console.error(`[agent] tool ${tu.name} crashed`, e);
          }
          const ms = Date.now() - t0;
          tools.push({ tool: tu.name, input: tu.input, result, ms });
          bus.publish({ type: "agent.tool", restaurant_id: restaurant.id, conversation_id: conversation.id, customer_key: msg.customerKey, tool: tu.name, input: tu.input, result, ms });
          results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result), is_error: isError || undefined });
        }
        messages.push({ role: "user", content: results });
        appendMessage(conversation.id, "user", results, null);
        continue;
      }

      finalText = textBlocks.join("\n\n");
      if (response.stop_reason === "refusal" || (!finalText && response.stop_reason !== "end_turn")) {
        finalText = finalText || "Sorry, I could not process that. Could you say it another way?";
      }
      appendMessage(conversation.id, "assistant", response.content, finalText, Date.now() - started);
      break;
    }
    if (!finalText) {
      finalText = "Sorry, that took too many steps. Could you tell me again what you would like?";
      appendMessage(conversation.id, "assistant", [{ type: "text", text: finalText }], finalText, Date.now() - started);
    }
  } catch (e) {
    console.error("[agent] Claude call failed", e);
    const noCreds = e instanceof Anthropic.AuthenticationError || /authentication method|api key/i.test((e as Error).message ?? "");
    finalText = noCreds
      ? "The AI agent is not configured yet (missing ANTHROPIC_API_KEY)."
      : e instanceof Anthropic.RateLimitError
        ? "We are a bit busy right now. Please try again in a moment."
        : "Sorry, something went wrong on our side. Please try again.";
    appendMessage(conversation.id, "assistant", [{ type: "text", text: finalText }], finalText, Date.now() - started);
  }

  conversation = getConversation(conversation.id)!;
  bus.publish({ type: "conversation.message", restaurant_id: restaurant.id, conversation_id: conversation.id, role: "assistant", text: finalText });
  return { conversation, replies: [finalText], tools, latency_ms: Date.now() - started, handled_by_ai: true };
}

function safeCart(ctx: ToolContext) {
  try {
    return currentCart(ctx);
  } catch {
    return null;
  }
}

/** Record a message written by a human operator (dashboard takeover). */
export function recordHumanReply(conversationId: string, text: string): Conversation {
  appendMessage(conversationId, "assistant", [{ type: "text", text }], text);
  const c = getConversation(conversationId)!;
  bus.publish({ type: "conversation.message", restaurant_id: c.restaurant_id, conversation_id: c.id, role: "assistant", text });
  return c;
}

/** Record a backend-generated notification (order status) into the transcript. */
export function recordNotification(conversationId: string, text: string): void {
  appendMessage(conversationId, "assistant", [{ type: "text", text }], text);
}

// ---------------------------------------------------------------------------
// Scripted mode: pre-written customer/assistant text, real tool execution.
// ---------------------------------------------------------------------------

export interface ScriptedTurn extends IncomingMessage {
  tools: { name: string; input?: Record<string, unknown> }[];
  reply: string;
}

function substitute(value: unknown, vars: Record<string, string>): unknown {
  if (typeof value === "string") {
    const out = value.replace(/\$(added|line|order)\[(\d+)\]|\$last/g, (m, kind, n) => (m === "$last" ? vars.last : vars[`${kind}${n}`]) ?? m);
    return /^\d+$/.test(out) && value.startsWith("$order") ? Number(out) : out;
  }
  if (Array.isArray(value)) return value.map((v) => substitute(v, vars));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, substitute(v, vars)]));
  return value;
}

function resolvePath(obj: unknown, path: string): string {
  const keys = path.split(".");
  const v = keys.reduce<any>((o, k) => (o == null ? undefined : o[k]), obj);
  const isMoney = /total|subtotal|discount|tax|fee|price/i.test(keys[keys.length - 1] ?? "");
  return v == null ? "" : typeof v === "number" && isMoney ? v.toLocaleString("en-PK") : String(v);
}

export async function handleIncomingScripted(msg: ScriptedTurn): Promise<AgentResult> {
  const customer = getOrCreateCustomer(msg.restaurant.id, "whatsapp", msg.customerKey, msg.customerName ?? null);
  const conversation0 = getOrCreateConversation(msg.restaurant.id, customer.id, msg.channel);
  return withLock(conversation0.id, async () => {
    const started = Date.now();
    const conversation = getConversation(conversation0.id)!;
    const { text, display } = userText(msg);
    appendMessage(conversation.id, "user", [{ type: "text", text }], display);
    bus.publish({ type: "conversation.message", restaurant_id: msg.restaurant.id, conversation_id: conversation.id, role: "user", text: display });

    const ctx: ToolContext = { restaurant: msg.restaurant, conversation, customer };
    const traces: ToolTrace[] = [];
    const results: unknown[] = [];
    const vars: Record<string, string> = {};
    listOrders(msg.restaurant.id, { customer_id: customer.id, limit: 10 }).forEach((o, n) => (vars[`order${n}`] = String(o.order_number)));
    let addCount = 0;
    const content: Anthropic.ContentBlockParam[] = [];
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const [i, t] of msg.tools.entries()) {
      const cart = safeCart(ctx);
      cart?.lines.forEach((l, n) => (vars[`line${n}`] = l.id));
      const input = substitute(t.input ?? {}, vars) as Record<string, unknown>;
      const t0 = Date.now();
      let result: unknown;
      try {
        result = await executeTool(t.name, input, ctx);
      } catch (e) {
        result = { error: e instanceof DomainError ? e.message : (e as Error).message };
      }
      const r = result as any;
      if (r?.added?.id) { vars[`added${addCount++}`] = r.added.id; vars.last = r.added.id; }
      if (r?.updated?.id) vars.last = r.updated.id;
      results.push(result);
      const id = `scripted_${Date.now()}_${i}`;
      content.push({ type: "tool_use", id, name: t.name, input });
      toolResults.push({ type: "tool_result", tool_use_id: id, content: JSON.stringify(result) });
      traces.push({ tool: t.name, input, result, ms: Date.now() - t0 });
      bus.publish({ type: "agent.tool", restaurant_id: msg.restaurant.id, conversation_id: conversation.id, customer_key: msg.customerKey, tool: t.name, input, result, ms: Date.now() - t0 });
    }
    if (content.length) {
      appendMessage(conversation.id, "assistant", content, null);
      appendMessage(conversation.id, "user", toolResults, null);
    }
    const menuResult = results.find((r: any) => r && Array.isArray(r.categories)) as { categories: { name: string; items: string[] }[] } | undefined;
    const menuText = menuResult ? menuResult.categories.map((c) => `*${c.name}*\n${c.items.map((i) => `• ${i}`).join("\n")}`).join("\n\n") : "";
    const reply = msg.reply.replace(/\{\{menu\}\}/g, menuText).replace(/\{\{([^}]+)\}\}/g, (_, p) => resolvePath({ last: results[results.length - 1], results }, p.trim()));
    appendMessage(conversation.id, "assistant", [{ type: "text", text: reply }], reply, Date.now() - started);
    const updated = getConversation(conversation.id)!;
    bus.publish({ type: "conversation.message", restaurant_id: msg.restaurant.id, conversation_id: conversation.id, role: "assistant", text: reply });
    return { conversation: updated, replies: [reply], tools: traces, latency_ms: Date.now() - started, handled_by_ai: true };
  });
}
