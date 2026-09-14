import { getDb, json } from "../db/index.js";
import type { Category, ModifierGroup, Modifier, Product, ProductWithOptions, Restaurant } from "./types.js";
import { matchScore } from "./text.js";

function rowToProduct(r: any): Product {
  return { ...r, keywords: json<string[]>(r.keywords, []), tags: json<string[]>(r.tags, []) };
}

export function getRestaurant(id: string): Restaurant | undefined {
  return getDb().prepare("SELECT * FROM restaurants WHERE id = ?").get(id) as Restaurant | undefined;
}

export function getRestaurantBySlug(slug: string): Restaurant | undefined {
  return getDb().prepare("SELECT * FROM restaurants WHERE slug = ?").get(slug) as Restaurant | undefined;
}

export function getRestaurantByPhoneNumberId(pnid: string): Restaurant | undefined {
  return getDb().prepare("SELECT * FROM restaurants WHERE whatsapp_phone_number_id = ?").get(pnid) as Restaurant | undefined;
}

export function listRestaurants(): Restaurant[] {
  return getDb().prepare("SELECT * FROM restaurants ORDER BY created_at, name").all() as Restaurant[];
}

export function listCategories(restaurantId: string): Category[] {
  return getDb().prepare("SELECT * FROM categories WHERE restaurant_id = ? ORDER BY sort_order").all(restaurantId) as Category[];
}

export function listProducts(restaurantId: string, opts: { activeOnly?: boolean } = {}): Product[] {
  const rows = getDb()
    .prepare(
      `SELECT p.*, c.name AS category_name FROM products p JOIN categories c ON c.id = p.category_id
       WHERE p.restaurant_id = ? ${opts.activeOnly === false ? "" : "AND p.is_active = 1"}
       ORDER BY c.sort_order, p.sort_order`,
    )
    .all(restaurantId);
  return rows.map(rowToProduct);
}

export function getProduct(productId: string): ProductWithOptions | undefined {
  const db = getDb();
  const row = db
    .prepare("SELECT p.*, c.name AS category_name FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?")
    .get(productId);
  if (!row) return undefined;
  const groups = db
    .prepare("SELECT * FROM modifier_groups WHERE product_id = ? ORDER BY sort_order")
    .all(productId) as ModifierGroup[];
  const modStmt = db.prepare("SELECT * FROM modifiers WHERE group_id = ? ORDER BY sort_order");
  for (const g of groups) {
    g.modifiers = (modStmt.all(g.id) as any[]).map((m) => ({ ...m, keywords: json<string[]>(m.keywords, []) })) as Modifier[];
  }
  return { ...rowToProduct(row), groups };
}

/** Resolve a product from an id or a fuzzy name within a restaurant. */
export function findProduct(restaurantId: string, ref: string): { product?: Product; candidates: Product[] } {
  const byId = getDb().prepare("SELECT p.*, c.name AS category_name FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ? AND p.restaurant_id = ?").get(ref, restaurantId);
  if (byId) return { product: rowToProduct(byId), candidates: [] };
  const ranked = searchProducts(restaurantId, ref);
  if (ranked.length === 0) return { candidates: [] };
  const [best, second] = ranked;
  if (best.score >= 70 && (!second || second.score < best.score - 15)) return { product: best.product, candidates: ranked.map((r) => r.product) };
  return { candidates: ranked.slice(0, 5).map((r) => r.product) };
}

export function searchProducts(restaurantId: string, query: string, category?: string): { product: Product; score: number }[] {
  let products = listProducts(restaurantId);
  if (category) {
    const c = category.toLowerCase();
    products = products.filter((p) => p.category_name?.toLowerCase().includes(c));
  }
  if (!query.trim()) return products.map((product) => ({ product, score: 1 }));
  const ranked = products
    .map((product) => ({ product, score: matchScore(query, product.name, [...product.keywords, product.category_name ?? ""]) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.product.sort_order - b.product.sort_order);
  return ranked;
}

export function isAvailableAtBranch(productId: string, branchId: string | null): boolean {
  if (!branchId) return true;
  const row = getDb()
    .prepare("SELECT is_available FROM branch_product_availability WHERE branch_id = ? AND product_id = ?")
    .get(branchId, productId) as { is_available: number } | undefined;
  return row ? row.is_available === 1 : true;
}

export function setBranchAvailability(branchId: string, productId: string, available: boolean): void {
  getDb()
    .prepare(
      `INSERT INTO branch_product_availability (branch_id, product_id, is_available) VALUES (?, ?, ?)
       ON CONFLICT(branch_id, product_id) DO UPDATE SET is_available = excluded.is_available`,
    )
    .run(branchId, productId, available ? 1 : 0);
}

export function listUnavailable(branchId: string): string[] {
  return (getDb().prepare("SELECT product_id FROM branch_product_availability WHERE branch_id = ? AND is_available = 0").all(branchId) as any[]).map((r) => r.product_id);
}

export function setProductActive(productId: string, active: boolean): void {
  getDb().prepare("UPDATE products SET is_active = ? WHERE id = ?").run(active ? 1 : 0, productId);
}
