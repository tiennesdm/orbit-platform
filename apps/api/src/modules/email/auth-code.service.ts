/**
 * Auth enhancements — recovery, email verification, 2FA
 *
 * Code-based flow with file-based storage. In production, swap to Redis or DB.
 */

import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export type CodeKind = 'email_verification' | 'recovery' | '2fa';

export interface CodeRecord {
  code: string;
  kind: CodeKind;
  did?: string;
  email?: string;
  expiresAt: number;
  attempts: number;
  meta?: Record<string, any>;
}

@Injectable()
export class AuthCodeService {
  private readonly logger = new Logger(AuthCodeService.name);
  private codes = new Map<string, CodeRecord>();
  // Memory cleanup every 5 minutes
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60_000);
  }

  /**
   * Issue a 6-digit code. Returns the code (also stored under its hash).
   */
  issue(opts: { kind: CodeKind; did?: string; email?: string; ttlSec?: number; meta?: Record<string, any> }): string {
    const code = this.generateCode(6);
    const id = this.makeId(opts.kind, opts.email || opts.did || 'anon');
    this.codes.set(id, {
      code: this.hashCode(code),
      kind: opts.kind,
      did: opts.did,
      email: opts.email,
      expiresAt: Date.now() + (opts.ttlSec || 900) * 1000, // default 15 min
      attempts: 0,
      meta: opts.meta,
    });
    this.logger.log(`issued ${opts.kind} code for ${opts.email || opts.did} (id=${id.slice(0, 16)}…)`);
    return code;
  }

  /**
   * Verify a code. Returns the record on success, null on failure.
   * Codes are single-use.
   */
  verify(opts: { kind: CodeKind; email?: string; did?: string; code: string }): CodeRecord | null {
    const id = this.makeId(opts.kind, opts.email || opts.did || 'anon');
    const record = this.codes.get(id);
    if (!record) return null;
    if (record.expiresAt < Date.now()) {
      this.codes.delete(id);
      return null;
    }
    record.attempts += 1;
    if (record.attempts > 5) {
      this.codes.delete(id);
      return null;
    }
    if (this.hashCode(opts.code) !== record.code) return null;
    this.codes.delete(id); // single-use
    return record;
  }

  /**
   * Check if a code is still pending (for polling UIs)
   */
  hasPending(kind: CodeKind, key: string): boolean {
    const id = this.makeId(kind, key);
    const r = this.codes.get(id);
    return !!r && r.expiresAt > Date.now();
  }

  private cleanup() {
    const now = Date.now();
    let removed = 0;
    for (const [id, r] of this.codes.entries()) {
      if (r.expiresAt < now) {
        this.codes.delete(id);
        removed++;
      }
    }
    if (removed > 0) this.logger.debug(`cleaned ${removed} expired codes`);
  }

  private generateCode(len: number): string {
    // 6-digit code, 0-9, no leading zero issue
    const max = 10 ** len;
    const n = crypto.randomInt(0, max);
    return n.toString().padStart(len, '0');
  }

  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  private makeId(kind: CodeKind, key: string): string {
    return `${kind}:${key.toLowerCase()}`;
  }
}
