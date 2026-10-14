import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, shadow } from '@/theme';

type Props = { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; color?: string };

export function Card({ children, onPress, style, color = colors.surface }: Props) {
  if (!onPress) return <View style={[styles.card, { backgroundColor: color }, style]}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: color, opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: 18, ...shadow.card },
});
