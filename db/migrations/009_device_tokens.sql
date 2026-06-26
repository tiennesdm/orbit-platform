-- Migration 009: Device tokens for push notifications
-- One row per registered device. Supports iOS (Expo push token or APNs),
-- Android (Expo push token or FCM), and Web (VAPID subscription endpoint).
--
-- Flow:
--   1. Mobile app gets Expo push token via expo-notifications
--      (works for both iOS and Android — Expo wraps APNs and FCM)
--   2. Web app registers service worker + subscribes to push via VAPID
--   3. App POSTs token to /notifications/devices/register
--   4. Server stores token in device_tokens table
--   5. When notification needs to be pushed, NotificationsProcessor
--      queries this table for the user's tokens and sends via push provider
--
-- Why a separate table from users?
--   - Multiple devices per user (phone, tablet, laptop)
--   - Tokens rotate (Expo tokens are stable but FCM/APNs change on app reinstall)
--   - Per-device preferences (mute certain notification types on certain devices)
--   - Per-device locale for localized notifications

CREATE TABLE IF NOT EXISTS device_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_did TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  token TEXT NOT NULL,                          -- Expo push token OR VAPID endpoint OR FCM token
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  provider TEXT NOT NULL CHECK (provider IN ('expo', 'fcm', 'apns', 'web-push')),
  device_id TEXT,                               -- stable device identifier
  app_version TEXT,                             -- client app version (for compat checks)
  locale TEXT,                                  -- e.g. 'en-US', 'hi-IN' — for localized pushes
  timezone TEXT,                                -- e.g. 'Asia/Kolkata' — for time-aware pushes
  enabled BOOLEAN NOT NULL DEFAULT TRUE,        -- user can disable push per-device
  muted_until TIMESTAMPTZ,                      -- do-not-disturb until this time
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (token)                                -- one token = one row (UNIQUE allows re-registration to update)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user
  ON device_tokens (user_did)
  WHERE enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_device_tokens_last_used
  ON device_tokens (last_used_at DESC);

COMMENT ON TABLE device_tokens IS 'Registered device push tokens — one row per device per user';
COMMENT ON COLUMN device_tokens.token IS 'Expo push token (ExponentPushToken[xxx]) or VAPID endpoint or FCM/APNs token';
COMMENT ON COLUMN device_tokens.provider IS 'expo (default for Expo apps), fcm, apns, web-push';
COMMENT ON COLUMN device_tokens.muted_until IS 'Do-not-disturb until this time — set by user for quiet hours';

-- Track push delivery attempts (security + debugging)
CREATE TABLE IF NOT EXISTS push_delivery_attempts (
  id BIGSERIAL PRIMARY KEY,
  notification_id BIGINT,                       -- soft reference to notifications table
  device_token_id BIGINT REFERENCES device_tokens(id) ON DELETE SET NULL,
  user_did TEXT NOT NULL,
  provider TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  error_code TEXT,
  error_message TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_attempts_user_time
  ON push_delivery_attempts (user_did, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_attempts_notification
  ON push_delivery_attempts (notification_id, attempted_at DESC)
  WHERE notification_id IS NOT NULL;

COMMENT ON TABLE push_delivery_attempts IS 'Push delivery audit log for debugging failed pushes + security monitoring';