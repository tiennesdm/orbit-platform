/**
 * ORBIT Mobile — API client
 *
 * Talks to the same NestJS backend as the web app.
 * Uses expo-secure-store for secure token storage (Keychain / EncryptedSharedPreferences).
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const API_BASE =
  Constants.expoConfig?.extra?.apiUrl ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:4000/api/v1' : 'http://127.0.0.1:4000/api/v1');

const TOKEN_KEY = 'orbit.auth.token';
const REFRESH_KEY = 'orbit.auth.refresh';
const USER_KEY = 'orbit.auth.user';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  did: string;
  handle: string;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: any) {
    super(message);
  }
}

export class OrbitApi {
  private token: string | null = null;

  async init() {
    this.token = await SecureStore.getItemAsync(TOKEN_KEY);
  }

  private async setToken(token: string | null) {
    this.token = token;
    if (token) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  }

  async setSession(session: AuthSession) {
    await this.setToken(session.accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, session.refreshToken);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify({ did: session.did, handle: session.handle }));
  }

  async clearSession() {
    await this.setToken(null);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  }

  async getCurrentUser(): Promise<{ did: string; handle: string } | null> {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any,
    options: { authenticated?: boolean } = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (options.authenticated !== false && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const url = `${API_BASE}${path}`;
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch {}
      throw new ApiError(
        response.status,
        errorData.error ?? 'unknown',
        errorData.message ?? response.statusText,
        errorData.details
      );
    }
    if (response.status === 204) return undefined as T;
    return response.json();
  }

  // === Public ===
  health() { return this.request<{ status: string }>('GET', '/health/live', undefined, { authenticated: false }); }

  // === Auth ===
  signup(handle: string, displayName: string, password: string) {
    return this.request<AuthSession>('POST', '/identity/signup', { handle, displayName, password }, { authenticated: false });
  }

  getMe() { return this.request('GET', '/identity/me'); }

  // === Posts ===
  createPost(input: { mode: string; contentText: string; visibility?: string }) {
    return this.request('POST', '/posts', input);
  }

  getFeed() { return this.request('GET', '/feed/home'); }

  likePost(authorId: string, postId: string) {
    return this.request('POST', `/posts/${authorId}/${postId}/like`);
  }

  // === Social ===
  follow(handle: string) { return this.request('POST', `/identity/${handle}/follow`); }
  unfollow(handle: string) { return this.request('DELETE', `/identity/${handle}/follow`); }

  // === Search ===
  search(q: string) { return this.request('GET', `/search?q=${encodeURIComponent(q)}`); }

  // === AI Agent ===
  getAgentState() { return this.request('GET', '/ai-agent/state'); }
  chatWithAgent(message: string) {
    return this.request('POST', '/ai-agent/chat', { message });
  }

  // === Marketplace ===
  listListings() { return this.request('GET', '/marketplace'); }
  createListing(input: any) { return this.request('POST', '/marketplace', input); }

  // === Groups ===
  listGroups() { return this.request('GET', '/groups'); }
  createGroup(input: any) { return this.request('POST', '/groups', input); }

  // === Auth enhancements (Phase 2) ===
  requestRecovery(email: string) {
    return this.request('POST', '/auth/recovery/request', { email });
  }
  verifyRecovery(email: string, code: string) {
    return this.request('POST', '/auth/recovery/verify', { email, code });
  }
  resetHandle(email: string, code: string, newHandle: string) {
    return this.request('POST', '/auth/recovery/reset', { email, code, newHandle });
  }
  sendEmailCode() {
    return this.request('POST', '/auth/email/send-code');
  }
  verifyEmailCode(code: string) {
    return this.request('POST', '/auth/email/verify', { code });
  }
  setup2FA() {
    return this.request('POST', '/auth/2fa/setup');
  }

  // === Profile enhancements ===
  updateProfile(updates: {
    displayName?: string;
    bio?: string;
    avatarCid?: string;
    coverCid?: string;
    email?: string;
    themeColor?: string;
    linkWebsite?: string;
    linkTwitter?: string;
    linkGithub?: string;
    linkLinkedin?: string;
    linkCustomLabel?: string;
    linkCustomUrl?: string;
  }) {
    return this.request('PUT', '/identity/me', updates);
  }

  // === Drafts ===
  listDrafts() { return this.request('GET', '/posts/drafts'); }
  saveDraft(input: any) { return this.request('POST', '/posts/drafts', input); }
  deleteDraft(id: string) { return this.request('DELETE', `/posts/drafts/${id}`); }
  schedulePost(draftId: string, scheduledAt: string) {
    return this.request('POST', `/posts/drafts/${draftId}/schedule`, { scheduledAt });
  }
  listScheduled() { return this.request('GET', '/posts/scheduled'); }

  // === Pinned posts ===
  pinPost(postId: string) { return this.request('POST', `/posts/${postId}/pin`); }
  unpinPost(postId: string) { return this.request('DELETE', `/posts/${postId}/pin`); }
  listPinned(handle: string) { return this.request('GET', `/identity/${handle}/pinned`); }

  // === Lists ===
  listUserLists() { return this.request('GET', '/lists'); }
  createList(input: { name: string; kind: string; emoji?: string; description?: string }) {
    return this.request('POST', '/lists', input);
  }
  muteUser(handle: string) { return this.request('POST', `/identity/${handle}/mute`); }
  blockUser(handle: string) { return this.request('POST', `/identity/${handle}/block`); }
  unmuteUser(handle: string) { return this.request('DELETE', `/identity/${handle}/mute`); }
  unblockUser(handle: string) { return this.request('DELETE', `/identity/${handle}/block`); }

  // === Hashtag ===
  getTag(name: string) { return this.request('GET', `/tag/${name}`); }
}

export const api = new OrbitApi();
export { API_BASE };
