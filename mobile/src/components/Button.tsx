import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, radius } from '@/theme';
import { Text } from './Text';

type Variant = 'primary' | 'soft' | 'outline' | 'ghost' | 'danger' | 'light';
type IconName = ComponentProps<typeof Ionicons>['name'];

const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: colors.white },
  soft: { bg: colors.primarySoft, fg: colors.primaryDeep },
  outline: { bg: colors.surface, fg: colors.ink, border: colors.border },
  ghost: { bg: 'transparent', fg: colors.primaryDeep },
  danger: { bg: colors.dangerSoft, fg: colors.dangerDeep },
  light: { bg: 'rgba(255,255,255,0.85)', fg: colors.ink },
};

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, onPress, variant = 'primary', size = 'md', icon, loading, disabled, style }: Props) {
  const p = palette[variant];
  const height = size === 'sm' ? 38 : size === 'lg' ? 56 : 48;
  const inactive = disabled || loading;

  const handlePress = () => {
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    onPress?.();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive }}
      disabled={inactive}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          paddingHorizontal: size === 'sm' ? 14 : 20,
          backgroundColor: p.bg,
          borderColor: p.border ?? 'transparent',
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={p.fg} /> : null}
          <Text
            style={{ fontFamily: fonts.bold, fontSize: size === 'sm' ? 13 : 15 }}
            color={p.fg}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  color = colors.ink,
  background = 'rgba(255,255,255,0.7)',
  size = 40,
  label,
}: {
  icon: IconName;
  onPress?: () => void;
  color?: string;
  background?: string;
  size?: number;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.icon,
        { width: size, height: size, borderRadius: size / 2.6, backgroundColor: background, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={icon} size={size * 0.5} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { alignItems: 'center', justifyContent: 'center' },
});
