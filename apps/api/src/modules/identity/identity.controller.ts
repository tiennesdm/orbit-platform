/**
 * Identity Controller — REST endpoints
 * - WebAuthn registration & login
 * - User profile CRUD
 * - Portable identity export
 */

import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post as HttpPost, Put, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { IdentityService } from './identity.service';
import { WebAuthnService } from './webauthn.service';
import { PortableIdentityService } from './portable-identity.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type {
  WebAuthnRegistrationOptions,
  WebAuthnRegistrationCredential,
  AuthSession,
  User,
} from '@orbit/types';

const RegisterInputSchema = z.object({
  handle: z.string().regex(/^[a-z0-9._-]{3,30}$/).optional(),
  domain: z.string().optional(),
  displayName: z.string().min(1).max(80),
  bio: z.string().max(500).optional(),
});

const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  bio: z.string().max(500).optional(),
  avatarCid: z.string().optional(),
  coverCid: z.string().optional(),
});

@ApiTags('identity')
@Controller('identity')
export class IdentityController {
  constructor(
    private readonly identity: IdentityService,
    private readonly webauthn: WebAuthnService,
    private readonly portable: PortableIdentityService
  ) {}

  // ============================================================
  // WebAuthn Registration (Public)
  // ============================================================
  @Public()
  @HttpPost('register/options')
  @ApiOperation({ summary: 'Generate WebAuthn registration options' })
  async registerOptions(@Body() body: { handle?: string; displayName: string }) {
    return this.webauthn.generateRegistrationOptions(body);
  }

  @Public()
  @HttpPost('register/verify')
  @ApiOperation({ summary: 'Verify WebAuthn registration and create account' })
  async registerVerify(@Body() body: { challengeId: string; credential: WebAuthnRegistrationCredential }) {
    const parsed = RegisterInputSchema.partial().parse({ displayName: '' });
    return this.webauthn.verifyRegistration(body);
  }

  // ============================================================
  // WebAuthn Login (Public)
  // ============================================================
  @Public()
  @HttpPost('login/options')
  @ApiOperation({ summary: 'Generate WebAuthn authentication options' })
  async loginOptions(@Body() body: { handle: string }) {
    return this.webauthn.generateAuthenticationOptions(body.handle);
  }

  @Public()
  @HttpPost('login/verify')
  @ApiOperation({ summary: 'Verify WebAuthn authentication, return session' })
  async loginVerify(@Body() body: { challengeId: string; credential: any }) {
    return this.webauthn.verifyAuthentication(body);
  }

  // ============================================================
  // Standard signup (for tests/dev — production uses WebAuthn)
  // ============================================================
  @Public()
  @HttpPost('signup')
  @ApiOperation({ summary: 'Direct signup (no WebAuthn) — for testing only' })
  async signup(@Body() body: z.infer<typeof RegisterInputSchema>): Promise<AuthSession> {
    return this.identity.register(body);
  }

  // ============================================================
  // Token refresh
  // ============================================================
  @Public()
  @HttpPost('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  async refresh(@Body() body: { refreshToken: string }): Promise<AuthSession> {
    return this.identity.refreshAccessToken(body.refreshToken);
  }

  // ============================================================
  // Authenticated endpoints
  // ============================================================
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async me(@CurrentUser('did') did: string): Promise<User> {
    const user = await this.identity.findByDid(did);
    if (!user) throw new Error('User not found');
    return user;
  }

  @Put('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  async updateMe(
    @CurrentUser('did') did: string,
    @Body() body: z.infer<typeof UpdateProfileSchema>
  ): Promise<User> {
    return this.identity.updateProfile(did, body);
  }

  @Get('me/export')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export complete portable data vault' })
  async exportData(@CurrentUser('did') did: string) {
    return this.portable.exportUserData(did);
  }

  @Get(':handle')
  @Public()
  @ApiOperation({ summary: 'Get user by handle (public profile)' })
  async getByHandle(@Body('handle') handle: string): Promise<User> {
    const user = await this.identity.findByHandle(handle.replace(/^@/, ''));
    if (!user) throw new Error('User not found');
    return user;
  }

  @HttpPost(':handle/follow')
  @ApiOperation({ summary: 'Follow a user by handle' })
  @HttpCode(HttpStatus.OK)
  async follow(@CurrentUser('did') did: string, @Param('handle') handle: string) {
    const target = await this.identity.findByHandle(handle.replace(/^@/, ''));
    if (!target) throw new Error('User not found');
    await this.identity.follow(did, target.did);
    return { ok: true, followeeDid: target.did };
  }

  @Delete(':handle/follow')
  @ApiOperation({ summary: 'Unfollow a user by handle' })
  @HttpCode(HttpStatus.OK)
  async unfollow(@CurrentUser('did') did: string, @Param('handle') handle: string) {
    const target = await this.identity.findByHandle(handle.replace(/^@/, ''));
    if (!target) throw new Error('User not found');
    await this.identity.unfollow(did, target.did);
    return { ok: true, followeeDid: target.did };
  }
}
