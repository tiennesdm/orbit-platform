/**
 * Custom Feeds controller
 */

import { Body, Controller, Get, Param, Post, Put, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CustomFeedService, FeedRule } from './custom-feeds.service';
import { z } from 'zod';

const FeedSchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().max(300).optional(),
  emoji: z.string().max(10).optional(),
  isPublic: z.boolean().optional(),
  rules: z.array(z.object({
    type: z.enum(['mode', 'hashtag', 'author', 'engagement', 'time', 'media', 'lang', 'no_replies', 'min_likes']),
    value: z.any(),
  })),
});

@ApiTags('feeds')
@Controller('feeds')
export class CustomFeedController {
  constructor(private readonly f: CustomFeedService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post()
  async create(@CurrentUser('did') did: string, @Body() body: z.infer<typeof FeedSchema>) {
    return this.f.createFeed({ ownerDid: did, ...body });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Put(':id')
  async update(@Param('id') id: string, @CurrentUser('did') did: string, @Body() body: Partial<z.infer<typeof FeedSchema>>) {
    return this.f.updateFeed(id, did, body);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete(':id')
  async del(@Param('id') id: string, @CurrentUser('did') did: string) {
    await this.f.deleteFeed(id, did);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('mine')
  async mine(@CurrentUser('did') did: string) {
    return this.f.listMyFeeds(did);
  }

  @Public()
  @Get('public')
  async publicList(@Query('limit') limit?: string) {
    return this.f.listPublicFeeds(limit ? parseInt(limit, 10) : 30);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':id/pin')
  async pin(@Param('id') id: string, @CurrentUser('did') did: string, @Body() body: { position: number }) {
    await this.f.pin(id, did, body.position);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':id/subscribe')
  async subscribe(@Param('id') id: string, @CurrentUser('did') did: string) {
    await this.f.subscribe(did, id);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete(':id/subscribe')
  async unsubscribe(@Param('id') id: string, @CurrentUser('did') did: string) {
    await this.f.unsubscribe(did, id);
    return { ok: true };
  }
}
