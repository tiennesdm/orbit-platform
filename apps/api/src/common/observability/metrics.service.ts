import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Gauge, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  public readonly registry: Registry;

  // HTTP metrics
  public readonly httpRequestsTotal: Counter;
  public readonly httpRequestDuration: Histogram;
  public readonly httpErrorsTotal: Counter;

  // Business metrics
  public readonly postsCreated: Counter;
  public readonly followsCreated: Counter;
  public readonly dmsSent: Counter;
  public readonly aiAgentCalls: Counter;
  public readonly aiAgentTokensUsed: Counter;
  public readonly aiAgentLatency: Histogram;
  public readonly searchQueries: Counter;
  public readonly vectorSearches: Counter;
  public readonly mediaUploads: Counter;
  public readonly mediaUploadBytes: Counter;
  public readonly webauthnRegistrations: Counter;
  public readonly webauthnLogins: Counter;
  public readonly gdprExports: Counter;
  public readonly gdprDeletes: Counter;

  // System metrics
  public readonly activeUsers: Gauge;
  public readonly dbConnections: Gauge;
  public readonly cacheHits: Counter;
  public readonly cacheMisses: Counter;

  constructor() {
    this.registry = new Registry();

    this.httpRequestsTotal = new Counter({
      name: 'orbit_http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'orbit_http_request_duration_seconds',
      help: 'HTTP request duration',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
      registers: [this.registry],
    });

    this.httpErrorsTotal = new Counter({
      name: 'orbit_http_errors_total',
      help: 'Total HTTP errors (4xx/5xx)',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.postsCreated = new Counter({
      name: 'orbit_posts_created_total',
      help: 'Total posts created',
      labelNames: ['mode'],
      registers: [this.registry],
    });

    this.followsCreated = new Counter({
      name: 'orbit_follows_created_total',
      help: 'Total follow edges created',
      registers: [this.registry],
    });

    this.dmsSent = new Counter({
      name: 'orbit_dms_sent_total',
      help: 'Total DMs sent',
      labelNames: ['encrypted'],
      registers: [this.registry],
    });

    this.aiAgentCalls = new Counter({
      name: 'orbit_ai_agent_calls_total',
      help: 'AI agent chat calls',
      labelNames: ['tool', 'model'],
      registers: [this.registry],
    });

    this.aiAgentTokensUsed = new Counter({
      name: 'orbit_ai_agent_tokens_total',
      help: 'AI agent tokens used',
      labelNames: ['type'], // input|output
      registers: [this.registry],
    });

    this.aiAgentLatency = new Histogram({
      name: 'orbit_ai_agent_latency_seconds',
      help: 'AI agent response latency',
      labelNames: ['model'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.registry],
    });

    this.searchQueries = new Counter({
      name: 'orbit_search_queries_total',
      help: 'Search queries',
      labelNames: ['type'], // text|vector|hybrid
      registers: [this.registry],
    });

    this.vectorSearches = new Counter({
      name: 'orbit_vector_searches_total',
      help: 'Vector similarity searches',
      labelNames: ['entity'], // post|reel|user
      registers: [this.registry],
    });

    this.mediaUploads = new Counter({
      name: 'orbit_media_uploads_total',
      help: 'Media uploads',
      labelNames: ['type'], // image|video|audio
      registers: [this.registry],
    });

    this.mediaUploadBytes = new Counter({
      name: 'orbit_media_upload_bytes_total',
      help: 'Bytes uploaded',
      labelNames: ['type'],
      registers: [this.registry],
    });

    this.webauthnRegistrations = new Counter({
      name: 'orbit_webauthn_registrations_total',
      help: 'WebAuthn passkey registrations',
      registers: [this.registry],
    });

    this.webauthnLogins = new Counter({
      name: 'orbit_webauthn_logins_total',
      help: 'WebAuthn passkey logins',
      labelNames: ['result'], // success|fail
      registers: [this.registry],
    });

    this.gdprExports = new Counter({
      name: 'orbit_gdpr_exports_total',
      help: 'GDPR data export requests',
      registers: [this.registry],
    });

    this.gdprDeletes = new Counter({
      name: 'orbit_gdpr_deletes_total',
      help: 'GDPR account deletions',
      registers: [this.registry],
    });

    this.activeUsers = new Gauge({
      name: 'orbit_active_users',
      help: 'Currently active users (5min sliding window)',
      registers: [this.registry],
    });

    this.dbConnections = new Gauge({
      name: 'orbit_db_connections_active',
      help: 'Active DB connections',
      registers: [this.registry],
    });

    this.cacheHits = new Counter({
      name: 'orbit_cache_hits_total',
      help: 'Cache hits',
      labelNames: ['key_prefix'],
      registers: [this.registry],
    });

    this.cacheMisses = new Counter({
      name: 'orbit_cache_misses_total',
      help: 'Cache misses',
      labelNames: ['key_prefix'],
      registers: [this.registry],
    });
  }
}
