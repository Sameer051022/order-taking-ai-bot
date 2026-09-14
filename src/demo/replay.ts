/**
 * Scripted demo replay: a deterministic conversation where the customer messages and the
 * assistant replies are pre-written, but every tool call runs against the real order engine.
 * Used for client presentations where a live model call must never be the thing that fails.
 */
import { handleIncomingScripted } from "../agent/agent.js";
import type { Restaurant } from "../core/types.js";

export interface ReplayStep {
  /** What the customer types (or a location pin). */
  say: string | { lat: number; lng: number; name: string };
  /** Tool calls to run, in order. Inputs may contain "$added[N]" (id from the Nth add result), "$line[N]" (Nth cart line id) and "$last" (last changed line id). */
  tools?: { name: string; input?: Record<string, unknown> }[];
  /** Assistant reply. "{{path}}" is resolved against { last, results[] } — e.g. {{last.order_number}} or {{results.0.cart.total}}. */
  reply: string;
  /** Presenter note shown in the presentation page. */
  note?: string;
}

export interface ReplayScript { title: string; phone: string; steps: ReplayStep[] }

export async function runReplayStep(restaurant: Restaurant, script: ReplayScript, index: number, phone?: string) {
  const step = script.steps[index];
  if (!step) throw new Error(`No step ${index}`);
  return handleIncomingScripted({
    restaurant,
    channel: "web",
    customerKey: (phone ?? script.phone).replace(/\D/g, ""),
    text: typeof step.say === "string" ? step.say : undefined,
    location: typeof step.say === "string" ? undefined : step.say,
    tools: step.tools ?? [],
    reply: step.reply,
  });
}
