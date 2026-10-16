import { router } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { Avatar, SectionTitle } from '@/components/Bits';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { Hero } from '@/components/Hero';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { patch, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { API_URL } from '@/lib/config';
import { age } from '@/lib/format';
import { useAction, useFamily } from '@/lib/queries';
import type { Child, Me } from '@/lib/types';
import { colors, radius } from '@/theme';

export default function ProfileScreen() {
  const { me, setMe, signOut } = useAuth();
  const { data: family } = useFamily();
  const [editingName, setEditingName] = useState(false);
  const [addingChild, setAddingChild] = useState(false);

  if (!me) return null;
  const code = family?.invite_code ?? me.family?.invite_code ?? '';
  const partner = family?.members.find((m) => m.id !== me.user.id);

  const shareCode = async () => {
    try {
      await Share.share({ message: `Join me on Dua Tangan. Our family code is ${code}.` });
    } catch {
      // The code is visible on screen.
    }
  };

  return (
    <>
      <Screen
        withTabBar={false}
        header={
          <Hero color={colors.primary} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
            <View style={styles.me}>
              <Avatar name={me.user.full_name} size={64} />
              <View style={{ flex: 1 }}>
                <Text variant="title">{me.user.full_name}</Text>
                <Text variant="small" style={{ opacity: 0.8 }}>
                  {me.user.email}
                </Text>
              </View>
            </View>
          </Hero>
        }
      >
        <Button title="Edit my name" variant="outline" icon="create-outline" onPress={() => setEditingName(true)} style={{ marginTop: 18 }} />

        <SectionTitle>Family</SectionTitle>
        <Card style={{ gap: 14 }}>
          <Row label="Co-parent" value={partner ? partner.name : 'Not joined yet'} />
          <Row label="Family code" value={code} strong />
          {!partner ? <Button title="Share family code" icon="share-outline" variant="soft" onPress={shareCode} /> : null}
        </Card>

        <SectionTitle action={<Button title="Add" icon="add" size="sm" variant="soft" onPress={() => setAddingChild(true)} />}>
          Children
        </SectionTitle>
        <View style={{ gap: 12 }}>
          {(family?.children ?? me.family?.children ?? []).map((c) => (
            <Card key={c.id} style={styles.child}>
              <Text style={{ fontSize: 24, lineHeight: 30 }}>🧒</Text>
              <View style={{ flex: 1 }}>
                <Text variant="subheading">{c.name}</Text>
                <Text variant="small" color={colors.inkMuted}>
                  {age(c.birth_date) ?? 'Birth date not added'}
                </Text>
              </View>
            </Card>
          ))}
        </View>

        {me.user.is_admin ? (
          <Button title="Admin dashboard" icon="settings-outline" variant="outline" size="lg" onPress={() => router.push('/admin')} style={{ marginTop: 28 }} />
        ) : null}
        <Button title="Sign out" variant="danger" size="lg" onPress={signOut} style={{ marginTop: me.user.is_admin ? 12 : 28 }} />
        <Text variant="mono" color={colors.inkFaint} center style={{ marginTop: 14 }}>
          API · {API_URL}
        </Text>
      </Screen>

      <NameSheet visible={editingName} current={me.user.full_name} onClose={() => setEditingName(false)} onSaved={setMe} />
      <ChildSheet visible={addingChild} onClose={() => setAddingChild(false)} />
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text variant="small" color={colors.inkMuted}>
        {label}
      </Text>
      <Text variant={strong ? 'subheading' : 'smallStrong'} style={strong ? { letterSpacing: 3 } : undefined}>
        {value}
      </Text>
    </View>
  );
}

function NameSheet({
  visible,
  current,
  onClose,
  onSaved,
}: {
  visible: boolean;
  current: string;
  onClose: () => void;
  onSaved: (me: Me) => void;
}) {
  // Forms live inside their sheet, so they start fresh every time it opens.
  return (
    <Sheet visible={visible} onClose={onClose} title="Your name">
      <NameForm
        current={current}
        onSaved={(me) => {
          onSaved(me);
          onClose();
        }}
      />
    </Sheet>
  );
}

function NameForm({ current, onSaved }: { current: string; onSaved: (me: Me) => void }) {
  const [name, setName] = useState(current);
  const save = useAction(() => patch<Me>('/me', { full_name: name.trim() }), { success: 'Name updated', onDone: onSaved });
  return (
    <>
      <Field label="Full name" value={name} onChangeText={setName} />
      <Button title="Save" disabled={!name.trim()} loading={save.isPending} onPress={() => save.mutate()} />
    </>
  );
}

function ChildSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Add a child">
      <ChildForm onAdded={onClose} />
    </Sheet>
  );
}

function ChildForm({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState('');
  const [birth, setBirth] = useState('');
  const valid = !birth || /^\d{4}-\d{2}-\d{2}$/.test(birth);
  const add = useAction(() => post<Child>('/family/children', { name: name.trim(), birth_date: birth || null }), {
    success: 'Child added',
    onDone: onAdded,
  });
  return (
    <>
      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Bima" />
      <Field
        label="Birth date (optional)"
        value={birth}
        onChangeText={setBirth}
        placeholder="YYYY-MM-DD"
        hint="For example 2021-06-15"
        keyboardType="numbers-and-punctuation"
      />
      <Button title="Add child" disabled={!name.trim() || !valid} loading={add.isPending} onPress={() => add.mutate()} />
    </>
  );
}

const styles = StyleSheet.create({
  me: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  child: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: radius.lg },
});
