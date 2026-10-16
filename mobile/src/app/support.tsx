import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Loading, SectionTitle } from '@/components/Bits';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chips } from '@/components/Chips';
import { Field } from '@/components/Field';
import { Hero } from '@/components/Hero';
import { ListRow } from '@/components/ListRow';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { post } from '@/lib/api';
import { day } from '@/lib/format';
import { useLastShown } from '@/lib/hooks';
import { useAction, useCounsellors, useSupportRequests } from '@/lib/queries';
import type { Counsellor, SessionType, SupportRequest } from '@/lib/types';
import { colors } from '@/theme';

const SESSION_LABELS: Record<SessionType, string> = {
  individual: 'Just me',
  'co-parenting': 'Both parents',
  child: 'Child check-in',
};

export default function SupportScreen() {
  const { data: counsellors, isLoading } = useCounsellors();
  const { data: requests } = useSupportRequests();
  const [booking, setBooking] = useState<Counsellor | null>(null);

  return (
    <>
      <Screen
        withTabBar={false}
        header={
          <Hero
            color={colors.accent}
            onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            title="Support"
            subtitle="Talk to someone who understands two-home families."
          />
        }
      >
        <Card color={colors.primarySoft} style={styles.free}>
          <Text style={{ fontSize: 26, lineHeight: 32 }}>🎁</Text>
          <View style={{ flex: 1 }}>
            <Text variant="smallStrong">Your first session is free</Text>
            <Text variant="small" color={colors.inkMuted}>
              Pick a counsellor and a time that suits you — they’ll confirm with you directly.
            </Text>
          </View>
        </Card>

        <SectionTitle>Counsellors</SectionTitle>
        {isLoading ? (
          <View style={{ height: 160 }}>
            <Loading />
          </View>
        ) : (
          <View style={styles.list}>
            {(counsellors ?? []).map((c) => (
              <ListRow
                key={c.id}
                tile={c.icon}
                tileColor={colors.accentSoft}
                title={c.name}
                subtitle={`${c.title} · ${c.focus}`}
                onPress={() => setBooking(c)}
              />
            ))}
          </View>
        )}

        {requests?.length ? (
          <>
            <SectionTitle>Your requests</SectionTitle>
            <View style={styles.list}>
              {requests.map((r) => (
                <RequestRow key={r.id} request={r} />
              ))}
            </View>
          </>
        ) : null}
      </Screen>
      <BookSheet counsellor={booking} onClose={() => setBooking(null)} />
    </>
  );
}

function RequestRow({ request: r }: { request: SupportRequest }) {
  return (
    <Card style={styles.request}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="subheading">{r.counsellor.name}</Text>
        <Text variant="small" color={colors.inkMuted}>
          {SESSION_LABELS[r.session_type]} · {r.preferred_time}
        </Text>
        <Text variant="tiny" color={colors.inkFaint}>
          Requested by {r.requested_by.first_name} on {day(r.created_at)}
        </Text>
      </View>
      <Pill label={r.status === 'requested' ? 'Requested' : r.status} tone="wait" />
    </Card>
  );
}

function BookSheet({ counsellor, onClose }: { counsellor: Counsellor | null; onClose: () => void }) {
  const shown = useLastShown(counsellor);
  return (
    <Sheet visible={!!counsellor} onClose={onClose} title={shown?.name ?? ''} subtitle={shown?.focus}>
      {shown ? <BookForm key={shown.id} counsellor={shown} onSent={onClose} /> : null}
    </Sheet>
  );
}

function BookForm({ counsellor, onSent }: { counsellor: Counsellor; onSent: () => void }) {
  const [type, setType] = useState<SessionType>('child');
  const [when, setWhen] = useState('');
  const [note, setNote] = useState('');

  const book = useAction(
    () =>
      post<SupportRequest>('/support/requests', {
        counsellor_id: counsellor.id,
        session_type: type,
        preferred_time: when.trim(),
        note: note.trim() || undefined,
      }),
    { success: 'Request sent — the counsellor will confirm with you', onDone: onSent },
  );

  return (
    <>
      <View style={{ gap: 8 }}>
        <Text variant="smallStrong" color={colors.inkMuted}>
          Who is the session for?
        </Text>
        <Chips
          value={type}
          onChange={setType}
          options={(Object.keys(SESSION_LABELS) as SessionType[]).map((t) => ({ value: t, label: SESSION_LABELS[t] }))}
        />
      </View>
      <Field label="When suits you?" value={when} onChangeText={setWhen} placeholder="e.g. Thursday afternoon, after 15:00" />
      <Field label="Anything they should know? (optional)" value={note} onChangeText={setNote} multiline />
      <Button title="Request a session" disabled={!when.trim()} loading={book.isPending} onPress={() => book.mutate()} />
    </>
  );
}

const styles = StyleSheet.create({
  free: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 },
  list: { gap: 12 },
  request: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
