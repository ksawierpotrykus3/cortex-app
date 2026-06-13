// ============================================================================
// NEXUS — Preload Script (contextBridge)
// JEDYNY most między Renderer a Main Process
// Łączy V2 legacy API + Phase 1 Agent Bridge
// ============================================================================
// contextIsolation: true → renderer nie ma dostępu do Node.js
// Renderer widzi tylko: window.nexusBridge = { ... }
// ============================================================================

import { contextBridge, ipcRenderer } from 'electron';
import { Agent, AgentOutput, AgentStatus, ProviderAuthConfig, ContextSource, ContextConfig, GitConfig, GitStatusResult, GitLogEntry, GitBranchInfo, Pipeline } from '../shared/types/schema';
import { WorkflowDefinition, WorkflowExecutionResult, WorkflowLogEntry, WorkflowMode } from '../shared/types/workflow';
import { NexusBridge } from '../shared/types/ipc';

// ============================================================================
// Build Bridge
// ============================================================================
const nexusBridge: NexusBridge = {
  // ========================================================================
  // Agent Commands (Renderer → Main via ipcRenderer.invoke)
  // ========================================================================

  executeAgent: (payload) => ipcRenderer.invoke('agent:execute', payload),
  stopAgent: (payload) => ipcRenderer.invoke('agent:stop', payload),
  createAgent: (payload) => ipcRenderer.invoke('agent:create', payload),
  updateAgent: (payload) => ipcRenderer.invoke('agent:update', payload),
  deleteAgent: (payload) => ipcRenderer.invoke('agent:delete', payload),
  getAgents: () => ipcRenderer.invoke('agent:get-all'),
  getAgent: (payload) => ipcRenderer.invoke('agent:get', payload),

  // ========================================================================
  // Provider Config (Phase 2)
  // ========================================================================

  getProviderConfigs: () => ipcRenderer.invoke('provider:get-configs'),
  setApiKey: (payload) => ipcRenderer.invoke('provider:set-api-key', payload),
  testConnection: (payload) => ipcRenderer.invoke('provider:test-connection', payload),
  getAvailableModels: () => ipcRenderer.invoke('provider:get-models'),
  upsertProviderConfig: (payload) => ipcRenderer.invoke('provider:upsert-config', payload),

  // ========================================================================
  // Agent Status Listeners (Main → Renderer)
  // ========================================================================

  onAgentOutput: (callback) => {
    const channel = 'agent:output';
    const handler = (_event: Electron.IpcRendererEvent, output: AgentOutput) => callback(output);
    ipcRenderer.on(channel, handler);
    return () => { ipcRenderer.removeListener(channel, handler); };
  },

  onAgentStatus: (callback) => {
    const channel = 'agent:status';
    const handler = (_event: Electron.IpcRendererEvent, data: { agentId: string; status: AgentStatus }) => callback(data);
    ipcRenderer.on(channel, handler);
    return () => { ipcRenderer.removeListener(channel, handler); };
  },

  onAgentStream: (callback) => {
    const channel = 'agent:stream';
    const handler = (_event: Electron.IpcRendererEvent, data: { agentId: string; token: string }) => callback(data);
    ipcRenderer.on(channel, handler);
    return () => { ipcRenderer.removeListener(channel, handler); };
  },

  // ========================================================================
  // Agent Output History (F6.3)
  // ========================================================================

  getOutputs: (payload) => ipcRenderer.invoke('agent:get-outputs', payload),
  getOutputStats: (payload) => ipcRenderer.invoke('agent:get-output-stats', payload),
  deleteOutput: (payload) => ipcRenderer.invoke('agent:delete-output', payload),
  clearOutputs: (payload) => ipcRenderer.invoke('agent:clear-outputs', payload),

  // ========================================================================
  // Changelog (Renderer → Main, fire-and-forget)
  // ========================================================================

  approveOutput: (payload) => {
    ipcRenderer.send('changelog:approve', payload);
  },

  rejectOutput: (payload) => {
    ipcRenderer.send('changelog:reject', payload);
  },

  // ========================================================================
  // Git Operations (#23)
  // ========================================================================

  getGitConfig: () => ipcRenderer.invoke('git:get-config'),
  setGitConfig: (payload) => ipcRenderer.invoke('git:set-config', payload),
  testGitConnection: () => ipcRenderer.invoke('git:test-connection'),
  getGitStatus: () => ipcRenderer.invoke('git:status'),
  getGitLog: (payload) => ipcRenderer.invoke('git:log', payload || {}),
  gitCommit: (payload) => ipcRenderer.invoke('git:commit', payload),
  gitPush: (payload) => ipcRenderer.invoke('git:push', payload || {}),
  gitPull: (payload) => ipcRenderer.invoke('git:pull', payload || {}),
  getGitBranches: () => ipcRenderer.invoke('git:branch-list'),
  gitSwitchBranch: (payload) => ipcRenderer.invoke('git:branch-switch', payload),
  gitCreateBranch: (payload) => ipcRenderer.invoke('git:branch-create', payload),
  gitMerge: (payload) => ipcRenderer.invoke('git:merge', payload),
  getGitDiff: (payload) => ipcRenderer.invoke('git:diff', payload || {}),
  getGitScheduleStatus: () => ipcRenderer.invoke('git:schedule-status'),
  toggleGitSchedule: (payload) => ipcRenderer.invoke('git:schedule-toggle', payload),

  // ========================================================================
  // Context Builder (F6.2)
  // ========================================================================

  getContextOptions: (payload) => ipcRenderer.invoke('context:get-options', payload),
  fetchContext: (payload) => ipcRenderer.invoke('context:fetch', payload),
  searchContextNodes: (payload) => ipcRenderer.invoke('context:search-nodes', payload),
  searchContextTasks: (payload) => ipcRenderer.invoke('context:search-tasks', payload),

  // ========================================================================
  // Context Builder (F6.8) — workspace entities
  // ========================================================================

  getWorkspaceEntities: () => ipcRenderer.invoke('agent:get-workspace-entities'),

  // ========================================================================
  // Feedback (#26)
  // ========================================================================

  saveFeedback: (payload) => ipcRenderer.invoke('feedback:save', payload),

  // ========================================================================
  // Workspace sync (F6.2)
  // ========================================================================

  syncWorkspace: (payload) => ipcRenderer.invoke('workspace:sync', payload),
  getAllWorkspaceEntities: () => ipcRenderer.invoke('workspace:get-all'),

  // ========================================================================
  // KillSwitch (#9)
  // ========================================================================

  getKillSwitchStatus: () => ipcRenderer.invoke('killswitch:status'),
  activateKillSwitch: (payload) => ipcRenderer.invoke('killswitch:activate', payload),
  deactivateKillSwitch: () => ipcRenderer.invoke('killswitch:deactivate'),

  // ========================================================================
  // Semantic Search (AI)
  // ========================================================================

  searchQuery: (payload) => ipcRenderer.invoke('search:query', payload),
  updateSearchConfig: (payload) => ipcRenderer.invoke('search:update-config', payload),
  getSearchConfig: () => ipcRenderer.invoke('search:get-config'),

  // ========================================================================
  // Dry-Run (#10)
  // ========================================================================

  dryRunPipeline: (payload) => ipcRenderer.invoke('pipeline:dry-run', payload),
  dryRunWorkflow: (payload) => ipcRenderer.invoke('workflow:dry-run', payload),

  // ========================================================================
  // Pipeline DAG (F6.12)
  // ========================================================================

  savePipeline: (payload) => ipcRenderer.invoke('pipeline:save', payload),
  deletePipeline: (payload) => ipcRenderer.invoke('pipeline:delete', payload),
  getPipelines: () => ipcRenderer.invoke('pipeline:get-all'),
  executePipeline: (payload) => ipcRenderer.invoke('pipeline:execute', payload),
  getPipelineStatus: (payload) => ipcRenderer.invoke('pipeline:status', payload),

  // ========================================================================
  // Workflows (#1)
  // ========================================================================

  saveWorkflow: (payload) => ipcRenderer.invoke('workflow:save', payload),
  deleteWorkflow: (payload) => ipcRenderer.invoke('workflow:delete', payload),
  getWorkflows: () => ipcRenderer.invoke('workflow:get-all'),
  executeWorkflow: (payload) => ipcRenderer.invoke('workflow:execute', payload),
  getWorkflowResult: (payload) => ipcRenderer.invoke('workflow:result', payload),
  getWorkflowLogs: (payload) => ipcRenderer.invoke('workflow:logs', payload),
};

// ============================================================================
// Eksponuj most do renderera
// ============================================================================
contextBridge.exposeInMainWorld('nexusBridge', nexusBridge);
