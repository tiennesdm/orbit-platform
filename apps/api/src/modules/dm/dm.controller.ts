import { Body, Controller, Get, Param, Post as HttpPost, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { z } from 'zod';
import { DmService } from './dm.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Thread, Message } from '@orbit/types';

const SendMessageSchema = z.object({
  threadId: z.string(),
  encryptedPayload: z.object({
    ciphertext: z.string(),
    ephemeralPublicKey: z.string().optional(),
    counter: z.number(),
  }),
  contentType: z.enum(['text', 'image', 'video', 'audio', 'file']).default('text'),
});

const CreateThreadSchema = z.object({
  otherUserId: z.string(),
});

@ApiTags('dms')
@ApiBearerAuth()
@Controller('dms')
export class DmController {
  constructor(private readonly dms: DmService) {}

  @Get('threads')
  @ApiOperation({ summary: 'List user DM threads' })
  async listThreads(
    @CurrentUser('did') did: string,
    @Query('limit') limit?: string
  ): Promise<Thread[]> {
    return this.dms.listThreads(did, limit ? parseInt(limit, 10) : undefined);
  }

  @HttpPost('threads')
  @ApiOperation({ summary: 'Get or create 1:1 thread with another user' })
  async getOrCreate(
    @CurrentUser('did') did: string,
    @Body() body: z.infer<typeof CreateThreadSchema>
  ): Promise<Thread> {
    return this.dms.getOrCreateThread(did, body.otherUserId);
  }

  @Get('threads/:threadId/messages')
  @ApiOperation({ summary: 'Get encrypted messages in a thread' })
  async getMessages(
    @CurrentUser('did') did: string,
    @Param('threadId') threadId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string
  ): Promise<Message[]> {
    return this.dms.getMessages(did, threadId, limit ? parseInt(limit, 10) : undefined, before);
  }

  @HttpPost('messages')
  @ApiOperation({ summary: 'Send an encrypted message (server cannot read content)' })
  async sendMessage(
    @CurrentUser('did') did: string,
    @Body() body: z.infer<typeof SendMessageSchema>
  ): Promise<Message> {
    return this.dms.sendMessage(did, body.threadId, body.encryptedPayload, body.contentType);
  }

  @HttpPost('messages/:messageId/read')
  @ApiOperation({ summary: 'Mark messages as read up to a message ID' })
  async markRead(
    @CurrentUser('did') did: string,
    @Param('messageId') messageId: string,
    @Body() body: { threadId: string }
  ): Promise<{ success: true }> {
    await this.dms.markAsRead(did, body.threadId, messageId);
    return { success: true };
  }
}
