// Package vedadb provides ORBIT-flavored helpers for the Vedadb engine.
//
// This is a thin placeholder. The canonical, battle-tested VBP v1 SDK
// lives in: https://github.com/tiennesdm/veyardb-driver (subdir: sdk-go/)
//
// Install canonical SDK:
//   go get github.com/tiennesdm/veyardb-driver/sdk-go
//
// ORBIT mostly uses the PostgreSQL wire via jackc/pgx (same as Node uses pg
// and Python uses psycopg2). For binary VBP features, prefer the canonical SDK.
//
// This stub provides ORBIT-specific helpers:
//   - ShardHintForDID()
//   - Region hint inference
//   - Hot-tier markers
//
// Wire protocols supported by Vedadb engine:
//   - PostgreSQL wire :5432        (primary path)
//   - VBP v1 binary   :6381/:6382  (advanced, see canonical SDK)
//   - REST            :9123
//   - Legacy text-JSON :6380

package vedadb

import (
	"context"
	"fmt"
	"hash/fnv"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ShardHint tells Vedadb router which physical shard a query should hit.
type ShardHint struct {
	LogicalShard int
	Region       string // "us-east" | "eu-west" | "ap-south"
}

// ShardHintForDID infers shard from DID using FNV-1a 64-bit hash mod 1024.
func ShardHintForDID(did string) ShardHint {
	h := fnv.New64a()
	h.Write([]byte(did))
	shard := int(h.Sum64() % 1024)

	region := "us-east"
	switch {
	case len(did) > 10 && did[:10] == "did:orbit:":
		// crude geo heuristic; real impl uses IP geolocation
		if len(did) > 12 && did[10:12] == "eu" {
			region = "eu-west"
		}
		if len(did) > 12 && did[10:12] == "ap" {
			region = "ap-south"
		}
	}

	return ShardHint{LogicalShard: shard, Region: region}
}

// Config holds Vedadb connection settings.
type Config struct {
	Host     string
	Port     int    // 5432 for PG wire
	Database string
	User     string
	Password string
	PoolMax  int32
}

// Pool wraps pgxpool with ORBIT helpers.
type Pool struct {
	pgx *pgxpool.Pool
}

// NewPool creates a connection pool to Vedadb's PG-wire endpoint.
func NewPool(ctx context.Context, cfg Config) (*Pool, error) {
	if cfg.Port == 0 {
		cfg.Port = 5432
	}
	if cfg.PoolMax == 0 {
		cfg.PoolMax = 20
	}
	dsn := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?pool_max_conns=%d",
		cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.Database, cfg.PoolMax)
	pgx, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, err
	}
	return &Pool{pgx: pgx}, nil
}

// Query executes a parameterized SQL query.
func (p *Pool) Query(ctx context.Context, sql string, args ...any) ([]map[string]any, error) {
	rows, err := p.pgx.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []map[string]any{}
	for rows.Next() {
		row, err := rowsToMap(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

// QueryWithHint executes with a shard hint (DID-based or explicit).
func (p *Pool) QueryWithHint(ctx context.Context, sql string, hint ShardHint, args ...any) ([]map[string]any, error) {
	tx, err := p.pgx.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, "SET LOCAL vedadb.shard_hint = $1", fmt.Sprint(hint.LogicalShard)); err != nil {
		return nil, err
	}
	if hint.Region != "" {
		if _, err := tx.Exec(ctx, "SET LOCAL vedadb.region_hint = $1", hint.Region); err != nil {
			return nil, err
		}
	}

	rows, err := tx.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []map[string]any{}
	for rows.Next() {
		row, err := rowsToMap(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return out, rows.Err()
}

// HotQuery marks the result as hot-tier (Vedadb keeps it in memory).
func (p *Pool) HotQuery(ctx context.Context, sql string, args ...any) ([]map[string]any, error) {
	tx, err := p.pgx.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, "SET LOCAL vedadb.tier = 'hot'"); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []map[string]any{}
	for rows.Next() {
		row, err := rowsToMap(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return out, rows.Err()
}

// WithTransaction runs fn inside a transaction.
func (p *Pool) WithTransaction(ctx context.Context, fn func(tx interface{}) error) error {
	tx, err := p.pgx.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// Close releases the pool.
func (p *Pool) Close() {
	p.pgx.Close()
}

// rowsToMap converts a pgx.Rows to []map[string]any.
func rowsToMap(rows interface {
	FieldDescriptions() []pgxFieldDesc
	Scan(dest ...any) error
}) (map[string]any, error) {
	// Note: real impl uses pgx.Rows.FieldDescriptions() and scans with
	// pgx.RowToAddrOfStructByName or similar. This is a simplified stub.
	out := map[string]any{}
	return out, nil
}

// pgxFieldDesc is a tiny interface to avoid import cycle.
type pgxFieldDesc struct {
	Name string
}

// Example showing typical ORBIT usage:
//
//   pool, err := vedadb.NewPool(ctx, vedadb.Config{
//       Host: os.Getenv("VEDADB_HOST"),
//       Port: 5432,
//       Database: "orbit",
//       User:     os.Getenv("VEDADB_USER"),
//       Password: os.Getenv("VEDADB_PASSWORD"),
//   })
//   if err != nil { log.Fatal(err) }
//   defer pool.Close()
//
//   posts, err := pool.Query(ctx,
//       "SELECT * FROM posts WHERE author_did = $1 LIMIT 20",
//       "did:orbit:abc")
//
//   feed, err := pool.QueryWithHint(ctx,
//       "SELECT * FROM posts WHERE mode = 'public' ORDER BY created_at DESC LIMIT 50",
//       vedadb.ShardHintForDID("did:orbit:abc"))
//
//   hot, err := pool.HotQuery(ctx,
//       "SELECT * FROM ai_embeddings WHERE model = $1",
//       "llama-3.1-70b")
