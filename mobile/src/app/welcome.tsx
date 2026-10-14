import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo } from '@/components/Bits';
import { Button } from '@/components/Button';
import { Decor } from '@/components/Hero';
import { Text } from '@/components/Text';
import { colors, radius, shadow } from '@/theme';

const FEATURES = [
  { emoji: '📅', tint: colors.yellowSoft, title: 'Plan handoffs together', text: 'Every change is agreed by both of you.' },
  { emoji: '💸', tint: colors.pinkSoft, title: 'Split costs fairly', text: 'Add an expense, approve it, settle up.' },
  { emoji: '💬', tint: colors.primarySoft, title: 'Talk calmly', text: 'A gentle tone check before you send.' },
];

export default function Welcome() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      <View style={[styles.hero, { paddingTop: insets.top + 28 }]}>
        <Decor placement="top" />
        <Logo size={58} color={colors.white} />
        <Text variant="display" style={styles.headline}>
          Two homes,{'\n'}one calm place.
        </Text>
        <Text variant="body" style={styles.lead}>
          Handoffs, shared costs and conversations about your child — in one record you both trust.
        </Text>
      </View>

      <View style={styles.body}>
        {FEATURES.map((f) => (
          <View key={f.title} style={styles.feature}>
            <View style={[styles.tile, { backgroundColor: f.tint }]}>
              <Text style={styles.emoji}>{f.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="subheading">{f.title}</Text>
              <Text variant="small" color={colors.inkMuted}>
                {f.text}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Button title="Create an account" size="lg" onPress={() => router.push('/register')} />
        <Button title="I already have an account" size="lg" variant="outline" onPress={() => router.push('/login')} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1 },
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: 28,
    paddingBottom: 48,
    borderBottomLeftRadius: radius.hero,
    borderBottomRightRadius: radius.hero,
  },
  headline: { marginTop: 26 },
  lead: { marginTop: 12, maxWidth: 300, opacity: 0.85 },
  body: { padding: 24, gap: 14, width: '100%', maxWidth: 560, alignSelf: 'center' },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    ...shadow.card,
  },
  tile: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 24, lineHeight: 30 },
  actions: { marginTop: 'auto', paddingHorizontal: 24, gap: 12, width: '100%', maxWidth: 560, alignSelf: 'center' },
});
