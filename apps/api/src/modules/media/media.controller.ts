import {
  Controller, Get, Post, Delete, Param, Body, UseGuards, Req, Query,
  UseInterceptors, UploadedFile, BadRequestException, Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MediaService } from './media.service';

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('presign')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a presigned upload URL (S3) or local upload endpoint' })
  @UseGuards(JwtAuthGuard)
  async presign(
    @CurrentUser('did') ownerDid: string,
    @Body() body: { contentType: string; bytes: number },
  ) {
    return this.media.getPresignedUpload(ownerDid, body.contentType, body.bytes);
  }

  @Post('local-upload')
  @ApiOperation({ summary: 'Local upload fallback (when S3 not configured)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  async localUpload(
    @Query('key') key: string,
    @Query('type') contentType: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!key) throw new BadRequestException('key required');
    if (!file) throw new BadRequestException('file required');
    return this.media.saveLocal(key, file.buffer, contentType);
  }

  @Get('local/:key')
  @ApiOperation({
    summary: 'Serve a locally-stored media file',
    description:
      'M-7 WARNING: local-upload stores files on the API pod filesystem. ' +
      'In multi-replica deployments, files uploaded to pod A are NOT accessible ' +
      'from pod B. For production, use S3-backed presign uploads instead, or ' +
      'mount a shared PersistentVolume at /opt/orbit/uploads.',
  })
  async local(@Param('key') key: string, @Res() res: Response) {
    const decoded = decodeURIComponent(key);
    const result = await this.media.getLocal(decoded);
    if (!result) {
      res.status(404).send('Not found');
      return;
    }
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(result.buffer);
  }

  @Post('register')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register uploaded media metadata in the DB' })
  @UseGuards(JwtAuthGuard)
  async register(
    @CurrentUser('did') ownerDid: string,
    @Body() body: {
      // Canonical fields
      key?: string;
      type?: 'image' | 'video' | 'audio' | 'file';
      mimeType: string;
      bytes?: number;
      width?: number;
      height?: number;
      durationSec?: number;
      blurhash?: string;
      altText?: string;
      // Mobile-friendly aliases
      cid?: string;
      size?: number;
    },
  ) {
    // Normalize: mobile sends {cid, mimeType, size}, backend canonical is {key, type, mimeType, bytes}
    const normalized = {
      key: body.key || body.cid || '',
      type: body.type || 'image',
      mimeType: body.mimeType,
      bytes: body.bytes ?? body.size ?? 0,
      width: body.width,
      height: body.height,
      durationSec: body.durationSec,
      blurhash: body.blurhash,
      altText: body.altText,
    };
    return this.media.saveMetadata(ownerDid, normalized);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete media owned by the user' })
  @UseGuards(JwtAuthGuard)
  async delete(@CurrentUser('did') ownerDid: string, @Param('id') id: string) {
    await this.media.deleteMedia(id, ownerDid);
    return { ok: true };
  }
}
