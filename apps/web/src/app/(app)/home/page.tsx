'use client';

import { useEffect, useState } from 'react';
import { Sparkles, X, Search, CheckCircle2, TrendingUp, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { clsx } from 'clsx';

type Mode = 'all' | 'intimate' | 'public' | 'visual' | 'community';

export default function HomePage() {
  const router = useRouter();
  const isAuthenticated = useAuth((s) => s.isAuthenticated);
  const fetchMe = useAuth((s) => s.fetchMe);
  const [mode, setMode] = useState<Mode>('all');
  const [feed, setFeed] = useState<any>(null);
  const [digest, setDigest] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      loadFeed();
      loadDigest();
    } else {
      router.push('/onboarding');
    }
  }, [isAuthenticated, mode]);

  async function loadFeed() {
    setLoading(true);
    try {
      const params: any = { algorithm: 'chronological' };
      if (mode !== 'all') params.modes = mode;
      const data = await api.feed.home(params);
      setFeed(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadDigest() {
    try {
      const data = await api.ai.digest();
      setDigest(data.summary);
    } catch {}
  }

  if (!isAuthenticated) return null;

  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* Stories strip */}
      <div className="flex gap-3.5 px-4 py-3 overflow-x-auto scrollbar-hidden">
        {['Your story', 'Priya', 'Arjun', 'Meera', 'Kavya', 'Rahul', 'Sneha'].map((name, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0 w-[68px]">
            <div className={clsx('w-[68px] h-[68px] rounded-[18px] p-[2.5px]', i === 0 ? 'bg-bg-subtle border-[1.5px] border-dashed border-text-tertiary' : i >= 3 ? '' : i === 5 ? 'story-ring seen' : 'story-ring')}>
              <div className={clsx('w-full h-full rounded-[15.5px] border-[2.5px] border-bg-elevated flex items-center justify-center text-white font-bold text-[22px]', i === 0 ? 'avatar-9' : ['avatar-1','avatar-2','avatar-3','avatar-4','avatar-5','avatar-6'][i])}>
                {name[0]}
              </div>
            </div>
            <span className={clsx('text-[11px] truncate w-full text-center', i >= 3 && i !== 5 ? 'font-bold text-text-primary' : 'text-text-secondary')}>
              {name}
            </span>
          </div>
        ))}
      </div>

      {/* Mode tabs */}
      <div className="mx-4 mb-2 bg-bg-subtle rounded-full p-0.5 flex">
        {(['all', 'intimate', 'public', 'visual', 'community'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={clsx(
              'flex-1 py-1.5 px-3 rounded-full text-xs font-semibold capitalize transition-all',
              mode === m ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-secondary'
            )}
          >
            {m !== 'all' && <span className={clsx(
              'inline-block w-1.5 h-1.5 rounded-full mr-1',
              m === 'intimate' && 'bg-amber-500',
              m === 'public' && 'bg-accent',
              m === 'visual' && 'bg-pink-500',
              m === 'community' && 'bg-cyan-500',
            )} />}
            {m}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="px-0">
        {digest && (
          <div className="ai-card mx-3 mb-2">
            <div className="w-9 h-9 rounded-md bg-gradient-to-br from-ai to-accent flex items-center justify-center text-white shadow-md flex-shrink-0">
              <Sparkles size={18} fill="currentColor" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-2xs font-extrabold text-ai uppercase tracking-wider mb-0.5">Daily Digest · Your AI</div>
              <div className="text-[13px] leading-snug">{digest}</div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                <button className="bg-white border border-ai-light rounded-full px-2.5 py-0.5 text-2xs font-semibold text-ai">Show me these</button>
                <button className="bg-white border border-ai-light rounded-full px-2.5 py-0.5 text-2xs font-semibold text-ai">Skip all today</button>
              </div>
            </div>
          </div>
        )}

        {/* Usage stats card */}
        <div className="mx-3 mb-2 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-md p-2.5 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-2xs font-extrabold text-emerald-700 relative" style={{ background: 'conic-gradient(#059669 0% 38%, rgba(0,0,0,0.08) 38% 100%)' }}>
            <span className="relative z-10">38%</span>
            <span className="absolute inset-1 rounded-full bg-white" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold text-emerald-800">23 min today · You're doing great 🧘</div>
            <div className="text-2xs text-text-secondary">Daily limit: 60 min · Resets at midnight</div>
          </div>
        </div>

        {loading && (
          <div className="text-center py-8 text-text-secondary text-sm">Loading feed...</div>
        )}

        {!loading && feed?.posts?.length === 0 && (
          <div className="text-center py-12 px-6">
            <div className="text-5xl mb-3">✨</div>
            <h3 className="font-bold text-lg mb-2">Your feed is empty</h3>
            <p className="text-sm text-text-secondary mb-4">Follow some people or create your first post to get started.</p>
            <button
              onClick={() => router.push('/compose')}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              <Plus size={16} /> Create post
            </button>
          </div>
        )}

        {!loading && feed?.posts?.map((post: any, i: number) => (
          <article key={i} className="bg-bg-card border-b border-hairline mb-1.5">
            <div className="flex items-center gap-2.5 px-4 py-3">
              <div className={clsx('w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm', `avatar-${(i % 9) + 1}`)}>
                {post.authorDisplayName?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold flex items-center gap-1">
                  {post.authorDisplayName || 'User'}
                  <span className="w-3 h-3 rounded-full bg-accent inline-flex items-center justify-center text-white text-[8px]">✓</span>
                  <span className={`mode-pill ${post.mode}`}>{post.mode}</span>
                </div>
                <div className="text-2xs text-text-secondary">
                  @{post.authorHandle} · {new Date(post.createdAt).toLocaleDateString()}
                </div>
              </div>
              <button className="text-text-secondary px-2 py-1 text-base tracking-tighter">···</button>
            </div>
            <div className="px-4 pb-3 text-[14.5px] leading-relaxed">
              {post.contentText?.split(/(\s)/).map((part: string, idx: number) =>
                part.startsWith('#') ? <span key={idx} className="text-accent font-semibold">{part}</span> :
                part.startsWith('@') ? <span key={idx} className="text-accent font-semibold">{part}</span> : part
              )}
            </div>
            {post.mediaCount > 0 && (
              <div className={clsx('w-full aspect-square relative', ['photo-mountain','photo-sunset','photo-food','photo-portrait','photo-tech'][i % 5])}>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[72px] drop-shadow-lg">🏔️</div>
              </div>
            )}
            <div className="flex items-center px-4 py-2.5 gap-4">
              <button className="bg-transparent border-0 p-1.5 text-text-primary hover:bg-bg-subtle rounded-full">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </button>
              <button className="bg-transparent border-0 p-1.5 text-text-primary hover:bg-bg-subtle rounded-full">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </button>
              <button className="bg-transparent border-0 p-1.5 text-text-primary hover:bg-bg-subtle rounded-full">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
              <div className="flex-1" />
              <button className="bg-transparent border-0 p-1.5 text-text-primary hover:bg-bg-subtle rounded-full">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
              </button>
            </div>
            <div className="px-4 pb-1.5 text-xs text-text-secondary font-semibold">
              {post.likeCount || 0} likes
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
