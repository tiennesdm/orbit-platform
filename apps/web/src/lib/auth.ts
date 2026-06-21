/**
 * Auth store — Zustand
 * Manages session, tokens, current user
 */

'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, ApiError } from './api';

interface User {
  did: string;
  handle: string;
  displayName: string;
  avatarCid?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  signup: (data: { handle?: string; displayName: string }) => Promise<void>;
  signin: (handle: string) => Promise<{ challengeId: string; options: any }>;
  verifyLogin: (challengeId: string, credential: any) => Promise<void>;
  signout: () => void;
  refresh: () => Promise<void>;
  fetchMe: () => Promise<void>;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      async signup(data) {
        set({ isLoading: true, error: null });
        try {
          // Direct signup for testing — production uses WebAuthn
          const res = await api.identity.signup(data);
          set({
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
            isAuthenticated: true,
          });
          localStorage.setItem('orbit_token', res.accessToken);
          localStorage.setItem('orbit_refresh', res.refreshToken);
          await get().fetchMe();
        } catch (err: any) {
          set({ error: err.message || 'Signup failed' });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      async signin(handle) {
        set({ isLoading: true, error: null });
        try {
          const res = await api.identity.loginOptions(handle);
          return res;
        } catch (err: any) {
          set({ error: err.message || 'Login failed' });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      async verifyLogin(challengeId, credential) {
        set({ isLoading: true, error: null });
        try {
          const res = await api.identity.loginVerify({ challengeId, credential });
          set({
            accessToken: res.session.accessToken,
            refreshToken: res.session.refreshToken,
            isAuthenticated: true,
          });
          localStorage.setItem('orbit_token', res.session.accessToken);
          localStorage.setItem('orbit_refresh', res.session.refreshToken);
          await get().fetchMe();
        } catch (err: any) {
          set({ error: err.message || 'Login failed' });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      async fetchMe() {
        if (!get().isAuthenticated) return;
        try {
          const user = await api.identity.me();
          set({ user });
        } catch (err) {
          // Token expired — try refresh
          await get().refresh();
        }
      },

      async refresh() {
        const refreshToken = get().refreshToken || localStorage.getItem('orbit_refresh');
        if (!refreshToken) {
          get().signout();
          return;
        }
        try {
          const res = await api.identity.refresh(refreshToken);
          set({
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
          });
          localStorage.setItem('orbit_token', res.accessToken);
          localStorage.setItem('orbit_refresh', res.refreshToken);
          await get().fetchMe();
        } catch {
          get().signout();
        }
      },

      signout() {
        localStorage.removeItem('orbit_token');
        localStorage.removeItem('orbit_refresh');
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'orbit-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
