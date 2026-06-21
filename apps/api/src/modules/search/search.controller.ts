import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SearchService } from './search.service';
import type { SearchResponse } from '@orbit/types';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly svc: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Universal search (users, posts, reels, groups, listings, hashtags)' })
  async search(
    @Query('q') q: string,
    @Query('type') type?: 'users' | 'posts' | 'reels' | 'groups' | 'listings' | 'hashtags' | 'all',
    @Query('limit') limit?: string,
    @Query('mode') mode?: 'public' | 'visual' | 'intimate' | 'community'
  ): Promise<SearchResponse> {
    return this.svc.search({
      q,
      type,
      limit: limit ? parseInt(limit, 10) : undefined,
      filters: mode ? { mode } : undefined,
    });
  }
}
