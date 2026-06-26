/**
 * Realtime Module — WebSocket gateway for real-time notifications
 *
 * Wire up /notifications WebSocket namespace with JWT auth.
 * Clients connect with their existing access token and receive
 * notifications pushed in real-time.
 */

import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotificationsGateway } from './notifications.gateway';

@Global()
@Module({
  imports: [
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
    }),
  ],
  providers: [NotificationsGateway],
  exports: [NotificationsGateway],
})
export class RealtimeModule {}