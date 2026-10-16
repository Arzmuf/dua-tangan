import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, shadow } from '@/theme';
import { Text } from './Text';

type Props = {
  tile: ReactNode;
  tileColor?: string;
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
};

/** Reference-style row: a square coloured tile next to a white card. */
export function ListRow({ tile, tileColor = colors.primarySoft, title, subtitle, meta, right, onPress, chevron = true }: Props) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.tile, { backgroundColor: tileColor }]}>
        {typeof tile === 'string' ? <Text style={styles.emoji}>{tile}</Text> : tile}
      </View>
      <View style={styles.card}>
        <View style={styles.text}>
          <Text variant="subheading" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="small" color={colors.inkMuted} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
          {meta}
        </View>
        {right}
        {chevron && onPress ? <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} /> : null}
      </View>
    </Pressable>
  );
}

export function DateTile({ date, tone = 'default' }: { date: Date; tone?: 'default' | 'muted' }) {
  const fg = tone === 'muted' ? colors.inkFaint : colors.ink;
  return (
    <View style={styles.dateTile}>
      <Text variant="label" color={fg}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]}
      </Text>
      <Text variant="title" color={fg} style={{ lineHeight: 30 }}>
        {date.getDate()}
      </Text>
      <Text variant="tiny" color={fg}>
        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  tile: {
    width: 76,
    minHeight: 76,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 32, lineHeight: 40 },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...shadow.card,
  },
  text: { flex: 1, gap: 3 },
  dateTile: { alignItems: 'center' },
});
