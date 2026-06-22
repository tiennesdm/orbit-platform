/**
 * ORBIT API client
 * Type-safe wrapper around the backend REST API
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: any) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('orbit_token') : null;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(res.status, err.error?.code || 'unknown', err.error?.message || res.statusText, err.error?.details);
  }

  return res.json();
}

export const api = {
  // Identity
  identity: {
    signup: (data: { handle?: string; displayName: string; domain?: string }) =>
      request<{ did: string; handle: string; accessToken: string; refreshToken: string }>('/identity/signup', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    me: () => request<any>('/identity/me'),
    updateMe: (data: any) => request<any>('/identity/me', { method: 'PUT', body: JSON.stringify(data) }),
    exportData: () => request<any>('/identity/me/export'),
    refresh: (refreshToken: string) =>
      request<any>('/identity/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
    registerOptions: (data: { handle?: string; displayName: string }) =>
      request<any>('/identity/register/options', { method: 'POST', body: JSON.stringify(data) }),
    registerVerify: (data: any) =>
      request<any>('/identity/register/verify', { method: 'POST', body: JSON.stringify(data) }),
    loginOptions: (handle: string) =>
      request<any>('/identity/login/options', { method: 'POST', body: JSON.stringify({ handle }) }),
    loginVerify: (data: any) =>
      request<any>('/identity/login/verify', { method: 'POST', body: JSON.stringify(data) }),
  },

  // Posts
  posts: {
    create: (data: any) => request<any>('/posts', { method: 'POST', body: JSON.stringify(data) }),
    list: (params: any = {}) => {
      const q = new URLSearchParams(params).toString();
      return request<any>(`/posts?${q}`);
    },
    get: (authorId: string, postId: string) => request<any>(`/posts/${authorId}/${postId}`),
    update: (authorId: string, postId: string, data: any) =>
      request<any>(`/posts/${authorId}/${postId}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (authorId: string, postId: string) =>
      request<any>(`/posts/${authorId}/${postId}`, { method: 'DELETE' }),
    like: (authorId: string, postId: string) =>
      request<any>(`/posts/${authorId}/${postId}/like`, { method: 'POST' }),
  },

  // Feed
  feed: {
    home: (params: any = {}) => {
      const q = new URLSearchParams(params).toString();
      return request<any>(`/feed/home?${q}`);
    },
    digest: () => request<{ summary: string }>('/feed/digest'),
  },

  // DMs
  dms: {
    listThreads: () => request<any[]>('/dms/threads'),
    getOrCreateThread: (otherUserId: string) =>
      request<any>('/dms/threads', { method: 'POST', body: JSON.stringify({ otherUserId }) }),
    getMessages: (threadId: string, params: any = {}) => {
      const q = new URLSearchParams(params).toString();
      return request<any[]>(`/dms/threads/${threadId}/messages?${q}`);
    },
    sendMessage: (data: any) => request<any>('/dms/messages', { method: 'POST', body: JSON.stringify(data) }),
    markRead: (messageId: string, threadId: string) =>
      request<any>(`/dms/messages/${messageId}/read`, { method: 'POST', body: JSON.stringify({ threadId }) }),
  },

  // Stories
  stories: {
    feed: () => request<any[]>('/stories/feed'),
    create: (data: any) => request<any>('/stories', { method: 'POST', body: JSON.stringify(data) }),
  },

  // Reels
  reels: {
    forYou: (params: any = {}) => {
      const q = new URLSearchParams(params).toString();
      return request<any[]>(`/reels/foryou?${q}`);
    },
    create: (data: any) => request<any>('/reels', { method: 'POST', body: JSON.stringify(data) }),
  },

  // Groups
  groups: {
    myGroups: () => request<any[]>('/groups'),
    get: (groupId: string) => request<any>(`/groups/${groupId}`),
    create: (data: any) => request<any>('/groups', { method: 'POST', body: JSON.stringify(data) }),
    join: (groupId: string) => request<any>(`/groups/${groupId}/join`, { method: 'POST' }),
    events: (groupId: string) => request<any[]>(`/groups/${groupId}/events`),
  },

  // Marketplace
  marketplace: {
    search: (params: any = {}) => {
      const q = new URLSearchParams(params).toString();
      return request<any>(`/marketplace?${q}`);
    },
    create: (data: any) => request<any>('/marketplace', { method: 'POST', body: JSON.stringify(data) }),
  },

  // Search
  search: {
    query: (params: any) => {
      const q = new URLSearchParams(params).toString();
      return request<any>(`/search?${q}`);
    },
    universal: (q: string, type: string = 'all', limit: number = 20) => {
      return request<any>(`/search?q=${encodeURIComponent(q)}&type=${type}&limit=${limit}`);
    },
  },

  // Notifications
  notifications: {
    list: (params: any = {}) => {
      const q = new URLSearchParams(params).toString();
      return request<any[]>(`/notifications?${q}`);
    },
    markRead: (notificationId: string) =>
      request<any>(`/notifications/${notificationId}/read`, { method: 'POST' }),
    markAllRead: () => request<any>('/notifications/read-all', { method: 'POST' }),
  },

  // AI Agent
  ai: {
    chat: (message: string, conversationId?: string) =>
      request<any>('/ai-agent/chat', { method: 'POST', body: JSON.stringify({ message, conversationId }) }),
    state: () => request<any>('/ai-agent/state'),
    updateState: (data: any) => request<any>('/ai-agent/state', { method: 'PUT', body: JSON.stringify(data) }),
    digest: () => request<{ summary: string }>('/ai-agent/digest'),
  },

  // Moderation
  moderation: {
    score: (text: string) =>
      request<any>('/moderation/score', { method: 'POST', body: JSON.stringify({ text }) }),
    report: (data: any) => request<any>('/moderation/report', { method: 'POST', body: JSON.stringify(data) }),
  },
};

// === P0 Features — Phase 3 ===

// Voice rooms
(api as any).listVoiceRooms = () => request<any>('/voice/rooms', { method: 'GET' });
(api as any).getVoiceRoom = (id: string) => request<any>(`/voice/rooms/${id}`, { method: 'GET' });
(api as any).createVoiceRoom = (input: any) => request<any>('/voice/rooms', { method: 'POST', body: JSON.stringify(input) });
(api as any).startVoiceRoom = (id: string) => request<any>(`/voice/rooms/${id}/start`, { method: 'POST' });
(api as any).endVoiceRoom = (id: string) => request<any>(`/voice/rooms/${id}/end`, { method: 'POST' });
(api as any).joinVoiceRoom = (id: string, role = 'listener') => request<any>(`/voice/rooms/${id}/join`, { method: 'POST', body: JSON.stringify({ role }) });
(api as any).leaveVoiceRoom = (id: string) => request<any>(`/voice/rooms/${id}/leave`, { method: 'POST' });
(api as any).getVoiceRoomPeers = (id: string) => request<any>(`/voice/rooms/${id}/peers`, { method: 'GET' });

// Monetization
(api as any).sendTip = (input: any) => request<any>('/monetization/tips', { method: 'POST', body: JSON.stringify(input) });
(api as any).getCreatorEarnings = (handle: string) => request<any>(`/monetization/creators/${handle}/earnings`, { method: 'GET' });
(api as any).createTier = (input: any) => request<any>('/monetization/tiers', { method: 'POST', body: JSON.stringify(input) });
(api as any).listTiers = (handle: string) => request<any>(`/monetization/creators/${handle}/tiers`, { method: 'GET' });
(api as any).subscribe = (input: any) => request<any>('/monetization/subscriptions', { method: 'POST', body: JSON.stringify(input) });
(api as any).cancelSubscription = (creatorDid: string) => request<any>(`/monetization/subscriptions/${creatorDid}`, { method: 'DELETE' });
(api as any).mySubscriptions = () => request<any>('/monetization/me/subscriptions', { method: 'GET' });
(api as any).markPostPaywalled = (input: any) => request<any>('/monetization/posts/paywall', { method: 'POST', body: JSON.stringify(input) });

// Custom feeds
(api as any).createFeed = (input: any) => request<any>('/feeds', { method: 'POST', body: JSON.stringify(input) });
(api as any).updateFeed = (id: string, input: any) => request<any>(`/feeds/${id}`, { method: 'PUT', body: JSON.stringify(input) });
(api as any).deleteFeed = (id: string) => request<any>(`/feeds/${id}`, { method: 'DELETE' });
(api as any).myFeeds = () => request<any>('/feeds/mine', { method: 'GET' });
(api as any).publicFeeds = () => request<any>('/feeds/public', { method: 'GET' });
(api as any).subscribeFeed = (id: string) => request<any>(`/feeds/${id}/subscribe`, { method: 'POST' });
(api as any).unsubscribeFeed = (id: string) => request<any>(`/feeds/${id}/subscribe`, { method: 'DELETE' });

// Federation
(api as any).resolveHandle = (handle: string) => request<any>(`/federation/resolve/${handle}`, { method: 'GET' });
(api as any).setupDomain = (input: any) => request<any>('/federation/domain', { method: 'POST', body: JSON.stringify(input) });
(api as any).verifyDomain = (domain: string) => request<any>(`/federation/domain/${domain}/verify`, { method: 'POST' });
(api as any).myDomains = () => request<any>('/federation/me/domains', { method: 'GET' });

// Wellness
(api as any).getWellness = () => request<any>('/wellness/settings', { method: 'GET' });
(api as any).updateWellness = (settings: any) => request<any>('/wellness/settings', { method: 'POST', body: JSON.stringify(settings) });
(api as any).tickWellness = (seconds: number) => request<any>('/wellness/tick', { method: 'POST', body: JSON.stringify({ seconds }) });
(api as any).getWellnessUsage = () => request<any>('/wellness/usage', { method: 'GET' });
(api as any).setParentalControls = (input: any) => request<any>('/wellness/parental', { method: 'POST', body: JSON.stringify(input) });

// Remix
(api as any).createRemix = (input: any) => request<any>('/remix', { method: 'POST', body: JSON.stringify(input) });
(api as any).remixesOf = (postId: string, kind?: string) => request<any>(`/remix/of/${postId}${kind ? `?kind=${kind}` : ''}`, { method: 'GET' });

// AI co-creation
(api as any).aiGenerateText = (input: any) => request<any>('/ai-cocreate/text', { method: 'POST', body: JSON.stringify(input) });
(api as any).aiGenerateCaptions = (input: any) => request<any>('/ai-cocreate/captions', { method: 'POST', body: JSON.stringify(input) });
(api as any).aiGenerateImage = (input: any) => request<any>('/ai-cocreate/image', { method: 'POST', body: JSON.stringify(input) });
(api as any).aiGenerateVideo = (input: any) => request<any>('/ai-cocreate/video', { method: 'POST', body: JSON.stringify(input) });
(api as any).aiGenerateAudio = (input: any) => request<any>('/ai-cocreate/audio', { method: 'POST', body: JSON.stringify(input) });
(api as any).aiSuggestHashtags = (content: string) => request<any>('/ai-cocreate/hashtags', { method: 'POST', body: JSON.stringify({ content }) });
(api as any).myAiAssets = (kind?: string) => request<any>(`/ai-cocreate/assets${kind ? `?kind=${kind}` : ''}`, { method: 'GET' });
