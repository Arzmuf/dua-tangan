import { Image, StyleSheet, View, type ImageStyle, type StyleProp } from 'react-native';
import type { ReactNode } from 'react';

import { initials } from '@/lib/format';
import { colors, textOn } from '@/theme';
import { Button } from './Button';
import { Text } from './Text';

export function Avatar({ name, size = 44, color = colors.accent }: { name: string; size?: number; color?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2.4, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.38, lineHeight: size * 0.5 }} variant="bodyStrong" color={textOn(color)}>
        {initials(name)}
      </Text>
    </View>
  );
}

const logo = require('../../assets/logo-hands.png');

export function Logo({ size = 40, color = colors.white, style }: { size?: number; color?: string; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={logo}
      accessibilityLabel="Dua Tangan"
      style={[{ width: size, height: size * 0.75, tintColor: color }, style]}
      resizeMode="contain"
    />
  );
}

export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="heading">{children}</Text>
      {action}
    </View>
  );
}

export function EmptyState({
  emoji,
  title,
  text,
  action,
}: {
  emoji: string;
  title: string;
  text?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyTile}>
        <Text style={{ fontSize: 34, lineHeight: 42 }}>{emoji}</Text>
      </View>
      <Text variant="subheading" center>
        {title}
      </Text>
      {text ? (
        <Text variant="small" color={colors.inkMuted} center style={{ maxWidth: 280 }}>
          {text}
        </Text>
      ) : null}
      {action ? <Button title={action.label} onPress={action.onPress} variant="soft" size="sm" style={{ marginTop: 6 }} /> : null}
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <Logo size={56} color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 26,
    marginBottom: 12,
  },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28, paddingHorizontal: 20 },
  emptyTile: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
