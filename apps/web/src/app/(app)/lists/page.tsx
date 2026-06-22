'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, UserMinus, UserCheck, VolumeX, Volume2, Plus, Users,
  MoreHorizontal, Trash2, Edit3,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

const MOCK_LISTS = [
  { id: 'l1', name: 'Spammers', kind: 'block', emoji: '🚫', memberCount: 12, description: 'Auto-blocked bots and trolls' },
  { id: 'l2', name: 'Muted (work hours)', kind: 'mute', emoji: '🔕', memberCount: 28, description: 'Hidden from feed during 9-5' },
  { id: 'l3', name: 'Close Friends', kind: 'close_friends', emoji: '⭐', memberCount: 14, description: 'See my intimate posts' },
  { id: 'l4', name: 'AI Researchers', kind: 'custom', emoji: '🤖', memberCount: 47, description: 'People I follow in AI research' },
  { id: 'l5', name: 'Designers', kind: 'custom', emoji: '🎨', memberCount: 89, description: 'Inspiration feed' },
  { id: 'l6', name: 'No Politics', kind: 'mute', emoji: '🛑', memberCount: 23, description: 'Politics-free feed' },
];

const KIND_COLORS: Record<string, string> = {
  block: 'from-red-500 to-pink-500',
  mute: 'from-amber-400 to-orange-500',
  close_friends: 'from-purple-500 to-pink-500',
  custom: 'from-blue-500 to-cyan-500',
};

const KIND_LABELS: Record<string, string> = {
  block: 'Block list',
  mute: 'Mute list',
  close_friends: 'Close friends',
  custom: 'Custom list',
};

export default function ListsPage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const hasHydrated = useAuth((s) => s.hasHydrated);
  const [filter, setFilter] = useState<'all' | 'block' | 'mute' | 'close_friends' | 'custom'>('all');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (hasHydrated && !user) router.push('/login');
  }, [user, hasHydrated, router]);

  if (!hasHydrated || !user) return <div className="min-h-screen bg-bg-elevated" />;

  const filtered = filter === 'all' ? MOCK_LISTS : MOCK_LISTS.filter((l) => l.kind === filter);
  const counts = {
    all: MOCK_LISTS.length,
    block: MOCK_LISTS.filter((l) => l.kind === 'block').length,
    mute: MOCK_LISTS.filter((l) => l.kind === 'mute').length,
    close_friends: MOCK_LISTS.filter((l) => l.kind === 'close_friends').length,
    custom: MOCK_LISTS.filter((l) => l.kind === 'custom').length,
  };

  return (
    <div className="min-h-screen bg-bg-elevated pb-20">
      <header className="sticky top-0 z-30 bg-bg-elevated/90 backdrop-blur-md border-b border-hairline">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-bg-subtle hover:bg-bg-cream flex items-center justify-center text-text-primary transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-extrabold text-xl tracking-tight">Lists</h1>
            <p className="text-xs text-text-tertiary">{counts.all} lists · {MOCK_LISTS.reduce((s, l) => s + l.memberCount, 0)} people</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="px-4 py-1.5 rounded-full bg-accent text-white text-sm font-semibold flex items-center gap-1">
            <Plus size={14} /> New
          </button>
        </div>

        {/* Filter tabs */}
        <div className="max-w-2xl mx-auto flex gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-hidden">
          {([
            { id: 'all', label: 'All' },
            { id: 'block', label: 'Blocks' },
            { id: 'mute', label: 'Muted' },
            { id: 'close_friends', label: 'Close friends' },
            { id: 'custom', label: 'Custom' },
          ] as const).map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                filter === f.id ? 'bg-text-primary text-white' : 'bg-bg-subtle text-text-secondary hover:text-text-primary'
              }`}
            >
              {f.label} {counts[f.id] > 0 && `(${counts[f.id]})`}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-3">
        {filtered.map((l) => (
          <article key={l.id} className="bg-bg-card border border-hairline rounded-2xl p-4 hover:border-hairlineStrong transition-colors">
            <div className="flex items-start gap-3">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${KIND_COLORS[l.kind]} flex items-center justify-center text-2xl flex-shrink-0`}>
                {l.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-text-primary">{l.name}</h3>
                  <button className="text-text-tertiary hover:text-text-primary p-1">
                    <MoreHorizontal size={16} />
                  </button>
                </div>
                <p className="text-xs text-text-tertiary mt-0.5">{KIND_LABELS[l.kind]} · {l.memberCount} members</p>
                {l.description && <p className="text-sm text-text-secondary mt-1.5 line-clamp-2">{l.description}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-hairline">
              <button className="flex-1 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary rounded-md hover:bg-bg-subtle transition-colors flex items-center justify-center gap-1.5">
                <Edit3 size={12} /> Edit
              </button>
              <button className="flex-1 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary rounded-md hover:bg-bg-subtle transition-colors flex items-center justify-center gap-1.5">
                <Users size={12} /> View
              </button>
              <button className="flex-1 py-1.5 text-xs font-semibold text-danger rounded-md hover:bg-danger/10 transition-colors flex items-center justify-center gap-1.5">
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </article>
        ))}
      </main>

      {/* Create modal placeholder */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-bg-card rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Create list</h2>
            <p className="text-sm text-text-secondary mb-4">Group people to control what you see, who sees your intimate posts, or block spammers.</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {(['block', 'mute', 'close_friends', 'custom'] as const).map((k) => (
                <button
                  key={k}
                  className={`p-3 rounded-lg border-2 border-hairline hover:border-accent transition-colors text-left`}
                >
                  <div className={`w-8 h-8 rounded-md bg-gradient-to-br ${KIND_COLORS[k]} flex items-center justify-center text-base mb-2`}>
                    {MOCK_LISTS.find((l) => l.kind === k)?.emoji || '📋'}
                  </div>
                  <div className="text-sm font-semibold">{KIND_LABELS[k]}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setShowCreate(false)} className="w-full py-3 bg-text-primary text-white rounded-md font-semibold">
              Create
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
