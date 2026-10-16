import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState, Loading, SectionTitle } from '@/components/Bits';
import { Button, IconButton } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmCard } from '@/components/ConfirmCard';
import { Chips } from '@/components/Chips';
import { Field } from '@/components/Field';
import { Hero } from '@/components/Hero';
import { CalendarPicker, combine, TimePicker, toClock, type ClockTime } from '@/components/Pickers';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TOPICS } from '@/features/programs';
import { api, del, post } from '@/lib/api';
import { dayTime, deviceTimeZone, groupDigits, parseAmount, rupiah } from '@/lib/format';
import { useAction, useAdminBookings, useAdminProgram } from '@/lib/queries';
import type { AdminProgram, Program, ProgramInput, ProgramTopic } from '@/lib/types';
import { colors } from '@/theme';

export default function ProgramEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const programId = id === 'new' ? null : Number(id);
  const { data: program, isLoading } = useAdminProgram(programId);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/admin'));

  if (programId !== null && !program) {
    return (
      <Screen withTabBar={false} header={<Hero color={colors.primaryDeep} onBack={back} title="Event" />}>
        {isLoading ? <Loading /> : <EmptyState emoji="🗓️" title="Event not found" text="It may have been deleted." />}
      </Screen>
    );
  }
  // Keyed by event, so the form's fields start from that event's saved values.
  return <ProgramForm key={programId ?? 'new'} program={program ?? null} onBack={back} />;
}

/** New events default to 19:30 a week from today. */
function nextWeekEvening(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7, 19, 30);
}

