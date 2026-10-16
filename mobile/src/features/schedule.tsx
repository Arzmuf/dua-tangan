import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chips } from '@/components/Chips';
import { Field } from '@/components/Field';
import { DateTile, ListRow } from '@/components/ListRow';
import { CalendarPicker, combine, TimePicker, toClock, type ClockTime } from '@/components/Pickers';
import { Pill } from '@/components/Pill';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { day, dayTime, fromNow, sameDay, time } from '@/lib/format';
import { useLastShown } from '@/lib/hooks';
import { eventStatus, kidsLabel, who, Who } from '@/lib/labels';
import { SAFE_PLACES, soundsPrivate } from '@/lib/places';
import { useAction, useEvents, useHome } from '@/lib/queries';
import type { HandoffEvent, Person } from '@/lib/types';
import { colors, radius } from '@/theme';

function useMeId() {
  return useAuth().me?.user.id ?? 0;
}

function tileTone(e: HandoffEvent, meId: number): string {
  const s = eventStatus(e, meId);
  if (s.tone === 'warn') return colors.dangerSoft;
  if (s.tone === 'wait') return colors.accentSoft;
  return colors.primarySoft;
}

export function EventRow({ event, onPress, past }: { event: HandoffEvent; onPress: () => void; past?: boolean }) {
  const meId = useMeId();
  const { data: home } = useHome();
  const status = eventStatus(event, meId);
  return (
    <ListRow
      tile={<DateTile date={new Date(event.starts_at)} tone={past ? 'muted' : 'default'} />}
      tileColor={past ? colors.field : tileTone(event, meId)}
      title={`${kidsLabel(home?.children)} to ${who(event.to_parent, meId)}`}
      subtitle={`${time(event.starts_at)} · ${event.location}`}
      meta={past ? null : <View style={{ marginTop: 4 }}><Pill label={status.label} tone={status.tone} /></View>}
      onPress={onPress}
    />
  );
}

const SUCCESS: Record<string, string> = {
  confirm: 'Handoff confirmed',
  decline: 'Handoff declined',
  cancel: 'Proposal withdrawn',
  'change/accept': 'Change accepted — schedule updated',
  'change/decline': 'Change declined',
  'check-in': "Checked in — it's on the record",
};


