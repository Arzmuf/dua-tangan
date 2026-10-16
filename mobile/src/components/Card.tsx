import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, shadow, textOn } from '@/theme';
import { TextColorProvider } from './Text';

type Props = { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; color?: string };

export function Card({ children, onPress, style, color = colors.surface }: Props) {
  const content = <TextColorProvider value={textOn(color)}>{children}</TextColorProvider>;
  if (!onPress) return <View style={[styles.card, { backgroundColor: color }, style]}>{content}</View>;
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
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: 18, ...shadow.card },
});
