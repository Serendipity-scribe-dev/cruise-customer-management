const day = 86400000;
const iso = (n) => new Date(Date.now() + n * day).toISOString().slice(0, 10);

export const CABINS = ["Inside", "Ocean View", "Balcony", "Suite"];
const MULT = { Inside: 1, "Ocean View": 1.25, Balcony: 1.6, Suite: 2.6 };

const catalog = [
  { id: "s1", ship: "Symphony of the Seas", destination: "Western Caribbean", in: 95, nights: 7, base: 1400 },
  { id: "s2", ship: "MSC Seascape", destination: "Mediterranean", in: 120, nights: 8, base: 1650 },
  { id: "s3", ship: "Norwegian Bliss", destination: "Alaska", in: 150, nights: 7, base: 1800 },
  { id: "s4", ship: "Celebrity Edge", destination: "Greek Isles", in: 190, nights: 10, base: 2400 },
  { id: "s5", ship: "Viking Venus", destination: "Norwegian Fjords", in: 230, nights: 9, base: 3100 },
  { id: "s6", ship: "Icon of the Seas", destination: "Eastern Caribbean", in: 270, nights: 7, base: 1900 },
  { id: "s7", ship: "Disney Wish", destination: "Bahamas", in: 310, nights: 4, base: 1200 },
  { id: "s8", ship: "Queen Mary 2", destination: "Transatlantic", in: 350, nights: 7, base: 2200 },
];

// Fares are per person. Dates are relative to today so the demo never goes stale.
export function getSailings() {
  return catalog.map(({ in: d, base, ...s }) => ({
    ...s,
    date: iso(d),
    prices: Object.fromEntries(CABINS.map((c) => [c, Math.round(base * MULT[c])])),
  }));
}
