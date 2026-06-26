/**
 * Notifications queue — push notifications to delivery channels
 *
 * Inserts notifications to DB synchronously (cheap, in NotificationService).
 * The expensive part — pushing via Expo / Web Push — happens here, async.
 *
 * If push fails, retry 3 times with exponential backoff. After that, log
 * to push_delivery_attempts with success=false — operator can investigate.
 *
 * Auto-unregisters dead tokens (DeviceNotRegistered / 404 / 410 responses).
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PushService, PushPayload } from '../../modules/push/push.service';
import { QUEUE_NAMES } from './queue.constants';

export interface NotificationPushJob {
  notificationId: number;
  userDid: string;
  type: string;
  payload: PushPayload;
}

@Processor(QUEUE_NAMES.NOTIFICATIONS, { concurrency: 5 })
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly push: PushService) {
    super();
  }

  async process(job: Job<NotificationPushJob>) {
    const { notificationId, userDid, payload } = job.data;

    try {
      const results = await this.push.sendToUser(userDid, payload);
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.length - successCount;

      this.logger.log(
        `[notifications:${job.id}] notif=${notificationId} user=${userDid} ` +
        `pushed=${successCount}/${results.length} (failed=${failCount})`,
      );

      return {
        notificationId,
        userDid,
        totalDevices: results.length,
        success: successCount,
        failed: failCount,
      };
    } catch (err: any) {
      this.logger.error(`[notifications:${job.id}] failed: ${err.message}`);
      throw err; // BullMQ applies backoff
    }
  }
}