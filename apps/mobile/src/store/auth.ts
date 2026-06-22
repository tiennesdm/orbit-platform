/**
 * ORBIT Mobile — Auth Store (Zustand)
 */

import { create } from 'zustand';
import { Platform } from 'react-native';
import { api, AuthSession } from '@/lib/api';

const TOKEN_KEY = 'orbit.auth.token';
const isWeb = Platform.OS === 'web';

const getToken = async (): Promise<string | null> => {
  if (isWeb) {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  }
  try {
    const SecureStore = await import('expo-secure-store');
    return SecureStore.getItemAsync(TOKEN_KEY);
  } catch { return null; }
};

interface AuthState {
  isHydrated: boolean;
  user: { did: string; handle: string } | null;
  token: string | null;
  hydrate: () => Promise<void>;
  signup: (handle: string, displayName: string, password: string) => Promise<AuthSession>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  isHydrated: false,
  user: null,
  token: null,

  async hydrate() {
    // Idempotent — don't re-hydrate if already done
    if (get().isHydrated) return;
    try {
      // CRITICAL: load the in-memory token from SecureStore / localStorage first
      // so subsequent api.* calls are authenticated.
      await api.init();
      const token = await getToken();
      const user = await api.getCurrentUser();
      set({ isHydrated: true, token: token ?? api.token ?? null, user });
    } catch (e) {
      // Network error or no token — treat as logged out, but mark hydrated
      set({ isHydrated: true, token: null, user: null });
    }
  },

  async signup(handle, displayName, password) {
    const session = await api.signup(handle, displayName, password);
    await api.setSession(session);
    set({ token: session.accessToken, user: { did: session.did, handle: session.handle } });
    return session;
  },

  async logout() {
    await api.clearSession();
    set({ token: null, user: null });
  },
}));
