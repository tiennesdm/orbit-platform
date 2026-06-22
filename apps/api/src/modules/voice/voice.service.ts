/**
 * Voice Rooms — live audio chat (Spaces-style)
 * WebRTC signaling + room state
 */

import { Injectable, Logger } from '@nestjs/common';
import { getVedadbPool } from '@orbit/db';
import { v4 as uuid } from 'uuid';
import * as crypto from 'crypto';

export interface VoiceRoom {
  id: string;
  hostDid: string;
  title: string;
  description?: string;
  status: 'scheduled' | 'live' | 'ended';
  visibility: 'public' | 'intimate' | 'close_friends';
  scheduledAt?: string;
  startedAt?: string;
  endedAt?: string;
  peakSpeakers: number;
  peakListeners: number;
}

@Injectable()
export class VoiceRoomService {
  private readonly db; private readonly logger = new Logger(VoiceRoomService.name);
  // In-memory signaling — in production: Redis pub/sub
  private signaling = new Map<string, Map<string, { offer?: any; answer?: any; candidates: any[] }>>();

  constructor() { this.db = getVedadbPool(); }

  async createRoom(opts: { hostDid: string; title: string; description?: string; visibility?: any; scheduledAt?: string }): Promise<VoiceRoom> {
    const id = uuid();
    await this.db.query(
      `INSERT INTO voice_rooms (id, host_did, title, description, visibility, status, scheduled_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, opts.hostDid, opts.title, opts.description || null, opts.visibility || 'public', opts.scheduledAt ? 'scheduled' : 'scheduled', opts.scheduledAt || null]
    );
    return {
      id, hostDid: opts.hostDid, title: opts.title, description: opts.description,
      status: opts.scheduledAt ? 'scheduled' : 'scheduled', visibility: opts.visibility || 'public',
      scheduledAt: opts.scheduledAt, peakSpeakers: 0, peakListeners: 0,
    };
  }

  async listLive(limit = 30): Promise<VoiceRoom[]> {
    const res = await this.db.query<any>(
      `SELECT id, host_did as "hostDid", title, description, status, visibility,
              scheduled_at as "scheduledAt", started_at as "startedAt", ended_at as "endedAt",
              peak_speakers as "peakSpeakers", peak_listeners as "peakListeners"
       FROM voice_rooms WHERE status IN ('live', 'scheduled')
       ORDER BY started_at DESC NULLS LAST, scheduled_at ASC LIMIT $1`,
      [limit]
    );
    return res.rows;
  }

  async getRoom(id: string): Promise<VoiceRoom | null> {
    const res = await this.db.query<any>(
      `SELECT id, host_did as "hostDid", title, description, status, visibility,
              scheduled_at as "scheduledAt", started_at as "startedAt", ended_at as "endedAt",
              peak_speakers as "peakSpeakers", peak_listeners as "peakListeners"
       FROM voice_rooms WHERE id = $1`,
      [id]
    );
    return res.rows[0] ?? null;
  }

  async startRoom(id: string, hostDid: string): Promise<VoiceRoom> {
    await this.db.query(
      `UPDATE voice_rooms SET status = 'live', started_at = NOW() WHERE id = $1 AND host_did = $2`,
      [id, hostDid]
    );
    this.signaling.set(id, new Map());
    return (await this.getRoom(id))!;
  }

  async endRoom(id: string, hostDid: string): Promise<void> {
    await this.db.query(
      `UPDATE voice_rooms SET status = 'ended', ended_at = NOW() WHERE id = $1 AND host_did = $2`,
      [id, hostDid]
    );
    this.signaling.delete(id);
  }

  async joinRoom(roomId: string, userDid: string, role: 'speaker' | 'listener' = 'listener') {
    await this.db.query(
      `INSERT INTO voice_room_participants (room_id, user_did, role) VALUES ($1, $2, $3)`,
      [roomId, userDid, role]
    );
    // Update peaks
    const stats = await this.db.query<any>(
      `SELECT
         COUNT(*) FILTER (WHERE role = 'speaker' OR role = 'host') as speakers,
         COUNT(*) FILTER (WHERE role = 'listener') as listeners
       FROM voice_room_participants
       WHERE room_id = $1 AND left_at IS NULL`,
      [roomId]
    );
    const s = parseInt(stats.rows[0]?.speakers || 0, 10);
    const l = parseInt(stats.rows[0]?.listeners || 0, 10);
    await this.db.query(
      `UPDATE voice_rooms SET peak_speakers = GREATEST(peak_speakers, $2), peak_listeners = GREATEST(peak_listeners, $3) WHERE id = $1`,
      [roomId, s, l]
    );
    return { speakers: s, listeners: l };
  }

  async leaveRoom(roomId: string, userDid: string) {
    await this.db.query(
      `UPDATE voice_room_participants SET left_at = NOW()
       WHERE room_id = $1 AND user_did = $2 AND left_at IS NULL`,
      [roomId, userDid]
    );
  }

  async getRoomPeers(roomId: string) {
    const res = await this.db.query<any>(
      `SELECT user_did as "userDid", role, joined_at as "joinedAt"
       FROM voice_room_participants
       WHERE room_id = $1 AND left_at IS NULL
       ORDER BY joined_at ASC`,
      [roomId]
    );
    return res.rows;
  }

  // WebRTC signaling helpers
  relaySignal(roomId: string, fromDid: string, toDid: string, payload: any) {
    const room = this.signaling.get(roomId) || new Map();
    const peer = room.get(toDid) || { candidates: [] };
    if (payload.sdp) peer.offer = payload.sdp;
    if (payload.answer) peer.answer = payload.answer;
    if (payload.candidate) peer.candidates.push(payload.candidate);
    room.set(toDid, peer);
    this.signaling.set(roomId, room);
    return { ok: true };
  }

  getSignals(roomId: string, forDid: string) {
    const room = this.signaling.get(roomId);
    if (!room) return [];
    return Array.from(room.entries())
      .filter(([from]) => from !== forDid)
      .map(([from, s]) => ({ from, ...s }));
  }
}
