/**
 * Health endpoints — Kubernetes-style probes
 *
 * /health/live   — process is alive (K8s liveness probe)
 * /health/ready  — can serve traffic (K8s readiness probe)
 * /health/startup — finished booting (K8s startup probe)
 * /health        — full health check (DB, etc.)
 */

import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HealthIndicatorResult } from '@nestjs/terminus';
import { getVedadbPool } from '@orbit/db';
import { Public } from '../decorators/public.decorator';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Gauge } from 'prom-client';

let startupComplete = false;
export function markStartupComplete() {
  startupComplete = true;
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
  ) {}

  /**
   * Full health check (DB, auth, etc.) — used by monitoring systems
   * Returns 503 if any check fails so K8s/load balancers can mark unhealthy
   */
  @Public()
  @Get()
  @HealthCheck()
  async check() {
    const result = await this.health.check([
      () => this.checkVedadb('vedadb'),
      () => this.checkMemory('memory'),
    ]);
    if (result.status === 'error') {
      throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }

  /**
   * K8s liveness probe — is the process alive?
   * Should NEVER depend on external services (DB, etc.) — if it does,
   * a temporary DB outage will restart the pod, making things worse.
   */
  @Public()
  @Get('live')
  live() {
    return {
      status: 'live',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * K8s readiness probe — can the process serve traffic right now?
   * Checks DB connectivity. If down, K8s removes the pod from service
   * but does NOT restart it (vs liveness).
   */
  @Public()
  @Get('ready')
  async ready() {
    if (!startupComplete) {
      throw new HttpException({ status: 'starting', reason: 'startup not complete' }, HttpStatus.SERVICE_UNAVAILABLE);
    }
    try {
      const pool = getVedadbPool();
      await pool.query('SELECT 1');
      return {
        status: 'ready',
        startupComplete,
        dbReachable: true,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      throw new HttpException(
        { status: 'not_ready', reason: 'db unreachable', error: err.message },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * K8s startup probe — has the process finished booting?
   * Returns 503 until startup is complete (migrations done, etc.)
   * Once startup is done, this endpoint is never called again by K8s.
   */
  @Public()
  @Get('startup')
  startup() {
    if (!startupComplete) {
      throw new HttpException(
        { status: 'starting', timestamp: new Date().toISOString() },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { status: 'started', timestamp: new Date().toISOString() };
  }

  private async checkVedadb(key: string): Promise<HealthIndicatorResult> {
    try {
      const pool = getVedadbPool();
      const start = Date.now();
      const res = await pool.query<{ now: Date; version: string }>('SELECT NOW() as now, VERSION() as version');
      const latencyMs = Date.now() - start;
      return {
        [key]: {
          status: latencyMs < 1000 ? 'up' : 'degraded',
          engine: pool.info.engine,
          version: res.rows[0]?.version?.split(' ').slice(0, 2).join(' '),
          latencyMs,
          timestamp: res.rows[0]?.now,
        },
      };
    } catch (err: any) {
      return { [key]: { status: 'down', error: err.message?.slice(0, 200) } };
    }
  }

  private async checkMemory(key: string): Promise<HealthIndicatorResult> {
    const used = process.memoryUsage();
    const heapUsedMb = Math.round(used.heapUsed / 1024 / 1024);
    const heapTotalMb = Math.round(used.heapTotal / 1024 / 1024);
    const rssMb = Math.round(used.rss / 1024 / 1024);
    // Mark as down if RSS > 1.5GB (likely memory leak)
    const status = rssMb > 1536 ? 'down' : rssMb > 1024 ? 'degraded' : 'up';
    return {
      [key]: {
        status,
        heapUsedMb,
        heapTotalMb,
        rssMb,
        externalMb: Math.round(used.external / 1024 / 1024),
      },
    };
  }
}
