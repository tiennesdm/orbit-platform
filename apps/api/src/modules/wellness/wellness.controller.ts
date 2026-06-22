import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WellnessService } from './wellness.service';
import { z } from 'zod';

const SettingsSchema = z.object({
  dailyMinutesLimit: z.number().int().min(0).max(1440).optional(),
  weeklyMinutesLimit: z.number().int().min(0).max(10080).optional(),
  slowMode: z.boolean().optional(),
  hideLikesCount: z.boolean().optional(),
  hideRepostsCount: z.boolean().optional(),
  hideFollowersCount: z.boolean().optional(),
  noInfinitescroll: z.boolean().optional(),
  showTimer: z.boolean().optional(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  reminderIntervalMin: z.number().int().min(5).max(180).optional(),
});

const TickSchema = z.object({ seconds: z.number().int().min(1).max(300) });

const ParentalSchema = z.object({
  minorDid: z.string(),
  dailyMinutesLimit: z.number().int().min(5).max(1440).optional(),
  enabled: z.boolean().optional(),
});

@ApiTags('wellness')
@Controller('wellness')
export class WellnessController {
  constructor(private readonly w: WellnessService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('settings')
  async get(@CurrentUser('did') did: string) {
    return this.w.getSettings(did);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('settings')
  async update(@CurrentUser('did') did: string, @Body() body: z.infer<typeof SettingsSchema>) {
    return this.w.updateSettings(did, body);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('tick')
  async tick(@CurrentUser('did') did: string, @Body() body: z.infer<typeof TickSchema>) {
    return this.w.tickSession(did, body.seconds);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('usage')
  async usage(@CurrentUser('did') did: string) {
    return this.w.getUsage(did);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('parental')
  async parental(@CurrentUser('did') did: string, @Body() body: z.infer<typeof ParentalSchema>) {
    return this.w.setParentalControls({ guardianDid: did, ...body });
  }
}
