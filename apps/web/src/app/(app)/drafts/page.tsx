'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Calendar, Trash2, Send, Edit3, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const MOCK_DRAFTS = [
  { id: 'd1', mode: 'public', content: 'Working on something exciting — a new way to think about portable identity...', updatedAt: '2h', scheduled: null, mediaCount: 0 },
  { id: 'd2', mode: 'intimate', content: 'For my close friends: thank you for the support this year. Coffee Saturday?', updatedAt: '1d', scheduled: null, mediaCount: 0 },
  { id: 'd3', mode: 'public', content: 'Weekly digest — top 5 things I learned about AI this week...', updatedAt: '3d', scheduled: 'Sat 10:00 AM', mediaCount: 0 },
  { id: 'd4', mode: 'visual', content: '', updatedAt: '5d', scheduled: null, mediaCount: 1 },
];

export default function DraftsPage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const hasHydrated = useAuth((s) => s.hasHydrated);
  const [tab, setTab] = useState<'drafts' | 'scheduled'>('drafts');
  const [items, setItems] = useState(MOCK_DRAFTS);

  if (hasHydrated && !user) {
    router.push('/login');
    return null;
  }
  if (!hasHydrated) return null;

  const filtered = tab === 'drafts' ? items.filter((i) => !i.scheduled) : items.filter((i) => i.scheduled);
  const scheduledCount = items.filter((i) => i.scheduled).length;
  const draftsCount = items.length - scheduledCount;

  return (
    <div className="min-h-screen bg-bg-elevated pb-20">
      <header className="sticky top-0 z-30 bg-bg-elevated/90 backdrop-blur-md border-b border-hairline">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-bg-subtle hover:bg-bg-cream flex items-center justify-center text-text-primary transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-extrabold text-xl tracking-tight">{tab === 'drafts' ? 'Drafts' : 'Scheduled'}</h1>
            <p className="text-xs text-text-tertiary">{tab === 'drafts' ? draftsCount : scheduledCount} {tab === 'drafts' ? 'drafts' : 'posts scheduled'}</p>
          </div>
          <button onClick={() => router.push('/compose')} className="px-4 py-1.5 rounded-full bg-accent text-white text-sm font-semibold flex items-center gap-1">
            <Edit3 size={12} /> New
          </button>
        </div>

        <div className="max-w-2xl mx-auto flex border-t border-hairline">
          {([
            { id: 'drafts', label: 'Drafts', count: draftsCount, icon: FileText },
            { id: 'scheduled', label: 'Scheduled', count: scheduledCount, icon: Calendar },
          ] as const).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold relative ${
                  tab === t.id ? 'text-text-primary' : 'text-text-tertiary'
                }`}
              >
                <Icon size={14} /> {t.label} ({t.count})
                {tab === t.id && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 rounded-full bg-accent" />}
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-bg-subtle flex items-center justify-center">
              {tab === 'drafts' ? <FileText size={32} className="text-text-tertiary" /> : <Calendar size={32} className="text-text-tertiary" />}
            </div>
            <h2 className="text-xl font-bold mb-2">No {tab} yet</h2>
            <p className="text-text-secondary text-sm max-w-xs mx-auto leading-relaxed mb-5">
              {tab === 'drafts' ? 'Start writing — your drafts save automatically.' : 'Schedule a post to publish it later.'}
            </p>
            <button onClick={() => router.push('/compose')} className="px-5 py-2.5 rounded-full bg-accent text-white text-sm font-semibold">
              Compose new post
            </button>
          </div>
        ) : (
          filtered.map((d) => (
            <article key={d.id} className="bg-bg-card border border-hairline rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`mode-pill ${d.mode}`}>{d.mode}</span>
                <div className="flex items-center gap-1 text-text-tertiary text-xs">
                  <Clock size={11} />
                  {d.scheduled ? <span className="text-accent font-semibold">{d.scheduled}</span> : <span>Edited {d.updatedAt} ago</span>}
                </div>
              </div>
              {d.content ? (
                <p className="text-[15px] leading-snug text-text-primary line-clamp-3">{d.content}</p>
              ) : (
                <div className="aspect-video rounded-lg photo-sunset" />
              )}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-hairline">
                <div className="flex items-center gap-2 text-xs text-text-tertiary">
                  {d.scheduled ? <><Calendar size={12} /> Scheduled</> : <><FileText size={12} /> Draft</>}
                </div>
                <div className="flex items-center gap-2">
                  <button className="text-xs text-text-secondary hover:text-text-primary font-semibold flex items-center gap-1">
                    <Trash2 size={12} /> Delete
                  </button>
                  <button className="px-3 py-1.5 rounded-full bg-text-primary text-white text-xs font-semibold flex items-center gap-1">
                    {d.scheduled ? <><Send size={12} /> Edit</> : <><Edit3 size={12} /> Edit</>}
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </main>
    </div>
  );
}
