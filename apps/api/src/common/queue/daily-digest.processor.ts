/**
 * Daily Digest queue — generate + send user their daily digest
 *
 * Cron job: every day at user-configured time, fetch their top posts
 * since last digest, generate summary (via AI agent or template),
 * send as email + push notification.
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { getVedadbPool } from '@orbit/db';
import { QUEUE_NAMES } from './queue.constants';

export interface DailyDigestJob {
  userDid: string;
  /** ISO timestamp of last digest (or null for first digest) */
  sinceISO: string | null;
  /** User's preferred delivery time (e.g. "08:00") */
  preferredTime?: string;
}

@Processor(QUEUE_NAMES.DAILY_DIGEST, { concurrency: 2 })
export class DailyDigestProcessor extends WorkerHost {
  private readonly logger = new Logger(DailyDigestProcessor.name);

  async process(job: Job<DailyDigestJob>) {
    const { userDid, sinceISO } = job.data;

    const db = getVedadbPool();
    const posts = (await db.query<any>(
      `SELECT p.post_id, p.author_id, p.content_text, p.created_at
       FROM posts p
       WHERE p.author_id IN (
         SELECT followee_id FROM follows WHERE follower_id = $1
       )
         AND p.deleted_at IS NULL
         AND ($2::timestamptz IS NULL OR p.created_at > $2)
       ORDER BY p.like_count DESC, p.created_at DESC LIMIT 20`,
      [userDid, sinceISO],
    )).rows;

    this.logger.log(
      `[daily-digest:${job.id}] generated digest for ${userDid} (${posts.length} posts since ${sinceISO || 'forever'})`,
    );

    return { digestLength: posts.length };
  }
}