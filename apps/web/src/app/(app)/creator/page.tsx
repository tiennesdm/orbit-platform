'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Sparkles, TrendingUp, Users, Heart, MessageCircle,
  DollarSign, Eye, BarChart3, Video, Calendar, Image as ImageIcon,
  Crown, ArrowUp,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

const MOCK_STATS = {
  followers: 1247,
  followersDelta: 23,
  views: 18420,
  viewsDelta: 12,
  engagement: 6.4,
  engagementDelta: -0.3,
  revenue: 4520,
  revenueCurrency: '₹',
};

const MOCK_TOP_POSTS = [
  { id: 'p1', content: 'AI is changing how we build software. The new wave of agentic systems is mind-blowing.', views: 4320, likes: 234, comments: 45, ctr: 5.4 },
  { id: 'p2', content: 'Just shipped v2 of our app. Took 6 weeks but the perf is 3x better 🚀', views: 2180, likes: 156, comments: 32, ctr: 7.2 },
  { id: 'p3', content: 'The future of social is portable, encrypted, and AI-native.', views: 5120, likes: 412, comments: 89, ctr: 8.1 },
];

const MOCK_REELS = [
  { id: 'r1', title: 'Quick coding tip #1', views: 12000, likes: 842, posted: '2d' },
  { id: 'r2', title: 'Behind the scenes: building ORBIT', views: 8400, likes: 612, posted: '1w' },
  { id: 'r3', title: 'AI tools I use daily', views: 21000, likes: 1340, posted: '2w' },
];

