import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';
import { APPLIANCES, Appliance, dayLabel, hhmm, kr, Window } from '../util';

type Props = { selected: Appliance; onSelect: (a: Appliance) => void; win: Window | null; now: number };

export function BestTime({ selected, onSelect, win, now }: Props) {
  const startsNow = win && win.start - now < 15 * 60 * 1000;
  return (
    <View>
      <View style={styles.chips}>
        {APPLIANCES.map((a) => {
          const on = a.key === selected.key;
          return (
            <Pressable key={a.key} onPress={() => onSelect(a)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={styles.chipIcon}>{a.icon}</Text>
              <Text style={[styles.chipText, on && { color: C.bg0 }]}>{a.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {win ? (
        <View style={styles.result}>
          <Text style={styles.kicker}>{startsNow ? 'Start den' : 'Start'}</Text>
          <Text style={styles.when}>
            {startsNow ? 'nu' : `${dayLabel(win.start, now)} kl. ${hhmm(win.start)}`}
          </Text>
          <Text style={styles.range}>
            {hhmm(win.start)}–{hhmm(win.end)} · Ø {kr(win.avgPrice)} kr/kWh · {Math.round(win.avgCo2)} g CO₂
          </Text>
          {!startsNow && (
            <View style={styles.stats}>
              <Stat value={`${kr(Math.max(0, win.saveKr))} kr`} label="sparet vs. nu" />
              {win.saveCo2Pct >= 1 ? (
                <Stat value={`${Math.round(win.saveCo2Pct)} %`} label="mindre CO₂" />
              ) : (
                <Stat value={`${Math.round(win.avgCo2)} g`} label="CO₂/kWh i snit" />
              )}
            </View>
          )}
          <Text style={styles.foot}>
            {selected.icon} {selected.label}: ca. {kr(selected.kwh, 1)} kWh over {kr(selected.hours, 1)} t. Spotpris ekskl. nettarif, afgifter og moms.
          </Text>
        </View>
      ) : (
        <Text style={styles.foot}>Ikke nok prisdata endnu – priser for i morgen kommer ca. kl. 13.</Text>
      )}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 999, borderWidth: 1, borderColor: C.cardBorder, backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chipOn: { backgroundColor: '#2ef0aa', borderColor: '#2ef0aa' },
  chipIcon: { fontSize: 14 },
  chipText: { color: C.text, fontSize: 13, fontWeight: '600' },
  result: { marginTop: 16 },
  kicker: { color: C.dim, fontSize: 13 },
  when: { color: '#2ef0aa', fontSize: 34, fontWeight: '800', letterSpacing: -1, marginTop: 2 },
  range: { color: C.dim, fontSize: 13, marginTop: 2, fontVariant: ['tabular-nums'] },
  stats: { flexDirection: 'row', gap: 10, marginTop: 14 },
  stat: { flex: 1, padding: 12, borderRadius: 14, backgroundColor: 'rgba(46,240,170,0.08)', borderWidth: 1, borderColor: 'rgba(46,240,170,0.2)' },
  statVal: { color: C.text, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { color: C.dim, fontSize: 12, marginTop: 2 },
  foot: { color: C.faint, fontSize: 11, marginTop: 12, lineHeight: 15 },
});
