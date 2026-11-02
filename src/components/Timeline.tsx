import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import type { Slot, Weather } from '../api';
import { C } from '../theme';
import { co2Color, dayLabel, hhmm, kr, SLOT_MS } from '../util';

type Props = {
  slots: Slot[];
  nowIdx: number;
  highlight?: { startIdx: number; len: number } | null;
  weather: Weather | null;
  onScrub: (idx: number | null) => void;
};

const CHART_H = 170;
const TOP = 18;
const RIBBON_H = 10;
const AXIS_H = 18;
const Y_AXIS = 34;

export function Timeline({ slots, nowIdx, highlight, weather, onScrub }: Props) {
  const WIND_H = weather ? 28 : 0;
  const TOTAL_H = TOP + CHART_H + 8 + RIBBON_H + 8 + WIND_H + AXIS_H;
  const [fullW, setW] = useState(0);
  const w = Math.max(0, fullW - Y_AXIS);
  const [scrub, setScrub] = useState<number | null>(null);
  const lastHaptic = useRef(-1);

  const geo = useMemo(() => {
    if (!w || slots.length < 2) return null;
    const t0 = slots[0].t;
    const t1 = slots[slots.length - 1].t + SLOT_MS;
    const x = (t: number) => ((t - t0) / (t1 - t0)) * w;
    const prices = slots.map((s) => s.price ?? 0);
    const pMin = Math.min(...prices), pMax = Math.max(...prices);
    const pad = Math.max(0.05, (pMax - pMin) * 0.15);
    const lo = pMin - pad;
    const hi = pMax + pad;
    const yTicks = [pMin, (pMin + pMax) / 2, pMax];
    const y = (p: number) => TOP + CHART_H - ((p - lo) / (hi - lo)) * CHART_H;
    const sw = w / slots.length;

    // Trappe-kurve: 15-minutters priser er konstante i intervallet.
    let line = '';
    slots.forEach((s, i) => {
      const xa = x(s.t), xb = x(s.t + SLOT_MS), yy = y(s.price ?? 0);
      line += i === 0 ? `M${xa},${yy} L${xb},${yy}` : ` L${xa},${yy} L${xb},${yy}`;
    });
    const area = `${line} L${w},${y(lo)} L0,${y(lo)} Z`;

    const segs = slots.map((s, i) => {
      const yy = y(s.price ?? 0);
      const py = i > 0 ? y(slots[i - 1].price ?? 0) : yy;
      const xa = x(s.t), xb = x(s.t + SLOT_MS);
      return { d: `M${xa},${py} L${xa},${yy} L${xb},${yy}`, c: co2Color(s.co2) };
    });

    const midnights: number[] = [];
    const d = new Date(t0);
    d.setHours(24, 0, 0, 0);
    for (let m = d.getTime(); m < t1; m += 86400000) midnights.push(m);

    const ticks: number[] = [];
    const tk = new Date(t0);
    tk.setMinutes(0, 0, 0);
    tk.setHours(Math.ceil(tk.getHours() / 6) * 6);
    for (let m = tk.getTime(); m < t1; m += 6 * 3600000) if (m > t0) ticks.push(m);

    const windMax = weather ? Math.max(12, ...weather.hourly.map((h) => h.wind100)) : 1;
    const wind = weather
      ? weather.hourly
          .filter((h) => h.t + 3600000 > t0 && h.t < t1)
          .map((h) => ({ x: Math.max(0, x(h.t)), xe: Math.min(w, x(h.t + 3600000)), v: h.wind100, sun: h.sun }))
      : [];

    return { x, y, sw, line, area, segs, midnights, ticks, wind, windMax, yTicks };
  }, [w, slots, weather]);

  const idxAt = (px: number) => Math.max(0, Math.min(slots.length - 1, Math.floor((px - Y_AXIS) / (w / slots.length))));

  // Lille "klik" i hånden for hver hel time man spoler forbi.
  const scrubHour = scrub != null && slots[scrub] ? Math.floor(slots[scrub].t / 3600000) : null;
  useEffect(() => {
    if (scrubHour == null || Platform.OS === 'web' || scrubHour === lastHaptic.current) return;
    lastHaptic.current = scrubHour;
    Haptics.selectionAsync().catch(() => {});
  }, [scrubHour]);

  const setIdx = (i: number | null) => {
    setScrub(i);
    onScrub(i);
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => setIdx(idxAt(e.nativeEvent.locationX)),
        onPanResponderMove: (e) => setIdx(idxAt(e.nativeEvent.locationX)),
        onPanResponderRelease: () => setIdx(null),
        onPanResponderTerminate: () => setIdx(null),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fullW, slots],
  );

  const active = scrub ?? nowIdx;
  const activeSlot = slots[active];

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: TOTAL_H }}>
      {geo && (
        <Svg width={fullW} height={TOTAL_H}>
          <Defs>
            <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#c7d2fe" stopOpacity={0.22} />
              <Stop offset="1" stopColor="#c7d2fe" stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id="best" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#2ef0aa" stopOpacity={0.28} />
              <Stop offset="1" stopColor="#2ef0aa" stopOpacity={0.02} />
            </LinearGradient>
          </Defs>

          {/* pris-akse */}
          {geo.yTicks.map((p, i) => (
            <SvgText key={i} x={Y_AXIS - 6} y={geo.y(p) + 3} fill={C.faint} fontSize={10} textAnchor="end">
              {kr(p)}
            </SvgText>
          ))}
          <G x={Y_AXIS}>
          {geo.yTicks.map((p, i) => (
            <Line key={i} x1={0} x2={w} y1={geo.y(p)} y2={geo.y(p)} stroke={C.cardBorder} strokeDasharray="1 5" />
          ))}

          {/* bedste vindue */}
          {highlight && slots[highlight.startIdx] && (
            <G>
              <Rect
                x={geo.x(slots[highlight.startIdx].t)}
                y={TOP - 14}
                width={highlight.len * geo.sw}
                height={CHART_H + 14}
                fill="url(#best)"
                rx={6}
              />
              <SvgText x={geo.x(slots[highlight.startIdx].t) + 4} y={TOP - 3} fill="#2ef0aa" fontSize={10} fontWeight="700">
                BEDST
              </SvgText>
            </G>
          )}

          {/* midnatslinjer */}
          {geo.midnights.map((m) => (
            <G key={m}>
              <Line x1={geo.x(m)} x2={geo.x(m)} y1={TOP} y2={TOP + CHART_H} stroke={C.cardBorder} strokeDasharray="2 4" />
              <SvgText x={geo.x(m) + 4} y={TOP + CHART_H - 4} fill={C.faint} fontSize={10}>
                {dayLabel(m)}
              </SvgText>
            </G>
          ))}

          <Path d={geo.area} fill="url(#fill)" />
          {geo.segs.map((s, i) => (
            <Path key={i} d={s.d} stroke={s.c} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          ))}

          {/* CO2-bånd */}
          {slots.map((s, i) => (
            <Rect key={i} x={geo.x(s.t)} y={TOP + CHART_H + 8} width={geo.sw + 0.5} height={RIBBON_H} fill={co2Color(s.co2, s.co2Forecast ? 0.6 : 1)} />
          ))}

          {/* vind 100 m (Open-Meteo) */}
          {WIND_H > 0 && geo.wind.map((h, i) => {
            const bh = (h.v / geo.windMax) * (WIND_H - 4);
            return (
              <Rect key={i} x={h.x + 0.5} y={TOP + CHART_H + 8 + RIBBON_H + 8 + (WIND_H - bh)} width={Math.max(1, h.xe - h.x - 1)} height={bh} rx={1} fill={C.offshore} fillOpacity={0.55} />
            );
          })}

          {/* fortid dæmpes */}
          <Rect x={0} y={0} width={geo.x(slots[nowIdx].t)} height={TOP + CHART_H + 8 + RIBBON_H + 8 + WIND_H} fill={C.bg0} fillOpacity={0.3} />

          {/* tidsakse */}
          {geo.ticks.map((t) => (
            <SvgText key={t} x={geo.x(t)} y={TOTAL_H - 4} fill={C.faint} fontSize={10} textAnchor="middle">
              {hhmm(t)}
            </SvgText>
          ))}

          {/* markør */}
          {activeSlot && (
            <G>
              <Line
                x1={geo.x(activeSlot.t) + geo.sw / 2}
                x2={geo.x(activeSlot.t) + geo.sw / 2}
                y1={TOP - 6}
                y2={TOP + CHART_H + 8 + RIBBON_H + 8 + WIND_H}
                stroke={scrub != null ? '#fff' : co2Color(activeSlot.co2)}
                strokeWidth={scrub != null ? 1.5 : 1}
                strokeDasharray={scrub != null ? undefined : '3 3'}
              />
              <Rect x={geo.x(activeSlot.t) + geo.sw / 2 - 5} y={geo.y(activeSlot.price ?? 0) - 5} width={10} height={10} rx={5} fill="#fff" stroke={co2Color(activeSlot.co2)} strokeWidth={3} />
            </G>
          )}
          </G>
        </Svg>
      )}
      <View style={StyleSheet.absoluteFill} {...responder.panHandlers} />
      {geo && scrub != null && activeSlot && (
        <View
          pointerEvents="none"
          style={[styles.tip, { left: Math.max(0, Math.min(fullW - 132, Y_AXIS + geo.x(activeSlot.t) - 66)) }]}
        >
          <Text style={styles.tipTime}>
            {dayLabel(activeSlot.t)} {hhmm(activeSlot.t)}
          </Text>
          <Text style={styles.tipVal}>
            {kr(activeSlot.price)} kr · <Text style={{ color: co2Color(activeSlot.co2) }}>{activeSlot.co2 == null ? '–' : Math.round(activeSlot.co2)} g</Text>
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tip: {
    position: 'absolute',
    top: -38,
    width: 132,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,42,0.95)',
    borderWidth: 1,
    borderColor: C.cardBorder,
    alignItems: 'center',
  },
  tipTime: { color: C.dim, fontSize: 10 },
  tipVal: { color: C.text, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
