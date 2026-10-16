import { router } from 'expo-router';
import { useDeferredValue, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, EmptyState, Loading } from '@/components/Bits';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chips } from '@/components/Chips';
import { Field } from '@/components/Field';
import { Pill } from '@/components/Pill';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { TOPICS } from '@/features/programs';
import { del, patch, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { confirm } from '@/lib/confirm';
import { day, monthShort, rupiah, time } from '@/lib/format';
import { useLastShown } from '@/lib/hooks';
import { useAction, useAdminPrograms, useAdminUsers } from '@/lib/queries';
import type { AdminProgram, AdminUser } from '@/lib/types';
import { colors, radius } from '@/theme';

// --- users -----------------------------------------------------------------------------------

export function UsersPanel() {
  const [search, setSearch] = useState('');
  const query = useDeferredValue(search.trim());
  const { data: users, isLoading } = useAdminUsers(query);
  const [editing, setEditing] = useState<AdminUser | 'new' | null>(null);

  return (
    <>
      <View style={styles.toolbar}>
        <View style={{ flex: 1 }}>
          <Field value={search} onChangeText={setSearch} placeholder="Search by name or email" autoCapitalize="none" />
        </View>
        <Button title="New user" icon="person-add-outline" size="md" onPress={() => setEditing('new')} />
      </View>
      {isLoading ? (
        <Loading />
      ) : !users?.length ? (
        <EmptyState emoji="🔍" title="No one found" text={query ? `Nobody matches “${query}”.` : undefined} />
      ) : (
        <View style={styles.list}>
          {users.map((u) => (
            <Card key={u.id} onPress={() => setEditing(u)} style={styles.user}>
              <Avatar name={u.full_name} size={42} color={u.is_admin ? colors.primary : colors.accent} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text variant="subheading" numberOfLines={1}>
                  {u.full_name}
                </Text>
                <Text variant="small" color={colors.inkMuted} numberOfLines={1}>
                  {u.email}
                </Text>
                <Text variant="tiny" color={colors.inkFaint}>
                  {u.family ? u.family.name : 'No family space'} · joined {day(u.created_at)}
                </Text>
              </View>
              <View style={styles.pills}>
                {u.is_admin ? <Pill label="Admin" tone="info" /> : null}
                {!u.is_active ? <Pill label="Deactivated" tone="warn" /> : null}
              </View>
            </Card>
          ))}
        </View>
      )}
      <UserSheet user={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function UserSheet({ user, onClose }: { user: AdminUser | 'new' | null; onClose: () => void }) {
  const shown = useLastShown(user);
  const isNew = shown === 'new';
  return (
    <Sheet
      visible={!!user}
      onClose={onClose}
      title={isNew ? 'New user' : (shown?.full_name ?? '')}
      subtitle={isNew ? 'They can sign in straight away with this password.' : (shown?.email ?? undefined)}
    >
      {shown ? <UserForm key={isNew ? 'new' : shown.id} user={isNew ? null : shown} onDone={onClose} /> : null}
    </Sheet>
  );
}

function UserForm({ user, onDone }: { user: AdminUser | null; onDone: () => void }) {
  const { me } = useAuth();
  const self = user?.id === me?.user.id;
  const [name, setName] = useState(user?.full_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'parent' | 'admin'>(user?.is_admin ? 'admin' : 'parent');
  const [state, setState] = useState<'active' | 'deactivated'>(user && !user.is_active ? 'deactivated' : 'active');

  const save = useAction(
    () => {
      const body = { full_name: name.trim(), email: email.trim(), is_admin: role === 'admin' };
      if (!user) return post('/admin/users', { ...body, password });
      return patch(`/admin/users/${user.id}`, { ...body, is_active: state === 'active', ...(password ? { password } : {}) });
    },
    { success: user ? 'Saved' : 'User created', onDone },
  );
  const remove = useAction(() => del(`/admin/users/${user?.id}`), { success: 'User deleted', onDone });

  const onDelete = async () => {
    const sure = await confirm(
      `Delete ${user?.full_name}?`,
      'This removes their account for good. Parents in a family space can only be deactivated.',
      'Delete',
    );
    if (sure) remove.mutate();
  };

  const valid = name.trim() && email.includes('@') && (user ? !password || password.length >= 6 : password.length >= 6);
  return (
    <>
      <Field label="Full name" value={name} onChangeText={setName} />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Field
        label={user ? 'New password (optional)' : 'Password'}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="At least 6 characters"
        hint={user ? 'Leave empty to keep their current password.' : undefined}
      />
      <View style={{ gap: 8 }}>
        <Text variant="smallStrong" color={colors.inkMuted}>
          Role
        </Text>
        <Chips
          value={role}
          onChange={setRole}
          options={[
            { value: 'parent', label: 'Parent' },
            { value: 'admin', label: 'Admin' },
          ]}
        />
      </View>
      {user && !self ? (
        <View style={{ gap: 8 }}>
          <Text variant="smallStrong" color={colors.inkMuted}>
            Account
          </Text>
          <Chips
            value={state}
            onChange={setState}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'deactivated', label: 'Deactivated' },
            ]}
          />
          <Text variant="tiny" color={colors.inkFaint}>
            Deactivated accounts can’t sign in. Their shared history stays in the family’s info bank.
          </Text>
        </View>
      ) : null}
      <Button title={user ? 'Save changes' : 'Create user'} size="lg" disabled={!valid} loading={save.isPending} onPress={() => save.mutate()} />
      {user && !self ? <Button title="Delete user" variant="danger" loading={remove.isPending} onPress={onDelete} /> : null}
    </>
  );
}

// --- events ----------------------------------------------------------------------------------

export function EventsPanel() {
  const { data: programs, isLoading } = useAdminPrograms();
  const now = new Date();
  return (
    <>
      <Button title="New event" icon="add" size="lg" onPress={() => router.push('/admin/programs/new')} style={{ marginTop: 16 }} />
      {isLoading ? (
        <Loading />
      ) : !programs?.length ? (
        <EmptyState emoji="🗓️" title="No events yet" text="Post a talk or workshop and parents can book it from the support page." />
      ) : (
        <View style={styles.list}>
          {programs.map((p) => (
            <ProgramRow key={p.id} program={p} past={new Date(p.starts_at) < now} />
          ))}
        </View>
      )}
    </>
  );
}

function ProgramRow({ program: p, past }: { program: AdminProgram; past: boolean }) {
  return (
    <Card onPress={() => router.push(`/admin/programs/${p.id}`)} style={[styles.program, past && { opacity: 0.7 }]}>
      <View style={[styles.date, { backgroundColor: TOPICS[p.topic].color }]}>
        <View style={styles.dateInner}>
          <Text variant="label" color={colors.dangerDeep}>
            {monthShort(p.starts_at)}
          </Text>
          <Text variant="heading">{new Date(p.starts_at).getDate()}</Text>
        </View>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="subheading" numberOfLines={2}>
          {p.title}
        </Text>
        <Text variant="small" color={colors.inkMuted}>
          {time(p.starts_at)} · {p.tickets_sold}/{p.capacity} booked · {p.revenue ? rupiah(p.revenue) : 'no revenue yet'}
        </Text>
        <View style={styles.pills}>
          <Pill label={p.is_published ? 'Published' : 'Hidden'} tone={p.is_published ? 'ok' : 'neutral'} />
          {past ? <Pill label="Past" tone="neutral" /> : null}
          {p.spots_left === 0 ? <Pill label="Sold out" tone="wait" /> : null}
        </View>
      </View>
    </Card>
  );
}

export function Stat({ label, value, note }: { label: string; value: string | number | undefined; note?: string }) {
  return (
    <Card style={styles.stat}>
      <Text variant="label" color={colors.inkMuted}>
        {label}
      </Text>
      <Text variant="title">{value ?? '–'}</Text>
      {note ? (
        <Text variant="tiny" color={colors.inkFaint}>
          {note}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  list: { gap: 12, marginTop: 16 },
  user: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  program: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  date: { width: 64, height: 64, borderRadius: radius.md, padding: 6 },
  dateInner: { flex: 1, borderRadius: 12, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  stat: { flexGrow: 1, flexBasis: '45%', gap: 2, padding: 14 },
});
