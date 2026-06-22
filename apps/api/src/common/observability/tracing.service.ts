import { Injectable } from '@nestjs/common';

@Injectable()
export class TracingService {
  private activeRequestId: string | null = null;

  getOrCreateRequestId(req: any): string {
    const existing = req.headers?.['x-request-id'];
    if (existing && typeof existing === 'string' && existing.length > 0) {
      return existing;
    }
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  setActive(id: string) {
    this.activeRequestId = id;
  }

  getActive(): string | null {
    return this.activeRequestId;
  }

  clearActive() {
    this.activeRequestId = null;
  }
}
