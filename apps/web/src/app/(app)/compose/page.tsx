'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Sparkles, Image, Hash, AtSign, Smile, MapPin, Calendar } from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

const MODES = [
  { id: 'intimate', label: 'Intimate', color: 'bg-amber-500' },
  { id: 'public', label: 'Public', color: 'bg-accent' },
  { id: 'visual', label: 'Visual', color: 'bg-pink-500' },
  { id: 'community', label: 'Community', color: 'bg-cyan-500' },
] as const;

export default function ComposePage() {
  const router = useRouter();
  const [mode, setMode] = useState<typeof MODES[number]['id']>('public');
  const [text, setText] = useState('');
  const [publishing, setPublishing] = useState(false);

  async function publish() {
    if (!text.trim()) return;
    setPublishing(true);
    try {
      await api.posts.create({ mode, contentText: text });
      router.push('/home');
    } catch (err) {
      console.error(err);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-bg-elevated z-50 flex flex-col">
      <div className="px-4 py-3.5 flex items-center justify-between border-b border-hairline">
        <button onClick={() => router.back()} className="bg-bg-subtle border-0 w-9 h-9 rounded-full text-text-secondary flex items-center justify-center">
          <X size={16} />
        </button>

        {/* Mode selector */}
        <div className="flex gap-1.5">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={clsx(
                'px-3 py-1 rounded-full text-xs font-semibold border-0',
                mode === m.id ? 'bg-text-primary text-white' : 'bg-bg-subtle text-text-secondary'
              )}
            >
              <span className={clsx('inline-block w-1.5 h-1.5 rounded-full mr-1', m.color)} />
              {m.label}
            </button>
          ))}
        </div>

        <button
          onClick={publish}
          disabled={!text.trim() || publishing}
          className="btn btn-primary disabled:opacity-40"
        >
          {publishing ? '...' : 'Post'}
        </button>
      </div>

      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What's on your mind?"
        maxLength={5000}
        className="flex-1 bg-transparent border-0 outline-none p-5 text-base resize-none placeholder:text-text-tertiary font-body"
      />

      {/* AI Assist panel */}
      <div className="border-t border-hairline px-4 py-2.5 bg-ai-soft flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-ai to-accent flex items-center justify-center text-white flex-shrink-0">
          <Sparkles size={16} fill="currentColor" />
        </div>
        <div className="text-xs flex-1">
          <strong>AI suggestions</strong> · Sentiment: positive · Best time: in 12 min
        </div>
        <div className="flex gap-1.5">
          <button className="bg-white border border-ai-light text-ai px-2 py-0.5 rounded-full text-2xs font-semibold">✨ Polish</button>
          <button className="bg-white border border-ai-light text-ai px-2 py-0.5 rounded-full text-2xs font-semibold">📅 Schedule</button>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-hairline">
        <div className="flex gap-3">
          <button className="bg-transparent border-0 text-text-secondary p-2 cursor-pointer" title="Photo">
            <Image size={20} strokeWidth={2} />
          </button>
          <button className="bg-transparent border-0 text-text-secondary p-2 cursor-pointer" title="Hashtag">
            <Hash size={20} strokeWidth={2} />
          </button>
          <button className="bg-transparent border-0 text-text-secondary p-2 cursor-pointer" title="Mention">
            <AtSign size={20} strokeWidth={2} />
          </button>
          <button className="bg-transparent border-0 text-text-secondary p-2 cursor-pointer" title="Emoji">
            <Smile size={20} strokeWidth={2} />
          </button>
          <button className="bg-transparent border-0 text-text-secondary p-2 cursor-pointer" title="Location">
            <MapPin size={20} strokeWidth={2} />
          </button>
        </div>
        <span className="text-xs text-text-secondary">{text.length} / 5000</span>
      </div>
    </div>
  );
}
