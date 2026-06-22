'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bookmark, ArrowLeft, Grid3x3, List, Heart, MessageCircle, Share2, Filter } from 'lucide-react';
import { useAuth } from '@/lib/auth';

type BookmarkedPost = {
  id: string;
  author: { handle: string; displayName: string; avatar: number };
  content: string;
  mediaCount: number;
  mode: 'intimate' | 'public' | 'visual' | 'community';
  bookmarkedAt: string;
  likes: number;
  comments: number;
};

const MOCK: BookmarkedPost[] = [
  { id: 'p1', author: { handle: 'alice', displayName: 'Alice', avatar: 1 }, content: 'The future of social is portable, encrypted, and AI-native. This is what we should be building.', mediaCount: 0, mode: 'public', bookmarkedAt: '2d', likes: 142, comments: 23 },
  { id: 'p2', author: { handle: 'bob', displayName: 'Bob', avatar: 2 }, content: 'Just shipped v2 of the new feature. Took us 6 weeks but the perf is 3x better 🚀', mediaCount: 1, mode: 'visual', bookmarkedAt: '3d', likes: 89, comments: 12 },
  { id: 'p3', author: { handle: 'carol', displayName: 'Carol', avatar: 3 }, content: 'Coffee + code = perfect morning ☕', mediaCount: 1, mode: 'intimate', bookmarkedAt: '1w', likes: 234, comments: 45 },
  { id: 'p4', author: { handle: 'diana', displayName: 'Diana', avatar: 4 }, content: 'TIL: WebAuthn is supported in all modern browsers. Passkeys are the future of auth.', mediaCount: 0, mode: 'public', bookmarkedAt: '2w', likes: 412, comments: 67 },
];

export default function BookmarksPage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const hasHydrated = useAuth((s) => s.hasHydrated);
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [filter, setFilter] = useState<'all' | 'intimate' | 'public' | 'visual' | 'community'>('all');

  if (hasHydrated && !user) {
    router.push('/login');
    return null;
  }
  if (!hasHydrated) return null;

  const filtered = filter === 'all' ? MOCK : MOCK.filter((p) => p.mode === filter);

  return (
    <div className="min-h-screen bg-bg-elevated pb-20">
      <header className="sticky top-0 z-30 bg-bg-elevated/90 backdrop-blur-md border-b border-hairline">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-bg-subtle hover:bg-bg-cream flex items-center justify-center text-text-primary transition-colors">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="font-display font-extrabold text-xl tracking-tight">Bookmarks</h1>
              <p className="text-xs text-text-tertiary">{MOCK.length} saved · Private to you</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView(view === 'list' ? 'grid' : 'list')}
              className="w-9 h-9 rounded-full bg-bg-subtle hover:bg-bg-cream flex items-center justify-center text-text-primary transition-colors"
              title={`Switch to ${view === 'list' ? 'grid' : 'list'}`}
            >
              {view === 'list' ? <Grid3x3 size={18} /> : <List size={18} />}
            </button>
          </div>
        </div>

        {/* Mode filter */}
        <div className="max-w-2xl mx-auto flex gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-hidden">
          {(['all', 'intimate', 'public', 'visual', 'community'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors capitalize ${
                filter === f
                  ? 'bg-text-primary text-white'
                  : 'bg-bg-subtle text-text-secondary hover:text-text-primary'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-bg-subtle flex items-center justify-center">
              <Bookmark size={32} className="text-text-tertiary" />
            </div>
            <h2 className="text-xl font-bold mb-2">No bookmarks yet</h2>
            <p className="text-text-secondary text-sm max-w-xs mx-auto leading-relaxed">
              Tap the bookmark icon on any post to save it for later. Bookmarks are private.
            </p>
            <button onClick={() => router.push('/discover')} className="mt-5 px-5 py-2.5 rounded-full bg-accent text-white text-sm font-semibold">
              Discover posts →
            </button>
          </div>
        ) : view === 'list' ? (
          <div className="space-y-3">
            {filtered.map((p) => (
              <article key={p.id} className="bg-bg-card border border-hairline rounded-2xl p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`avatar-${p.author.avatar} w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>
                    {p.author.displayName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm">{p.author.displayName}</span>
                      <span className="text-text-tertiary text-sm">@{p.author.handle}</span>
                    </div>
                    <p className="text-[15px] mt-1 leading-snug text-text-primary">{p.content}</p>
                  </div>
                  <span className={`mode-pill ${p.mode}`}>{p.mode}</span>
                </div>
                {p.mediaCount > 0 && (
                  <div className="aspect-video rounded-lg photo-sunset mb-3" />
                )}
                <div className="flex items-center justify-between text-text-tertiary text-xs">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1"><Heart size={14} /> {p.likes}</span>
                    <span className="flex items-center gap-1"><MessageCircle size={14} /> {p.comments}</span>
                  </div>
                  <span>Bookmarked {p.bookmarkedAt} ago</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {filtered.map((p) => (
              <div key={p.id} className="aspect-square bg-bg-card rounded-md overflow-hidden relative cursor-pointer hover:opacity-90 transition-opacity">
                <div className={`absolute inset-0 photo-mountain`} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-2 left-2 right-2 text-white text-xs font-medium line-clamp-2">
                  {p.content.slice(0, 60)}
                </div>
                <div className="absolute top-2 right-2">
                  <Bookmark size={14} className="text-white fill-white" />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
