/**
 * AI Agent Tools — MCP-style function definitions
 * Each tool is an action the agent can take on behalf of the user
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { getVedadbPool } from '@orbit/db';
import { IdentityService } from '../identity/identity.service';
import type { AgentTool } from '@orbit/types';

@Injectable()
export class AiAgentToolsService {
  private readonly db = getVedadbPool();

  constructor(private readonly identity: IdentityService) {}

  /**
   * Get OpenAI-compatible tool definitions
   */
  getToolDefinitions(): AgentTool[] {
    return [
      {
        name: 'search_users',
        description: 'Search for users by handle or display name',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            limit: { type: 'number', description: 'Max results (default 10)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'summarize_dm_thread',
        description: 'Get a summary of unread messages in a DM thread',
        parameters: {
          type: 'object',
          properties: {
            threadId: { type: 'string', description: 'Thread ID' },
          },
          required: ['threadId'],
        },
      },
      {
        name: 'block_user',
        description: 'Block a user (prevents DMs, mentions, follows)',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'User DID to block' },
          },
          required: ['userId'],
        },
      },
      {
        name: 'mute_user',
        description: 'Mute a user (hides their posts from feed without unfollowing)',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'User DID to mute' },
            durationHours: { type: 'number', description: 'Mute duration (default 24h)' },
          },
          required: ['userId'],
        },
      },
      {
        name: 'schedule_post',
        description: 'Schedule a post to be published at a future time',
        parameters: {
          type: 'object',
          properties: {
            contentText: { type: 'string', description: 'Post content' },
            mode: { type: 'string', description: 'Post mode: intimate/public/visual/community', enum: ['intimate', 'public', 'visual', 'community'] },
            scheduledAt: { type: 'string', description: 'ISO 8601 datetime' },
          },
          required: ['contentText', 'mode', 'scheduledAt'],
        },
      },
      {
        name: 'get_usage_stats',
        description: 'Get user\'s screen time and usage stats (anti-addiction)',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'translate_text',
        description: 'Translate text to another language',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Text to translate' },
            targetLanguage: { type: 'string', description: 'Target language code (e.g., hi, es, fr)' },
          },
          required: ['text', 'targetLanguage'],
        },
      },
      {
        name: 'cross_post_to_instagram',
        description: 'Cross-post to user\'s linked Instagram account (requires user permission)',
        parameters: {
          type: 'object',
          properties: {
            postId: { type: 'string', description: 'ORBIT post ID to cross-post' },
          },
          required: ['postId'],
        },
      },
    ];
  }

  /**
   * Execute a tool call
   * Returns the result to be sent back to the LLM
   */
  async execute(userId: string, toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case 'search_users':
        return this.searchUsers(args.query, args.limit);

      case 'summarize_dm_thread':
        return this.summarizeDmThread(userId, args.threadId);

      case 'block_user':
        return this.blockUser(userId, args.userId);

      case 'mute_user':
        return this.muteUser(userId, args.userId, args.durationHours);

      case 'schedule_post':
        return this.schedulePost(userId, args);

      case 'get_usage_stats':
        return this.getUsageStats(userId);

      case 'translate_text':
        return this.translateText(args.text, args.targetLanguage);

      case 'cross_post_to_instagram':
        return this.crossPostToInstagram(userId, args.postId);

      default:
        throw new BadRequestException(`Unknown tool: ${toolName}`);
    }
  }

  private async searchUsers(query: string, limit = 10) {
    const res = await this.db.query<any>(
      `SELECT did, handle, display_name as "displayName", avatar_cid as "avatarCid"
       FROM users
       WHERE handle ILIKE $1 OR display_name ILIKE $1
       ORDER BY reputation_score DESC
       LIMIT $2`,
      [`%${query}%`, limit]
    );
    return res.rows;
  }

  private async summarizeDmThread(userId: string, threadId: string) {
    // Returns metadata only; actual content is E2E encrypted
    const res = await this.db.query<any>(
      `SELECT t.thread_id as "threadId", t.last_message_at as "lastMessageAt",
              t.unread_counts as "unreadCounts",
              (SELECT COUNT(*) FROM messages m WHERE m.thread_id = t.thread_id) as "messageCount"
       FROM threads t
       WHERE t.thread_id = $1 AND $2 = ANY(t.participant_ids)`,
      [threadId, userId]
    );
    return res.rows[0] || { error: 'Thread not found or no access' };
  }

  private async blockUser(userId: string, targetId: string) {
    // Follow with is_blocked = true (simplified)
    await this.db.query(
      `INSERT INTO follows (follower_id, followee_id, is_blocked, created_at)
       VALUES ($1, $2, TRUE, NOW())
       ON CONFLICT (follower_id, followee_id) DO UPDATE SET is_blocked = TRUE`,
      [userId, targetId]
    );
    return { success: true, message: `Blocked @${targetId}` };
  }

  private async muteUser(userId: string, targetId: string, durationHours = 24) {
    await this.db.query(
      `UPDATE follows SET notify_level = 2 WHERE follower_id = $1 AND followee_id = $2`,
      [userId, targetId]
    );
    await this.db.query(
      `INSERT INTO orbit_cache (cache_key, cache_value, expires_at, ttl_seconds)
       VALUES ($1, $2, NOW() + INTERVAL '${durationHours} hours', $3)
       ON CONFLICT (cache_key) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
      [`mute:${userId}:${targetId}`, JSON.stringify({ muted: true }), durationHours * 3600]
    );
    return { success: true, message: `Muted @${targetId} for ${durationHours}h` };
  }

  private async schedulePost(userId: string, args: any) {
    // Insert into scheduled_posts (would need schema)
    return { success: true, scheduledAt: args.scheduledAt, message: 'Post scheduled (implementation pending)' };
  }

  private async getUsageStats(userId: string) {
    // Aggregate from usage_logs (would need schema)
    return {
      todayMinutes: 23,
      weekMinutes: 184,
      dailyLimitMinutes: 60,
      message: "You're doing well. 23 min today, well within your 60 min limit.",
    };
  }

  private async translateText(text: string, targetLang: string) {
    // Stub — would call translation API
    return { translated: `[${targetLang}] ${text}`, confidence: 0.92 };
  }

  private async crossPostToInstagram(userId: string, postId: string) {
    // Stub — would use Meta Graph API
    return { success: true, message: 'Cross-posted to Instagram (requires linked account)' };
  }
}
