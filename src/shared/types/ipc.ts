// ============================================================================
// NEXUS — IPC Typed Channels (Phase 1)
// Typizowane nazwy eventów + payloady dla komunikacji między procesami
// Tripartite Channel: Command, Telemetry, Data Firehose
// ============================================================================

import { Agent, AgentOutput, AgentStatus, ProviderAuthConfig, ContextSource, ContextConfig, GitConfig, GitStatusResult, GitLogEntry, GitBranchInfo, Pipeline, FeedbackEntry, WorkspaceEntity, KillSwitchState, SearchResult, SearchConfig, DryRunResult, DryRunConfig, DownloadedFileRecord } from './schema';

/** Public provider config without sensitive apiKey — safe for renderer consumption */
export interface ProviderAuthConfigPublic {
  provider: string;
  label: string;
  baseUrl?: string;
  models: string[];
  isBuiltin: boolean;
  createdAt: string;
  updatedAt: string;
  hasApiKey: boolean;
}
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
  'agent:execute': { payload: { id: string; context?: string; triggerType?: import('./schema').TriggerType }; response: { success: boolean; output?: AgentOutput } };
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

  // Useme Automation
  'useme:submit-decision': { payload: { jobId: string; decision: string; proposal?: string }; response: { success: boolean; error?: string } };

  // Browser operations (#27 Playwright)
  'browser:extract-dom': { payload: { url: string }; response: { success: boolean; title?: string; cleanText?: string; error?: string } };
  'browser:test-macro': { payload: { steps: any[]; inputs?: Record<string, any> }; response: { success: boolean; output?: any; error?: string } };
  'browser:download-and-save': { payload: { url: string; steps: any[]; inputs?: Record<string, any>; metadata?: Record<string, any> }; response: { success: boolean; files?: any[]; records?: DownloadedFileRecord[]; error?: string } };
  'browser:save-files': { payload: { sourceUrl: string; files: Array<{ name: string; path: string; mime: string }>; metadata?: Record<string, any> }; response: { success: boolean; records?: DownloadedFileRecord[]; error?: string } };
  'browser:get-downloaded-files': { payload: { limit?: number; metadataKey?: string; metadataValue?: any }; response: DownloadedFileRecord[] };
  'browser:delete-file': { payload: { id: string }; response: { success: boolean; error?: string } };

  // Logs pagination
  'logs:get': { payload: { cursor?: string | null; limit?: number }; response: { entries: Array<{ id: string; timestamp: number; payload: any; size: number }>; nextCursor: string | null; hasMore: boolean } };

  // RPM Usage (RateLimiter)
  'rpm:usage': { payload: void; response: { totalUsed: number; totalLimit: number; keys: { key: string; used: number; limit: number }[] } };

  // Projekty Mode (Etap 1)
  'projekty:table-info': { payload: { tableName: string }; response: any[] };
  'projekty:project:save': { payload: { project: import('../../types').Projekt }; response: { success: boolean } };
  'projekty:project:get-all': { payload: void; response: import('../../types').Projekt[] };
  'projekty:project:get': { payload: { id: string }; response: import('../../types').Projekt | null };
  'projekty:project:delete': { payload: { id: string }; response: { success: boolean } };

  'projekty:chat:save': { payload: { message: import('../../types').ProjektyChatMessage }; response: { success: boolean } };
  'projekty:chat:get': { payload: { projectId: string; conversationId?: string }; response: import('../../types').ProjektyChatMessage[] };
  'projekty:chat:delete': { payload: { id: string }; response: { success: boolean } };
  'projekty:chat:get-unprocessed': { payload: { projectId: string; conversationId?: string }; response: import('../../types').ProjektyChatMessage[] };
  'projekty:chat:mark-processed': { payload: { ids: string[] }; response: { success: boolean } };

  'projekty:node:save': { payload: { node: import('../../types').ProjektyNode }; response: { success: boolean } };
  'projekty:node:get': { payload: { projectId: string }; response: import('../../types').ProjektyNode[] };
  'projekty:node:delete': { payload: { id: string }; response: { success: boolean } };

  'projekty:edge:save': { payload: { edge: import('../../types').ProjektyEdge }; response: { success: boolean } };
  'projekty:edge:get': { payload: { projectId: string }; response: import('../../types').ProjektyEdge[] };
  'projekty:edge:delete': { payload: { id: string }; response: { success: boolean } };

  'projekty:changelog:save': { payload: { entry: import('../../types').ProjektyChangelog }; response: { success: boolean } };
  'projekty:changelog:get': { payload: { projectId: string }; response: import('../../types').ProjektyChangelog[] };

  // Conversations (wiele rozmow na projekt)
  'projekty:conversation:save': { payload: { conversation: import('../../types').ProjektyConversation }; response: { success: boolean } };
  'projekty:conversation:get': { payload: { projectId: string }; response: import('../../types').ProjektyConversation[] };
  'projekty:conversation:delete': { payload: { id: string }; response: { success: boolean } };

  // Node Annotations (komentarze do wezlow)
  'projekty:annotation:save': { payload: { annotation: import('../../types').ProjektyNodeAnnotation }; response: { success: boolean } };
  'projekty:annotation:get': { payload: { nodeId: string }; response: import('../../types').ProjektyNodeAnnotation[] };
  'projekty:annotation:delete': { payload: { id: string }; response: { success: boolean } };

  // LLM calls (rzeczywiste AI)
  'projekty:chat:llm': { payload: { systemPrompt: string; messages: import('../../types').ProjektyChatMessage[]; model: string; nodes?: any[]; edges?: any[]; specContent?: string }; response: { content: string } };

  // Global Context i node queries
  'projekty:global-context:save': { payload: { projectId: string; context: any }; response: {} };
  'projekty:global-context:get': { payload: { projectId: string }; response: any };
  'projekty:node:get-undecomposed': { payload: { projectId: string }; response: import('../../types').ProjektyNode[] };

  // Project Documents (Plan 01)
  'projekty:document:import': { payload: { projectId: string; filePath: string }; response: { success: boolean; data?: any; error?: string } };
  'projekty:document:get': { payload: { projectId: string }; response: any[] };
  'projekty:document:delete': { payload: { id: string }; response: { success: boolean } };
  'projekty:document:content': { payload: { id: string }; response: { success: boolean; content?: string; error?: string } };
  'projekty:document:summarize': { payload: { documentId: string; content: string; tokenCount: number }; response: { success: boolean; summary?: string; error?: string } };

  // System Tab (Plan 02)
  'system:status': { payload: void; response: any };
  'system:handlers': { payload: void; response: { channel: string; group: string; description: string }[] };
  'system:scan-architecture': { payload: void; response: { nodes: { file: string; exports: string[] }[]; edges: { from: string; to: string; type: string }[]; hash: string } };
  'system:get-logs': { payload: void; response: any[] };
  'system:events-subscribe': { payload: void; response: { success: boolean } };
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
  browserDownloadAndSave: (payload: { url: string; steps: any[]; inputs?: Record<string, any>; metadata?: Record<string, any> }) => Promise<{ success: boolean; files?: any[]; records?: DownloadedFileRecord[]; error?: string }>;
  browserSaveFiles: (payload: { sourceUrl: string; files: Array<{ name: string; path: string; mime: string }>; metadata?: Record<string, any> }) => Promise<{ success: boolean; records?: DownloadedFileRecord[]; error?: string }>;
  browserGetDownloadedFiles: (payload?: { limit?: number; metadataKey?: string; metadataValue?: any }) => Promise<DownloadedFileRecord[]>;
  browserDeleteFile: (payload: { id: string }) => Promise<{ success: boolean; error?: string }>;

  // Logs pagination (A7 fix)
  getLogs: (payload?: { cursor?: string | null; limit?: number }) => Promise<{ entries: Array<{ id: string; timestamp: number; payload: any; size: number }>; nextCursor: string | null; hasMore: boolean }>;

  // Bridge Health Status
  bridgeHealth: (payload: { port: number }) => Promise<{ alive: boolean; model: string; port: number }>;

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

  // RPM Usage (RateLimiter)
  getRpmUsage: () => Promise<{ totalUsed: number; totalLimit: number; keys: { key: string; used: number; limit: number }[] }>;

  // Failover Router
  getFailoverSettings: () => Promise<import('./schema').FailoverSettings>;
  saveFailoverSettings: (payload: { settings: Partial<import('./schema').FailoverSettings> }) => Promise<{ success: boolean; error?: string }>;
  getFailoverStatus: () => Promise<{ status: Record<string, { status: 'ONLINE' | 'OFFLINE'; ping: number }>; activeFailovers: string[] }>;
  respondFailover: (payload: { proposalId: string; approved: boolean }) => Promise<{ success: boolean; error?: string }>;
  respondRecovery: (payload: { modelName: string; approved: boolean }) => Promise<{ success: boolean; error?: string }>;
  triggerHealthCheck: () => Promise<{ success: boolean; status: Record<string, { status: 'ONLINE' | 'OFFLINE'; ping: number }>; activeFailovers: string[]; error?: string }>;

  onFailoverProposal: (callback: (data: { proposalId: string; modelName: string; timeoutSeconds: number }) => void) => () => void;
  onRecoveryProposal: (callback: (data: { modelName: string }) => void) => () => void;
  onAiStatusChanged: (callback: (data: { status: Record<string, { status: 'ONLINE' | 'OFFLINE'; ping: number }>; activeFailovers: string[] }) => void) => () => void;

  // Useme Automation
  usemeStart: (payload: { mode: 'dry' | 'prod'; headless: boolean }) => Promise<{ success: boolean; error?: string }>;
  usemeStop: () => Promise<{ success: boolean; error?: string }>;
  usemeStatus: () => Promise<{ running: boolean }>;
  usemeListPrompts: () => Promise<{ success: boolean; error?: string; files: string[] }>;
  usemeReadPrompt: (payload: { filename: string }) => Promise<{ success: boolean; error?: string; content: string }>;
  usemeSavePrompt: (payload: { filename: string; content: string }) => Promise<{ success: boolean; error?: string }>;

  usemeSubmitDecision: (payload: { jobId: string; decision: string; proposal?: string }) => Promise<{ success: boolean; error?: string }>;

  onUsemeLog: (callback: (data: { level: 'info' | 'warn' | 'error'; message: string; timestamp: string }) => void) => () => void;
  onUsemeReviewRequired: (callback: (data: { jobId: string; jobTitle: string; price: string; proposal: string; auditReport: string }) => void) => () => void;
  onUsemeStatusChanged: (callback: (data: { status: string; error?: string }) => void) => () => void;

  // Projekty Mode (Etap 1)
  projGetTableInfo: (payload: { tableName: string }) => Promise<any[]>;
  projSaveProject: (payload: { project: import('../../types').Projekt }) => Promise<{ success: boolean }>;
  projGetProjects: () => Promise<import('../../types').Projekt[]>;
  projGetProject: (payload: { id: string }) => Promise<import('../../types').Projekt | null>;
  projDeleteProject: (payload: { id: string }) => Promise<{ success: boolean }>;

  projSaveChatMessage: (payload: { message: import('../../types').ProjektyChatMessage }) => Promise<{ success: boolean }>;
  projGetChatMessages: (payload: { projectId: string; conversationId?: string }) => Promise<import('../../types').ProjektyChatMessage[]>;
  projDeleteChatMessage: (payload: { id: string }) => Promise<{ success: boolean }>;
  projGetUnprocessedMessages: (payload: { projectId: string; conversationId?: string }) => Promise<import('../../types').ProjektyChatMessage[]>;
  projMarkMessagesProcessed: (payload: { ids: string[] }) => Promise<{ success: boolean }>;

  projSaveNode: (payload: { node: import('../../types').ProjektyNode }) => Promise<{ success: boolean }>;
  projGetNodes: (payload: { projectId: string }) => Promise<import('../../types').ProjektyNode[]>;
  projDeleteNode: (payload: { id: string }) => Promise<{ success: boolean }>;

  projSaveEdge: (payload: { edge: import('../../types').ProjektyEdge }) => Promise<{ success: boolean }>;
  projGetEdges: (payload: { projectId: string }) => Promise<import('../../types').ProjektyEdge[]>;
  projDeleteEdge: (payload: { id: string }) => Promise<{ success: boolean }>;

  projSaveChangelog: (payload: { entry: import('../../types').ProjektyChangelog }) => Promise<{ success: boolean }>;
  projGetChangelog: (payload: { projectId: string }) => Promise<import('../../types').ProjektyChangelog[]>;

  // Conversations
  projSaveConversation: (payload: { conversation: import('../../types').ProjektyConversation }) => Promise<{ success: boolean }>;
  projGetConversations: (payload: { projectId: string }) => Promise<import('../../types').ProjektyConversation[]>;
  projDeleteConversation: (payload: { id: string }) => Promise<{ success: boolean }>;

  // Annotations
  projSaveAnnotation: (payload: { annotation: import('../../types').ProjektyNodeAnnotation }) => Promise<{ success: boolean }>;
  projGetAnnotations: (payload: { nodeId: string }) => Promise<import('../../types').ProjektyNodeAnnotation[]>;
  projDeleteAnnotation: (payload: { id: string }) => Promise<{ success: boolean }>;

  // LLM calls
  projInvokeChatLLM: (payload: { systemPrompt: string; messages: import('../../types').ProjektyChatMessage[]; model: string; nodes?: any[]; edges?: any[]; specContent?: string }) => Promise<{ content: string }>;
  // Global Context i node queries
  projSaveGlobalContext: (payload: { projectId: string; context: any }) => Promise<{}>;
  projGetGlobalContext: (payload: { projectId: string }) => Promise<any>;
  projGetUndecomposedNodes: (payload: { projectId: string }) => Promise<import('../../types').ProjektyNode[]>;

  // Project Documents (Plan 01)
  projImportDocument: (payload: { projectId: string; filePath: string }) => Promise<{ success: boolean; data?: any; error?: string }>;
  projGetDocuments: (payload: { projectId: string }) => Promise<any[]>;
  projDeleteDocument: (payload: { id: string }) => Promise<{ success: boolean }>;
  projGetDocumentContent: (payload: { id: string }) => Promise<{ success: boolean; content?: string; error?: string }>;
  projSummarizeDocument: (payload: { documentId: string; content: string; tokenCount: number }) => Promise<{ success: boolean; summary?: string; error?: string }>;

  // Research Space
  researchProjectCreate: (payload: { name: string }) => Promise<{ id: string; name: string }>;
  researchProjectList: () => Promise<any[]>;
  researchEntryCreate: (payload: { project_id: string; title?: string }) => Promise<{ id: string; project_id: string; title: string }>;
  researchEntryList: (payload: { project_id: string }) => Promise<any[]>;
  researchEntryGet: (payload: { entry_id: string }) => Promise<{ entry: any; sources: any[]; messages: any[]; observations: any[] }>;
  researchChatSend: (payload: { entry_id: string; message: string; model?: string }) => Promise<{ messages: any[] }>;
  researchSourceImport: (payload: { entry_id: string; file_name: string; file_path: string; file_type?: string; content_text?: string }) => Promise<{ id: string; entry_id: string; file_name: string; file_path: string; file_type?: string; content_text?: string }>;
  researchAgentsRun: (payload: { entry_id: string }) => Promise<{ observations: any[] }>;
  researchEntryUpdate: (payload: { id: string; title: string }) => Promise<{ success: boolean }>;
  researchEntryDelete: (payload: { id: string }) => Promise<{ success: boolean }>;
  researchProjectDelete: (payload: { id: string }) => Promise<{ success: boolean }>;
  researchSourceImportFile: (payload: { entry_id: string }) => Promise<{ id: string; entry_id: string; file_name: string; file_path: string; content_text: string }>;
  researchChatDelete: (payload: { id: string }) => Promise<{ success: boolean }>;
  researchSourceDelete: (payload: { id: string }) => Promise<{ success: boolean }>;
  researchObservationAdd: (payload: { entry_id: string; observation_type: string; content: string }) => Promise<{ success: boolean; id?: string }>;
  researchObservationDelete: (payload: { id: string }) => Promise<{ success: boolean }>;
  researchChatMessages: (payload: { entry_id: string; page: number; page_size: number }) => Promise<{ messages: any[]; total: number }>;

  // System Tab (Plan 02)
  systemGetStatus: () => Promise<any>;
  systemGetHandlers: () => Promise<{ channel: string; group: string; description: string }[]>;
  systemScanArchitecture: () => Promise<{ nodes: { file: string; exports: string[] }[]; edges: { from: string; to: string; type: string }[]; hash: string }>;
  systemGetLogs: () => Promise<any[]>;
  systemSubscribeEvents: (callback: (event: any) => void) => () => void;
}
