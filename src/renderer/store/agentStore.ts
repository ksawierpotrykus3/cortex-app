// ============================================================================
// NEXUS — Agent Store (Zustand)
// Transient state dla agentów — szybkie aktualizacje bez re-rendera całego UI
// ============================================================================

import { create } from 'zustand';
import { Agent, AgentStatus, TriggerType, AIProvider, AgentOutput } from '../../shared/types/schema';

// === Default Agent Template ================================================
export function createDefaultAgent(name?: string): Agent {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID?.() || `agent_${Date.now()}`,
    name: name || 'Nowy Agent',
    description: '',
    status: AgentStatus.ACTIVE,
    promptTemplate: 'Przeanalizuj poniższy tekst:\n\n{{SCHOWEK}}\n\nOdpowiedz w formacie:',
    trigger: {
      type: TriggerType.MANUAL,
      enabled: true,
      useClipboard: true,
      useScreenshot: false,
      hotkey: '',
    },
    model: {
      provider: AIProvider.GEMINI,
      providerLabel: 'Google Gemini',
      modelName: 'gemini-2.0-flash',
      temperature: 0.7,
      maxTokens: 4096,
      topP: 0.9,
    },
    maxRetries: 3,
    cooldownSeconds: 30,
    budgetTokens: 100000,
    budgetDepth: 100,
    outputDestinations: [],
    accentColor: '#a78bfa',
    createdAt: now,
    updatedAt: now,
    runCount: 0,
    errorCount: 0,
    rating: 0,
    tags: [],
  };
}

// === Store Types ===========================================================
interface AgentStoreState {
  // Data
  agents: Agent[];
  selectedAgentId: string | null;

  // Loading / Error
  isLoading: boolean;
  error: string | null;

  // Actions
  setAgents: (agents: Agent[]) => void;
  selectAgent: (id: string | null) => void;
  addAgent: (agent: Agent) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  removeAgent: (id: string) => void;
  updateAgentStatus: (id: string, status: AgentStatus) => void;
  createNewAgent: () => Agent;
  duplicateAgent: (id: string) => Agent | null;

  // Utils
  getSelectedAgent: () => Agent | undefined;
}

export const useAgentStore = create<AgentStoreState>((set, get) => ({
  // === Initial State =======================================================
  agents: [],
  selectedAgentId: null,
  isLoading: false,
  error: null,

  // === Actions =============================================================

  setAgents: (agents) => set({ agents }),

  selectAgent: (id) => set({ selectedAgentId: id }),

  addAgent: (agent) => set((state) => ({
    agents: [...state.agents, agent],
    selectedAgentId: agent.id,
  })),

  updateAgent: (id, updates) => set((state) => ({
    agents: state.agents.map((a) =>
      a.id === id
        ? { ...a, ...updates, updatedAt: new Date().toISOString() }
        : a
    ),
  })),

  removeAgent: (id) => set((state) => ({
    agents: state.agents.filter((a) => a.id !== id),
    selectedAgentId: state.selectedAgentId === id ? null : state.selectedAgentId,
  })),

  updateAgentStatus: (id, status) => set((state) => ({
    agents: state.agents.map((a) =>
      a.id === id ? { ...a, status } : a
    ),
  })),

  createNewAgent: () => {
    const agent = createDefaultAgent();
    get().addAgent(agent);
    return agent;
  },

  duplicateAgent: (id) => {
    const state = get();
    const original = state.agents.find((a) => a.id === id);
    if (!original) return null;

    const clone: Agent = {
      ...original,
      id: crypto.randomUUID?.() || `agent_${Date.now()}`,
      name: `${original.name} (kopia)`,
      status: AgentStatus.ACTIVE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      runCount: 0,
      errorCount: 0,
      rating: 0,
    };

    get().addAgent(clone);
    return clone;
  },

  // === Utils ===============================================================

  getSelectedAgent: () => {
    const state = get();
    return state.agents.find((a) => a.id === state.selectedAgentId);
  },
}));
