import { Body, Controller, Get, Param, Post, UseGuards, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RemixService, RemixKind } from './remix.service';
import { z } from 'zod';

const RemixSchema = z.object({
  remixPostId: z.string(),
  sourcePostId: z.string(),
  kind: z.enum(['duet', 'stitch', 'quote']),
  layout: z.any().optional(),
});

@ApiTags('remix')
@Controller('remix')
export class RemixController {
  constructor(private readonly r: RemixService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post()
  async create(@CurrentUser('did') did: string, @Body() body: z.infer<typeof RemixSchema>) {
    return this.r.createRemix(body);
  }

  @Public()
  @Get('of/:postId')
  async listOf(@Param('postId') postId: string, @Query('kind') kind?: RemixKind) {
    return this.r.listRemixesOf(postId, kind);
  }

  @Public()
  @Get('chain/:postId')
  async chain(@Param('postId') postId: string) {
    return this.r.getRemixChain(postId);
  }
}
