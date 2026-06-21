/**
 * ORBIT API Bootstrap
 * NestJS 11 — single-process monolith for Phase 1
 * Can be split into microservices as scale demands
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { createVedadbPool, closeVedadbPool } from '@orbit/db';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Initialize Vedadb connection pool
  const configService = new ConfigService();
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
  logger.log(`Vedadb pool initialized (${configService.get('VEDADB_ENGINE', 'postgres')})`);

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  app.use(helmet());

  app.enableCors({
    origin: configService.get('CORS_ORIGINS', 'http://localhost:3000').split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'ready', 'metrics'],
  });

  // Swagger / OpenAPI
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

  const port = parseInt(configService.get('API_PORT', '4000'), 10);
  await app.listen(port);

  logger.log(`🚀 ORBIT API running on http://localhost:${port}`);
  logger.log(`📚 API docs: http://localhost:${port}/api/docs`);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, shutting down gracefully...');
    await closeVedadbPool();
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
