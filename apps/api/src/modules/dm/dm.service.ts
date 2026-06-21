/**
 * DM Service — End-to-end encrypted messaging
 * Server stores ONLY ciphertext (cannot read messages)
 */

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { getVedadbPool, OrbitPubSub } from '@orbit/db';
import { E2eEncryptionService } from './e2e-encryption.service';
import type { Thread, Message } from '@orbit/types';

@Injectable()
export class DmService {
  private readonly db = getVedadbPool();
  private readonly pubsub: OrbitPubSub;

  constructor(private readonly e2e: E2eEncryptionService) {
    this.pubsub = new OrbitPubSub(this.db);
  }

  /**
   * Get or create 1:1 thread between two users
   */
  async getOrCreateThread(userId: string, otherUserId: string): Promise<Thread> {
    // Sort participant IDs for deterministic thread_id
    const sorted = [userId, otherUserId].sort();

    const existing = await this.db.query<any>(
      `SELECT thread_id as "threadId", thread_type as "threadType",
              participant_ids as "participantIds", created_by as "createdBy",
              name, icon_cid as "iconCid", last_message_at as "lastMessageAt",
              last_message_preview as "lastMessagePreview", unread_counts as "unreadCounts",
              muted_by as "mutedBy", created_at as "createdAt"
       FROM threads
       WHERE thread_type = 0 AND participant_ids @> ARRAY[$1, $2]::text[]
       LIMIT 1`,
      sorted
    );

    if (existing.rows.length > 0) return existing.rows[0];

    const res = await this.db.query<any>(
      `INSERT INTO threads (thread_type, participant_ids, created_by, last_message_at)
       VALUES (0, $1, $2, NOW())
       RETURNING thread_id as "threadId", thread_type as "threadType",
                 participant_ids as "participantIds", created_by as "createdBy",
                 name, icon_cid as "iconCid", last_message_at as "lastMessageAt",
                 last_message_preview as "lastMessagePreview", unread_counts as "unreadCounts",
                 muted_by as "mutedBy", created_at as "createdAt"`,
      [sorted, userId]
    );

    return res.rows[0];
  }

  /**
   * Send an encrypted message
   * Server receives ciphertext + ephemeral key, stores as-is, cannot decrypt
   */
  async sendMessage(
    senderId: string,
    threadId: string,
    encryptedPayload: { ciphertext: string; ephemeralPublicKey?: string; counter: number },
    contentType: 'text' | 'image' | 'video' | 'audio' | 'file' = 'text'
  ): Promise<Message> {
    // Verify sender is participant
    const thread = await this.getThread(senderId, threadId);
    if (!thread) throw new NotFoundException('Thread not found');

    // Load or initialize ratchet state
    let ratchetState = await this.e2e.loadRatchetState(senderId, threadId);
    if (!ratchetState) {
      // Initiate session with first recipient
      const recipientId = thread.participantIds.find((p) => p !== senderId);
      if (!recipientId) throw new Error('No recipient found');
      ratchetState = await this.e2e.initiateSession(senderId, recipientId);
    }

    // Store message (server cannot read)
    const res = await this.db.query<any>(
      `INSERT INTO messages (
        thread_id, sender_id, recipient_ids, encrypted_payload, content_type, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING message_id as "messageId", thread_id as "threadId",
                sender_id as "senderId", recipient_ids as "recipientIds",
                encrypted_payload as "encryptedPayload", content_type as "contentType",
                reactions, read_by as "readBy", created_at as "createdAt"`,
      [
        threadId,
        senderId,
        thread.participantIds,
        JSON.stringify(encryptedPayload),
        contentType,
      ]
    );

    const message = res.rows[0];

    // Update thread last_message_at
    await this.db.query(
      `UPDATE threads SET last_message_at = NOW() WHERE thread_id = $1`,
      [threadId]
    );

    // Save ratchet state for next message
    await this.e2e.saveRatchetState(senderId, threadId, ratchetState);

    // Publish real-time event to recipient(s)
    for (const recipientId of thread.participantIds) {
      if (recipientId !== senderId) {
        await this.pubsub.publish(`message.new:${recipientId}`, {
          threadId,
          messageId: message.messageId,
          senderId,
          encrypted: true, // Server cannot read content
        });
      }
    }

    return message;
  }

  /**
   * Get messages in a thread (encrypted)
   * Client decrypts locally
   */
  async getMessages(userId: string, threadId: string, limit = 50, before?: string): Promise<Message[]> {
    const thread = await this.getThread(userId, threadId);
    if (!thread) throw new NotFoundException('Thread not found');

    const params: any[] = [threadId];
    let cursorClause = '';
    if (before) {
      cursorClause = `AND message_id < $2`;
      params.push(before);
    }
    params.push(limit);

    const res = await this.db.query<any>(
      `SELECT message_id as "messageId", thread_id as "threadId",
              sender_id as "senderId", recipient_ids as "recipientIds",
              encrypted_payload as "encryptedPayload", content_type as "contentType",
              reactions, read_by as "readBy", created_at as "createdAt"
       FROM messages
       WHERE thread_id = $1 ${cursorClause}
       ORDER BY message_id DESC
       LIMIT $${params.length}`,
      params
    );

    return res.rows;
  }

  async getThread(userId: string, threadId: string): Promise<Thread | null> {
    const res = await this.db.query<any>(
      `SELECT thread_id as "threadId", thread_type as "threadType",
              participant_ids as "participantIds", created_by as "createdBy",
              name, icon_cid as "iconCid", last_message_at as "lastMessageAt",
              last_message_preview as "lastMessagePreview", unread_counts as "unreadCounts",
              muted_by as "mutedBy", created_at as "createdAt"
       FROM threads WHERE thread_id = $1 AND $2 = ANY(participant_ids)`,
      [threadId, userId]
    );
    return res.rows[0] ?? null;
  }

  async listThreads(userId: string, limit = 50): Promise<Thread[]> {
    const res = await this.db.query<any>(
      `SELECT thread_id as "threadId", thread_type as "threadType",
              participant_ids as "participantIds", created_by as "createdBy",
              name, icon_cid as "iconCid", last_message_at as "lastMessageAt",
              last_message_preview as "lastMessagePreview", unread_counts as "unreadCounts",
              muted_by as "mutedBy", created_at as "createdAt"
       FROM threads
       WHERE $1 = ANY(participant_ids)
       ORDER BY last_message_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return res.rows;
  }

  async markAsRead(userId: string, threadId: string, messageId: string): Promise<void> {
    await this.db.query(
      `UPDATE messages
       SET read_by = read_by || jsonb_build_object($1::text, NOW()::text)
       WHERE thread_id = $2 AND message_id <= $3 AND NOT (read_by ? $1)`,
      [userId, threadId, messageId]
    );

    await this.db.query(
      `UPDATE threads
       SET unread_counts = unread_counts - $1::text
       WHERE thread_id = $2`,
      [userId, threadId]
    );
  }
}
