import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Loading, Logo, SectionTitle } from '@/components/Bits';
import { Card } from '@/components/Card';
import { Hero } from '@/components/Hero';
import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { ExpenseSheet } from '@/features/expenses';
import { InviteCard, PendingEventCard, PendingExpenseCard } from '@/features/requests';
import { EventSheet } from '@/features/schedule';
import { useAuth } from '@/lib/auth';
import { greeting, relativeDay, rupiah, time } from '@/lib/format';
import { useRefreshOnFocus } from '@/lib/hooks';
import { who } from '@/lib/labels';
import { useHome } from '@/lib/queries';
import type { Expense, HandoffEvent, Home } from '@/lib/types';
import { colors, fonts, radius } from '@/theme';

export default function HomeScreen() {
  const { me } = useAuth();
  const { data: home, refetch, isRefetching } = useHome();
  useRefreshOnFocus(refetch);
  const [openEvent, setOpenEvent] = useState<HandoffEvent | null>(null);
  const [openExpense, setOpenExpense] = useState<Expense | null>(null);

  if (!me) return null;
  const pendingCount = (home?.pending_events.length ?? 0) + (home?.pending_expenses.length ?? 0);

  return (
    <>
      <Screen
        refreshing={isRefetching}
        onRefresh={refetch}
        header={
          <Hero
            decor
            left={<Logo size={38} color={colors.white} />}
            right={
              <Pressable accessibilityLabel="Your profile" onPress={() => router.push('/profile')}>
                <Avatar name={me.user.full_name} />
              </Pressable>
            }
          >
            <Text variant="title" style={styles.greeting}>
              {greeting()},
            </Text>
            <Text variant="display" style={styles.name} numberOfLines={2}>
              {me.user.first_name}!
            </Text>
          </Hero>
        }
      >
        {!home ? (
          <View style={{ height: 240 }}>
            <Loading />
          </View>
        ) : (
          <>
            {!home.partner && me.family ? <InviteCard code={me.family.invite_code} /> : null}

            {pendingCount > 0 ? (
              <>
                <SectionTitle>Needs your answer</SectionTitle>
                <View style={styles.stack}>
                  {home.pending_events.map((e) => (
                    <PendingEventCard key={`e${e.id}`} event={e} kids={home.children} onOpen={() => setOpenEvent(e)} />
                  ))}
                  {home.pending_expenses.map((x) => (
                    <PendingExpenseCard key={`x${x.id}`} expense={x} onOpen={() => setOpenExpense(x)} />
                  ))}
                </View>
              </>
            ) : home.partner ? (
              <CaughtUp home={home} />
            ) : null}

            <SectionTitle>How can we help today?</SectionTitle>
            <Grid home={home} meId={me.user.id} />

            <View style={[styles.stack, { marginTop: 14 }]}>
              <ListRow
                tile="🛡️"
                tileColor={colors.primarySoft}
                title="Shared record"
                subtitle={`${home.record_count} entries, time-stamped and sealed`}
                onPress={() => router.push('/record')}
              />
              <ListRow
                tile="🌿"
                tileColor={colors.yellowSoft}
                title="Talk to a counsellor"
                subtitle="Support for your child and for you — first session free"
                onPress={() => router.push('/support')}
              />
            </View>
          </>
        )}
      </Screen>
      <EventSheet event={openEvent} onClose={() => setOpenEvent(null)} />
      <ExpenseSheet expense={openExpense} onClose={() => setOpenExpense(null)} />
    </>
  );
}

function CaughtUp({ home }: { home: Home }) {
  return (
    <View style={styles.caughtUp}>
      <Ionicons name="checkmark-circle" size={22} color={colors.primaryDeep} />
      <View style={{ flex: 1 }}>
        <Text variant="smallStrong">You’re all caught up</Text>
        {home.waiting_on_partner > 0 ? (
          <Text variant="small" color={colors.inkMuted}>
            {home.waiting_on_partner} request{home.waiting_on_partner === 1 ? '' : 's'} waiting on {home.partner?.first_name}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Grid({ home, meId }: { home: Home; meId: number }) {
  const next = home.next_handoff;
  const partner = home.partner?.first_name ?? 'your co-parent';
  const child = home.children[0]?.name ?? 'Child';
  const balance = home.balance.amount;

  return (
    <View style={styles.grid}>
      <View style={styles.column}>
        <Card color={colors.pink} onPress={() => router.push('/schedule')} style={[styles.tile, styles.tall]}>
          <Text variant="label" color={colors.white} style={{ opacity: 0.9 }}>
            Next handoff
          </Text>
          <View style={styles.tileBottom}>
            {next ? (
              <>
                <Text variant="heading" color={colors.white}>
                  {relativeDay(next.starts_at)}
                </Text>
                <Text variant="heading" color={colors.white}>
                  {time(next.starts_at)}
                </Text>
                <Text variant="small" color={colors.white} numberOfLines={2} style={{ opacity: 0.92 }}>
                  To {who(next.to_parent, meId)} · {next.location}
                </Text>
              </>
            ) : (
              <>
                <Text variant="heading" color={colors.white}>
                  Plan the next handoff
                </Text>
                <Text variant="small" color={colors.white} style={{ opacity: 0.92 }}>
                  Nothing confirmed yet
                </Text>
              </>
            )}
          </View>
        </Card>
        <Card onPress={() => router.push('/expenses')} style={[styles.tile, styles.short]}>
          <Text variant="label" color={colors.inkFaint}>
            Balance
          </Text>
          <View style={styles.tileBottom}>
            <Text variant="smallStrong" color={colors.inkMuted}>
              {balance === 0 ? 'All settled' : balance > 0 ? `${partner} owes you` : `You owe ${partner}`}
            </Text>
            <Text variant="heading" color={balance < 0 ? colors.pinkDeep : colors.ink}>
              {rupiah(Math.abs(balance))}
            </Text>
          </View>
        </Card>
      </View>
      <View style={styles.column}>
        <Card onPress={() => router.push('/messages')} style={[styles.tile, styles.short]}>
          <Text variant="label" color={colors.inkFaint}>
            Messages
          </Text>
          <View style={styles.tileBottom}>
            <Text variant="heading">Chat with {partner}</Text>
            <Text variant="smallStrong" color={home.unread_messages ? colors.pinkDeep : colors.inkMuted}>
              {home.unread_messages ? `${home.unread_messages} new` : 'No new messages'}
            </Text>
          </View>
        </Card>
        <Card color={colors.yellow} onPress={() => router.push('/child')} style={[styles.tile, styles.tall]}>
          <Text variant="label" color={colors.ink} style={{ opacity: 0.7 }}>
            {child}’s info
          </Text>
          <View style={styles.tileBottom}>
            <Text variant="heading">Health, school & contacts</Text>
            <Text variant="small" color={colors.ink} style={{ opacity: 0.75 }}>
              Kept up to date by both of you
            </Text>
          </View>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  greeting: { fontFamily: fonts.medium, fontSize: 24, marginTop: 4, maxWidth: '62%' },
  name: { maxWidth: '62%' },
  stack: { gap: 12 },
  caughtUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryTint,
  },
  grid: { flexDirection: 'row', gap: 14 },
  column: { flex: 1, gap: 14 },
  tile: { padding: 18, borderRadius: radius.xl, justifyContent: 'space-between' },
  tall: { minHeight: 196 },
  short: { minHeight: 160 },
  tileBottom: { gap: 4 },
});
