/**
 * ORBIT App Module
 * Composes all feature modules
 */

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { TerminusModule } from '@nestjs/terminus';
import { APP_GUARD } from '@nestjs/core';

// Feature modules
import { IdentityModule } from './modules/identity/identity.module';
import { PostModule } from './modules/post/post.module';
import { FeedModule } from './modules/feed/feed.module';
import { DmModule } from './modules/dm/dm.module';
import { StoryModule } from './modules/story/story.module';
import { ReelModule } from './modules/reel/reel.module';
import { GroupModule } from './modules/group/group.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { NotificationModule } from './modules/notification/notification.module';
import { SearchModule } from './modules/search/search.module';
import { AiAgentModule } from './modules/ai-agent/ai-agent.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { MediaModule } from './modules/media/media.module';
import { GdprModule } from './modules/gdpr/gdpr.module';
import { EmailModule } from './modules/email/email.module';
import { VoiceModule } from './modules/voice/voice.module';
import { MonetizationModule } from './modules/monetization/monetization.module';
import { CustomFeedsModule } from './modules/custom-feeds/custom-feeds.module';
import { FederationModule } from './modules/federation/federation.module';
import { WellnessModule } from './modules/wellness/wellness.module';
import { RemixModule } from './modules/remix/remix.module';
import { AiCocreationModule } from './modules/ai-cocreation/ai-cocreation.module';

// Common
import { HealthController } from './common/health/health.controller';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { ObservabilityModule } from './common/observability/observability.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '../../.env'],
    }),

    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        // THROTTLE_*_LIMIT env vars let tests raise limits without code changes.
        // Production defaults to 10/sec — tuned per route via @Throttle.
        limit: parseInt(process.env.THROTTLE_SHORT_LIMIT || '10', 10),
      },
      {
        name: 'medium',
        ttl: 60000,
        limit: parseInt(process.env.THROTTLE_MEDIUM_LIMIT || '100', 10),
      },
      {
        name: 'long',
        ttl: 3600000,
        limit: parseInt(process.env.THROTTLE_LONG_LIMIT || '1000', 10),
      },
    ]),

    TerminusModule,
    ObservabilityModule,

    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get('JWT_EXPIRES_IN', '86400'),
          issuer: 'orbit',
          audience: 'orbit-api',
        },
        verifyOptions: {
          issuer: 'orbit',
          audience: 'orbit-api',
        },
      }),
      global: true,
    }),

    // Feature modules
    IdentityModule,
    PostModule,
    FeedModule,
    DmModule,
    StoryModule,
    ReelModule,
    GroupModule,
    MarketplaceModule,
    NotificationModule,
    SearchModule,
    AiAgentModule,
    ModerationModule,
    MediaModule,
    GdprModule,
    EmailModule,
    VoiceModule,
    MonetizationModule,
    CustomFeedsModule,
    FederationModule,
    WellnessModule,
    RemixModule,
    AiCocreationModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
