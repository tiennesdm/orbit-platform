/**
 * Creator Monetization — tips, subscriptions, paid posts
 * Mock payment gateway (UPI/Razorpay) — swap interface for production
 */

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { getVedadbPool } from '@orbit/db';
import { v4 as uuid } from 'uuid';

export interface Tip {
  id: string;
  fromDid: string;
  toDid: string;
  amountPaise: number;
  currency: string;
  message?: string;
  postId?: string;
  status: 'pending' | 'completed' | 'refunded' | 'failed';
  createdAt: string;
}

export interface SubscriptionTier {
  id: string;
  creatorDid: string;
  name: string;
  description?: string;
  amountPaise: number;
  currency: string;
  color?: string;
  benefits: string[];
  position: number;
}

export interface Subscription {
  id: string;
  subscriberDid: string;
  creatorDid: string;
  tierId: string;
  amountPaise: number;
  currency: string;
  status: 'active' | 'paused' | 'cancelled' | 'expired';
  startedAt: string;
  renewsAt: string;
}

@Injectable()
export class MonetizationService {
  private readonly db; private readonly logger = new Logger(MonetizationService.name);

  constructor() { this.db = getVedadbPool(); }

  // ============= TIPS =============
  async sendTip(opts: { fromDid: string; toDid: string; amountPaise: number; message?: string; postId?: string }): Promise<Tip> {
    if (opts.amountPaise < 100) throw new BadRequestException('Minimum tip is ₹1 (100 paise)');
    if (opts.amountPaise > 10000000) throw new BadRequestException('Maximum tip is ₹100,000 (10M paise)');
    if (opts.fromDid === opts.toDid) throw new BadRequestException('Cannot tip yourself');

    const id = uuid();
    // In production: create payment intent via Razorpay
    const paymentRef = `tip_${id.slice(0, 16)}`;

    await this.db.query(
      `INSERT INTO tips (id, from_did, to_did, amount_paise, currency, message, post_id, status, payment_ref)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', $8)`,
      [id, opts.fromDid, opts.toDid, opts.amountPaise, 'INR', opts.message || null, opts.postId || null, paymentRef]
    );

    this.logger.log(`💸 tip: ${opts.fromDid} → ${opts.toDid} ₹${opts.amountPaise / 100}`);

    return {
      id, fromDid: opts.fromDid, toDid: opts.toDid, amountPaise: opts.amountPaise,
      currency: 'INR', message: opts.message, postId: opts.postId,
      status: 'completed', createdAt: new Date().toISOString(),
    };
  }

  async listTipsForCreator(creatorDid: string, limit = 50): Promise<Tip[]> {
    const res = await this.db.query<any>(
      `SELECT id, from_did as "fromDid", to_did as "toDid", amount_paise as "amountPaise",
              currency, message, post_id as "postId", status, created_at as "createdAt"
       FROM tips WHERE to_did = $1 ORDER BY created_at DESC LIMIT $2`,
      [creatorDid, limit]
    );
    return res.rows;
  }

  async getCreatorEarnings(creatorDid: string) {
    const res = await this.db.query<any>(
      `SELECT
         COALESCE(SUM(amount_paise) FILTER (WHERE status = 'completed'), 0) as total_tips_paise,
         COUNT(*) FILTER (WHERE status = 'completed') as tip_count
       FROM tips WHERE to_did = $1`,
      [creatorDid]
    );
    const subsRes = await this.db.query<any>(
      `SELECT
         COALESCE(SUM(price_cents), 0) as monthly_cents,
         COUNT(*) as subscriber_count
       FROM subscriptions WHERE creator_id = $1 AND is_active = true`,
      [creatorDid]
    );
    return {
      totalTipsPaise: parseInt(res.rows[0]?.total_tips_paise || 0, 10),
      tipCount: parseInt(res.rows[0]?.tip_count || 0, 10),
      monthlyPaise: parseInt(subsRes.rows[0]?.monthly_cents || 0, 10),
      subscriberCount: parseInt(subsRes.rows[0]?.subscriber_count || 0, 10),
      currency: 'INR',
    };
  }

  // ============= SUBSCRIPTION TIERS =============
  async createTier(opts: { creatorDid: string; id: string; name: string; description?: string; amountPaise: number; color?: string; benefits?: string[] }): Promise<SubscriptionTier> {
    await this.db.query(
      `INSERT INTO subscription_tiers (id, creator_did, name, description, amount_paise, color, benefits)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (creator_did, id) DO UPDATE SET
         name = EXCLUDED.name, description = EXCLUDED.description,
         amount_paise = EXCLUDED.amount_paise, color = EXCLUDED.color,
         benefits = EXCLUDED.benefits`,
      [opts.id, opts.creatorDid, opts.name, opts.description || null, opts.amountPaise, opts.color || null, opts.benefits || []]
    );
    return {
      id: opts.id, creatorDid: opts.creatorDid, name: opts.name,
      description: opts.description, amountPaise: opts.amountPaise,
      color: opts.color, benefits: opts.benefits || [], position: 0,
    };
  }

