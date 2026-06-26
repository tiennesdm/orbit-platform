import { Controller, Get, Post, Delete, Req, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { GdprService } from './gdpr.service';

@ApiTags('gdpr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('gdpr')
export class GdprController {
  constructor(private readonly gdpr: GdprService) {}

  /**
   * Export as ZIP — contains:
   *  - data.json (full export)
   *  - README.txt (instructions)
   *  - MANIFEST.txt (what's in here, generated timestamp)
   *  - profile.json
   *  - posts.json
   *  - media.json
   *  - follows.json
   *  - likes.json
   *  - groups.json
   *  - marketplace.json
   *  - ai-memory.json
   *
   * Streamed response — no temp files on disk.
   */
  @Get('export.zip')
  @ApiOperation({
    summary: 'Export all user data as ZIP archive (GDPR Article 15 / 20 — Right to Portability)',
  })
  async exportZip(@Req() req: any, @Res() res: Response) {
    const did = req.user.did;
    const zipBuffer = await this.gdpr.exportUserDataAsZip(did);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="orbit-export-${did}-${Date.now()}.zip"`,
    );
    res.setHeader('Content-Length', zipBuffer.length.toString());
    res.send(zipBuffer);
  }

  /**
   * Legacy JSON export — kept for backwards compatibility.
   * New clients should use /export.zip.
   */
  @Get('export')
  @ApiOperation({
    summary: 'Export all user data as JSON (legacy — prefer /export.zip)',
    deprecated: true,
  })
  async export(@Req() req: any, @Res() res: Response) {
    const data = await this.gdpr.exportUserData(req.user.did);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="orbit-export-${req.user.did || 'user'}-${Date.now()}.json"`,
    );
    res.send(JSON.stringify(data, null, 2));
  }

  @Post('delete')
  @ApiOperation({ summary: 'Soft-delete account with 30-day grace period (GDPR Article 17 — Right to Erasure)' })
  async delete(@Req() req: any) {
    return this.gdpr.softDeleteUser(req.user.did);
  }

  @Post('cancel-delete')
  @ApiOperation({ summary: 'Cancel a pending deletion (re-login first if needed)' })
  async cancelDelete(@Req() req: any) {
    await this.gdpr.cancelDelete(req.user.did);
    return { ok: true, message: 'Account re-activated' };
  }

  @Delete('hard-delete')
  @ApiOperation({ summary: 'Hard-delete account immediately (irreversible)' })
  async hardDelete(@Req() req: any) {
    await this.gdpr.hardDeleteUser(req.user.did);
    return { ok: true };
  }
}