/**
 * Email Service — file-based mock inbox
 *
 * In production, swap for SMTP / SendGrid / SES via the same `send()` interface.
 * For dev, we write each "email" to /tmp/orbit-email-inbox/<to>-<timestamp>.eml
 * so it can be inspected by the user via the dev-only inbox endpoint.
 */

import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

const INBOX_DIR = process.env.ORBIT_INBOX_DIR || '/tmp/orbit-email-inbox';

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

  constructor() {
    fs.mkdir(INBOX_DIR, { recursive: true }).catch((e) =>
      this.logger.error(`Failed to create inbox dir ${INBOX_DIR}: ${e}`)
    );
  }

  /**
   * Send an email. In dev, writes to file. In prod, swap to SMTP transport.
   */
  async send(email: Email): Promise<{ id: string }> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const filename = `${id}.eml`;
    const filepath = path.join(INBOX_DIR, filename);

    const eml = this.renderEml(email, id);
    await fs.writeFile(filepath, eml, 'utf8');

    this.logger.log(`📧 email sent → ${email.to} (${email.subject}) [${filename}]`);
    return { id };
  }

  /**
   * Render a simple .eml file
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
   * List emails in the dev inbox (paginated)
   */
  async listInbox(opts: { to?: string; limit?: number } = {}): Promise<Email[]> {
    try {
      const files = await fs.readdir(INBOX_DIR);
      const filtered = files
        .filter((f) => f.endsWith('.eml'))
        .filter((f) => !opts.to || f.includes(opts.to.replace(/[^a-z0-9]/gi, '')))
        .sort()
        .reverse()
        .slice(0, opts.limit || 50);

      const emails: Email[] = [];
      for (const file of filtered) {
        try {
          const content = await fs.readFile(path.join(INBOX_DIR, file), 'utf8');
          emails.push(this.parseEml(content));
        } catch {}
      }
      return emails;
    } catch {
      return [];
    }
  }

  /**
   * Get a single email by ID (last 8 chars of filename)
   */
  async getEmail(id: string): Promise<Email | null> {
    try {
      const files = await fs.readdir(INBOX_DIR);
      const match = files.find((f) => f.startsWith(id));
      if (!match) return null;
      const content = await fs.readFile(path.join(INBOX_DIR, match), 'utf8');
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
