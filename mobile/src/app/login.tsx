import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { Hero } from '@/components/Hero';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { FormError, goBackOr } from '@/features/authForm';
import { useAuth } from '@/lib/auth';
import { colors } from '@/theme';

const DEMO_PASSWORD = 'demo1234';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: string, p: string, who = 'form') => {
    if (!e.trim() || !p) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(who);
    setError(null);
    try {
      await signIn(e.trim(), p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
      setBusy(null);
    }
  };

  return (
    <Screen
      withTabBar={false}
      header={<Hero color={colors.yellow} onBack={() => goBackOr('/welcome')} title="Welcome back" subtitle="Sign in to your family space." />}
    >
      <View style={styles.form}>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={() => submit(email, password)}
        />
        <FormError message={error} />
        <Button title="Sign in" size="lg" loading={busy === 'form'} disabled={!!busy} onPress={() => submit(email, password)} />
      </View>

      <Card style={styles.demo}>
        <Text variant="label" color={colors.inkFaint}>
          Try the demo
        </Text>
        <Text variant="small" color={colors.inkMuted}>
          Nadia and Reza share Kirana. Sign in as either parent to see both sides of a request.
        </Text>
        <View style={styles.demoButtons}>
          <Button
            title="Nadia"
            icon="person-circle-outline"
            variant="soft"
            loading={busy === 'nadia'}
            disabled={!!busy}
            onPress={() => submit('nadia@duatangan.app', DEMO_PASSWORD, 'nadia')}
            style={{ flex: 1 }}
          />
          <Button
            title="Reza"
            icon="person-circle-outline"
            variant="soft"
            loading={busy === 'reza'}
            disabled={!!busy}
            onPress={() => submit('reza@duatangan.app', DEMO_PASSWORD, 'reza')}
            style={{ flex: 1 }}
          />
        </View>
      </Card>

      <Pressable onPress={() => router.replace('/register')} style={styles.switch}>
        <Text variant="small" color={colors.inkMuted}>
          New here? <Text variant="smallStrong" color={colors.primaryDeep}>Create an account</Text>
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14, marginTop: 24 },
  demo: { marginTop: 24, gap: 8 },
  demoButtons: { flexDirection: 'row', gap: 10, marginTop: 6 },
  switch: { alignItems: 'center', paddingVertical: 20 },
});