function ProgramForm({ program, onBack }: { program: AdminProgram | null; onBack: () => void }) {
  const start = program ? new Date(program.starts_at) : nextWeekEvening();
  const [title, setTitle] = useState(program?.title ?? '');
  const [summary, setSummary] = useState(program?.summary ?? '');
  const [description, setDescription] = useState(program?.description ?? '');
  const [topic, setTopic] = useState<ProgramTopic>(program?.topic ?? 'co-parenting');
  const [format, setFormat] = useState<Program['format']>(program?.format ?? 'online');
  const [location, setLocation] = useState(program?.location ?? '');
  const [date, setDate] = useState(start);
  const [clock, setClock] = useState<ClockTime>(toClock(start));
  const [duration, setDuration] = useState(String(program?.duration_minutes ?? 90));
  const [price, setPrice] = useState(program?.price ? groupDigits(String(program.price)) : '');
  const [capacity, setCapacity] = useState(String(program?.capacity ?? 30));
  const [host, setHost] = useState(program?.host ?? 'Sekala Jiwa');
  const [practitioner, setPractitioner] = useState(program?.practitioner.name ?? '');
  const [practitionerTitle, setPractitionerTitle] = useState(program?.practitioner.title ?? '');
  const [bio, setBio] = useState(program?.practitioner.bio ?? '');
  const [published, setPublished] = useState(program?.is_published ?? true);

  const input: ProgramInput = {
    title: title.trim(),
    summary: summary.trim(),
    description: description.trim(),
    topic,
    format,
    location: location.trim(),
    starts_at: combine(date, clock).toISOString(),
    duration_minutes: Number(duration) || 0,
    price: parseAmount(price),
    capacity: Number(capacity) || 0,
    host: host.trim(),
    practitioner_name: practitioner.trim(),
    practitioner_title: practitionerTitle.trim(),
    practitioner_bio: bio.trim(),
    is_published: published,
  };
  const complete =
    [input.title, input.summary, input.description, input.location, input.host, input.practitioner_name, input.practitioner_title, input.practitioner_bio].every(Boolean) &&
    input.duration_minutes >= 15 &&
    input.capacity >= 1;

  const save = useAction(
    () =>
      program
        ? api<AdminProgram>(`/admin/programs/${program.id}`, { method: 'PUT', body: input })
        : post<AdminProgram>('/admin/programs', input),
    {
      success: program ? 'Event saved' : published ? 'Event posted' : 'Event saved as hidden',
      onDone: (saved) => {
        if (!program) router.replace(`/admin/programs/${saved.id}`);
      },
    },
  );
  const [deleting, setDeleting] = useState(false);
  const remove = useAction(() => del(`/admin/programs/${program?.id}`), { success: 'Event deleted', onDone: onBack });
  // Booked events can't be deleted (bookings are final), so the same step offers to hide them instead.
  const hide = useAction(() => api<AdminProgram>(`/admin/programs/${program?.id}`, { method: 'PUT', body: { ...input, is_published: false } }), {
    success: 'Event hidden from parents',
    onDone: () => {
      setPublished(false);
      setDeleting(false);
    },
  });
  const booked = !!program?.bookings_count;

  return (
    <Screen
      withTabBar={false}
      header={
        <Hero
          color={colors.primaryDeep}
          onBack={onBack}
          right={
            program ? (
              <IconButton icon="trash-outline" label="Delete event" color={colors.dangerDeep} background={colors.dangerSoft} onPress={() => setDeleting(true)} />
            ) : undefined
          }
          title={program ? 'Edit event' : 'New event'}
          subtitle={program ? `${program.tickets_sold} of ${program.capacity} booked` : 'Parents see it on the support page once it’s published.'}
        />
      }
      footer={
        <Button
          title={program ? 'Save changes' : published ? 'Publish event' : 'Save as hidden'}
          size="lg"
          disabled={!complete}
          loading={save.isPending}
          onPress={() => save.mutate()}
        />
      }
    >
      {deleting && program ? (
        <View style={{ marginTop: 18 }}>
          {booked ? (
            <ConfirmCard
              title="This event can't be deleted"
              message={`${program.bookings_count} ${program.bookings_count === 1 ? 'booking is' : 'bookings are'} final, so the event has to stay. You can hide it from parents instead; people who booked keep their place.`}
              action={program.is_published ? 'Hide event' : 'Already hidden'}
              loading={hide.isPending}
              onConfirm={() => (program.is_published ? hide.mutate() : setDeleting(false))}
              onCancel={() => setDeleting(false)}
            />
          ) : (
            <ConfirmCard
              title={`Delete “${program.title}”?`}
              message="It disappears for everyone. This can't be undone."
              action="Delete event"
              loading={remove.isPending}
              onConfirm={() => remove.mutate()}
              onCancel={() => setDeleting(false)}
            />
          )}
        </View>
      ) : null}

      <SectionTitle>The event</SectionTitle>
      <View style={styles.form}>
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Calm Co-Parenting Communication" />
        <Field label="Summary" value={summary} onChangeText={setSummary} placeholder="One line on the event card" />
        <Field label="Description" value={description} onChangeText={setDescription} multiline placeholder="What parents will learn, who it’s for…" />
        <ChoiceRow label="Topic">
          <Chips
            scroll
            value={topic}
            onChange={setTopic}
            options={(Object.keys(TOPICS) as ProgramTopic[]).map((t) => ({ value: t, label: `${TOPICS[t].emoji} ${TOPICS[t].label}` }))}
          />
        </ChoiceRow>
        <ChoiceRow label="Format">
          <Chips
            value={format}
            onChange={setFormat}
            options={[
              { value: 'online', label: 'Online' },
              { value: 'in-person', label: 'In person' },
            ]}
          />
        </ChoiceRow>
        <Field
          label={format === 'online' ? 'How to join' : 'Venue'}
          value={location}
          onChangeText={setLocation}
          placeholder={format === 'online' ? 'e.g. Online via Zoom (link sent after booking)' : 'e.g. Sekala Jiwa, South Jakarta'}
        />
      </View>

      <SectionTitle>Date and time</SectionTitle>
      <View style={styles.form}>
        <CalendarPicker value={date} onChange={setDate} />
        <TimePicker value={clock} onChange={setClock} />
        <Text variant="tiny" color={colors.inkFaint}>
          Times are in your time zone ({deviceTimeZone()}). Parents see them in theirs.
        </Text>
        <Field label="Length (minutes)" value={duration} onChangeText={setDuration} keyboardType="number-pad" />
      </View>

      <SectionTitle>Tickets</SectionTitle>
      <View style={styles.form}>
        <Field
          label="Price per person"
          prefix="Rp"
          value={price}
          onChangeText={(t) => setPrice(groupDigits(t))}
          keyboardType="number-pad"
          placeholder="0"
          hint={input.price ? undefined : 'Leave empty for a free event.'}
        />
        <Field label="Places" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" />
      </View>

      <SectionTitle>Practitioner</SectionTitle>
      <View style={styles.form}>
        <Field label="Host" value={host} onChangeText={setHost} />
        <Field label="Name" value={practitioner} onChangeText={setPractitioner} placeholder="e.g. Dr. Amelia Wijaya, Psikolog" />
        <Field label="Title" value={practitionerTitle} onChangeText={setPractitionerTitle} placeholder="e.g. Co-parenting counsellor, Sekala Jiwa" />
        <Field label="Short bio" value={bio} onChangeText={setBio} multiline placeholder="A sentence or two about their experience" />
      </View>

      <SectionTitle>Visibility</SectionTitle>
      <Chips
        value={published ? 'published' : 'hidden'}
        onChange={(v) => setPublished(v === 'published')}
        options={[
          { value: 'published', label: 'Published' },
          { value: 'hidden', label: 'Hidden' },
        ]}
      />
      <Text variant="tiny" color={colors.inkFaint} style={{ marginTop: 8 }}>
        Hidden events don’t appear for parents. People who already booked keep their place.
      </Text>

      {program ? <Bookings program={program} /> : null}
    </Screen>
  );
}

function ChoiceRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text variant="smallStrong" color={colors.inkMuted}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function Bookings({ program }: { program: AdminProgram }) {
  const { data: bookings } = useAdminBookings(program.id);
  return (
    <>
      <SectionTitle>{`Bookings · ${program.tickets_sold} tickets · ${rupiah(program.revenue)}`}</SectionTitle>
      {!bookings?.length ? (
        <Text variant="small" color={colors.inkMuted}>
          No bookings yet.
        </Text>
      ) : (
        <Card style={styles.bookings}>
          {bookings.map((b, i) => (
            <View key={b.id} style={[styles.booking, i > 0 && styles.divider]}>
              <View style={{ flex: 1 }}>
                <Text variant="smallStrong">{b.name}</Text>
                <Text variant="tiny" color={colors.inkMuted}>
                  {b.email} · {dayTime(b.created_at)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text variant="smallStrong">
                  {b.tickets} × · {b.amount ? rupiah(b.amount) : 'Free'}
                </Text>
                <Text variant="mono" color={colors.inkFaint}>
                  {b.code}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14 },
  bookings: { padding: 0 },
  booking: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
});
