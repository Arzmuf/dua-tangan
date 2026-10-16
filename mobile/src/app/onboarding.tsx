import { useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { Hero } from '@/components/Hero';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { FormError } from '@/features/authForm';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { deviceTimeZone } from '@/lib/format';
import type { Me } from '@/lib/types';
import { colors, radius } from '@/theme';

type Mode = 'choose' | 'create' | 'join' | 'invite';

/** "DD", "MM", "YYYY" -> "YYYY-MM-DD", or an error message. */
function birthDate(d: string, m: string, y: string): { value: string | null; error?: string } {
  if (!d && !m && !y) return { value: null };
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  const date = new Date(year, month - 1, day);
  const valid =
    y.length === 4 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day && date <= new Date();
  if (!valid) return { value: null, error: 'Check the birth date (day, month, year).' };
  return { value: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` };
}

export default function Onboarding() {
  const { me, setMe, signOut } = useAuth();
  const [mode, setMode] = useState<Mode>('choose');
  const [childName, setChildName] = useState('');
  const [dd, setDd] = useState('');
  const [mm, setMm] = useState('');
  const [yyyy, setYyyy] = useState('');
  const [code, setCode] = useState('');
  const [created, setCreated] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = (next: Mode) => {
    setError(null);
    setMode(next);
  };

  const create = async () => {
    if (!childName.trim()) return setError("Add your child's name.");
    const dob = birthDate(dd, mm, yyyy);
    if (dob.error) return setError(dob.error);
    setBusy(true);
    setError(null);
    try {
      const res = await post<Me>('/families', {
        child_name: childName.trim(),
        child_birth_date: dob.value,
        time_zone: deviceTimeZone(),
      });
      setCreated(res);
      setMode('invite');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the family.');
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    if (code.trim().length < 4) return setError('Enter the code your co-parent shared.');
    setBusy(true);
    setError(null);
    try {
      setMe(await post<Me>('/families/join', { invite_code: code.trim() }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join the family.');
      setBusy(false);
    }
  };

  const inviteCode = created?.family?.invite_code ?? '';
  const shareCode = async () => {
    try {
      await Share.share({
        message: `Join me on Dua Tangan so we can plan handoffs and share costs for ${childName.trim()}. Our family code is ${inviteCode}.`,
      });
    } catch {
      // Sharing isn't available everywhere (e.g. some browsers); the code is on screen.
    }
  };

  const titles: Record<Mode, { title: string; subtitle: string }> = {
    choose: { title: `Hi ${me?.user.first_name ?? 'there'}!`, subtitle: "Let's set up the shared space for your child." },
    create: { title: 'About your child', subtitle: 'You can add more children later.' },
    join: { title: 'Join your co-parent', subtitle: 'Enter the 6-letter code they shared with you.' },
    invite: { title: 'Your family is ready', subtitle: 'Now invite your co-parent with this code.' },
  };

  return (
    <Screen
      withTabBar={false}
      header={
        <Hero
          decor={mode === 'choose' || mode === 'invite' ? 'top' : false}
          onBack={mode === 'create' || mode === 'join' ? () => go('choose') : undefined}
          title={titles[mode].title}
          subtitle={titles[mode].subtitle}
        />
      }
    >
      {mode === 'choose' ? (
        <View style={styles.stack}>
          <Card color={colors.primary} onPress={() => go('create')} style={styles.choice}>
            <Text variant="label" color={colors.white}>
              I’m the first one here
            </Text>
            <Text variant="heading" color={colors.white}>
              Start a new family space
            </Text>
            <Text variant="small" color={colors.white} style={{ opacity: 0.9 }}>
              Add your child and get a code for your co-parent.
            </Text>
          </Card>
          <Card color={colors.accent} onPress={() => go('join')} style={styles.choice}>
            <Text variant="label" color={colors.ink}>
              I have a code
            </Text>
            <Text variant="heading">Join my co-parent</Text>
            <Text variant="small" color={colors.ink} style={{ opacity: 0.8 }}>
              Your co-parent already set things up.
            </Text>
          </Card>
          <Pressable onPress={signOut} style={styles.link}>
            <Text variant="small" color={colors.inkMuted}>
              Not {me?.user.first_name}? <Text variant="smallStrong" color={colors.primaryDeep}>Sign out</Text>
            </Text>
          </Pressable>
        </View>
      ) : null}

      {mode === 'create' ? (
        <View style={styles.stack}>
          <Field label="Child's name" value={childName} onChangeText={setChildName} placeholder="e.g. Kirana" />
          <View style={{ gap: 6 }}>
            <Text variant="smallStrong" color={colors.inkMuted}>
              Birth date (optional)
            </Text>
            <View style={styles.dob}>
              <View style={{ flex: 1 }}>
                <Field value={dd} onChangeText={(t) => setDd(t.replace(/\D/g, '').slice(0, 2))} placeholder="DD" keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Field value={mm} onChangeText={(t) => setMm(t.replace(/\D/g, '').slice(0, 2))} placeholder="MM" keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1.4 }}>
                <Field value={yyyy} onChangeText={(t) => setYyyy(t.replace(/\D/g, '').slice(0, 4))} placeholder="YYYY" keyboardType="number-pad" />
              </View>
            </View>
          </View>
          <FormError message={error} />
          <Button title="Create family space" size="lg" loading={busy} onPress={create} />
        </View>
      ) : null}

      {mode === 'join' ? (
        <View style={styles.stack}>
          <Field
            label="Family code"
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="e.g. K7M2QX"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={12}
            style={styles.codeInput}
          />
          <FormError message={error} />
          <Button title="Join family" size="lg" loading={busy} onPress={join} />
        </View>
      ) : null}

      {mode === 'invite' && created ? (
        <View style={styles.stack}>
          <Card style={{ alignItems: 'center', gap: 10 }}>
            <Text variant="label" color={colors.inkFaint}>
              Family code
            </Text>
            <Text variant="display" style={styles.bigCode}>
              {inviteCode}
            </Text>
            <Text variant="small" color={colors.inkMuted} center>
              Your co-parent signs up, chooses “Join my co-parent” and enters this code. You can find it again in your profile.
            </Text>
          </Card>
          <Button title="Share the code" icon="share-outline" variant="soft" size="lg" onPress={shareCode} />
          <Button title="Continue" size="lg" onPress={() => setMe(created)} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14, marginTop: 24 },
  choice: { gap: 6, padding: 22, borderRadius: radius.xl },
  link: { alignItems: 'center', paddingVertical: 14 },
  dob: { flexDirection: 'row', gap: 10 },
  codeInput: { letterSpacing: 4, fontSize: 20 },
  bigCode: { letterSpacing: 8 },
});
