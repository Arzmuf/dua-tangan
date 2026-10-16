import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';
import { Text } from './Text';

export type PillTone = 'ok' | 'wait' | 'warn' | 'neutral' | 'info';

const tones: Record<PillTone, { bg: string; fg: string }> = {
  ok: { bg: colors.primarySoft, fg: colors.primaryDeep },
  wait: { bg: colors.accentSoft, fg: colors.accentDeep },
  warn: { bg: colors.dangerSoft, fg: colors.dangerDeep },
  neutral: { bg: colors.field, fg: colors.inkMuted },
  info: { bg: colors.primaryTint, fg: colors.primaryDeep },
};

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: PillTone }) {
  const t = tones[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      <Text variant="tiny" color={t.fg} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
});
