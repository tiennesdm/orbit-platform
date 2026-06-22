import { Injectable, ExecutionContext, CanActivate, Injectable as NestInjectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/**
 * Optional JWT auth — sets req.user if token is valid, but doesn't reject if not.
 * Use for endpoints that work for both anonymous + authenticated users.
 *
 * This is a direct implementation (not passport-based) to avoid the
 * "Unknown authentication strategy jwt" issue when passport-jwt isn't configured.
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return true; // anonymous ok
    }

    const token = authHeader.slice(7);
    try {
      const payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get('JWT_SECRET'),
        issuer: 'orbit',
        audience: 'orbit-api',
      });
      request.user = payload;
    } catch {
      // Invalid token — treat as anonymous
      request.user = null;
    }
    return true;
  }
}
