# Vedadb Python Driver — ORBIT Stub
#
# This is a thin placeholder. The canonical, battle-tested VBP v1 SDK
# lives in: https://github.com/tiennesdm/veyardb-driver (subdir: sdk-python/)
#
# ORBIT mostly uses the PostgreSQL wire via psycopg2 (same as Node driver
# uses pg). For binary VBP features, prefer the canonical SDK.
#
# Install canonical SDK:
#   pip install vedadb-driver
#   # or from source:
#   # git clone https://github.com/tiennesdm/veyardb-driver.git
#   # cd veyardb-driver/sdk-python && pip install -e .
#
# This stub provides ORBIT-specific helpers:
# - shard_hint_for_did()
# - region hint inference
# - hot-tier markers

from __future__ import annotations
import hashlib
import os
from typing import Optional, Tuple
from dataclasses import dataclass

import psycopg2
from psycopg2 import pool as pg_pool
from psycopg2.extras import RealDictCursor


@dataclass
class ShardHint:
    logical_shard: int
    region: Optional[str]  # 'us-east' | 'eu-west' | 'ap-south'


def shard_hint_for_did(did: str, total_shards: int = 1024) -> ShardHint:
    """Route query to physical shard by DID hash (FNV-1a 64-bit)."""
    h = 0xcbf29ce484222325
    for ch in did:
        h = ((h ^ ord(ch)) * 0x100000001b3) & 0xFFFFFFFFFFFFFFFF
    logical_shard = h % total_shards

    if did.startswith('did:orbit:eu:'):
        region = 'eu-west'
    elif did.startswith('did:orbit:ap:'):
        region = 'ap-south'
    else:
        region = 'us-east'

    return ShardHint(logical_shard=logical_shard, region=region)


class VedadbPool:
    """Thin wrapper around psycopg2 connection pool with ORBIT helpers."""

    def __init__(self, config: dict):
        self.config = config
        self._pool = pg_pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=config.get('pool_max', 20),
            host=config['host'],
            port=config.get('port', 5432),
            database=config['database'],
            user=config['user'],
            password=config['password'],
        )

    def query(self, sql: str, params: tuple = ()) -> list[dict]:
        conn = self._pool.getconn()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(sql, params)
                if cur.description:
                    return cur.fetchall()
                return []
        finally:
            self._pool.putconn(conn)

    def query_with_hint(
        self,
        sql: str,
        params: tuple,
        did: Optional[str] = None,
        logical_shard: Optional[int] = None,
        region: Optional[str] = None,
    ) -> list[dict]:
        """Execute with shard hint (DID-based or explicit)."""
        if did and logical_shard is None:
            inferred = shard_hint_for_did(did)
            logical_shard = inferred.logical_shard
            region = region or inferred.region

        conn = self._pool.getconn()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                if logical_shard is not None:
                    cur.execute('SET LOCAL vedadb.shard_hint = %s', (str(logical_shard),))
                if region:
                    cur.execute('SET LOCAL vedadb.region_hint = %s', (region,))
                cur.execute(sql, params)
                if cur.description:
                    return cur.fetchall()
                return []
        finally:
            self._pool.putconn(conn)

    def hot_query(self, sql: str, params: tuple = ()) -> list[dict]:
        """Execute with hot-tier marker (Vedadb keeps result in memory)."""
        conn = self._pool.getconn()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SET LOCAL vedadb.tier = 'hot'")
                cur.execute(sql, params)
                if cur.description:
                    return cur.fetchall()
                return []
        finally:
            self._pool.putconn(conn)

    def with_transaction(self, fn):
        conn = self._pool.getconn()
        try:
            with conn:
                return fn(conn)
        finally:
            self._pool.putconn(conn)

    def close(self):
        self._pool.closeall()


def create_pool(config: dict) -> VedadbPool:
    return VedadbPool(config)


# ============================================================
# Example
# ============================================================
if __name__ == '__main__':
    db = create_pool({
        'host': os.getenv('VEDADB_HOST', 'localhost'),
        'port': 5432,
        'database': os.getenv('VEDADB_DB', 'orbit'),
        'user': os.getenv('VEDADB_USER', 'admin'),
        'password': os.getenv('VEDADB_PASSWORD', ''),
    })

    # Standard query
    posts = db.query(
        'SELECT * FROM posts WHERE author_did = %s ORDER BY created_at DESC LIMIT 20',
        ('did:orbit:abc123',)
    )
    print(f'Got {len(posts)} posts')

    # Shard-hinted query
    feed = db.query_with_hint(
        'SELECT * FROM posts WHERE author_did = ANY(%s) LIMIT 50',
        ([f'did:orbit:user_{i}' for i in range(20)],),
        did='did:orbit:abc123',
    )
    print(f'Got {len(feed)} feed posts from shard')

    db.close()
