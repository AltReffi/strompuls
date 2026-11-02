import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

/** Vindmølle der drejer i takt med den faktiske vind (m/s). */
export function Turbine({ wind, size = 56, color = '#e2e8f0' }: { wind: number; size?: number; color?: string }) {
  const [spin] = useState(() => new Animated.Value(0));
  const msPerTurn = Math.max(700, Math.min(9000, 14000 / Math.max(wind, 0.5)));

  useEffect(() => {
    spin.setValue(0);
    const anim = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: msPerTurn, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' }),
    );
    anim.start();
    return () => anim.stop();
  }, [msPerTurn, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const h = size * 1.5;
  const blade = `M0 0 C ${size * 0.05} ${-size * 0.12}, ${size * 0.04} ${-size * 0.38}, 0 ${-size * 0.46} C ${-size * 0.03} ${-size * 0.3}, ${-size * 0.04} ${-size * 0.1}, 0 0 Z`;

  return (
    <View style={{ width: size, height: h }}>
      <Svg width={size} height={h} style={{ position: 'absolute' }}>
        <Line x1={size / 2} y1={size / 2} x2={size / 2} y2={h} stroke={color} strokeOpacity={0.6} strokeWidth={2.5} strokeLinecap="round" />
      </Svg>
      <Animated.View style={{ position: 'absolute', width: size, height: size, transform: [{ rotate }] }}>
        <Svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}>
          {[0, 120, 240].map((a) => (
            <Path key={a} d={blade} fill={color} transform={`rotate(${a})`} />
          ))}
          <Circle r={size * 0.05} fill={color} />
        </Svg>
      </Animated.View>
    </View>
  );
}
