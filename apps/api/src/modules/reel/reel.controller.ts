import { Body, Controller, Get, Param, Post as HttpPost, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { z } from 'zod';
import { ReelService } from './reel.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Reel } from '@orbit/types';

const CreateReelSchema = z.object({
  mediaId: z.string(),
  caption: z.string().max(2000).optional(),
  audioTrackId: z.string().optional(),
  hashtags: z.array(z.string()).max(30).optional(),
  durationMs: z.number().min(1000).max(180000), // 1s to 3min
});

@ApiTags('reels')
@ApiBearerAuth()
@Controller('reels')
export class ReelController {
  constructor(private readonly reels: ReelService) {}

  @Get('foryou')
  @ApiOperation({ summary: 'Get For You reels feed' })
  async forYou(
    @CurrentUser('did') did: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string
  ): Promise<Reel[]> {
    return this.reels.getForYouFeed(did, cursor, limit ? parseInt(limit, 10) : undefined);
  }

  @HttpPost()
  @ApiOperation({ summary: 'Create a new reel' })
  async create(
    @CurrentUser('did') did: string,
    @Body() body: z.infer<typeof CreateReelSchema>
  ): Promise<Reel> {
    return this.reels.create(did, body);
  }

  @HttpPost(':authorId/:reelId/view')
  @ApiOperation({ summary: 'Increment reel view count' })
  async view(
    @Param('authorId') authorId: string,
    @Param('reelId') reelId: string
  ): Promise<{ success: true }> {
    await this.reels.incrementView(reelId, authorId);
    return { success: true };
  }

  @HttpPost(':authorId/:reelId/like')
  @ApiOperation({ summary: 'Like a reel' })
  async like(
    @CurrentUser('did') did: string,
    @Param('authorId') authorId: string,
    @Param('reelId') reelId: string
  ): Promise<{ success: true }> {
    await this.reels.like(reelId, authorId, did);
    return { success: true };
  }
}
