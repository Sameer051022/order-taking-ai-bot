import { openMemoryDb } from "../src/db/index.js";
import { seedAll } from "../src/seed/index.js";

export function freshDb() {
  openMemoryDb();
  seedAll({ history: false });
}

export const R = "REST_CRUNCHBIRD";
