'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Key, ArrowRight, Check } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export default function OnboardingPage() {
  const router = useRouter();
  const signup = useAuth((s) => s.signup);
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignup() {
    setLoading(true);
    setError(null);
    try {
      await signup({ displayName, handle: handle || undefined });
      router.push('/home');
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-elevated px-7 pt-16 pb-8 flex flex-col max-w-md mx-auto">
      <div className="flex gap-1.5 mb-10">
        <div className={`flex-1 h-[3px] rounded-full ${step >= 1 ? 'bg-accent' : 'bg-hairline'}`} />
        <div className={`flex-1 h-[3px] rounded-full ${step >= 2 ? 'bg-accent' : 'bg-hairline'}`} />
        <div className={`flex-1 h-[3px] rounded-full ${step >= 3 ? 'bg-accent' : 'bg-hairline'}`} />
      </div>

      {step === 1 && (
        <div className="flex flex-col flex-1">
          <div className="w-full h-48 bg-gradient-to-br from-accent-soft to-ai-soft rounded-xl flex items-center justify-center text-7xl mb-8 border border-hairline shadow-md">
            🔑
          </div>
          <h1 className="text-3xl font-extrabold letter-tight mb-2.5 font-display">Your handle is yours.<br />Forever.</h1>
          <p className="text-[15px] text-text-secondary mb-8 leading-relaxed">
            Pick a domain or @handle. We'll generate cryptographic keys so your identity, followers, and history move with you — even if Orbit shuts down.
          </p>
          <input
            type="text"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@yourname.com or @yourname"
            className="w-full bg-bg-card border border-hairlineStrong rounded-md py-3.5 px-4 text-base font-mono outline-none focus:border-accent transition-colors mb-3"
          />
          <p className="text-xs text-text-secondary mb-6">
            <span className="text-success font-semibold">✓ Verified</span> · Your domain · did:orbit:7f3a...b2c4
          </p>
          <button
            onClick={() => setStep(2)}
            className="w-full py-4 bg-text-primary text-white border-0 rounded-md text-[15px] font-bold hover:bg-neutral-700 transition-colors mt-auto"
          >
            Continue →
          </button>
          <button className="bg-transparent text-text-secondary border-0 text-[13px] font-semibold cursor-pointer py-3 mt-2">
            Use a custom domain
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col flex-1">
          <div className="w-full h-48 bg-gradient-to-br from-amber-50 to-pink-50 rounded-xl flex items-center justify-center text-7xl mb-8 border border-hairline shadow-md">
            👋
          </div>
          <h1 className="text-3xl font-extrabold letter-tight mb-2.5 font-display">What should we call you?</h1>
          <p className="text-[15px] text-text-secondary mb-8 leading-relaxed">
            This is your display name — what people see on your profile and posts. You can change it anytime.
          </p>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            autoFocus
            className="w-full bg-bg-card border border-hairlineStrong rounded-md py-3.5 px-4 text-base outline-none focus:border-accent transition-colors mb-6"
          />
          <button
            onClick={() => setStep(3)}
            disabled={!displayName.trim()}
            className="w-full py-4 bg-text-primary text-white border-0 rounded-md text-[15px] font-bold hover:bg-neutral-700 transition-colors mt-auto disabled:opacity-40"
          >
            Continue →
          </button>
          <button onClick={() => setStep(1)} className="bg-transparent text-text-secondary border-0 text-[13px] font-semibold cursor-pointer py-3 mt-2">
            ← Back
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col flex-1">
          <div className="w-full h-48 bg-gradient-to-br from-emerald-50 to-cyan-50 rounded-xl flex items-center justify-center text-7xl mb-8 border border-hairline shadow-md">
            🤖
          </div>
          <h1 className="text-3xl font-extrabold letter-tight mb-2.5 font-display">Meet your AI</h1>
          <p className="text-[15px] text-text-secondary mb-6 leading-relaxed">
            Orbit AI works for <strong>you</strong>, not the platform. It filters spam, summarizes DMs, drafts posts, and respects your time.
          </p>
          <div className="bg-bg-subtle rounded-md p-4 mb-6 space-y-2">
            <div className="flex items-center gap-3 text-sm">
              <Check size={18} className="text-success flex-shrink-0" />
              <span>Feed filter (no outrage bait)</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Check size={18} className="text-success flex-shrink-0" />
              <span>DM summary + smart replies</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Check size={18} className="text-success flex-shrink-0" />
              <span>Auto-block spammers + bots</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Check size={18} className="text-success flex-shrink-0" />
              <span>Schedule posts, translate, plan</span>
            </div>
          </div>
          {error && <div className="text-danger text-sm mb-4">{error}</div>}
          <button
            onClick={handleSignup}
            disabled={loading}
            className="w-full py-4 bg-text-primary text-white border-0 rounded-md text-[15px] font-bold hover:bg-neutral-700 transition-colors mt-auto disabled:opacity-40"
          >
            {loading ? 'Creating account...' : 'Enter Orbit →'}
          </button>
          <button onClick={() => setStep(2)} className="bg-transparent text-text-secondary border-0 text-[13px] font-semibold cursor-pointer py-3 mt-2">
            ← Back
          </button>
        </div>
      )}
    </div>
  );
}
