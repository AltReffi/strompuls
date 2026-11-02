import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Area, Dashboard, fetchDashboard } from './src/api';
import { BestTime } from './src/components/BestTime';
import { MixBar } from './src/components/MixBar';
import { PulseOrb } from './src/components/PulseOrb';
import { Timeline } from './src/components/Timeline';
import { Turbine } from './src/components/Turbine';
import { C } from './src/theme';
import { APPLIANCES, bestWindow, co2Color, currentIndex, dayLabel, hhmm, kr } from './src/util';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Main />
    </SafeAreaProvider>
  );
}

const AREAS: { key: Area; label: string }[] = [
  { key: 'DK1', label: 'Vest' },
  { key: 'DK2', label: 'Øst' },
];

function Main() {
  const insets = useSafeAreaInsets();
  const [area, setArea] = useState<Area>('DK1');
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [scrub, setScrub] = useState<number | null>(null);
  const [appliance, setAppliance] = useState(APPLIANCES[0]);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async (a: Area) => {
    try {
      setError(null);
      const d = await fetchDashboard(a);
      setData(d);
      setNow(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ukendt fejl');
    }
  }, []);

  useEffect(() => {
    setData(null);
    load(area);
    const id = setInterval(() => load(area), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [area, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(area);
    setRefreshing(false);
  };

  const slots = data?.slots ?? [];
  const nowIdx = currentIndex(slots, now);
  const shown = slots[scrub ?? nowIdx];
  const win = useMemo(() => bestWindow(slots, appliance.hours, appliance.kwh, now), [slots, appliance, now]);

  const mix = data?.mix;
  const greenShare = mix
    ? (mix.offshore + mix.onshore + mix.solar) /
      Math.max(1, mix.offshore + mix.onshore + mix.solar + mix.thermal + mix.imports)
    : null;
  const windMW = mix ? mix.offshore + mix.onshore : 0;
  const windMs = data?.weather?.windNow ?? windMW / 400; // fallback hvis vejr-API er nede
  const glow = co2Color(shown?.co2 ?? null, 0.22);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg0 }}>
      <LinearGradient colors={[glow, C.bg1, C.bg0]} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
      <ScrollView
        scrollEnabled={scrub == null}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Strømmens puls</Text>
            <Text style={styles.subtitle}>
              {data ? `Opdateret ${hhmm(data.fetchedAt)} · Energinet` : 'Henter live data…'}
            </Text>
          </View>
          <View style={styles.seg}>
            {AREAS.map((a) => (
              <Pressable key={a.key} onPress={() => setArea(a.key)} style={[styles.segBtn, area === a.key && styles.segOn]}>
                <Text style={[styles.segText, area === a.key && { color: C.bg0 }]}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {error && !data && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Kunne ikke hente data</Text>
            <Text style={styles.muted}>{error}</Text>
            <Pressable onPress={() => load(area)} style={[styles.segBtn, styles.segOn, { alignSelf: 'flex-start', marginTop: 12 }]}>
              <Text style={{ color: C.bg0, fontWeight: '700' }}>Prøv igen</Text>
            </Pressable>
          </View>
        )}

        {!data && !error && (
          <View style={{ height: 420, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#fff" />
          </View>
        )}

        {data && shown && (
          <>
            <View style={{ marginTop: 8 }}>
              <PulseOrb
                co2={shown.co2}
                price={shown.price}
                greenShare={scrub == null ? greenShare : null}
                forecast={shown.co2Forecast}
                caption={scrub == null ? 'Lige nu' : `${dayLabel(shown.t, now)} ${hhmm(shown.t)}`}
              />
            </View>

            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>Pris & CO₂</Text>
                <Text style={styles.muted}>træk for at spole</Text>
              </View>
              <View style={{ marginTop: 30 }}>
                <Timeline
                  slots={slots}
                  nowIdx={nowIdx}
                  highlight={win}
                  weather={data.weather}
                  onScrub={setScrub}
                />
              </View>
              <View style={styles.legendRow}>
                <LegendDot color="#c7d2fe" label="Pris kr/kWh" />
                <LegendDot color={co2Color(40)} label="CO₂ (farve)" />
                {data.weather && <LegendDot color={C.offshore} label="Vind 100 m" />}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Hvornår skal jeg tænde?</Text>
              <View style={{ height: 12 }} />
              <BestTime selected={appliance} onSelect={setAppliance} win={win} now={now} />
            </View>

            {mix && (
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <View>
                    <Text style={styles.cardTitle}>Hvor kommer strømmen fra?</Text>
                    <Text style={styles.muted}>
                      {AREAS.find((a) => a.key === area)?.label}danmark · {hhmm(mix.t)}
                    </Text>
                  </View>
                </View>
                <View style={styles.windRow}>
                  <Turbine wind={windMs} size={44} color={C.offshore} />
                  <Turbine wind={windMs * 0.85} size={34} color={C.onshore} />
                  <Turbine wind={windMs * 1.1} size={26} color={C.offshore} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.windBig}>{Math.round(windMW).toLocaleString('da-DK')} MW</Text>
                    <Text style={styles.muted}>
                      vindkraft
                      {data.weather?.windNow != null ? ` · ${kr(data.weather.windNow, 1)} m/s vind` : ''}
                    </Text>
                  </View>
                </View>
                <MixBar mix={mix} />
              </View>
            )}

            <Text style={styles.source}>
              Kilder: Energi Data Service (DayAheadPrices, CO2Emis, CO2EmisProg, ElectricityProdex5MinRealtime) · Open-Meteo
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: C.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: C.dim, fontSize: 12, marginTop: 2 },
  seg: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 999, padding: 3 },
  segBtn: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999 },
  segOn: { backgroundColor: C.text },
  segText: { color: C.text, fontWeight: '700', fontSize: 13 },
  card: { marginTop: 16, padding: 16, borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.cardBorder },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  muted: { color: C.dim, fontSize: 12 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10 },
  windRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 12, marginBottom: 16 },
  windBig: { color: C.text, fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  source: { color: C.faint, fontSize: 10, textAlign: 'center', marginTop: 20, lineHeight: 14 },
});
