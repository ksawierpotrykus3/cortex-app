// ============================================================================
// NEXUS — AgentOrchestrator (Phase 1)
// State machine agenta z 6 stanami, heartbeat, auto-restart i CircuitBreaker
// ============================================================================

import { Agent, AgentStatus, AgentOutput, TriggerType } from '../../shared/types/schema';
import { TelemetryMessage, FirehoseMessage } from '../../shared/types/ipc';
import { ProviderRegistry } from '../ai/ProviderRegistry';

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

  // Config
  private readonly DEFAULT_MAX_RETRIES = 3;
  private readonly DEFAULT_COOLDOWN_MS = 30_000;  // 30s
  private readonly HEARTBEAT_INTERVAL_MS = 5_000; // co 5s

  constructor(events: AgentOrchestratorEvents, providerRegistry: ProviderRegistry) {
    this.events = events;
    this.providerRegistry = providerRegistry;
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
   * Sprawdza stan, budget, CircuitBreaker.
   * Emituje output przez callback events.
   */
  async executeAgent(agentId: string, context?: string): Promise<AgentOutput> {
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
      // === CircuitBreaker Check ============================================
      if (!this.checkBudget(state)) {
        throw new Error(`Budget exceeded: tokens=${state.tokensUsed}/${state.agent.budgetTokens}`);
      }

      // === AI Call with streaming ==========================================
      const content = await this.callAIStreaming(state.agent, context || '', agentId);

      // === Output ==========================================================
      const executionMs = Date.now() - startTime;
      output.content = content;
      output.status = AgentStatus.ACTIVE;
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
