/**
 * Moderation Service
 * - AI pre-upload scanning (Llama Guard + custom classifiers)
 * - User reports + manual review queue
 * - Auto-action thresholds (NSFW, toxicity, spam)
 * - DSA/DFA compliance: transparency reports
 */

import { Injectable } from '@nestjs/common';
import { getVedadbPool } from '@orbit/db';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ModerationService {
  private readonly db = getVedadbPool();
  private readonly toxicityThreshold = 0.85;
  private readonly nsfwThreshold = 0.90;

  constructor(private readonly config: ConfigService) {}

  /**
   * Score content for moderation
   * Returns: { toxicity, nsfw, spam, action }
   */
  async scoreContent(input: { text?: string; imageUrls?: string[]; userId: string }): Promise<ModerationResult> {
    // In production: call Llama Guard API for text, CLIP/custom classifier for images
    // For MVP: simple keyword-based heuristics
    const toxicKeywords = ['kill', 'attack', 'hate'];
    const nsfwKeywords = ['nsfw'];

    const text = (input.text || '').toLowerCase();
    const toxicityScore = toxicKeywords.filter((k) => text.includes(k)).length > 0 ? 0.6 : 0.05;
    const nsfwScore = nsfwKeywords.filter((k) => text.includes(k)).length > 0 ? 0.7 : 0.02;
    const spamScore = this.detectSpam(text);

    const action = this.determineAction(toxicityScore, nsfwScore, spamScore);

    return {
      toxicityScore,
      nsfwScore,
      spamScore,
      action,
      flags: this.collectFlags(toxicityScore, nsfwScore, spamScore),
    };
  }

  async report(input: {
    reporterId: string;
    targetType: 'post' | 'user' | 'reel' | 'story' | 'message';
    targetId: string;
    reason: string;
    description?: string;
  }) {
    // Map target_type enum to smallint (per schema: reports.target_type is smallint)
    const targetTypeMap: Record<string, number> = { post: 1, user: 2, reel: 3, story: 4, message: 5 };
    const targetTypeInt = targetTypeMap[input.targetType] ?? 0;
    // target_id is bigint — pass as string (pg driver converts)
    await this.db.query(
      `INSERT INTO reports (reporter_id, target_type, target_id, reason, description)
       VALUES ($1, $2, $3, $4, $5)`,
      [input.reporterId, targetTypeInt, input.targetId, input.reason, input.description]
    );

    // Auto-classify
    const classification = await this.classifyReport(input);

    return { success: true, classification };
  }

  private async classifyReport(input: any) {
    return { category: 'review_needed', priority: 'normal' };
  }

  private detectSpam(text: string): number {
    // Simple heuristics
    const urlCount = (text.match(/https?:\/\//g) || []).length;
    const repeatedChars = /(.)\1{4,}/.test(text);
    const allCaps = text.length > 10 && text === text.toUpperCase();
    let score = 0;
    if (urlCount > 2) score += 0.3;
    if (repeatedChars) score += 0.4;
    if (allCaps) score += 0.2;
    return Math.min(score, 1);
  }

  private determineAction(toxicity: number, nsfw: number, spam: number): 'allow' | 'flag' | 'hide' | 'remove' {
    if (toxicity > this.toxicityThreshold || nsfw > this.nsfwThreshold) return 'remove';
    if (toxicity > 0.6 || nsfw > 0.7 || spam > 0.7) return 'hide';
    if (toxicity > 0.4 || nsfw > 0.5 || spam > 0.5) return 'flag';
    return 'allow';
  }

  private collectFlags(toxicity: number, nsfw: number, spam: number): string[] {
    const flags: string[] = [];
    if (toxicity > 0.4) flags.push('potentially_toxic');
    if (nsfw > 0.5) flags.push('potentially_nsfw');
    if (spam > 0.5) flags.push('potentially_spam');
    return flags;
  }
}

export interface ModerationResult {
  toxicityScore: number;
  nsfwScore: number;
  spamScore: number;
  action: 'allow' | 'flag' | 'hide' | 'remove';
  flags: string[];
}
