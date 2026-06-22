'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Heart, MessageCircle, UserPlus, Repeat2, AtSign, Sparkles,
  Bell, CheckCheck, ArrowLeft, Settings as SettingsIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

type Notification = {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'repost' | 'mention' | 'ai';
  actor: { handle: string; displayName: string; avatarCid?: string };
  postId?: string;
  postExcerpt?: string;
  commentText?: string;
  createdAt: string;
  read: boolean;
};

const ICON_MAP: Record<Notification['type'], any> = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  repost: Repeat2,
  mention: AtSign,
  ai: Sparkles,
};

const COLOR_MAP: Record<Notification['type'], string> = {
  like: 'text-pink-500',
  comment: 'text-blue-500',
  follow: 'text-purple-500',
  repost: 'text-green-500',
  mention: 'text-amber-500',
  ai: 'text-violet-500',
};

const MOCK: Notification[] = [
  { id: 'n1', type: 'like', actor: { handle: 'alice', displayName: 'Alice' }, postExcerpt: 'Just shipped v2 of the new feature 🚀', createdAt: '5m', read: false },
  { id: 'n2', type: 'follow', actor: { handle: 'bob', displayName: 'Bob' }, createdAt: '23m', read: false },
  { id: 'n3', type: 'comment', actor: { handle: 'carol', displayName: 'Carol' }, postExcerpt: 'Coffee + code = perfect morning ☕', commentText: 'This is so me! 😂', createdAt: '1h', read: false },
  { id: 'n4', type: 'mention', actor: { handle: 'diana', displayName: 'Diana' }, postExcerpt: 'Working on a new project with @you', createdAt: '3h', read: true },
  { id: 'n5', type: 'repost', actor: { handle: 'eve', displayName: 'Eve' }, postExcerpt: 'The future of social is portable, encrypted, and AI-native.', createdAt: '1d', read: true },
  { id: 'n6', type: 'ai', actor: { handle: 'orbit', displayName: 'ORBIT AI' }, postExcerpt: '3 new people you might want to follow based on your recent activity.', createdAt: '1d', read: true },
];

export default function NotificationsPage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const hasHydrated = useAuth((s) => s.hasHydrated);
  const [filter, setFilter] = useState<'all' | 'mentions'>('all');
  const [items, setItems] = useState<Notification[]>(MOCK);

  if (hasHydrated && !user) {
    router.push('/login');
    return null;
  }
  if (!hasHydrated) return null;

  const filtered = filter === 'mentions' ? items.filter((i) => i.type === 'mention') : items;
  const unread = items.filter((i) => !i.read).length;

  function markAllRead() {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
  }

  return (
    <div className="min-h-screen bg-bg-elevated pb-20">
      <header className="sticky top-0 z-30 bg-bg-elevated/90 backdrop-blur-md border-b border-hairline">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-bg-subtle hover:bg-bg-cream flex items-center justify-center text-text-primary transition-colors">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="font-display font-extrabold text-xl tracking-tight">Notifications</h1>
              <p className="text-xs text-text-tertiary">{unread > 0 ? `${unread} new` : 'All caught up'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <button onClick={markAllRead} className="text-sm text-accent font-semibold px-3 py-1.5 rounded-full hover:bg-accent/10 transition-colors flex items-center gap-1.5">
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
            <Link href="/settings" className="w-9 h-9 rounded-full bg-bg-subtle hover:bg-bg-cream flex items-center justify-center text-text-primary transition-colors">
              <SettingsIcon size={18} />
            </Link>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="max-w-2xl mx-auto flex gap-1 px-4 pb-3">
          {(['all', 'mentions'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                filter === f
                  ? 'bg-text-primary text-white'
                  : 'bg-bg-subtle text-text-secondary hover:text-text-primary'
              }`}
            >
              {f === 'all' ? 'All' : 'Mentions'}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4">
        {filtered.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <div className="bg-bg-card rounded-2xl border border-hairline overflow-hidden divide-y divide-hairline">
            {filtered.map((n) => {
              const Icon = ICON_MAP[n.type];
              const colorClass = COLOR_MAP[n.type];
              const initial = n.actor.displayName[0]?.toUpperCase() || '?';
              return (
                <button
                  key={n.id}
                  className={`w-full text-left flex items-start gap-3 p-4 hover:bg-bg-subtle transition-colors ${
                    !n.read ? 'bg-accent/5' : ''
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-accent to-ai flex items-center justify-center text-white font-bold shadow-sm">
                      {initial}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-bg-card flex items-center justify-center ${colorClass}`}>
                      <Icon size={12} fill={n.type === 'like' ? 'currentColor' : 'none'} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm leading-snug">
                      <span className="font-bold">{n.actor.displayName}</span>
                      <span className="text-text-secondary">
                        {n.type === 'like' && ' liked your post'}
                        {n.type === 'follow' && ' started following you'}
                        {n.type === 'comment' && ' commented on your post'}
                        {n.type === 'mention' && ' mentioned you'}
                        {n.type === 'repost' && ' reposted your post'}
                        {n.type === 'ai' && ' has a suggestion for you'}
                      </span>
                      <span className="text-text-tertiary ml-1">· {n.createdAt}</span>
                    </div>
                    {n.postExcerpt && (
                      <p className="mt-1.5 text-sm text-text-secondary line-clamp-2 leading-snug bg-bg-subtle px-3 py-2 rounded-md border-l-2 border-accent">
                        "{n.postExcerpt}"
                      </p>
                    )}
                    {n.commentText && (
                      <p className="mt-1.5 text-sm text-text-primary line-clamp-2 leading-snug">
                        {n.commentText}
                      </p>
                    )}
                    {n.type === 'follow' && (
                      <button className="mt-2 px-4 py-1.5 rounded-full bg-text-primary text-white text-xs font-semibold hover:bg-neutral-700 transition-colors">
                        Follow back
                      </button>
                    )}
                  </div>
                  {!n.read && (
                    <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-2" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* AI suggestion card */}
        {filter === 'all' && (
          <div className="mt-6 bg-gradient-to-br from-ai/10 to-accent/10 border border-ai/20 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-ai to-accent flex items-center justify-center text-white shadow-md">
                <Sparkles size={18} fill="white" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm mb-1">ORBIT AI · Daily digest</div>
                <p className="text-sm text-text-secondary leading-relaxed">
                  3 new posts from people you follow. No spammers, no outrage bait. Tap to read.
                </p>
                <button className="mt-3 text-sm font-semibold text-ai hover:underline">View digest →</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState({ filter }: { filter: 'all' | 'mentions' }) {
  return (
    <div className="text-center py-20">
      <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-bg-subtle flex items-center justify-center">
        <Bell size={32} className="text-text-tertiary" />
      </div>
      <h2 className="text-xl font-bold mb-2">No {filter === 'mentions' ? 'mentions' : 'notifications'} yet</h2>
      <p className="text-text-secondary text-sm max-w-xs mx-auto leading-relaxed">
        {filter === 'mentions'
          ? 'When someone @mentions you in a post, it shows up here.'
          : 'When someone likes, comments, or follows you, it shows up here.'}
      </p>
    </div>
  );
}
