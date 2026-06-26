/**
 * GDPR Hard Delete queue — execute hard-delete 30 days after soft-delete
 *
 * User soft-deletes account (POST /gdpr/delete). They have 30 days to cancel.
 * After 30 days, this queue's job fires and calls the GDPR hard-delete cascade.
 *
 * If user logs back in and cancels before 30 days, the job is removed.
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { GdprService } from '../../modules/gdpr/gdpr.service';
import { getVedadbPool } from '@orbit/db';
import { QUEUE_NAMES } from './queue.constants';

export interface GdprHardDeleteJob {
  userDid: string;
  scheduledFor: string; // ISO timestamp
}

@Processor(QUEUE_NAMES.GDPR_HARD_DELETE, { concurrency: 1 })
export class GdprHardDeleteProcessor extends WorkerHost {
  private readonly logger = new Logger(GdprHardDeleteProcessor.name);

  constructor(private readonly gdpr: GdprService) {
    super();
  }

  async process(job: Job<GdprHardDeleteJob>) {
    const { userDid, scheduledFor } = job.data;
    this.logger.warn(
      `[gdpr-hard-delete:${job.id}] executing hard-delete for ${userDid} (scheduled for ${scheduledFor})`,
    );

    const db = getVedadbPool();
    const res = await db.query<{ is_active: boolean; deletion_scheduled_for: Date | null }>(
      `SELECT is_active, deletion_scheduled_for FROM users WHERE did = $1`,
      [userDid],
    );

    if (res.rows.length === 0) {
      this.logger.log(`[gdpr-hard-delete:${job.id}] user ${userDid} already deleted — skipping`);
      return { skipped: true, reason: 'user_not_found' };
    }

    const row = res.rows[0];
    if (row.is_active) {
      this.logger.log(`[gdpr-hard-delete:${job.id}] user ${userDid} re-activated — skipping hard-delete`);
      return { skipped: true, reason: 'user_reactivated' };
    }

    const result = await this.gdpr.hardDeleteUser(userDid);
    this.logger.warn(
      `[gdpr-hard-delete:${job.id}] deleted ${userDid} from ${result.deletedFrom.length} tables`,
    );
    return { deletedFrom: result.deletedFrom };
  }
}