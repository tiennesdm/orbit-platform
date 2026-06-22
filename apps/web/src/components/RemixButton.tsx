'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Repeat, Quote, Sparkles, X, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

type RemixKind = 'duet' | 'stitch' | 'quote';

export function RemixButton({ postId, authorHandle }: { postId: string; authorHandle: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [remixes, setRemixes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function openModal() {
    setOpen(true);
    if (remixes.length === 0) {
      setLoading(true);
      try {
        const r = await (api as any).remixesOf(postId);
        setRemixes(r);
      } catch {} finally {
        setLoading(false);
      }
    }
  }

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); openModal(); }}
        className="p-1.5 rounded-full hover:bg-bg-subtle text-text-secondary hover:text-accent transition-colors"
        title="Remix / Quote"
      >
        <Repeat size={16} />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setOpen(false)}>
          <div className="bg-bg-card rounded-t-2xl sm:rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-bg-card border-b border-hairline p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Repeat size={18} className="text-accent" /> Remixes of @{authorHandle}
              </h2>
              <button onClick={() => setOpen(false)}><X size={18} /></button>
            </div>

            {/* Action buttons */}
            <div className="p-4 border-b border-hairline grid grid-cols-3 gap-2">
              {(['duet', 'stitch', 'quote'] as const).map((kind) => (
                <button
                  key={kind}
                  onClick={() => router.push(`/compose?remix=${postId}&kind=${kind}`)}
                  className="py-2 rounded-lg border border-hairline hover:border-accent text-sm font-semibold capitalize transition-colors"
                >
                  {kind}
                </button>
              ))}
            </div>

            {/* List of remixes */}
            <div className="p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">Recent remixes</h3>
              {loading ? (
                <div className="text-center py-8"><Loader2 className="animate-spin mx-auto" size={20} /></div>
              ) : remixes.length === 0 ? (
                <p className="text-sm text-text-tertiary text-center py-6">No remixes yet — be the first</p>
              ) : (
                remixes.map((r) => (
                  <div key={r.postId} className="flex items-start gap-2 bg-bg-subtle rounded-lg p-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-ai flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {r.displayName?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 text-xs">
                        <span className="font-bold">{r.displayName}</span>
                        <span className="text-text-tertiary">@{r.handle}</span>
                        <span className="text-text-tertiary">·</span>
                        <span className="text-accent font-semibold uppercase">{r.kind}</span>
                      </div>
                      <p className="text-sm mt-0.5 line-clamp-2">{r.contentText || '(remix)'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function InlineRemixIndicator({ postId, authorHandle }: { postId: string; authorHandle: string }) {
  return <RemixButton postId={postId} authorHandle={authorHandle} />;
}
