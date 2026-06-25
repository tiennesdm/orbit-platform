/**
 * Custom Feeds controller
 */

import { Body, BadRequestException, Controller, Get, Param, Post, Put, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CustomFeedService, FeedRule } from './custom-feeds.service';
import { z } from 'zod';

// SECURITY: per-rule-type value validation. Prevents SQL injection via the
// rule engine (was: `z.any()` → `'day; DROP TABLE users; --'` accepted).
// All string values are also regex-restricted to safe characters to prevent
// SQL injection even in fields where Zod's basic checks pass.
const SafeString = z.string().regex(/^[a-zA-Z0-9_.\-/@#:]+$/, 'unsafe characters in value');
const RuleValueByTypeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('mode'),        value: z.union([SafeString.max(40), z.array(SafeString).max(20)]) }),
  z.object({ type: z.literal('hashtag'),     value: SafeString.min(1).max(80) }),
  z.object({ type: z.literal('author'),      value: SafeString.min(3).max(60) }),
  z.object({ type: z.literal('engagement'),  value: z.number().int().min(0).max(1_000_000) }),
  z.object({ type: z.literal('time'),        value: z.enum(['hour', 'day', 'week']) }),
  z.object({ type: z.literal('media'),       value: z.enum(['media', 'text', 'any']) }),
  z.object({ type: z.literal('lang'),        value: SafeString.min(2).max(8) }),
  z.object({ type: z.literal('no_replies'),  value: z.boolean() }),
  z.object({ type: z.literal('min_likes'),   value: z.number().int().min(0).max(1_000_000) }),
]);
const FeedSchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().max(300).optional(),
  emoji: z.string().max(10).optional(),
  isPublic: z.boolean().optional(),
  rules: z.array(RuleValueByTypeSchema).min(1, 'rules must have at least one entry'),
});

@ApiTags('feeds')
@Controller('feeds')
export class CustomFeedController {
  constructor(private readonly f: CustomFeedService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post()
  async create(@CurrentUser('did') did: string, @Body() body: unknown) {
    // SECURITY: Zod validate @Body — class-validator doesn't enforce rule.value shape.
    // Convert ZodError → 400 BadRequest for proper API contract.
    const parsed = FeedSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid feed payload',
        errors: parsed.error.issues,
      });
    }
    return this.f.createFeed({ ownerDid: did, ...parsed.data });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Put(':id')
  async update(@Param('id') id: string, @CurrentUser('did') did: string, @Body() body: unknown) {
    const parsed = FeedSchema.partial().safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid feed payload',
        errors: parsed.error.issues,
      });
    }
    return this.f.updateFeed(id, did, parsed.data);
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
