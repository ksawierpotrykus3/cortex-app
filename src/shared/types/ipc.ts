// ============================================================================
// NEXUS — IPC Typed Channels (Phase 1)
// Typizowane nazwy eventów + payloady dla komunikacji między procesami
// Tripartite Channel: Command, Telemetry, Data Firehose
// ============================================================================

import { Agent, AgentOutput, AgentStatus } from './schema';

// ============================================================================
// COMMAND CHANNEL (Renderer ↔ Main via ipcMain.handle/invoke)
// Niska częstotliwość — komendy użytkownika
// ============================================================================

export interface CommandChannels {
  // Agent CRUD
  'agent:create': { payload: Pick<Agent, 'name' | 'description' | 'promptTemplate' | 'trigger' | 'model'>; response: Agent };
  'agent:update': { payload: { id: string; updates: Partial<Agent> }; response: Agent };
  'agent:delete': { payload: { id: string }; response: { success: boolean } };
  'agent:get-all': { payload: void; response: Agent[] };
  'agent:get': { payload: { id: string }; response: Agent | null };

  // Agent execution
  'agent:execute': { payload: { id: string; context?: string }; response: { success: boolean } };
  'agent:stop': { payload: { id: string }; response: { success: boolean } };

  // Storage
  'storage:save': { payload: { key: string; data: unknown }; response: { success: boolean } };
  'storage:load': { payload: { key: string }; response: unknown };
}

// ============================================================================
// TELEMETRY CHANNEL (Main ↔ utilityProcess)
// Średnia częstotliwość — heartbeat, budżet, CircuitBreaker
// ============================================================================

export interface TelemetryMessage {
  type: 'heartbeat' | 'status' | 'error' | 'budget';
  agentId: string;
  timestamp: number;
  data: {
    rss?: number;       // Resident Set Size (memory)
    heapUsed?: number;
    tokensUsed?: number;
    depth?: number;
    status?: AgentStatus;
    error?: string;
  };
}

// ============================================================================
// DATA FIREHOSE CHANNEL (utilityProcess ↔ Renderer via MessagePort)
// WYSOKA częstotliwość — streaming tokenów AI, logi
// ============================================================================

export interface FirehoseMessage {
  type: 'token' | 'output' | 'status' | 'error' | 'done';
  agentId: string;
  timestamp: number;
  data: {
    token?: string;          // Pojedynczy token (stream)
    content?: string;        // Fragment outputu
    output?: AgentOutput;    // Kompletny output
    status?: AgentStatus;    // Zmiana statusu
    error?: string;
    tokensUsed?: number;     // Suma po done
    executionMs?: number;    // Czas wykonania
  };
}

// ============================================================================
// PRELOAD BRIDGE — interfejs dla window.nexusBridge
// ============================================================================

export interface NexusBridge {
  // Agent commands
  executeAgent: (payload: { id: string; context?: string }) => Promise<{ success: boolean }>;
  stopAgent: (payload: { id: string }) => Promise<{ success: boolean }>;
  createAgent: (payload: Pick<Agent, 'name' | 'description' | 'promptTemplate' | 'trigger' | 'model'>) => Promise<Agent>;
  updateAgent: (payload: { id: string; updates: Partial<Agent> }) => Promise<Agent>;
  deleteAgent: (payload: { id: string }) => Promise<{ success: boolean }>;
  getAgents: () => Promise<Agent[]>;
  getAgent: (payload: { id: string }) => Promise<Agent | null>;

  // Provider config (Phase 2)
  getProviderConfigs: () => Promise<import('./schema').ProviderAuthConfig[]>;
  setApiKey: (payload: { label: string; apiKey: string }) => Promise<{ success: boolean; error?: string }>;
  testConnection: (payload: { label: string }) => Promise<{ success: boolean; error?: string }>;
  getAvailableModels: () => Promise<Array<{ label: string; modelName: string; providerLabel: string }>>;
  upsertProviderConfig: (payload: { config: import('./schema').ProviderAuthConfig }) => Promise<{ success: boolean; error?: string }>;

  // Agent status listeners (Main → Renderer)
  onAgentOutput: (callback: (output: AgentOutput) => void) => () => void;
  onAgentStatus: (callback: (data: { agentId: string; status: AgentStatus }) => void) => () => void;
  onAgentStream: (callback: (data: { agentId: string; token: string }) => void) => () => void;

  // Changelog approve/reject
  approveOutput: (payload: { entryId: string; agentId: string }) => void;
  rejectOutput: (payload: { entryId: string; agentId: string; reason?: string }) => void;

  // Legacy (from V2)
  sendRlhfRejection: (payload: { agentId: string; entryId: string; reason?: string }) => void;
  sendRlhfAcceptance: (payload: { agentId: string; entryId: string }) => void;
  onSsrfBlock: (callback: (payload: unknown) => void) => () => void;
  onProxyReady: (callback: (payload: unknown) => void) => () => void;
  onNewAgentEntry: (callback: (payload: unknown) => void) => () => void;
  removeAllListeners: (channel: string) => void;
}
