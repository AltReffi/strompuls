import type { Slot } from './api';

export const SLOT_MS = 15 * 60 * 1000;

// CO2-intensitet → farve. Grøn under ~60 g, gul ~150, rød 300+.
const STOPS: [number, [number, number, number]][] = [
  [0, [46, 240, 170]],
  [60, [70, 225, 120]],
  [130, [230, 220, 80]],
  [200, [255, 160, 60]],
  [300, [255, 80, 90]],
];

export function co2Color(v: number | null, alpha = 1): string {
  if (v == null) return `rgba(140,150,170,${alpha})`;
  let i = 0;
  while (i < STOPS.length - 2 && v > STOPS[i + 1][0]) i++;
  const [a, ca] = STOPS[i];
  const [b, cb] = STOPS[i + 1];
  const f = Math.max(0, Math.min(1, (v - a) / (b - a)));
  const c = ca.map((x, k) => Math.round(x + (cb[k] - x) * f));
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

export function co2Label(v: number | null): string {
  if (v == null) return 'Ukendt';
  if (v < 60) return 'Meget grøn';
  if (v < 120) return 'Grøn';
  if (v < 200) return 'Blandet';
  return 'Sort';
}

export const pad = (n: number) => String(n).padStart(2, '0');
export const hhmm = (t: number) => {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const DAYS = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];
export function dayLabel(t: number, now = Date.now()): string {
  const d = new Date(t);
  const n = new Date(now);
  const diff = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime()) /
      86400000,
  );
  if (diff === 0) return 'i dag';
  if (diff === 1) return 'i morgen';
  if (diff === -1) return 'i går';
  return DAYS[d.getDay()];
}
export const kr = (v: number | null, digits = 2) =>
  v == null ? '–' : v.toFixed(digits).replace('.', ',');

export function currentIndex(slots: Slot[], now = Date.now()): number {
  let idx = -1;
  for (let i = 0; i < slots.length; i++) if (slots[i].t <= now) idx = i;
  return Math.max(0, idx);
}

export type Appliance = { key: string; label: string; icon: string; hours: number; kwh: number };
export const APPLIANCES: Appliance[] = [
  { key: 'dish', label: 'Opvasker', icon: '🍽️', hours: 2.5, kwh: 1.1 },
  { key: 'wash', label: 'Vask', icon: '🧺', hours: 2, kwh: 1.0 },
  { key: 'dry', label: 'Tørretumbler', icon: '🌀', hours: 1.5, kwh: 2.5 },
  { key: 'ev', label: 'Elbil', icon: '🚗', hours: 4, kwh: 30 },
];

export type Window = {
  start: number;
  end: number;
  avgPrice: number;
  avgCo2: number;
  nowPrice: number;
  nowCo2: number;
  saveKr: number;
  saveCo2Pct: number;
  startIdx: number;
  len: number;
};

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

/** Find det vindue (fremadrettet) der minimerer en 50/50-blanding af pris og CO2. */
export function bestWindow(slots: Slot[], hours: number, kwh: number, now = Date.now()): Window | null {
  const len = Math.round((hours * 3600000) / SLOT_MS);
  const from = currentIndex(slots, now);
  const fut = slots.slice(from);
  if (fut.length < len) return null;

  const prices = fut.map((s) => s.price ?? 0);
  const co2s = fut.map((s) => s.co2 ?? NaN);
  const finiteCo2 = co2s.filter((x) => Number.isFinite(x));
  const pMin = Math.min(...prices), pMax = Math.max(...prices);
  const cMin = Math.min(...finiteCo2), cMax = Math.max(...finiteCo2);
  const norm = (v: number, lo: number, hi: number) => (hi > lo ? (v - lo) / (hi - lo) : 0);

  const windowStats = (i: number) => {
    const p = avg(prices.slice(i, i + len));
    const cs = co2s.slice(i, i + len).filter((x) => Number.isFinite(x));
    const c = cs.length ? avg(cs) : NaN;
    return { p, c };
  };

  let best = 0, bestScore = Infinity;
  for (let i = 0; i + len <= fut.length; i++) {
    const { p, c } = windowStats(i);
    const score = norm(p, pMin, pMax) + (Number.isFinite(c) ? norm(c, cMin, cMax) : 0.5);
    if (score < bestScore) { bestScore = score; best = i; }
  }
  const b = windowStats(best);
  const n = windowStats(0);
  return {
    start: fut[best].t,
    end: fut[best].t + len * SLOT_MS,
    avgPrice: b.p,
    avgCo2: b.c,
    nowPrice: n.p,
    nowCo2: n.c,
    saveKr: (n.p - b.p) * kwh,
    saveCo2Pct: Number.isFinite(n.c) && n.c > 0 ? (1 - b.c / n.c) * 100 : 0,
    startIdx: from + best,
    len,
  };
}
