'use client';

import { useState } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Volume2, VolumeX, Play, Pause } from 'lucide-react';
import { clsx } from 'clsx';

interface Reel {
  id: string;
  url: string;
  thumbnail?: string;
  caption: string;
  author: { did: string; handle: string; displayName: string; avatarUrl?: string };
  likeCount: number;
  commentCount: number;
  shareCount: number;
  musicTitle?: string;
}

const MOCK_REELS: Reel[] = [
  {
    id: '1',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
    caption: 'A peaceful moment in nature 🌿 #mindfulness',
    author: { did: 'did:orbit:alice', handle: 'alice', displayName: 'Alice' },
    likeCount: 1284,
    commentCount: 23,
    shareCount: 7,
    musicTitle: 'Forest Lullaby — Ambient',
  },
  {
    id: '2',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg',
    caption: 'Building a startup: Day 100 🚀',
    author: { did: 'did:orbit:bob', handle: 'bob', displayName: 'Bob' },
    likeCount: 5672,
    commentCount: 145,
    shareCount: 89,
    musicTitle: 'Tech Energy — Synthwave',
  },
  {
    id: '3',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg',
    caption: 'Quick recipe: 5-min ramen hack 🍜',
    author: { did: 'orbit:carol', handle: 'carol', displayName: 'Carol' },
    likeCount: 8921,
    commentCount: 412,
    shareCount: 234,
    musicTitle: 'Cooking Vibes — Lo-fi',
  },
];

export default function ReelsPage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [liked, setLiked] = useState<Set<string>>(new Set());

  function toggleLike(id: string) {
    const next = new Set(liked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setLiked(next);
  }

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const scrollTop = e.currentTarget.scrollTop;
    const itemHeight = e.currentTarget.clientHeight;
    const idx = Math.round(scrollTop / itemHeight);
    if (idx !== activeIndex) {
      setActiveIndex(idx);
      setPlaying(true);
    }
  }

  return (
    <div className="bg-black h-[calc(100vh-80px)] overflow-y-scroll snap-y snap-mandatory" onScroll={handleScroll}>
      {MOCK_REELS.map((reel, i) => (
        <div key={reel.id} className="h-[calc(100vh-80px)] snap-start relative flex items-center justify-center">
          <video
            src={reel.url}
            poster={reel.thumbnail}
            className="h-full w-auto max-w-full object-contain"
            autoPlay={i === activeIndex && playing}
            loop
            muted={muted}
            playsInline
          />
          {/* Bottom gradient overlay */}
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

          {/* Right action bar */}
          <div className="absolute right-3 bottom-24 flex flex-col gap-5 items-center">
            <button
              onClick={() => toggleLike(reel.id)}
              className="flex flex-col items-center"
            >
              <Heart
                size={32}
                className={clsx(liked.has(reel.id) ? 'fill-red-500 text-red-500' : 'text-white')}
              />
              <span className="text-white text-xs mt-1 font-semibold">
                {(reel.likeCount + (liked.has(reel.id) ? 1 : 0)).toLocaleString()}
              </span>
            </button>
            <button className="flex flex-col items-center">
              <MessageCircle size={32} className="text-white" />
              <span className="text-white text-xs mt-1 font-semibold">{reel.commentCount}</span>
            </button>
            <button className="flex flex-col items-center">
              <Share2 size={30} className="text-white" />
              <span className="text-white text-xs mt-1 font-semibold">{reel.shareCount}</span>
            </button>
            <button className="flex flex-col items-center">
              <Bookmark size={28} className="text-white" />
            </button>
            <button className="flex flex-col items-center">
              <MoreHorizontal size={28} className="text-white" />
            </button>
          </div>

          {/* Bottom info */}
          <div className="absolute inset-x-3 bottom-20 text-white">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-ai flex items-center justify-center text-white font-bold">
                {reel.author.displayName[0]}
              </div>
              <span className="font-bold">@{reel.author.handle}</span>
              <button className="ml-2 border border-white/60 px-3 py-0.5 rounded text-xs font-semibold">
                Follow
              </button>
            </div>
            <p className="text-sm leading-snug">{reel.caption}</p>
            {reel.musicTitle && (
              <p className="text-xs mt-2 opacity-80 flex items-center gap-1">
                🎵 {reel.musicTitle}
              </p>
            )}
          </div>

          {/* Top controls */}
          <div className="absolute right-3 top-3 flex flex-col gap-3">
            <button
              onClick={() => setMuted(!muted)}
              className="bg-black/40 backdrop-blur p-2 rounded-full text-white"
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <button
              onClick={() => setPlaying(!playing)}
              className="bg-black/40 backdrop-blur p-2 rounded-full text-white"
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? <Pause size={20} /> : <Play size={20} />}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
