'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Filter, Globe, Lock, Trash2, GripVertical, Hash, User, Image as ImageIcon, Clock, Heart, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

const RULE_TYPES = [
  { type: 'mode', label: 'Mode', icon: '🌀', value: 'intimate' },
  { type: 'hashtag', label: 'Hashtag', icon: '#', value: 'ai' },
  { type: 'author', label: 'Author', icon: '@', value: 'someone' },
  { type: 'min_likes', label: 'Min likes', icon: '❤️', value: 100 },
  { type: 'time', label: 'Recency', icon: '⏰', value: 'day' },
  { type: 'media', label: 'Media type', icon: '🎬', value: 'media' },
  { type: 'lang', label: 'Language', icon: '🌐', value: 'en' },
  { type: 'no_replies', label: 'No replies', icon: '💬', value: true },
];

export default function FeedsPage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const hasHydrated = useAuth((s) => s.hasHydrated);
  const [tab, setTab] = useState<'mine' | 'discover'>('mine');
  const [myFeeds, setMyFeeds] = useState<any[]>([]);
  const [publicFeeds, setPublicFeeds] = useState<any[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hasHydrated && !user) { router.push('/login'); return; }
    if (!user) return;
    Promise.all([(api as any).myFeeds(), (api as any).publicFeeds()])
      .then(([mine, pub]) => { setMyFeeds(mine); setPublicFeeds(pub); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, hasHydrated, router]);

  if (!hasHydrated || !user) return <div className="min-h-screen bg-bg-elevated" />;

  const feeds = tab === 'mine' ? myFeeds : publicFeeds;

  return (
    <div className="min-h-screen bg-bg-elevated pb-20">
      <header className="sticky top-0 z-30 bg-bg-elevated/90 backdrop-blur-md border-b border-hairline">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-bg-subtle hover:bg-bg-cream flex items-center justify-center text-text-primary transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="font-display font-extrabold text-xl tracking-tight flex items-center gap-2">
              <Filter size={18} className="text-accent" /> Custom feeds
            </h1>
            <p className="text-xs text-text-tertiary">Build your own algorithms. Like Bluesky.</p>
          </div>
          <button onClick={() => setShowBuilder(true)} className="px-3 py-1.5 rounded-full bg-accent text-white text-sm font-semibold flex items-center gap-1">
            <Plus size={14} /> New
          </button>
        </div>

        <div className="max-w-2xl mx-auto flex border-t border-hairline">
          {(['mine', 'discover'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-semibold relative ${tab === t ? 'text-text-primary' : 'text-text-tertiary'}`}
            >
              {t === 'mine' ? 'My feeds' : 'Discover'}
              {tab === t && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 rounded-full bg-accent" />}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-text-tertiary" size={20} /></div>
        ) : feeds.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-bg-subtle flex items-center justify-center">
              <Filter size={32} className="text-text-tertiary" />
            </div>
            <h2 className="text-xl font-bold mb-2">{tab === 'mine' ? 'No custom feeds yet' : 'No public feeds found'}</h2>
            <p className="text-text-secondary text-sm max-w-xs mx-auto leading-relaxed mb-5">
              {tab === 'mine' ? 'Build a feed with rules — only posts matching your rules appear.' : 'Be the first to publish one!'}
            </p>
            <button onClick={() => setShowBuilder(true)} className="px-5 py-2.5 rounded-full bg-accent text-white text-sm font-semibold">
              Build your first feed
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {feeds.map((f) => (
              <article key={f.id} className="bg-bg-card border border-hairline rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-ai flex items-center justify-center text-2xl flex-shrink-0">
                    {f.emoji || '🌟'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold">{f.name}</h3>
                      {f.isPublic ? <Globe size={12} className="text-text-tertiary" /> : <Lock size={12} className="text-text-tertiary" />}
                    </div>
                    {f.description && <p className="text-sm text-text-secondary mt-0.5 line-clamp-1">{f.description}</p>}
                    {f.ownerHandle && tab === 'discover' && (
                      <p className="text-xs text-text-tertiary mt-1">by @{f.ownerHandle}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(f.rules || []).slice(0, 3).map((r: any, i: number) => (
                        <span key={i} className="px-2 py-0.5 rounded-full bg-bg-subtle text-text-secondary text-[10px] font-semibold">
                          {r.type}: {String(r.value)}
                        </span>
                      ))}
                      {(f.rules || []).length > 3 && <span className="text-[10px] text-text-tertiary">+{f.rules.length - 3}</span>}
                    </div>
                  </div>
                </div>
                {tab === 'mine' && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-hairline">
                    <button className="flex-1 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary rounded-md hover:bg-bg-subtle">
                      Edit
                    </button>
                    <button className="flex-1 py-1.5 text-xs font-semibold text-danger rounded-md hover:bg-danger/10">
                      <Trash2 size={12} className="inline mr-1" /> Delete
                    </button>
                  </div>
                )}
                {tab === 'discover' && (
                  <button className="w-full mt-3 py-2 text-sm font-semibold bg-text-primary text-white rounded-md">
                    Subscribe
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </main>

      {showBuilder && <FeedBuilder onClose={() => setShowBuilder(false)} onSave={(f: any) => { setMyFeeds([f, ...myFeeds]); setShowBuilder(false); }} />}
    </div>
  );
}

function FeedBuilder({ onClose, onSave }: any) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('🌟');
  const [isPublic, setIsPublic] = useState(false);
  const [rules, setRules] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  function addRule() {
    setRules([...rules, { type: 'hashtag', value: '' }]);
  }
  function removeRule(idx: number) {
    setRules(rules.filter((_, i) => i !== idx));
  }
  function updateRule(idx: number, updates: any) {
    setRules(rules.map((r, i) => i === idx ? { ...r, ...updates } : r));
  }

  async function save() {
    if (!name) return;
    setSaving(true);
    try {
      const created = await (api as any).createFeed({ name, description, emoji, isPublic, rules: rules.filter(r => r.value !== '') });
      onSave(created);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-bg-card rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-bg-card border-b border-hairline px-5 py-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Build a custom feed</h2>
          <button onClick={onClose} className="text-text-tertiary">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-[60px_1fr] gap-3">
            <input
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
              className="bg-bg-subtle border border-hairline rounded-md py-2 px-2 text-center text-2xl"
            />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Feed name (e.g., 'AI only')"
              className="bg-bg-subtle border border-hairline rounded-md py-2 px-3 text-sm outline-none focus:border-accent"
            />
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this feed for? (optional)"
            rows={2}
            className="w-full bg-bg-subtle border border-hairline rounded-md py-2 px-3 text-sm outline-none focus:border-accent resize-none"
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            Make this feed public so others can subscribe
          </label>

          <div>
            <h3 className="text-sm font-bold mb-2">Rules (only matching posts appear)</h3>
            {rules.length === 0 && <p className="text-sm text-text-tertiary mb-3">Add a rule to filter posts</p>}
            <div className="space-y-2">
              {rules.map((r, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-bg-subtle p-2 rounded-md">
                  <select
                    value={r.type}
                    onChange={(e) => updateRule(idx, { type: e.target.value, value: RULE_TYPES.find(x => x.type === e.target.value)?.value || '' })}
                    className="bg-bg-card border border-hairline rounded px-2 py-1.5 text-xs"
                  >
                    {RULE_TYPES.map((rt) => <option key={rt.type} value={rt.type}>{rt.label}</option>)}
                  </select>
                  <input
                    type="text"
                    value={r.value}
                    onChange={(e) => updateRule(idx, { value: e.target.value })}
                    placeholder="value"
                    className="flex-1 bg-bg-card border border-hairline rounded px-2 py-1.5 text-sm outline-none focus:border-accent"
                  />
                  <button onClick={() => removeRule(idx)} className="text-danger text-sm">×</button>
                </div>
              ))}
            </div>
            <button onClick={addRule} className="mt-2 text-sm text-accent flex items-center gap-1">
              <Plus size={14} /> Add rule
            </button>
          </div>
        </div>
        <div className="sticky bottom-0 bg-bg-card border-t border-hairline p-4 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-hairline rounded-md text-sm font-semibold">Cancel</button>
          <button onClick={save} disabled={!name || saving} className="flex-1 py-2.5 bg-accent text-white rounded-md text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create feed
          </button>
        </div>
      </div>
    </div>
  );
}
