/**
 * Email retry queue — retry failed email sends
 *
 * Replaces ad-hoc try/catch in email sends. Failed emails get retried
 * 3 times with exponential backoff. After that, an operator alert fires
 * (so we don't silently lose user emails).
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailService } from '../../modules/email/email.service';
import { QUEUE_NAMES } from './queue.constants';

export interface EmailRetryJob {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attempt: number;
  lastError?: string;
}

@Processor(QUEUE_NAMES.EMAIL_RETRY, { concurrency: 3 })
export class EmailRetryProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailRetryProcessor.name);

  constructor(private readonly email: EmailService) {
    super();
  }

  async process(job: Job<EmailRetryJob>) {
    const { to, subject, text, html, attempt } = job.data;
    this.logger.log(`[email-retry:${job.id}] attempt ${attempt} → ${to}`);

    try {
      // Use sendDirect — throws on failure so BullMQ can apply backoff via
      // the `attempts` job option. We must NOT use send() here, because that
      // would queue another retry on failure → infinite loop.
      const result = await this.email.sendDirect({ to, subject, text, html, sentAt: new Date().toUTCString() });
      this.logger.log(`[email-retry:${job.id}] sent ${result.id}`);
      return { sent: true, id: result.id };
    } catch (err: any) {
      this.logger.error(`[email-retry:${job.id}] failed: ${err.message}`);
      throw err;
    }
  }
}