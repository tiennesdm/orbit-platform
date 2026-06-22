import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';
import { TracingService } from './tracing.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    private readonly metrics: MetricsService,
    private readonly tracing: TracingService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = process.hrtime.bigint();
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    // Generate / propagate request ID
    const requestId = this.tracing.getOrCreateRequestId(req);
    res.setHeader('X-Request-ID', requestId);
    this.tracing.setActive(requestId);

    return next.handle().pipe(
      tap({
        next: () => this.record(start, req, res),
        error: () => this.record(start, req, res),
      }),
    );
  }

  private record(start: bigint, req: any, res: any) {
    const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
    const route = req.route?.path || req.path || 'unknown';
    const method = req.method;
    const status = String(res.statusCode);

    this.metrics.httpRequestsTotal.inc({ method, route, status });
    this.metrics.httpRequestDuration.observe({ method, route, status }, durationSec);

    if (res.statusCode >= 400) {
      this.metrics.httpErrorsTotal.inc({ method, route, status });
    }
  }
}