export default function CreatorStudioPage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const hasHydrated = useAuth((s) => s.hasHydrated);
  const [tab, setTab] = useState<'overview' | 'posts' | 'reels' | 'monetize'>('overview');

  useEffect(() => {
    if (hasHydrated && !user) router.push('/login');
  }, [user, hasHydrated, router]);

  if (!hasHydrated || !user) return <div className="min-h-screen bg-bg-elevated" />;

  return (
    <div className="min-h-screen bg-bg-elevated pb-20">
      <header className="sticky top-0 z-30 bg-bg-elevated/90 backdrop-blur-md border-b border-hairline">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-bg-subtle hover:bg-bg-cream flex items-center justify-center text-text-primary transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-extrabold text-xl tracking-tight flex items-center gap-2">
              Creator Studio
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-gradient-to-r from-amber-400 to-pink-500 text-white uppercase tracking-wider">
                Pro
              </span>
            </h1>
            <p className="text-xs text-text-tertiary">Analytics, drafts, monetization</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-2xl mx-auto flex border-t border-hairline">
          {([
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'posts', label: 'Posts', icon: TrendingUp },
            { id: 'reels', label: 'Reels', icon: Video },
            { id: 'monetize', label: 'Earn', icon: DollarSign },
          ] as const).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold relative ${
                  tab === t.id ? 'text-text-primary' : 'text-text-tertiary'
                }`}
              >
                <Icon size={14} /> {t.label}
                {tab === t.id && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-0.5 rounded-full bg-accent" />}
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Followers" value={MOCK_STATS.followers.toLocaleString()} delta={MOCK_STATS.followersDelta} icon={Users} />
              <StatCard label="Views (30d)" value={MOCK_STATS.views.toLocaleString()} delta={MOCK_STATS.viewsDelta} icon={Eye} />
              <StatCard label="Engagement" value={`${MOCK_STATS.engagement}%`} delta={MOCK_STATS.engagementDelta} icon={Heart} />
              <StatCard label="Revenue" value={`${MOCK_STATS.revenueCurrency}${MOCK_STATS.revenue.toLocaleString()}`} delta={12} icon={DollarSign} highlight />
            </div>

            {/* Top posts */}
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary mb-3 flex items-center gap-1.5">
                <TrendingUp size={14} /> Top posts this month
              </h2>
              <div className="space-y-2">
                {MOCK_TOP_POSTS.map((p, i) => (
                  <div key={p.id} className="bg-bg-card border border-hairline rounded-xl p-3 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug line-clamp-2">{p.content}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-text-tertiary">
                        <span className="flex items-center gap-1"><Eye size={11} /> {p.views.toLocaleString()}</span>
                        <span className="flex items-center gap-1"><Heart size={11} /> {p.likes}</span>
                        <span className="flex items-center gap-1"><MessageCircle size={11} /> {p.comments}</span>
                        <span className="ml-auto text-success font-semibold">{p.ctr}% CTR</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {tab === 'posts' && (
          <div className="space-y-3">
            <button onClick={() => router.push('/compose')} className="w-full p-4 rounded-xl border-2 border-dashed border-hairline hover:border-accent text-text-secondary hover:text-accent font-semibold flex items-center justify-center gap-2">
              <ImageIcon size={18} /> New post
            </button>
            {MOCK_TOP_POSTS.map((p) => (
              <div key={p.id} className="bg-bg-card border border-hairline rounded-2xl p-4">
                <p className="text-[15px] leading-snug mb-3">{p.content}</p>
                <div className="flex items-center gap-4 text-xs text-text-tertiary">
                  <span className="flex items-center gap-1"><Eye size={12} /> {p.views.toLocaleString()}</span>
                  <span className="flex items-center gap-1"><Heart size={12} /> {p.likes}</span>
                  <span className="flex items-center gap-1"><MessageCircle size={12} /> {p.comments}</span>
                  <span className="ml-auto text-accent font-semibold">{p.ctr}% CTR</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'reels' && (
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => router.push('/reels')} className="aspect-[9/16] rounded-xl border-2 border-dashed border-hairline hover:border-accent text-text-secondary hover:text-accent flex flex-col items-center justify-center gap-1">
              <Video size={24} />
              <span className="text-xs">New reel</span>
            </button>
            {MOCK_REELS.map((r) => (
              <div key={r.id} className="aspect-[9/16] bg-bg-card rounded-xl overflow-hidden relative">
                <div className="absolute inset-0 photo-mountain" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-2 left-2 right-2 text-white">
                  <div className="text-xs font-semibold line-clamp-2">{r.title}</div>
                  <div className="text-[10px] opacity-80 flex items-center gap-1 mt-1">
                    <Eye size={10} /> {r.views >= 1000 ? `${(r.views/1000).toFixed(1)}K` : r.views}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'monetize' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-amber-400 to-pink-500 rounded-2xl p-6 text-white text-center">
              <DollarSign size={32} className="mx-auto mb-2" />
              <div className="text-3xl font-extrabold">{MOCK_STATS.revenueCurrency}{MOCK_STATS.revenue.toLocaleString()}</div>
              <div className="text-sm opacity-90">This month · ₹8,920 lifetime</div>
            </div>

            <section className="bg-bg-card border border-hairline rounded-2xl p-4">
              <h3 className="font-bold mb-3">Ways you can earn</h3>
              <div className="space-y-3">
                {[
                  { emoji: '⭐', name: 'Tips', desc: 'Receive tips from followers', payout: '₹1,200' },
                  { emoji: '🎁', name: 'Subscriptions', desc: 'Recurring monthly support', payout: '₹2,400' },
                  { emoji: '🛍️', name: 'Marketplace', desc: 'Sell products and services', payout: '₹0' },
                  { emoji: '🎬', name: 'Reels bonus', desc: 'Performance-based payout', payout: '₹920' },
                ].map((m) => (
                  <div key={m.name} className="flex items-center gap-3 p-3 bg-bg-subtle rounded-lg">
                    <div className="text-2xl">{m.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{m.name}</div>
                      <div className="text-xs text-text-tertiary">{m.desc}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold">{m.payout}</div>
                      <button className="text-[10px] text-accent">Set up</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <button className="w-full py-3 bg-text-primary text-white rounded-md font-semibold flex items-center justify-center gap-2">
              <Crown size={14} /> Upgrade to Creator
              <ArrowUp size={14} />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, delta, icon: Icon, highlight }: { label: string; value: string; delta: number; icon: any; highlight?: boolean }) {
  const positive = delta >= 0;
  return (
    <div className={`p-4 rounded-xl border ${highlight ? 'bg-gradient-to-br from-amber-50 to-pink-50 border-amber-200' : 'bg-bg-card border-hairline'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`p-1.5 rounded-md ${highlight ? 'bg-amber-400' : 'bg-accent/10'}`}>
          <Icon size={14} className={highlight ? 'text-white' : 'text-accent'} />
        </div>
        <span className={`text-[10px] font-bold ${positive ? 'text-success' : 'text-danger'}`}>
          {positive ? '+' : ''}{delta}%
        </span>
      </div>
      <div className="text-2xl font-extrabold">{value}</div>
      <div className="text-xs text-text-tertiary mt-0.5">{label}</div>
    </div>
  );
}
