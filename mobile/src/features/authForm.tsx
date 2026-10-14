import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { colors, radius } from '@/theme';

export function goBackOr(path: '/welcome' | '/login') {
  if (router.canGoBack()) router.back();
  else router.replace(path);
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.error}>
      <Text variant="smallStrong" color={colors.pinkDeep}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  error: { backgroundColor: colors.pinkSoft, borderRadius: radius.md, padding: 12 },
});
