import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";

const here = path.dirname(fileURLToPath(import.meta.url));

let db: Database.Database | null = null;

export function getDb(dbPath: string = config.dbPath): Database.Database {
  if (db) return db;
  if (dbPath !== ":memory:") fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.exec(fs.readFileSync(path.join(here, "schema.sql"), "utf8"));
  migrate(db);
  return db;
}

/** Additive migrations for databases created before a column existed. */
function migrate(d: Database.Database): void {
  const cols = (d.prepare("PRAGMA table_info(restaurants)").all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes("theme")) d.exec("ALTER TABLE restaurants ADD COLUMN theme TEXT");
}

/** Open a fresh in-memory database (tests). */
export function openMemoryDb(): Database.Database {
  db = null;
  return getDb(":memory:");
}

export function nowIso(): string {
  return new Date().toISOString();
}

let counter = 0;
export function newId(prefix: string): string {
  counter = (counter + 1) % 1000;
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 7);
  return `${prefix}_${t}${counter.toString(36)}${r}`.toUpperCase();
}

export function json<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
