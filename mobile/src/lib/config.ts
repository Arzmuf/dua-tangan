import Constants from 'expo-constants';
import { Platform } from 'react-native';

// 8077 rather than FastAPI's usual 8000, which other local projects often occupy.
const API_PORT = Number(process.env.EXPO_PUBLIC_API_PORT) || 8077;

/**
 * Where the FastAPI server lives.
 * 1. EXPO_PUBLIC_API_URL wins when set (e.g. a deployed API). EXPO_PUBLIC_API_PORT changes only the port.
 * 2. On web, the API runs on the same host as the page.
 * 3. In Expo Go, reuse the dev machine address Metro is served from, so a phone on the same
 *    Wi-Fi reaches the API without any configuration.
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  if (Platform.OS === 'web') {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return `http://${host || 'localhost'}:${API_PORT}`;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:${API_PORT}`;

  return Platform.OS === 'android' ? `http://10.0.2.2:${API_PORT}` : `http://localhost:${API_PORT}`;
}

export const API_URL = resolveApiUrl();
