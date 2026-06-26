/**
 * ORBIT Job Queue — BullMQ infrastructure
 *
 * Queues:
 *  - scheduled-posts:  Publish scheduled posts when due
 *  - gdpr-hard-delete: Execute hard-delete 30 days after soft-delete
 *  - daily-digest:     Generate + send daily digest at user-configured time
 *  - email-retry:      Retry failed email sends with exponential backoff
 *  - notifications:    Push notifications to delivery channels (FCM, APNs)
 *
 * Redis connection: configurable via REDIS_HOST / REDIS_PORT / REDIS_PASSWORD.
 * Falls back to no-op if REDIS_DISABLED=true (queues register but workers
 * don't start — useful for dev/test without Redis).
 *
 * BullMQ dashboard: https://github.com/taskforcesh/bullmq
 */

import { BullModule } from '@nestjs/bullmq';
import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScheduledPostsProcessor } from './scheduled-posts.processor';
import { GdprHardDeleteProcessor } from './gdpr-hard-delete.processor';
import { NotificationsProcessor } from './notifications.processor';
import { EmailRetryProcessor } from './email-retry.processor';
import { DailyDigestProcessor } from './daily-digest.processor';
import { PostModule } from '../../modules/post/post.module';
import { GdprModule } from '../../modules/gdpr/gdpr.module';
import { EmailModule } from '../../modules/email/email.module';
import { QUEUE_NAMES } from './queue.constants';

const logger = new Logger('QueueModule');

// Re-export for backwards compat
export { QUEUE_NAMES };
export type { QueueName } from './queue.constants';

const REDIS_DISABLED = process.env.REDIS_DISABLED === 'true';
if (REDIS_DISABLED) {
  logger.warn('REDIS_DISABLED=true — queues will register but workers will not start');
}

const bullImports = REDIS_DISABLED
  ? []
  : [
      BullModule.forRootAsync({
        inject: [ConfigService],
        useFactory: (config: ConfigService) => {
          const redisHost = config.get('REDIS_HOST', 'localhost');
          const redisPort = parseInt(config.get('REDIS_PORT', '6379'), 10);
          const redisPassword = config.get('REDIS_PASSWORD');
          const redisTls = config.get('REDIS_TLS') === 'true';

          return {
            connection: {
              host: redisHost,
              port: redisPort,
              password: redisPassword,
              tls: redisTls ? {} : undefined,
              // Reconnect strategy — keep trying forever
              retryStrategy: (times: number) => Math.min(times * 50, 2000),
              maxRetriesPerRequest: null, // BullMQ requires this
            },
            defaultJobOptions: {
              // Failed jobs retry 3 times with exponential backoff (1s, 5s, 25s)
              attempts: 3,
              backoff: { type: 'exponential', delay: 1000 },
              // Jobs that don't complete in 10 min are failed (catches deadlocks)
              removeOnComplete: { age: 86400, count: 1000 }, // 24h retention
              removeOnFail: { age: 604800 }, // 7d retention for debugging
            },
          };
        },
      }),
      BullModule.registerQueue(
        { name: QUEUE_NAMES.SCHEDULED_POSTS },
        { name: QUEUE_NAMES.GDPR_HARD_DELETE },
        { name: QUEUE_NAMES.DAILY_DIGEST },
        { name: QUEUE_NAMES.EMAIL_RETRY },
        { name: QUEUE_NAMES.NOTIFICATIONS },
      ),
    ];

// Processors are always registered — they need to exist for DI. But workers
// won't start when Redis is disabled (they get registered without a queue).
@Global()
@Module({
  imports: [
    PostModule,    // for PostService (scheduled-posts processor)
    GdprModule,    // for GdprService (gdpr-hard-delete processor)
    EmailModule,   // for EmailService (email-retry processor)
    ...bullImports,
  ],
  providers: [
    ScheduledPostsProcessor,
    GdprHardDeleteProcessor,
    NotificationsProcessor,
    EmailRetryProcessor,
    DailyDigestProcessor,
  ],
  // Only export BullModule when it's actually imported (not when Redis is disabled)
  exports: REDIS_DISABLED ? [] : [BullModule],
})
export class QueueModule {}