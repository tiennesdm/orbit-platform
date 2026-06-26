/**
 * Notification Service
 * - Real-time fanout via Vedadb pub/sub (orbit_streams table)
 * - AI-organized (group, dedup, prioritize)
 * - Multiple channels: likes, comments, follows, mentions, AI digest
 */

import { Injectable, Optional } from '@nestjs/common';
import { getVedadbPool, OrbitPubSub } from '@orbit/db';
import type { Notification } from '@orbit/types';
import { NotificationsGateway } from '../../common/realtime/notifications.gateway';

@Injectable()
export class NotificationService {
  private readonly db = getVedadbPool();
  private readonly pubsub: OrbitPubSub;

  constructor(
    // Optional — RealtimeModule may not be loaded in tests
    @Optional() private readonly gateway?: NotificationsGateway,
  ) {
    this.pubsub = new OrbitPubSub(this.db);
  }

  async send(input: {
    userId: string;
    actorId?: string;
    type: 'like' | 'comment' | 'follow' | 'mention' | 'ai' | 'event' | 'subscribe' | 'brand_deal';
    targetType?: 'post' | 'reel' | 'story' | 'event' | 'listing' | 'user';
    targetId?: string;
    payload?: Record<string, unknown>;
    aiPriority?: number;
  }): Promise<Notification> {
    const res = await this.db.query<any>(
      `INSERT INTO notifications (user_id, actor_id, type, target_type, target_id, payload, ai_priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING notification_id as "notificationId", user_id as "userId",
                actor_id as "actorId", type, target_type as "targetType",
                target_id as "targetId", payload, is_read as "isRead",
                ai_priority as "aiPriority", created_at as "createdAt"`,
      [
        input.userId, input.actorId, input.type, input.targetType, input.targetId,
        JSON.stringify(input.payload || {}), input.aiPriority ?? 50,
      ]
    );

    const notif = res.rows[0];

    // Real-time push via pub/sub (legacy channel — still used by some clients)
    await this.pubsub.publish(`notification.new:${input.userId}`, notif);

    // Real-time push via WebSocket (new — pushed to connected clients)
    if (this.gateway) {
      const pushed = this.gateway.pushNotification(input.userId, notif);
      if (!pushed) {
        // User not connected — they'll see it on next reconnect via
        // GET /notifications. No action needed; counts as delivery on reconnect.
      }
    }

    return notif;
  }

  async listForUser(userId: string, limit = 50, unreadOnly = false): Promise<Notification[]> {
    const where = unreadOnly ? 'AND is_read = FALSE' : '';
    const res = await this.db.query<any>(
      `SELECT n.notification_id as "notificationId", n.user_id as "userId",
              n.actor_id as "actorId", n.type, n.target_type as "targetType",
              n.target_id as "targetId", n.payload, n.is_read as "isRead",
              n.ai_priority as "aiPriority", n.created_at as "createdAt",
              u.display_name as "actorDisplayName", u.handle as "actorHandle",
              u.avatar_cid as "actorAvatarCid"
       FROM notifications n
       LEFT JOIN users u ON u.did = n.actor_id
       WHERE n.user_id = $1 ${where}
       ORDER BY n.ai_priority ASC, n.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return res.rows;
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await this.db.query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND notification_id = $2`,
      [userId, notificationId]
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );
  }
}
