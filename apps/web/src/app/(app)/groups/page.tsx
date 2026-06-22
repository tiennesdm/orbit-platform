'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Users, Lock, Globe, MessageCircle, Pin, MoreHorizontal, Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

interface Group {
  id: string;
  name: string;
  slug: string;
  description: string;
  memberCount: number;
  visibility: 'public' | 'private' | 'invite';
  category: string;
  joined: boolean;
  cover?: string;
}

const MOCK_GROUPS: Group[] = [
  {
    id: 'g1', name: 'AI Builders India', slug: 'ai-builders-in',
    description: 'A community of AI engineers, researchers, and founders building in India. Share papers, demos, jobs, and lessons.',
    memberCount: 2384, visibility: 'public', category: 'Tech', joined: true,
  },
  {
    id: 'g2', name: 'Climate Tech', slug: 'climate-tech',
    description: 'For people working on climate solutions — engineers, scientists, investors, and policy folks.',
    memberCount: 1432, visibility: 'public', category: 'Climate', joined: false,
  },
  {
    id: 'g3', name: 'Indie Hackers', slug: 'indie-hackers',
    description: 'Building profitable products as solo founders or tiny teams. Share revenue, tactics, and wins.',
    memberCount: 3892, visibility: 'public', category: 'Business', joined: true,
  },
];

export default function GroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>(MOCK_GROUPS);
  const [composing, setComposing] = useState(false);

  async function toggleJoin(id: string) {
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, joined: !g.joined, memberCount: g.memberCount + (g.joined ? -1 : 1) } : g)),
    );
    try {
      // api.groups.join / leave
    } catch {}
  }

  return (
    <div className="max-w-3xl mx-auto pb-24">
      <div className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-hairline px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold flex-1">Groups</h1>
        <button
          onClick={() => setComposing(true)}
          className="bg-accent text-white p-2 rounded-full"
          aria-label="Create group"
        >
          <Plus size={18} />
        </button>
      </div>

      {composing ? (
        <ComposeGroup onClose={() => setComposing(false)} />
      ) : (
        <div className="divide-y divide-hairline">
          {groups.map((g) => (
            <div key={g.id} className="p-4 hover:bg-bg-subtle cursor-pointer">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-accent to-ai flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                  {g.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm truncate">{g.name}</p>
                    {g.visibility === 'private' ? (
                      <Lock size={12} className="text-text-tertiary" />
                    ) : (
                      <Globe size={12} className="text-text-tertiary" />
                    )}
                  </div>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    {g.memberCount.toLocaleString()} members · {g.category}
                  </p>
                  <p className="text-sm text-text-secondary mt-1.5 line-clamp-2">{g.description}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleJoin(g.id); }}
                      className={clsx(
                        'px-4 py-1.5 rounded-full text-xs font-semibold',
                        g.joined
                          ? 'bg-bg-elevated border border-hairline text-text-secondary'
                          : 'bg-accent text-white',
                      )}
                    >
                      {g.joined ? 'Joined' : 'Join'}
                    </button>
                    <button className="px-4 py-1.5 rounded-full text-xs font-semibold bg-bg-subtle">
                      View
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ComposeGroup({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Tech');
  const [visibility, setVisibility] = useState<'public' | 'private' | 'invite'>('public');
  const [posting, setPosting] = useState(false);

  async function post() {
    if (!name) return;
    setPosting(true);
    try {
      await api.groups.create({ name, description, category, visibility });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="p-4 space-y-3">
      <h2 className="font-semibold">Create group</h2>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Group name (e.g., AI Builders India)"
        className="w-full bg-bg-subtle border border-hairline rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What is this group about?"
        className="w-full bg-bg-subtle border border-hairline rounded-lg p-2.5 text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="w-full bg-bg-subtle border border-hairline rounded-lg p-2.5 text-sm"
      >
        {['Tech', 'Climate', 'Business', 'Art', 'Music', 'Gaming', 'Other'].map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <div className="space-y-2">
        <label className="text-xs text-text-tertiary">Visibility</label>
        {(['public', 'private', 'invite'] as const).map((v) => (
          <label key={v} className="flex items-center gap-2 p-2.5 bg-bg-subtle rounded-lg cursor-pointer">
            <input
              type="radio"
              name="visibility"
              checked={visibility === v}
              onChange={() => setVisibility(v)}
            />
            <div>
              <p className="text-sm font-semibold capitalize">{v}</p>
              <p className="text-xs text-text-tertiary">
                {v === 'public' && 'Anyone can find and join.'}
                {v === 'private' && 'Anyone can find, but join requires approval.'}
                {v === 'invite' && 'Hidden from search. Invite-only.'}
              </p>
            </div>
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-bg-subtle">
          Cancel
        </button>
        <button
          onClick={post}
          disabled={!name || posting}
          className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-accent text-white disabled:opacity-50"
        >
          {posting ? 'Creating…' : 'Create group'}
        </button>
      </div>
    </div>
  );
}
