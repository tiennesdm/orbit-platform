'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Loader2, Wand2, Image as ImageIcon, Video, Type, Music, Hash, Copy, Check, ArrowRight, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export default function AiCocreatePage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const hasHydrated = useAuth((s) => s.hasHydrated);
  const [tab, setTab] = useState<'text' | 'caption' | 'image' | 'video' | 'audio' | 'hashtags'>('caption');
  const [prompt, setPrompt] = useState('');
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('default');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    if (hasHydrated && !user) router.push('/login');
  }, [user, hasHydrated, router]);

  if (!hasHydrated || !user) return <div className="min-h-screen bg-bg-elevated" />;

  async function generate() {
    setLoading(true);
    setResults(null);
    try {
      let res;
      if (tab === 'caption') {
        res = await (api as any).aiGenerateCaptions({ topic, tone, count: 5 });
        setResults(res);
      } else if (tab === 'text') {
        res = await (api as any).aiGenerateText({ prompt });
        setResults({ content: res.content });
      } else if (tab === 'image') {
        res = await (api as any).aiGenerateImage({ prompt, size: 'square' });
        setResults({ url: res.url, prompt: res.prompt });
      } else if (tab === 'video') {
        res = await (api as any).aiGenerateVideo({ prompt, durationSec: 6 });
        setResults({ url: res.url, durationSec: res.durationSec });
      } else if (tab === 'audio') {
        res = await (api as any).aiGenerateAudio({ text: prompt });
        setResults({ url: res.url });
      } else if (tab === 'hashtags') {
        res = await (api as any).aiSuggestHashtags(prompt);
        setResults({ hashtags: res.hashtags });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function copy(text: string, idx: number) {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="min-h-screen bg-bg-elevated pb-20">
      <header className="sticky top-0 z-30 bg-bg-elevated/90 backdrop-blur-md border-b border-hairline">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-bg-subtle hover:bg-bg-cream flex items-center justify-center text-text-primary transition-colors">
            <ArrowRight size={18} className="rotate-180" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-extrabold text-xl tracking-tight flex items-center gap-2">
              <Wand2 size={18} className="text-ai" /> AI Co-Create
            </h1>
            <p className="text-xs text-text-tertiary">Generate text, captions, images, video, audio</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-2xl mx-auto flex gap-1 px-4 pb-3 overflow-x-auto scrollbar-hidden">
          {([
            { id: 'caption', label: 'Captions', icon: Type },
            { id: 'text', label: 'Long text', icon: Type },
            { id: 'image', label: 'Image', icon: ImageIcon },
            { id: 'video', label: 'Video', icon: Video },
            { id: 'audio', label: 'Audio', icon: Music },
            { id: 'hashtags', label: 'Hashtags', icon: Hash },
          ] as const).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => { setTab(t.id as any); setResults(null); }}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  tab === t.id ? 'bg-text-primary text-white' : 'bg-bg-subtle text-text-secondary hover:text-text-primary'
                }`}
              >
                <Icon size={12} /> {t.label}
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {tab === 'caption' && (
          <>
            <div>
              <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Topic or idea</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. AI in 2026, Morning routine, New design system"
                className="w-full bg-bg-card border border-hairlineStrong rounded-md py-3 px-4 text-sm outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Tone</label>
              <div className="flex gap-2 flex-wrap">
                {['default', 'professional', 'casual', 'thoughtful'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      tone === t ? 'border-accent bg-accent/10 text-accent' : 'border-hairline text-text-secondary'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {tab !== 'caption' && (
          <div>
            <label className="text-xs font-semibold text-text-secondary mb-1.5 block">
              {tab === 'text' ? 'What should the AI write?' : tab === 'image' ? 'Describe the image' : tab === 'video' ? 'Describe the video' : tab === 'audio' ? 'Text to convert to audio' : 'Post content'}
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder={tab === 'image' ? 'A purple sunset over the ocean, anime style' : tab === 'video' ? 'A cat walking through a garden' : tab === 'audio' ? 'Hello world, this is a test' : 'Your post content here...'}
              className="w-full bg-bg-card border border-hairlineStrong rounded-md py-3 px-4 text-sm outline-none focus:border-accent transition-colors resize-none"
            />
          </div>
        )}

        <button
          onClick={generate}
          disabled={loading || (!topic && !prompt)}
          className="w-full py-4 bg-gradient-to-r from-accent to-ai text-white rounded-md font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
          {loading ? 'Generating…' : 'Generate'}
        </button>

        {results && (
          <div className="space-y-3 mt-4">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Results</h3>
            {results.captions?.map((c: string, i: number) => (
              <button
                key={i}
                onClick={() => copy(c, i)}
                className="w-full bg-bg-card border border-hairline rounded-xl p-4 text-left hover:border-hairlineStrong transition-colors flex items-start gap-3"
              >
                <span className="w-7 h-7 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <p className="flex-1 text-sm leading-relaxed">{c}</p>
                {copied === i ? <Check size={14} className="text-success flex-shrink-0" /> : <Copy size={14} className="text-text-tertiary flex-shrink-0" />}
              </button>
            )) || null}
            {results.content && (
              <div className="bg-bg-card border border-hairline rounded-xl p-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{results.content}</p>
                <button onClick={() => copy(results.content, 0)} className="mt-3 text-xs text-accent flex items-center gap-1">
                  {copied === 0 ? <Check size={12} /> : <Copy size={12} />}
                  {copied === 0 ? 'Copied' : 'Copy'}
                </button>
              </div>
            )}
            {results.url && tab === 'image' && (
              <div className="bg-bg-card border border-hairline rounded-xl overflow-hidden">
                <img src={results.url} alt={results.prompt} className="w-full aspect-square object-cover" />
                <div className="p-3">
                  <p className="text-xs text-text-tertiary">{results.prompt}</p>
                </div>
              </div>
            )}
            {results.url && tab === 'video' && (
              <div className="bg-bg-card border border-hairline rounded-xl p-4 text-center">
                <Video size={48} className="mx-auto text-ai mb-2" />
                <p className="text-sm font-mono">{results.url}</p>
                <p className="text-xs text-text-tertiary mt-1">{results.durationSec}s video</p>
              </div>
            )}
            {results.url && tab === 'audio' && (
              <div className="bg-bg-card border border-hairline rounded-xl p-4 text-center">
                <Music size={48} className="mx-auto text-accent mb-2" />
                <p className="text-sm font-mono">{results.url}</p>
                <p className="text-xs text-text-tertiary mt-1">Audio clip</p>
              </div>
            )}
            {results.hashtags && (
              <div className="bg-bg-card border border-hairline rounded-xl p-4">
                <div className="flex flex-wrap gap-2">
                  {results.hashtags.map((h: string, i: number) => (
                    <button
                      key={i}
                      onClick={() => copy(h, i)}
                      className="px-3 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-semibold hover:bg-accent/20 transition-colors flex items-center gap-1"
                    >
                      {h}
                      {copied === i ? <Check size={10} /> : <Copy size={10} />}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button onClick={generate} className="w-full py-2 text-sm text-text-secondary hover:text-text-primary flex items-center justify-center gap-1.5">
              <RefreshCw size={12} /> Regenerate
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
