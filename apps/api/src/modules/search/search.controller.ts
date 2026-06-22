import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SearchService, SearchEntity } from './search.service';
import { OptionalAuthGuard } from '../../common/auth/optional-auth.guard';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly svc: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Universal search (users, posts, reels, groups, listings, hashtags)' })
  @ApiBearerAuth()
  @UseGuards(OptionalAuthGuard)
  async search(
    @Req() req: any,
    @Query('q') q: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
  ) {
    const entity = (type as SearchEntity) || 'all';
    const lim = limit ? Math.min(parseInt(limit, 10), 50) : 20;
    const userId = req.user?.userId || null;
    return this.svc.search(q || '', entity, userId, lim);
  }
}
