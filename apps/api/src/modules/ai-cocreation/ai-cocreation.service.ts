/**
 * AI Co-Creation — text, image, video, caption, audio generation
 *
 * Provider abstraction:
 * - Anthropic (text, captions)
 * - Replicate / Stable Diffusion (images)
 * - Runway / Pika (video)
 * - ElevenLabs (audio/voice)
 *
 * In dev: returns mock asset URLs. In prod: wire up the providers.
 */

import { Injectable, Logger } from '@nestjs/common';
import { getVedadbPool } from '@orbit/db';
import { v4 as uuid } from 'uuid';

export type AssetKind = 'text' | 'caption' | 'image' | 'video' | 'audio';

@Injectable()
export class AiCocreationService {
  private readonly db; private readonly logger = new Logger(AiCocreationService.name);

  constructor() { this.db = getVedadbPool(); }

  /**
   * Generate text/caption/voiceover. Model: user's voice profile.
   */
  async generateText(opts: { ownerDid: string; prompt: string; voice?: string; maxTokens?: number }): Promise<{ id: string; content: string }> {
    const id = uuid();
    // In production: call Anthropic API
    // For dev: simple template-based response
    const content = this.mockText(opts.prompt, opts.voice);
    await this.db.query(
      `INSERT INTO ai_assets (id, owner_did, kind, prompt, meta) VALUES ($1, $2, 'text', $3, $4)`,
      [id, opts.ownerDid, opts.prompt, JSON.stringify({ voice: opts.voice, content })]
    );
    this.logger.log(`🤖 text: ${opts.ownerDid} → ${id}`);
    return { id, content };
  }

  async generateCaptions(opts: { ownerDid: string; topic: string; tone?: string; count?: number }): Promise<{ id: string; captions: string[] }> {
    const id = uuid();
    const count = Math.min(opts.count || 5, 10);
    const captions = Array.from({ length: count }, (_, i) => this.mockCaption(opts.topic, opts.tone, i));
    await this.db.query(
      `INSERT INTO ai_assets (id, owner_did, kind, prompt, meta) VALUES ($1, $2, 'caption', $3, $4)`,
      [id, opts.ownerDid, opts.topic, JSON.stringify({ tone: opts.tone, captions })]
    );
    return { id, captions };
  }

  async generateImage(opts: { ownerDid: string; prompt: string; style?: string; size?: 'square' | 'portrait' | 'landscape' }): Promise<{ id: string; url: string; prompt: string }> {
    const id = uuid();
    // In production: call Replicate w/ SDXL or OpenAI DALL-E
    // For dev: return a placeholder URL
    const url = `https://placehold.co/1024x1024/4338CA/FFFFFF?text=${encodeURIComponent(opts.prompt.slice(0, 40))}`;
    await this.db.query(
      `INSERT INTO ai_assets (id, owner_did, kind, prompt, url, meta) VALUES ($1, $2, 'image', $3, $4, $5)`,
      [id, opts.ownerDid, opts.prompt, url, JSON.stringify({ style: opts.style, size: opts.size || 'square' })]
    );
    this.logger.log(`🎨 image: ${opts.ownerDid} → ${id} (${opts.prompt.slice(0, 30)}…)`);
    return { id, url, prompt: opts.prompt };
  }

  async generateVideo(opts: { ownerDid: string; prompt: string; durationSec?: number }): Promise<{ id: string; url: string; durationSec: number }> {
    const id = uuid();
    // In production: Runway / Pika / Sora
    const url = `https://placehold.co/720x1280/0F0F12/FFFFFF?text=AI+Video+${id.slice(0, 6)}`;
    const duration = opts.durationSec || 6;
    await this.db.query(
      `INSERT INTO ai_assets (id, owner_did, kind, prompt, url, meta) VALUES ($1, $2, 'video', $3, $4, $5)`,
      [id, opts.ownerDid, opts.prompt, url, JSON.stringify({ durationSec: duration })]
    );
    this.logger.log(`🎬 video: ${opts.ownerDid} → ${id} (${duration}s)`);
    return { id, url, durationSec: duration };
  }

  async generateAudio(opts: { ownerDid: string; text: string; voice?: string }): Promise<{ id: string; url: string }> {
    const id = uuid();
    const url = `https://placehold.co/audio/${id}.mp3`; // ElevenLabs etc
    await this.db.query(
      `INSERT INTO ai_assets (id, owner_did, kind, prompt, url, meta) VALUES ($1, $2, 'audio', $3, $4, $5)`,
      [id, opts.ownerDid, opts.text, url, JSON.stringify({ voice: opts.voice || 'default' })]
    );
    return { id, url };
  }

  async listMyAssets(ownerDid: string, kind?: AssetKind, limit = 50) {
    const res = await this.db.query<any>(
      `SELECT id, kind, prompt, url, meta, created_at as "createdAt"
       FROM ai_assets WHERE owner_did = $1 ${kind ? 'AND kind = $2' : ''}
       ORDER BY created_at DESC LIMIT ${kind ? '$3' : '$2'}`,
      kind ? [ownerDid, kind, limit] : [ownerDid, limit]
    );
    return res.rows;
  }

  /**
   * Suggest hashtags and mentions for a draft post
   */
  async suggestHashtags(opts: { ownerDid: string; content: string; count?: number }): Promise<{ hashtags: string[]; mentions: string[] }> {
    const count = Math.min(opts.count || 5, 15);
    // Mock: extract words + suggest variations
    const words = opts.content.toLowerCase().split(/\W+/).filter(w => w.length > 4);
    const hashtags = words.slice(0, count).map(w => `#${w}`);
    return { hashtags, mentions: [] };
  }

  // Mocks for dev
  private mockText(prompt: string, voice?: string): string {
    return `${voice === 'casual' ? 'Hey, just thinking...' : voice === 'thoughtful' ? 'A reflection on' : 'Quick take:'} ${prompt.slice(0, 200)}... What do you think?`;
  }

  private mockCaption(topic: string, tone: string | undefined, idx: number): string {
    const tones: Record<string, string[]> = {
      default: [
        `Thinking about ${topic} lately...`,
        `Hot take on ${topic}:`,
        `${topic} is more interesting than people think. Here's why:`,
        `Some thoughts on ${topic} that I can't shake.`,
        `If you're into ${topic}, this is for you.`,
      ],
      professional: [
        `Key insight on ${topic} for the industry:`,
        `5 things I've learned about ${topic} this year:`,
        `Why ${topic} matters in 2026:`,
        `The future of ${topic} is being written right now.`,
        `Lessons from building with ${topic}:`,
      ],
      casual: [
        `okay but why is no one talking about ${topic}??`,
        `${topic} is sending me tbh`,
        `me: i'll just look at ${topic} for 5 min. also me: 2 hours later`,
        `${topic} hits different today`,
        `the ${topic} rabbit hole is real`,
      ],
    };
    const list = tones[tone || 'default'] || tones.default;
    return list[idx % list.length];
  }
}
