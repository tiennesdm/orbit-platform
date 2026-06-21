import type { ISO8601 } from './user';
export interface ApiSuccess<T> {
    ok: true;
    data: T;
    serverTime: ISO8601;
    nextCursor?: string;
}
export interface ApiError {
    ok: false;
    error: {
        code: string;
        message: string;
        details?: Record<string, any>;
        requestId: string;
    };
    serverTime: ISO8601;
}
export type ApiResponse<T> = ApiSuccess<T> | ApiError;
export interface Paginated<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
    nextCursor?: string;
}
export type RealtimeEventType = 'message_new' | 'message_edited' | 'message_deleted' | 'post_new' | 'post_liked' | 'notification_new' | 'user_typing' | 'user_online' | 'user_offline' | 'stream_update';
export interface RealtimeEvent<T = any> {
    type: RealtimeEventType;
    channel: string;
    payload: T;
    serverTime: ISO8601;
}
