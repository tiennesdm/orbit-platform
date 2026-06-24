import { Controller, Get, Query, Optional } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FeedService } from './feed.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { FeedResponse, PostMode } from '@orbit/types';

@ApiTags('feed')
@ApiBearerAuth()
@Controller('feed')
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  // Public — anonymous browsers see a generic trending feed; authenticated
  // users get personalized results. Crawlers and shareable links work.
  @Public()
  @Get('home')
  @ApiOperation({ summary: 'Get home feed (public — personalized if logged in)' })
  async home(
    @Optional() @CurrentUser('did') did: string | undefined,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('modes') modes?: string,
    @Query('algorithm') algorithm?: 'chronological' | 'ai_ranked' | 'hybrid'
  ): Promise<FeedResponse> {
    // For anonymous users, feed builds a chronological public fallback.
    return this.feed.buildFeed(did || '__public__', {
      userId: did,
      cursor,
      limit: limit ? parseInt(limit, 10) : undefined,
      modes: modes ? (modes.split(',') as PostMode[]) : undefined,
      algorithm,
    });
  }

  @Public()
  @Get('digest')
  @ApiOperation({ summary: 'Get daily digest (public — personalized if logged in)' })
  async digest(@Optional() @CurrentUser('did') did: string | undefined): Promise<{ summary: string }> {
    const summary = await this.feed.buildDigest(did);
    return { summary };
  }
}
