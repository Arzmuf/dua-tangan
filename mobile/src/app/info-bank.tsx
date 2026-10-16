import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState, Loading, SectionTitle } from '@/components/Bits';
import { Button } from '@/components/Button';
import { Chips } from '@/components/Chips';
import { Hero } from '@/components/Hero';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { DocumentRow, UploadSheet } from '@/features/documents';
import { dayTime } from '@/lib/format';
import { useDocuments, useRecord } from '@/lib/queries';
import { exportReport } from '@/lib/report';
import type { RecordEntry } from '@/lib/types';
import { colors, radius } from '@/theme';

const KIND_ICON: Record<string, string> = {
  schedule: '📅',
  expense: '💸',
  message: '💬',
  info: '📝',
  family: '🏠',
  support: '🌿',
  document: '📎',
};

type Tab = 'all' | 'messages' | 'expenses' | 'calendar' | 'health' | 'documents';

// Each tab is a view of the same sealed record, by kind of entry.
const TABS: { key: Tab; label: string; kinds: string[]; empty: string }[] = [
  { key: 'all', label: 'All', kinds: [], empty: 'Nothing recorded yet' },
  { key: 'messages', label: 'Messages', kinds: ['message'], empty: 'No messages yet' },
  { key: 'expenses', label: 'Expenses', kinds: ['expense'], empty: 'No expenses yet' },
  { key: 'calendar', label: 'Calendar', kinds: ['schedule', 'support'], empty: 'No handoffs or events yet' },
  { key: 'health', label: 'Health & notes', kinds: ['info', 'family'], empty: 'No health details or notes yet' },
  { key: 'documents', label: 'Documents', kinds: ['document'], empty: 'No document history yet' },
];

export default function InfoBankScreen() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('all');
  const [heatedOnly, setHeatedOnly] = useState(false);
  const current = TABS.find((t) => t.key === tab) ?? TABS[0];
  const { data, refetch, isRefetching, isLoading } = useRecord(current.kinds, tab === 'messages' && heatedOnly);
  const { data: documents } = useDocuments();
  const [uploading, setUploading] = useState(false);
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

  const countOf = (t: (typeof TABS)[number]) =>
    t.key === 'all' ? (data?.count ?? 0) : t.key === 'documents' ? (documents?.length ?? 0) : t.kinds.reduce((n, k) => n + (data?.kind_counts[k] ?? 0), 0);
  const v = data?.verification;

  return (
    <>
      <Screen
        withTabBar={false}
        refreshing={isRefetching}
        onRefresh={refetch}
        header={
          <Hero
            color={colors.primary}
            onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            title="Info bank"
            subtitle="Messages, expenses, plans, health notes and documents, time-stamped and sealed. Nobody can quietly edit the past."
          />
        }
      >
        {v ? (
          <View style={[styles.verify, { backgroundColor: v.valid ? colors.primarySoft : colors.dangerSoft }]}>
            <Ionicons name={v.valid ? 'shield-checkmark' : 'warning'} size={26} color={v.valid ? colors.primaryDeep : colors.dangerDeep} />
            <View style={{ flex: 1 }}>
              <Text variant="smallStrong" color={v.valid ? colors.primaryDeep : colors.dangerDeep}>
                {v.valid ? 'Integrity verified' : `Integrity check failed at entry #${v.broken_seq}`}
              </Text>
              <Text variant="small" color={colors.inkMuted}>
                {v.valid ? `All ${v.count} entries match their seals.` : 'An entry was changed after it was recorded.'}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.tabs}>
          <Chips scroll value={tab} onChange={setTab} options={TABS.map((t) => ({ value: t.key, label: `${t.label} · ${countOf(t)}` }))} />
        </View>

        {tab === 'messages' ? (
          <View style={styles.subTabs}>
            <Chips
              value={heatedOnly ? 'heated' : 'all'}
              onChange={(value) => setHeatedOnly(value === 'heated')}
              options={[
                { value: 'all', label: 'All messages' },
                { value: 'heated', label: `Heated · ${data?.flagged_count ?? 0}` },
              ]}
            />
          </View>
        ) : null}

        {tab === 'documents' ? (
          <>
            <Button title="Add a document" icon="cloud-upload-outline" size="lg" onPress={() => setUploading(true)} style={{ marginTop: 12 }} />
            <Text variant="tiny" color={colors.inkFaint} center style={{ marginTop: 8 }}>
              Birth certificates, medical letters, school reports, agreements… Each file’s fingerprint is sealed below.
            </Text>
            {documents?.length ? (
              <View style={styles.docs}>
                {documents.map((d) => (
                  <DocumentRow key={d.id} doc={d} />
                ))}
              </View>
            ) : (
              <EmptyState emoji="🗂️" title="No documents yet" text="Keep important papers here so you both always have the latest copy." />
            )}
            <SectionTitle>History</SectionTitle>
          </>
        ) : null}

        {isLoading ? (
          <View style={{ height: 200 }}>
            <Loading />
          </View>
        ) : !data?.entries.length ? (
          <EmptyState emoji="🛡️" title={heatedOnly && tab === 'messages' ? 'No heated messages' : current.empty} />
        ) : (
          <Timeline entries={data.entries} />
        )}

        <Button
          title="Export report (PDF)"
          icon="document-text-outline"
          variant={tab === 'documents' ? 'outline' : 'primary'}
          size="lg"
          loading={exporting}
          onPress={onExport}
          style={{ marginTop: 20 }}
        />
        <Text variant="tiny" color={colors.inkFaint} center style={{ marginTop: 8 }}>
          A printable copy of every entry and its seal, ready for a mediator or lawyer.
        </Text>
      </Screen>
      <UploadSheet visible={uploading} onClose={() => setUploading(false)} />
    </>
  );
}

function Timeline({ entries }: { entries: RecordEntry[] }) {
  return (
    <View style={styles.timeline}>
      {entries.map((e, i) => (
        <View key={e.id} style={styles.entry}>
          <View style={styles.rail}>
            <View style={[styles.dot, e.flagged && { backgroundColor: colors.danger }]}>
              <Text style={{ fontSize: 13, lineHeight: 16 }}>{KIND_ICON[e.kind] ?? '•'}</Text>
            </View>
            {i < entries.length - 1 ? <View style={styles.line} /> : null}
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
                <Text variant="tiny" color={colors.dangerDeep}>
                  Heated tone
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  verify: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.lg, marginTop: 18 },
  tabs: { marginTop: 18 },
  subTabs: { marginTop: 10 },
  docs: { gap: 12, marginTop: 16 },
  timeline: { marginTop: 14 },
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