/** Details and every action a parent can take on one handoff. */
export function EventSheet({ event, onClose }: { event: HandoffEvent | null; onClose: () => void }) {
  const meId = useMeId();
  const { data: home } = useHome();
  const e = useLastShown(event);

  // Opening a different handoff always starts on its details, not on a half-filled change form.
  const [changing, setChanging] = useState(false);
  const [openedId, setOpenedId] = useState(event?.id);
  if (event && event.id !== openedId) {
    setOpenedId(event.id);
    setChanging(false);
  }

  const act = useAction((path: string) => post<HandoffEvent>(`/events/${e?.id}/${path}`), {
    success: (_, path) => SUCCESS[path],
    onDone: onClose,
  });

  if (!e) return null;
  const status = eventStatus(e, meId);
  const a = e.actions;
  const busy = act.isPending;
  const kids = kidsLabel(home?.children);
  const partner = home?.partner?.first_name;

  return (
    <Sheet
      visible={!!event}
      onClose={onClose}
      title={changing ? 'Propose a change' : `${kids} to ${who(e.to_parent, meId)}`}
      subtitle={
        changing
          ? `${partner ?? 'Your co-parent'} will be asked to accept it.`
          : `${dayTime(e.starts_at)} · ${fromNow(e.starts_at)}`
      }
    >
      {changing ? (
        <ChangeForm event={e} partner={partner} onSent={onClose} onBack={() => setChanging(false)} />
      ) : (
        <>
          <View style={styles.facts}>
            <Fact label="Status" value={<Pill label={status.label} tone={status.tone} />} />
            <Fact label="Meeting place" value={e.location} />
            <Fact label="Proposed by" value={Who(e.created_by, meId)} />
            {e.note ? <Fact label="Note" value={e.note} /> : null}
            {e.checked_in_at && e.checked_in_by ? (
              <Fact label="Checked in" value={`${Who(e.checked_in_by, meId)} · ${dayTime(e.checked_in_at)}`} />
            ) : null}
          </View>

          {e.change ? (
            <View style={styles.change}>
              <Text variant="label" color={colors.dangerDeep}>
                {e.change.by.id === meId ? 'Your change request' : `${e.change.by.first_name} wants to move this`}
              </Text>
              <Text variant="bodyStrong">
                {dayTime(e.starts_at)} → {dayTime(e.change.starts_at)}
              </Text>
              {e.change.location !== e.location ? <Text variant="small">New place: {e.change.location}</Text> : null}
              {e.change.reason ? (
                <Text variant="small" color={colors.inkMuted}>
                  “{e.change.reason}”
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.actions}>
            {a.confirm ? <Button title="Confirm handoff" loading={busy} onPress={() => act.mutate('confirm')} /> : null}
            {a.decline ? <Button title="Decline" variant="outline" disabled={busy} onPress={() => act.mutate('decline')} /> : null}
            {a.respond_change ? <Button title="Accept change" loading={busy} onPress={() => act.mutate('change/accept')} /> : null}
            {a.respond_change ? (
              <Button title="Keep the original time" variant="outline" disabled={busy} onPress={() => act.mutate('change/decline')} />
            ) : null}
            {a.check_in ? <Button title="Check in now" icon="location" loading={busy} onPress={() => act.mutate('check-in')} /> : null}
            {a.propose_change ? (
              <Button title="Propose a change" variant="soft" icon="swap-horizontal" disabled={busy} onPress={() => setChanging(true)} />
            ) : null}
            {a.cancel ? <Button title="Withdraw proposal" variant="danger" disabled={busy} onPress={() => act.mutate('cancel')} /> : null}
          </View>
          {e.status === 'confirmed' && !a.check_in && !e.checked_in_at && new Date(e.starts_at) > new Date() ? (
            <Text variant="tiny" color={colors.inkFaint} center>
              Check-in opens 3 hours before the handoff.
            </Text>
          ) : null}
        </>
      )}
    </Sheet>
  );
}

function ChangeForm({
  event,
  partner,
  onSent,
  onBack,
}: {
  event: HandoffEvent;
  partner: string | undefined;
  onSent: () => void;
  onBack: () => void;
}) {
  const [date, setDate] = useState(() => new Date(event.starts_at));
  const [clock, setClock] = useState<ClockTime>(() => toClock(new Date(event.starts_at)));
  const [location, setLocation] = useState(event.location);
  const [reason, setReason] = useState('');
  const when = combine(date, clock);

  const propose = useAction(
    () =>
      post<HandoffEvent>(`/events/${event.id}/change`, {
        starts_at: when.toISOString(),
        location: location.trim() || undefined,
        reason: reason.trim() || undefined,
      }),
    { success: `Change sent to ${partner ?? 'your co-parent'}`, onDone: onSent },
  );

  return (
    <>
      <CalendarPicker value={date} onChange={setDate} minDate={new Date()} />
      <TimePicker value={clock} onChange={setClock} />
      <PlaceField value={location} onChange={setLocation} />
      <Field label="Reason (optional)" value={reason} onChangeText={setReason} placeholder="e.g. Family event that weekend" />
      <Button title={`Send change for ${day(when)} · ${time(when)}`} loading={propose.isPending} onPress={() => propose.mutate()} />
      <Button title="Back" variant="ghost" onPress={onBack} />
    </>
  );
}

/** Meeting place with safe, public suggestions, and a nudge away from anyone's home. */
function PlaceField({ value, onChange }: { value: string; onChange: (place: string) => void }) {
  return (
    <View style={{ gap: 10 }}>
      <Field
        label="Meeting place"
        value={value}
        onChangeText={onChange}
        placeholder="e.g. Pondok Indah Mall, main lobby"
        hint="Pick somewhere public and neutral, like a mall lobby, a park or a station."
      />
      {soundsPrivate(value) ? (
        <View style={styles.nudge}>
          <Ionicons name="shield-outline" size={18} color={colors.accentDeep} />
          <Text variant="small" style={{ flex: 1 }}>
            This sounds like someone’s home. A public place keeps handoffs calm and safe for everyone.
          </Text>
        </View>
      ) : null}
      <Text variant="smallStrong" color={colors.inkMuted}>
        Safe public places
      </Text>
      <Chips
        scroll
        value={SAFE_PLACES.some((p) => p.name === value) ? value : null}
        onChange={onChange}
        options={SAFE_PLACES.map((p) => ({ value: p.name, label: `${p.emoji} ${p.name}` }))}
      />
    </View>
  );
}

export function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={styles.fact}>
      <Text variant="small" color={colors.inkMuted}>
        {label}
      </Text>
      {typeof value === 'string' ? (
        <Text variant="smallStrong" style={styles.factValue}>
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

/** The first coming Saturday with no handoff on it, and no pending change asking for it. */
function nextFreeSaturday(events: HandoffEvent[] | undefined): Date {
  const taken = (events ?? []).flatMap((e) => [e.starts_at, ...(e.change ? [e.change.starts_at] : [])]);
  const d = new Date();
  d.setDate(d.getDate() + (((6 - d.getDay()) % 7) || 7));
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  for (let i = 0; i < 26 && taken.some((iso) => sameDay(new Date(iso), day)); i++) {
    day.setDate(day.getDate() + 7);
  }
  return day;
}

export function NewHandoffSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { data: home } = useHome();
  const partner = home?.partner;
  // The form lives inside the sheet, so it mounts fresh (with fresh defaults) every time it opens.
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Propose a handoff"
      subtitle={partner ? `${partner.first_name} confirms it before it's on the schedule.` : undefined}
    >
      {partner ? (
        <NewHandoffForm partner={partner} onSent={onClose} />
      ) : (
        <Text variant="body" color={colors.inkMuted}>
          Invite your co-parent first — handoffs need both of you. You’ll find your family code on the home screen.
        </Text>
      )}
    </Sheet>
  );
}

function NewHandoffForm({ partner, onSent }: { partner: Person; onSent: () => void }) {
  const { me } = useAuth();
  const { data: home } = useHome();
  const { data: events } = useEvents();

  const [to, setTo] = useState<'partner' | 'me'>('partner');
  const [date, setDate] = useState(() => nextFreeSaturday(events));
  const [clock, setClock] = useState<ClockTime>({ h: 9, m: 0 });
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const when = combine(date, clock);

  const create = useAction(
    () =>
      post<HandoffEvent>('/events', {
        starts_at: when.toISOString(),
        to_parent_id: to === 'me' ? me?.user.id : partner.id,
        location: location.trim(),
        note: note.trim() || undefined,
      }),
    { success: `Sent to ${partner.first_name} to confirm`, onDone: onSent },
  );

  return (
    <>
      <View style={{ gap: 8 }}>
        <Text variant="smallStrong" color={colors.inkMuted}>
          {kidsLabel(home?.children)} goes to
        </Text>
        <Chips
          size="lg"
          value={to}
          onChange={setTo}
          options={[
            { value: 'partner', label: partner.first_name },
            { value: 'me', label: 'Me' },
          ]}
        />
      </View>
      <CalendarPicker value={date} onChange={setDate} minDate={new Date()} />
      <TimePicker value={clock} onChange={setClock} />
      <PlaceField value={location} onChange={setLocation} />
      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. She has swimming at 11" />
      <Button
        title={`Propose ${day(when)} · ${time(when)}`}
        disabled={!location.trim()}
        loading={create.isPending}
        onPress={() => create.mutate()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  facts: { backgroundColor: colors.field, borderRadius: radius.lg, padding: 16, gap: 12 },
  fact: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  factValue: { flexShrink: 1, textAlign: 'right' },
  change: { backgroundColor: colors.dangerSoft, borderRadius: radius.lg, padding: 16, gap: 4 },
  nudge: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: 12 },
  actions: { gap: 10 },
});
