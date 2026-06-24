import { Injectable, Logger } from '@nestjs/common';
import { getVedadbPool } from '@orbit/db';
import { MetricsService } from '../../common/observability/metrics.service';

/**
 * Vector embeddings service.
 *
 * - Generates 384-dim embeddings via @xenova/transformers (or OpenAI API)
 * - Stores in `embeddings` table with pgvector (hnsw index)
 * - Provides semantic search over posts, reels, users
 *
 * Falls back to zero-vector + exact match if no embedding model available.
 */
@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger('EmbeddingsService');
  private readonly dimension = 384; // all-MiniLM-L6-v2
  private pipeline: any = null;

  constructor(private readonly metrics: MetricsService) {
    this.initPipeline();
  }

  private async initPipeline() {
    const useOpenAI = !!process.env.OPENAI_API_KEY;
    if (useOpenAI) {
      this.logger.log('Using OpenAI text-embedding-3-small for embeddings');
      return;
    }
    try {
      // Lazy-load transformers
      const { pipeline } = await import('@xenova/transformers');
      this.pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      this.logger.log('Loaded @xenova/transformers all-MiniLM-L6-v2 (local)');
    } catch (err: any) {
      this.logger.warn(
        `Embedding model not available (${err.message}). Set OPENAI_API_KEY or install @xenova/transformers. Falling back to exact-match.`,
      );
    }
  }

  isAvailable(): boolean {
    return this.pipeline !== null || !!process.env.OPENAI_API_KEY;
  }

  /**
   * Generate embedding for a text.
   * Returns a normalized 384-dim float array.
   */
  async embed(text: string): Promise<number[]> {
    if (this.pipeline) {
      const result = await this.pipeline(text, { pooling: 'mean', normalize: true });
      return Array.from(result.data as Float32Array);
    }
    if (process.env.OPENAI_API_KEY) {
      return this.embedWithOpenAI(text);
    }
    // Fallback: deterministic hash-based "embedding" (for testing only)
    return this.hashFallback(text);
  }

  private async embedWithOpenAI(text: string): Promise<number[]> {
    // SECURITY: 10s timeout via AbortController — slow OpenAI shouldn't hang
    // the request thread indefinitely.
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 10000);
    let res: Response;
    try {
      res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: text,
          model: 'text-embedding-3-small',
          dimensions: 384,
        }),
        signal: ac.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) {
      throw new Error(`OpenAI embeddings API error: ${res.status}`);
    }
    const json: any = await res.json();
    return json.data[0].embedding;
  }

  private hashFallback(text: string): number[] {
    const v = new Array(this.dimension).fill(0);
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      v[c % this.dimension] += 1;
    }
    // Normalize
    const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1;
    return v.map((x) => x / norm);
  }

  /**
   * Store embedding for a piece of content.
   */
  async store(
    entityType: 'post' | 'reel' | 'user' | 'group' | 'marketplace',
    entityId: string,
    text: string,
  ): Promise<void> {
    const embedding = await this.embed(text);
    const vector = `[${embedding.join(',')}]`;
    getVedadbPool().query(
      `INSERT INTO embeddings (entity_type, entity_id, embedding, source_text, created_at)
       VALUES ($1, $2, $3::vector, $4, NOW())
       ON CONFLICT (entity_type, entity_id) DO UPDATE
       SET embedding = $3::vector, source_text = $4, created_at = NOW()`,
      [entityType, entityId, vector, text.slice(0, 1000)],
    );
  }

  /**
   * Semantic search — find entities similar to query.
   */
  async searchSimilar(
    query: string,
    entityType: 'post' | 'reel' | 'user' | 'group' | 'marketplace',
    limit: number = 10,
    threshold: number = 0.3,
  ): Promise<Array<{ id: string; similarity: number; metadata: any }>> {
    const embedding = await this.embed(query);
    const vector = `[${embedding.join(',')}]`;
    this.metrics.vectorSearches.inc({ entity: entityType });

    const r = getVedadbPool().query(
      `SELECT entity_id, 1 - (embedding <=> $1::vector) AS similarity
       FROM embeddings
       WHERE entity_type = $2 AND 1 - (embedding <=> $1::vector) > $3
       ORDER BY embedding <=> $1::vector
       LIMIT $4`,
      [vector, entityType, threshold, limit],
    );

    return r.rows.map((row) => ({
      id: row.entity_id,
      similarity: parseFloat(row.similarity),
      metadata: null, // caller can join to the entity table
    }));
  }

  /**
   * Hybrid search — combines full-text + vector similarity.
   */
  async hybridSearch(
    query: string,
    entityType: 'post' | 'reel' | 'user' | 'group' | 'marketplace',
    limit: number = 10,
  ): Promise<Array<{ id: string; score: number; source: 'text' | 'vector' | 'both' }>> {
    this.metrics.searchQueries.inc({ type: 'hybrid' });

    // Run both in parallel
    const [textResults, vectorResults] = await Promise.all([
      this.textSearch(query, entityType, limit),
      this.searchSimilar(query, entityType, limit),
    ]);

    const scoreMap = new Map<string, { score: number; source: 'text' | 'vector' | 'both' }>();
    for (const r of textResults) {
      scoreMap.set(r.id, { score: r.score, source: 'text' });
    }
    for (const r of vectorResults) {
      const existing = scoreMap.get(r.id);
      if (existing) {
        existing.score = (existing.score + r.similarity) / 2;
        existing.source = 'both';
      } else {
        scoreMap.set(r.id, { score: r.similarity, source: 'vector' });
      }
    }

    return Array.from(scoreMap.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private async textSearch(
    query: string,
    entityType: string,
    limit: number,
  ): Promise<Array<{ id: string; score: number }>> {
    if (entityType === 'post') {
      const r = getVedadbPool().query(
        `SELECT id, ts_rank_cd(search_vector, plainto_tsquery('english', $1)) AS score
         FROM posts
         WHERE search_vector @@ plainto_tsquery('english', $1)
         ORDER BY score DESC
         LIMIT $2`,
        [query, limit],
      );
      return r.rows.map((row) => ({ id: row.id, score: parseFloat(row.score) }));
    }
    return [];
  }
}
