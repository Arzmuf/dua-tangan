import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/** Refetch when a screen regains focus (skips the first focus, when the query just loaded). */
export function useRefreshOnFocus(refetch: () => unknown) {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      refetch();
    }, [refetch]),
  );
}

/** Keeps returning the last non-null item, so a sheet keeps its content while it animates closed. */
export function useLastShown<T>(item: T | null): T | null {
  const [shown, setShown] = useState(item);
  if (item !== null && item !== shown) setShown(item);
  return item ?? shown;
}

/** The current time, refreshed every `intervalMs`; a render-safe stand-in for Date.now(). */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}
