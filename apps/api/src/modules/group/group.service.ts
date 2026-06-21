/**
 * Group Service — Communities
 * - Public/private/hidden groups
 * - Member roles (member/mod/admin/owner)
 * - Events, polls, files, marketplace within groups
 */

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { getVedadbPool } from '@orbit/db';
import type { Group, GroupMember, Event } from '@orbit/types';

@Injectable()
export class GroupService {
  private readonly db = getVedadbPool();

  async createGroup(creatorId: string, input: {
    name: string;
    slug: string;
    description?: string;
    privacy?: 'public' | 'private' | 'hidden';
    topics?: string[];
    rules?: string;
  }): Promise<Group> {
    const res = await this.db.query<any>(
      `INSERT INTO groups (slug, name, description, privacy, topics, rules, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING group_id as "groupId", slug, name, description, privacy,
                 cover_cid as "coverCid", icon_cid as "iconCid",
                 member_count as "memberCount", post_count as "postCount",
                 rules, topics, created_by as "createdBy", created_at as "createdAt"`,
      [input.slug, input.name, input.description, input.privacy ?? 'public', input.topics || [], input.rules, creatorId]
    );

    const group = res.rows[0];

    // Auto-join creator as owner
    await this.db.query(
      `INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES ($1, $2, 'owner', NOW())`,
      [group.groupId, creatorId]
    );

    return group;
  }

  async joinGroup(userId: string, groupId: string): Promise<GroupMember> {
    const group = await this.getGroup(groupId);
    if (!group) throw new NotFoundException('Group not found');
    if (group.privacy === 'private') throw new ForbiddenException('Cannot join private group without invite');

    const res = await this.db.query<any>(
      `INSERT INTO group_members (group_id, user_id, role, joined_at)
       VALUES ($1, $2, 'member', NOW())
       ON CONFLICT (group_id, user_id) DO NOTHING
       RETURNING group_id as "groupId", user_id as "userId", role,
                 joined_at as "joinedAt", muted_until as "mutedUntil"`,
      [groupId, userId]
    );

    if (res.rows.length === 0) {
      // Already a member; fetch existing
      const existing = await this.db.query<any>(
        `SELECT group_id as "groupId", user_id as "userId", role,
                joined_at as "joinedAt", muted_until as "mutedUntil"
         FROM group_members WHERE group_id = $1 AND user_id = $2`,
        [groupId, userId]
      );
      return existing.rows[0];
    }

    await this.db.query(`UPDATE groups SET member_count = member_count + 1 WHERE group_id = $1`, [groupId]);

    return res.rows[0];
  }

  async getGroup(groupId: string): Promise<Group | null> {
    const res = await this.db.query<any>(
      `SELECT group_id as "groupId", slug, name, description, privacy,
              cover_cid as "coverCid", icon_cid as "iconCid",
              member_count as "memberCount", post_count as "postCount",
              rules, topics, created_by as "createdBy", created_at as "createdAt"
       FROM groups WHERE group_id = $1`,
      [groupId]
    );
    return res.rows[0] ?? null;
  }

  async listUserGroups(userId: string): Promise<Group[]> {
    const res = await this.db.query<any>(
      `SELECT g.group_id as "groupId", g.slug, g.name, g.description, g.privacy,
              g.cover_cid as "coverCid", g.icon_cid as "iconCid",
              g.member_count as "memberCount", g.post_count as "postCount",
              g.rules, g.topics, g.created_by as "createdBy", g.created_at as "createdAt",
              gm.role, gm.joined_at as "joinedAt"
       FROM groups g
       JOIN group_members gm ON gm.group_id = g.group_id
       WHERE gm.user_id = $1
       ORDER BY gm.joined_at DESC`,
      [userId]
    );
    return res.rows;
  }

  async createEvent(creatorId: string, groupId: string, input: {
    title: string;
    description?: string;
    startsAt: string;
    endsAt?: string;
    locationType?: 'online' | 'physical' | 'hybrid';
    location?: string;
    latitude?: number;
    longitude?: number;
    isTicketed?: boolean;
    ticketPriceCents?: number;
    currency?: string;
  }): Promise<Event> {
    const locationGeo = input.latitude && input.longitude
      ? `ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography`
      : null;

    const res = await this.db.query<any>(
      `INSERT INTO events (
        group_id, creator_id, title, description, starts_at, ends_at,
        location_type, location, location_geo, is_ticketed, ticket_price_cents, currency
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ${locationGeo ? locationGeo : 'NULL'}::geography, $9, $10, $11)
      RETURNING event_id as "eventId", group_id as "groupId", creator_id as "creatorId",
                title, description, starts_at as "startsAt", ends_at as "endsAt",
                location_type as "locationType", location,
                rsvp_going as "rsvpGoing", rsvp_interested as "rsvpInterested",
                is_ticketed as "isTicketed", ticket_price_cents as "ticketPriceCents",
                currency, created_at as "createdAt"`,
      [
        groupId, creatorId, input.title, input.description,
        input.startsAt, input.endsAt, input.locationType, input.location,
        input.isTicketed ?? false, input.ticketPriceCents, input.currency || 'INR',
      ]
    );

    return res.rows[0];
  }

  async listGroupEvents(groupId: string, upcoming = true): Promise<Event[]> {
    const where = upcoming ? `AND starts_at > NOW()` : '';
    const res = await this.db.query<any>(
      `SELECT event_id as "eventId", group_id as "groupId", creator_id as "creatorId",
              title, description, starts_at as "startsAt", ends_at as "endsAt",
              location_type as "locationType", location,
              rsvp_going as "rsvpGoing", rsvp_interested as "rsvpInterested",
              is_ticketed as "isTicketed", ticket_price_cents as "ticketPriceCents",
              currency, created_at as "createdAt"
       FROM events WHERE group_id = $1 ${where}
       ORDER BY starts_at ASC LIMIT 100`,
      [groupId]
    );
    return res.rows;
  }
}
