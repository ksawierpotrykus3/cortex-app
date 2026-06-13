// ============================================================================
// NEXUS — AgentOrchestrator (Phase 1)
// State machine agenta z 6 stanami, heartbeat, auto-restart i CircuitBreaker
// ============================================================================

import { Agent, AgentStatus, AgentOutput, TriggerType, ContextConfig, ContextSource, WorkspaceEntity } from '../../shared/types/schema';
import { TelemetryMessage, FirehoseMessage } from '../../shared/types/ipc';
import { ProviderRegistry } from '../ai/ProviderRegistry';
import { StorageEngine } from '../storage/StorageEngine';
import { SandboxRunner } from '../sandbox/SandboxRunner';
import * as fs from 'fs';
import * as path from 'path';

// === Agent Execution State =================================================
interface AgentRuntimeState {
  agent: Agent;
  status: AgentStatus;
  retryCount: number;
  cooldownUntil: number | null;  // timestamp ms
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  startTime: number | null;
  tokensUsed: number;
  currentOutput: string;
  // Rate limiter (F6.1)
  runTimestamps: number[];        // ostatnie N uruchomień (dla rate limitu)
}

// === Event Callbacks =======================================================
export interface AgentOrchestratorEvents {
  onStatusChange: (agentId: string, status: AgentStatus) => void;
  onOutput: (output: AgentOutput) => void;
  onStream: (agentId: string, token: string) => void;
  onError: (agentId: string, error: string) => void;
}

// === AgentOrchestrator =====================================================
export class AgentOrchestrator {
  private agents: Map<string, AgentRuntimeState> = new Map();
  private events: AgentOrchestratorEvents;
  private providerRegistry: ProviderRegistry;
  private storage?: StorageEngine;
  private sandboxRunner?: SandboxRunner;

  // Config
  private readonly DEFAULT_MAX_RETRIES = 3;
  private readonly DEFAULT_COOLDOWN_MS = 30_000;  // 30s
  private readonly HEARTBEAT_INTERVAL_MS = 5_000; // co 5s

  constructor(events: AgentOrchestratorEvents, providerRegistry: ProviderRegistry, storage?: StorageEngine) {
    this.events = events;
    this.providerRegistry = providerRegistry;
    this.storage = storage;
    this.sandboxRunner = new SandboxRunner();
  }

  // =========================================================================
  // Agent Lifecycle
  // =========================================================================

  /**
   * Rejestruje agenta w orchestratorze.
   * Agent w stanie ACTIVE, gotowy do uruchomienia.
   */
  registerAgent(agent: Agent): void {
    if (this.agents.has(agent.id)) {
      console.warn(`[AgentOrchestrator] Agent ${agent.id} już istnieje — pomijam`);
      return;
    }

    const state: AgentRuntimeState = {
      agent,
      status: AgentStatus.ACTIVE,
      retryCount: 0,
      cooldownUntil: null,
      heartbeatTimer: null,
      startTime: null,
      tokensUsed: 0,
      currentOutput: '',
      runTimestamps: [],
    };

    this.agents.set(agent.id, state);
    this.setStatus(agent.id, AgentStatus.ACTIVE);
    console.log(`[AgentOrchestrator] Agent "${agent.name}" (${agent.id}) zarejestrowany`);
  }

  /**
   * Usuwa agenta z orchestratora.
   */
  unregisterAgent(agentId: string): void {
    const state = this.agents.get(agentId);
    if (!state) return;

    this.stopHeartbeat(agentId);
    this.agents.delete(agentId);
    console.log(`[AgentOrchestrator] Agent ${agentId} usunięty`);
  }

  /**
   * Aktualizuje konfigurację agenta w locie.
   */
  updateAgent(agentId: string, updates: Partial<Agent>): void {
    const state = this.agents.get(agentId);
    if (!state) {
      console.warn(`[AgentOrchestrator] Agent ${agentId} nie istnieje`);
      return;
    }

    state.agent = { ...state.agent, ...updates };
    console.log(`[AgentOrchestrator] Agent ${agentId} zaktualizowany`);
  }

