/**
 * Push Notification Service
 *
 * Sends push notifications to user devices via:
 *  - **Expo Push API** — for iOS + Android (Expo-based apps). Default for mobile.
 *  - **Web Push (VAPID)** — for browser push (PWA / service workers).
 *
 * Storage: device_tokens table (migration 009). Each user can have multiple
 * device tokens (phone + tablet + laptop). Per-device preferences:
 *   - enabled: boolean (user can disable)
 *   - muted_until: timestamp (do-not-disturb)
 *   - locale: for localized notifications
 *
 * Delivery is async via the notifications queue (NotificationsProcessor).
 * This service is the library — the queue calls it. Failures are retried
 * 3 times with exponential backoff.
 *
 * Why Expo Push API for mobile instead of FCM/APNs directly?
 *   - Single API for both iOS and Android
 *   - Expo handles token rotation, APNs certs, FCM service accounts
 *   - No need to manage separate credentials per platform
 *   - expo-notifications SDK on client side handles everything
 *   - Trade-off: small dependency on Expo servers (acceptable)
 */

import { Injectable, Logger, Optional, Inject, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import * as webpush from 'web-push';
import { getVedadbPool } from '@orbit/db';
import { QUEUE_NAMES } from '../../common/queue/queue.constants';

export type PushPlatform = 'ios' | 'android' | 'web';
export type PushProvider = 'expo' | 'fcm' | 'apns' | 'web-push';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, any>;     // custom data — used by app to route
  badge?: number;                  // iOS badge count
  sound?: 'default' | null;        // iOS/Android
  ttl?: number;                    // seconds
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;              // Android notification channel
  icon?: string;                   // icon URL
}

export interface DeviceToken {
  id: number;
  user_did: string;
  token: string;
  platform: PushPlatform;
  provider: PushProvider;
  device_id: string | null;
  enabled: boolean;
  muted_until: Date | null;
  locale: string | null;
  timezone: string | null;
  app_version: string | null;
}

export interface PushResult {
  deviceTokenId: number;
  provider: PushProvider;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  providerMessageId?: string;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_BATCH_SIZE = 100; // Expo allows up to 100 per request
const WEB_PUSH_DEFAULT_TTL = 60 * 60 * 4; // 4 hours

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly db = getVedadbPool();
  private webPushConfigured = false;

  constructor(
    private readonly config: ConfigService,
    // Optional — notifications queue may not be available in tests
    @Optional() @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private readonly notifQueue?: Queue,
  ) {
    this.initWebPush();
  }

