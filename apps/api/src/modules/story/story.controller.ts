import { Body, Controller, Get, Param, Post as HttpPost } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { z } from 'zod';
import { StoryService } from './story.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Story } from '@orbit/types';

const CreateStorySchema = z.object({
  mediaId: z.string(),
  textOverlay: z.string().max(500).optional(),
  backgroundColor: z.string().optional(),
  visibility: z.enum(['public', 'close_friends', 'custom']).default('public'),
  ttlSeconds: z.number().min(60).max(604800).optional(),
  isPersistent: z.boolean().optional(),
});

@ApiTags('stories')
@ApiBearerAuth()
@Controller('stories')
export class StoryController {
  constructor(private readonly stories: StoryService) {}

  @Get('feed')
  @ApiOperation({ summary: 'Get stories from followed users' })
  async feed(@CurrentUser('did') did: string): Promise<Story[]> {
    return this.stories.getStoriesForUser(did);
  }

  @HttpPost()
  @ApiOperation({ summary: 'Create a new story' })
  async create(
    @CurrentUser('did') did: string,
    @Body() body: z.infer<typeof CreateStorySchema>
  ): Promise<Story> {
    return this.stories.create(did, body);
  }

  @HttpPost(':authorId/:storyId/view')
  @ApiOperation({ summary: 'Mark a story as viewed' })
  async markViewed(
    @CurrentUser('did') did: string,
    @Param('authorId') authorId: string,
    @Param('storyId') storyId: string
  ): Promise<{ success: true }> {
    await this.stories.markViewed(storyId, authorId, did);
    return { success: true };
  }
}
