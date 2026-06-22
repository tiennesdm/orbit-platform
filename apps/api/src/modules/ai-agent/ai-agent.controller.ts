import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { AnthropicAgentService } from './anthropic-agent.service';
import { getVedadbPool } from '@orbit/db';

@ApiTags('ai-agent')
@Controller('ai-agent')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class AiAgentController {
  constructor(private readonly agent: AnthropicAgentService) {}

  @Get('state')
  @ApiOperation({ summary: 'Get current AI agent state for the user' })
  async state(@Req() req: any) {
    const did = req.user.did;
    const r = await getVedadbPool().query(
      `SELECT autonomy_level::text, personality
       FROM ai_agent_state WHERE user_id = $1`,
      [did],
    );
    const state = r.rows[0] || { autonomy_level: 'suggest', personality: 'supportive' };
    return {
      autonomyLevel: this.autonomyNumToStr(parseInt(state.autonomy_level, 10)),
      personality: state.personality,
      liveMode: this.agent.isLive(),
    };
  }

  @Post('state')
  @ApiOperation({ summary: 'Update AI agent state' })
  async updateState(@Req() req: any, @Body() body: { autonomyLevel?: string; personality?: string }) {
    const did = req.user.did;
    const validPersonality = ['helpful', 'supportive', 'witty', 'professional', 'playful'].includes(body.personality || '')
      ? body.personality
      : 'supportive';
    const autonomyNum = body.autonomyLevel === 'ask' ? 0 : body.autonomyLevel === 'auto' ? 2 : 1;
    await getVedadbPool().query(
      `INSERT INTO ai_agent_state (user_id, autonomy_level, personality)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE
       SET autonomy_level = $2,
           personality = $3`,
      [did, autonomyNum, validPersonality],
    );
    return { ok: true };
  }

  @Post('chat')
  @ApiOperation({ summary: 'Chat with the AI agent' })
  async chat(@Req() req: any, @Body() body: { message: string; history?: any[] }) {
    const did = req.user.did;
    const s = await getVedadbPool().query(
      `SELECT autonomy_level::text, personality FROM ai_agent_state WHERE user_id = $1`,
      [did],
    );
    const dbState = s.rows[0];
    const state = {
      autonomy_level: dbState ? this.autonomyNumToStr(parseInt(dbState.autonomy_level, 10)) : 'suggest',
      personality: dbState?.personality || 'supportive',
    };

    const reply = await this.agent.chat(body.message, {
      userId: did,
      did,
      autonomyLevel: state.autonomy_level as any,
      personality: state.personality as any,
      history: body.history,
    });

    return { reply, liveMode: this.agent.isLive() };
  }

  @Post('digest')
  @ApiOperation({ summary: 'Generate a digest of what the user missed' })
  async digest(@Req() req: any) {
    const did = req.user.did;
    const prompt = 'Give me a brief digest of what I missed today. Use your search_feed and get_unread_notifications tools.';
    const reply = await this.agent.chat(prompt, {
      userId: did,
      did,
      autonomyLevel: 'suggest',
      personality: 'supportive',
    });
    return { digest: reply, generatedAt: new Date().toISOString() };
  }

  private autonomyNumToStr(n: number): 'ask' | 'suggest' | 'auto' {
    if (n === 0) return 'ask';
    if (n === 2) return 'auto';
    return 'suggest';
  }
}
