/**
 * ORBIT Mobile — Auth Store (Zustand)
 */

import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api, AuthSession } from '@/lib/api';

const TOKEN_KEY = 'orbit.auth.token';

// Web fallback — SecureStore isn't available on web, use localStorage
const isWeb = Platform.OS === 'web';

async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {}
}

async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {}
}

interface AuthState {
  isHydrated: boolean;
  user: { did: string; handle: string } | null;
  token: string | null;
  hydrate: () => Promise<void>;
  signup: (handle: string, displayName: string, password: string) => Promise<AuthSession>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  isHydrated: false,
  user: null,
  token: null,

  async hydrate() {
    const token = await getItem(TOKEN_KEY);
    const user = await api.getCurrentUser();
    set({ isHydrated: true, token, user });
  },

  async signup(handle, displayName, password) {
    const session = await api.signup(handle, displayName, password);
    await api.setSession(session);
    await setItem(TOKEN_KEY, session.accessToken);
    set({ token: session.accessToken, user: { did: session.did, handle: session.handle } });
    return session;
  },

  async logout() {
    await api.clearSession();
    await deleteItem(TOKEN_KEY);
    set({ token: null, user: null });
  },
}));
