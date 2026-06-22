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
    this.token = await this.getItem(TOKEN_KEY);
  }

  private async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    }
    try { return await SecureStore.getItemAsync(key); } catch { return null; }
  }

  private async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
      return;
    }
    try { await SecureStore.setItemAsync(key, value); } catch {}
  }

  private async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key);
      return;
    }
    try { await SecureStore.deleteItemAsync(key); } catch {}
  }

  private async setToken(token: string | null) {
    this.token = token;
    if (token) {
      await this.setItem(TOKEN_KEY, token);
    } else {
      await this.deleteItem(TOKEN_KEY);
    }
  }

  async setSession(session: AuthSession) {
    await this.setToken(session.accessToken);
    await this.setItem(REFRESH_KEY, session.refreshToken);
    await this.setItem(USER_KEY, JSON.stringify({ did: session.did, handle: session.handle }));
  }

  async clearSession() {
    await this.setToken(null);
    await this.deleteItem(REFRESH_KEY);
    await this.deleteItem(USER_KEY);
  }

  async getCurrentUser(): Promise<{ did: string; handle: string } | null> {
    const raw = await this.getItem(USER_KEY);
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

  // === DMs ===
  listThreads() { return this.request('GET', '/dms/threads'); }
  getMessages(threadId: string) {
    return this.request('GET', `/dms/threads/${threadId}/messages`);
  }
  sendMessage(threadId: string, content: string, encrypted: boolean = true) {
    return this.request('POST', `/dms/threads/${threadId}/messages`, { content, encrypted });
  }
  createThread(participantDid: string) {
    return this.request('POST', '/dms/threads', { participants: [participantDid] });
  }

  // === Notifications ===
  listNotifications() { return this.request('GET', '/notifications'); }
  markAllRead() { return this.request('POST', '/notifications/read-all'); }

  // === Stories ===
  listStories() { return this.request('GET', '/stories'); }
  createStory(input: { text?: string; mediaIds?: string[] }) {
    return this.request('POST', '/stories', input);
  }

  // === Reels ===
  listReels() { return this.request('GET', '/reels'); }

  // === AI Agent ===
  getAgentDigest() { return this.request('POST', '/ai-agent/digest'); }
  updateAgentState(updates: { autonomyLevel?: string; personality?: string }) {
    return this.request('POST', '/ai-agent/state', updates);
  }

  // === GDPR ===
  exportData() { return this.request('GET', '/gdpr/export'); }
  deleteAccount() { return this.request('POST', '/gdpr/delete'); }
  cancelDelete() { return this.request('POST', '/gdpr/cancel-delete'); }

  // === Media ===
  getPresignedUpload(contentType: string, bytes: number) {
    return this.request('POST', '/media/presign', { contentType, bytes });
  }
  registerMedia(input: any) { return this.request('POST', '/media/register', input); }
}

export const api = new OrbitApi();
export { API_BASE };
