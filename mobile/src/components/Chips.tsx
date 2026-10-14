import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme';
import { Text } from './Text';

export type ChipOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: ChipOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  scroll?: boolean;
  size?: 'md' | 'lg';
};

/** A row of selectable chips (single choice). */
export function Chips<T extends string>({ options, value, onChange, scroll, size = 'md' }: Props<T>) {
  const chips = options.map((o) => {
    const selected = o.value === value;
    return (
      <Pressable
        key={o.value}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => onChange(o.value)}
        style={({ pressed }) => [
          styles.chip,
          size === 'lg' && styles.chipLg,
          selected ? styles.selected : styles.idle,
          !scroll && styles.grow,
          pressed && { opacity: 0.8 },
        ]}
      >
        <Text variant="smallStrong" color={selected ? colors.white : colors.primaryDeep} center numberOfLines={1}>
          {o.label}
        </Text>
      </Pressable>
    );
  });

  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {chips}
      </ScrollView>
    );
  }
  return <View style={[styles.row, styles.wrap]}>{chips}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  wrap: { flexWrap: 'wrap' },
  grow: { flexGrow: 1 },
  chip: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLg: { height: 48, borderRadius: radius.md, paddingHorizontal: 18 },
  selected: { backgroundColor: colors.primaryDeep },
  idle: { backgroundColor: colors.primarySoft },
});
