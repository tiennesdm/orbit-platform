/**
 * OAuth Controller — Google + Apple sign-in endpoints
 *
 * Endpoints:
 *  - POST /oauth/google/login  — Login/signup with Google ID token
 *  - POST /oauth/apple/login   — Login/signup with Apple ID token
 *  - POST /oauth/link          — Link provider to current authenticated user
 *  - POST /oauth/unlink        — Unlink provider from current user
 *  - GET  /oauth/linked        — List providers linked to current user
 *  - GET  /oauth/providers     — List enabled providers (for client UI)
 */

import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import type { Request } from 'express';
import { OAuthService, OAuthProvider } from './oauth.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

const LoginSchema = z.object({
  idToken: z.string().min(10).max(4096),
  createAccount: z.boolean().optional().default(true),
});

const LinkSchema = z.object({
  provider: z.enum(['google', 'apple', 'github', 'facebook', 'twitter']),
  idToken: z.string().min(10).max(4096),
});

const UnlinkSchema = z.object({
  provider: z.enum(['google', 'apple', 'github', 'facebook', 'twitter']),
});

@ApiTags('oauth')
@Controller('oauth')
export class OAuthController {
  constructor(private readonly oauth: OAuthService) {}

  /**
   * Login with Google ID token.
   * Mobile/web apps use Google Sign-In SDK to obtain the ID token.
   */
  @Public()
  @Throttle({ short: { limit: 5, ttl: 1000 }, medium: { limit: 20, ttl: 60_000 } })
  @Post('google/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login or sign up with Google ID token' })
  async googleLogin(@Body() body: z.infer<typeof LoginSchema>, @Req() req: Request) {
    const parsed = LoginSchema.parse(body);
    return this.oauth.loginWithIdToken('google', parsed.idToken, {
      createAccount: parsed.createAccount,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  /**
   * Login with Apple ID token.
   * Mobile/web apps use Apple Sign-In (AuthenticationServices) to obtain the ID token.
   */
  @Public()
  @Throttle({ short: { limit: 5, ttl: 1000 }, medium: { limit: 20, ttl: 60_000 } })
  @Post('apple/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login or sign up with Apple ID token' })
  async appleLogin(@Body() body: z.infer<typeof LoginSchema>, @Req() req: Request) {
    const parsed = LoginSchema.parse(body);
    return this.oauth.loginWithIdToken('apple', parsed.idToken, {
      createAccount: parsed.createAccount,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  /**
   * Link an OAuth provider to the current authenticated user.
   * Useful for users who signed up with passkey then want to add Google sign-in.
   */
  @Post('link')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Link an OAuth provider to the current user' })
  async link(@CurrentUser('did') did: string, @Body() body: z.infer<typeof LinkSchema>) {
    const parsed = LinkSchema.parse(body);
    await this.oauth.linkProviderToUser(did, parsed.provider as OAuthProvider, parsed.idToken);
    return { ok: true, linked: parsed.provider };
  }

  /**
   * Unlink an OAuth provider from the current user.
   * Refuses if it's the user's only auth method.
   */
  @Post('unlink')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlink an OAuth provider from the current user' })
  async unlink(@CurrentUser('did') did: string, @Body() body: z.infer<typeof UnlinkSchema>) {
    const parsed = UnlinkSchema.parse(body);
    await this.oauth.unlinkProvider(did, parsed.provider as OAuthProvider);
    return { ok: true, unlinked: parsed.provider };
  }

  /**
   * List OAuth providers linked to the current user.
   */
  @Get('linked')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List OAuth providers linked to the current user' })
  async listLinked(@CurrentUser('did') did: string) {
    const providers = await this.oauth.listLinkedProviders(did);
    return { providers };
  }

  /**
   * List enabled OAuth providers (for client UI to show appropriate buttons).
   */
  @Public()
  @Get('providers')
  @ApiOperation({ summary: 'List enabled OAuth providers (public)' })
  async listProviders() {
    // Don't expose config to client — just which providers are enabled
    return {
      providers: [
        { id: 'google', name: 'Google', enabled: !!process.env.GOOGLE_CLIENT_ID },
        { id: 'apple', name: 'Apple', enabled: !!process.env.APPLE_CLIENT_ID },
        { id: 'github', name: 'GitHub', enabled: false }, // not implemented yet
        { id: 'facebook', name: 'Facebook', enabled: false },
        { id: 'twitter', name: 'Twitter', enabled: false },
      ].filter((p) => p.enabled),
    };
  }
}