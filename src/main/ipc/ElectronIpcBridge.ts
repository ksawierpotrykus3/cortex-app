// ============================================================================
// NEXUS — ElectronIpcBridge (Phase 1)
// Rejestruje IPC handlery dla agentów: CRUD, execute, stop
// Używa ipcMain.handle (invoke/promise) dla komend
// ============================================================================

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { Agent, AgentOutput, AgentStatus, ProviderAuthConfig } from '../../shared/types/schema';
import { AgentOrchestrator } from '../core/AgentOrchestrator';
import { StorageEngine } from '../storage/StorageEngine';
import { ProviderRegistry } from '../ai/ProviderRegistry';

export class ElectronIpcBridge {
  private ipc: typeof ipcMain;
  private orchestrator: AgentOrchestrator;
  private storage: StorageEngine;
  private providerRegistry: ProviderRegistry;

  constructor(
    ipcInstance: typeof ipcMain,
    orchestrator: AgentOrchestrator,
    storage: StorageEngine,
    providerRegistry: ProviderRegistry
  ) {
    this.ipc = ipcInstance;
    this.orchestrator = orchestrator;
    this.storage = storage;
    this.providerRegistry = providerRegistry;
  }

  /**
   * Rejestruje wszystkie IPC handlery.
   */
  registerHandlers(): void {
    // === Agent CRUD =======================================================
    this.ipc.handle('agent:create', (_event: IpcMainInvokeEvent, payload: any) => {
      const agent: Agent = {
        id: crypto.randomUUID?.() || `agent_${Date.now()}`,
        ...payload,
        status: AgentStatus.ACTIVE,
        runCount: 0,
        errorCount: 0,
        rating: 0,
        tags: payload.tags || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.orchestrator.registerAgent(agent);
      this.storage.saveAgent(agent);

      return agent;
    });

    this.ipc.handle('agent:update', (_event: IpcMainInvokeEvent, payload: { id: string; updates: Partial<Agent> }) => {
      this.orchestrator.updateAgent(payload.id, payload.updates);

      // Load from storage, update, save back
      const existing = this.storage.getAgent(payload.id);
      if (existing) {
        const updated = { ...existing, ...payload.updates, updatedAt: new Date().toISOString() };
        this.storage.saveAgent(updated);
        return updated;
      }

      // Fallback: get from orchestrator
      const fromOrch = this.orchestrator.getAgent(payload.id);
      if (fromOrch) {
        const updated = { ...fromOrch, ...payload.updates, updatedAt: new Date().toISOString() };
        this.storage.saveAgent(updated);
        return updated;
      }

      throw new Error(`Agent ${payload.id} not found`);
    });

    this.ipc.handle('agent:delete', (_event: IpcMainInvokeEvent, payload: { id: string }) => {
      this.orchestrator.unregisterAgent(payload.id);
      this.storage.deleteAgent(payload.id);
      return { success: true };
    });

    this.ipc.handle('agent:get-all', () => {
      // Merge: z orchestratora (runtime) i storage (persistent)
      const runtimeAgents = this.orchestrator.getAgents();
      const storedAgents = this.storage.getAllAgents();

      // Prefer runtime status
      const runtimeMap = new Map(runtimeAgents.map(a => [a.id, a]));
      const merged = storedAgents.map(stored => {
        const runtime = runtimeMap.get(stored.id);
        return runtime ? { ...stored, status: runtime.status, runCount: runtime.runCount } : stored;
      });

      // Add agents that are only in runtime (not yet saved)
      for (const rAgent of runtimeAgents) {
        if (!merged.find(m => m.id === rAgent.id)) {
          merged.push(rAgent);
        }
      }

      return merged;
    });

    this.ipc.handle('agent:get', (_event: IpcMainInvokeEvent, payload: { id: string }) => {
      const runtime = this.orchestrator.getAgent(payload.id);
      if (runtime) return runtime;

      return this.storage.getAgent(payload.id);
    });

    // === Agent Execution ==================================================
    this.ipc.handle('agent:execute', async (_event: IpcMainInvokeEvent, payload: { id: string; context?: string }) => {
      try {
        const output = await this.orchestrator.executeAgent(payload.id, payload.context);
        this.storage.saveOutput(output);
        return { success: true, output };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    this.ipc.handle('agent:stop', (_event: IpcMainInvokeEvent, payload: { id: string }) => {
      this.orchestrator.stopAgent(payload.id);
      return { success: true };
    });

    // === Changelog Actions ================================================
    this.ipc.on('changelog:approve', (_event, payload: { entryId: string; agentId: string }) => {
      this.storage.appendLog({ action: 'approve', ...payload });
    });

    this.ipc.on('changelog:reject', (_event, payload: { entryId: string; agentId: string; reason?: string }) => {
      this.storage.appendLog({ action: 'reject', ...payload });
    });

    // === Provider Config (Phase 2) ========================================
    this.ipc.handle('provider:get-configs', () => {
      return this.providerRegistry.getConfigs();
    });

    this.ipc.handle('provider:set-api-key', (_event, payload: { label: string; apiKey: string }) => {
      try {
        this.providerRegistry.setApiKey(payload.label, payload.apiKey);
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    this.ipc.handle('provider:test-connection', async (_event, payload: { label: string }) => {
      return this.providerRegistry.testConnection(payload.label);
    });

    this.ipc.handle('provider:get-models', () => {
      return this.providerRegistry.getAvailableModels();
    });

    this.ipc.handle('provider:upsert-config', (_event, payload: { config: ProviderAuthConfig }) => {
      try {
        this.providerRegistry.upsertConfig(payload.config);
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    console.log('[ElectronIpcBridge] Registered all IPC handlers');
  }

  destroy(): void {
    // Remove all handlers
    const channels = [
      'agent:create', 'agent:update', 'agent:delete',
      'agent:get-all', 'agent:get',
      'agent:execute', 'agent:stop',
      'provider:get-configs', 'provider:set-api-key',
      'provider:test-connection', 'provider:get-models',
      'provider:upsert-config',
    ];

    for (const channel of channels) {
      this.ipc.removeHandler(channel);
    }

    this.ipc.removeAllListeners('changelog:approve');
    this.ipc.removeAllListeners('changelog:reject');

    console.log('[ElectronIpcBridge] Destroyed');
  }
}
