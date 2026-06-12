// ============================================================================
// NEXUS — Preload Script (contextBridge)
// JEDYNY most między Renderer a Main Process
// Łączy V2 legacy API + Phase 1 Agent Bridge
// ============================================================================
// contextIsolation: true → renderer nie ma dostępu do Node.js
// Renderer widzi tylko: window.nexusBridge = { ... }
// ============================================================================

import { contextBridge, ipcRenderer } from 'electron';
import { Agent, AgentOutput, AgentStatus, ProviderAuthConfig } from '../shared/types/schema';
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
    ipcRenderer.removeAllListeners(channel);
    const handler = (_event: Electron.IpcRendererEvent, output: AgentOutput) => callback(output);
    ipcRenderer.on(channel, handler);
    return () => { ipcRenderer.removeListener(channel, handler); };
  },

  onAgentStatus: (callback) => {
    const channel = 'agent:status';
    ipcRenderer.removeAllListeners(channel);
    const handler = (_event: Electron.IpcRendererEvent, data: { agentId: string; status: AgentStatus }) => callback(data);
    ipcRenderer.on(channel, handler);
    return () => { ipcRenderer.removeListener(channel, handler); };
  },

  onAgentStream: (callback) => {
    const channel = 'agent:stream';
    ipcRenderer.removeAllListeners(channel);
    const handler = (_event: Electron.IpcRendererEvent, data: { agentId: string; token: string }) => callback(data);
    ipcRenderer.on(channel, handler);
    return () => { ipcRenderer.removeListener(channel, handler); };
  },

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
  // V2 Legacy API (from NEXUS V2 preload)
  // ========================================================================

  sendRlhfRejection: (payload) => {
    ipcRenderer.send('RLHF_REJECTION', payload);
  },

  sendRlhfAcceptance: (payload) => {
    ipcRenderer.send('RLHF_ACCEPT', payload);
  },

  onSsrfBlock: (callback) => {
    const channel = 'SSRF_BLOCK_TRIGGERED';
    ipcRenderer.removeAllListeners(channel);
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload);
    ipcRenderer.on(channel, handler);
    return () => { ipcRenderer.removeListener(channel, handler); };
  },

  onProxyReady: (callback) => {
    const channel = 'PROXY_READY';
    ipcRenderer.removeAllListeners(channel);
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload);
    ipcRenderer.on(channel, handler);
    return () => { ipcRenderer.removeListener(channel, handler); };
  },

  onNewAgentEntry: (callback) => {
    const channel = 'NEW_AGENT_ENTRY';
    ipcRenderer.removeAllListeners(channel);
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload);
    ipcRenderer.on(channel, handler);
    return () => { ipcRenderer.removeListener(channel, handler); };
  },

  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
};

// ============================================================================
// Eksponuj most do renderera
// ============================================================================
contextBridge.exposeInMainWorld('nexusBridge', nexusBridge);
