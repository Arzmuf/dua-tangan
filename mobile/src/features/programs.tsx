import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { Button, IconButton } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chips } from '@/components/Chips';
import { Pill } from '@/components/Pill';
import { Sheet } from '@/components/Sheet';
import { Text, TextColorProvider } from '@/components/Text';
import { post } from '@/lib/api';
import { day, monthShort, rupiah, time, weekday } from '@/lib/format';
import { useAction } from '@/lib/queries';
import type { Booking, PaymentMethod, Program, ProgramTopic } from '@/lib/types';
import { colors, radius, textOn } from '@/theme';

export const SEKALA_JIWA_LOGO = require('../../assets/sekala-jiwa-logo.png');

export const TOPICS: Record<ProgramTopic, { label: string; emoji: string; color: string }> = {
  communication: { label: 'Communication', emoji: '💬', color: colors.primary },
  'co-parenting': { label: 'Co-parenting', emoji: '🤝', color: colors.primaryDeep },
  'child-wellbeing': { label: 'Child wellbeing', emoji: '🧸', color: colors.accent },
  'self-care': { label: 'Self-care', emoji: '🌿', color: colors.sky },
};

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'card', label: '💳 Card' },
  { value: 'gopay', label: 'GoPay' },
  { value: 'ovo', label: 'OVO' },
  { value: 'bank-transfer', label: '🏦 Bank transfer' },
];

export const priceLabel = (p: Program) => (p.price ? rupiah(p.price) : 'Free');
export const formatLabel = (p: Program) => (p.format === 'online' ? 'Online' : 'In person');
export const timeRange = (p: Program) => `${time(p.starts_at)}–${time(p.ends_at)}`;

/** Eventbrite-style card: a coloured banner with the date, then the essentials. */
export function ProgramCard({ program: p }: { program: Program }) {
  const topic = TOPICS[p.topic];
  return (
    <Card onPress={() => router.push(`/programs/${p.id}`)} style={styles.card}>
      <View style={[styles.banner, { backgroundColor: topic.color }]}>
        <View style={styles.dateBadge}>
          <Text variant="label" color={colors.dangerDeep}>
            {monthShort(p.starts_at)}
          </Text>
          <Text variant="title" style={{ lineHeight: 30 }}>
            {new Date(p.starts_at).getDate()}
          </Text>
        </View>
        <Text style={styles.bannerEmoji}>{topic.emoji}</Text>
        <TextColorProvider value={textOn(topic.color)}>
          <Text variant="label" style={styles.bannerTopic}>
            {topic.label}
          </Text>
        </TextColorProvider>
      </View>
      <View style={styles.cardBody}>
        <Text variant="label" color={colors.primaryDeep}>
          {weekday(p.starts_at)} · {time(p.starts_at)} · {formatLabel(p)}
        </Text>
        <Text variant="heading">{p.title}</Text>
        <Text variant="small" color={colors.inkMuted} numberOfLines={2}>
          {p.summary}
        </Text>
        <View style={styles.cardFooter}>
          <Text variant="smallStrong">{priceLabel(p)}</Text>
          <Text variant="small" color={colors.inkMuted} numberOfLines={1} style={{ flex: 1 }}>
            · {p.practitioner.name}
          </Text>
          {p.my_tickets ? <Pill label="Booked" tone="ok" /> : p.spots_left === 0 ? <Pill label="Sold out" tone="warn" /> : null}
        </View>
      </View>
    </Card>
  );
}

export function BookingRow({ booking: b }: { booking: Booking }) {
  return (
    <Card onPress={() => router.push(`/programs/${b.program.id}`)} style={styles.booking}>
      <Text style={{ fontSize: 26, lineHeight: 32 }}>🎟️</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="subheading" numberOfLines={1}>
          {b.program.title}
        </Text>
        <Text variant="small" color={colors.inkMuted}>
          {day(b.program.starts_at)} · {time(b.program.starts_at)} · {b.tickets} ticket{b.tickets === 1 ? '' : 's'}
        </Text>
        <Text variant="mono" color={colors.inkFaint}>
          {b.code}
        </Text>
      </View>
      <Pill label="Paid" tone="ok" />
    </Card>
  );
}

export function SekalaJiwaPartner() {
  return (
    <Card style={styles.partner}>
      <Image source={SEKALA_JIWA_LOGO} style={styles.partnerLogo} accessibilityLabel="Sekala Jiwa logo" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" color={colors.inkMuted}>
          In partnership with
        </Text>
        <Text variant="subheading">Sekala Jiwa</Text>
        <Text variant="small" color={colors.inkMuted}>
          Talks, workshops and counselling for co-parents and their children.
        </Text>
      </View>
    </Card>
  );
}

