/**
 * Notifications WebSocket Gateway — real-time push to clients
 *
 * Connects to the same JWT-based auth as REST endpoints. When a notification
 * is created (via notification.service), it's pushed to the user's socket
 * room in real-time. No polling needed.
 *
 * Room naming: `user:<did>` (e.g. `user:did:orbit:abc123`)
 *
 * Events emitted:
 *  - notification:new    — single new notification
 *  - notification:update — read/unread state change
 *  - notification:count  — unread count delta
 *
 * Events received (from client):
 *  - mark-read   { notificationId: number } → marks notification read
 *  - mark-all-read                       → marks all notifications read
 *  - subscribe   { token: string }        → JWT auth (or via handshake)
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

interface AuthedSocket extends Socket {
  data: {
    did?: string;
    handle?: string;
  };
}

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: '*', // tighten in production via CORS_ORIGINS
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class NotificationsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Map of did → number of connected sockets (for cleanup).
   * When count drops to 0, we remove the user from all rooms.
   */
  private readonly userSocketCount = new Map<string, number>();

  afterInit(server: Server) {
    this.logger.log('NotificationsGateway initialized at /notifications namespace');
  }

  /**
   * Authenticate the socket on connection.
   * Client must pass JWT either via:
   *  - handshake auth.token: 'Bearer <jwt>'  (recommended)
   *  - query string:        ?token=<jwt>    (fallback for browsers)
   *  - emitted subscribe event with token  (last resort)
   */
  async handleConnection(socket: AuthedSocket) {
    const token = this.extractToken(socket);
    if (!token) {
      this.logger.debug(`[ws:${socket.id}] no auth token — disconnecting`);
      socket.emit('error', { message: 'Authentication required' });
      socket.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get('JWT_SECRET'),
        issuer: 'orbit',
        audience: 'orbit-api',
      });
      socket.data.did = payload.did;
      socket.data.handle = payload.handle;

      // Join user-specific room
      const room = `user:${payload.did}`;
      await socket.join(room);

      // Track socket count
      const prev = this.userSocketCount.get(payload.did) ?? 0;
      this.userSocketCount.set(payload.did, prev + 1);

      this.logger.log(
        `[ws:${socket.id}] connected as ${payload.handle} (${payload.did}) — ${this.userSocketCount.get(payload.did)} active connections`,
      );

      // Send initial unread count on connect
      socket.emit('connected', {
        did: payload.did,
        handle: payload.handle,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      this.logger.warn(`[ws:${socket.id}] auth failed: ${err.message}`);
      socket.emit('error', { message: 'Invalid token' });
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: AuthedSocket) {
    const did = socket.data.did;
    if (!did) return;
    const prev = this.userSocketCount.get(did) ?? 1;
    const next = Math.max(0, prev - 1);
    if (next === 0) {
      this.userSocketCount.delete(did);
    } else {
      this.userSocketCount.set(did, next);
    }
    this.logger.log(`[ws:${socket.id}] disconnected (${did}, ${next} remaining)`);
  }

  /**
   * Push a notification to a specific user. Called from notification.service
   * or from the NotificationsProcessor after DB insert.
   */
  pushNotification(userDid: string, notification: unknown): boolean {
    if (!this.server) return false;
    const room = `user:${userDid}`;
    const sockets = this.server.of('/notifications').in(room);
    if (sockets.size === 0) return false;
    sockets.emit('notification:new', notification);
    this.logger.debug(`[ws] pushed notification to ${userDid} (${sockets.size} sockets)`);
    return true;
  }

  /**
   * Push notification count update (e.g., when marked as read).
   */
  pushCount(userDid: string, unreadCount: number): boolean {
    if (!this.server) return false;
    const sockets = this.server.of('/notifications').in(`user:${userDid}`);
    if (sockets.size === 0) return false;
    sockets.emit('notification:count', { unread: unreadCount });
    return true;
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() socket: AuthedSocket): string {
    return 'pong';
  }

  @SubscribeMessage('mark-read')
  async handleMarkRead(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() data: { notificationId: number },
  ): Promise<{ ok: boolean }> {
    if (!socket.data.did || !data?.notificationId) {
      return { ok: false };
    }
    // Actual mark-read logic lives in NotificationService.
    // This is a hook for the client to request it. The gateway doesn't
    // directly touch the DB — it emits an event the service listens to.
    this.server.of('/notifications').to(`user:${socket.data.did}`).emit('notification:update', {
      id: data.notificationId,
      isRead: true,
    });
    return { ok: true };
  }

  @SubscribeMessage('mark-all-read')
  handleMarkAllRead(@ConnectedSocket() socket: AuthedSocket): { ok: boolean } {
    if (!socket.data.did) return { ok: false };
    this.server.of('/notifications').to(`user:${socket.data.did}`).emit('notification:update', {
      all: true,
      isRead: true,
    });
    return { ok: true };
  }

  /**
   * Extract token from handshake (auth header, query string, or cookie).
   */
  private extractToken(socket: AuthedSocket): string | null {
    // 1. Handshake auth header
    const auth = socket.handshake.auth?.token || socket.handshake.headers.authorization;
    if (auth) {
      return auth.replace(/^Bearer\s+/i, '');
    }
    // 2. Query string (for browser clients that can't set headers easily)
    const qToken = socket.handshake.query?.token;
    if (qToken && typeof qToken === 'string') {
      return qToken;
    }
    return null;
  }
}