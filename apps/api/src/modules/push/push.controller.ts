/**
 * Push Notification Controller — device management endpoints
 *
 *  - POST   /notifications/devices/register  — register a device token
 *  - POST   /notifications/devices/unregister — unregister a device token
 *  - GET    /notifications/devices           — list my registered devices
 *  - PATCH  /notifications/devices/:id       — update device preferences (enabled, muted)
 *  - GET    /notifications/vapid-public-key  — VAPID public key for web push subscription
 *
 * Sending pushes: handled by NotificationsProcessor (queue) which calls
 * PushService.sendToUser() asynchronously. Clients don't trigger pushes
 * directly — they happen when other users interact (follow, like, etc.)
 */

import { Body, Controller, Get, Param, Patch, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { PushService, PushPlatform, PushProvider } from './push.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

const RegisterSchema = z.object({
  token: z.string().min(10).max(2048),
  platform: z.enum(['ios', 'android', 'web']),
  provider: z.enum(['expo', 'fcm', 'apns', 'web-push']).optional(),
  deviceId: z.string().max(255).optional(),
  appVersion: z.string().max(50).optional(),
  locale: z.string().max(20).optional(),
  timezone: z.string().max(100).optional(),
});

const UnregisterSchema = z.object({
  token: z.string().min(10).max(2048),
});

const UpdateDeviceSchema = z.object({
  enabled: z.boolean().optional(),
  mutedUntil: z.union([z.string().datetime(), z.null()]).optional(),
});

@ApiTags('notifications')
@Controller('notifications')
export class PushController {
  constructor(private readonly push: PushService) {}

  /**
   * Register a device for push notifications.
   * Mobile apps: send Expo push token from expo-notifications.
   * Web apps: send VAPID subscription as JSON string.
   */
  @Post('devices/register')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  // Throttle limits read from env in test (THROTTLE_SHORT_LIMIT etc.).
  // In prod: 5/sec, 30/min. In tests: env vars are very high (10000+).
  @Throttle({
    short: {
      limit: parseInt(process.env.PUSH_REGISTER_SHORT_LIMIT || '5', 10),
      ttl: 1000,
    },
    medium: {
      limit: parseInt(process.env.PUSH_REGISTER_MEDIUM_LIMIT || '30', 10),
      ttl: 60_000,
    },
  })
  @ApiOperation({ summary: 'Register a device for push notifications' })
  async register(@CurrentUser('did') did: string, @Body() body: z.infer<typeof RegisterSchema>) {
    const parsed = RegisterSchema.parse(body);
    const result = await this.push.registerDevice({
      userDid: did,
      token: parsed.token,
      platform: parsed.platform as PushPlatform,
      provider: parsed.provider as PushProvider | undefined,
      deviceId: parsed.deviceId,
      appVersion: parsed.appVersion,
      locale: parsed.locale,
      timezone: parsed.timezone,
    });
    return {
      ok: true,
      deviceId: result.id,
      alreadyRegistered: result.alreadyRegistered,
    };
  }

  @Post('devices/unregister')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unregister a device (e.g., on logout)' })
  async unregister(@CurrentUser('did') did: string, @Body() body: z.infer<typeof UnregisterSchema>) {
    const parsed = UnregisterSchema.parse(body);
    const result = await this.push.unregisterDevice(did, parsed.token);
    return { ok: true, deleted: result.deleted };
  }

  @Get('devices')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my registered devices' })
  async list(@CurrentUser('did') did: string) {
    const devices = await this.push.listDevices(did);
    return { devices };
  }

  @Patch('devices/:id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update device preferences (enabled, muted)' })
  async update(
    @CurrentUser('did') did: string,
    @Param('id') idStr: string,
    @Body() body: z.infer<typeof UpdateDeviceSchema>,
  ) {
    const id = parseInt(idStr, 10);
    if (isNaN(id) || id <= 0) {
      return { ok: false, error: 'invalid_device_id' };
    }
    const parsed = UpdateDeviceSchema.parse(body);
    if (parsed.enabled !== undefined) {
      await this.push.setDeviceEnabled(did, id, parsed.enabled);
    }
    if (parsed.mutedUntil !== undefined) {
      await this.push.setMutedUntil(did, id, parsed.mutedUntil ? new Date(parsed.mutedUntil) : null);
    }
    return { ok: true };
  }

  /**
   * VAPID public key — clients need this to subscribe to web push.
   * Public because the key is meant to be shared with clients.
   */
  @Public()
  @Get('vapid-public-key')
  @ApiOperation({ summary: 'Get VAPID public key for web push subscription' })
  async getVapidKey() {
    const publicKey = this.push.getVapidPublicKey();
    return { publicKey, configured: !!publicKey };
  }
}