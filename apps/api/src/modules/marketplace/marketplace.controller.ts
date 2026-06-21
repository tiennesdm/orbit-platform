import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { z } from 'zod';
import { MarketplaceService } from './marketplace.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Listing } from '@orbit/types';

const CreateListingSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(5000).optional(),
  priceCents: z.number().int().positive(),
  currency: z.string().default('INR'),
  mediaIds: z.array(z.string()).max(10).optional(),
  category: z.string().max(50).optional(),
  itemCondition: z.enum(['new', 'like_new', 'good', 'fair']).optional(),
  locationLabel: z.string().max(200).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

@ApiTags('marketplace')
@ApiBearerAuth()
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Post()
  @ApiOperation({ summary: 'Create a marketplace listing' })
  async create(
    @CurrentUser('did') did: string,
    @Body() body: z.infer<typeof CreateListingSchema>
  ): Promise<Listing> {
    return this.marketplace.create(did, body);
  }

  @Get()
  @ApiOperation({ summary: 'Search listings (full-text + geo + category)' })
  async search(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string,
    @Query('radiusKm') radiusKm?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string
  ): Promise<{ listings: Listing[]; nextCursor?: string }> {
    return this.marketplace.search({
      q,
      category,
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
      radiusKm: radiusKm ? parseFloat(radiusKm) : undefined,
      cursor,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
