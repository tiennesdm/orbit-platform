'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, Image as ImageIcon, Hash, AtSign, Smile, MapPin, Lock, Users, Globe, Sparkles, Upload, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

const MODES = [
  { id: 'intimate', label: 'Intimate', icon: Lock, color: 'bg-amber-500', desc: 'Close friends only' },
  { id: 'public', label: 'Public', icon: Globe, color: 'bg-accent', desc: 'Everyone' },
  { id: 'visual', label: 'Visual', icon: ImageIcon, color: 'bg-pink-500', desc: 'Image-led post' },
  { id: 'community', label: 'Community', icon: Users, color: 'bg-cyan-500', desc: 'Post in a group' },
] as const;

export default function ComposePage() {
  const router = useRouter();
  const [mode, setMode] = useState<typeof MODES[number]['id']>('public');
  const [text, setText] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaFile(file);
    const reader = new FileReader();
    reader.onload = () => setMediaPreview(reader.result as string);
    reader.readAsDataURL(file);
    if (mode !== 'visual') setMode('visual');
  }

  async function publish() {
    if (!text.trim() && !mediaFile) return;
    setPublishing(true);
    try {
      let mediaIds: string[] = [];
      if (mediaFile) {
        setUploading(true);
        // 1. Get presigned URL
        const presign = await fetch('/api/v1/media/presign', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('orbit_token')}`,
          },
          body: JSON.stringify({
            contentType: mediaFile.type,
            bytes: mediaFile.size,
          }),
        }).then((r) => r.json());

        if (presign.uploadUrl) {
          // S3 direct upload
          await fetch(presign.uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': mediaFile.type },
            body: mediaFile,
          });
        } else if (presign.localUploadEndpoint) {
          // Local upload fallback
          const fd = new FormData();
          fd.append('file', mediaFile);
          await fetch(presign.localUploadEndpoint, { method: 'POST', body: fd });
        }

        // 2. Register metadata
        const media = await fetch('/api/v1/media/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('orbit_token')}`,
          },
          body: JSON.stringify({
            key: presign.key,
            type: mediaFile.type.startsWith('image/') ? 'image' : mediaFile.type.startsWith('video/') ? 'video' : 'file',
            mimeType: mediaFile.type,
            bytes: mediaFile.size,
          }),
        }).then((r) => r.json());
        mediaIds = [media.id];
        setUploading(false);
      }

      await api.posts.create({
        mode,
        contentText: text || '',
        mediaIds,
      });
      router.push('/home');
    } catch (err) {
      console.error(err);
      alert('Publish failed: ' + (err as Error).message);
    } finally {
      setPublishing(false);
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-bg-elevated z-50 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-hairline">
        <button
          onClick={() => router.back()}
          className="bg-bg-subtle border-0 w-9 h-9 rounded-full text-text-secondary flex items-center justify-center"
          aria-label="Close"
        >
          <X size={16} />
        </button>
        <h1 className="font-semibold">New {MODES.find((m) => m.id === mode)?.label} post</h1>
        <button
          onClick={publish}
          disabled={(!text.trim() && !mediaFile) || publishing}
          className="bg-accent text-white px-4 py-1.5 rounded-full font-semibold text-sm disabled:opacity-50 hover:bg-accent/90 flex items-center gap-1"
        >
          {publishing && <Sparkles className="animate-pulse" size={14} />}
          {uploading ? 'Uploading…' : publishing ? 'Publishing…' : 'Post'}
        </button>
      </div>

      {/* Mode selector */}
      <div className="px-4 py-3 border-b border-hairline">
        <p className="text-xs text-text-tertiary mb-2">Post to:</p>
        <div className="grid grid-cols-4 gap-2">
          {MODES.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={clsx(
                  'flex flex-col items-center gap-1 p-2 rounded-lg border transition',
                  mode === m.id
                    ? 'border-accent bg-accent/5'
                    : 'border-hairline bg-bg-subtle hover:bg-bg-elevated',
                )}
              >
                <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center text-white', m.color)}>
                  <Icon size={14} />
                </div>
                <p className="text-[10px] font-semibold">{m.label}</p>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-text-tertiary mt-1.5 text-center">
          {MODES.find((m) => m.id === mode)?.desc}
        </p>
      </div>

      {/* Media preview */}
      {mediaPreview && (
        <div className="relative px-4 pt-3">
          <div className="relative rounded-xl overflow-hidden">
            {mediaFile?.type.startsWith('image/') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaPreview} alt="Preview" className="w-full max-h-80 object-cover" />
            ) : (
              <video src={mediaPreview} controls className="w-full max-h-80" />
            )}
            <button
              onClick={() => { setMediaFile(null); setMediaPreview(null); }}
              className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full"
              aria-label="Remove media"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="flex-1 px-4 py-3 overflow-y-auto">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            mode === 'intimate' ? 'Share with close friends…' :
            mode === 'public' ? 'What\'s on your mind?' :
            mode === 'visual' ? 'Write a caption…' :
            'Post in a community…'
          }
          maxLength={5000}
          className="w-full h-full min-h-[200px] bg-transparent border-0 resize-none focus:outline-none text-lg placeholder:text-text-tertiary"
        />
      </div>

      {/* Toolbar */}
      <div className="border-t border-hairline px-4 py-2 flex items-center gap-1">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFile}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="p-2 text-text-secondary hover:text-accent"
          aria-label="Add media"
        >
          <ImageIcon size={20} />
        </button>
        <button className="p-2 text-text-secondary hover:text-accent" aria-label="Hashtag">
          <Hash size={20} />
        </button>
        <button className="p-2 text-text-secondary hover:text-accent" aria-label="Mention">
          <AtSign size={20} />
        </button>
        <button className="p-2 text-text-secondary hover:text-accent" aria-label="Emoji">
          <Smile size={20} />
        </button>
        <button className="p-2 text-text-secondary hover:text-accent" aria-label="Location">
          <MapPin size={20} />
        </button>
        <div className="flex-1" />
        <span className="text-xs text-text-tertiary">{5000 - text.length}</span>
      </div>
    </div>
  );
}
