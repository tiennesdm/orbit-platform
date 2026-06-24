/**
 * Global exception filter — production-grade
 *
 * - Hides internal error details (stack traces, file paths, SQL) in production
 * - Returns sanitized 5xx errors with correlation ID
 * - Logs all errors with full details server-side
 * - Captures to Sentry if configured
 */

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { getReqId } from '../middleware/request-id.middleware';

const isProd = process.env.NODE_ENV === 'production';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const reqId = getReqId(req) || 'unknown';

    // 1) Map known HttpExceptions to status + payload
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let code: string | undefined;
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      if (typeof resp === 'string') {
        message = resp;
      } else if (typeof resp === 'object' && resp !== null) {
        const r = resp as any;
        message = r.message ?? exception.message;
        code = r.code ?? r.error;
        details = r.details;
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      // 2) Unknown error — log full details, return sanitized payload
      this.logger.error(
        {
          reqId,
          method: req.method,
          url: req.originalUrl || req.url,
          err: exception.message,
          stack: exception.stack,
        },
        'unhandled exception',
      );
      // Sentry capture (if initialized)
      if ((globalThis as any).Sentry) {
        try { (globalThis as any).Sentry.captureException(exception); } catch {}
      }
    } else {
      this.logger.error({ reqId, err: String(exception) }, 'unknown exception type');
    }

    // 3) In production, hide internals for 5xx errors
    let safeMessage = message;
    let safeDetails = details;
    if (isProd && status >= 500) {
      safeMessage = 'Internal server error';
      safeDetails = undefined;
    }

    // 4) Send response
    res.status(status).json({
      statusCode: status,
      error: code ?? (typeof safeMessage === 'string' ? safeMessage : 'Error'),
      message: safeMessage,
      details: safeDetails,
      requestId: reqId,
      timestamp: new Date().toISOString(),
    });
  }
}
