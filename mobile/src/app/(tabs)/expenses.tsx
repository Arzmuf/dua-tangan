import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState, Loading, SectionTitle } from '@/components/Bits';
import { Hero } from '@/components/Hero';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { ExpenseRow, ExpenseSheet, NewExpenseSheet } from '@/features/expenses';
import { rupiah } from '@/lib/format';
import { useRefreshOnFocus } from '@/lib/hooks';
import { useExpenses } from '@/lib/queries';
import { radius } from '@/theme';

export default function ExpensesScreen() {
  const { data, refetch, isRefetching, isLoading } = useExpenses();
  useRefreshOnFocus(refetch);
  const [openId, setOpenId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const groups = useMemo(() => {
    const list = data?.expenses ?? [];
    return [
      { title: 'Waiting for approval', items: list.filter((x) => x.status === 'pending') },
      { title: 'To settle', items: list.filter((x) => x.status === 'approved') },
      { title: 'Settled', items: list.filter((x) => x.status === 'settled').slice(0, 10) },
    ].filter((g) => g.items.length);
  }, [data]);

  const balance = data?.balance.amount ?? 0;
  const partner = data?.balance.partner?.first_name ?? 'your co-parent';
  const open = data?.expenses.find((x) => x.id === openId) ?? null;

  return (
    <>
      <Screen
        refreshing={isRefetching}
        onRefresh={refetch}
        header={
          <Hero title="Expenses" fab={{ icon: 'add', label: 'Add an expense', onPress: () => setCreating(true) }}>
            <View style={styles.balance}>
              <Text variant="label" style={{ opacity: 0.8 }}>
                {balance === 0 ? 'Balance' : balance > 0 ? `${partner} owes you` : `You owe ${partner}`}
              </Text>
              <Text variant="display">{balance === 0 ? 'All settled' : rupiah(Math.abs(balance))}</Text>
              <Text variant="small" style={{ opacity: 0.75 }}>
                Only approved expenses count towards the balance.
              </Text>
            </View>
          </Hero>
        }
      >
        {isLoading ? (
          <View style={{ height: 240 }}>
            <Loading />
          </View>
        ) : groups.length === 0 ? (
          <EmptyState
            emoji="🧾"
            title="No shared expenses yet"
            text={`Add school fees, doctor visits or new shoes — ${partner} approves, then you settle up.`}
            action={{ label: 'Add an expense', onPress: () => setCreating(true) }}
          />
        ) : (
          groups.map((g) => (
            <View key={g.title}>
              <SectionTitle>{g.title}</SectionTitle>
              <View style={styles.list}>
                {g.items.map((x) => (
                  <ExpenseRow key={x.id} expense={x} onPress={() => setOpenId(x.id)} />
                ))}
              </View>
            </View>
          ))
        )}
      </Screen>
      <ExpenseSheet expense={open} onClose={() => setOpenId(null)} />
      <NewExpenseSheet visible={creating} onClose={() => setCreating(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  balance: {
    marginTop: 14,
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.12)',
    gap: 2,
    marginRight: 40,
  },
  list: { gap: 12 },
});
