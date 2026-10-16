import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { Avatar, EmptyState, Loading, SectionTitle } from '@/components/Bits';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Hero } from '@/components/Hero';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { CheckoutSheet, formatLabel, priceLabel, SEKALA_JIWA_LOGO, timeRange, TOPICS } from '@/features/programs';
import { day } from '@/lib/format';
import { useBookings, useProgram } from '@/lib/queries';
import { colors } from '@/theme';

export default function ProgramScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: p, isLoading, refetch, isRefetching } = useProgram(Number(id));
  const { data: bookings } = useBookings();
  const [checkout, setCheckout] = useState(false);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/support'));

  if (!p) {
    return (
      <Screen withTabBar={false} header={<Hero onBack={back} title="Event" />}>
        {isLoading ? <Loading /> : <EmptyState emoji="🗓️" title="This event isn’t available" text="It may have been removed." />}
      </Screen>
    );
  }

  const topic = TOPICS[p.topic];
  const mine = (bookings ?? []).filter((b) => b.program.id === p.id);
  const started = new Date(p.starts_at) <= new Date();
  const soldOut = p.spots_left === 0;

  return (
    <>
      <Screen
        withTabBar={false}
        refreshing={isRefetching}
        onRefresh={refetch}
        header={
          <Hero color={topic.color} onBack={back}>
            <View style={styles.host}>
              <Image source={SEKALA_JIWA_LOGO} style={styles.hostLogo} accessibilityLabel={p.host} />
              <Text variant="label" style={{ opacity: 0.9 }}>
                {p.host} · {topic.label}
              </Text>
            </View>
            <Text variant="display">{p.title}</Text>
            <Text variant="body" style={{ marginTop: 8, opacity: 0.85 }}>
              {p.summary}
            </Text>
          </Hero>
        }
        footer={
          <View style={styles.footer}>
            <View style={{ flex: 1 }}>
              <Text variant="heading">{priceLabel(p)}</Text>
              <Text variant="small" color={colors.inkMuted}>
                {p.price ? 'per person' : 'No payment needed'}
              </Text>
            </View>
            <Button
              title={started ? 'Event started' : soldOut ? 'Sold out' : mine.length ? 'Book more' : 'Book now'}
              size="lg"
              disabled={started || soldOut}
              onPress={() => setCheckout(true)}
              style={{ flex: 1 }}
            />
          </View>
        }
      >
        {mine.length ? (
          <Card color={colors.primarySoft} style={styles.going}>
            <Text style={{ fontSize: 26, lineHeight: 32 }}>🎟️</Text>
            <View style={{ flex: 1 }}>
              <Text variant="smallStrong" color={colors.primaryDeep}>
                You’re going · {p.my_tickets} ticket{p.my_tickets === 1 ? '' : 's'}
              </Text>
              <Text variant="small" color={colors.primaryDeep}>
                Booking code {mine.map((b) => b.code).join(', ')}
              </Text>
            </View>
          </Card>
        ) : null}

        <Card style={styles.facts}>
          <Fact icon="calendar-outline" title={day(p.starts_at)} text={`${timeRange(p)} · ${p.duration_minutes} minutes`} />
          <Fact icon={p.format === 'online' ? 'videocam-outline' : 'location-outline'} title={formatLabel(p)} text={p.location} />
          <Fact
            icon="ticket-outline"
            title={priceLabel(p)}
            text={soldOut ? 'Sold out' : `${p.spots_left} of ${p.capacity} spots left`}
          />
        </Card>

        <SectionTitle>About this event</SectionTitle>
        <Text variant="body" color={colors.ink}>
          {p.description}
        </Text>

        <SectionTitle>Your practitioner</SectionTitle>
        <Card style={styles.practitioner}>
          <Avatar name={p.practitioner.name} size={52} color={colors.primary} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="subheading">{p.practitioner.name}</Text>
            <Text variant="small" color={colors.primaryDeep}>
              {p.practitioner.title}
            </Text>
            <Text variant="small" color={colors.inkMuted} style={{ marginTop: 4 }}>
              {p.practitioner.bio}
            </Text>
          </View>
        </Card>

        <SectionTitle>Refund policy</SectionTitle>
        <Card color={colors.accentSoft} style={styles.policy}>
          <Ionicons name="information-circle" size={22} color={colors.accentDeep} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="smallStrong">No refunds or cancellations</Text>
            <Text variant="small" color={colors.inkMuted}>
              Every booking is final. Once you book, your place can’t be cancelled, changed or refunded.
            </Text>
          </View>
        </Card>
        {!p.is_published ? <Pill label="No longer listed" tone="neutral" /> : null}
      </Screen>
      <CheckoutSheet program={p} visible={checkout} onClose={() => setCheckout(false)} />
    </>
  );
}

function Fact({ icon, title, text }: { icon: ComponentProps<typeof Ionicons>['name']; title: string; text: string }) {
  return (
    <View style={styles.fact}>
      <View style={styles.factIcon}>
        <Ionicons name={icon} size={20} color={colors.primaryDeep} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="smallStrong">{title}</Text>
        <Text variant="small" color={colors.inkMuted}>
          {text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  hostLogo: { width: 34, height: 34 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  going: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  facts: { gap: 16, marginTop: 18 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  factIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  practitioner: { flexDirection: 'row', gap: 14 },
  policy: { flexDirection: 'row', gap: 12 },
});
