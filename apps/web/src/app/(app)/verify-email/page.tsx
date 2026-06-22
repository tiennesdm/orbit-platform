'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, ArrowRight, Check, Loader2, AlertCircle, Eye, EyeOff, Shield, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4001/api/v1';

export default function VerifyEmailPage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const hasHydrated = useAuth((s) => s.hasHydrated);
  const fetchMe = useAuth((s) => s.fetchMe);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [showInbox, setShowInbox] = useState(false);
  const [devEmails, setDevEmails] = useState<any[]>([]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      router.push('/login');
      return;
    }
    // Auto-send code on first load
    if ((user as any).email && !cooldown) {
      sendCode();
    }
  }, [user, hasHydrated]);

  useEffect(() => {
    if (cooldown > 0) {
      const t = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [cooldown]);

  async function sendCode() {
    if (!user) return;
    setSending(true);
    setError(null);
    try {
      await fetch(`${API_BASE}/auth/email/send-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('orbit_token')}`,
        },
      });
      await pollInbox();
      setCooldown(60);
    } catch (err: any) {
      setError(err.message || 'Failed to send code');
    } finally {
      setSending(false);
    }
  }

  async function pollInbox() {
    try {
      const res = await fetch(`${API_BASE}/auth/dev/inbox`);
      const json = await res.json();
      setDevEmails(json);
    } catch {}
  }

  async function verify() {
    if (code.length !== 6) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/email/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('orbit_token')}`,
        },
        body: JSON.stringify({ code }),
      }).then((r) => r.json());

      if (!res.ok) {
        setError(res.message || 'Invalid code');
        return;
      }
      setSuccess(true);
      await fetchMe();
      setTimeout(() => router.push('/profile/edit'), 1500);
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  if (!hasHydrated || !user) return <div className="min-h-screen bg-bg-elevated" />;

  return (
    <div className="min-h-screen bg-bg-elevated flex">
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700 items-center justify-center">
        <div className="absolute inset-0 opacity-20">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                top: `${(i * 37) % 100}%`,
                left: `${(i * 71) % 100}%`,
                width: 2 + (i % 3),
                height: 2 + (i % 3),
                animation: `twinkle ${2 + (i % 3)}s ease-in-out infinite`,
                animationDelay: `${(i % 5) * 0.3}s`,
              }}
            />
          ))}
        </div>
        <div className="relative z-10 text-center px-12">
          <div className="w-32 h-32 mx-auto mb-8 rounded-full bg-white/20 backdrop-blur-md border-4 border-white/40 shadow-2xl flex items-center justify-center text-6xl">
            ✉️
          </div>
          <h1 className="text-5xl font-extrabold text-white mb-4 font-display tracking-tight">
            Verify your email
          </h1>
          <p className="text-lg text-white/85 max-w-md mx-auto leading-relaxed">
            Account recovery and important security alerts go to your email. Let's confirm it's really yours.
          </p>
        </div>
        <style jsx>{`@keyframes twinkle { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }`}</style>
      </div>

      <div className="flex-1 flex flex-col px-6 sm:px-12 py-8 max-w-xl mx-auto w-full">
        <div className="flex items-center gap-2 mb-12">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent to-ai flex items-center justify-center text-white font-extrabold shadow-md">
            O
          </div>
          <span className="font-display font-extrabold text-xl tracking-tight">ORBIT</span>
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto">
          <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-text-tertiary text-sm hover:text-text-primary transition-colors mb-8">
            <ArrowLeft size={14} /> Back
          </button>

          {success ? (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-success/10 flex items-center justify-center">
                <Check size={40} className="text-success" />
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight font-display mb-2">Email verified!</h2>
              <p className="text-text-secondary leading-relaxed">
                You can now recover your account, receive security alerts, and unlock more features.
              </p>
            </div>
          ) : (
            <>
              <div className="text-5xl mb-6">🔐</div>
              <h2 className="text-3xl font-extrabold tracking-tight font-display mb-2">Enter your code</h2>
              <p className="text-text-secondary mb-6 leading-relaxed">
                We sent a 6-digit code to <span className="font-mono text-text-primary">{(user as any).email || 'your email'}</span>.
              </p>

              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && verify()}
                placeholder="000000"
                maxLength={6}
                autoFocus
                className="w-full bg-bg-card border border-hairlineStrong rounded-md py-4 px-4 text-3xl text-center font-mono font-bold tracking-[0.5em] outline-none focus:border-accent transition-colors"
              />

              {devEmails.length > 0 && (
                <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded-md text-sm">
                  <button onClick={() => setShowInbox(!showInbox)} className="flex items-center gap-1.5 font-semibold text-warning">
                    {showInbox ? <EyeOff size={14} /> : <Eye size={14} />}
                    {showInbox ? 'Hide' : 'Show'} dev inbox
                  </button>
                  {showInbox && (
                    <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
                      {devEmails.slice(0, 3).map((em, i) => {
                        const codeMatch = em.text?.match(/(\d{6})/);
                        return (
                          <div key={i} className="text-xs bg-bg-card p-2 rounded border border-hairline">
                            <div className="font-semibold text-text-primary mb-1">{em.subject}</div>
                            {codeMatch && (
                              <div className="flex items-center gap-2">
                                <span>Code:</span>
                                <button
                                  onClick={() => setCode(codeMatch[1])}
                                  className="font-mono font-bold text-accent hover:underline"
                                >
                                  {codeMatch[1]}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="mt-4 p-3 bg-danger/10 border border-danger/20 rounded-md text-danger text-sm flex items-center gap-2">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <button
                onClick={verify}
                disabled={code.length !== 6 || loading}
                className="w-full mt-8 py-4 bg-gradient-to-r from-accent to-ai text-white border-0 rounded-md text-[15px] font-bold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <>Verify <ArrowRight size={18} /></>}
              </button>

              <button
                onClick={sendCode}
                disabled={cooldown > 0 || sending}
                className="w-full text-text-secondary text-sm font-semibold py-3 mt-2 disabled:opacity-50"
              >
                {sending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>

              <div className="mt-8 p-4 bg-bg-card border border-hairline rounded-lg">
                <div className="flex items-start gap-2">
                  <Shield size={16} className="text-ai flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Your email is used only for account recovery and security alerts. We never share it with third parties or use it for marketing.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
