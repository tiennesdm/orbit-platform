'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Bot, Shield, Eye, Bell, Download, Trash2, Key, Globe, ChevronRight, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

type Section = 'profile' | 'agent' | 'privacy' | 'safety' | 'notifications' | 'data';

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [section, setSection] = useState<Section | null>(null);
  const [agentState, setAgentState] = useState<any>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.aiAgent.state().then(setAgentState).catch(() => {});
  }, []);

  async function exportData() {
    setExporting(true);
    try {
      const res = await fetch('/api/v1/gdpr/export', {
        headers: { Authorization: `Bearer ${localStorage.getItem('orbit_token')}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `orbit-export-${user?.did || 'me'}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        alert('Export failed');
      }
    } catch (err) {
      alert('Export failed: ' + (err as Error).message);
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    if (!confirm('This will soft-delete your account with a 30-day grace period. You can cancel within 30 days by logging in again. Continue?')) {
      return;
    }
    try {
      const res = await fetch('/api/v1/gdpr/delete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('orbit_token')}` },
      });
      if (res.ok) {
        alert('Account scheduled for deletion. You have 30 days to cancel by logging in.');
        logout();
        router.push('/onboarding');
      } else {
        alert('Delete failed');
      }
    } catch (err) {
      alert('Delete failed: ' + (err as Error).message);
    }
  }

  async function updateAgentState(updates: any) {
    const newState = { ...agentState, ...updates };
    setAgentState(newState);
    await fetch('/api/v1/ai-agent/state', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('orbit_token')}`,
      },
      body: JSON.stringify(updates),
    });
  }

  if (section === 'profile') {
    return <ProfileSection onBack={() => setSection(null)} />;
  }
  if (section === 'agent') {
    return (
      <AgentSection
        state={agentState}
        onUpdate={updateAgentState}
        onBack={() => setSection(null)}
      />
    );
  }
  if (section === 'privacy') {
    return <PrivacySection onBack={() => setSection(null)} />;
  }
  if (section === 'safety') {
    return <SafetySection onBack={() => setSection(null)} />;
  }
  if (section === 'notifications') {
    return <NotificationsSection onBack={() => setSection(null)} />;
  }
  if (section === 'data') {
    return (
      <DataSection
        onBack={() => setSection(null)}
        onExport={exportData}
        onDelete={deleteAccount}
        exporting={exporting}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-24">
      <div className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-hairline px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">Settings</h1>
      </div>

      <div className="p-4 space-y-1">
        <SectionButton
          icon={<User size={20} />}
          title="Profile"
          subtitle="Display name, handle, bio, avatar"
          onClick={() => setSection('profile')}
        />
        <SectionButton
          icon={<Bot size={20} className="text-ai" />}
          title="AI Agent"
          subtitle={agentState ? `${agentState.autonomyLevel} · ${agentState.personality}` : 'Loading…'}
          onClick={() => setSection('agent')}
        />
        <SectionButton
          icon={<Shield size={20} className="text-green-600" />}
          title="Privacy"
          subtitle="Identity, blocked accounts, DMs"
          onClick={() => setSection('privacy')}
        />
        <SectionButton
          icon={<Eye size={20} />}
          title="Safety & Anti-addiction"
          subtitle="Usage limits, hide counts, no infinite scroll"
          onClick={() => setSection('safety')}
        />
        <SectionButton
          icon={<Bell size={20} />}
          title="Notifications"
          subtitle="Push, email, digest"
          onClick={() => setSection('notifications')}
        />
        <SectionButton
          icon={<Key size={20} />}
          title="Portable Identity"
          subtitle="Export your DID, switch PDS provider"
          onClick={() => setSection('data')}
        />
        <SectionButton
          icon={<Download size={20} />}
          title="Data & Privacy (GDPR)"
          subtitle="Export, download, delete"
          onClick={() => setSection('data')}
        />
      </div>
    </div>
  );
}

function SectionButton({
  icon, title, subtitle, onClick, danger,
}: {
  icon: React.ReactNode; title: string; subtitle: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 hover:bg-bg-subtle rounded-lg text-left"
    >
      <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center', danger ? 'bg-red-50 text-red-600' : 'bg-bg-subtle')}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={clsx('font-semibold text-sm', danger && 'text-red-600')}>{title}</p>
        <p className="text-xs text-text-tertiary truncate">{subtitle}</p>
      </div>
      <ChevronRight size={18} className="text-text-tertiary" />
    </button>
  );
}

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-hairline px-4 py-3 flex items-center gap-3">
      <button onClick={onBack} aria-label="Back">
        <ArrowLeft size={20} />
      </button>
      <h1 className="text-lg font-bold">{title}</h1>
    </div>
  );
}

function ProfileSection({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  return (
    <div className="max-w-2xl mx-auto">
      <BackHeader title="Profile" onBack={onBack} />
      <div className="p-4 space-y-4">
        <Field label="Display name" value={user?.displayName || ''} />
        <Field label="Handle" value={user?.handle || ''} prefix="@" />
        <Field label="DID" value={user?.did || ''} readOnly />
        <Field label="Bio" value="" multiline placeholder="Tell people about yourself…" />
        <Field label="Avatar" value="" type="avatar" />
        <Field label="Cover photo" value="" type="cover" />
      </div>
    </div>
  );
}

function AgentSection({ state, onUpdate, onBack }: { state: any; onUpdate: (u: any) => void; onBack: () => void }) {
  if (!state) return <BackHeader title="AI Agent" onBack={onBack} />;
  return (
    <div className="max-w-2xl mx-auto">
      <BackHeader title="AI Agent" onBack={onBack} />
      <div className="p-4 space-y-6">
        <div className="p-4 bg-ai/5 border border-ai/20 rounded-lg">
          <p className="text-sm text-text-secondary">
            Your AI agent lives in your DMs, surfaces relevant content, and helps you post.
            It only sees what you allow.
          </p>
        </div>

        <section>
          <h2 className="text-sm font-semibold mb-2">Autonomy level</h2>
          {(['ask', 'suggest', 'auto'] as const).map((level) => (
            <label
              key={level}
              className={clsx(
                'flex items-start gap-3 p-3 mb-2 rounded-lg cursor-pointer border',
                state.autonomyLevel === level ? 'border-ai bg-ai/5' : 'border-hairline',
              )}
            >
              <input
                type="radio"
                name="autonomy"
                checked={state.autonomyLevel === level}
                onChange={() => onUpdate({ autonomyLevel: level })}
                className="mt-1"
              />
              <div>
                <p className="font-semibold text-sm capitalize">{level}</p>
                <p className="text-xs text-text-tertiary">
                  {level === 'ask' && 'Asks before any action. Just suggests things.'}
                  {level === 'suggest' && 'Suggests actions, you confirm before they happen.'}
                  {level === 'auto' && 'Takes action autonomously when you clearly want it.'}
                </p>
              </div>
            </label>
          ))}
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-2">Personality</h2>
          {(['supportive', 'witty', 'professional', 'playful'] as const).map((p) => (
            <label
              key={p}
              className={clsx(
                'flex items-center gap-3 p-3 mb-2 rounded-lg cursor-pointer border',
                state.personality === p ? 'border-ai bg-ai/5' : 'border-hairline',
              )}
            >
              <input
                type="radio"
                name="personality"
                checked={state.personality === p}
                onChange={() => onUpdate({ personality: p })}
              />
              <p className="font-semibold text-sm capitalize">{p}</p>
            </label>
          ))}
        </section>

        <p className="text-xs text-text-tertiary text-center">
          {state.liveMode ? '🟢 Live — connected to Claude' : '🟡 Echo mode — set ANTHROPIC_API_KEY for real responses'}
        </p>
      </div>
    </div>
  );
}

function PrivacySection({ onBack }: { onBack: () => void }) {
  return (
    <div className="max-w-2xl mx-auto">
      <BackHeader title="Privacy" onBack={onBack} />
      <div className="p-4 space-y-3">
        <Toggle label="Allow DMs from non-followers" />
        <Toggle label="Show online status" defaultChecked />
        <Toggle label="Allow search engines to index my profile" />
        <Toggle label="Read receipts in DMs" defaultChecked />
        <Toggle label="Show my follow list" defaultChecked />
        <Toggle label="Discoverable in search" defaultChecked />
      </div>
    </div>
  );
}

function SafetySection({ onBack }: { onBack: () => void }) {
  return (
    <div className="max-w-2xl mx-auto">
      <BackHeader title="Safety & Anti-addiction" onBack={onBack} />
      <div className="p-4 space-y-3">
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
          ✓ ORBIT uses chronological feeds by default. No infinite scroll. No algorithm manipulating your attention.
        </div>
        <Toggle label="Hide like counts from my posts" />
        <Toggle label="Hide follower counts on my profile" />
        <Toggle label="Daily usage limit (30 min)" />
        <Toggle label="Show usage stats" defaultChecked />
        <Toggle label="Block screenshots of my posts" />
        <Toggle label="Mute notifications after 9pm" />
      </div>
    </div>
  );
}

function NotificationsSection({ onBack }: { onBack: () => void }) {
  return (
    <div className="max-w-2xl mx-auto">
      <BackHeader title="Notifications" onBack={onBack} />
      <div className="p-4 space-y-3">
        <Toggle label="Push notifications" defaultChecked />
        <Toggle label="Email digest (daily)" defaultChecked />
        <Toggle label="Mentions" defaultChecked />
        <Toggle label="Likes" defaultChecked />
        <Toggle label="New followers" defaultChecked />
        <Toggle label="Replies" defaultChecked />
        <Toggle label="AI digest" defaultChecked />
      </div>
    </div>
  );
}

function DataSection({ onBack, onExport, onDelete, exporting }: { onBack: () => void; onExport: () => void; onDelete: () => void; exporting: boolean }) {
  return (
    <div className="max-w-2xl mx-auto">
      <BackHeader title="Data & Privacy" onBack={onBack} />
      <div className="p-4 space-y-4">
        <section className="p-4 bg-bg-subtle rounded-lg">
          <h3 className="font-semibold mb-1">Portable Identity (DID)</h3>
          <p className="text-xs text-text-tertiary mb-2">
            Your identity is portable. Take it to any PDS provider, or self-host.
          </p>
          <button className="text-sm text-accent font-semibold flex items-center gap-1">
            <Globe size={14} /> View DID document
          </button>
        </section>

        <section className="p-4 bg-bg-subtle rounded-lg">
          <h3 className="font-semibold mb-1">Export your data</h3>
          <p className="text-xs text-text-tertiary mb-3">
            Download everything in a portable JSON archive. Includes posts, DMs (decrypted), follows, AI memory.
          </p>
          <button
            onClick={onExport}
            disabled={exporting}
            className="bg-accent text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2"
          >
            <Download size={16} />
            {exporting ? 'Preparing export…' : 'Download my data (JSON)'}
          </button>
        </section>

        <section className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="font-semibold mb-1 text-red-700 flex items-center gap-2">
            <AlertTriangle size={16} />
            Delete account
          </h3>
          <p className="text-xs text-red-700 mb-3">
            Soft-delete with 30-day grace. Cancelable by logging in again.
            After 30 days, all data is permanently removed.
          </p>
          <button
            onClick={onDelete}
            className="bg-red-600 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-red-700 flex items-center gap-2"
          >
            <Trash2 size={16} />
            Request account deletion
          </button>
        </section>
      </div>
    </div>
  );
}

function Field({ label, value, readOnly, prefix, multiline, placeholder, type }: { label: string; value: string; readOnly?: boolean; prefix?: string; multiline?: boolean; placeholder?: string; type?: 'avatar' | 'cover' }) {
  if (type === 'avatar') {
    return (
      <div>
        <label className="text-xs text-text-tertiary">{label}</label>
        <div className="mt-1 flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent to-ai" />
          <button className="text-sm text-accent font-semibold">Change avatar</button>
        </div>
      </div>
    );
  }
  if (type === 'cover') {
    return (
      <div>
        <label className="text-xs text-text-tertiary">{label}</label>
        <div className="mt-1 h-24 rounded-lg bg-gradient-to-r from-accent/40 to-ai/40 flex items-end p-2">
          <button className="text-sm text-text-secondary font-semibold">Change cover</button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <label className="text-xs text-text-tertiary">{label}</label>
      <div className="mt-1">
        {multiline ? (
          <textarea
            defaultValue={value}
            placeholder={placeholder}
            readOnly={readOnly}
            className="w-full bg-bg-subtle border border-hairline rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 min-h-[80px]"
          />
        ) : (
          <div className="relative">
            {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">{prefix}</span>}
            <input
              type="text"
              defaultValue={value}
              placeholder={placeholder}
              readOnly={readOnly}
              className={clsx(
                'w-full bg-bg-subtle border border-hairline rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40',
                prefix && 'pl-7',
                readOnly && 'opacity-60',
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Toggle({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  const [on, setOn] = useState(!!defaultChecked);
  return (
    <label className="flex items-center justify-between p-3 bg-bg-subtle rounded-lg cursor-pointer">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        onClick={() => setOn(!on)}
        className={clsx(
          'w-11 h-6 rounded-full transition relative',
          on ? 'bg-accent' : 'bg-bg-elevated border border-hairline',
        )}
        aria-pressed={on}
      >
        <span
          className={clsx(
            'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition',
            on ? 'left-5' : 'left-0.5',
          )}
        />
      </button>
    </label>
  );
}
