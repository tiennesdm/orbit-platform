import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { MetricsService } from '../../common/observability/metrics.service';
import { SentryService } from '../../common/observability/sentry.service';
import { McpToolRegistry, McpToolContext } from './mcp/mcp-tool';
import { MemoryService } from './memory.service';
import { PersonalityService } from './personality.service';
import { getVedadbPool } from '@orbit/db';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatContext {
  userId: string;
  did: string;
  autonomyLevel: 'ask' | 'suggest' | 'auto';
  personality: 'supportive' | 'witty' | 'professional' | 'playful';
  history?: ChatMessage[];
}

@Injectable()
export class AnthropicAgentService {
  private readonly logger = new Logger('AnthropicAgentService');
  private client: Anthropic | null = null;
  private readonly defaultModel = 'claude-sonnet-4-20250514';

  constructor(
    private readonly metrics: MetricsService,
    private readonly sentry: SentryService,
    private readonly tools: McpToolRegistry,
    private readonly memory: MemoryService,
    private readonly personality: PersonalityService,
  ) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
      this.logger.log('Anthropic Claude client initialized');
    } else {
      this.logger.warn('ANTHROPIC_API_KEY not set — falling back to echo mode');
    }
  }

  isLive(): boolean {
    return this.client !== null;
  }

  /**
   * Real chat with Claude. Has 8 MCP tools, persistent memory, and personality awareness.
   */
  async chat(message: string, ctx: ChatContext): Promise<string> {
    if (!this.client) {
      return this.fallback(message);
    }

    const start = Date.now();
    const tools = this.tools.list();
    const systemPrompt = this.buildSystemPrompt(ctx);

    try {
      // Get recent memory context
      const memory = await this.memory.getRecent(ctx.userId, 20);
      const personality = this.personality.get(ctx.personality);

      const messages: Anthropic.MessageParam[] = [
        ...(memory as Anthropic.MessageParam[]),
        { role: 'user', content: message },
      ];

      // First call: see if Claude wants to use tools
      const toolSchemas = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      }));

      let response = await this.client.messages.create({
        model: this.defaultModel,
        max_tokens: 1024,
        system: `${systemPrompt}\n\nPersonality: ${personality}`,
        tools: toolSchemas as any,
        messages,
      });

      // Tool-use loop (max 5 iterations to prevent runaway)
      let iterations = 0;
      const toolCtx: McpToolContext = { userId: ctx.userId, did: ctx.did };
      while (response.stop_reason === 'tool_use' && iterations < 5) {
        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
        );
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of toolUseBlocks) {
          try {
            const result = await this.tools.execute(
              block.name,
              block.input as Record<string, any>,
              toolCtx,
            );
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          } catch (err: any) {
            this.sentry.captureException(err, { tool: block.name });
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: `Error: ${err.message}`,
              is_error: true,
            });
          }
        }

        messages.push({ role: 'assistant', content: response.content });
        messages.push({ role: 'user', content: toolResults });

        response = await this.client.messages.create({
          model: this.defaultModel,
          max_tokens: 1024,
          system: `${systemPrompt}\n\nPersonality: ${personality}`,
          tools: toolSchemas as any,
          messages,
        });
        iterations++;
      }

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n');

      const latency = (Date.now() - start) / 1000;
      this.metrics.aiAgentLatency.observe({ model: this.defaultModel }, latency);
      this.metrics.aiAgentCalls.inc({ tool: 'chat', model: this.defaultModel });

      const inputTokens = response.usage?.input_tokens || 0;
      const outputTokens = response.usage?.output_tokens || 0;
      this.metrics.aiAgentTokensUsed.inc({ type: 'input' }, inputTokens);
      this.metrics.aiAgentTokensUsed.inc({ type: 'output' }, outputTokens);

      // Persist to memory
      await this.memory.append(ctx.userId, { role: 'user', content: message });
      await this.memory.append(ctx.userId, { role: 'assistant', content: text });

      return text;
    } catch (err: any) {
      this.sentry.captureException(err, { userId: ctx.userId });
      this.logger.error(`Claude API error: ${err.message}`);
      return this.fallback(message);
    }
  }

  private buildSystemPrompt(ctx: ChatContext): string {
    return `You are OrbitAI, the personal AI agent for the ORBIT social network.

You are helping user ${ctx.did} (id: ${ctx.userId}).

You have access to these MCP tools:
${this.tools.list().map((t) => `- ${t.name}: ${t.description}`).join('\n')}

Your autonomy level is "${ctx.autonomyLevel}":
- "ask": Ask before taking any action. Just suggest.
- "suggest": Suggest actions, but don't execute them yourself.
- "auto": Take action autonomously when the user clearly wants it.

Your role:
1. Help users discover content in their feed
2. Draft posts and replies (with the user's voice)
3. Summarize their notifications and DMs
4. Surface relevant people to follow
5. Answer questions about their account and ORBIT features
6. Protect user privacy — never share DMs or personal info without explicit consent

Format: Use plain prose, no markdown unless asked. Be concise. If unsure, ask.`;
  }

  private fallback(message: string): string {
    return `[orbit-echo] You said: "${message}". (Real AI agent will respond when ANTHROPIC_API_KEY is set.)`;
  }
}
