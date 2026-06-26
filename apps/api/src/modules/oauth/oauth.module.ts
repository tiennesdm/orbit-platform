/**
 * OAuth Module — Google + Apple sign-in
 *
 * Provides endpoints to:
 *  - Login / signup with Google ID token
 *  - Login / signup with Apple ID token
 *  - Link / unlink providers on existing accounts
 *  - List enabled providers (for client UI)
 */

import { Module } from '@nestjs/common';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [IdentityModule],
  controllers: [OAuthController],
  providers: [OAuthService],
  exports: [OAuthService],
})
export class OAuthModule {}