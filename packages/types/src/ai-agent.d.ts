import type { ISO8601, DID } from './user';
export type AutonomyLevel = 'ask' | 'suggest' | 'auto';
export interface AgentChatRequest {
    message: string;
    context?: {
        currentScreen?: string;
        recentActions?: string[];
        nearbyUsers?: DID[];
    };
    forceTool?: string;
}
export interface AgentChatResponse {
    reply: string;
    toolCalls?: Array<{
        tool: string;
        args: any;
        result: any;
    }>;
    suggestions?: string[];
    memoryUpdates?: Array<{
        type: 'fact' | 'preference' | 'pattern';
        text: string;
        confidence: number;
    }>;
}
export interface AgentState {
    userDid: DID;
    conversationHistory: Array<{
        role: 'user' | 'agent' | 'system';
        content: string;
        timestamp: ISO8601;
    }>;
    longTermMemory: Array<{
        text: string;
        confidence: number;
        source: string;
        createdAt: ISO8601;
    }>;
    preferences: Record<string, any>;
    lastDigestAt?: ISO8601;
    autonomyLevel: AutonomyLevel;
    enabledTools: string[];
}
export type AgentTool = 'search_users' | 'summarize_dm_thread' | 'block_user' | 'mute_user' | 'schedule_post' | 'get_usage_stats' | 'translate_text' | 'cross_post_to_instagram';
export interface AgentToolDefinition {
    name: AgentTool;
    description: string;
    parameters: Record<string, {
        type: 'string' | 'number' | 'boolean' | 'object' | 'array';
        description: string;
        required: boolean;
    }>;
}
