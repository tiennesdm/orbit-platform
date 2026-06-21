'use client';

import { useState } from 'react';
import { Sparkles, Download, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const signout = useAuth((s) => s.signout);
  const [agentState, setAgentState] = useState<any>(null);
  const [exporting, setExporting] = useState(false);

  async function loadAgentState() {
    try {
      const state = await api.ai.state();
      setAgentState(state);
    } catch (err) {
      console.error(err);
    }
  }

  async function updateAutonomy(level: 'ask' | 'suggest' | 'auto') {
    if (!agentState) return;
    const updated = await api.ai.updateState({ autonomyLevel: level });
    setAgentState(updated);
  }

  async function exportData() {
    setExporting(true);
    try {
      const data = await api.identity.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orbit-export-${user?.handle || 'data'}.json`;
      a.click();
    } finally {
      setExporting(false);
    }
  }

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto pb-24">
      <div className="px-4 pt-4">
        <h1 className="text-2xl font-extrabold letter-tight mb-4 font-display">Settings</h1>
      </div>

      {/* Wellbeing */}
      <div className="px-4 py-4 border-b border-hairline">
        <h3 className="text-2xs font-extrabold uppercase tracking-widest text-text-secondary mb-2">🧘 Wellbeing · Anti-addiction</h3>
        <SettingRow label="Daily time limit" value="60m" />
        <SettingToggle label="Quiet hours · 10pm-7am silent" defaultOn />
        <SettingToggle label="Chronological by default" description="No algorithmic manipulation" defaultOn />
        <SettingToggle label="No infinite scroll" defaultOn />
        <SettingToggle label="No autoplay videos" defaultOn />
        <SettingToggle label="No streaks / no FOMO" defaultOn />
        <SettingToggle label="Weekly wellbeing report" defaultOn />
      </div>

      {/* AI Agent */}
      <div className="px-4 py-4 border-b border-hairline">
        <h3 className="text-2xs font-extrabold uppercase tracking-widest text-text-secondary mb-2">🤖 Your AI Agent</h3>
        <button
          onClick={loadAgentState}
          className="text-accent text-sm font-semibold mb-2 hover:underline"
        >
          Load AI settings
        </button>
        {agentState && (
          <>
            <div className="flex items-center justify-between py-2.5">
              <div>
                <div className="text-sm font-semibold">Autonomy level</div>
                <div className="text-xs text-text-secondary mt-0.5">Ask first · Suggest · Auto-act</div>
              </div>
              <select
                value={agentState.autonomyLevel}
                onChange={(e) => updateAutonomy(e.target.value as any)}
                className="text-sm font-bold text-accent bg-bg-subtle px-3 py-1 rounded-full"
              >
                <option value="ask">Ask</option>
                <option value="suggest">Suggest</option>
                <option value="auto">Auto</option>
              </select>
            </div>
            <SettingToggle label="DM auto-replies" />
            <SettingToggle label="Spam auto-block" description="Verified humans only" defaultOn />
            <SettingToggle label="Cross-agent comms" defaultOn />
          </>
        )}
      </div>

      {/* Privacy */}
      <div className="px-4 py-4 border-b border-hairline">
        <h3 className="text-2xs font-extrabold uppercase tracking-widest text-text-secondary mb-2">🔒 Privacy & Data</h3>
        <SettingToggle label="End-to-end encryption" description="Intimate mode always E2E" defaultOn />
        <SettingToggle label="Two-factor required" defaultOn />
        <button
          onClick={exportData}
          disabled={exporting}
          className="w-full flex items-center justify-between py-2.5 text-left"
        >
          <div>
            <div className="text-sm font-semibold flex items-center gap-2">
              <Download size={14} />
              Export your data
            </div>
            <div className="text-xs text-text-secondary mt-0.5">Full archive · ZIP / JSON</div>
          </div>
          <span className="text-text-tertiary">›</span>
        </button>
        <button className="w-full flex items-center justify-between py-2.5 text-left">
          <div>
            <div className="text-sm font-semibold">Move to another app</div>
            <div className="text-xs text-text-secondary mt-0.5">Take your graph with you</div>
          </div>
          <span className="text-text-tertiary">›</span>
        </button>
      </div>

      {/* Account */}
      <div className="px-4 py-4">
        <button
          onClick={() => { signout(); router.push('/onboarding'); }}
          className="w-full py-3 rounded-md bg-bg-subtle text-text-primary font-semibold text-sm flex items-center justify-center gap-2 hover:bg-bg-cream"
        >
          <LogOut size={16} /> Sign out
        </button>
        <button className="w-full py-3 mt-2 text-danger text-sm font-bold">
          Delete account (portable vault stays)
        </button>
      </div>

      <div className="px-4 py-6 text-center text-2xs text-text-tertiary tracking-wider">
        ORBIT v0.1.0 · Made with ❤️ · Your data is yours
      </div>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="text-sm font-semibold">{label}</div>
      <span className="text-sm font-bold text-accent">{value}</span>
    </div>
  );
}

function SettingToggle({ label, description, defaultOn = false }: { label: string; description?: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between py-2.5">
      <div>
        <div className="text-sm font-semibold">{label}</div>
        {description && <div className="text-xs text-text-secondary mt-0.5">{description}</div>}
      </div>
      <button
        onClick={() => setOn(!on)}
        className={`toggle ${on ? 'on' : ''}`}
      />
    </div>
  );
}
