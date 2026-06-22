/**
 * Federation — AT Protocol compatible handle resolution
 * + Domain handles (DNS TXT verification)
 *
 * Goal: ORBIT users findable on Bluesky & vice versa.
 * Phase 1: handle/did mapping
 * Phase 2: bidirectional follow graph sync
 */

import { Injectable, Logger } from '@nestjs/common';
import { getVedadbPool } from '@orbit/db';
import { v4 as uuid } from 'uuid';
import * as crypto from 'crypto';
import * as dns from 'dns/promises';

@Injectable()
export class FederationService {
  private readonly db; private readonly logger = new Logger(FederationService.name);
  // Standard AT Protocol PLC directory server
  private readonly PLC_DIR = process.env.PLC_DIRECTORY_URL || 'https://plc.directory';

  constructor() { this.db = getVedadbPool(); }

  /**
   * Register a handle in the federation namespace.
   * Maps alice.bsky.social OR alice.com OR alice.orbit.id → did
   */
  async registerHandle(opts: { handle: string; did: string; pdsEndpoint?: string; publicKey?: string }): Promise<{ ok: boolean }> {
    const handle = opts.handle.toLowerCase().replace(/^@/, '');
    const pds = opts.pdsEndpoint || process.env.PDS_BASE_URL || 'https://pds.orbit.id';

    await this.db.query(
      `INSERT INTO federation_handles (handle, did, pds_endpoint, public_key, is_verified)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (handle) DO UPDATE SET
         did = EXCLUDED.did, pds_endpoint = EXCLUDED.pds_endpoint,
         public_key = EXCLUDED.public_key, is_verified = EXCLUDED.is_verified`,
      [handle, opts.did, pds, opts.publicKey || null, !!opts.publicKey]
    );
    return { ok: true };
  }

  async resolveHandle(handle: string): Promise<{ did: string; pdsEndpoint: string } | null> {
    const h = handle.toLowerCase().replace(/^@/, '');
    const res = await this.db.query<any>(
      `SELECT did, pds_endpoint as "pdsEndpoint" FROM federation_handles WHERE handle = $1`,
      [h]
    );
    if (res.rows[0]) return res.rows[0];
    // External lookup — try AT Protocol PLC
    try {
      const r = await fetch(`${this.PLC_DIR}/_internal/resolveHandle?handle=${encodeURIComponent(h)}`);
      if (r.ok) {
        const data: any = await r.json();
        if (data.did) {
          // Cache it
          await this.registerHandle({ handle: h, did: data.did, pdsEndpoint: data.pdsEndpoint || this.PLC_DIR });
          return { did: data.did, pdsEndpoint: data.pdsEndpoint || this.PLC_DIR };
        }
      }
    } catch (e) {
      this.logger.debug(`External handle lookup failed for ${h}: ${(e as Error).message}`);
    }
    return null;
  }

  async resolveDid(did: string): Promise<{ handle: string; pdsEndpoint: string } | null> {
    const res = await this.db.query<any>(
      `SELECT handle, pds_endpoint as "pdsEndpoint" FROM federation_handles WHERE did = $1`,
      [did]
    );
    return res.rows[0] ?? null;
  }

  // ============= DOMAIN HANDLES =============
  async setupDomainHandle(opts: { ownerDid: string; domain: string }): Promise<{ token: string; instructions: string }> {
    const token = `orbit-verify=${crypto.randomBytes(16).toString('hex')}`;
    await this.db.query(
      `INSERT INTO domain_handles (domain, owner_did, txt_token)
       VALUES ($1, $2, $3)
       ON CONFLICT (domain) DO UPDATE SET owner_did = EXCLUDED.owner_did, txt_token = EXCLUDED.txt_token, is_verified = FALSE`,
      [opts.domain.toLowerCase(), opts.ownerDid, token]
    );
    return {
      token,
      instructions: `Add a TXT record to ${opts.domain}:\n${token}\n\nThen call POST /federation/domain/${opts.domain}/verify to confirm.`,
    };
  }

  async verifyDomainHandle(domain: string, ownerDid: string): Promise<{ verified: boolean; error?: string }> {
    const res = await this.db.query<any>(
      `SELECT txt_token FROM domain_handles WHERE domain = $1 AND owner_did = $2`,
      [domain.toLowerCase(), ownerDid]
    );
    if (!res.rows[0]) return { verified: false, error: 'Domain not registered' };
    const expectedToken = res.rows[0].txt_token;

    try {
      const records = await dns.resolveTxt(`_orbit.${domain}`);
      const flat = records.flat();
      const found = flat.some((r) => r === expectedToken);

      // Also check apex domain
      let apexFound = false;
      if (!found) {
        try {
          const apex = await dns.resolveTxt(domain);
          apexFound = apex.flat().some((r) => r === expectedToken);
        } catch {}
      }

      const verified = found || apexFound;
      await this.db.query(
        `UPDATE domain_handles SET is_verified = $1, verified_at = ${verified ? 'NOW()' : 'NULL'} WHERE domain = $2`,
        [verified, domain.toLowerCase()]
      );
      if (verified) {
        // Register in federation_handles so other platforms can find this user
        const didRes = await this.db.query(`SELECT did, pds_endpoint FROM users WHERE did = $1`, [ownerDid]);
        if (didRes.rows[0]) {
          await this.registerHandle({ handle: domain.toLowerCase(), did: ownerDid, pdsEndpoint: didRes.rows[0].pds_endpoint || '' });
        }
      }
      return { verified };
    } catch (e: any) {
      return { verified: false, error: e.message };
    }
  }

  async listMyDomains(ownerDid: string): Promise<any[]> {
    const res = await this.db.query<any>(
      `SELECT domain, is_verified as "isVerified", verified_at as "verifiedAt", created_at as "createdAt"
       FROM domain_handles WHERE owner_did = $1 ORDER BY created_at DESC`,
      [ownerDid]
    );
    return res.rows;
  }
}
