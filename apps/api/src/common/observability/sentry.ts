/**
 * Sentry initialization — error tracking
 *
 * No-op if SENTRY_DSN is not set (so dev/local work without errors)
 * - Captures uncaught exceptions
 * - Captures unhandled promise rejections
 * - Adds request context (request ID, user, etc.)
 * - Performance monitoring (10% sample rate by default)
 * - Filters out health check noise
 */

import * as Sentry from '@sentry/node';
import type { Request } from 'express';

let initialized = false;

export function initSentry(): boolean {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return false; // No Sentry configured — no-op
  }

  if (initialized) return true;

  const env = process.env.NODE_ENV || 'development';
  const tracesSampleRate = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1');

  Sentry.init({
    dsn,
    environment: env,
    release: process.env.SENTRY_RELEASE || `orbit-api@${process.env.npm_package_version || '0.1.0'}`,
    tracesSampleRate,
    profilesSampleRate: tracesSampleRate,
    integrations: [
      // Add custom integration for request context
      Sentry.httpIntegration({ tracing: true }),
    ],
    // Filter out health checks and high-volume noise
    ignoreErrors: [
      'ECONNREFUSED',  // Local dev
      'ECONNRESET',    // Client disconnects
    ],
    beforeSendTransaction(event) {
      // Don't trace health check noise
      if (event.transaction?.includes('/health/')) return null;
      return event;
    },
    beforeSend(event) {
      // Don't send health check errors
      if (event.request?.url?.includes('/health/')) return null;
      // Scrub PII
      if (event.user) {
        delete event.user.ip_address;
        delete event.user.email;
      }
      return event;
    },
  });

  initialized = true;
  return true;
}

export function captureException(err: unknown, context?: Record<string, unknown>) {
  if (!initialized) return;
  Sentry.captureException(err, { extra: context });
}

export function setUser(user: { id: string; did?: string; handle?: string }) {
  if (!initialized) return;
  Sentry.setUser({
    id: user.id,
    username: user.handle,
  });
}

export function addRequestContext(req: Request) {
  if (!initialized) return;
  Sentry.setContext('request', {
    id: req.id,
    method: req.method,
    url: req.originalUrl || req.url,
    userAgent: req.headers['user-agent'],
  });
}
