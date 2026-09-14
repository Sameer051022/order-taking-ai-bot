import { getDb, json, newId, nowIso } from "../db/index.js";
import { findProduct, getProduct, isAvailableAtBranch } from "./menu.js";
import { matchScore } from "./text.js";
import {
  DomainError,
  type Cart,
  type CartLine,
  type LineIssue,
  type ModifierGroup,
  type PricedLine,
  type PricedSelection,
  type ProductWithOptions,
  type SelectionInput,
  type Selections,
} from "./types.js";

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

function rowToLine(r: any): CartLine {
  return { ...r, selections: json<Selections>(r.selections, {}) };
}

export function createCart(restaurantId: string, conversationId?: string, customerId?: string): Cart {
  const cart: Cart = {
    id: newId("CRT"),
    restaurant_id: restaurantId,
    conversation_id: conversationId ?? null,
    customer_id: customerId ?? null,
    promo_code: null,
    status: "open",
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  getDb()
    .prepare(
      "INSERT INTO carts (id, restaurant_id, conversation_id, customer_id, promo_code, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)",
    )
    .run(cart.id, cart.restaurant_id, cart.conversation_id, cart.customer_id, null, "open", cart.created_at, cart.updated_at);
  return cart;
}

export function getCart(cartId: string): Cart {
  const row = getDb().prepare("SELECT * FROM carts WHERE id = ?").get(cartId) as Cart | undefined;
  if (!row) throw new DomainError(`Cart ${cartId} not found`, "CART_NOT_FOUND");
  return row;
}

export function getLines(cartId: string): CartLine[] {
  return (getDb().prepare("SELECT * FROM cart_items WHERE cart_id = ? ORDER BY line_no").all(cartId) as any[]).map(rowToLine);
}

function touch(cartId: string): void {
  getDb().prepare("UPDATE carts SET updated_at = ? WHERE id = ?").run(nowIso(), cartId);
}

export function setCartPromo(cartId: string, code: string | null): void {
  getDb().prepare("UPDATE carts SET promo_code = ?, updated_at = ? WHERE id = ?").run(code, nowIso(), cartId);
}

export function setCartStatus(cartId: string, status: Cart["status"]): void {
  getDb().prepare("UPDATE carts SET status = ?, updated_at = ? WHERE id = ?").run(status, nowIso(), cartId);
}

function nextLineNo(cartId: string): number {
  const r = getDb().prepare("SELECT COALESCE(MAX(line_no), 0) AS n FROM cart_items WHERE cart_id = ?").get(cartId) as { n: number };
  return r.n + 1;
}

function insertLine(cartId: string, productId: string, quantity: number, selections: Selections, notes: string | null): CartLine {
  const line: CartLine = { id: newId("LN"), cart_id: cartId, product_id: productId, quantity, selections, notes, line_no: nextLineNo(cartId) };
  getDb()
    .prepare("INSERT INTO cart_items (id, cart_id, product_id, quantity, selections, notes, line_no) VALUES (?,?,?,?,?,?,?)")
    .run(line.id, cartId, productId, quantity, JSON.stringify(canonical(selections)), notes, line.line_no);
  return line;
}

function saveLine(line: CartLine): void {
  getDb()
    .prepare("UPDATE cart_items SET quantity = ?, selections = ?, notes = ? WHERE id = ?")
    .run(line.quantity, JSON.stringify(canonical(line.selections)), line.notes, line.id);
}

function deleteLine(lineId: string): void {
  getDb().prepare("DELETE FROM cart_items WHERE id = ?").run(lineId);
}

/** Deterministic ordering so identical configurations compare equal. */
export function canonical(sel: Selections): Selections {
  const out: Selections = {};
  for (const g of Object.keys(sel).sort()) {
    const entries = sel[g].filter((e) => e.quantity > 0).map((e) => ({ modifier_id: e.modifier_id, quantity: e.quantity }));
    if (entries.length === 0) continue;
    out[g] = entries.sort((a, b) => a.modifier_id.localeCompare(b.modifier_id));
  }
  return out;
}

function configKey(productId: string, sel: Selections, notes: string | null): string {
  return `${productId}|${JSON.stringify(canonical(sel))}|${(notes ?? "").trim().toLowerCase()}`;
}

/** Merge lines that have the same configuration. Returns the surviving line for `preferId` if given. */
function mergeDuplicates(cartId: string, preferId?: string): CartLine | undefined {
  const lines = getLines(cartId);
  const seen = new Map<string, CartLine>();
  let survivor: CartLine | undefined;
  for (const line of lines) {
    const key = configKey(line.product_id, line.selections, line.notes);
    const existing = seen.get(key);
    if (existing) {
      existing.quantity += line.quantity;
      saveLine(existing);
      deleteLine(line.id);
      if (line.id === preferId) survivor = existing;
    } else {
      seen.set(key, line);
      if (line.id === preferId) survivor = line;
    }
  }
  return survivor;
}

// ---------------------------------------------------------------------------
// Modifier resolution
// ---------------------------------------------------------------------------

function findGroup(product: ProductWithOptions, ref: string): ModifierGroup | undefined {
  const byId = product.groups.find((g) => g.id === ref);
  if (byId) return byId;
  const ranked = product.groups
    .map((g) => ({ g, score: matchScore(ref, g.name) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.g;
}

interface ModMatch {
  group: ModifierGroup;
  modifier: ModifierGroup["modifiers"][number];
  score: number;
}

function findModifier(product: ProductWithOptions, ref: string, group?: ModifierGroup): ModMatch {
  const groups = group ? [group] : product.groups;
  const matches: ModMatch[] = [];
  for (const g of groups) {
    for (const m of g.modifiers) {
      if (m.id === ref) return { group: g, modifier: m, score: 100 };
      const score = matchScore(ref, m.name, m.keywords);
      if (score > 0) matches.push({ group: g, modifier: m, score });
    }
  }
  matches.sort((a, b) => b.score - a.score);
  const best = matches[0];
  if (!best || best.score < 50) {
    const available = groups.flatMap((g) => g.modifiers.map((m) => `${m.name} (${g.name})`));
    throw new DomainError(
      `"${ref}" is not an option for ${product.name}. Available options: ${available.join(", ")}`,
      "UNKNOWN_MODIFIER",
    );
  }
  const second = matches[1];
  if (second && second.score === best.score && second.modifier.id !== best.modifier.id && second.modifier.name.toLowerCase() !== best.modifier.name.toLowerCase()) {
    throw new DomainError(
      `"${ref}" is ambiguous for ${product.name}: could be ${best.modifier.name} (${best.group.name}) or ${second.modifier.name} (${second.group.name}). Ask the customer which one.`,
      "AMBIGUOUS_MODIFIER",
    );
  }
  return best;
}

function setGroupSelection(sel: Selections, group: ModifierGroup, entries: { modifier_id: string; quantity: number }[]): void {
  const merged = new Map<string, number>();
  for (const e of entries) merged.set(e.modifier_id, (merged.get(e.modifier_id) ?? 0) + e.quantity);
  sel[group.id] = [...merged.entries()].map(([modifier_id, quantity]) => ({ modifier_id, quantity }));
}

/** Add a modifier to a selection set, respecting single-select groups (replace) and multi-select (append). */
function addModifierToSelection(sel: Selections, match: ModMatch, quantity = 1): void {
  const { group, modifier } = match;
  const current = sel[group.id] ?? [];
  if (group.max_select <= 1) {
    sel[group.id] = [{ modifier_id: modifier.id, quantity: 1 }];
    return;
  }
  const existing = current.find((e) => e.modifier_id === modifier.id);
  if (existing) {
    if (group.allow_repeat) existing.quantity += quantity;
    // non-repeatable multi-select: already selected, no-op
  } else {
    current.push({ modifier_id: modifier.id, quantity: group.allow_repeat ? quantity : 1 });
  }
  sel[group.id] = current;
}

function removeModifierFromSelection(sel: Selections, match: ModMatch): void {
  const current = sel[match.group.id] ?? [];
  sel[match.group.id] = current.filter((e) => e.modifier_id !== match.modifier.id);
  if (sel[match.group.id].length === 0) delete sel[match.group.id];
}

/**
 * Build a Selections object from agent input.
 *  - `selections`: {group: modifier | [modifiers] | [{modifier, quantity}] | null} — replaces the mentioned groups
 *  - `add_modifiers`: flat list of modifier names/ids, resolved across all groups
 *  - `remove_modifiers`: flat list of modifier names/ids to remove
 */
export function resolveSelections(
  product: ProductWithOptions,
  input: { selections?: SelectionInput | null; add_modifiers?: string[] | null; remove_modifiers?: string[] | null },
  base: Selections = {},
): Selections {
  const sel: Selections = JSON.parse(JSON.stringify(base));

  for (const [groupRef, value] of Object.entries(input.selections ?? {})) {
    const group = findGroup(product, groupRef);
    if (!group) {
      // Key is not a group; treat the value as a modifier reference across groups.
      const refs = value == null ? [] : Array.isArray(value) ? value : [value];
      for (const r of refs) {
        const ref = typeof r === "string" ? r : r.modifier;
        addModifierToSelection(sel, findModifier(product, ref), typeof r === "string" ? 1 : r.quantity ?? 1);
      }
      continue;
    }
    if (value == null) {
      delete sel[group.id];
      continue;
    }
    const refs = Array.isArray(value) ? value : [value];
    const entries = refs.map((r) => {
      const ref = typeof r === "string" ? r : r.modifier;
      const quantity = typeof r === "string" ? 1 : r.quantity ?? 1;
      const m = findModifier(product, ref, group);
      return { modifier_id: m.modifier.id, quantity };
    });
    setGroupSelection(sel, group, entries);
  }

  for (const ref of input.add_modifiers ?? []) {
    // Support "2x Fries" / "Fries x2" quantity prefixes for deals.
    const qm = /^(\d+)\s*[x×]\s*(.+)$/i.exec(ref) ?? /^(.+?)\s*[x×]\s*(\d+)$/i.exec(ref);
    let quantity = 1;
    let name = ref;
    if (qm) {
      const a = qm[1], b = qm[2];
      if (/^\d+$/.test(a)) { quantity = Number(a); name = b; } else { quantity = Number(b); name = a; }
    }
    addModifierToSelection(sel, findModifier(product, name), quantity);
  }
  for (const ref of input.remove_modifiers ?? []) {
    removeModifierFromSelection(sel, findModifier(product, ref));
  }

  // Defaults for groups the customer did not specify.
  for (const g of product.groups) {
    if (sel[g.id]?.length) continue;
    const def = g.modifiers.find((m) => m.is_default);
    if (def) sel[g.id] = [{ modifier_id: def.id, quantity: 1 }];
  }
  return canonical(sel);
}

// ---------------------------------------------------------------------------
// Line validation and pricing
// ---------------------------------------------------------------------------

export function priceLine(line: CartLine, branchId: string | null): PricedLine {
  const product = getProduct(line.product_id);
  if (!product) {
    return {
      id: line.id, product_id: line.product_id, product_name: "(removed product)", product_type: "item", quantity: line.quantity,
      unit_price: 0, line_total: 0, selections: [], notes: line.notes, summary: "", issues: [{ type: "invalid", message: "Product no longer exists" }],
    };
  }
  const issues: LineIssue[] = [];
  const priced: PricedSelection[] = [];
  let unit = product.base_price;

  for (const g of product.groups) {
    const entries = line.selections[g.id] ?? [];
    let count = 0;
    for (const e of entries) {
      const m = g.modifiers.find((x) => x.id === e.modifier_id);
      if (!m) { issues.push({ type: "invalid", group_id: g.id, group_name: g.name, message: `Unknown option in ${g.name}` }); continue; }
      count += e.quantity;
      unit += m.price_delta * e.quantity;
      priced.push({ group_id: g.id, group_name: g.name, modifier_id: m.id, modifier_name: m.name, quantity: e.quantity, price_delta: m.price_delta });
    }
    if (count < g.min_select) {
      issues.push({
        type: "missing_selection", group_id: g.id, group_name: g.name, min: g.min_select, max: g.max_select,
        message: g.min_select === g.max_select && g.min_select > 1
          ? `Choose ${g.min_select - count} more for ${g.name}`
          : `${g.name} is required`,
        options: g.modifiers.map((m) => ({ modifier_id: m.id, name: m.name, price_delta: m.price_delta })),
      });
    } else if (count > g.max_select) {
      issues.push({ type: "too_many", group_id: g.id, group_name: g.name, min: g.min_select, max: g.max_select, message: `${g.name} allows at most ${g.max_select}` });
    }
  }
  if (!product.is_active) issues.push({ type: "unavailable", message: `${product.name} is not on the menu right now` });
  else if (!isAvailableAtBranch(product.id, branchId)) issues.push({ type: "unavailable", message: `${product.name} is sold out at the selected branch` });

  const summaryParts = priced.map((p) => (p.quantity > 1 ? `${p.quantity}× ${p.modifier_name}` : p.modifier_name));
  return {
    id: line.id,
    product_id: product.id,
    product_name: product.name,
    product_type: product.type,
    quantity: line.quantity,
    unit_price: unit,
    line_total: unit * line.quantity,
    selections: priced,
    notes: line.notes,
    summary: summaryParts.join(" / ") + (line.notes ? ` (note: ${line.notes})` : ""),
    issues,
  };
}

export function pricedLines(cartId: string, branchId: string | null): PricedLine[] {
  return getLines(cartId).map((l) => priceLine(l, branchId));
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export interface AddItemInput {
  product: string; // id or name
  quantity?: number;
  selections?: SelectionInput | null;
  modifiers?: string[] | null;
  notes?: string | null;
}

export function addItem(cartId: string, input: AddItemInput): CartLine {
  const cart = getCart(cartId);
  const { product: found, candidates } = findProduct(cart.restaurant_id, input.product);
  if (!found) {
    if (candidates.length) {
      throw new DomainError(
        `"${input.product}" could match several items: ${candidates.map((c) => `${c.name} [${c.id}]`).join(", ")}. Ask the customer which one, or use search_menu.`,
        "AMBIGUOUS_PRODUCT",
        { candidates: candidates.map((c) => ({ id: c.id, name: c.name, price: c.base_price })) },
      );
    }
    throw new DomainError(`"${input.product}" is not on the menu. Use search_menu to find the right item.`, "UNKNOWN_PRODUCT");
  }
  const product = getProduct(found.id)!;
  if (!product.is_active) throw new DomainError(`${product.name} is not available right now.`, "UNAVAILABLE");
  const quantity = Math.max(1, Math.floor(input.quantity ?? 1));
  const selections = resolveSelections(product, { selections: input.selections, add_modifiers: input.modifiers });
  const notes = input.notes?.trim() || null;

  const key = configKey(product.id, selections, notes);
  const existing = getLines(cartId).find((l) => configKey(l.product_id, l.selections, l.notes) === key);
  let line: CartLine;
  if (existing) {
    existing.quantity += quantity;
    saveLine(existing);
    line = existing;
  } else {
    line = insertLine(cartId, product.id, quantity, selections, notes);
  }
  touch(cartId);
  return line;
}

export interface UpdateItemInput {
  item: string | number; // line id or line number
  quantity?: number | null;
  units?: number | null; // how many units of the line to change (default: all)
  selections?: SelectionInput | null;
  add_modifiers?: string[] | null;
  remove_modifiers?: string[] | null;
  notes?: string | null;
}

export function findLine(cartId: string, ref: string | number): CartLine {
  const lines = getLines(cartId);
  const asNumber = typeof ref === "number" ? ref : /^\d+$/.test(String(ref)) ? Number(ref) : NaN;
  const line = lines.find((l) => l.id === ref) ?? (Number.isFinite(asNumber) ? lines.find((l) => l.line_no === asNumber) : undefined);
  if (!line) {
    throw new DomainError(
      `No cart line "${ref}". Current lines: ${lines.map((l) => `${l.id} (#${l.line_no})`).join(", ") || "none"}. Call get_cart to see item ids.`,
      "LINE_NOT_FOUND",
    );
  }
  return line;
}

export function updateItem(cartId: string, input: UpdateItemInput): CartLine {
  const original = findLine(cartId, input.item);
  const product = getProduct(original.product_id);
  if (!product) throw new DomainError("Product no longer exists", "UNAVAILABLE");

  const hasConfigChange = input.selections != null || input.add_modifiers?.length || input.remove_modifiers?.length || input.notes !== undefined;
  const units = input.units && input.units > 0 && input.units < original.quantity ? Math.floor(input.units) : original.quantity;

  let target: CartLine;
  if (units < original.quantity && hasConfigChange) {
    // Split: the changed units become their own line.
    original.quantity -= units;
    saveLine(original);
    target = insertLine(cartId, original.product_id, units, original.selections, original.notes);
  } else {
    target = original;
  }

  if (hasConfigChange) {
    target.selections = resolveSelections(
      product,
      { selections: input.selections, add_modifiers: input.add_modifiers, remove_modifiers: input.remove_modifiers },
      target.selections,
    );
    if (input.notes !== undefined) target.notes = input.notes?.trim() || null;
  }

  if (input.quantity != null) {
    const q = Math.floor(input.quantity);
    if (q <= 0) {
      deleteLine(target.id);
      touch(cartId);
      mergeDuplicates(cartId);
      return { ...target, quantity: 0 };
    }
    target.quantity = q;
  }
  saveLine(target);
  touch(cartId);
  return mergeDuplicates(cartId, target.id) ?? target;
}

export function removeItem(cartId: string, ref: string | number, units?: number | null): CartLine {
  const line = findLine(cartId, ref);
  if (units && units > 0 && units < line.quantity) {
    line.quantity -= Math.floor(units);
    saveLine(line);
  } else {
    deleteLine(line.id);
    line.quantity = 0;
  }
  touch(cartId);
  return line;
}

export function clearCart(cartId: string): void {
  getDb().prepare("DELETE FROM cart_items WHERE cart_id = ?").run(cartId);
  setCartPromo(cartId, null);
  touch(cartId);
}

/** Copy the lines of a previous order into a cart (used by reorder). Returns products that could not be re-added. */
export function addLinesFromSnapshot(cartId: string, items: PricedLine[]): { added: number; skipped: string[] } {
  const skipped: string[] = [];
  let added = 0;
  for (const it of items) {
    const product = getProduct(it.product_id);
    if (!product || !product.is_active) { skipped.push(it.product_name); continue; }
    const selections: Selections = {};
    for (const s of it.selections) {
      const g = product.groups.find((x) => x.id === s.group_id);
      const m = g?.modifiers.find((x) => x.id === s.modifier_id);
      if (!g || !m) continue;
      (selections[g.id] ??= []).push({ modifier_id: m.id, quantity: s.quantity });
    }
    insertLine(cartId, product.id, it.quantity, resolveSelections(product, {}, selections), it.notes);
    added++;
  }
  mergeDuplicates(cartId);
  touch(cartId);
  return { added, skipped };
}
