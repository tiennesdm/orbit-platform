import { Global, Module, OnModuleInit } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';
import { TracingService } from './tracing.service';
import { SentryService } from './sentry.service';

@Global()
@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: { enabled: true },
      defaultLabels: {
        app: 'orbit-api',
        env: process.env.NODE_ENV || 'development',
      },
    }),
  ],
  controllers: [MetricsController],
  providers: [
    MetricsService,
    TracingService,
    SentryService,
    MetricsInterceptor,
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
  ],
  exports: [MetricsService, TracingService, SentryService],
})
export class ObservabilityModule implements OnModuleInit {
  constructor(private readonly sentry: SentryService) {}
  async onModuleInit() {
    await this.sentry.init();
  }
}
