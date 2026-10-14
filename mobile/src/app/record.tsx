import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState, Loading } from '@/components/Bits';
import { Button } from '@/components/Button';
import { Chips } from '@/components/Chips';
import { Hero } from '@/components/Hero';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { dayTime } from '@/lib/format';
import { useRecord } from '@/lib/queries';
import { exportReport } from '@/lib/report';
import { colors, radius } from '@/theme';

const KIND_ICON: Record<string, string> = {
  schedule: '📅',
  expense: '💸',
  message: '💬',
  info: '📝',
  family: '🏠',
  support: '🌿',
};

export default function RecordScreen() {
  const toast = useToast();
  const [filter, setFilter] = useState<'all' | 'flagged'>('all');
  const { data, refetch, isRefetching, isLoading } = useRecord(filter === 'flagged');
  const [exporting, setExporting] = useState(false);

  const onExport = async () => {
    setExporting(true);
    try {
      await exportReport();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  const v = data?.verification;

  return (
    <Screen
      withTabBar={false}
      refreshing={isRefetching}
      onRefresh={refetch}
      header={
        <Hero
          color={colors.primary}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          title="Shared record"
          subtitle="Every handoff, expense and message is time-stamped and sealed. Nobody can quietly edit the past."
        />
      }
    >
      {v ? (
        <View style={[styles.verify, { backgroundColor: v.valid ? colors.primarySoft : colors.pinkSoft }]}>
          <Ionicons name={v.valid ? 'shield-checkmark' : 'warning'} size={26} color={v.valid ? colors.primaryDeep : colors.pinkDeep} />
          <View style={{ flex: 1 }}>
            <Text variant="smallStrong" color={v.valid ? colors.primaryDeep : colors.pinkDeep}>
              {v.valid ? 'Integrity verified' : `Integrity check failed at entry #${v.broken_seq}`}
            </Text>
            <Text variant="small" color={colors.inkMuted}>
              {v.valid ? `All ${v.count} entries match their seals.` : 'An entry was changed after it was recorded.'}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.toolbar}>
        <View style={{ flex: 1 }}>
          <Chips
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: `All · ${data?.count ?? 0}` },
              { value: 'flagged', label: `Heated · ${data?.flagged_count ?? 0}` },
            ]}
          />
        </View>
      </View>

      {isLoading ? (
        <View style={{ height: 200 }}>
          <Loading />
        </View>
      ) : !data?.entries.length ? (
        <EmptyState emoji="🛡️" title={filter === 'flagged' ? 'No heated messages' : 'Nothing recorded yet'} />
      ) : (
        <View style={styles.timeline}>
          {data.entries.map((e, i) => (
            <View key={e.id} style={styles.entry}>
              <View style={styles.rail}>
                <View style={[styles.dot, e.flagged && { backgroundColor: colors.pink }]}>
                  <Text style={{ fontSize: 13, lineHeight: 16 }}>{KIND_ICON[e.kind] ?? '•'}</Text>
                </View>
                {i < data.entries.length - 1 ? <View style={styles.line} /> : null}
              </View>
              <View style={styles.entryBody}>
                <Text variant="tiny" color={colors.inkFaint}>
                  {dayTime(e.created_at)}
                </Text>
                <Text variant="small" color={colors.ink}>
                  {e.summary}
                </Text>
                <View style={styles.entryMeta}>
                  <Text variant="mono" color={colors.inkFaint}>
                    #{e.hash.slice(0, 8)}
                  </Text>
                  {e.flagged ? (
                    <Text variant="tiny" color={colors.pinkDeep}>
                      Heated tone
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      <Button
        title="Export report (PDF)"
        icon="document-text-outline"
        size="lg"
        loading={exporting}
        onPress={onExport}
        style={{ marginTop: 20 }}
      />
      <Text variant="tiny" color={colors.inkFaint} center style={{ marginTop: 8 }}>
        A printable copy with every entry and its seal, ready for a mediator or lawyer.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  verify: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.lg, marginTop: 18 },
  toolbar: { flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 6 },
  timeline: { marginTop: 10 },
  entry: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', width: 32 },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 4 },
  entryBody: { flex: 1, paddingBottom: 18, gap: 3 },
  entryMeta: { flexDirection: 'row', gap: 10, alignItems: 'center' },
});
