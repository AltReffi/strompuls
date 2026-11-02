import { StyleSheet, Text, View } from 'react-native';
import type { Mix } from '../api';
import { C } from '../theme';

const PARTS: { key: keyof Omit<Mix, 't'>; label: string; color: string }[] = [
  { key: 'offshore', label: 'Havvind', color: C.offshore },
  { key: 'onshore', label: 'Landvind', color: C.onshore },
  { key: 'solar', label: 'Sol', color: C.solar },
  { key: 'thermal', label: 'Kraftværker', color: C.thermal },
  { key: 'imports', label: 'Import', color: C.imports },
];

export function MixBar({ mix }: { mix: Mix }) {
  const total = PARTS.reduce((s, p) => s + mix[p.key], 0) || 1;
  return (
    <View>
      <View style={styles.bar}>
        {PARTS.map((p) => (
          <View key={p.key} style={{ flex: mix[p.key] / total, backgroundColor: p.color }} />
        ))}
      </View>
      <View style={styles.legend}>
        {PARTS.map((p) => (
          <View key={p.key} style={styles.item}>
            <View style={[styles.dot, { backgroundColor: p.color }]} />
            <Text style={styles.label}>{p.label}</Text>
            <Text style={styles.val}>
              {Math.round(mix[p.key]).toLocaleString('da-DK')} MW
            </Text>
            <Text style={styles.pct}>{Math.round((mix[p.key] / total) * 100)} %</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 14, borderRadius: 7, overflow: 'hidden', flexDirection: 'row', gap: 2 },
  legend: { marginTop: 12, gap: 6 },
  item: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  label: { color: C.text, fontSize: 13, flex: 1 },
  val: { color: C.dim, fontSize: 13, fontVariant: ['tabular-nums'], width: 90, textAlign: 'right' },
  pct: { color: C.text, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'], width: 44, textAlign: 'right' },
});
