import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FeedService } from './feed.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { FeedResponse, PostMode } from '@orbit/types';

@ApiTags('feed')
@ApiBearerAuth()
@Controller('feed')
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get('home')
  @ApiOperation({ summary: 'Get personalized home feed' })
  async home(
    @CurrentUser('did') did: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('modes') modes?: string,
    @Query('algorithm') algorithm?: 'chronological' | 'ai_ranked' | 'hybrid'
  ): Promise<FeedResponse> {
    return this.feed.buildFeed(did, {
      userId: did,
      cursor,
      limit: limit ? parseInt(limit, 10) : undefined,
      modes: modes ? (modes.split(',') as PostMode[]) : undefined,
      algorithm,
    });
  }

  @Get('digest')
  @ApiOperation({ summary: 'Get AI-generated daily digest' })
  async digest(@CurrentUser('did') did: string): Promise<{ summary: string }> {
    const summary = await this.feed.buildDigest(did);
    return { summary };
  }
}
