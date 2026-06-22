'use client';

import { useState, useEffect } from 'react';
import { Search, TrendingUp, Hash, User, Users, ShoppingBag, Sparkles, X } from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

type Tab = 'all' | 'users' | 'posts' | 'groups' | 'marketplace' | 'hashtags';

const TRENDING_HASHTAGS = [
  { tag: 'AI', posts: '12.4K' },
  { tag: 'Web3', posts: '8.7K' },
  { tag: 'Climate', posts: '6.2K' },
  { tag: 'IndieHackers', posts: '4.1K' },
  { tag: 'DesignTips', posts: '3.8K' },
];

const SUGGESTED_USERS = [
  { handle: 'alice', displayName: 'Alice', bio: 'AI researcher · Climate tech', followers: '12K' },
  { handle: 'bob', displayName: 'Bob', bio: 'Building tools for creators', followers: '8.5K' },
  { handle: 'carol', displayName: 'Carol', bio: 'Indie hacker · Ex-Stripe', followers: '5.2K' },
];

export default function DiscoverPage() {
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults(null);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.search.universal(query, tab === 'all' ? 'all' : tab, 20);
        setResults(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, tab]);

  return (
    <div className="max-w-3xl mx-auto pb-24">
      <div className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-hairline">
        <div className="p-4">
          <h1 className="text-2xl font-bold mb-3">Discover</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={18} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ORBIT — users, posts, groups, listings…"
              className="w-full pl-10 pr-10 py-2.5 bg-bg-subtle border border-hairline rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary"
                aria-label="Clear"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="px-4 pb-2 flex gap-1 overflow-x-auto scrollbar-hide">
          {(['all', 'users', 'posts', 'groups', 'marketplace', 'hashtags'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition',
                tab === t
                  ? 'bg-accent text-white'
                  : 'bg-bg-subtle text-text-secondary hover:bg-bg-elevated',
              )}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="p-8 text-center text-text-tertiary">
          <Sparkles className="animate-pulse mx-auto mb-2" size={24} />
          Searching…
        </div>
      )}

      {/* Search results */}
      {results && !loading && (
        <div className="p-4 space-y-2">
          <p className="text-sm text-text-tertiary">
            {results.results?.length || 0} results for "{results.query}"
            {results.mode && ` · ${results.mode} mode`}
          </p>
          {results.results?.length === 0 && (
            <div className="p-8 text-center text-text-tertiary">No results</div>
          )}
          {results.results?.slice(0, 20).map((r: any, i: number) => (
            <SearchResultItem key={i} result={r} type={tab} />
          ))}
        </div>
      )}

      {/* Default state — trending + suggested */}
      {!query && !loading && (
        <div className="p-4 space-y-6">
          <section>
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <TrendingUp size={18} className="text-accent" />
              Trending
            </h2>
            <div className="space-y-2">
              {TRENDING_HASHTAGS.map((h, i) => (
                <div
                  key={h.tag}
                  className="flex items-center justify-between p-3 bg-bg-subtle rounded-lg hover:bg-bg-elevated cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-text-tertiary text-sm w-6">{i + 1}</span>
                    <Hash size={16} className="text-accent" />
                    <span className="font-semibold">{h.tag}</span>
                  </div>
                  <span className="text-xs text-text-tertiary">{h.posts} posts</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <User size={18} className="text-accent" />
              Suggested for you
            </h2>
            <div className="space-y-2">
              {SUGGESTED_USERS.map((u) => (
                <div
                  key={u.handle}
                  className="flex items-center justify-between p-3 bg-bg-subtle rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-accent to-ai flex items-center justify-center text-white font-bold">
                      {u.displayName[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{u.displayName}</p>
                      <p className="text-xs text-text-tertiary">@{u.handle} · {u.followers} followers</p>
                      <p className="text-xs text-text-secondary mt-0.5">{u.bio}</p>
                    </div>
                  </div>
                  <button className="px-3 py-1.5 bg-accent text-white rounded-full text-xs font-semibold hover:bg-accent/90">
                    Follow
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <Users size={18} className="text-accent" />
              Communities to join
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {['AI Builders', 'Climate Tech', 'Indie Hackers', 'Design Systems'].map((g) => (
                <div key={g} className="p-4 bg-bg-subtle rounded-lg">
                  <p className="font-semibold text-sm">{g}</p>
                  <p className="text-xs text-text-tertiary mt-1">2.4K members</p>
                  <button className="mt-2 text-xs text-accent font-semibold">Join</button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <ShoppingBag size={18} className="text-accent" />
              Marketplace picks
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { title: 'Vintage Typewriter', price: '₹4,500' },
                { title: 'Handmade Notebook', price: '₹350' },
                { title: 'Mechanical Keyboard', price: '₹12,000' },
                { title: 'Camera Lens 50mm', price: '₹28,000' },
              ].map((item) => (
                <div key={item.title} className="bg-bg-subtle rounded-lg overflow-hidden">
                  <div className="aspect-square bg-gradient-to-br from-bg-elevated to-bg-subtle" />
                  <div className="p-2">
                    <p className="text-xs font-semibold truncate">{item.title}</p>
                    <p className="text-xs text-accent font-bold">{item.price}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function SearchResultItem({ result, type }: { result: any; type: Tab }) {
  if (type === 'users' || result.handle) {
    return (
      <div className="flex items-center gap-3 p-3 hover:bg-bg-subtle rounded-lg">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-accent to-ai flex items-center justify-center text-white font-bold">
          {result.display_name?.[0] || result.displayName?.[0] || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{result.display_name || result.displayName}</p>
          <p className="text-xs text-text-tertiary truncate">@{result.handle}</p>
          {result.bio && <p className="text-xs text-text-secondary mt-0.5 truncate">{result.bio}</p>}
        </div>
        <button className="px-3 py-1.5 bg-bg-elevated border border-hairline rounded-full text-xs font-semibold">
          Follow
        </button>
      </div>
    );
  }
  if (type === 'posts' || result.content_text !== undefined) {
    return (
      <div className="p-3 hover:bg-bg-subtle rounded-lg">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm">@{result.handle || 'user'}</span>
          <span className="text-xs text-text-tertiary">· {result.mode}</span>
        </div>
        <p className="text-sm">{result.content_text || result.contentText}</p>
      </div>
    );
  }
  if (type === 'groups' || result.member_count !== undefined) {
    return (
      <div className="p-3 hover:bg-bg-subtle rounded-lg">
        <p className="font-semibold text-sm">{result.name}</p>
        <p className="text-xs text-text-tertiary mt-0.5">{result.description}</p>
        <p className="text-xs text-text-secondary mt-1">{result.member_count} members</p>
      </div>
    );
  }
  if (type === 'marketplace' || result.title) {
    return (
      <div className="p-3 hover:bg-bg-subtle rounded-lg flex items-center gap-3">
        <div className="w-12 h-12 rounded bg-bg-elevated" />
        <div className="flex-1">
          <p className="font-semibold text-sm">{result.title}</p>
          <p className="text-xs text-text-tertiary">{(result.price_cents / 100).toFixed(2)} {result.currency}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="p-3 hover:bg-bg-subtle rounded-lg text-sm">
      <pre className="text-xs">{JSON.stringify(result, null, 2).slice(0, 200)}</pre>
    </div>
  );
}