  /**
   * Initialize Web Push (VAPID) keys.
   * Auto-generates a key pair if not provided via env vars.
   * In production: set VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY + VAPID_SUBJECT.
   */
  private initWebPush() {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.config.get<string>('VAPID_SUBJECT', 'mailto:admin@orbit.example');

    if (!publicKey || !privateKey) {
      this.logger.warn(
        'Web Push (VAPID) not configured — set VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY + VAPID_SUBJECT. ' +
        'Generate keys with: npx web-push generate-vapid-keys',
      );
      return;
    }

    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.webPushConfigured = true;
      this.logger.log('Web Push (VAPID) configured');
    } catch (err: any) {
      this.logger.error(`Web Push init failed: ${err.message}`);
    }
  }

  // ============================================================
  // Device token management
  // ============================================================

  /**
   * Register a device token for a user.
   * If the token already exists for another user (rare — token reuse across
   * users is unusual but possible if a device changes owners), re-assign it.
   */
  async registerDevice(opts: {
    userDid: string;
    token: string;
    platform: PushPlatform;
    provider?: PushProvider;
    deviceId?: string;
    appVersion?: string;
    locale?: string;
    timezone?: string;
  }): Promise<{ id: number; alreadyRegistered: boolean }> {
    const provider = opts.provider || this.detectProvider(opts.token, opts.platform);

    // Validate token format
    this.validateToken(opts.token, provider);

    const res = await this.db.query<{ id: number }>(
      `INSERT INTO device_tokens (
        user_did, token, platform, provider, device_id, app_version, locale, timezone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (token) DO UPDATE SET
        user_did = EXCLUDED.user_did,
        platform = EXCLUDED.platform,
        provider = EXCLUDED.provider,
        device_id = EXCLUDED.device_id,
        app_version = EXCLUDED.app_version,
        locale = EXCLUDED.locale,
        timezone = EXCLUDED.timezone,
        enabled = TRUE,
        last_used_at = NOW()
      RETURNING id`,
      [
        opts.userDid,
        opts.token,
        opts.platform,
        provider,
        opts.deviceId || null,
        opts.appVersion || null,
        opts.locale || null,
        opts.timezone || null,
      ],
    );

    return {
      id: res.rows[0].id,
      alreadyRegistered: res.rows.length === 0,
    };
  }

  /**
   * Unregister a device token. Idempotent — no error if token doesn't exist.
   */
  async unregisterDevice(userDid: string, token: string): Promise<{ deleted: boolean }> {
    const res = await this.db.query(
      `DELETE FROM device_tokens WHERE user_did = $1 AND token = $2`,
      [userDid, token],
    );
    return { deleted: (res.rowCount || 0) > 0 };
  }

  /**
   * List registered devices for a user.
   */
  async listDevices(userDid: string): Promise<Array<{
    id: number;
    platform: PushPlatform;
    provider: PushProvider;
    deviceId: string | null;
    enabled: boolean;
    mutedUntil: Date | null;
    lastUsedAt: Date;
    createdAt: Date;
  }>> {
    const res = await this.db.query(
      `SELECT id, platform, provider, device_id, enabled, muted_until, last_used_at, created_at
       FROM device_tokens
       WHERE user_did = $1
       ORDER BY last_used_at DESC`,
      [userDid],
    );
    return res.rows.map((r: any) => ({
      id: r.id,
      platform: r.platform,
      provider: r.provider,
      deviceId: r.device_id,
      enabled: r.enabled,
      mutedUntil: r.muted_until,
      lastUsedAt: r.last_used_at,
      createdAt: r.created_at,
    }));
  }

  /**
   * Disable push for a device (e.g., user turned off notifications in-app).
   */
  async setDeviceEnabled(userDid: string, deviceId: number, enabled: boolean): Promise<void> {
    await this.db.query(
      `UPDATE device_tokens SET enabled = $1 WHERE id = $2 AND user_did = $3`,
      [enabled, deviceId, userDid],
    );
  }

  /**
   * Set do-not-disturb for a device (e.g., quiet hours).
   */
  async setMutedUntil(userDid: string, deviceId: number, until: Date | null): Promise<void> {
    await this.db.query(
      `UPDATE device_tokens SET muted_until = $1 WHERE id = $2 AND user_did = $3`,
      [until, deviceId, userDid],
    );
  }

  // ============================================================
  // Push delivery
  // ============================================================

  /**
   * Send a push to all of a user's enabled devices.
   * Returns per-device delivery results.
   */
  async sendToUser(userDid: string, payload: PushPayload): Promise<PushResult[]> {
    const devices = await this.getActiveDevices(userDid, payload);
    if (devices.length === 0) {
      this.logger.debug(`[push] no active devices for ${userDid}`);
      return [];
    }

    // Group by provider — different providers use different delivery APIs
    const byProvider = new Map<PushProvider, DeviceToken[]>();
    for (const device of devices) {
      const list = byProvider.get(device.provider) || [];
      list.push(device);
      byProvider.set(device.provider, list);
    }

    const results: PushResult[] = [];

    for (const [provider, tokens] of byProvider) {
      try {
        if (provider === 'expo') {
          const expoResults = await this.sendViaExpo(tokens, payload);
          results.push(...expoResults);
        } else if (provider === 'web-push') {
          const wpResults = await this.sendViaWebPush(tokens, payload);
          results.push(...wpResults);
        } else {
          // FCM/APNs direct — not implemented (use Expo for mobile)
          this.logger.warn(`[push] unsupported provider ${provider} — skipping ${tokens.length} devices`);
          for (const t of tokens) {
            results.push({
              deviceTokenId: t.id,
              provider,
              success: false,
              errorCode: 'unsupported_provider',
              errorMessage: `Provider ${provider} not supported — use Expo for mobile`,
            });
          }
        }
      } catch (err: any) {
        this.logger.error(`[push] provider ${provider} failed: ${err.message}`);
        for (const t of tokens) {
          results.push({
            deviceTokenId: t.id,
            provider,
            success: false,
            errorCode: 'provider_error',
            errorMessage: err.message,
          });
        }
      }
    }

    // Log all attempts to audit table
    await this.logAttempts(userDid, payload, results);

    return results;
  }

  /**
   * Get active devices for a user — respects enabled flag + muted_until.
   */
  private async getActiveDevices(userDid: string, _payload: PushPayload): Promise<DeviceToken[]> {
    const res = await this.db.query<DeviceToken>(
      `SELECT id, user_did, token, platform, provider, device_id, enabled,
              muted_until, locale, timezone, app_version
       FROM device_tokens
       WHERE user_did = $1
         AND enabled = TRUE
         AND (muted_until IS NULL OR muted_until < NOW())
       ORDER BY last_used_at DESC`,
      [userDid],
    );
    return res.rows;
  }

  /**
   * Send via Expo Push API. Batches up to 100 tokens per request.
   *
   * API docs: https://docs.expo.dev/push-notifications/sending-notifications/
   * Response per token:
   *   - status: "ok" → push accepted by Expo
   *   - status: "error" + message: "DeviceNotRegistered" → token is dead, unregister
   */
  private async sendViaExpo(devices: DeviceToken[], payload: PushPayload): Promise<PushResult[]> {
    const messages = devices.map((d) => ({
      to: d.token,
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      sound: payload.sound === null ? null : (payload.sound || 'default'),
      badge: payload.badge,
      ttl: payload.ttl,
      priority: payload.priority || 'normal',
      channelId: payload.channelId,
      icon: payload.icon,
    }));

    const results: PushResult[] = [];

    // Batch into chunks of EXPO_PUSH_BATCH_SIZE
    for (let i = 0; i < messages.length; i += EXPO_PUSH_BATCH_SIZE) {
      const batch = messages.slice(i, i + EXPO_PUSH_BATCH_SIZE);
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
          },
          body: JSON.stringify(batch),
          signal: AbortSignal.timeout(15_000),
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Expo HTTP ${res.status}: ${errorText}`);
        }

        const response = (await res.json()) as { data: Array<{ status: string; id?: string; message?: string; details?: any }> };
        for (let j = 0; j < batch.length; j++) {
          const ticket = response.data[j];
          const device = devices[i + j];
          if (!ticket) continue;
          if (ticket.status === 'ok') {
            results.push({
              deviceTokenId: device.id,
              provider: 'expo',
              success: true,
              providerMessageId: ticket.id,
            });
          } else {
            const isDeadToken = ticket.message === 'DeviceNotRegistered' || ticket.details?.error === 'DeviceNotRegistered';
            if (isDeadToken) {
              // Auto-unregister dead tokens
              this.unregisterDevice(device.user_did, device.token).catch(() => {});
            }
            results.push({
              deviceTokenId: device.id,
              provider: 'expo',
              success: false,
              errorCode: ticket.message,
              errorMessage: ticket.details?.error || ticket.message,
            });
          }
        }
      } catch (err: any) {
        // Whole batch failed
        for (let j = 0; j < batch.length; j++) {
          const device = devices[i + j];
          results.push({
            deviceTokenId: device.id,
            provider: 'expo',
            success: false,
            errorCode: 'expo_request_failed',
            errorMessage: err.message,
          });
        }
      }
    }

    return results;
  }

  /**
   * Send via Web Push (VAPID). One HTTP request per device.
   */
  private async sendViaWebPush(devices: DeviceToken[], payload: PushPayload): Promise<PushResult[]> {
    if (!this.webPushConfigured) {
      return devices.map((d) => ({
        deviceTokenId: d.id,
        provider: 'web-push' as PushProvider,
        success: false,
        errorCode: 'vapid_not_configured',
        errorMessage: 'VAPID keys not set on server',
      }));
    }

    const results: PushResult[] = [];
    for (const device of devices) {
      try {
        // Parse the VAPID subscription endpoint + keys from the stored token
        // Format: JSON-serialized PushSubscription { endpoint, keys: { p256dh, auth } }
        let subscription: webpush.PushSubscription;
        try {
          subscription = JSON.parse(device.token);
        } catch {
          throw new Error('Token is not a valid VAPID subscription JSON');
        }

        await webpush.sendNotification(
          subscription,
          JSON.stringify({
            title: payload.title,
            body: payload.body,
            data: payload.data || {},
            icon: payload.icon,
          }),
          {
            TTL: payload.ttl || WEB_PUSH_DEFAULT_TTL,
          },
        );

        results.push({
          deviceTokenId: device.id,
          provider: 'web-push',
          success: true,
        });
      } catch (err: any) {
        const statusCode = err.statusCode || 0;
        const isDeadEndpoint = statusCode === 404 || statusCode === 410;
        if (isDeadEndpoint) {
          // Auto-unregister expired subscription
          this.unregisterDevice(device.user_did, device.token).catch(() => {});
        }
        results.push({
          deviceTokenId: device.id,
          provider: 'web-push',
          success: false,
          errorCode: `http_${statusCode}`,
          errorMessage: err.message,
        });
      }
    }

    return results;
  }

  /**
   * Detect provider from token format.
   *  - Expo: starts with "ExponentPushToken[" or "ExpoPushToken["
   *  - Web Push: JSON containing "endpoint" + "keys"
   *  - FCM: starts with specific prefixes (rare in this app — Expo handles it)
   */
  private detectProvider(token: string, platform: PushPlatform): PushProvider {
    if (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')) {
      return 'expo';
    }
    if (platform === 'web' || (token.startsWith('{') && token.includes('endpoint'))) {
      return 'web-push';
    }
    // Fall back to platform default
    if (platform === 'ios') return 'apns';
    if (platform === 'android') return 'fcm';
    return 'expo'; // safest default for Expo apps
  }

  /**
   * Validate token format per provider.
   */
  private validateToken(token: string, provider: PushProvider): void {
    if (!token || token.length < 10) {
      throw new BadRequestException(`Invalid token length (provider=${provider})`);
    }
    if (provider === 'expo') {
      if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
        throw new BadRequestException(
          `Expo token must start with ExponentPushToken[ or ExpoPushToken[ (got: ${token.slice(0, 30)}...)`,
        );
      }
      if (!token.endsWith(']')) {
        throw new BadRequestException('Expo token must end with ]');
      }
    }
    if (provider === 'web-push') {
      try {
        const parsed = JSON.parse(token);
        if (!parsed.endpoint || !parsed.keys?.p256dh || !parsed.keys?.auth) {
          throw new BadRequestException('Web push subscription must have endpoint + keys.p256dh + keys.auth');
        }
      } catch (err: any) {
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException(`Invalid web push subscription JSON: ${err.message}`);
      }
    }
  }

  /**
   * Log delivery attempts to audit table.
   */
  private async logAttempts(userDid: string, _payload: PushPayload, results: PushResult[]): Promise<void> {
    if (results.length === 0) return;
    try {
      const values = results.map((r, idx) => {
        const base = idx * 5;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
      }).join(', ');
      const params: any[] = [];
      for (const r of results) {
        params.push(r.deviceTokenId, userDid, r.provider, r.success, r.errorMessage || null);
      }
      await this.db.query(
        `INSERT INTO push_delivery_attempts (device_token_id, user_did, provider, success, error_message) VALUES ${values}`,
        params,
      );
    } catch (err: any) {
      // Don't fail delivery if audit fails
      this.logger.warn(`Failed to log push attempts: ${err.message}`);
    }
  }

  /**
   * Public VAPID public key — clients need this to subscribe.
   */
  getVapidPublicKey(): string | null {
    return this.config.get<string>('VAPID_PUBLIC_KEY') || null;
  }
}