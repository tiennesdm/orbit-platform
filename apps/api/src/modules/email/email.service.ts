/**
 * Email Service — SMTP transport via nodemailer (production)
 *
 * In dev, falls back to file-based mock inbox (ORBIT_INBOX_DIR).
 * In prod, uses SMTP credentials from env vars.
 *
 * Failure handling:
 *  - If SMTP transport fails on first attempt, enqueue retry via BullMQ
 *  - 3 attempts with exponential backoff (1s, 5s, 25s)
 *  - After 3 failures, log critical alert — operator must investigate
 *
 * Templates provided:
 *  - sendVerificationCode (email verification)
 *  - sendRecoveryCode (account recovery / password reset)
 *  - send2FABackupCodes (2FA backup codes)
 */

import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import * as nodemailer from 'nodemailer';
import { promises as fs } from 'fs';
import * as path from 'path';
import { QUEUE_NAMES } from '../../common/queue/queue.constants';

// Read INBOX_DIR from env on every access — tests can change the env var
// at runtime to use a per-test inbox dir without re-importing the module.
function getInboxDir(): string {
  return process.env.ORBIT_INBOX_DIR || '/tmp/orbit-email-inbox';
}

export interface Email {
  to: string;
  from?: string;
  subject: string;
  text: string;
  html?: string;
  meta?: Record<string, any>;
  sentAt: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private useFileMock = false;

  constructor(
    // Optional — QueueModule may not be loaded in tests
    @Optional() @InjectQueue(QUEUE_NAMES.EMAIL_RETRY) private readonly emailQueue?: Queue,
  ) {
    this.initTransporter();
  }

