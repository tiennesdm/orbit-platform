import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../decorators/public.decorator';
import { MetricsService } from './metrics.service';
import { contentType } from 'prom-client';

@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @Get('metrics')
  @Header('Content-Type', contentType)
  async metrics_endpoint() {
    return this.metrics.registry.metrics();
  }
}
