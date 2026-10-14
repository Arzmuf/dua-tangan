import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'duatangan.token';

// SecureStore (Keychain / Keystore) on devices; localStorage on web, where SecureStore isn't available.
export const tokenStorage = {
  async get(): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return window.localStorage.getItem(KEY);
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(KEY);
  },

  async set(token: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        window.localStorage.setItem(KEY, token);
      } catch {
        // Private mode or blocked storage: the session simply won't survive a reload.
      }
      return;
    }
    await SecureStore.setItemAsync(KEY, token);
  },

  async clear(): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        window.localStorage.removeItem(KEY);
      } catch {
        // Nothing stored.
      }
      return;
    }
    await SecureStore.deleteItemAsync(KEY);
  },
};