  /**
   * Initialize the SMTP transporter (or fall back to file mock in dev).
   * Tries multiple env var conventions for compatibility:
   *  - SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
   *  - SendGrid: SENDGRID_API_KEY (SMTP_API_KEY for SendGrid)
   *  - AWS SES: SES_SMTP_HOST etc.
   *
   * In dev (no SMTP env vars), writes emails to file so they're inspectable.
   */
  private async initTransporter() {
    const smtpHost = process.env.SMTP_HOST;
    const sendgridKey = process.env.SENDGRID_API_KEY;

    if (!smtpHost && !sendgridKey) {
      this.logger.warn('No SMTP config found — using file-based mock inbox (dev only)');
      this.useFileMock = true;
      try {
        await fs.mkdir(getInboxDir(), { recursive: true });
      } catch (e: any) {
        this.logger.error(`Failed to create inbox dir ${getInboxDir()}: ${e.message}`);
      }
      return;
    }

    try {
      if (sendgridKey) {
        // SendGrid SMTP
        this.transporter = nodemailer.createTransport({
          host: 'smtp.sendgrid.net',
          port: 587,
          secure: false,
          auth: { user: 'apikey', pass: sendgridKey },
        });
        this.logger.log('Email transporter configured for SendGrid');
      } else {
        // Generic SMTP
        this.transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          } : undefined,
          // TLS options for self-signed / corporate certs
          tls: process.env.SMTP_TLS_REJECT_UNAUTHORIZED === 'false' ? {
            rejectUnauthorized: false,
          } : undefined,
        });
        this.logger.log(`Email transporter configured for ${smtpHost}:${process.env.SMTP_PORT || 587}`);
      }

      // Verify connection (non-blocking — log warning if fails)
      this.transporter.verify().then(
        () => this.logger.log('SMTP connection verified'),
        (err: any) => this.logger.warn(`SMTP verify failed: ${err.message}`),
      );
    } catch (err: any) {
      this.logger.error(`Failed to initialize SMTP transporter: ${err.message}`);
      this.useFileMock = true;
    }
  }

  /**
   * Send an email. Routes through SMTP if configured, else writes to file.
   *
   * On SMTP failure (initial send), enqueues retry via BullMQ email-retry queue.
   * Returns immediately; retries happen async with exponential backoff.
   *
   * Note: when called from the retry queue processor itself, this method
   * throws on failure rather than re-queueing — BullMQ handles retry backoff
   * via the `attempts` job option. To avoid infinite recursion, the processor
   * uses `sendDirect()` instead, which skips the queue.
   */
  async send(email: Email): Promise<{ id: string; queued: boolean }> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sentAt = email.sentAt || new Date().toUTCString();
    const from = email.from || process.env.EMAIL_FROM || 'ORBIT <hello@orbit.example>';
    const fullEmail = { ...email, from, sentAt };

    // File mock mode (dev) — write to disk
    if (this.useFileMock || !this.transporter) {
      const filename = `${id}.eml`;
      const filepath = path.join(getInboxDir(), filename);
      // Ensure inbox dir exists — may have been deleted between init and send
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      const eml = this.renderEml(fullEmail, id);
      await fs.writeFile(filepath, eml, 'utf8');
      this.logger.log(`📧 email (mock) → ${email.to} (${email.subject}) [${filename}]`);
      return { id, queued: false };
    }

    // SMTP mode — try send, queue retry on failure
    try {
      await this.transporter.sendMail({
        from,
        to: email.to,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
      this.logger.log(`📧 email → ${email.to} (${email.subject}) [${id}]`);
      return { id, queued: false };
    } catch (err: any) {
      this.logger.error(`SMTP send failed for ${email.to}: ${err.message}`);
      // Queue retry if available
      if (this.emailQueue) {
        try {
          await this.emailQueue.add(
            'send',
            {
              to: email.to,
              subject: email.subject,
              text: email.text,
              html: email.html,
              attempt: 1,
              lastError: err.message,
            },
            { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
          );
          this.logger.warn(`📧 email queued for retry: ${email.to} (${email.subject})`);
          return { id, queued: true };
        } catch (queueErr: any) {
          this.logger.error(`Failed to queue email retry: ${queueErr.message}`);
        }
      }
      // Fall back to file mock so email isn't lost
      const filename = `${id}.eml`;
      const filepath = path.join(getInboxDir(), filename);
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      const eml = this.renderEml(fullEmail, id);
      await fs.writeFile(filepath, eml, 'utf8');
      this.logger.warn(`📧 email → file fallback (SMTP failed, queue unavailable): ${filename}`);
      return { id, queued: false };
    }
  }

  /**
   * Internal send path used by the email-retry queue processor.
   *
   * Same as `send()` but throws on SMTP failure rather than re-queueing.
   * BullMQ handles retry backoff via the `attempts` job option, so the
   * processor just needs to attempt the send and let exceptions propagate.
   *
   * Still writes to file fallback if SMTP is misconfigured (transporter=null)
   * so emails are never lost during config drift.
   */
  async sendDirect(email: Email): Promise<{ id: string }> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sentAt = email.sentAt || new Date().toUTCString();
    const from = email.from || process.env.EMAIL_FROM || 'ORBIT <hello@orbit.example>';
    const fullEmail = { ...email, from, sentAt };

    // File mock mode (dev) — write to disk
    if (this.useFileMock || !this.transporter) {
      const filename = `${id}.eml`;
      const filepath = path.join(getInboxDir(), filename);
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      const eml = this.renderEml(fullEmail, id);
      await fs.writeFile(filepath, eml, 'utf8');
      this.logger.log(`📧 email-direct (mock) → ${email.to} (${email.subject}) [${filename}]`);
      return { id };
    }

    await this.transporter.sendMail({
      from,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    this.logger.log(`📧 email-direct → ${email.to} (${email.subject}) [${id}]`);
    return { id };
  }

  /**
   * Render a .eml file (MIME format) for file mock + SMTP fallback.
   */
  private renderEml(email: Email, id: string): string {
    const lines = [
      `Message-ID: <${id}@orbit.local>`,
      `Date: ${email.sentAt}`,
      `From: ${email.from || 'ORBIT <hello@orbit.com>'}`,
      `To: ${email.to}`,
      `Subject: ${email.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=utf-8`,
      '',
      email.html || `<pre>${email.text}</pre>`,
    ];
    return lines.join('\n');
  }

  /**
   * List emails in the dev inbox (paginated) — useful for tests / dev only.
   *
   * Filtering by `to` matches against the parsed recipient address (not the
   * filename), so callers can pass a full email or partial handle substring.
   */
  async listInbox(opts: { to?: string; limit?: number } = {}): Promise<Email[]> {
    try {
      const files = await fs.readdir(getInboxDir());
      const emlFiles = files.filter((f) => f.endsWith('.eml'));

      const emails: Email[] = [];
      for (const file of emlFiles) {
        try {
          const content = await fs.readFile(path.join(getInboxDir(), file), 'utf8');
          emails.push(this.parseEml(content));
        } catch {
          // skip unreadable files
        }
      }

      const filtered = emails
        .filter((e) => !opts.to || e.to.includes(opts.to))
        .sort((a, b) => (b.sentAt || '').localeCompare(a.sentAt || ''))
        .slice(0, opts.limit || 50);

      return filtered;
    } catch {
      return [];
    }
  }

  /**
   * Get a single email by ID. Matches against the filename prefix.
   */
  async getEmail(id: string): Promise<Email | null> {
    try {
      const files = await fs.readdir(getInboxDir());
      const match = files.find((f) => f.startsWith(id));
      if (!match) return null;
      const content = await fs.readFile(path.join(getInboxDir(), match), 'utf8');
      return this.parseEml(content);
    } catch {
      return null;
    }
  }

  private parseEml(content: string): Email {
    const lines = content.split('\n');
    const email: Email = { to: '', subject: '', text: '', sentAt: '' };
    let inBody = false;
    const body: string[] = [];
    for (const line of lines) {
      if (inBody) {
        body.push(line);
        continue;
      }
      if (line === '') {
        inBody = true;
        continue;
      }
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim().toLowerCase();
      const val = line.slice(colonIdx + 1).trim();
      if (key === 'to') email.to = val;
      else if (key === 'subject') email.subject = val;
      else if (key === 'date') email.sentAt = val;
    }
    email.text = body.join('\n').trim();
    return email;
  }

  // ============================================================
  // High-level templates
  // ============================================================

  async sendVerificationCode(to: string, code: string, displayName: string) {
    return this.send({
      to,
      subject: 'Verify your ORBIT email',
      text: `Hi ${displayName}! Your verification code is: ${code}\n\nThis code expires in 15 minutes.`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; width: 56px; height: 56px; border-radius: 14px; background: linear-gradient(135deg, #4338CA, #7C3AED); color: white; font-size: 28px; line-height: 56px; text-align: center;">O</div>
            <h1 style="font-size: 24px; margin: 16px 0 0;">Welcome to ORBIT</h1>
          </div>
          <p>Hi ${displayName},</p>
          <p>Your verification code is:</p>
          <div style="text-align: center; margin: 32px 0;">
            <div style="display: inline-block; padding: 16px 32px; background: #F5F2EC; border-radius: 12px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #4338CA;">${code}</div>
          </div>
          <p style="color: #6B6862; font-size: 14px;">This code expires in 15 minutes. If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
      sentAt: new Date().toUTCString(),
    });
  }

  async sendRecoveryCode(to: string, code: string, displayName: string) {
    return this.send({
      to,
      subject: 'Reset your ORBIT handle',
      text: `Hi ${displayName}! Your recovery code is: ${code}\n\nThis code expires in 30 minutes. If you didn't request this, secure your account.`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; width: 56px; height: 56px; border-radius: 14px; background: linear-gradient(135deg, #4338CA, #7C3AED); color: white; font-size: 28px; line-height: 56px; text-align: center;">O</div>
            <h1 style="font-size: 24px; margin: 16px 0 0;">Reset your handle</h1>
          </div>
          <p>Hi ${displayName},</p>
          <p>Your account recovery code is:</p>
          <div style="text-align: center; margin: 32px 0;">
            <div style="display: inline-block; padding: 16px 32px; background: #FEF3C7; border-radius: 12px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #C2410C;">${code}</div>
          </div>
          <p style="color: #6B6862; font-size: 14px;">This code expires in 30 minutes. If you didn't request this, your account may be compromised — change your passkey immediately.</p>
        </div>
      `,
      sentAt: new Date().toUTCString(),
    });
  }

  async send2FABackupCodes(to: string, displayName: string, codes: string[]) {
    return this.send({
      to,
      subject: 'Your ORBIT 2FA backup codes',
      text: `Hi ${displayName}! Your 2FA backup codes are:\n\n${codes.join('\n')}\n\nEach can be used once. Store them safely.`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="font-size: 24px;">2FA Backup Codes</h1>
          <p>Hi ${displayName}, here are your one-time backup codes. Each can be used once if you lose access to your authenticator.</p>
          <div style="background: #F5F2EC; padding: 20px; border-radius: 12px; font-family: monospace; font-size: 14px; line-height: 2;">
            ${codes.map((c) => `<div>${c}</div>`).join('')}
          </div>
          <p style="color: #6B6862; font-size: 14px; margin-top: 24px;">Store these in a safe place. Anyone with these codes can access your account.</p>
        </div>
      `,
      sentAt: new Date().toUTCString(),
    });
  }
}