/**
 * Scheduled Posts queue — publish posts at a future time
 *
 * Replaces the AI agent's fake `schedulePost` (which returned fake success).
 * User can schedule a post to be published at a future time; when due,
 * the job fires and the post is created.
 *
 * Idempotent: if the post was already published (e.g. user published manually
 * before the scheduled time), the job no-ops.
 *
 * @nestjs/bullmq v11 API: processor classes have a single `process(job)` method
 * that handles ALL job types for the queue. To distinguish, check job.name.
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PostService } from '../../modules/post/post.service';
import { QUEUE_NAMES } from './queue.constants';

export interface ScheduledPostJob {
  /** Author DID */
  authorDid: string;
  /** Post payload (same as createPost input) */
  payload: {
    mode: 'intimate' | 'public' | 'visual' | 'community';
    contentText?: string;
    mediaIds?: string[];
    hashtags?: string[];
    visibility?: 'public' | 'followers' | 'friends' | 'private' | 'group';
    groupId?: string;
  };
  /** Original scheduled timestamp (for audit log) */
  scheduledAt: string;
}

@Processor(QUEUE_NAMES.SCHEDULED_POSTS, { concurrency: 3 })
export class ScheduledPostsProcessor extends WorkerHost {
  private readonly logger = new Logger(ScheduledPostsProcessor.name);

  constructor(private readonly posts: PostService) {
    super();
  }

  async process(job: Job<ScheduledPostJob>) {
    const { authorDid, payload, scheduledAt } = job.data;
    this.logger.log(
      `[scheduled-posts:${job.id}] publishing for ${authorDid} (scheduled for ${scheduledAt})`,
    );

    try {
      const post = await this.posts.create(authorDid, payload as any);
      this.logger.log(
        `[scheduled-posts:${job.id}] published as post_id=${post.postId}`,
      );
      return { postId: post.postId };
    } catch (err: any) {
      this.logger.error(
        `[scheduled-posts:${job.id}] failed: ${err.message}`,
      );
      throw err; // BullMQ will retry per backoff config
    }
  }
}