/**
 * AI Agent Service
 * - Personal AI assistant that works for the user, NOT the platform
 * - On-device (Llama 3.2 3B) + server fallback (Llama 3.1 70B)
 * - Capabilities: feed filter, DM summary, schedule, content creation, cross-agent comms
 *
 * This is ORBIT's killer feature.
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { getVedadbPool, OrbitCache } from '@orbit/db';
import { AiAgentToolsService } from './ai-agent-tools.service';
import type {
  AgentChatRequest,
  AgentChatResponse,
  AgentMessage,
  AgentState,
} from '@orbit/types';

@Injectable()
export class AiAgentService {
  private readonly db = getVedadbPool();
  private readonly cache: OrbitCache;

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
    private readonly tools: AiAgentToolsService
  ) {
    this.cache = new OrbitCache(this.db);
  }

  /**
   * Process a chat message from the user
   * Routes to server LLM (vLLM) or external API based on config
   */
  async chat(userId: string, request: AgentChatRequest): Promise<AgentChatResponse> {
    const state = await this.getState(userId);
    const messages = await this.buildConversationContext(userId, request.message);

    const systemPrompt = this.buildSystemPrompt(state, userId);

    const payload = {
      model: this.config.get('VEDADB_AI_MODEL', 'meta-llama/Llama-3.1-70B-Instruct'),
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
        { role: 'user', content: request.message },
      ],
      tools: this.tools.getToolDefinitions(),
      max_tokens: 4096,
      temperature: 0.7,
      stream: false,
    };

    let response: any;
    try {
      const aiBaseUrl = this.config.get('VEDADB_AI_RUNTIME', 'vllm') === 'anthropic'
        ? 'https://api.anthropic.com/v1'
        : this.config.get('AI_SERVER_URL', 'http://localhost:8000/v1');

      const apiKey = this.config.get('ANTHROPIC_API_KEY') || this.config.get('OPENAI_API_KEY') || 'dummy';

      const res = await firstValueFrom(
        this.http.post(`${aiBaseUrl}/chat/completions`, payload, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'anthropic-version': '2023-06-01',
          },
          timeout: 30000,
        })
      );
      response = res.data;
    } catch (err: any) {
      // Fallback: simple echo response for dev/test
      response = {
        choices: [{
          message: {
            role: 'assistant',
            content: `I received your message: "${request.message}". (AI server not configured — set ANTHROPIC_API_KEY or AI_SERVER_URL in .env)`,
          },
          finish_reason: 'stop',
        }],
      };
    }

    const assistantMessage = response.choices[0].message;
    const toolCalls = assistantMessage.tool_calls;

    // Save to conversation history
    await this.saveConversationMessage(userId, { role: 'user', content: request.message });
    await this.saveConversationMessage(userId, assistantMessage);

    // Execute tool calls if any
    let toolResults: AgentMessage[] = [];
    if (toolCalls && toolCalls.length > 0) {
      toolResults = await this.executeToolCalls(userId, toolCalls);

      // Optionally: make a follow-up call with tool results (multi-turn agent)
      // For simplicity: skip in MVP
    }

    return {
      message: {
        role: 'assistant',
        content: assistantMessage.content,
        toolCalls: toolCalls?.map((tc: any) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      },
      conversationId: request.conversationId || 'default',
      toolCallsMade: toolCalls?.map((tc: any) => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.function.name, arguments: tc.function.arguments },
      })),
      finishReason: assistantMessage.finish_reason || 'stop',
    };
  }

  /**
   * Build conversation context from cache
   */
  private async buildConversationContext(userId: string, latestMessage: string): Promise<AgentMessage[]> {
    const key = `agent:conversation:${userId}`;
    const history = (await this.cache.get<AgentMessage[]>(key)) || [];
    // Keep last 10 messages + current
    return history.slice(-10);
  }

  private async saveConversationMessage(userId: string, message: AgentMessage): Promise<void> {
    const key = `agent:conversation:${userId}`;
    const history = (await this.cache.get<AgentMessage[]>(key)) || [];
    history.push(message);
    // Keep last 50 messages, TTL 24h
    await this.cache.set(key, history.slice(-50), { ttlSeconds: 86400 });
  }

  /**
   * Execute tool calls from agent
   */
  private async executeToolCalls(userId: string, toolCalls: any[]): Promise<AgentMessage[]> {
    const results: AgentMessage[] = [];

    for (const tc of toolCalls) {
      try {
        const args = JSON.parse(tc.function.arguments);
        const result = await this.tools.execute(userId, tc.function.name, args);
        results.push({
          role: 'tool',
          toolCallId: tc.id,
          name: tc.function.name,
          content: JSON.stringify(result),
        });
      } catch (err: any) {
        results.push({
          role: 'tool',
          toolCallId: tc.id,
          name: tc.function.name,
          content: JSON.stringify({ error: err.message }),
        });
      }
    }

    return results;
  }

  private buildSystemPrompt(state: AgentState, userId: string): string {
    return `You are Orbit AI, a personal social media assistant for user ${userId}.

Your personality: ${state.personality}
Autonomy level: ${state.autonomyLevel} (ask = always confirm; suggest = propose actions; auto = act on user's behalf)

CRITICAL RULES:
1. You work for the USER, not the platform. Never manipulate or engage-bait.
2. Be honest, concise, and helpful. Don't use excessive emojis.
3. Prioritize user wellbeing over engagement metrics.
4. When in doubt, ask for clarification.
5. Respect user privacy. Never share data across users.

CAPABILITIES:
- Filter and rank feed (anti-addiction)
- Summarize DMs and threads
- Block spam and bad actors
- Schedule posts and content
- Draft replies and content
- Cross-app bridge (post to IG, LinkedIn, etc.)
- Translate content
- Negotiate on user's behalf (with permission)

Use tools when helpful. Always be transparent about what you're doing.`;
  }

  async getState(userId: string): Promise<AgentState> {
    const cached = await this.cache.get<AgentState>(`agent:state:${userId}`);
    if (cached) return cached;

    const res = await this.db.query<any>(
      `SELECT user_id as "userId", personality, autonomy_level as "autonomyLevel",
              enabled_features as "enabledFeatures", long_term_memory as "longTermMemory",
              episodic_memory as "episodicMemory", context_window_size as "contextWindowSize",
              updated_at as "updatedAt"
       FROM ai_agent_state WHERE user_id = $1`,
      [userId]
    );

    if (res.rows.length === 0) {
      // Initialize default state
      const defaultState: AgentState = {
        userId,
        personality: 'helpful',
        autonomyLevel: 'suggest',
        enabledFeatures: { feedFilter: true, dmSummary: true, spamBlock: true },
        longTermMemory: {},
        episodicMemory: {},
        contextWindowSize: 4096,
        updatedAt: new Date().toISOString(),
      };
      await this.db.query(
        `INSERT INTO ai_agent_state (user_id, personality, autonomy_level, enabled_features, long_term_memory, episodic_memory, context_window_size)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId, defaultState.personality, defaultState.autonomyLevel, JSON.stringify(defaultState.enabledFeatures), JSON.stringify(defaultState.longTermMemory), JSON.stringify(defaultState.episodicMemory), defaultState.contextWindowSize]
      );
      return defaultState;
    }

    return res.rows[0];
  }

  async updateState(userId: string, updates: Partial<AgentState>): Promise<AgentState> {
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (updates.personality) { fields.push(`personality = $${i++}`); values.push(updates.personality); }
    if (updates.autonomyLevel) { fields.push(`autonomy_level = $${i++}`); values.push(updates.autonomyLevel); }
    if (updates.enabledFeatures) { fields.push(`enabled_features = $${i++}`); values.push(JSON.stringify(updates.enabledFeatures)); }
    if (updates.longTermMemory) { fields.push(`long_term_memory = $${i++}`); values.push(JSON.stringify(updates.longTermMemory)); }
    if (updates.contextWindowSize) { fields.push(`context_window_size = $${i++}`); values.push(updates.contextWindowSize); }

    if (fields.length === 0) return this.getState(userId);

    fields.push(`updated_at = NOW()`);
    values.push(userId);

    await this.db.query(
      `UPDATE ai_agent_state SET ${fields.join(', ')} WHERE user_id = $${i}`,
      values
    );

    return this.getState(userId);
  }

  async generateDailyDigest(userId: string): Promise<string> {
    // Calls feed service to get posts, summarizes via LLM
    const posts = await this.db.query<any>(
      `SELECT p.content_text as "contentText", p.like_count as "likeCount", p.hashtags,
              u.display_name as "displayName", u.handle
       FROM posts p
       JOIN follows f ON f.followee_id = p.author_id
       JOIN users u ON u.did = p.author_id
       WHERE f.follower_id = $1 AND p.created_at > NOW() - INTERVAL '24 hours'
       ORDER BY p.like_count DESC LIMIT 20`,
      [userId]
    );

    if (posts.rows.length === 0) return 'No new posts from your network today. Take a break! 🧘';

    // Use LLM to summarize
    try {
      const aiBaseUrl = this.config.get('AI_SERVER_URL', 'http://localhost:8000/v1');
      const apiKey = this.config.get('ANTHROPIC_API_KEY') || 'dummy';

      const res = await firstValueFrom(
        this.http.post(`${aiBaseUrl}/chat/completions`, {
          model: this.config.get('VEDADB_AI_MODEL'),
          messages: [{
            role: 'user',
            content: `Summarize these top ${posts.rows.length} posts from the user's network in 2 sentences, then list top 3 with author and 1-line summary. Posts: ${JSON.stringify(posts.rows.slice(0, 10))}`,
          }],
          max_tokens: 300,
        }, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
          timeout: 15000,
        })
      );
      return res.data.choices[0].message.content;
    } catch {
      // Fallback: simple list
      const top3 = posts.rows.slice(0, 3).map((p: any) => `@${p.handle}: "${(p.contentText || '').slice(0, 60)}..."`).join('; ');
      return `Top posts today: ${top3}`;
    }
  }
}