  /**
   * Zwraca listę zarejestrowanych agentów.
   */
  getAgents(): Agent[] {
    return Array.from(this.agents.values()).map(s => ({
      ...s.agent,
      status: s.status,
    }));
  }

  /**
   * Zwraca agenta po ID.
   */
  getAgent(agentId: string): Agent | null {
    const state = this.agents.get(agentId);
    return state ? { ...state.agent, status: state.status } : null;
  }

  // =========================================================================
  // Execution
  // =========================================================================

  /**
   * Uruchamia agenta.
   * Sprawdza stan, permisje, budget, CircuitBreaker.
   * Emituje output przez callback events.
   */
  async executeAgent(agentId: string, context?: string, triggerType?: TriggerType): Promise<AgentOutput> {
    const state = this.agents.get(agentId);
    if (!state) {
      throw new Error(`Agent ${agentId} nie istnieje`);
    }

    // === State Validation ==================================================
    if (state.status === AgentStatus.DISABLED) {
      throw new Error(`Agent ${agentId} jest DISABLED — nie można uruchomić`);
    }

    if (state.status === AgentStatus.COOLDOWN) {
      if (state.cooldownUntil && Date.now() < state.cooldownUntil) {
        const remaining = Math.ceil((state.cooldownUntil - Date.now()) / 1000);
        throw new Error(`Agent ${agentId} w COOLDOWN — pozostało ${remaining}s`);
      }
      // Cooldown minął — wracamy do ACTIVE
      state.status = AgentStatus.ACTIVE;
    }

    if (state.status === AgentStatus.RUNNING) {
      throw new Error(`Agent ${agentId} już RUNNING`);
    }

    // === Start Execution ===================================================
    const startTime = Date.now();
    state.status = AgentStatus.RUNNING;
    state.startTime = startTime;
    state.currentOutput = '';
    state.tokensUsed = 0;

    this.setStatus(agentId, AgentStatus.RUNNING);
    this.startHeartbeat(agentId);

    const output: AgentOutput = {
      id: crypto.randomUUID?.() || `${agentId}_${startTime}`,
      agentId: agentId,
      agentName: state.agent.name,
      status: AgentStatus.RUNNING,
      prompt: state.agent.promptTemplate,
      contextSize: context?.length || 0,
      content: '',
      tokensUsed: 0,
      executionMs: 0,
      triggerType: TriggerType.MANUAL,
      modelName: state.agent.model.modelName,
      rating: 0,
      approved: null,
      createdAt: new Date(startTime).toISOString(),
      tags: state.agent.tags,
    };

    try {
      // === Permission Validation (F6.1 / F6.7) ==============================
      const perms = state.agent.permissions;
      if (perms) {
        // 1. Allowed Triggers — sprawdź czy trigger jest dozwolony
        if (perms.allowedTriggers.length > 0) {
          const triggerName = triggerType || TriggerType.MANUAL;
          if (!perms.allowedTriggers.includes(triggerName)) {
            throw new Error(
              `Trigger ${triggerName} nie jest dozwolony dla agenta ${agentId}. ` +
              `Dozwolone: ${perms.allowedTriggers.join(', ') || 'brak'}`
            );
          }
        } else {
          // allowedTriggers = [] — agent nie może być uruchomiony żadnym triggerem
          throw new Error(
            `Agent ${agentId} nie może być uruchomiony — brak dozwolonych triggerów. ` +
            `Dodaj triggery w panelu Uprawnienia.`
          );
        }
        // 2. Model check
        if (perms.allowedModels.length > 0 && !perms.allowedModels.includes(state.agent.model.modelName)) {
          throw new Error(`Agent ${agentId} nie ma uprawnień do modelu ${state.agent.model.modelName}. Dozwolone: ${perms.allowedModels.join(', ')}`);
        }
        // 3. Rate limit
        if (perms.maxRunsPerMinute > 0) {
          const now = Date.now();
          const oneMinute = 60_000;
          state.runTimestamps = state.runTimestamps.filter(ts => now - ts < oneMinute);
          if (state.runTimestamps.length >= perms.maxRunsPerMinute) {
            throw new Error(`Rate limit exceeded dla agenta ${agentId} (${perms.maxRunsPerMinute}/min)`);
          }
          state.runTimestamps.push(now);
        }
      }

      // === CircuitBreaker Check ============================================
      if (!this.checkBudget(state)) {
        throw new Error(`Budget exceeded: tokens=${state.tokensUsed}/${state.agent.budgetTokens}`);
      }

      // === Context Builder (F6.2) ==========================================
      let finalContext = context || '';
      if (state.agent.contextConfig) {
        const enabledSources = state.agent.contextConfig.sources.filter(s => s.enabled);
        if (enabledSources.length > 0) {
          const { context: builtContext, tokensUsed } = await this.buildContext(agentId, state.agent.contextConfig);
          if (builtContext) {
            finalContext = `=== KONTEKST ===\n${builtContext}\n=== KONIEC KONTEKSTU ===\n\n${finalContext ? `Dodatkowy kontekst od użytkownika:\n${finalContext}` : ''}`;
          }
          state.tokensUsed += tokensUsed;
        }
      }

      // === Permissions: maxTokensPerRun check (F6.7) ========================
      if (perms && perms.maxTokensPerRun > 0) {
        const estimatedTokens = state.tokensUsed + Math.ceil(finalContext.length / 2);
        if (estimatedTokens > perms.maxTokensPerRun) {
          throw new Error(
            `Budget tokenów przekroczony dla agenta ${agentId}: ` +
            `szacowane ${estimatedTokens} > limit ${perms.maxTokensPerRun}`
          );
        }
      }

      // === AI Call with streaming ==========================================
      let content: string;
      if (state.agent.executionMode === 'sandbox' && this.sandboxRunner) {
        // === Sandbox Execution (#7 MicroVM) ================================
        const providerConfig = this.providerRegistry.getConfig(state.agent.model.providerLabel);
        const sandboxResult = await this.sandboxRunner.runInSandbox({
          agent: state.agent,
          context: finalContext,
          triggerType: triggerType,
          providerApiKey: providerConfig?.apiKey || '',
          providerBaseUrl: providerConfig?.baseUrl || '',
          timeoutMs: 120_000,
          memoryLimitMb: 256,
        });
        if (!sandboxResult.success) {
          throw new Error(`[Sandbox] ${sandboxResult.error}`);
        }
        content = sandboxResult.output?.content || '';
      } else {
        // === Standard Execution (live) ======================================
        content = await this.callAIStreaming(state.agent, finalContext, agentId);
      }

      // === Output ==========================================================
      const executionMs = Date.now() - startTime;
      output.content = content;

      // === Permissions: requireApproval check (F6.1) =======================
      if (state.agent.permissions?.requireApproval) {
        output.approved = null;
        output.status = AgentStatus.AWAITING_APPROVAL;
        state.status = AgentStatus.AWAITING_APPROVAL;
        this.setStatus(agentId, AgentStatus.AWAITING_APPROVAL);
        this.stopHeartbeat(agentId);
        output.tokensUsed = state.tokensUsed;
        output.executionMs = executionMs;
        output.completedAt = new Date().toISOString();
        this.events.onOutput(output);
        return output;
      }

      // === Permissions: allowedDestinations check (F6.7) ====================
      if (perms && perms.allowedDestinations.length > 0 && state.agent.outputDestinations.length > 0) {
        const hasForbidden = state.agent.outputDestinations.some(
          (dest) => !perms!.allowedDestinations.includes(dest.type)
        );
        if (hasForbidden) {
          const forbidden = state.agent.outputDestinations
            .filter((dest) => !perms!.allowedDestinations.includes(dest.type))
            .map((d) => d.type);
          throw new Error(
            `Destination ${forbidden.join(', ')} nie jest dozwolone dla agenta ${agentId}. ` +
            `Dozwolone: ${perms.allowedDestinations.join(', ')}`
          );
        }
      }

      output.tokensUsed = state.tokensUsed;
      output.executionMs = executionMs;
      output.completedAt = new Date().toISOString();

      // === Success =========================================================
      state.status = AgentStatus.ACTIVE;
      state.retryCount = 0;
      state.cooldownUntil = null;
      state.currentOutput = content;

      // Update agent metadata
      state.agent.lastRunAt = output.createdAt;
      state.agent.runCount++;
      state.agent.updatedAt = new Date().toISOString();

      this.setStatus(agentId, AgentStatus.ACTIVE);
      this.stopHeartbeat(agentId);

      // Emit output
      this.events.onOutput(output);

      return output;

    } catch (error) {
      // === Error Handling ==================================================
      const errorMsg = error instanceof Error ? error.message : String(error);
      const executionMs = Date.now() - startTime;

      output.status = AgentStatus.CRASHED;
      output.content = state.currentOutput || '';
      output.tokensUsed = state.tokensUsed;
      output.executionMs = executionMs;
      output.error = errorMsg;
      output.errorStack = error instanceof Error ? error.stack : undefined;
      output.completedAt = new Date().toISOString();

      // Crash handling
      state.retryCount++;
      state.agent.errorCount++;
      state.agent.updatedAt = new Date().toISOString();

      if (state.retryCount <= (state.agent.maxRetries || this.DEFAULT_MAX_RETRIES)) {
        // Auto-restart
        state.status = AgentStatus.COOLDOWN;
        state.cooldownUntil = Date.now() + ((state.agent.cooldownSeconds * 1000) || this.DEFAULT_COOLDOWN_MS);
        this.setStatus(agentId, AgentStatus.COOLDOWN);
        this.events.onError(agentId, `Auto-restart ${state.retryCount}/${state.agent.maxRetries}: ${errorMsg}`);
      } else {
        // DISABLED — limit restartów wyczerpany
        state.status = AgentStatus.DISABLED;
        this.setStatus(agentId, AgentStatus.DISABLED);
        this.events.onError(agentId, `Agent DISABLED — ${state.agent.maxRetries} restartów: ${errorMsg}`);
      }

      this.stopHeartbeat(agentId);
      this.events.onOutput(output);

      return output;
    }
  }

