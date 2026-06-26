/**
 * Notifications queue — push notifications to delivery channels
 *
 * Inserts notifications to DB synchronously (cheap). The expensive part —
 * pushing via FCM (Firebase Cloud Messaging) / APNs (Apple Push Notification
 * service) / Web Push — happens asynchronously here.
 *
 * If push fails, retry 3 times with exponential backoff. After that, mark
 * the notification as "delivery_failed" so the user doesn't get ghost pushes.
 *
 * Currently a stub — the actual FCM/APNs integration is a separate PR.
 * For now, this just logs the would-be push (useful for dev/debugging).
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { getVedadbPool } from '@orbit/db';
import { QUEUE_NAMES } from './queue.constants';

export interface NotificationPushJob {
  notificationId: number;
  userDid: string;
  type: string;
  payload: Record<string, any>;
}

@Processor(QUEUE_NAMES.NOTIFICATIONS, { concurrency: 5 })
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  async process(job: Job<NotificationPushJob>) {
    const { notificationId, userDid, type, payload } = job.data;

    const db = getVedadbPool();
    const tokensRes = await db.query<{ fcm_token: string | null; apns_token: string | null; web_push_sub: string | null }>(
      `SELECT fcm_token, apns_token, web_push_sub FROM users WHERE did = $1`,
      [userDid],
    );

    if (tokensRes.rows.length === 0) {
      this.logger.debug(`[notifications:${job.id}] user ${userDid} not found — skipping push`);
      return { skipped: true };
    }

    const tokens = tokensRes.rows[0];
    const targets: string[] = [];
    if (tokens.fcm_token) targets.push('fcm');
    if (tokens.apns_token) targets.push('apns');
    if (tokens.web_push_sub) targets.push('web-push');

    if (targets.length === 0) {
      this.logger.debug(`[notifications:${job.id}] no device tokens for ${userDid}`);
      return { skipped: true, reason: 'no_tokens' };
    }

    this.logger.log(
      `[notifications:${job.id}] would push type=${type} to ${userDid} via ${targets.join(',')}`,
    );

    return {
      pushed: true,
      channels: targets,
      notificationId,
    };
  }
}