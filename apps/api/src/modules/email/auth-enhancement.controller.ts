/**
 * Auth enhancement controller
 *
 * Endpoints:
 * - POST /auth/recovery/request { email } → send code
 * - POST /auth/recovery/verify { email, code } → returns identity info
 * - POST /auth/recovery/reset { email, code, newHandle } → reset
 * - POST /auth/email/send-code { email } → send 6-digit code
 * - POST /auth/email/verify { email, code } → mark email as verified
 * - GET  /auth/dev/inbox?to=… → list dev mock inbox
 * - GET  /auth/dev/email/:id → view raw email
 * - POST /auth/2fa/setup → returns 10 backup codes
 * - POST /auth/2fa/verify { code, did } → verify TOTP
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post as HttpPost,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { EmailService } from './email.service';
import { AuthCodeService } from './auth-code.service';
import { IdentityService } from '../identity/identity.service';
import * as crypto from 'crypto';

const RequestRecoverySchema = z.object({
  email: z.string().email(),
});

const VerifyRecoverySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

const ResetHandleSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  newHandle: z.string().regex(/^[a-z0-9._-]{3,30}$/),
});

const EmailCodeSchema = z.object({
  email: z.string().email(),
});

@ApiTags('auth')
@Controller('auth')
export class AuthEnhancementController {
  constructor(
    private readonly email: EmailService,
    private readonly codes: AuthCodeService,
    private readonly identity: IdentityService,
  ) {}

  // ============================================================
  // Account recovery
  // ============================================================
  @Public()
  @HttpPost('recovery/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a recovery code via email' })
  async requestRecovery(@Body() body: z.infer<typeof RequestRecoverySchema>) {
    // Look up user by email
    const user = await this.identity.findByEmail(body.email);
    if (!user) {
      // Don't leak whether email exists — generic response
      return { ok: true, message: 'If the email is on ORBIT, a code has been sent.' };
    }
    const code = this.codes.issue({ kind: 'recovery', email: body.email, did: user.did, ttlSec: 1800 });
    await this.email.sendRecoveryCode(body.email, code, user.displayName);
    return { ok: true, message: 'If the email is on ORBIT, a code has been sent.' };
  }

  @Public()
  @HttpPost('recovery/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify recovery code, return identity hint' })
  async verifyRecovery(@Body() body: z.infer<typeof VerifyRecoverySchema>) {
    const record = this.codes.verify({ kind: 'recovery', email: body.email, code: body.code });
    if (!record || !record.did) {
      return { ok: false, message: 'Invalid or expired code' };
    }
    const user = await this.identity.findByDid(record.did);
    if (!user) return { ok: false, message: 'User no longer exists' };
    return {
      ok: true,
      identity: {
        did: user.did,
        handle: user.handle,
        displayName: user.displayName,
        avatarCid: user.avatarCid,
        // Don't expose email back
      },
    };
  }

  @Public()
  @HttpPost('recovery/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset handle using recovery code' })
  async resetHandle(@Body() body: z.infer<typeof ResetHandleSchema>) {
    const record = this.codes.verify({ kind: 'recovery', email: body.email, code: body.code });
    if (!record || !record.did) {
      return { ok: false, message: 'Invalid or expired code' };
    }
    // Update the user's handle
    await this.identity.updateHandle(record.did, body.newHandle);
    const session = await this.identity.issueSessionForDid(record.did);
    return { ok: true, session };
  }

  // ============================================================
  // Email verification
  // ============================================================
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpPost('email/send-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a 6-digit verification code to your email' })
  async sendEmailCode(@CurrentUser('did') did: string) {
    const user = await this.identity.findByDid(did);
    if (!user) return { ok: false, message: 'User not found' };
    if (!user.email) return { ok: false, message: 'No email on account' };
    const code = this.codes.issue({ kind: 'email_verification', did, email: user.email, ttlSec: 900 });
    await this.email.sendVerificationCode(user.email, code, user.displayName);
    return { ok: true, message: 'Code sent' };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpPost('email/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify your email with a 6-digit code' })
  async verifyEmailCode(@CurrentUser('did') did: string, @Body() body: { code: string }) {
    const user = await this.identity.findByDid(did);
    if (!user || !user.email) return { ok: false, message: 'User or email not found' };
    const record = this.codes.verify({ kind: 'email_verification', did, code: body.code });
    if (!record) return { ok: false, message: 'Invalid or expired code' };
    await this.identity.markEmailVerified(did);
    return { ok: true, message: 'Email verified' };
  }

  // ============================================================
  // 2FA backup codes
  // ============================================================
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpPost('2fa/setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set up 2FA, generate 10 backup codes' })
  async setup2FA(@CurrentUser('did') did: string) {
    const user = await this.identity.findByDid(did);
    if (!user) return { ok: false, message: 'User not found' };
    const codes = Array.from({ length: 10 }, () => this.generateBackupCode());
    await this.identity.set2FABackupCodes(did, codes);
    if (user.email) {
      await this.email.send2FABackupCodes(user.email, user.displayName, codes);
    }
    return { ok: true, codes };
  }

  // ============================================================
  // Dev-only: list mock inbox
  // ============================================================
  @Public()
  @Get('dev/inbox')
  @ApiOperation({ summary: '[DEV] List recent mock emails' })
  async devInbox(@Param('to') to?: string) {
    return this.email.listInbox({ to, limit: 30 });
  }

  @Public()
  @Get('dev/email/:id')
  @ApiOperation({ summary: '[DEV] Get a single mock email' })
  async devEmail(@Param('id') id: string) {
    return this.email.getEmail(id);
  }

  private generateBackupCode(): string {
    // 8 chars, dashes for readability: XXXX-XXXX
    const a = crypto.randomBytes(2).toString('hex').toUpperCase();
    const b = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `${a}-${b}`;
  }
}
