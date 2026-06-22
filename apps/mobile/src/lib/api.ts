/**
 * ORBIT Mobile — API client
 *
 * Talks to the same NestJS backend as the web app.
 * Uses expo-secure-store for secure token storage (Keychain / EncryptedSharedPreferences).
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// Web fallback: expo-secure-store uses native modules that don't exist on web
const isWeb = Platform.OS === 'web';
async function getItemAsync(key: string): Promise<string | null> {
  if (isWeb) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  return SecureStore.getItemAsync(key);
}
async function setItemAsync(key: string, value: string): Promise<void> {
  if (isWeb) {
    try { localStorage.setItem(key, value); } catch {}
    return;
  }
  await SecureStore.setItemAsync(key, value);
}
async function deleteItemAsync(key: string): Promise<void> {
  if (isWeb) {
    try { localStorage.removeItem(key); } catch {}
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

const API_BASE =
  Constants.expoConfig?.extra?.apiUrl ??
  // Default to IPv4 literal (127.0.0.1) — `localhost` resolves to ::1 (IPv6) first
  // on macOS, and our server binds 0.0.0.0 (IPv4 only), causing ECONNREFUSED with
  // no IPv4 fallback. MUST use 127.0.0.1 literal for service-to-localhost URLs.
  (Platform.OS === 'android' ? 'http://10.0.2.2:4001/api/v1' : 'http://127.0.0.1:4001/api/v1');

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
    if (this.token) return; // already loaded
    this.token = await getItemAsync(TOKEN_KEY);
  }

  private async setToken(token: string | null) {
    this.token = token;
    if (token) {
      await setItemAsync(TOKEN_KEY, token);
    } else {
      await deleteItemAsync(TOKEN_KEY);
    }
  }

  async setSession(session: AuthSession) {
    await this.setToken(session.accessToken);
    await setItemAsync(REFRESH_KEY, session.refreshToken);
    await setItemAsync(USER_KEY, JSON.stringify({ did: session.did, handle: session.handle }));
  }

  async clearSession() {
    await this.setToken(null);
    await deleteItemAsync(REFRESH_KEY);
    await deleteItemAsync(USER_KEY);
  }

  async getCurrentUser(): Promise<{ did: string; handle: string } | null> {
    const raw = await getItemAsync(USER_KEY);
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

  // === Voice rooms (P0) ===
  listVoiceRooms() { return this.request('GET', '/voice/rooms'); }
  createVoiceRoom(input: { title: string; mode: string; isPublic?: boolean }) {
    return this.request('POST', '/voice/rooms', input);
  }
  getVoiceRoom(id: string) { return this.request('GET', `/voice/rooms/${id}`); }
  joinVoiceRoom(id: string) { return this.request('POST', `/voice/rooms/${id}/join`); }
  leaveVoiceRoom(id: string) { return this.request('POST', `/voice/rooms/${id}/leave`); }
  sendVoiceSignal(id: string, signal: any) {
    return this.request('POST', `/voice/rooms/${id}/signal`, signal);
  }
  toggleHandRaise(id: string) { return this.request('POST', `/voice/rooms/${id}/hand`); }

  // === Monetization (P0) ===
  sendTip(toHandle: string, amountCents: number, message?: string) {
    return this.request('POST', '/monetization/tips', { toHandle, amountCents, message });
  }
  listTiers(handle: string) { return this.request('GET', `/monetization/tiers/${handle}`); }
  createTier(input: { name: string; priceCents: number; perks?: string[]; description?: string }) {
    return this.request('POST', '/monetization/tiers', input);
  }
  subscribe(handle: string, tierId: string) {
    return this.request('POST', '/monetization/subscribe', { handle, tierId });
  }
  // NOTE: backend route is /monetization/creators/:handle/earnings (public, needs handle)
  getCreatorEarnings(handle: string) { return this.request('GET', `/monetization/creators/${handle}/earnings`); }
  getCreatorTiers(handle: string) { return this.request('GET', `/monetization/creators/${handle}/tiers`); }
  getMySubscriptions() { return this.request('GET', '/monetization/me/subscriptions'); }
  getSubscriptionStatus(handle: string) {
    return this.request('GET', `/monetization/subscriptions/${handle}`);
  }

  // === Custom feeds (P0) ===
  // Backend routes: POST /feeds (create), GET /feeds/mine, PUT /feeds/:id, DELETE /feeds/:id
  //                 GET /feeds/public, POST /feeds/:id/pin, POST /feeds/:id/subscribe
  // NOTE: /feeds/mine returns a PLAIN ARRAY `[{...}]` not `{feeds: [...]}`
  listCustomFeeds() { return this.request<any>('GET', '/feeds/mine'); }
  listPublicFeeds() { return this.request<any>('GET', '/feeds/public'); }
  createCustomFeed(input: { name: string; emoji?: string; rules: any[]; isPublic?: boolean }) {
    return this.request('POST', '/feeds', input);
  }
  updateCustomFeed(id: string, input: any) {
    return this.request('PUT', `/feeds/${id}`, input);
  }
  deleteCustomFeed(id: string) { return this.request('DELETE', `/feeds/${id}`); }
  pinFeed(id: string) { return this.request('POST', `/feeds/${id}/pin`); }
  subscribeToFeed(id: string) { return this.request('POST', `/feeds/${id}/subscribe`); }

  // === Federation (P0) ===
  // Backend routes: GET /federation/resolve/:handle, GET /federation/did/:did,
  //                 POST /federation/handle, POST /federation/domain, POST /federation/domain/:domain/verify,
  //                 GET /federation/me/domains
  verifyDomain(domain: string) {
    return this.request('POST', `/federation/domain/${encodeURIComponent(domain)}/verify`);
  }
  resolveHandleAtProtocol(handle: string) {
    return this.request('GET', `/federation/resolve/${encodeURIComponent(handle)}`);
  }
  resolveDid(did: string) {
    return this.request('GET', `/federation/did/${encodeURIComponent(did)}`);
  }
  linkDomain(domain: string) {
    return this.request('POST', '/federation/domain', { domain });
  }
  getFederationStatus() { return this.request('GET', '/federation/me/domains'); }

  // === Wellness (P0) ===
  // Backend has /wellness/usage (GET) + /wellness/tick (POST) — not /stats
  getWellnessStats() { return this.request('GET', '/wellness/usage'); }
  getWellnessSettings() { return this.request('GET', '/wellness/settings'); }
  updateWellnessSettings(settings: any) {
    return this.request('POST', '/wellness/settings', settings);
  }
  // Backend has POST /wellness/parental (upsert) — not GET
  getParentalControls() { return this.request('GET', '/wellness/parental'); }
  updateParentalControls(settings: any) {
    return this.request('POST', '/wellness/parental', settings);
  }
  logWellnessTick(event: { durationSec?: number; metadata?: any }) {
    return this.request('POST', '/wellness/tick', event);
  }

  // === Remix (P0) ===
  // Backend flow: create the new post first, then link via POST /remix
  // Routes: POST /remix (link), GET /remix/of/:postId, GET /remix/chain/:postId
  async createRemix(input: { sourcePostId: string; mode: string; contentText: string; kind?: string }) {
    // Step 1: create the new post (this is the actual remix content)
    const newPost = await this.createPost({
      mode: input.mode,
      contentText: input.contentText,
      visibility: 'public',
    });
    // Step 2: link it to the source
    return this.request<any>('POST', '/remix', {
      remixPostId: String(newPost.postId),
      sourcePostId: String(input.sourcePostId),
      kind: (input.kind || 'duet') as any,
    });
  }
  listRemixes(rootPostId: string) { return this.request<any[]>('GET', `/remix/of/${rootPostId}`); }
  getRemixTree(rootPostId: string) { return this.request<any[]>('GET', `/remix/chain/${rootPostId}`); }

  // === AI Co-Creation (P0) ===
  // Backend routes: POST /ai-cocreate/{text,captions,image,video,audio,hashtags}, GET /ai-cocreate/assets
  generateAICaption(input: { mode: string; topic?: string; tone?: string; keywords?: string[] }) {
    return this.request('POST', '/ai-cocreate/captions', input);
  }
  generateAILongText(input: { topic: string; tone?: string; length?: number; keywords?: string[] }) {
    return this.request('POST', '/ai-cocreate/text', input);
  }
  generateAIImage(input: { prompt: string; style?: string; aspectRatio?: string }) {
    return this.request('POST', '/ai-cocreate/image', input);
  }
  generateAIVideo(input: { prompt: string; durationSec?: number; style?: string }) {
    return this.request('POST', '/ai-cocreate/video', input);
  }
  generateAIAudio(input: { text: string; voice?: string; format?: string }) {
    return this.request('POST', '/ai-cocreate/audio', input);
  }
  generateAIHashtags(input: { content: string; count?: number }) {
    return this.request('POST', '/ai-cocreate/hashtags', input);
  }
  listAIAssets() { return this.request('GET', '/ai-cocreate/assets'); }

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
  sendEmailCode() { return this.request('POST', '/auth/email/send-code'); }
  verifyEmailCode(code: string) { return this.request('POST', '/auth/email/verify', { code }); }
  setup2FA() { return this.request('POST', '/auth/2fa/setup'); }
  verify2FA(code: string) { return this.request('POST', '/auth/2fa/verify', { code }); }
  disable2FA(code: string) { return this.request('POST', '/auth/2fa/disable', { code }); }

  // === Media ===
  // Backend route: POST /media/register accepts {key, type, mimeType, bytes, ...}
  // Mobile sends {cid, mimeType, size} — map cid→key, size→bytes, default type
  registerMedia(input: { cid?: string; key?: string; mimeType: string; size?: number; bytes?: number; type?: 'image' | 'video' | 'audio' | 'file'; width?: number; height?: number }) {
    return this.request<any>('POST', '/media/register', {
      key: input.cid || input.key,
      type: input.type || 'image',
      mimeType: input.mimeType,
      bytes: input.bytes || input.size || 0,
      width: input.width,
      height: input.height,
    });
  }

  // === Bookmarks ===
  bookmarkPost(postId: string) { return this.request('POST', `/posts/${postId}/bookmark`); }
  unbookmarkPost(postId: string) { return this.request('DELETE', `/posts/${postId}/bookmark`); }
  listBookmarks() { return this.request('GET', '/posts/bookmarks'); }
}

export const api = new OrbitApi();
export { API_BASE };
