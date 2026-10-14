import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Hero } from '@/components/Hero';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { FormError, goBackOr } from '@/features/authForm';
import { useAuth } from '@/lib/auth';
import { colors } from '@/theme';

export default function Register() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || !email.trim()) return setError('Fill in your name and email.');
    if (password.length < 6) return setError('Use at least 6 characters for your password.');
    setBusy(true);
    setError(null);
    try {
      await register(name.trim(), email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed.');
      setBusy(false);
    }
  };

  return (
    <Screen
      withTabBar={false}
      header={
        <Hero
          color={colors.yellow}
          onBack={() => goBackOr('/welcome')}
          title="Create your account"
          subtitle="Next, you'll set up your family or join your co-parent."
        />
      }
    >
      <View style={styles.form}>
        <Field label="Your name" value={name} onChangeText={setName} placeholder="e.g. Nadia Wulandari" autoComplete="name" />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="At least 6 characters"
          secureTextEntry
          autoComplete="new-password"
          onSubmitEditing={submit}
        />
        <FormError message={error} />
        <Button title="Create account" size="lg" loading={busy} onPress={submit} />
      </View>
      <Pressable onPress={() => router.replace('/login')} style={styles.switch}>
        <Text variant="small" color={colors.inkMuted}>
          Already have an account? <Text variant="smallStrong" color={colors.primaryDeep}>Sign in</Text>
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14, marginTop: 24 },
  switch: { alignItems: 'center', paddingVertical: 20 },
});