  async listTiers(creatorDid: string): Promise<SubscriptionTier[]> {
    const res = await this.db.query<any>(
      `SELECT id, creator_did as "creatorDid", name, description, amount_paise as "amountPaise",
              currency, color, benefits, position
       FROM subscription_tiers WHERE creator_did = $1 ORDER BY position ASC, amount_paise ASC`,
      [creatorDid]
    );
    return res.rows;
  }

  // ============= SUBSCRIPTIONS =============
  // Use the existing subscriptions table (subscriber_id, creator_id, tier, price_cents)
  // tier is smallint — map our string id to numeric (hash)
  private tierIdToSmallInt(tierId: string): number {
    let h = 0;
    for (let i = 0; i < tierId.length; i++) h = (h * 31 + tierId.charCodeAt(i)) | 0;
    return Math.abs(h) % 32767 + 1; // smallint range
  }

  async subscribe(opts: { subscriberDid: string; creatorDid: string; tierId: string }): Promise<Subscription> {
    const tier = await this.db.query<any>(
      `SELECT amount_paise, currency FROM subscription_tiers WHERE creator_did = $1 AND id = $2`,
      [opts.creatorDid, opts.tierId]
    );
    if (!tier.rows[0]) throw new NotFoundException('Tier not found');
    const { amount_paise, currency } = tier.rows[0];
    const tierSmall = this.tierIdToSmallInt(opts.tierId);
    const renewsAt = new Date(Date.now() + 30 * 86400 * 1000);

    await this.db.query(
      `INSERT INTO subscriptions (subscriber_id, creator_id, tier, price_cents, currency, started_at, renews_at, is_active)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6, true)
       ON CONFLICT (subscriber_id, creator_id) DO UPDATE SET
         tier = EXCLUDED.tier, price_cents = EXCLUDED.price_cents,
         is_active = true, renews_at = EXCLUDED.renews_at`,
      [opts.subscriberDid, opts.creatorDid, tierSmall, amount_paise, currency, renewsAt]
    );
    return {
      id: `${opts.subscriberDid}-${opts.creatorDid}`,
      subscriberDid: opts.subscriberDid, creatorDid: opts.creatorDid, tierId: opts.tierId,
      amountPaise: amount_paise, currency, status: 'active',
      startedAt: new Date().toISOString(), renewsAt: renewsAt.toISOString(),
    };
  }

  async cancelSubscription(subscriberDid: string, creatorDid: string): Promise<void> {
    await this.db.query(
      `UPDATE subscriptions SET is_active = false, cancelled_at = NOW()
       WHERE subscriber_id = $1 AND creator_id = $2 AND is_active = true`,
      [subscriberDid, creatorDid]
    );
  }

  async listMySubscriptions(subscriberDid: string): Promise<any[]> {
    const res = await this.db.query<any>(
      `SELECT s.creator_id as "creatorDid", u.handle, u.display_name as "displayName",
              u.avatar_cid as "avatarCid", t.name as "tierName", t.color as "tierColor",
              s.price_cents as "priceCents", s.currency, s.is_active as "isActive", s.renews_at as "renewsAt"
       FROM subscriptions s
       JOIN users u ON u.did = s.creator_id
       LEFT JOIN subscription_tiers t ON t.creator_did = s.creator_id
       WHERE s.subscriber_id = $1 AND s.is_active = true
       ORDER BY s.renews_at ASC`,
      [subscriberDid]
    );
    return res.rows;
  }

  // ============= PAID POSTS =============
  async markPostPaywalled(opts: { postId: string; authorDid: string; minTierId: string; previewText?: string; fullContent: string }): Promise<void> {
    await this.db.query(
      `INSERT INTO paid_posts (post_id, author_did, min_tier_id, preview_text, full_content)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (post_id) DO UPDATE SET
         min_tier_id = EXCLUDED.min_tier_id,
         preview_text = EXCLUDED.preview_text,
         full_content = EXCLUDED.full_content`,
      [opts.postId, opts.authorDid, opts.minTierId, opts.previewText || null, opts.fullContent]
    );
    await this.db.query(`UPDATE posts SET is_paywalled = TRUE, min_tier_id = $1 WHERE id = $2`, [opts.minTierId, opts.postId]);
  }

  async canViewPaidPost(opts: { postId: string; viewerDid: string }): Promise<boolean> {
    const pp = await this.db.query<any>(
      `SELECT p.author_did, p.min_tier_id FROM paid_posts p WHERE p.post_id = $1`,
      [opts.postId]
    );
    if (!pp.rows[0]) return true; // not paywalled
    if (pp.rows[0].author_did === opts.viewerDid) return true; // own post
    // Check subscription
    const sub = await this.db.query<any>(
      `SELECT 1 FROM subscriptions
       WHERE subscriber_did = $1 AND creator_did = $2 AND status = 'active'`,
      [opts.viewerDid, pp.rows[0].author_did]
    );
    return sub.rows.length > 0;
  }
}
