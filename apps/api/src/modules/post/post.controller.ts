import { Body, Controller, Delete, Get, Param, Post as HttpPost, Put, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { z } from 'zod';
import { PostService } from './post.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Post, CreatePostInput, UpdatePostInput, PostMode } from '@orbit/types';

const CreatePostSchema = z.object({
  mode: z.enum(['intimate', 'public', 'visual', 'community']),
  visibility: z.enum(['public', 'followers', 'friends', 'private', 'group']).optional(),
  groupId: z.string().optional(),
  parentId: z.string().optional(),
  rootId: z.string().optional(),
  contentText: z.string().max(5000).optional(),
  mediaIds: z.array(z.string()).max(20).optional(),
  hashtags: z.array(z.string()).optional(),
  mentions: z.array(z.string()).optional(),
});

const UpdatePostSchema = z.object({
  contentText: z.string().max(5000).optional(),
});

@ApiTags('posts')
@ApiBearerAuth()
@Controller('posts')
export class PostController {
  constructor(private readonly posts: PostService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new post (4 modes supported)' })
  async create(
    @CurrentUser('did') did: string,
    @Body() body: z.infer<typeof CreatePostSchema>
  ): Promise<Post> {
    return this.posts.create(did, body as CreatePostInput);
  }

  @Get(':authorId/:postId')
  @ApiOperation({ summary: 'Get a single post by ID' })
  async findOne(
    @Param('authorId') authorId: string,
    @Param('postId') postId: string
  ): Promise<Post> {
    const post = await this.posts.findById(authorId, postId);
    if (!post) throw new Error('Post not found');
    return post;
  }

  @Get()
  @ApiOperation({ summary: 'List posts (with filters)' })
  async list(
    @Query('authorId') authorId?: string,
    @Query('mode') mode?: PostMode,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string
  ): Promise<{ posts: Post[]; nextCursor?: string }> {
    return this.posts.findMany({
      authorId,
      mode,
      cursor,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Put(':authorId/:postId')
  @ApiOperation({ summary: 'Edit a post (author only)' })
  async update(
    @CurrentUser('did') did: string,
    @Param('authorId') authorId: string,
    @Param('postId') postId: string,
    @Body() body: z.infer<typeof UpdatePostSchema>
  ): Promise<Post> {
    return this.posts.update(authorId, postId, body as UpdatePostInput);
  }

  @Delete(':authorId/:postId')
  @ApiOperation({ summary: 'Delete a post (author only, soft delete)' })
  async delete(
    @CurrentUser('did') did: string,
    @Param('authorId') authorId: string,
    @Param('postId') postId: string
  ): Promise<{ success: true }> {
    await this.posts.delete(authorId, postId);
    return { success: true };
  }

  @HttpPost(':authorId/:postId/like')
  @ApiOperation({ summary: 'Like a post' })
  async like(
    @CurrentUser('did') did: string,
    @Param('authorId') authorId: string,
    @Param('postId') postId: string
  ): Promise<{ success: true }> {
    await this.posts.like(authorId, postId, did);
    return { success: true };
  }

  @HttpPost(':authorId/:postId/view')
  @ApiOperation({ summary: 'Increment view count' })
  async view(
    @Param('authorId') authorId: string,
    @Param('postId') postId: string
  ): Promise<{ success: true }> {
    await this.posts.incrementView(authorId, postId);
    return { success: true };
  }
}
