'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Mail, ArrowRight, ArrowLeft, Loader2, KeyRound, Shield, Check, AlertCircle,
  Eye, EyeOff, ChevronLeft,
} from 'lucide-react';
import { api } from '@/lib/api';

export default function ForgotPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-bg-elevated flex">
      {/* Left visual side */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600 items-center justify-center">
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
            🔐
          </div>
          <h1 className="text-5xl font-extrabold text-white mb-4 font-display tracking-tight">
            Recover your orbit
          </h1>
          <p className="text-lg text-white/85 max-w-md mx-auto leading-relaxed">
            Lost your handle? We'll send a secure code to your registered email.
          </p>
        </div>
        <style jsx>{`@keyframes twinkle { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }`}</style>
      </div>

      <div className="flex-1 flex flex-col px-6 sm:px-12 py-8 max-w-xl mx-auto w-full">
        <Link href="/login" className="flex items-center gap-2 mb-12">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent to-ai flex items-center justify-center text-white font-extrabold shadow-md">
            O
          </div>
          <span className="font-display font-extrabold text-xl tracking-tight">ORBIT</span>
        </Link>

        <div className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto">
          <ForgotFlow onComplete={() => router.push('/home')} />
        </div>
      </div>
    </div>
  );
}

function ForgotFlow({ onComplete }: { onComplete: () => void }) {
  type Step = 'email' | 'code' | 'identity' | 'new-handle' | 'done';
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [identity, setIdentity] = useState<any>(null);
  const [newHandle, setNewHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDevInbox, setShowDevInbox] = useState(false);
  const [devEmails, setDevEmails] = useState<any[]>([]);

  const STEPS: Step[] = ['email', 'code', 'identity', 'new-handle', 'done'];
  const stepIdx = STEPS.indexOf(step);

  async function requestCode() {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4001/api/v1'}/auth/recovery/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }).then((r) => r.json());

      // For dev: poll the dev inbox to get the code
      await pollDevInbox();
      setStep('code');
    } catch (err: any) {
      setError(err.message || 'Failed to send code');
    } finally {
      setLoading(false);
    }
  }

  async function pollDevInbox() {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4001/api/v1'}/auth/dev/inbox`);
      const json = await res.json();
      setDevEmails(json);
    } catch {}
  }

  async function verifyCode() {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4001/api/v1'}/auth/recovery/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      }).then((r) => r.json());

      if (!res.ok) {
        setError('Invalid or expired code');
        return;
      }
      setIdentity(res.identity);
      setNewHandle(res.identity.handle);
      setStep('identity');
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function resetHandle() {
    if (!newHandle.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4001/api/v1'}/auth/recovery/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newHandle }),
      }).then((r) => r.json());

      if (!res.ok) {
        setError(res.message || 'Reset failed');
        return;
      }
      // Save session
      if (res.session) {
        localStorage.setItem('orbit-auth', JSON.stringify({
          state: {
            accessToken: res.session.accessToken,
            refreshToken: res.session.refreshToken,
            isAuthenticated: true,
            hasHydrated: true,
            user: {
              did: res.session.did,
              handle: res.session.handle,
              displayName: res.session.displayName,
            },
          },
          version: 0,
        }));
      }
      setStep('done');
      setTimeout(() => onComplete(), 2500);
    } catch (err: any) {
      setError(err.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Step indicator */}
      <div className="flex gap-1.5 mb-8">
        {STEPS.slice(0, 4).map((s, i) => (
          <div
            key={s}
            className={`flex-1 h-[3px] rounded-full transition-colors ${i <= stepIdx ? 'bg-accent' : 'bg-hairline'}`}
          />
        ))}
      </div>

      {/* Step 1: Email */}
      {step === 'email' && (
        <>
          <Link href="/login" className="inline-flex items-center gap-1.5 text-text-tertiary text-sm hover:text-text-primary transition-colors mb-8">
            <ChevronLeft size={14} /> Back to login
          </Link>
          <div className="text-5xl mb-6">📧</div>
          <h2 className="text-3xl font-extrabold tracking-tight font-display mb-2">Forgot your handle?</h2>
          <p className="text-text-secondary mb-8 leading-relaxed">
            Enter the email on your account. We'll send a 6-digit code to verify it's really you.
          </p>
          <div className="mb-2">
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && requestCode()}
              placeholder="you@example.com"
              autoFocus
              className="w-full bg-bg-card border border-hairlineStrong rounded-md py-3.5 px-4 text-[15px] outline-none focus:border-accent transition-colors"
            />
          </div>
          {error && (
            <div className="mt-4 p-3 bg-danger/10 border border-danger/20 rounded-md text-danger text-sm flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}
          <button
            onClick={requestCode}
            disabled={!email.trim() || loading}
            className="w-full mt-8 py-4 bg-text-primary text-white border-0 rounded-md text-[15px] font-bold hover:bg-neutral-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <>Send code <ArrowRight size={18} /></>}
          </button>
        </>
      )}

      {/* Step 2: Code */}
      {step === 'code' && (
        <>
          <button onClick={() => setStep('email')} className="inline-flex items-center gap-1.5 text-text-tertiary text-sm hover:text-text-primary transition-colors mb-8">
            <ChevronLeft size={14} /> Back
          </button>
          <div className="text-5xl mb-6">🔢</div>
          <h2 className="text-3xl font-extrabold tracking-tight font-display mb-2">Enter your code</h2>
          <p className="text-text-secondary mb-6 leading-relaxed">
            We sent a 6-digit code to <span className="font-mono text-text-primary">{email}</span>.
          </p>

          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => e.key === 'Enter' && verifyCode()}
            placeholder="000000"
            maxLength={6}
            autoFocus
            className="w-full bg-bg-card border border-hairlineStrong rounded-md py-4 px-4 text-3xl text-center font-mono font-bold tracking-[0.5em] outline-none focus:border-accent transition-colors"
          />

          {/* Dev helper: show the code from mock inbox */}
          {devEmails.length > 0 && (
            <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded-md text-sm">
              <button
                onClick={() => setShowDevInbox(!showDevInbox)}
                className="flex items-center gap-1.5 font-semibold text-warning"
              >
                {showDevInbox ? <EyeOff size={14} /> : <Eye size={14} />}
                {showDevInbox ? 'Hide' : 'Show'} dev inbox (dev only)
              </button>
              {showDevInbox && (
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
            onClick={verifyCode}
            disabled={code.length !== 6 || loading}
            className="w-full mt-8 py-4 bg-text-primary text-white border-0 rounded-md text-[15px] font-bold hover:bg-neutral-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <>Verify code <ArrowRight size={18} /></>}
          </button>
          <button onClick={requestCode} disabled={loading} className="w-full text-text-secondary text-sm font-semibold py-3 mt-2">
            Resend code
          </button>
        </>
      )}

      {/* Step 3: Confirm identity */}
      {step === 'identity' && identity && (
        <>
          <div className="text-5xl mb-6">👤</div>
          <h2 className="text-3xl font-extrabold tracking-tight font-display mb-2">Is this you?</h2>
          <p className="text-text-secondary mb-6 leading-relaxed">
            We found this account. Confirm it's you, then set a new handle.
          </p>
          <div className="bg-bg-card border border-hairline rounded-xl p-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent to-ai flex items-center justify-center text-white font-extrabold text-xl shadow-sm flex-shrink-0">
              {identity.displayName?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold">{identity.displayName}</div>
              <div className="text-sm text-text-tertiary">@{identity.handle}</div>
              <div className="text-xs text-text-tertiary font-mono mt-0.5">{identity.did}</div>
            </div>
          </div>
          <button
            onClick={() => setStep('new-handle')}
            className="w-full mt-8 py-4 bg-text-primary text-white border-0 rounded-md text-[15px] font-bold hover:bg-neutral-700 transition-colors flex items-center justify-center gap-2"
          >
            Yes, that's me <ArrowRight size={18} />
          </button>
        </>
      )}

      {/* Step 4: New handle */}
      {step === 'new-handle' && (
        <>
          <button onClick={() => setStep('identity')} className="inline-flex items-center gap-1.5 text-text-tertiary text-sm hover:text-text-primary transition-colors mb-8">
            <ChevronLeft size={14} /> Back
          </button>
          <div className="text-5xl mb-6">✏️</div>
          <h2 className="text-3xl font-extrabold tracking-tight font-display mb-2">New handle</h2>
          <p className="text-text-secondary mb-6 leading-relaxed">
            Choose a new handle. You can change it again anytime.
          </p>
          <div className="mb-2">
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">New handle</label>
            <input
              type="text"
              value={newHandle}
              onChange={(e) => setNewHandle(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && resetHandle()}
              autoFocus
              className="w-full bg-bg-card border border-hairlineStrong rounded-md py-3.5 px-4 text-[15px] font-mono outline-none focus:border-accent transition-colors"
            />
            <p className="text-xs text-text-tertiary mt-1.5">
              Your identity: <span className="font-mono">did:orbit:{newHandle.slice(0, 6) || '…'}…{newHandle.slice(-4) || '…'}</span>
            </p>
          </div>
          {error && (
            <div className="mt-4 p-3 bg-danger/10 border border-danger/20 rounded-md text-danger text-sm flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}
          <button
            onClick={resetHandle}
            disabled={newHandle.length < 3 || loading}
            className="w-full mt-8 py-4 bg-gradient-to-r from-accent to-ai text-white border-0 rounded-md text-[15px] font-bold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <>Set new handle <ArrowRight size={18} /></>}
          </button>
        </>
      )}

      {/* Step 5: Done */}
      {step === 'done' && (
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-success/10 flex items-center justify-center">
            <Check size={40} className="text-success" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight font-display mb-2">Handle updated!</h2>
          <p className="text-text-secondary leading-relaxed mb-6">
            You're now <span className="font-bold text-text-primary">@{newHandle}</span>. Redirecting to your orbit…
          </p>
          <Loader2 size={18} className="animate-spin mx-auto text-accent" />
        </div>
      )}
    </div>
  );
}
