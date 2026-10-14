import { useEffect, useState, type ReactNode } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius } from '@/theme';
import { IconButton } from './Button';
import { Text } from './Text';
import { ToastView, useSheetToast } from './Toast';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/** Bottom sheet built on Modal so it behaves the same in Expo Go and on the web. */
export function Sheet({ visible, onClose, title, subtitle, children, footer }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [slide] = useState(() => new Animated.Value(0));
  useSheetToast(visible);

  useEffect(() => {
    if (!visible) return;
    slide.setValue(0);
    Animated.spring(slide, {
      toValue: 1,
      useNativeDriver: Platform.OS !== 'web',
      damping: 22,
      stiffness: 220,
    }).start();
  }, [visible, slide]);

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [height * 0.4, 0] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <Pressable accessibilityLabel="Dismiss" style={styles.backdrop} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            { maxHeight: height * 0.9, paddingBottom: insets.bottom + 16, transform: [{ translateY }] },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text variant="heading">{title}</Text>
              {subtitle ? (
                <Text variant="small" color={colors.inkMuted} style={{ marginTop: 2 }}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <IconButton icon="close" label="Close" onPress={onClose} background={colors.field} size={36} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
        <ToastView />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(20, 30, 28, 0.38)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: 10,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 22, paddingBottom: 10, gap: 12 },
  headerText: { flex: 1, paddingTop: 4 },
  body: { paddingHorizontal: 22, paddingBottom: 8, gap: 14 },
  footer: { paddingHorizontal: 22, paddingTop: 10, gap: 10 },
});
