/**
 * ORBIT App Module
 * Composes all feature modules
 */

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
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
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 60000,
        limit: 100,
      },
      {
        name: 'long',
        ttl: 3600000,
        limit: 1000,
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
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
