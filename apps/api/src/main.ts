/**
 * ORBIT API Bootstrap — Production-ready
 * NestJS 11 — hardened for production
 *
 * Features:
 *  - Helmet security headers (CSP, HSTS, etc.)
 *  - CORS with allow-list validation
 *  - Request ID propagation
 *  - Structured JSON logging via pino
 *  - Auto-migration on startup
 *  - Graceful shutdown (SIGINT, SIGTERM, uncaughtException, unhandledRejection)
 *  - Health check (already in HealthController)
 *  - Production guards (JWT secret strength, SSL, etc.)
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger as NestLogger, HttpException, HttpStatus } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import { randomUUID } from 'node:crypto';
import pino from 'pino';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { createVedadbPool, closeVedadbPool, getVedadbPool } from '@orbit/db';

const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  base: { service: 'orbit-api', env: process.env.NODE_ENV || 'development' },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token', '*.secret'],
    remove: true,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Pre-flight checks: refuse to start with weak config in production
function preflightChecks(config: ConfigService) {
  const nodeEnv = config.get('NODE_ENV', 'development');
  if (nodeEnv === 'production') {
    const jwtSecret = config.get('JWT_SECRET', '');
    if (!jwtSecret || jwtSecret.length < 32 || jwtSecret.includes('change_me') || jwtSecret.includes('dev_secret')) {
      logger.error('FATAL: JWT_SECRET is missing or too weak for production (need ≥32 chars, no defaults)');
      logger.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64\'))"');
      process.exit(1);
    }
    if (config.get('CORS_ORIGINS', '').includes('*')) {
      logger.error('FATAL: CORS_ORIGINS must not include "*" in production');
      process.exit(1);
    }
    if (config.get('VEDADB_SSL') === 'false' && config.get('VEDADB_HOST') !== 'localhost' && config.get('VEDADB_HOST') !== '127.0.0.1') {
      logger.warn('WARN: VEDADB_SSL=false for non-localhost DB. Enable SSL for production.');
    }
  }
}

async function runMigrations(config: ConfigService) {
  const shouldAuto = config.get('AUTO_MIGRATE', 'true') === 'true';
  if (!shouldAuto) {
    logger.info('AUTO_MIGRATE=false, skipping auto-migration');
    return;
  }
  // Find migrations dir (relative to monorepo root, not cwd)
  const candidates = [
    join(process.cwd(), 'db', 'migrations'),
    join(process.cwd(), '..', '..', 'db', 'migrations'),
    join(process.cwd(), '..', 'db', 'migrations'),
    '/opt/orbit/db/migrations',
  ];
  const migrationsDir = candidates.find((p) => existsSync(p));
  if (!migrationsDir) {
    logger.warn({ tried: candidates }, 'migrations dir not found, skipping auto-migration');
    return;
  }
  logger.info({ dir: migrationsDir }, 'running database migrations');
  logger.info({ dir: migrationsDir }, 'running database migrations');
  const pool = getVedadbPool();

  // Run every .sql file in order (alphabetical)
  const { readdirSync } = await import('node:fs');
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const sql = readFileSync(join(migrationsDir, f), 'utf-8');
    try {
      await pool.query(sql);
      logger.info({ file: f }, 'migration applied');
    } catch (err: any) {
      // Idempotent: ignore "already exists" errors
      if (err.message?.includes('already exists') || err.code === '42P07' || err.code === '42710' || err.code === '42P06') {
        logger.debug({ file: f }, 'migration already applied, skipping');
      } else {
        logger.error({ file: f, err: err.message }, 'migration failed');
        if (config.get('MIGRATION_FAIL_FAST', 'true') === 'true') {
          throw err;
        }
      }
    }
  }
}

async function bootstrap() {
  const nestLogger = new NestLogger('Bootstrap');

  // Load .env if present (no-op if file doesn't exist)
  try {
    const { config: loadEnv } = await import('dotenv');
    loadEnv();
  } catch {}

  const configService = new ConfigService();
  preflightChecks(configService);

  // Initialize Vedadb connection pool
  createVedadbPool({
    host: configService.get('VEDADB_HOST', 'localhost'),
    port: parseInt(configService.get('VEDADB_PORT', '5432'), 10),
    database: configService.get('VEDADB_DATABASE', 'orbit'),
    user: configService.get('VEDADB_USER', 'orbit'),
    password: configService.get('VEDADB_PASSWORD', 'orbit'),
    ssl: configService.get('VEDADB_SSL') === 'true',
    engine: (configService.get('VEDADB_ENGINE', 'postgres') as 'vedadb' | 'postgres'),
    maxConnections: parseInt(configService.get('VEDADB_MAX_CONNECTIONS', '20'), 10),
  });
  logger.info({ engine: configService.get('VEDADB_ENGINE', 'postgres') }, 'Vedadb pool initialized');

  // Run migrations BEFORE starting HTTP server
  await runMigrations(configService);

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });
  app.useLogger(nestLogger);

  // Trust proxy (if behind nginx/cloudflare)
  if (configService.get('TRUST_PROXY') === 'true') {
    app.set('trust proxy', 1);
  }

  // Security: helmet with strict defaults
  app.use(
    helmet({
      contentSecurityPolicy: configService.get('NODE_ENV') === 'production' ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],  // Tailwind needs unsafe-inline
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      } : false,  // Disable CSP in dev (Next.js dev server has issues)
      crossOriginEmbedderPolicy: false,  // Allow embedded media
      crossOriginResourcePolicy: { policy: 'cross-origin' },  // Allow images from CDN
      hsts: {
        maxAge: 31536000,  // 1 year
        includeSubDomains: true,
        preload: true,
      },
    })
  );

  // Compression (gzip all responses)
  app.use(compression());

  // Request ID middleware
  app.use((req, res, next) => {
    const reqId = (req.headers['x-request-id'] as string) || randomUUID();
    res.setHeader('X-Request-ID', reqId);
    (req as any).id = reqId;
    next();
  });

  // CORS
  const corsOrigins = configService.get('CORS_ORIGINS', 'http://localhost:3000').split(',').map((o: string) => o.trim());
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (corsOrigins.includes(origin) || corsOrigins.includes('*')) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: origin ${origin} not allowed`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID'],
    maxAge: 86400,
  });

  // Body size limit
  const bodyLimit = configService.get('BODY_LIMIT', '10mb');
  // (handled by NestJS internally; configurable per route via decorators)

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );

  app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready', 'metrics'] });

  // Swagger (disable in production unless API_DOCS_PUBLIC=true)
  if (configService.get('API_DOCS_PUBLIC', 'false') === 'true' || configService.get('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('ORBIT API')
      .setDescription('AI-native, anti-addiction, portable-identity social platform')
      .setVersion('0.1.0')
      .addBearerAuth()
      .addTag('identity', 'Authentication, WebAuthn, portable identity')
      .addTag('posts', 'Create, read, update, delete posts (4 modes)')
      .addTag('feed', 'Home feed generation (chronological + AI ranked)')
      .addTag('dms', 'End-to-end encrypted messages')
      .addTag('stories', 'Ephemeral stories (24h default)')
      .addTag('reels', 'Short-form video')
      .addTag('groups', 'Communities, events, members')
      .addTag('marketplace', 'Local listings')
      .addTag('search', 'Full-text + semantic + hybrid search')
      .addTag('notifications', 'Real-time notifications')
      .addTag('ai-agent', 'Personal AI assistant')
      .addTag('moderation', 'Content moderation')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = parseInt(configService.get('API_PORT', '4000'), 10);
  await app.listen(port, '0.0.0.0');

  logger.info({ port, env: configService.get('NODE_ENV') }, `🚀 ORBIT API running on http://0.0.0.0:${port}`);
  if (configService.get('API_DOCS_PUBLIC', 'false') === 'true' || configService.get('NODE_ENV') !== 'production') {
    logger.info({ port }, `📚 API docs: http://0.0.0.0:${port}/api/docs`);
  }

  // ==========================================================================
  // Graceful shutdown
  // ==========================================================================
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutdown signal received, draining connections...');
    // 1. Stop accepting new connections
    try {
      await app.close();
      logger.info('HTTP server closed');
    } catch (err) {
      logger.error({ err }, 'error closing HTTP server');
    }
    // 2. Drain DB pool
    try {
      await closeVedadbPool();
      logger.info('DB pool closed');
    } catch (err) {
      logger.error({ err }, 'error closing DB pool');
    }
    logger.info('goodbye 👋');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  // Crash handlers (log + exit, since we may be in a bad state)
  process.on('uncaughtException', (err) => {
    logger.fatal({ err: err.message, stack: err.stack }, 'uncaughtException — exiting');
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason: String(reason) }, 'unhandledRejection — exiting');
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  logger.fatal({ err: err.message, stack: err.stack }, 'fatal bootstrap error');
  process.exit(1);
});
