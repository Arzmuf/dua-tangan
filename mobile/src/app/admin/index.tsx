import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chips } from '@/components/Chips';
import { Hero } from '@/components/Hero';
import { Screen } from '@/components/Screen';
import { EventsPanel, Stat, UsersPanel } from '@/features/admin';
import { useAuth } from '@/lib/auth';
import { rupiah } from '@/lib/format';
import { useAdminStats } from '@/lib/queries';
import { colors } from '@/theme';

export default function AdminScreen() {
  const { me, signOut } = useAuth();
  const { data: stats, refetch, isRefetching } = useAdminStats();
  const [tab, setTab] = useState<'users' | 'events'>('users');

  return (
    <Screen
      withTabBar={false}
      refreshing={isRefetching}
      onRefresh={refetch}
      header={
        <Hero
          color={colors.primaryDeep}
          onBack={router.canGoBack() ? () => router.back() : undefined}
          right={<Button title="Sign out" size="sm" variant="light" onPress={signOut} />}
          title="Admin"
          subtitle={`Signed in as ${me?.user.email ?? ''}. Manage accounts and the events parents can book.`}
        />
      }
    >
      <View style={styles.stats}>
        <Stat label="Parents" value={stats?.parents} />
        <Stat label="Families" value={stats?.families} />
        <Stat label="Upcoming events" value={stats?.upcoming_programs} />
        <Stat label="Bookings" value={stats?.bookings} note={stats ? `${rupiah(stats.revenue)} (demo payments)` : undefined} />
      </View>
      <View style={{ marginTop: 20 }}>
        <Chips
          size="lg"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'users', label: 'Users' },
            { value: 'events', label: 'Events' },
          ]}
        />
      </View>
      {tab === 'users' ? <UsersPanel /> : <EventsPanel />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 },
});
