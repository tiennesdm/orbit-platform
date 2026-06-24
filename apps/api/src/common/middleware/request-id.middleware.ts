/**
 * Request ID middleware — sets a unique ID per request for tracing
 *
 * - Reads X-Request-ID from inbound request (if any)
 * - Generates a new UUID if not present
 * - Stores it on the request object as `req.id`
 * - Sets it on the response as X-Request-ID header
 * - Available via getReqId(req) helper
 */

import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

declare module 'express-serve-static-core' {
  interface Request {
    id?: string;
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = (req.headers['x-request-id'] as string) || '';
  const reqId = incoming.match(/^[A-Za-z0-9_-]{1,128}$/) ? incoming : randomUUID();
  req.id = reqId;
  res.setHeader('X-Request-ID', reqId);
  next();
}

export function getReqId(req: Request): string | undefined {
  return req.id;
}
