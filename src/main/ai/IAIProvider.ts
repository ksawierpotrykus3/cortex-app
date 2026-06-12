// ============================================================================
// NEXUS — IAIProvider (Phase 2)
// Unified Provider/Adapter interface dla wszystkich modeli AI
// ============================================================================

import { AgentOutput, AgentStatus, ModelConfig, TriggerType } from '../../shared/types/schema';

// === Request / Response ====================================================
export interface AICompletionRequest {
  prompt: string;
  model: ModelConfig;
  systemPrompt?: string;       // np. instrukcja agenta z promptTemplate
  contextSize: number;
}

export interface AICompletionResponse {
  content: string;
  tokensUsed: number;
  executionMs: number;
  error?: string;
}

export interface AIStreamChunk {
  token: string;
  done: boolean;
  error?: string;
}

// === Provider Adapter Interface ============================================
export interface IAIProvider {
  /** Nazwa providera (do logów) */
  readonly name: string;

  /** Czy provider jest skonfigurowany (ma klucz/endpoint) */
  isConfigured(): boolean;

  /** Sync completion — zwraca pełny tekst */
  complete(request: AICompletionRequest): Promise<AICompletionResponse>;

  /** Streaming completion — zwraca async generator tokenów */
  completeStream(request: AICompletionRequest): AsyncGenerator<AIStreamChunk>;

  /** Test połączenia */
  testConnection(): Promise<{ success: boolean; error?: string }>;
}
