'use client';

import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Heart, MessageCircle, Share2, Bookmark, Download, MoreHorizontal } from 'lucide-react';

type MediaItem = {
  url: string;
  type: 'image' | 'video';
  alt?: string;
};

export function MediaLightbox({
  items,
  initialIndex = 0,
  onClose,
}: {
  items: MediaItem[];
  initialIndex?: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(items.length - 1, i + 1));
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [items.length, onClose]);

  const item = items[index];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
        <div className="text-white/90 text-sm font-medium">
          {index + 1} / {items.length}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); }}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur flex items-center justify-center text-white transition-colors"
            title="Download"
          >
            <Download size={18} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur flex items-center justify-center text-white transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Image */}
      <div className="relative max-w-5xl max-h-[85vh] mx-auto" onClick={(e) => e.stopPropagation()}>
        {item?.type === 'image' ? (
          <img
            src={item.url}
            alt={item.alt || ''}
            className="max-w-full max-h-[85vh] object-contain rounded"
          />
        ) : item?.type === 'video' ? (
          <video
            src={item.url}
            controls
            autoPlay
            className="max-w-full max-h-[85vh] rounded"
          />
        ) : null}
      </div>

      {/* Nav arrows */}
      {index > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); setIndex(index - 1); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur flex items-center justify-center text-white transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
      )}
      {index < items.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); setIndex(index + 1); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur flex items-center justify-center text-white transition-colors"
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* Bottom action bar */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-3 p-6 bg-gradient-to-t from-black/60 to-transparent">
        <button
          onClick={(e) => { e.stopPropagation(); setLiked(!liked); }}
          className="flex flex-col items-center gap-1 text-white"
        >
          <Heart size={28} fill={liked ? '#EC4899' : 'transparent'} color={liked ? '#EC4899' : 'white'} />
          <span className="text-xs">Like</span>
        </button>
        <button
          onClick={(e) => e.stopPropagation()}
          className="flex flex-col items-center gap-1 text-white"
        >
          <MessageCircle size={28} />
          <span className="text-xs">Comment</span>
        </button>
        <button
          onClick={(e) => e.stopPropagation()}
          className="flex flex-col items-center gap-1 text-white"
        >
          <Share2 size={26} />
          <span className="text-xs">Share</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setSaved(!saved); }}
          className="flex flex-col items-center gap-1 text-white"
        >
          <Bookmark size={26} fill={saved ? 'white' : 'transparent'} />
          <span className="text-xs">Save</span>
        </button>
        <button
          onClick={(e) => e.stopPropagation()}
          className="flex flex-col items-center gap-1 text-white"
        >
          <MoreHorizontal size={26} />
          <span className="text-xs">More</span>
        </button>
      </div>

      {/* Counter dots */}
      {items.length > 1 && (
        <div className="absolute bottom-24 left-0 right-0 flex items-center justify-center gap-1">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setIndex(i); }}
              className={`h-1 rounded-full transition-all ${i === index ? 'bg-white w-6' : 'bg-white/40 w-1'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
