'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Hash, User, Users, ShoppingBag, FileText, Settings as SettingsIcon, Home, Sparkles, MessageCircle, Film, X, ArrowRight } from 'lucide-react';

type Result = {
  type: 'user' | 'post' | 'hashtag' | 'page' | 'group' | 'listing';
  id: string;
  title: string;
  subtitle?: string;
  emoji?: string;
  href: string;
};

const PAGES: Result[] = [
  { type: 'page', id: 'home', title: 'Home', subtitle: 'Your feed', emoji: '🏠', href: '/home' },
  { type: 'page', id: 'discover', title: 'Discover', subtitle: 'Find people, posts, groups', emoji: '🔍', href: '/discover' },
  { type: 'page', id: 'reels', title: 'Reels', subtitle: 'Watch short videos', emoji: '🎬', href: '/reels' },
  { type: 'page', id: 'voice', title: 'Voice rooms', subtitle: 'Live audio conversations', emoji: '🎙️', href: '/voice' },
  { type: 'page', id: 'inbox', title: 'Inbox', subtitle: 'Encrypted messages', emoji: '💬', href: '/inbox' },
  { type: 'page', id: 'notifications', title: 'Notifications', subtitle: 'Likes, follows, mentions', emoji: '🔔', href: '/notifications' },
  { type: 'page', id: 'compose', title: 'Compose', subtitle: 'New post', emoji: '✏️', href: '/compose' },
  { type: 'page', id: 'drafts', title: 'Drafts', subtitle: 'Unpublished posts', emoji: '📝', href: '/drafts' },
  { type: 'page', id: 'bookmarks', title: 'Bookmarks', subtitle: 'Saved posts', emoji: '🔖', href: '/bookmarks' },
  { type: 'page', id: 'marketplace', title: 'Marketplace', subtitle: 'Buy & sell', emoji: '🛍️', href: '/marketplace' },
  { type: 'page', id: 'groups', title: 'Groups', subtitle: 'Communities', emoji: '👥', href: '/groups' },
  { type: 'page', id: 'lists', title: 'Lists', subtitle: 'Mute, block, custom', emoji: '📋', href: '/lists' },
  { type: 'page', id: 'stories', title: 'Stories', subtitle: '24h ephemeral', emoji: '✨', href: '/stories' },
  { type: 'page', id: 'ai', title: 'ORBIT AI', subtitle: 'Your assistant', emoji: '🤖', href: '/ai' },
  { type: 'page', id: 'ai-cocreate', title: 'AI Co-Create', subtitle: 'Generate text/image/video', emoji: '✨', href: '/ai-cocreate' },
  { type: 'page', id: 'feeds', title: 'Custom feeds', subtitle: 'Your own algorithms', emoji: '🌟', href: '/feeds' },
  { type: 'page', id: 'wellness', title: 'Digital wellness', subtitle: 'Anti-addiction controls', emoji: '🛡️', href: '/wellness' },
  { type: 'page', id: 'domains', title: 'Custom domain', subtitle: 'Use yourname.com', emoji: '🌐', href: '/domains' },
  { type: 'page', id: 'creator', title: 'Creator Studio', subtitle: 'Analytics, monetization', emoji: '🎬', href: '/creator' },
  { type: 'page', id: 'profile', title: 'Profile', subtitle: 'Your account', emoji: '👤', href: '/profile' },
  { type: 'page', id: 'profile-edit', title: 'Edit profile', subtitle: 'Bio, banner, links', emoji: '✏️', href: '/profile/edit' },
  { type: 'page', id: 'settings', title: 'Settings', subtitle: 'Privacy, security, AI', emoji: '⚙️', href: '/settings' },
];

const TYPE_ICON: Record<Result['type'], any> = {
  user: User,
  post: FileText,
  hashtag: Hash,
  page: ArrowRight,
  group: Users,
  listing: ShoppingBag,
};

export function SearchPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    document.addEventListener('keydown', onKey);
    window.addEventListener('orbit:open-palette', onOpen);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('orbit:open-palette', onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Filter
  const query = q.trim().toLowerCase();
  let results: Result[] = [];
  if (query.length === 0) {
    results = PAGES.slice(0, 6);
  } else {
    results = PAGES.filter((p) => p.title.toLowerCase().includes(query) || p.subtitle?.toLowerCase().includes(query));
    // Mock dynamic results — would come from API
    if (query.length >= 2) {
      results.push(
        { type: 'hashtag', id: 'h1', title: `#${query}`, subtitle: '1.2K posts', href: `/tag/${query}` },
        { type: 'user', id: 'u1', title: `@${query}`, subtitle: '12K followers', href: `/profile/${query}` },
      );
    }
  }

  useEffect(() => {
    setActive(0);
  }, [q]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = results[active];
      if (r) {
        router.push(r.href);
        setOpen(false);
      }
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-24 px-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-bg-card rounded-2xl shadow-2xl border border-hairline overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-hairline">
          <Search size={18} className="text-text-tertiary" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search ORBIT, jump to page, find people…"
            className="flex-1 bg-transparent border-0 outline-none text-[15px] placeholder:text-text-tertiary"
          />
          <kbd className="text-[10px] text-text-tertiary font-mono bg-bg-subtle px-1.5 py-0.5 rounded">ESC</kbd>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {results.length === 0 ? (
            <div className="p-8 text-center text-text-tertiary text-sm">No results for "{q}"</div>
          ) : (
            <div>
              {q.length === 0 && (
                <div className="px-4 pt-3 pb-1 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Jump to</div>
              )}
              {results.map((r, i) => {
                const Icon = TYPE_ICON[r.type];
                return (
                  <button
                    key={`${r.type}_${r.id}`}
                    onClick={() => {
                      router.push(r.href);
                      setOpen(false);
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={`w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors ${
                      active === i ? 'bg-accent/10' : ''
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-bg-subtle flex items-center justify-center text-text-secondary flex-shrink-0">
                      {r.emoji ? <span className="text-lg">{r.emoji}</span> : <Icon size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{r.title}</div>
                      {r.subtitle && <div className="text-xs text-text-tertiary truncate">{r.subtitle}</div>}
                    </div>
                    {active === i && (
                      <ArrowRight size={14} className="text-accent flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-hairline bg-bg-subtle flex items-center justify-between text-[10px] text-text-tertiary">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><kbd className="font-mono">↑↓</kbd> Navigate</span>
            <span className="flex items-center gap-1"><kbd className="font-mono">↵</kbd> Open</span>
            <span className="flex items-center gap-1"><kbd className="font-mono">esc</kbd> Close</span>
          </div>
          <span>Powered by ORBIT search</span>
        </div>
      </div>
    </div>
  );
}
