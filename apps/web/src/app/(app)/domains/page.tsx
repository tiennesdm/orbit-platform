'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Globe, Check, Copy, Loader2, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export default function DomainsPage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const hasHydrated = useAuth((s) => s.hasHydrated);
  const [domain, setDomain] = useState('');
  const [domains, setDomains] = useState<any[]>([]);
  const [setupResult, setSetupResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resolving, setResolving] = useState<{ did: string; pdsEndpoint: string } | null>(null);

  useEffect(() => {
    if (hasHydrated && !user) { router.push('/login'); return; }
    if (!user) return;
    (api as any).myDomains().then(setDomains).catch(() => {});
  }, [user, hasHydrated, router]);

  if (!hasHydrated || !user) return <div className="min-h-screen bg-bg-elevated" />;

  async function setup() {
    if (!domain) return;
    setLoading(true);
    setSetupResult(null);
    try {
      const res = await (api as any).setupDomain({ domain });
      setSetupResult(res);
    } catch (e: any) {
      alert(e.message || 'Failed to set up domain');
    } finally {
      setLoading(false);
    }
  }

  async function verify(d: string) {
    setLoading(true);
    try {
      const res = await (api as any).verifyDomain(d);
      alert(res.verified ? '✅ Domain verified!' : '❌ Verification failed. Make sure the TXT record is added.');
      const list = await (api as any).myDomains();
      setDomains(list);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function resolve(h: string) {
    setResolving(null);
    const r = await (api as any).resolveHandle(h);
    setResolving(r as any);
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-bg-elevated pb-20">
      <header className="sticky top-0 z-30 bg-bg-elevated/90 backdrop-blur-md border-b border-hairline">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-bg-subtle hover:bg-bg-cream flex items-center justify-center text-text-primary transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="font-display font-extrabold text-xl tracking-tight flex items-center gap-2">
              <Globe size={18} className="text-accent" /> Custom domain
            </h1>
            <p className="text-xs text-text-tertiary">Use yourname.com as your ORBIT handle</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* Setup new domain */}
        <section className="bg-bg-card border border-hairline rounded-2xl p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary mb-3">Add a domain</h2>
          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ''))}
              placeholder="yourname.com"
              className="flex-1 bg-bg-subtle border border-hairline rounded-md py-2.5 px-3 text-sm outline-none focus:border-accent transition-colors font-mono"
            />
            <button
              onClick={setup}
              disabled={!domain || loading}
              className="px-4 py-2.5 rounded-md bg-accent text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
              Setup
            </button>
          </div>

          {setupResult && (
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mt-3">
              <h3 className="font-bold text-sm mb-2 flex items-center gap-1.5">
                <AlertCircle size={14} className="text-warning" /> DNS verification required
              </h3>
              <p className="text-xs text-text-secondary mb-3">Add this TXT record to your domain's DNS:</p>
              <div className="bg-bg-card rounded-md p-3 font-mono text-xs break-all flex items-center gap-2">
                <span className="flex-1">{setupResult.token}</span>
                <button onClick={() => copy(setupResult.token)} className="text-accent">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <p className="text-xs text-text-secondary mt-3 mb-2">Then click verify below. Records can take up to 48h to propagate.</p>
              <button
                onClick={() => verify(domain)}
                disabled={loading}
                className="px-3 py-1.5 rounded-md bg-text-primary text-white text-xs font-semibold flex items-center gap-1.5"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Verify now
              </button>
            </div>
          )}
        </section>

        {/* My domains */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary mb-3">My domains</h2>
          {domains.length === 0 ? (
            <p className="text-sm text-text-tertiary bg-bg-card border border-hairline rounded-xl p-4 text-center">No domains added yet</p>
          ) : (
            <div className="space-y-2">
              {domains.map((d) => (
                <div key={d.domain} className="bg-bg-card border border-hairline rounded-xl p-4 flex items-center gap-3">
                  <Globe size={18} className="text-accent flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm font-semibold">{d.domain}</p>
                    {d.verifiedAt && <p className="text-xs text-success">✓ Verified {new Date(d.verifiedAt).toLocaleDateString()}</p>}
                  </div>
                  {!d.isVerified && (
                    <button onClick={() => verify(d.domain)} className="text-xs text-accent font-semibold">Verify</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* AT Protocol resolver */}
        <section className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5">
          <h2 className="text-sm font-bold flex items-center gap-1.5 mb-2">
            <ExternalLink size={14} className="text-blue-600" /> AT Protocol handle resolver
          </h2>
          <p className="text-xs text-text-secondary mb-3">ORBIT handles resolve to did:plc on Bluesky. Resolve any handle:</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="alice.bsky.social or alice.com"
              onChange={(e) => setDomain(e.target.value)}
              className="flex-1 bg-bg-card border border-hairline rounded-md py-2 px-3 text-sm font-mono outline-none focus:border-accent"
            />
            <button onClick={() => resolve(domain)} className="px-3 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold">Resolve</button>
          </div>
          {resolving && (
            <div className="mt-3 p-3 bg-bg-card rounded-md">
              <p className="text-xs text-text-tertiary">DID</p>
              <p className="font-mono text-sm break-all">{resolving.did}</p>
              <p className="text-xs text-text-tertiary mt-2">PDS endpoint</p>
              <p className="font-mono text-sm break-all">{resolving.pdsEndpoint}</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
