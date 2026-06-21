import { Body, Controller, Post as HttpPost } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { z } from 'zod';
import { ModerationService } from './moderation.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

const ReportSchema = z.object({
  targetType: z.enum(['post', 'user', 'reel', 'story', 'message']),
  targetId: z.string(),
  reason: z.enum(['spam', 'harassment', 'hate_speech', 'nudity', 'violence', 'misinformation', 'other']),
  description: z.string().max(2000).optional(),
});

@ApiTags('moderation')
@ApiBearerAuth()
@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @HttpPost('score')
  @ApiOperation({ summary: 'Score content (internal — for pre-publish hooks)' })
  async score(
    @CurrentUser('did') did: string,
    @Body() body: { text?: string; imageUrls?: string[] }
  ) {
    return this.moderation.scoreContent({ ...body, userId: did });
  }

  @HttpPost('report')
  @ApiOperation({ summary: 'Report content or user' })
  async report(
    @CurrentUser('did') did: string,
    @Body() body: z.infer<typeof ReportSchema>
  ) {
    return this.moderation.report({ reporterId: did, ...body });
  }
}
