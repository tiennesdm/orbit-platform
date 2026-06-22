'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Image as ImageIcon, MapPin, Users, Eye, Clock } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

interface Story {
  id: string;
  authorDid: string;
  authorHandle: string;
  authorName: string;
  authorAvatar?: string;
  mediaUrl?: string;
  text?: string;
  createdAt: string;
  expiresAt: string;
  viewCount: number;
  hasViewed: boolean;
}

const MOCK_STORIES: Story[] = [
  {
    id: 's1', authorDid: 'did:orbit:alice', authorHandle: 'alice', authorName: 'Alice',
    text: 'Coffee + code = perfect morning ☕',
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 22 * 3600 * 1000).toISOString(),
    viewCount: 23, hasViewed: false,
  },
  {
    id: 's2', authorDid: 'did:orbit:bob', authorHandle: 'bob', authorName: 'Bob',
    text: 'Just shipped the new feature 🚀',
    createdAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 16 * 3600 * 1000).toISOString(),
    viewCount: 47, hasViewed: false,
  },
  {
    id: 's3', authorDid: 'did:orbit:carol', authorHandle: 'carol', authorName: 'Carol',
    text: 'Walking through the new park 🌳',
    createdAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 23 * 3600 * 1000).toISOString(),
    viewCount: 12, hasViewed: true,
  },
];

export default function StoriesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>(MOCK_STORIES);
  const [activeIndex, setActiveIndex] = useState(0);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  async function postStory() {
    if (!draft.trim()) return;
    setPosting(true);
    try {
      await api.stories.create({ text: draft });
      setDraft('');
      setComposing(false);
      // Refresh
    } catch (err) {
      console.error(err);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto pb-24">
      <div className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-hairline px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">Stories</h1>
      </div>

      {composing ? (
        <div className="p-4 space-y-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Share a moment... (24h ephemeral)"
            className="w-full min-h-[120px] bg-bg-subtle border border-hairline rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <div className="flex gap-2">
            <button className="flex-1 bg-bg-subtle py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
              <ImageIcon size={16} /> Photo
            </button>
            <button className="flex-1 bg-bg-subtle py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
              <MapPin size={16} /> Location
            </button>
            <button className="flex-1 bg-bg-subtle py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
              <Users size={16} /> Close friends
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setComposing(false)}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-bg-subtle"
            >
              Cancel
            </button>
            <button
              onClick={postStory}
              disabled={!draft.trim() || posting}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-accent text-white disabled:opacity-50"
            >
              {posting ? 'Posting…' : 'Post story'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            onClick={() => setComposing(true)}
            className="m-4 p-3 bg-gradient-to-r from-accent to-ai text-white rounded-xl font-semibold flex items-center justify-center gap-2 w-[calc(100%-2rem)]"
          >
            + Add to your story
          </button>

          <div className="px-4 space-y-2">
            <h2 className="text-sm font-semibold text-text-tertiary">From people you follow</h2>
            {stories.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setActiveIndex(i)}
                className={clsx(
                  'w-full flex items-center gap-3 p-3 rounded-xl text-left transition',
                  activeIndex === i ? 'bg-accent/5 border border-accent/30' : 'bg-bg-subtle',
                )}
              >
                <div className="relative">
                  <div
                    className={clsx(
                      'w-14 h-14 rounded-full p-0.5',
                      s.hasViewed
                        ? 'bg-bg-elevated'
                        : 'bg-gradient-to-br from-accent via-pink-500 to-amber-500',
                    )}
                  >
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-accent to-ai flex items-center justify-center text-white font-bold">
                      {s.authorName[0]}
                    </div>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{s.authorName}</p>
                  <p className="text-xs text-text-tertiary truncate">{s.text}</p>
                  <p className="text-[10px] text-text-tertiary mt-0.5 flex items-center gap-2">
                    <Clock size={9} /> {timeAgo(s.createdAt)} · {timeLeft(s.expiresAt)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-0.5 text-[10px] text-text-tertiary">
                  <Eye size={12} />
                  <span>{s.viewCount}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3600000);
  if (h < 1) return `${Math.floor(ms / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function timeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  const h = Math.floor(ms / 3600000);
  if (h < 1) return `${Math.floor(ms / 60000)}m left`;
  if (h < 24) return `${h}h left`;
  return `${Math.floor(h / 24)}d left`;
}
