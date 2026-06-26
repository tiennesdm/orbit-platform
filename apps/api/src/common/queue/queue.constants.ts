/**
 * Queue name constants — extracted from queue.module.ts to avoid circular imports.
 * Each processor imports this directly; queue.module imports from here too.
 */

export const QUEUE_NAMES = {
  SCHEDULED_POSTS: 'scheduled-posts',
  GDPR_HARD_DELETE: 'gdpr-hard-delete',
  DAILY_DIGEST: 'daily-digest',
  EMAIL_RETRY: 'email-retry',
  NOTIFICATIONS: 'notifications',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];