import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HealthIndicatorResult } from '@nestjs/terminus';
import { getVedadbPool } from '@orbit/db';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthCheckService) {}

  @Get()
  @HealthCheck()
  async check() {
    return this.health.check([
      () => this.checkVedadb('vedadb'),
      () => this.checkAuth('auth'),
    ]);
  }

  private async checkVedadb(key: string): Promise<HealthIndicatorResult> {
    try {
      const pool = getVedadbPool();
      const res = await pool.query<{ now: Date; version: string }>('SELECT NOW() as now, VERSION() as version');
      const isVedadb = res.rows[0]?.version?.toLowerCase().includes('vedadb') ?? false;
      return {
        [key]: {
          status: 'up',
          engine: pool.info.engine,
          version: res.rows[0]?.version,
          timestamp: res.rows[0]?.now,
          vedadbDetected: isVedadb,
        },
      };
    } catch (err: any) {
      return { [key]: { status: 'down', error: err.message } };
    }
  }

  private async checkAuth(key: string): Promise<HealthIndicatorResult> {
    return { [key]: { status: 'up' } };
  }

  @Get('ready')
  ready() {
    return { status: 'ready', timestamp: new Date().toISOString() };
  }

  @Get('live')
  live() {
    return { status: 'live', timestamp: new Date().toISOString() };
  }
}
