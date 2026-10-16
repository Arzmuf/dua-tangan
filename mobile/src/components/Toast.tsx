import { Ionicons } from '@expo/vector-icons';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow } from '@/theme';
import { Text } from './Text';

type Tone = 'success' | 'error';
type Toast = { message: string; tone: Tone } | null;

type ToastApi = {
  show: (message: string, tone?: Tone) => void;
  trackSheet: (delta: 1 | -1) => void;
};

// The API is stable; the state changes. Separate contexts keep `useToast` callers from re-rendering.
const ToastApiContext = createContext<ToastApi>({ show: () => {}, trackSheet: () => {} });
const ToastStateContext = createContext<{ toast: Toast; opacity: Animated.Value } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast>(null);
  const [openSheets, setOpenSheets] = useState(0);
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, tone: Tone = 'success') => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, tone });
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: Platform.OS !== 'web' }).start();
      timer.current = setTimeout(
        () => {
          Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start(() =>
            setToast(null),
          );
        },
        tone === 'error' ? 3800 : 2400,
      );
    },
    [opacity],
  );

  const trackSheet = useCallback((delta: 1 | -1) => setOpenSheets((n) => Math.max(0, n + delta)), []);
  const api = useMemo(() => ({ show, trackSheet }), [show, trackSheet]);
  const state = useMemo(() => ({ toast, opacity }), [toast, opacity]);

  return (
    <ToastApiContext.Provider value={api}>
      <ToastStateContext.Provider value={state}>
        {children}
        {/* While a sheet (a Modal) is open the toast renders inside it, or it would sit underneath. */}
        {openSheets === 0 ? <ToastView /> : null}
      </ToastStateContext.Provider>
    </ToastApiContext.Provider>
  );
}

export function ToastView() {
  const state = useContext(ToastStateContext);
  const insets = useSafeAreaInsets();
  if (!state?.toast) return null;
  const { toast, opacity } = state;
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 10 }]}>
      <Animated.View
        style={[
          styles.toast,
          { opacity, transform: [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] },
        ]}
      >
        <Ionicons
          name={toast.tone === 'error' ? 'alert-circle' : 'checkmark-circle'}
          size={20}
          color={toast.tone === 'error' ? colors.danger : colors.primary}
        />
        <Text variant="smallStrong" color={colors.white} style={{ flexShrink: 1 }}>
          {toast.message}
        </Text>
      </Animated.View>
    </View>
  );
}

/** Lets a sheet host the toast while it is visible. */
export function useSheetToast(visible: boolean) {
  const { trackSheet } = useContext(ToastApiContext);
  useEffect(() => {
    if (!visible) return;
    trackSheet(1);
    return () => trackSheet(-1);
  }, [visible, trackSheet]);
}

export function useToast() {
  return useContext(ToastApiContext);
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 480,
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...shadow.raised,
  },
});
