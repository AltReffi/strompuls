import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { C } from '../theme';
import { co2Color, co2Label, kr } from '../util';

type Props = {
  co2: number | null;
  price: number | null;
  greenShare: number | null; // 0..1
  caption: string;
  forecast?: boolean;
};

const SIZE = 260;
const R = 112;
const CIRC = 2 * Math.PI * R;

export function PulseOrb({ co2, price, greenShare, caption, forecast }: Props) {
  const [pulse] = useState(() => new Animated.Value(0));
  const color = co2Color(co2);

  // Dyrere strøm → hurtigere puls.
  const period = Math.max(900, 2600 - (price ?? 1) * 700);
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: period / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 0, duration: period / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [period, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.06] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.95] });
  const share = greenShare ?? 0;

  return (
    <View style={styles.wrap}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale }], opacity }]}>
        <Svg width={SIZE} height={SIZE}>
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={color} stopOpacity={0.55} />
              <Stop offset="0.55" stopColor={color} stopOpacity={0.18} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 2} fill="url(#glow)" />
        </Svg>
      </Animated.View>
      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="rgba(255,255,255,0.08)" strokeWidth={6} fill="rgba(5,7,15,0.55)" />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${CIRC * share} ${CIRC}`}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={styles.caption}>{caption}</Text>
        <Text style={[styles.big, { color }]}>
          {co2 == null ? '–' : Math.round(co2)}
          <Text style={styles.unit}> g</Text>
        </Text>
        <Text style={styles.sub}>
          CO₂/kWh · {co2Label(co2)}
          {forecast ? ' (prognose)' : ''}
        </Text>
        <View style={styles.divider} />
        <Text style={styles.price}>
          {kr(price)} <Text style={styles.priceUnit}>kr/kWh</Text>
        </Text>
        {greenShare != null && (
          <Text style={styles.share}>{Math.round(share * 100)} % vind + sol lige nu</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center' },
  caption: { color: C.dim, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 },
  big: { fontSize: 56, fontWeight: '800', letterSpacing: -2, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 20, fontWeight: '600' },
  sub: { color: C.dim, fontSize: 12, marginTop: -2 },
  divider: { width: 40, height: 1, backgroundColor: C.cardBorder, marginVertical: 8 },
  price: { color: C.text, fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  priceUnit: { fontSize: 13, color: C.dim, fontWeight: '500' },
  share: { color: C.faint, fontSize: 11, marginTop: 4 },
});
