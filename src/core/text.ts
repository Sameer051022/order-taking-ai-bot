/** Small text utilities shared by menu search and modifier resolution. */

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(s: string): string[] {
  return normalize(s).split(" ").filter(Boolean);
}

/** Score how well `query` matches a candidate described by `name` and `keywords`. 0 = no match. */
export function matchScore(query: string, name: string, keywords: string[] = []): number {
  const q = normalize(query);
  if (!q) return 0;
  const n = normalize(name);
  if (q === n) return 100;
  const kws = keywords.map(normalize);
  if (kws.includes(q)) return 95;
  if (n.startsWith(q)) return 80;
  if (n.includes(q)) return 70;
  const qt = tokens(q);
  const nt = tokens(n);
  const bag = new Set([...nt, ...kws.flatMap((k) => k.split(" "))]);
  let hits = 0;
  for (const t of qt) {
    if (bag.has(t)) hits++;
    else if ([...bag].some((b) => b.startsWith(t) && t.length >= 3)) hits += 0.7;
  }
  if (hits === 0) return 0;
  return Math.round((hits / qt.length) * 60);
}