export function CheckoutSheet({ program, visible, onClose }: { program: Program; visible: boolean; onClose: () => void }) {
  // The checkout lives inside the sheet, so it starts fresh every time it opens.
  return (
    <Sheet visible={visible} onClose={onClose} title="Checkout" subtitle={program.title}>
      <Checkout program={program} onDone={onClose} />
    </Sheet>
  );
}

function Checkout({ program: p, onDone }: { program: Program; onDone: () => void }) {
  const [tickets, setTickets] = useState(1);
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [accepted, setAccepted] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const most = Math.min(4, p.spots_left);
  const total = p.price * tickets;

  const pay = useAction(
    () => post<Booking>(`/programs/${p.id}/book`, { tickets, payment_method: method, accept_no_refunds: accepted }),
    { onDone: setBooking },
  );

  if (booking) {
    return (
      <View style={styles.success}>
        <Text style={{ fontSize: 48, lineHeight: 58 }}>🎉</Text>
        <Text variant="title" center>
          You’re booked!
        </Text>
        <Text variant="body" color={colors.inkMuted} center>
          {booking.tickets} ticket{booking.tickets === 1 ? '' : 's'} for {day(p.starts_at)}, {timeRange(p)}.
          {p.format === 'online' ? ' The joining link is sent before the event.' : ' The address is sent before the event.'}
        </Text>
        <View style={styles.code}>
          <Text variant="label" color={colors.inkMuted}>
            Booking code
          </Text>
          <Text variant="title" style={{ letterSpacing: 2 }}>
            {booking.code}
          </Text>
        </View>
        <Button title="Done" size="lg" onPress={onDone} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }

  return (
    <>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text variant="subheading">Tickets</Text>
          <Text variant="small" color={colors.inkMuted}>
            {p.price ? `${rupiah(p.price)} each` : 'Free'} · {p.spots_left} left
          </Text>
        </View>
        <IconButton icon="remove" label="One ticket fewer" background={colors.field} size={40} onPress={() => setTickets((t) => Math.max(1, t - 1))} />
        <Text variant="heading" style={styles.count}>
          {tickets}
        </Text>
        <IconButton icon="add" label="One more ticket" background={colors.field} size={40} onPress={() => setTickets((t) => Math.min(most, t + 1))} />
      </View>

      {p.price ? (
        <View style={{ gap: 8 }}>
          <Text variant="smallStrong" color={colors.inkMuted}>
            Pay with
          </Text>
          <Chips value={method} onChange={setMethod} options={PAYMENT_METHODS} scroll />
        </View>
      ) : null}

      <View style={styles.summary}>
        <View style={styles.row}>
          <Text variant="small" color={colors.inkMuted} style={{ flex: 1 }}>
            {tickets} × {priceLabel(p)}
          </Text>
          <Text variant="small">{total ? rupiah(total) : 'Free'}</Text>
        </View>
        <View style={styles.row}>
          <Text variant="subheading" style={{ flex: 1 }}>
            Total
          </Text>
          <Text variant="subheading">{total ? rupiah(total) : 'Free'}</Text>
        </View>
        {total ? (
          <Text variant="tiny" color={colors.inkFaint}>
            Demo payment: no money is charged yet.
          </Text>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepted }}
        onPress={() => setAccepted((a) => !a)}
        style={styles.policy}
      >
        <Ionicons name={accepted ? 'checkbox' : 'square-outline'} size={24} color={accepted ? colors.primary : colors.inkMuted} />
        <Text variant="small" style={{ flex: 1 }}>
          I understand this booking is final: <Text variant="smallStrong">no refunds or cancellations.</Text>
        </Text>
      </Pressable>

      <Button
        title={total ? `Pay ${rupiah(total)}` : 'Book for free'}
        size="lg"
        disabled={!accepted || most < 1}
        loading={pay.isPending}
        onPress={() => pay.mutate()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, overflow: 'hidden' },
  banner: { height: 104, padding: 14, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  bannerEmoji: { fontSize: 44, lineHeight: 52, position: 'absolute', right: 18, bottom: 12 },
  bannerTopic: { position: 'absolute', left: 82, top: 22, opacity: 0.9 },
  dateBadge: {
    width: 56,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  cardBody: { padding: 16, gap: 4 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  booking: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  partner: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 },
  partnerLogo: { width: 64, height: 64 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  count: { minWidth: 28, textAlign: 'center' },
  summary: { backgroundColor: colors.field, borderRadius: radius.lg, padding: 16, gap: 8 },
  policy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
  },
  success: { alignItems: 'center', gap: 12, paddingTop: 8 },
  code: { alignItems: 'center', backgroundColor: colors.primaryTint, borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: 24, gap: 2 },
});
