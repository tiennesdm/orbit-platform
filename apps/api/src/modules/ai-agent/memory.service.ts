import { Injectable } from '@nestjs/common';
import { getVedadbPool } from '@orbit/db';

export interface MemoryEntry {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

@Injectable()
export class MemoryService {
  /**
   * Per-user short-term memory of recent AI interactions.
   * Stored in Vedadb (Postgres) with a 30-day TTL.
   */
  async getRecent(userDid: string, limit: number = 20): Promise<MemoryEntry[]> {
    const r = getVedadbPool().query(
      `SELECT role, content, created_at
       FROM ai_agent_memory
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'
       ORDER BY created_at DESC
       LIMIT $2`,
      [userDid, limit],
    );
    return r.rows.reverse();
  }

  async append(userDid: string, entry: { role: 'user' | 'assistant'; content: string }) {
    getVedadbPool().query(
      `INSERT INTO ai_agent_memory (user_id, role, content, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [userDid, entry.role, entry.content],
    );
  }

  async clear(userDid: string) {
    getVedadbPool().query(`DELETE FROM ai_agent_memory WHERE user_id = $1`, [userDid]);
  }
}
