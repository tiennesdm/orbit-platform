import { Body, Controller, Get, Post, UseGuards, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AiCocreationService, AssetKind } from './ai-cocreation.service';
import { z } from 'zod';

const TextSchema = z.object({
  prompt: z.string().min(1).max(4000),
  voice: z.string().max(50).optional(),
  maxTokens: z.number().int().min(50).max(4000).optional(),
});

const CaptionSchema = z.object({
  topic: z.string().min(1).max(200),
  tone: z.string().max(30).optional(),
  count: z.number().int().min(1).max(10).optional(),
});

const ImageSchema = z.object({
  prompt: z.string().min(1).max(2000),
  style: z.string().max(50).optional(),
  size: z.enum(['square', 'portrait', 'landscape']).optional(),
});

const VideoSchema = z.object({
  prompt: z.string().min(1).max(2000),
  durationSec: z.number().int().min(1).max(60).optional(),
});

const AudioSchema = z.object({
  text: z.string().min(1).max(5000),
  voice: z.string().max(50).optional(),
});

const HashtagSchema = z.object({
  content: z.string().min(1).max(2000),
  count: z.number().int().min(1).max(15).optional(),
});

@ApiTags('ai-cocreate')
@Controller('ai-cocreate')
export class AiCocreationController {
  constructor(private readonly ai: AiCocreationService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('text')
  async text(@CurrentUser('did') did: string, @Body() body: z.infer<typeof TextSchema>) {
    return this.ai.generateText({ ownerDid: did, ...body });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('captions')
  async captions(@CurrentUser('did') did: string, @Body() body: z.infer<typeof CaptionSchema>) {
    return this.ai.generateCaptions({ ownerDid: did, ...body });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('image')
  async image(@CurrentUser('did') did: string, @Body() body: z.infer<typeof ImageSchema>) {
    return this.ai.generateImage({ ownerDid: did, ...body });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('video')
  async video(@CurrentUser('did') did: string, @Body() body: z.infer<typeof VideoSchema>) {
    return this.ai.generateVideo({ ownerDid: did, ...body });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('audio')
  async audio(@CurrentUser('did') did: string, @Body() body: z.infer<typeof AudioSchema>) {
    return this.ai.generateAudio({ ownerDid: did, ...body });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('hashtags')
  async hashtags(@CurrentUser('did') did: string, @Body() body: z.infer<typeof HashtagSchema>) {
    return this.ai.suggestHashtags({ ownerDid: did, ...body });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('assets')
  async assets(@CurrentUser('did') did: string, @Query('kind') kind?: AssetKind) {
    return this.ai.listMyAssets(did, kind);
  }
}
