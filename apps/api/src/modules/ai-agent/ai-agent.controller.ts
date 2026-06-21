import { Body, Controller, Get, Post as HttpPost, Put } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { z } from 'zod';
import { AiAgentService } from './ai-agent.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AgentChatRequest, AgentChatResponse, AgentState } from '@orbit/types';

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  conversationId: z.string().optional(),
  stream: z.boolean().optional(),
});

const UpdateStateSchema = z.object({
  personality: z.enum(['helpful', 'witty', 'professional', 'friendly', 'concise']).optional(),
  autonomyLevel: z.enum(['ask', 'suggest', 'auto']).optional(),
  enabledFeatures: z.record(z.boolean()).optional(),
  longTermMemory: z.record(z.any()).optional(),
  contextWindowSize: z.number().min(512).max(32768).optional(),
});

@ApiTags('ai-agent')
@ApiBearerAuth()
@Controller('ai-agent')
export class AiAgentController {
  constructor(private readonly agent: AiAgentService) {}

  @HttpPost('chat')
  @ApiOperation({ summary: 'Send a message to your personal AI assistant' })
  async chat(
    @CurrentUser('did') did: string,
    @Body() body: z.infer<typeof ChatRequestSchema>
  ): Promise<AgentChatResponse> {
    return this.agent.chat(did, body as AgentChatRequest);
  }

  @Get('state')
  @ApiOperation({ summary: 'Get AI agent state (personality, autonomy, memory)' })
  async getState(@CurrentUser('did') did: string): Promise<AgentState> {
    return this.agent.getState(did);
  }

  @Put('state')
  @ApiOperation({ summary: 'Update AI agent settings' })
  async updateState(
    @CurrentUser('did') did: string,
    @Body() body: z.infer<typeof UpdateStateSchema>
  ): Promise<AgentState> {
    return this.agent.updateState(did, body as Partial<AgentState>);
  }

  @Get('digest')
  @ApiOperation({ summary: 'Generate daily digest of network activity' })
  async digest(@CurrentUser('did') did: string): Promise<{ summary: string }> {
    const summary = await this.agent.generateDailyDigest(did);
    return { summary };
  }
}
