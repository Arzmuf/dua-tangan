import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme';
import { Button } from './Button';
import { Text } from './Text';

/**
 * An in-app "are you sure?" step before something that can't be undone. Browser dialogs
 * (window.confirm) are silently blocked in some in-app browsers and previews, so we ask here.
 */
export function ConfirmCard({
  title,
  message,
  action,
  loading,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  action: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.card} accessibilityRole="alert">
      <Text variant="smallStrong" color={colors.dangerDeep}>
        {title}
      </Text>
      <Text variant="small" color={colors.inkMuted}>
        {message}
      </Text>
      <View style={styles.actions}>
        <Button title="Cancel" variant="outline" size="sm" onPress={onCancel} style={{ flex: 1 }} />
        <Button title={action} variant="destructive" size="sm" loading={loading} onPress={onConfirm} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.dangerSoft, borderRadius: radius.lg, padding: 16, gap: 6 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
});
