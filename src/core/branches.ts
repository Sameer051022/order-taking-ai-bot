import { getDb, json } from "../db/index.js";
import { matchScore } from "./text.js";
import type { Address, Area, Branch, DeliveryZone } from "./types.js";

export function listBranches(restaurantId: string): Branch[] {
  return getDb().prepare("SELECT * FROM branches WHERE restaurant_id = ? ORDER BY name").all(restaurantId) as Branch[];
}

export function getBranch(branchId: string): Branch | undefined {
  return getDb().prepare("SELECT * FROM branches WHERE id = ?").get(branchId) as Branch | undefined;
}

export function setBranchOpen(branchId: string, open: boolean): void {
  getDb().prepare("UPDATE branches SET is_open = ? WHERE id = ?").run(open ? 1 : 0, branchId);
}

export function listZones(branchId: string): DeliveryZone[] {
  return getDb().prepare("SELECT * FROM delivery_zones WHERE branch_id = ? ORDER BY max_km").all(branchId) as DeliveryZone[];
}

export function listAreas(restaurantId: string): Area[] {
  return (getDb().prepare("SELECT * FROM areas WHERE restaurant_id = ?").all(restaurantId) as any[]).map((a) => ({ ...a, aliases: json<string[]>(a.aliases, []) }));
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Demo geocoder: match free text against seeded areas (name + aliases).
 * In production this is a call to a real geocoding provider.
 */
export function geocode(restaurantId: string, text: string): { area: Area; score: number } | undefined {
  const areas = listAreas(restaurantId);
  const ranked = areas
    .map((area) => ({ area, score: Math.max(matchScore(text, area.name), ...area.aliases.map((al) => matchScore(text, al)), ...areaTokensScore(text, area)) }))
    .filter((r) => r.score >= 40)
    .sort((a, b) => b.score - a.score);
  return ranked[0];
}

function areaTokensScore(text: string, area: Area): number[] {
  // "House 12, Street 4, DHA Phase 6, Lahore" -> try each comma-separated part
  return text.split(/[,\n]/).map((part) => Math.max(matchScore(part, area.name), ...area.aliases.map((al) => matchScore(part, al))));
}

export interface RoutingResult {
  ok: boolean;
  branch?: Branch;
  distance_km?: number;
  zone?: DeliveryZone;
  address?: Address;
  reason?: string;
  alternatives?: { branch: Branch; distance_km: number }[];
}

/** Pick the branch that serves a delivery location. Deterministic, never left to the LLM. */
export function routeDelivery(restaurantId: string, input: { text?: string; lat?: number; lng?: number }): RoutingResult {
  let lat = input.lat, lng = input.lng;
  let address: Address = { text: input.text ?? "" };
  if ((lat == null || lng == null) && input.text) {
    const g = geocode(restaurantId, input.text);
    if (!g) {
      const areas = listAreas(restaurantId).map((a) => a.name);
      return { ok: false, reason: `Could not recognise the area in "${input.text}". Ask the customer for the area name (e.g. ${areas.slice(0, 4).join(", ")}) or to share their location.` };
    }
    lat = g.area.lat; lng = g.area.lng;
    address = { text: input.text, lat, lng, area: g.area.name };
  } else if (lat != null && lng != null) {
    const nearestArea = listAreas(restaurantId).map((a) => ({ a, d: haversineKm(lat!, lng!, a.lat, a.lng) })).sort((x, y) => x.d - y.d)[0];
    address = { text: input.text || `Shared location near ${nearestArea?.a.name ?? "unknown area"}`, lat, lng, area: nearestArea?.a.name };
  } else {
    return { ok: false, reason: "No address or location provided." };
  }

  const branches = listBranches(restaurantId);
  const ranked = branches.map((branch) => ({ branch, distance_km: haversineKm(lat!, lng!, branch.lat, branch.lng) })).sort((a, b) => a.distance_km - b.distance_km);
  const serviceable = ranked.filter((r) => r.branch.is_open && r.distance_km <= r.branch.delivery_radius_km);
  if (serviceable.length === 0) {
    const closedNearby = ranked.find((r) => r.distance_km <= r.branch.delivery_radius_km && !r.branch.is_open);
    return {
      ok: false,
      address,
      alternatives: ranked.slice(0, 2),
      reason: closedNearby
        ? `${closedNearby.branch.name} covers this area but is currently closed.`
        : `This location is outside our delivery zones (nearest branch ${ranked[0]?.branch.name} is ${ranked[0]?.distance_km.toFixed(1)} km away). Offer pickup instead.`,
    };
  }
  const best = serviceable[0];
  const zone = listZones(best.branch.id).find((z) => best.distance_km <= z.max_km) ?? listZones(best.branch.id).at(-1);
  return { ok: true, branch: best.branch, distance_km: Math.round(best.distance_km * 10) / 10, zone, address };
}

export function pickupBranch(restaurantId: string, ref?: string): { branch?: Branch; candidates: Branch[] } {
  const branches = listBranches(restaurantId);
  if (!ref) return { candidates: branches };
  const exact = branches.find((b) => b.id === ref);
  if (exact) return { branch: exact, candidates: branches };
  const ranked = branches.map((b) => ({ b, score: Math.max(matchScore(ref, b.name), matchScore(ref, b.address)) })).filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
  if (ranked[0] && (!ranked[1] || ranked[1].score < ranked[0].score)) return { branch: ranked[0].b, candidates: branches };
  return { candidates: branches };
}
