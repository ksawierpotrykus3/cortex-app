// ============================================================================
// NEXUS — IPC Typed Channels (Phase 1)
// Typizowane nazwy eventów + payloady dla komunikacji między procesami
// Tripartite Channel: Command, Telemetry, Data Firehose
// ============================================================================

import { Agent, AgentOutput, AgentStatus, ProviderAuthConfig, ContextSource, ContextConfig, GitConfig, GitStatusResult, GitLogEntry, GitBranchInfo, Pipeline, FeedbackEntry, WorkspaceEntity, KillSwitchState, SearchResult, SearchConfig, DryRunResult, DryRunConfig } from './schema';
import { WorkflowDefinition, WorkflowExecutionResult, WorkflowLogEntry, WorkflowMode } from './workflow';

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
  'agent:execute': { payload: { id: string; context?: string; triggerType?: import('./schema').TriggerType }; response: { success: boolean } };
  'agent:stop': { payload: { id: string }; response: { success: boolean } };

  // Storage
  'storage:save': { payload: { key: string; data: unknown }; response: { success: boolean } };
  'storage:load': { payload: { key: string }; response: unknown };

  // Context Builder (F6.2)
  'context:get-options': { payload: { agentId: string }; response: ContextSource[] };
  'context:fetch': { payload: { agentId: string; contextConfig: ContextConfig }; response: { context: string; tokensUsed: number; sourceBreakdown: { sourceId: string; chars: number; tokens: number }[] } };
  'context:search-nodes': { payload: { query: string; filter?: string }; response: { id: string; title: string; projectId?: string }[] };
  'context:search-tasks': { payload: { query: string; status?: string }; response: { id: string; title: string; status: string }[] };

  // Context Builder (F6.8) — workspace entities for ContextBuilder UI
  'agent:get-workspace-entities': { payload: void; response: { nodes: { id: string; title: string }[]; tasks: { id: string; title: string }[]; drafts: { id: string; contentPreview: string }[] } };

  // Feedback (#26)
  'feedback:save': { payload: { feedback: FeedbackEntry }; response: { success: boolean; error?: string } };

  // Workspace sync (F6.2)
  'workspace:sync': { payload: { entities: WorkspaceEntity[] }; response: { success: boolean } };
  'workspace:get-all': { payload: void; response: WorkspaceEntity[] };

  // KillSwitch (#9)
  'killswitch:status': { payload: void; response: KillSwitchState };
  'killswitch:activate': { payload: { reason?: string }; response: KillSwitchState };
  'killswitch:deactivate': { payload: void; response: KillSwitchState };

  // Semantic Search (AI)
  'search:query': { payload: { query: string; entities: WorkspaceEntity[]; config?: Partial<SearchConfig> }; response: SearchResult[] };
  'search:update-config': { payload: { config: SearchConfig }; response: { success: boolean } };
  'search:get-config': { payload: void; response: SearchConfig };

  // Dry-Run (#10)
  'pipeline:dry-run': { payload: { pipeline: Pipeline; config?: Partial<DryRunConfig> }; response: DryRunResult };
  'workflow:dry-run': { payload: { workflow: WorkflowDefinition; config?: Partial<DryRunConfig> }; response: { steps: string[]; warnings: string[]; estimatedDuration: number } };

  // Git operations (#23)
  'git:get-config': { payload: void; response: GitConfig };
  'git:set-config': { payload: { config: GitConfig }; response: { success: boolean } };
  'git:test-connection': { payload: void; response: { success: boolean; error?: string } };
  'git:status': { payload: { agentId?: string }; response: GitStatusResult };
  'git:log': { payload: { count?: number; agentId?: string }; response: GitLogEntry[] };
  'git:commit': { payload: { message: string; all?: boolean; agentId?: string }; response: { success: boolean; error?: string } };
  'git:push': { payload: { branch?: string; agentId?: string }; response: { success: boolean; error?: string } };
  'git:pull': { payload: { branch?: string; agentId?: string }; response: { success: boolean; error?: string } };
  'git:branch-list': { payload: void; response: GitBranchInfo[] };
  'git:branch-switch': { payload: { name: string }; response: { success: boolean; error?: string } };
  'git:branch-create': { payload: { name: string; from?: string }; response: { success: boolean; error?: string } };
  'git:merge': { payload: { from: string; to: string; agentId?: string }; response: { success: boolean; error?: string } };
  'git:diff': { payload?: { file?: string; from?: string; to?: string; agentId?: string }; response: string };
  'git:schedule-status': { payload: void; response: { pullActive: boolean; pushActive: boolean; pullIntervalMs: number; pushIntervalMs: number } };
  'git:schedule-toggle': { payload: { action: 'pull' | 'push'; active: boolean }; response: { success: boolean } };

  // Browser operations (#27 Playwright)
  'browser:extract-dom': { payload: { url: string }; response: { success: boolean; title?: string; cleanText?: string; error?: string } };
  'browser:test-macro': { payload: { steps: any[]; inputs?: Record<string, any> }; response: { success: boolean; output?: any; error?: string } };
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
  executeAgent: (payload: { id: string; context?: string; triggerType?: import('./schema').TriggerType }) => Promise<{ success: boolean }>;
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

  // Agent output history (F6.3)
  getOutputs: (payload: { agentId: string; limit?: number; offset?: number }) => Promise<AgentOutput[]>;
  getOutputStats: (payload: { agentId: string }) => Promise<{ total: number; avgTokens: number; avgExecutionMs: number; errorRate: number }>;
  deleteOutput: (payload: { id: string }) => Promise<{ success: boolean }>;
  clearOutputs: (payload: { agentId: string }) => Promise<{ success: boolean }>;

  // Git operations (#23)
  getGitConfig: () => Promise<GitConfig>;
  setGitConfig: (payload: { config: GitConfig }) => Promise<{ success: boolean }>;
  testGitConnection: () => Promise<{ success: boolean; error?: string }>;
  getGitStatus: (payload?: { agentId?: string }) => Promise<GitStatusResult>;
  getGitLog: (payload?: { count?: number; agentId?: string }) => Promise<GitLogEntry[]>;
  gitCommit: (payload: { message: string; all?: boolean; agentId?: string }) => Promise<{ success: boolean; error?: string }>;
  gitPush: (payload?: { branch?: string; agentId?: string }) => Promise<{ success: boolean; error?: string }>;
  gitPull: (payload?: { branch?: string; agentId?: string }) => Promise<{ success: boolean; error?: string }>;
  getGitBranches: () => Promise<GitBranchInfo[]>;
  gitSwitchBranch: (payload: { name: string }) => Promise<{ success: boolean; error?: string }>;
  gitCreateBranch: (payload: { name: string; from?: string }) => Promise<{ success: boolean; error?: string }>;
  gitMerge: (payload: { from: string; to: string; agentId?: string }) => Promise<{ success: boolean; error?: string }>;
  getGitDiff: (payload?: { file?: string; from?: string; to?: string; agentId?: string }) => Promise<string>;
  getGitScheduleStatus: () => Promise<{ pullActive: boolean; pushActive: boolean; pullIntervalMs: number; pushIntervalMs: number }>;
  toggleGitSchedule: (payload: { action: 'pull' | 'push'; active: boolean }) => Promise<{ success: boolean }>;

  // Browser operations (#27 Playwright)
  browserExtractDom: (payload: { url: string }) => Promise<{ success: boolean; title?: string; cleanText?: string; error?: string }>;
  browserTestMacro: (payload: { steps: any[]; inputs?: Record<string, any> }) => Promise<{ success: boolean; output?: any; error?: string }>;

  // Context Builder (F6.2)
  getContextOptions: (payload: { agentId: string }) => Promise<ContextSource[]>;
  fetchContext: (payload: { agentId: string; contextConfig: ContextConfig }) => Promise<{ context: string; tokensUsed: number; sourceBreakdown: { sourceId: string; chars: number; tokens: number }[] }>;
  searchContextNodes: (payload: { query: string; filter?: string }) => Promise<{ id: string; title: string; projectId?: string }[]>;
  searchContextTasks: (payload: { query: string; status?: string }) => Promise<{ id: string; title: string; status: string }[]>;

  // Context Builder (F6.8) — workspace entities for ContextBuilder UI
  getWorkspaceEntities: () => Promise<{ nodes: { id: string; title: string }[]; tasks: { id: string; title: string }[]; drafts: { id: string; contentPreview: string }[] }>;

  // Feedback (#26)
  saveFeedback: (payload: { feedback: FeedbackEntry }) => Promise<{ success: boolean; error?: string }>;

  // Workspace sync (F6.2)
  syncWorkspace: (payload: { entities: WorkspaceEntity[] }) => Promise<{ success: boolean }>;
  getAllWorkspaceEntities: () => Promise<WorkspaceEntity[]>;

  // KillSwitch (#9)
  getKillSwitchStatus: () => Promise<KillSwitchState>;
  activateKillSwitch: (payload?: { reason?: string }) => Promise<KillSwitchState>;
  deactivateKillSwitch: () => Promise<KillSwitchState>;

  // Semantic Search (AI)
  searchQuery: (payload: { query: string; entities: WorkspaceEntity[]; config?: Partial<SearchConfig> }) => Promise<SearchResult[]>;
  updateSearchConfig: (payload: { config: SearchConfig }) => Promise<{ success: boolean }>;
  getSearchConfig: () => Promise<SearchConfig>;

  // Dry-Run (#10)
  dryRunPipeline: (payload: { pipeline: Pipeline; config?: Partial<DryRunConfig> }) => Promise<DryRunResult>;
  dryRunWorkflow: (payload: { workflow: WorkflowDefinition; config?: Partial<DryRunConfig> }) => Promise<{ steps: string[]; warnings: string[]; estimatedDuration: number }>;

  // Pipeline DAG (F6.12)
  savePipeline: (payload: { pipeline: import('./schema').Pipeline }) => Promise<{ success: boolean }>;
  deletePipeline: (payload: { id: string }) => Promise<{ success: boolean }>;
  getPipelines: () => Promise<import('./schema').Pipeline[]>;
  executePipeline: (payload: { id: string }) => Promise<{ success: boolean; error?: string }>;
  getPipelineStatus: (payload: { id: string }) => Promise<{ status: string; currentNodeId?: string; progress?: number } | null>;

  // Workflows (#1)
  saveWorkflow: (payload: { workflow: WorkflowDefinition }) => Promise<{ success: boolean }>;
  deleteWorkflow: (payload: { id: string }) => Promise<{ success: boolean }>;
  getWorkflows: () => Promise<WorkflowDefinition[]>;
  executeWorkflow: (payload: { id: string; mode?: WorkflowMode }) => Promise<WorkflowExecutionResult>;
  getWorkflowResult: (payload: { executionId: string }) => Promise<WorkflowExecutionResult | null>;
  getWorkflowLogs: (payload: { workflowId: string }) => Promise<WorkflowLogEntry[]>;
}