  /**
   * Zatrzymuje agenta (ręczne przerwanie).
   */
  stopAgent(agentId: string): void {
    const state = this.agents.get(agentId);
    if (!state || state.status !== AgentStatus.RUNNING) return;

    state.status = AgentStatus.ACTIVE;
    this.stopHeartbeat(agentId);
    this.setStatus(agentId, AgentStatus.ACTIVE);

    console.log(`[AgentOrchestrator] Agent ${agentId} zatrzymany ręcznie`);
  }

  // =========================================================================
  // Heartbeat
  // =========================================================================

  private startHeartbeat(agentId: string): void {
    const state = this.agents.get(agentId);
    if (!state) return;

    this.stopHeartbeat(agentId);

    state.heartbeatTimer = setInterval(() => {
      const s = this.agents.get(agentId);
      if (!s || s.status !== AgentStatus.RUNNING) {
        this.stopHeartbeat(agentId);
        return;
      }

      const telemetry: TelemetryMessage = {
        type: 'heartbeat',
        agentId,
        timestamp: Date.now(),
        data: {
          tokensUsed: s.tokensUsed,
          status: s.status,
        },
      };

      // Jeśli heartbeat nie przyjdzie przez 2 cykle → agent CRASHED
      // (W praktyce robi to utilityProcess monitor)
      console.log(`[Heartbeat] ${agentId}: ${s.tokensUsed} tokenów`);
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(agentId: string): void {
    const state = this.agents.get(agentId);
    if (state?.heartbeatTimer) {
      clearInterval(state.heartbeatTimer);
      state.heartbeatTimer = null;
    }
  }

  // =========================================================================
  // Budget / CircuitBreaker
  // =========================================================================

  private checkBudget(state: AgentRuntimeState): boolean {
    const maxTokens = state.agent.budgetTokens || 100_000;
    const maxDepth = state.agent.budgetDepth || 100;

    if (state.tokensUsed >= maxTokens) {
      console.warn(`[CircuitBreaker] ${state.agent.name}: tokeny ${state.tokensUsed}/${maxTokens}`);
      return false;
    }

    return true;
  }

  // =========================================================================
  // AI Call (Phase 2 — real adapters)
  // =========================================================================

  /**
   * Wywołuje adapter AI z streamingiem tokenów.
   * Emituje każdy token przez onStream callback (live do changeloga).
   * Na końcu zwraca pełny skumulowany tekst.
   */
  private async callAIStreaming(agent: Agent, context: string, agentId: string): Promise<string> {
    const prompt = agent.promptTemplate
      .replace(/\{\{SCHOWEK\}\}/g, context || '(brak zawartości schowka)')
      .replace(/\{\{DATA\}\}/g, new Date().toLocaleDateString('pl-PL'))
      .replace(/\{\{CZAS\}\}/g, new Date().toLocaleTimeString('pl-PL'));

    const systemPrompt = `Jesteś agentem "${agent.name}" w systemie NEXUS.\n${agent.description ? `Opis: ${agent.description}` : ''}`;

    try {
      const adapter = this.providerRegistry.getAdapter(agent.model);
      const request = { prompt, model: agent.model, systemPrompt, contextSize: prompt.length };

      // Try streaming first
      if (adapter.completeStream) {
        let fullContent = '';
        const stream = adapter.completeStream(request);

        for await (const chunk of stream) {
          if (chunk.error) {
            throw new Error(chunk.error);
          }
          if (chunk.token) {
            fullContent += chunk.token;
            // Emit token live to changelog
            this.events.onStream(agentId, chunk.token);
          }
          if (chunk.done) {
            break;
          }
        }

        return fullContent;
      }

      // Fallback to sync completion
      const response = await adapter.complete(request);
      // Emit whole content as one chunk
      this.events.onStream(agentId, response.content);
      return response.content;

    } catch (error) {
      console.error(`[AgentOrchestrator] AI call failed for "${agent.name}":`, error);
      throw error;
    }
  }

  /**
   * Zużywa tokeny z budżetu agenta.
   */
  consumeTokens(agentId: string, tokens: number): void {
    const state = this.agents.get(agentId);
    if (state) {
      state.tokensUsed += tokens;
    }
  }

  // =========================================================================
  // Context Builder (F6.2)
  // =========================================================================

  /**
   * Buduje kontekst dla agenta na podstawie ContextConfig.
   * Zbiera dane z włączonych źródeł, formatuje jako tekst, przycina do maxTokens.
   * Respektuje ContextSelection (konkretne ID) i ContextSourceConfig (filtry).
   * Custom instructions są chronione przed przycięciem (dodawane na początku).
   * Zwraca sourceBreakdown — ile znaków/tokenów dostarczyło każde źródło.
   */
  async buildContext(agentId: string, contextConfig: ContextConfig): Promise<{ context: string; tokensUsed: number; sourceBreakdown: { sourceId: string; chars: number; tokens: number }[] }> {
    const parts: { sourceId: string; text: string }[] = [];
    const enabledSources = contextConfig.sources.filter(s => s.enabled);

    if (enabledSources.length === 0) {
      return { context: '(brak źródeł kontekstu — wybierz co najmniej jedno)', tokensUsed: 0, sourceBreakdown: [] };
    }

    // Custom instructions NA POCZĄTKU — chronione przed przycięciem (C4 fix)
    if (contextConfig.customInstructions?.trim()) {
      parts.push({ sourceId: '_custom_instructions', text: `=== Instrukcje dodatkowe ===\n${contextConfig.customInstructions.trim()}\n` });
    }

    // Include system prompt if configured
    if (contextConfig.includeSystemPrompt) {
      const state = this.agents.get(agentId);
      if (state?.agent) {
        const sysPrompt = `Jesteś agentem "${state.agent.name}" w systemie NEXUS.\n${state.agent.description ? `Opis: ${state.agent.description}` : ''}`;
        parts.push({ sourceId: '_system_prompt', text: `=== System Prompt ===\n${sysPrompt}\n` });
        if (state.agent.promptTemplate) {
          parts.push({ sourceId: '_system_prompt', text: `=== Prompt agenta ===\n${state.agent.promptTemplate}\n` });
        }
      }
    }

    for (const source of enabledSources) {
      try {
        const selection = source.selection;
        const config = source.config || {};
        let sourceText = '';

        switch (source.id) {
          case 'notes': {
            const allNotes = this.storage?.getWorkspaceEntitiesByType('node') || [];
            const filtered = selection?.type === 'ids' && selection.ids.length > 0
              ? allNotes.filter(n => selection.ids.includes(n.id))
              : allNotes;
            if (filtered.length > 0) {
              const notesText = filtered.map(n =>
                `[${n.updatedAt || ''}] ${n.title}: ${n.content.slice(0, 500)}${n.content.length > 500 ? '...' : ''}`
              ).join('\n');
              sourceText = `=== Notatki (NexusNode)${config.projectId ? ` — projekt: ${config.projectId}` : ''}${selection?.type === 'ids' ? ' (wybrane)' : ''} ===\n${notesText}\n`;
            } else {
              sourceText = `=== Notatki (NexusNode) ===\n${selection?.type === 'ids' ? '(Nie znaleziono wybranych notatek)' : '(Brak notatek w workspace)'}\n`;
            }
            break;
          }
          case 'tasks': {
            const statusFilter = config.status;
            const allTasks = this.storage?.getWorkspaceEntitiesByType('task') || [];
            let filtered = statusFilter ? allTasks.filter(t => t.status === statusFilter) : allTasks;
            if (selection?.type === 'ids' && selection.ids.length > 0) {
              filtered = filtered.filter(t => selection.ids.includes(t.id));
            }
            if (filtered.length > 0) {
              const tasksText = filtered.map(t =>
                `[${t.title}] ${t.content.slice(0, 500)}${t.content.length > 500 ? '...' : ''}${t.status ? ` (status: ${t.status})` : ''}`
              ).join('\n');
              sourceText = `=== Zadania (Task)${statusFilter ? ` (status: ${statusFilter})` : ''}${selection?.type === 'ids' ? ' (wybrane)' : ''} ===\n${tasksText}\n`;
            } else {
              sourceText = `=== Zadania (Task) ===\n(Brak zadań${statusFilter ? ` o statusie ${statusFilter}` : ''})\n`;
            }
            break;
          }
          case 'manuscripts': {
            const folderFilter = config.folderId;
            const allDrafts = this.storage?.getWorkspaceEntitiesByType('draft') || [];
            let filtered = folderFilter ? allDrafts.filter(d => d.folderId === folderFilter) : allDrafts;
            if (selection?.type === 'ids' && selection.ids.length > 0) {
              filtered = filtered.filter(d => selection.ids.includes(d.id));
            }
            if (filtered.length > 0) {
              const mText = filtered.map(d =>
                `[${d.title}] ${d.content.slice(0, 1000)}${d.content.length > 1000 ? '...' : ''}`
              ).join('\n\n');
              sourceText = `=== Manuskrypty (WritingDraft)${folderFilter ? ` (folder: ${folderFilter})` : ''}${selection?.type === 'ids' ? ' (wybrane)' : ''} ===\n${mText}\n`;
            } else {
              sourceText = '=== Manuskrypty (WritingDraft) ===\n(Brak manuskryptów)\n';
            }
            break;
          }
          case 'history': {
            const count = config.count || 10;
            const outputs = this.storage?.getOutputs(agentId, count) || [];
            if (outputs.length > 0) {
              const historyText = outputs.map((o, i) =>
                `[${i + 1}] ${o.createdAt} — ${o.content.slice(0, 500)}${o.content.length > 500 ? '...' : ''}`
              ).join('\n\n');
              sourceText = `=== Historia outputów (ostatnie ${outputs.length}) ===\n${historyText}\n`;
            } else {
              sourceText = '=== Historia outputów ===\n(Brak historii dla tego agenta)\n';
            }
            break;
          }
          case 'clipboard': {
            // Check trigger's useClipboard setting to determine behavior
            const state = this.agents.get(agentId);
            const useClipboard = state?.agent.trigger.useClipboard;
            if (useClipboard) {
              try {
                const { clipboard } = require('electron');
                const clipText = clipboard.readText();
                if (clipText) {
                  sourceText = `=== Schowek systemowy ===\n${clipText}\n`;
                } else {
                  sourceText = '=== Schowek systemowy ===\n(Schowek pusty)\n';
                }
              } catch {
                sourceText = '=== Schowek systemowy ===\n(Schowek niedostępny — nie jesteśmy w Electron)\n';
              }
            } else {
              sourceText = '=== Schowek systemowy ===\n(Opcja wyłączona — włącz useClipboard w triggerze, aby pobierać schowek)\n';
            }
            break;
          }
          case 'changelog': {
            // Pobiera zmiany od lastRunAt
            const state = this.agents.get(agentId);
            const lastRunAt = state?.agent.lastRunAt;
            const allOutputs = this.storage?.getOutputs(undefined, 100) || [];
            const recent = lastRunAt
              ? allOutputs.filter(o => o.createdAt > lastRunAt)
              : allOutputs.slice(0, 20);
            if (recent.length > 0) {
              const changeText = recent.map(r =>
                `[${r.createdAt}] ${r.agentName}: ${r.content.slice(0, 200)}${r.content.length > 200 ? '...' : ''}`
              ).join('\n');
              sourceText = `=== Zmiany od ostatniego uruchomienia (${lastRunAt ? new Date(lastRunAt).toLocaleString('pl-PL') : 'ostatnie 20'}) ===\n${changeText}\n`;
            } else {
              sourceText = '=== Zmiany od ostatniego uruchomienia ===\n(Brak zmian)\n';
            }
            break;
          }
          case 'file': {
            const filePath = config.filePath;
            if (filePath) {
              try {
                const content = await fs.promises.readFile(filePath, 'utf8');
                sourceText = `=== Plik: ${filePath} ===\n${content}\n`;
              } catch {
                sourceText = `=== Plik: ${filePath} ===\n(Nie można odczytać pliku)\n`;
              }
            } else {
              sourceText = '=== Plik z dysku ===\n(Nie wybrano pliku)\n';
            }
            break;
          }
          case 'agent_output': {
            const sourceAgentId = config.agentId;
            let outputs = this.storage?.getOutputs(sourceAgentId, 5) || [];
            if (selection?.type === 'ids' && selection.ids.length > 0) {
              outputs = outputs.filter(o => selection.ids.includes(o.id));
            }
            if (outputs.length > 0) {
              const outText = outputs.map((o, i) =>
                `[${i + 1}] Agent: ${o.agentName} — ${o.content.slice(0, 500)}${o.content.length > 500 ? '...' : ''}`
              ).join('\n\n');
              sourceText = `=== Wynik agenta: ${sourceAgentId || '?'} ===\n${outText}\n`;
            } else {
              sourceText = `=== Wynik agenta: ${sourceAgentId || '?'} ===\n(Brak outputów)\n`;
            }
            break;
          }
          default:
            sourceText = `=== ${source.label} ===\n(Źródło nieobsługiwane: ${source.id})\n`;
        }

        parts.push({ sourceId: source.id, text: sourceText });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        parts.push({ sourceId: source.id, text: `=== ${source.label} ===\n(Błąd: ${msg})\n` });
      }
    }

    // ====================================================================
    // F6.8: Included Entities — konkretne elementy z workspace wybrane przez użytkownika
    // ====================================================================
    if (contextConfig.includedEntities && contextConfig.includedEntities.length > 0) {
      const entityTexts: string[] = [];
      const allEntities = this.storage?.getWorkspaceEntities() || [];
      for (const ref of contextConfig.includedEntities) {
        try {
          const match = allEntities.find(e => e.type === ref.type && e.id === ref.entityId);
          if (match) {
            const typeLabel = ref.type === 'node' ? 'Notatka' : ref.type === 'task' ? 'Task' : 'Manuskrypt';
            const text = `=== ${typeLabel}: ${match.title || match.id} ===\n${match.content}\n`;
            entityTexts.push(text);
            parts.push({ sourceId: `workspace_${ref.type}_${ref.entityId}`, text });
          } else {
            console.warn(`[AgentOrchestrator] F6.8: entity not found for ref type=${ref.type} id=${ref.entityId} — skipping`);
          }
        } catch (err) {
          console.warn(`[AgentOrchestrator] F6.8: error fetching entity type=${ref.type} id=${ref.entityId}:`, err);
        }
      }
      if (entityTexts.length > 0) {
        parts.push({ sourceId: '_workspace_selection', text: `=== WYBRANE ELEMENTY Z WORKSPACE ===\n${entityTexts.join('\n')}\n=== KONIEC WYBRANYCH ELEMENTÓW ===\n` });
      }
    }

    // ====================================================================
    // F6.8: Toggle flags — includeClipboardImage / includeLastAgentOutput
    // ====================================================================
    if (contextConfig.includeClipboardImage) {
      try {
        const { clipboard } = require('electron');
        const clipImage = clipboard.readImage();
        if (!clipImage.isEmpty()) {
          const pngBuffer = clipImage.toPNG();
          const base64 = pngBuffer.toString('base64');
          parts.push({ sourceId: '_clipboard_image', text: `=== Obraz ze schowka (PNG base64) ===\n${base64}\n` });
        } else {
          parts.push({ sourceId: '_clipboard_image', text: '=== Obraz ze schowka ===\n(Schowek nie zawiera obrazu)\n' });
        }
      } catch {
        parts.push({ sourceId: '_clipboard_image', text: '=== Obraz ze schowka ===\n(Obraz niedostępny — nie jesteśmy w Electron)\n' });
      }
    }

    if (contextConfig.includeLastAgentOutput) {
      const lastOutputs = this.storage?.getOutputs(agentId, 1) || [];
      if (lastOutputs.length > 0) {
        const last = lastOutputs[0];
        parts.push({ sourceId: '_last_agent_output', text: `=== Ostatni output agenta ===\n${last.content || '(pusty)'}\n` });
      } else {
        parts.push({ sourceId: '_last_agent_output', text: '=== Ostatni output agenta ===\n(Brak poprzednich outputów)\n' });
      }
    }

    // Join all parts
    let fullContext = parts.map(p => p.text).join('\n');

    // Build source breakdown BEFORE truncation
    const sourceBreakdown: { sourceId: string; chars: number; tokens: number }[] = parts.map(p => {
      const chars = Buffer.byteLength(p.text, 'utf8');
      return {
        sourceId: p.sourceId,
        chars,
        tokens: Math.ceil(chars / 2),
      };
    });

    // Better token estimation — use byte length / 2 for Polish text (N3 fix)
    const byteLength = Buffer.byteLength(fullContext, 'utf8');
    let estimatedTokens = Math.ceil(byteLength / 2);

    // Truncate if exceeds maxTokens — priorytety: instrukcje są na początku, więc slice chroni je
    if (estimatedTokens > contextConfig.maxTokens) {
      const maxBytes = contextConfig.maxTokens * 2; // ~2 bytes per token for UTF-8
      let truncated = Buffer.from(fullContext, 'utf8').subarray(0, maxBytes).toString('utf8');
      // Handle multi-byte char truncation at boundary
      truncated = truncated.replace(/\uFFFD/g, '');
      fullContext = truncated + `\n\n[KONTEKST PRZYCINANY — przekroczono limit ${contextConfig.maxTokens} tokenów]`;
      estimatedTokens = contextConfig.maxTokens;
    }

    return { context: fullContext, tokensUsed: estimatedTokens, sourceBreakdown };
  }

  // =========================================================================
  // Status
  // =========================================================================

  private setStatus(agentId: string, status: AgentStatus): void {
    this.events.onStatusChange(agentId, status);
  }

  // =========================================================================
  // Cleanup
  // =========================================================================

  destroy(): void {
    for (const [agentId] of this.agents) {
      this.stopHeartbeat(agentId);
    }
    this.agents.clear();
    console.log('[AgentOrchestrator] Zniszczony');
  }
}
