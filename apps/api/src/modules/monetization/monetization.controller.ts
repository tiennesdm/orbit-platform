/**
 * Monetization Controller — tips, subscriptions, paid posts
 */

import { Body, Controller, Get, Param, Post, Delete, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MonetizationService } from './monetization.service';
import { z } from 'zod';

const TipSchema = z.object({
  toDid: z.string(),
  amountPaise: z.number().int().min(100).max(10_000_000),
  message: z.string().max(500).optional(),
  postId: z.string().optional(),
});

const TierSchema = z.object({
  id: z.string().min(1).max(50).optional(), // auto-generated UUID if omitted
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  // Accept either amountPaise (canonical) or priceCents (mobile-friendly)
  amountPaise: z.number().int().min(100).optional(),
  priceCents: z.number().int().min(1).optional(),
  color: z.string().optional(),
  benefits: z.array(z.string()).optional(),
  perks: z.array(z.string()).optional(), // alias for benefits
}).refine((v) => v.amountPaise !== undefined || v.priceCents !== undefined, {
  message: 'Either amountPaise or priceCents is required',
});

const SubscribeSchema = z.object({
  creatorDid: z.string(),
  tierId: z.string(),
});

const PaywallSchema = z.object({
  postId: z.string(),
  minTierId: z.string(),
  previewText: z.string().max(500).optional(),
  fullContent: z.string().min(1),
});

@ApiTags('monetization')
@Controller('monetization')
export class MonetizationController {
  constructor(private readonly m: MonetizationService) {}

  // TIPS
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('tips')
  @ApiOperation({ summary: 'Send a tip' })
  async sendTip(@CurrentUser('did') did: string, @Body() body: z.infer<typeof TipSchema>) {
    this.m['logger']?.log?.(`sendTip did=${did} body=${JSON.stringify(body)}`);
    return this.m.sendTip({ fromDid: did, ...body });
  }

  @Public()
  @Get('creators/:handle/earnings')
  @ApiOperation({ summary: 'Get creator earnings (public aggregates)' })
  async getEarnings(@Param('handle') handle: string) {
    const user = await this.m['db'].query(`SELECT did FROM users WHERE handle = $1`, [handle.replace(/^@/, '')]);
    if (!user.rows[0]) return { error: 'Not found' };
    return this.m.getCreatorEarnings(user.rows[0].did);
  }

  // TIERS
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('tiers')
  async createTier(@CurrentUser('did') did: string, @Body() body: z.infer<typeof TierSchema>) {
    // Map mobile-friendly fields to canonical schema:
    //   priceCents → amountPaise (1 cent = 1 paise for now, USD-like)
    //   perks → benefits
    //   id → auto-generated UUID
    const { randomUUID } = await import('crypto');
    return this.m.createTier({
      creatorDid: did,
      id: body.id ?? randomUUID(),
      name: body.name,
      description: body.description,
      amountPaise: body.amountPaise ?? (body.priceCents ?? 0) * 100,
      color: body.color,
      benefits: body.benefits ?? body.perks,
    });
  }

  @Public()
  @Get('creators/:handle/tiers')
  async listTiers(@Param('handle') handle: string) {
    const user = await this.m['db'].query(`SELECT did FROM users WHERE handle = $1`, [handle.replace(/^@/, '')]);
    if (!user.rows[0]) return [];
    return this.m.listTiers(user.rows[0].did);
  }

  // SUBSCRIPTIONS
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('subscriptions')
  async subscribe(@CurrentUser('did') did: string, @Body() body: z.infer<typeof SubscribeSchema>) {
    return this.m.subscribe({ subscriberDid: did, ...body });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('subscriptions/:creatorDid')
  async cancel(@CurrentUser('did') did: string, @Param('creatorDid') creatorDid: string) {
    await this.m.cancelSubscription(did, creatorDid);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me/subscriptions')
  async mySubs(@CurrentUser('did') did: string) {
    return this.m.listMySubscriptions(did);
  }

  // PAID POSTS
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('posts/paywall')
  async paywall(@CurrentUser('did') did: string, @Body() body: z.infer<typeof PaywallSchema>) {
    await this.m.markPostPaywalled({ authorDid: did, ...body });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('posts/:postId/can-view')
  async canView(@CurrentUser('did') did: string, @Param('postId') postId: string) {
    return { canView: await this.m.canViewPaidPost({ postId, viewerDid: did }) };
  }
}
