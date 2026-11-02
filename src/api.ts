// Datakilder: Energi Data Service (Energinet) + Open-Meteo. Ingen API-nøgler.
export type Area = 'DK1' | 'DK2';

export type Slot = {
  t: number; // start, ms epoch (15 min opløsning)
  price: number | null; // kr/kWh, spotpris ekskl. afgifter/moms
  co2: number | null; // g/kWh
  co2Forecast: boolean; // true = prognose
};

export type Mix = {
  t: number;
  offshore: number;
  onshore: number;
  solar: number;
  thermal: number;
  imports: number;
};

export type Weather = {
  windNow: number | null; // m/s, 10 m
  hourly: { t: number; wind100: number; sun: number }[];
};

export type Dashboard = { slots: Slot[]; mix: Mix | null; weather: Weather | null; fetchedAt: number };

const EDS = 'https://api.energidataservice.dk/dataset';
const SLOT = 15 * 60 * 1000;

const utc = (s: string) => Date.parse(s.endsWith('Z') ? s : s + 'Z');

async function eds<T>(dataset: string, params: Record<string, string>): Promise<T[]> {
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  const res = await fetch(`${EDS}/${dataset}?${qs}`);
  if (!res.ok) throw new Error(`${dataset}: HTTP ${res.status}`);
  const json = await res.json();
  return json.records as T[];
}

const filter = (area: Area) => JSON.stringify({ PriceArea: [area] });

type PriceRec = { TimeUTC: string; DayAheadPriceDKK: number };
type Co2Rec = { Minutes5UTC: string; CO2Emission: number };
type MixRec = {
  Minutes5UTC: string;
  ProductionLt100MW: number | null;
  ProductionGe100MW: number | null;
  OffshoreWindPower: number | null;
  OnshoreWindPower: number | null;
  SolarPower: number | null;
  [k: string]: string | number | null;
};

const floorSlot = (t: number) => Math.floor(t / SLOT) * SLOT;

function bucketCo2(recs: Co2Rec[]): Map<number, number> {
  const acc = new Map<number, { s: number; n: number }>();
  for (const r of recs) {
    if (r.CO2Emission == null) continue;
    const k = floorSlot(utc(r.Minutes5UTC));
    const a = acc.get(k) ?? { s: 0, n: 0 };
    a.s += r.CO2Emission;
    a.n += 1;
    acc.set(k, a);
  }
  const out = new Map<number, number>();
  acc.forEach((a, k) => out.set(k, a.s / a.n));
  return out;
}

const CENTER: Record<Area, [number, number]> = { DK1: [56.2, 9.1], DK2: [55.5, 11.9] };

async function fetchWeather(area: Area): Promise<Weather | null> {
  try {
    const [lat, lon] = CENTER[area];
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=wind_speed_10m&hourly=wind_speed_100m,shortwave_radiation` +
      `&past_hours=8&forecast_hours=50&timezone=UTC&wind_speed_unit=ms`;
    // Vejret må aldrig blokere resten af skærmen: giv op efter 6 sek.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    const j = await res.json();
    if (j.error) return null;
    const hourly = (j.hourly.time as string[]).map((s, i) => ({
      t: utc(s + ':00'),
      wind100: j.hourly.wind_speed_100m[i] ?? 0,
      sun: j.hourly.shortwave_radiation[i] ?? 0,
    }));
    return { windNow: j.current?.wind_speed_10m ?? null, hourly };
  } catch {
    return null; // vejr er "nice to have" – appen virker uden
  }
}

async function fetchMix(area: Area): Promise<Mix | null> {
  const [r] = await eds<MixRec>('ElectricityProdex5MinRealtime', {
    filter: filter(area),
    sort: 'Minutes5UTC desc',
    limit: '1',
  });
  if (!r) return null;
  const imports = Object.keys(r)
    .filter((k) => k.startsWith('Exchange') || k === 'BornholmSE4')
    .reduce((s, k) => s + Math.max(0, Number(r[k] ?? 0)), 0);
  return {
    t: utc(r.Minutes5UTC),
    offshore: r.OffshoreWindPower ?? 0,
    onshore: r.OnshoreWindPower ?? 0,
    solar: r.SolarPower ?? 0,
    thermal: (r.ProductionGe100MW ?? 0) + (r.ProductionLt100MW ?? 0),
    imports,
  };
}

export async function fetchDashboard(area: Area): Promise<Dashboard> {
  const range = { start: 'now-PT6H', end: 'now+P2D', filter: filter(area), limit: '0' };
  const [prices, co2Past, co2Prog, mix, weather] = await Promise.all([
    eds<PriceRec>('DayAheadPrices', range),
    eds<Co2Rec>('CO2Emis', { start: 'now-PT6H', filter: filter(area), limit: '0' }),
    eds<Co2Rec>('CO2EmisProg', { start: 'now-PT6H', end: 'now+P2D', filter: filter(area), limit: '0' }),
    fetchMix(area).catch(() => null),
    fetchWeather(area),
  ]);

  const past = bucketCo2(co2Past);
  const prog = bucketCo2(co2Prog);
  const priceMap = new Map<number, number>();
  for (const p of prices) priceMap.set(floorSlot(utc(p.TimeUTC)), p.DayAheadPriceDKK / 1000);

  const keys = new Set<number>([...priceMap.keys(), ...past.keys(), ...prog.keys()]);
  const slots: Slot[] = [...keys]
    .sort((a, b) => a - b)
    .map((t) => {
      const real = past.get(t);
      return {
        t,
        price: priceMap.get(t) ?? null,
        co2: real ?? prog.get(t) ?? null,
        co2Forecast: real == null,
      };
    })
    // kun slots hvor vi har en pris – det er dem man kan handle på
    .filter((s) => s.price != null);

  return { slots, mix, weather, fetchedAt: Date.now() };
}
