/**
 * ORBIT shared types — AI Agent
 */

import type { ISO8601, DID } from './user';

export type AutonomyLevel = 'ask' | 'suggest' | 'auto';

/**
 * OpenAI / Anthropic function-calling tool shape.
 *
 * Services (`ai-agent-tools.service.ts`) build tool definitions using this
 * shape and pass them straight to the LLM. The original draft modelled
 * `AgentTool` as a union of string names — that was dropped because
 * services need the full function-calling schema (name + description +
 * JSON-schema parameters).
 */
export interface AgentTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    /** Optional because some tools (e.g. `get_usage_stats`) have no required params. */
    required?: string[];
  };
}

export interface AgentChatRequest {
  message: string;
  /** Optional conversation ID — services thread multi-turn chats by ID. */
  conversationId?: string;
  context?: {
    currentScreen?: string;
    recentActions?: string[];
    nearbyUsers?: DID[];
  };
  /** Force specific tool */
  forceTool?: string;
  /** Services pass extra fields without type errors. */
  [key: string]: any;
}

/**
 * One message in an agent conversation. The server stores these in cache
 * (TTL 24h) and trims to the last 50 per user. `role: 'tool'` messages
 * carry tool-call results back into the LLM context.
 */
export interface AgentMessage {
  role: 'user' | 'agent' | 'system' | 'tool' | 'assistant';
  content: string;
  timestamp?: ISO8601;
  /** Tool call (assistant messages may include this) */
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  /** Tool-result messages (role === 'tool') carry these. */
  toolCallId?: string;
  name?: string;
}

/**
 * AgentChatResponse — mirrors AgentMessage but tagged as the assistant
 * turn. `conversationId` is echoed back so the client can keep a
 * multi-turn thread.
 */
export interface AgentChatResponse {
  message: AgentMessage;
  conversationId: string;
  toolCallsMade?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  finishReason?: string;
  /** Legacy fields — kept for backwards compatibility with older clients. */
  reply?: string;
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

/**
 * Per-user AI agent state. Stored in `ai_agent_state` table.
 *
 * Field shapes match `ai-agent.service.ts` exactly — including the
 * `Record<string, any>` types for `enabledFeatures`, `longTermMemory`,
 * and `episodicMemory` (the service initializes them as empty objects
 * and grows them dynamically).
 */
export interface AgentState {
  userId: DID;
  /** Agent personality preset (e.g. 'helpful', 'witty', 'professional') */
  personality: string;
  /** Conversation history (last N messages) */
  conversationHistory?: Array<{
    role: 'user' | 'agent' | 'system';
    content: string;
    timestamp: ISO8601;
  }>;
  /** Long-term memory (facts about user) — keyed record, NOT an array */
  longTermMemory: Record<string, any>;
  /** Episodic memory (recent interaction snapshots) — keyed record */
  episodicMemory: Record<string, any>;
  /** Map of feature flag name -> enabled boolean */
  enabledFeatures: Record<string, any>;
  /** User preferences learned */
  preferences?: Record<string, any>;
  /** Daily digest state */
  lastDigestAt?: ISO8601;
  /** Autonomy settings */
  autonomyLevel: AutonomyLevel;
  /** Enabled tools (string names — separate from the per-tool definitions
   *  in `enabledFeatures`, used as a quick membership check) */
  enabledTools?: string[];
  /** LLM context window size in tokens */
  contextWindowSize: number;
  /** Last updated timestamp */
  updatedAt?: ISO8601;
}