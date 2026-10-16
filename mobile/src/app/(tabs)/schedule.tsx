import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState, Loading, SectionTitle } from '@/components/Bits';
import { Hero } from '@/components/Hero';
import { Screen } from '@/components/Screen';
import { EventRow, EventSheet, NewHandoffSheet } from '@/features/schedule';
import { MONTHS_LONG } from '@/lib/format';
import { useNow, useRefreshOnFocus } from '@/lib/hooks';
import { useEvents, useHome } from '@/lib/queries';
import type { HandoffEvent } from '@/lib/types';
import { colors } from '@/theme';

const THREE_HOURS = 3 * 3_600_000;

export default function ScheduleScreen() {
  const { data: events, refetch, isRefetching, isLoading } = useEvents();
  const { data: home } = useHome();
  useRefreshOnFocus(refetch);
  const [openId, setOpenId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const now = useNow();

  const { months, past } = useMemo(() => {
    const upcoming: HandoffEvent[] = [];
    const done: HandoffEvent[] = [];
    for (const e of events ?? []) {
      const start = new Date(e.starts_at).getTime();
      if (start >= now - THREE_HOURS || e.actions.check_in) upcoming.push(e);
      else done.push(e);
    }
    const groups = new Map<string, HandoffEvent[]>();
    for (const e of upcoming) {
      const d = new Date(e.starts_at);
      const key = `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
      groups.set(key, [...(groups.get(key) ?? []), e]);
    }
    return { months: [...groups.entries()], past: done.reverse().slice(0, 5) };
  }, [events, now]);

  const open = events?.find((e) => e.id === openId) ?? null;
  const partner = home?.partner?.first_name ?? 'your co-parent';

  return (
    <>
      <Screen
        refreshing={isRefetching}
        onRefresh={refetch}
        header={
          <Hero
            color={colors.accent}
            title="Schedule"
            subtitle={`Handoffs you and ${partner} have agreed on — and the ones waiting.`}
            fab={{ icon: 'add', label: 'Propose a handoff', onPress: () => setCreating(true) }}
          />
        }
      >
        {isLoading ? (
          <View style={{ height: 240 }}>
            <Loading />
          </View>
        ) : months.length === 0 ? (
          <EmptyState
            emoji="📅"
            title="No handoffs planned"
            text={`Propose the next handoff and ${partner} confirms it here.`}
            action={{ label: 'Propose a handoff', onPress: () => setCreating(true) }}
          />
        ) : (
          months.map(([month, list]) => (
            <View key={month}>
              <SectionTitle>{month}</SectionTitle>
              <View style={styles.list}>
                {list.map((e) => (
                  <EventRow key={e.id} event={e} onPress={() => setOpenId(e.id)} />
                ))}
              </View>
            </View>
          ))
        )}
        {past.length ? (
          <>
            <SectionTitle>Recently</SectionTitle>
            <View style={styles.list}>
              {past.map((e) => (
                <EventRow key={e.id} event={e} past onPress={() => setOpenId(e.id)} />
              ))}
            </View>
          </>
        ) : null}
      </Screen>
      <EventSheet event={open} onClose={() => setOpenId(null)} />
      <NewHandoffSheet visible={creating} onClose={() => setCreating(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
});
