'use client';

import { useState } from 'react';
import { X, Heart, IndianRupee, Loader2, Check, Sparkles, Star } from 'lucide-react';
import { api } from '@/lib/api';

const TIP_AMOUNTS = [50, 100, 500, 1000, 5000]; // rupees

export function TipModal({ toDid, toHandle, postId, onClose }: { toDid: string; toHandle: string; postId?: string; onClose: () => void }) {
  const [amount, setAmount] = useState(100);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function send() {
    if (amount < 1) return;
    setLoading(true);
    try {
      await (api as any).sendTip({ toDid, amountPaise: amount * 100, message: message || undefined, postId });
      setSuccess(true);
      setTimeout(onClose, 1800);
    } catch (e: any) {
      alert(e.message || 'Tip failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-bg-card rounded-2xl max-w-md w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {success ? (
          <div className="p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
              <Check size={36} className="text-success" />
            </div>
            <h2 className="text-xl font-bold mb-1">Tip sent!</h2>
            <p className="text-text-secondary text-sm">₹{amount} to @{toHandle}</p>
          </div>
        ) : (
          <>
            <div className="p-5 border-b border-hairline flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Heart size={18} className="text-pink-500 fill-pink-500" /> Send a tip
              </h2>
              <button onClick={onClose}><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-text-secondary">Support @{toHandle} with a tip. They keep 100%.</p>
              <div className="grid grid-cols-3 gap-2">
                {TIP_AMOUNTS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAmount(a)}
                    className={`py-3 rounded-lg border-2 text-sm font-bold transition-colors ${
                      amount === a ? 'border-pink-500 bg-pink-50 text-pink-600' : 'border-hairline hover:border-pink-300'
                    }`}
                  >
                    ₹{a}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
                  className="py-3 rounded-lg border-2 border-hairline text-sm font-bold text-center outline-none focus:border-pink-500"
                  placeholder="₹"
                />
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a message (optional)"
                rows={2}
                maxLength={500}
                className="w-full bg-bg-subtle border border-hairline rounded-md py-2 px-3 text-sm outline-none focus:border-pink-500 resize-none"
              />
              <button
                onClick={send}
                disabled={amount < 1 || loading}
                className="w-full py-3 bg-gradient-to-r from-pink-500 to-red-500 text-white rounded-md font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Heart size={16} fill="white" />}
                Send ₹{amount}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function SubscribeModal({ creatorDid, creatorHandle, tiers, onClose, onSubscribed }: { creatorDid: string; creatorHandle: string; tiers: any[]; onClose: () => void; onSubscribed: () => void }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);

  async function subscribe(tierId: string) {
    setLoading(tierId);
    try {
      await (api as any).subscribe({ creatorDid, tierId });
      setSubscribed(true);
      onSubscribed();
      setTimeout(onClose, 1800);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-bg-card rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {subscribed ? (
          <div className="p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
              <Check size={36} className="text-success" />
            </div>
            <h2 className="text-xl font-bold mb-1">Subscribed!</h2>
            <p className="text-text-secondary text-sm">You're now supporting @{creatorHandle}</p>
          </div>
        ) : (
          <>
            <div className="p-5 border-b border-hairline flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Star size={18} className="text-amber-500 fill-amber-500" /> Subscribe to @{creatorHandle}
              </h2>
              <button onClick={onClose}><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              {tiers.length === 0 && (
                <p className="text-sm text-text-tertiary text-center py-4">No subscription tiers yet</p>
              )}
              {tiers.map((t) => (
                <button
                  key={t.id}
                  onClick={() => subscribe(t.id)}
                  disabled={!!loading}
                  className="w-full text-left p-4 rounded-xl border-2 border-hairline hover:border-accent transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {t.color && <div className="w-3 h-3 rounded-full" style={{ background: t.color }} />}
                      <h3 className="font-bold">{t.name}</h3>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-extrabold">₹{t.amountPaise / 100}<span className="text-xs text-text-tertiary">/mo</span></div>
                    </div>
                  </div>
                  {t.description && <p className="text-xs text-text-secondary">{t.description}</p>}
                  {t.benefits && t.benefits.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {t.benefits.slice(0, 3).map((b: string, i: number) => (
                        <li key={i} className="text-xs text-text-tertiary flex items-center gap-1">
                          <Check size={10} className="text-success" /> {b}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-2 text-xs text-accent font-semibold flex items-center gap-1">
                    {loading === t.id ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    Subscribe
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function MonetizeButton({ postId, authorDid, authorHandle, variant = 'post' }: { postId?: string; authorDid: string; authorHandle: string; variant?: 'post' | 'profile' }) {
  const [showTip, setShowTip] = useState(false);
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [tiers, setTiers] = useState<any[]>([]);

  async function openSubscribe() {
    if (tiers.length === 0) {
      try {
        const t = await (api as any).listTiers(authorHandle);
        setTiers(t);
      } catch {}
    }
    setShowSubscribe(true);
  }

  return (
    <>
      {variant === 'post' ? (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setShowTip(true); }}
            className="p-1.5 rounded-full hover:bg-pink-50 text-text-secondary hover:text-pink-500 transition-colors"
            title="Send tip"
          >
            <Heart size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); openSubscribe(); }}
            className="p-1.5 rounded-full hover:bg-amber-50 text-text-secondary hover:text-amber-500 transition-colors"
            title="Subscribe"
          >
            <Star size={16} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTip(true)}
            className="flex-1 py-2.5 rounded-full bg-pink-500 text-white text-sm font-bold flex items-center justify-center gap-1.5"
          >
            <Heart size={14} fill="white" /> Tip
          </button>
          <button
            onClick={openSubscribe}
            className="flex-1 py-2.5 rounded-full bg-amber-500 text-white text-sm font-bold flex items-center justify-center gap-1.5"
          >
            <Star size={14} fill="white" /> Subscribe
          </button>
        </div>
      )}
      {showTip && <TipModal toDid={authorDid} toHandle={authorHandle} postId={postId} onClose={() => setShowTip(false)} />}
      {showSubscribe && (
        <SubscribeModal
          creatorDid={authorDid}
          creatorHandle={authorHandle}
          tiers={tiers}
          onClose={() => setShowSubscribe(false)}
          onSubscribed={() => {}}
        />
      )}
    </>
  );
}
