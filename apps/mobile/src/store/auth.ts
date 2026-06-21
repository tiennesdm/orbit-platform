/**
 * ORBIT Mobile — Auth Store (Zustand)
 */

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api, AuthSession } from '@/lib/api';

const TOKEN_KEY = 'orbit.auth.token';

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
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const user = await api.getCurrentUser();
    set({ isHydrated: true, token, user });
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
