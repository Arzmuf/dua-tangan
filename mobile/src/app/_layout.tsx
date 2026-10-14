import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Logo, Loading } from '@/components/Bits';
import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { ToastProvider } from '@/components/Toast';
import { AuthProvider, useAuth } from '@/lib/auth';
import { API_URL } from '@/lib/config';
import { colors } from '@/theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 5_000 } },
});

// React Query refetches on window focus on the web; on devices, use app foregrounding instead.
if (Platform.OS !== 'web') {
  focusManager.setEventListener((handleFocus) => {
    const sub = AppState.addEventListener('change', (state) => handleFocus(state === 'active'));
    return () => sub.remove();
  });
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <StatusBar style="dark" />
            {fontsLoaded ? <RootNavigator /> : <Loading />}
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { status, me, error, retry } = useAuth();

  if (status === 'loading') return <Loading />;
  if (status === 'offline') return <Offline message={error} onRetry={retry} />;

  const signedIn = status === 'signedIn';
  const hasFamily = !!me?.family;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={signedIn && hasFamily}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="record" />
        <Stack.Screen name="support" />
        <Stack.Screen name="profile" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !hasFamily}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack.Protected>
    </Stack>
  );
}

function Offline({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <View style={styles.offline}>
      <Logo size={64} color={colors.primary} />
      <Text variant="heading" center>
        Can’t reach Dua Tangan
      </Text>
      <Text variant="small" color={colors.inkMuted} center style={{ maxWidth: 300 }}>
        {message ?? 'The server did not respond.'} Make sure the API is running and your phone is on the same Wi-Fi as your computer.
      </Text>
      <Text variant="mono" color={colors.inkFaint}>
        {API_URL}
      </Text>
      <Button title="Try again" onPress={onRetry} style={{ alignSelf: 'stretch', marginTop: 8 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  offline: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, backgroundColor: colors.bg },
});
