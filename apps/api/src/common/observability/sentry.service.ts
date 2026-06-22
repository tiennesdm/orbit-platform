import { Injectable, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';

@Injectable()
export class SentryService {
  private readonly logger = new Logger('SentryService');
  private initialized = false;

  async init() {
    const dsn = process.env.SENTRY_DSN;
    const env = process.env.NODE_ENV || 'development';

    if (!dsn) {
      this.logger.log('Sentry DSN not set — running without error reporting');
      return;
    }

    Sentry.init({
      dsn,
      environment: env,
      release: `orbit-api@${process.env.APP_VERSION || 'dev'}`,
      tracesSampleRate: env === 'production' ? 0.1 : 1.0,
      // Scrub PII before sending
      beforeSend(event) {
        if (event.request) {
          delete event.request.cookies;
          delete event.request.headers?.['authorization'];
        }
        return event;
      },
    });

    this.initialized = true;
    this.logger.log(`Sentry initialized (env=${env})`);
  }

  captureException(err: Error, context?: Record<string, any>) {
    if (!this.initialized) {
      this.logger.error(`[unsent] ${err.message}`, err.stack);
      return;
    }
    Sentry.captureException(err, { extra: context });
  }

  captureMessage(msg: string, level: Sentry.SeverityLevel = 'info') {
    if (!this.initialized) return;
    Sentry.captureMessage(msg, level);
  }

  setUser(id: string, did: string) {
    if (!this.initialized) return;
    Sentry.setUser({ id, did });
  }
}
