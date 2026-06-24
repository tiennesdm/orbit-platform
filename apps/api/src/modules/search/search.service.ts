import { Injectable, Logger } from '@nestjs/common';
import { getVedadbPool } from '@orbit/db';
import { EmbeddingsService } from './embeddings.service';
import { MetricsService } from '../../common/observability/metrics.service';

export type SearchEntity = 'post' | 'reel' | 'user' | 'group' | 'marketplace' | 'all';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly embeddings: EmbeddingsService,
    private readonly metrics: MetricsService,
  ) {}

  /**
   * Unified search — text + vector hybrid (when vector available).
   */
  async search(
    query: string,
    entityType: SearchEntity,
    userId: string | null,
    limit: number = 20,
  ): Promise<{
    query: string;
    entity: SearchEntity;
    results: any[];
    total: number;
    mode: 'hybrid' | 'text' | 'vector' | 'exact';
  }> {
    this.metrics.searchQueries.inc({ type: entityType === 'all' ? 'mixed' : entityType });

    const hasVector = this.embeddings.isAvailable();

    if (entityType === 'user') {
      return this.searchUsers(query, userId, limit);
    }
    if (entityType === 'post' || entityType === 'all') {
      if (hasVector) {
        const hybrid = await this.embeddings.hybridSearch(query, 'post', limit);
        const enriched = await this.enrichPosts(hybrid.map((r) => r.id), hybrid);
        return {
          query, entity: entityType, results: enriched, total: enriched.length, mode: 'hybrid',
        };
      }
      return this.searchPosts(query, userId, limit);
    }
    if (entityType === 'group') return this.searchGroups(query, limit);
    if (entityType === 'marketplace') return this.searchMarketplace(query, limit);

    return { query, entity: entityType, results: [], total: 0, mode: 'exact' };
  }

  private async searchPosts(query: string, _userId: string | null, limit: number) {
    this.logger.debug(`[searchPosts] query=${JSON.stringify(query)} limit=${limit}`);
    const r = await getVedadbPool().query(
      `SELECT p.post_id as id, p.content_text, p.hashtags, p.mode, p.created_at, p.author_id,
              u.handle, u.display_name,
              ts_rank_cd(p.search_vector, plainto_tsquery('english', $1)) AS rank
       FROM posts p
       JOIN users u ON u.did = p.author_id
       WHERE p.search_vector @@ plainto_tsquery('english', $1)
       ORDER BY rank DESC
       LIMIT $2`,
      [query, limit],
    );
    this.logger.debug(`[searchPosts] rowCount=${r.rowCount}`);
    return {
      query, entity: 'post' as const, results: r.rows, total: r.rowCount || 0, mode: 'text' as const,
    };
  }

  private async searchUsers(query: string, _userId: string | null, limit: number) {
    const r = getVedadbPool().query(
      `SELECT id, handle, display_name, bio, follower_count
       FROM users
       WHERE (handle ILIKE $1 OR display_name ILIKE $1 OR bio ILIKE $1)
         AND is_active = true
       ORDER BY follower_count DESC NULLS LAST
       LIMIT $2`,
      [`%${query}%`, limit],
    );
    return {
      query, entity: 'user' as const, results: r.rows, total: r.rowCount || 0, mode: 'exact' as const,
    };
  }

  private async searchGroups(query: string, limit: number) {
    const r = getVedadbPool().query(
      `SELECT id, name, slug, description, member_count
       FROM groups
       WHERE name ILIKE $1 OR description ILIKE $1
       ORDER BY member_count DESC NULLS LAST
       LIMIT $2`,
      [`%${query}%`, limit],
    );
    return { query, entity: 'group' as const, results: r.rows, total: r.rowCount || 0, mode: 'exact' as const };
  }

  private async searchMarketplace(query: string, limit: number) {
    const r = getVedadbPool().query(
      `SELECT id, title, description, price_cents, currency, status
       FROM marketplace_listings
       WHERE status = 'active' AND (title ILIKE $1 OR description ILIKE $1)
       ORDER BY created_at DESC
       LIMIT $2`,
      [`%${query}%`, limit],
    );
    return { query, entity: 'marketplace' as const, results: r.rows, total: r.rowCount || 0, mode: 'exact' as const };
  }

  private async enrichPosts(ids: string[], scores: any[]) {
    if (ids.length === 0) return [];
    const r = getVedadbPool().query(
      `SELECT p.post_id as id, p.content_text, p.hashtags, p.mode, p.created_at, p.author_id,
              u.handle, u.display_name
       FROM posts p
       JOIN users u ON u.did = p.author_id
       WHERE p.post_id::text = ANY($1::text[]) OR (p.author_id || ':' || p.post_id::text) = ANY($1::text[])`,
      [ids],
    );
    const scoreMap = new Map(scores.map((s) => [s.id, s.score]));
    return r.rows
      .map((row) => ({ ...row, score: scoreMap.get(row.id) || 0 }))
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  }
}
