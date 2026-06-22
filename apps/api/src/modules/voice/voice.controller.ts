/**
 * Voice Room controller — REST + WebRTC signaling
 */

import { Body, Controller, Get, Param, Post, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { VoiceRoomService } from './voice.service';
import { z } from 'zod';

const CreateRoomSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  visibility: z.enum(['public', 'intimate', 'close_friends']).default('public'),
  scheduledAt: z.string().datetime().optional(),
});

const SignalSchema = z.object({
  to: z.string(),
  sdp: z.any().optional(),
  answer: z.any().optional(),
  candidate: z.any().optional(),
});

@ApiTags('voice')
@Controller('voice')
export class VoiceRoomController {
  constructor(private readonly voice: VoiceRoomService) {}

  @Public()
  @Get('rooms')
  @ApiOperation({ summary: 'List live and scheduled voice rooms' })
  async list(@Query('limit') limit?: string) {
    return this.voice.listLive(limit ? parseInt(limit, 10) : 30);
  }

  @Public()
  @Get('rooms/:id')
  async get(@Param('id') id: string) {
    return this.voice.getRoom(id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('rooms')
  async create(@CurrentUser('did') did: string, @Body() body: z.infer<typeof CreateRoomSchema>) {
    return this.voice.createRoom({ hostDid: did, ...body });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('rooms/:id/start')
  async start(@Param('id') id: string, @CurrentUser('did') did: string) {
    return this.voice.startRoom(id, did);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('rooms/:id/end')
  async end(@Param('id') id: string, @CurrentUser('did') did: string) {
    await this.voice.endRoom(id, did);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('rooms/:id/join')
  async join(@Param('id') id: string, @CurrentUser('did') did: string, @Body() body: { role?: 'speaker' | 'listener' }) {
    return this.voice.joinRoom(id, did, body.role || 'listener');
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('rooms/:id/leave')
  async leave(@Param('id') id: string, @CurrentUser('did') did: string) {
    await this.voice.leaveRoom(id, did);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('rooms/:id/peers')
  async peers(@Param('id') id: string) {
    return this.voice.getRoomPeers(id);
  }

  // WebRTC signaling
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('rooms/:id/signal')
  async signal(@Param('id') id: string, @CurrentUser('did') did: string, @Body() body: z.infer<typeof SignalSchema>) {
    return this.voice.relaySignal(id, did, body.to, body);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('rooms/:id/signals')
  async signals(@Param('id') id: string, @CurrentUser('did') did: string) {
    return this.voice.getSignals(id, did);
  }
}
