'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Hash, ArrowLeft, TrendingUp, Users, FileText, Bookmark } from 'lucide-react';

const TAG_MOCK = {
  posts: [
    { id: 'p1', author: 'Alice', handle: 'alice', avatar: 1, content: 'AI is changing how we build software. The new wave of agentic systems is mind-blowing.', likes: 234, comments: 45, time: '2h' },
    { id: 'p2', author: 'Bob', handle: 'bob', avatar: 2, content: 'Building with AI tools daily. The productivity boost is real.', likes: 412, comments: 67, time: '5h' },
    { id: 'p3', author: 'Carol', handle: 'carol', avatar: 3, content: 'Open source AI models are getting really good. Local inference is finally viable.', likes: 189, comments: 28, time: '1d' },
  ],
  related: ['MachineLearning', 'GenerativeAI', 'LLM', 'DeepLearning', 'NLP', 'ComputerVision'],
  top: [
    { handle: 'alice', displayName: 'Alice', bio: 'AI researcher', followers: '12.4K' },
    { handle: 'bob', displayName: 'Bob', bio: 'Building with LLMs', followers: '8.2K' },
  ],
};

export default function HashtagPage() {
  const router = useRouter();
  const params = useParams<{ tag: string }>();
  const tag = params.tag;
  const [tab, setTab] = useState<'top' | 'recent' | 'people'>('top');

  return (
    <div className="min-h-screen bg-bg-elevated pb-20">
      <header className="sticky top-0 z-30 bg-bg-elevated/90 backdrop-blur-md border-b border-hairline">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-bg-subtle hover:bg-bg-cream flex items-center justify-center text-text-primary transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Hash size={18} className="text-accent" />
              <h1 className="font-display font-extrabold text-xl tracking-tight">{tag}</h1>
            </div>
            <p className="text-xs text-text-tertiary flex items-center gap-3">
              <span className="flex items-center gap-1"><FileText size={11} /> 2,847 posts</span>
              <span className="flex items-center gap-1"><Users size={11} /> 12.4K followers</span>
            </p>
          </div>
          <button className="px-4 py-2 rounded-full bg-accent text-white text-sm font-semibold">
            Follow
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-2xl mx-auto flex border-t border-hairline">
          {([
            { id: 'top', label: 'Top', icon: TrendingUp },
            { id: 'recent', label: 'Recent', icon: FileText },
            { id: 'people', label: 'People', icon: Users },
          ] as const).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold transition-colors relative ${
                  tab === t.id ? 'text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
                }`}
              >
                <Icon size={14} />
                {t.label}
                {tab === t.id && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 rounded-full bg-accent" />}
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-3">
        {tab !== 'people' && (
          <>
            {TAG_MOCK.posts.map((p) => (
              <article key={p.id} className="bg-bg-card border border-hairline rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className={`avatar-${p.avatar} w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>
                    {p.author[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="font-bold">{p.author}</span>
                      <span className="text-text-tertiary">@{p.handle}</span>
                      <span className="text-text-tertiary">· {p.time}</span>
                    </div>
                    <p className="text-[15px] mt-1 leading-snug text-text-primary">
                      {p.content.split(/(#\w+)/g).map((part, i) =>
                        part.startsWith('#') ? (
                          <span key={i} className="text-accent font-medium">{part}</span>
                        ) : (
                          <span key={i}>{part}</span>
                        )
                      )}
                    </p>
                    <div className="flex items-center gap-5 mt-3 text-text-tertiary text-xs">
                      <span>♡ {p.likes}</span>
                      <span>💬 {p.comments}</span>
                      <span>🔁</span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </>
        )}

        {tab === 'people' && (
          <div className="bg-bg-card border border-hairline rounded-2xl overflow-hidden divide-y divide-hairline">
            {TAG_MOCK.top.map((u) => (
              <div key={u.handle} className="flex items-center gap-3 p-4">
                <div className={`avatar-${Math.floor(Math.random() * 9) + 1} w-12 h-12 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>
                  {u.displayName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">{u.displayName}</div>
                  <div className="text-text-tertiary text-xs">@{u.handle} · {u.followers} followers</div>
                  <div className="text-text-secondary text-sm mt-0.5">{u.bio}</div>
                </div>
                <button className="px-4 py-1.5 rounded-full bg-text-primary text-white text-xs font-semibold">
                  Follow
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Related tags */}
        {tab !== 'people' && (
          <div className="bg-bg-card border border-hairline rounded-2xl p-4 mt-6">
            <h3 className="text-sm font-bold mb-3">Related tags</h3>
            <div className="flex flex-wrap gap-2">
              {TAG_MOCK.related.map((r) => (
                <button
                  key={r}
                  onClick={() => router.push(`/tag/${r}`)}
                  className="px-3 py-1.5 rounded-full bg-bg-subtle text-text-secondary text-xs font-medium hover:bg-accent/10 hover:text-accent transition-colors"
                >
                  #{r}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
