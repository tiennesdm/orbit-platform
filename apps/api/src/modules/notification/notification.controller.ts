import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Notification } from '@orbit/types';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'List user notifications (AI-organized)' })
  async list(
    @CurrentUser('did') did: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: string
  ): Promise<Notification[]> {
    return this.notifications.listForUser(
      did,
      limit ? parseInt(limit, 10) : undefined,
      unreadOnly === 'true'
    );
  }

  @Post(':notificationId/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markRead(
    @CurrentUser('did') did: string,
    @Param('notificationId') notificationId: string
  ): Promise<{ success: true }> {
    await this.notifications.markAsRead(did, notificationId);
    return { success: true };
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllRead(@CurrentUser('did') did: string): Promise<{ success: true }> {
    await this.notifications.markAllAsRead(did);
    return { success: true };
  }
}
