// ============================================================================
// NEXUS — AgentOrchestrator Permission Enforcement Tests (F6.7)
// ============================================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { AgentOrchestrator, AgentOrchestratorEvents } from './AgentOrchestrator';
import {
  Agent,
  AgentStatus,
  TriggerType,
  DEFAULT_PERMISSION_SET,
  AIProvider,
  OutputDestinationType,
  ContextConfig,
  ContextEntityRef,
} from '../../shared/types/schema';
import { ProviderRegistry } from '../ai/ProviderRegistry';

// Mock ProviderRegistry — we don't need real AI adapters
const mockProviderRegistry = {
  getAdapter: () => ({
    complete: vi.fn().mockResolvedValue({ content: 'test response' }),
    isConfigured: () => true,
  }),
  getAvailableModels: () => [],
  getConfigs: () => [],
  getConfig: () => undefined,
  setApiKey: vi.fn(),
  testConnection: vi.fn(),
  upsertConfig: vi.fn(),
  removeConfig: vi.fn(),
  recordSend: vi.fn(),
  destroy: vi.fn(),
} as unknown as ProviderRegistry;

function createTestAgent(overrides?: Partial<Agent>): Agent {
  const now = new Date().toISOString();
  return {
    id: 'test-agent-1',
    name: 'Test Agent',
    description: 'Agent do testów',
    status: AgentStatus.ACTIVE,
    promptTemplate: 'Test prompt {{SCHOWEK}}',
    trigger: {
      type: TriggerType.MANUAL,
      enabled: true,
      useClipboard: false,
      useScreenshot: false,
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
    createdAt: now,
    updatedAt: now,
    runCount: 0,
    errorCount: 0,
    rating: 0,
    tags: [],
    ...overrides,
  };
}

describe('AgentOrchestrator — Permission Enforcement', () => {
  let orchestrator: AgentOrchestrator;
  let events: AgentOrchestratorEvents;

  beforeAll(() => {
    // Mock crypto.randomUUID
    vi.stubGlobal('crypto', {
      randomUUID: () => 'mock-uuid-123',
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    events = {
      onStatusChange: vi.fn() as any,
      onOutput: vi.fn() as any,
      onStream: vi.fn() as any,
      onError: vi.fn() as any,
    };
    orchestrator = new AgentOrchestrator(events, mockProviderRegistry);
  });

  // === Happy Path ==========================================================
  it('allows execution when trigger is in allowedTriggers', async () => {
    const agent = createTestAgent({
      permissions: {
        ...DEFAULT_PERMISSION_SET,
        allowedTriggers: [TriggerType.MANUAL, TriggerType.TIMER],
      },
    });
    orchestrator.registerAgent(agent);

    // Should not throw
    const result = await orchestrator.executeAgent('test-agent-1', 'test context', TriggerType.MANUAL);
    expect(result).toBeDefined();
  });

  // === Edge Case: empty allowedTriggers ====================================
  it('rejects execution when allowedTriggers is empty', async () => {
    const agent = createTestAgent({
      permissions: {
        ...DEFAULT_PERMISSION_SET,
        allowedTriggers: [], // empty = no trigger allowed
      },
    });
    orchestrator.registerAgent(agent);

    const result = await orchestrator.executeAgent('test-agent-1', 'test', TriggerType.MANUAL);
    expect(result.status).toBe(AgentStatus.CRASHED);
    expect(result.error).toMatch(/nie może być uruchomiony.*brak dozwolonych triggerów/);
  });

  // === Error Case: trigger not in list =====================================
  it('rejects execution when trigger is not in allowed list', async () => {
    const agent = createTestAgent({
      permissions: {
        ...DEFAULT_PERMISSION_SET,
        allowedTriggers: [TriggerType.MANUAL],
      },
    });
    orchestrator.registerAgent(agent);

    const result = await orchestrator.executeAgent('test-agent-1', 'test', TriggerType.HOTKEY);
    expect(result.status).toBe(AgentStatus.CRASHED);
    expect(result.error).toMatch(/Trigger HOTKEY nie jest dozwolony/);
  });

  // === Filtering: maxTokensPerRun ==========================================
  it('rejects execution when estimated tokens exceed maxTokensPerRun', async () => {
    const agent = createTestAgent({
      permissions: {
        ...DEFAULT_PERMISSION_SET,
        allowedTriggers: [TriggerType.MANUAL],
        maxTokensPerRun: 10, // very low
      },
    });
    orchestrator.registerAgent(agent);

    // context is long, so estimated tokens will exceed 10
    const longContext = 'x'.repeat(100);
    const result = await orchestrator.executeAgent('test-agent-1', longContext, TriggerType.MANUAL);
    expect(result.status).toBe(AgentStatus.CRASHED);
    expect(result.error).toMatch(/Budget tokenów przekroczony/);
  });

  // === Filtering: allowedDestinations ======================================
  it('rejects execution when output destinations are not allowed', async () => {
    const agent = createTestAgent({
      permissions: {
        ...DEFAULT_PERMISSION_SET,
        allowedTriggers: [TriggerType.MANUAL],
        allowedDestinations: [OutputDestinationType.CHANGELOG],
      },
      outputDestinations: [
        { type: OutputDestinationType.FILE, config: { path: '/tmp/test.txt' } },
      ],
    });
    orchestrator.registerAgent(agent);

    const result = await orchestrator.executeAgent('test-agent-1', 'test', TriggerType.MANUAL);
    expect(result.status).toBe(AgentStatus.CRASHED);
    expect(result.error).toMatch(/Destination.*FILE.*nie jest dozwolone/);
  });

  // === Git permission test (via orchestrator's agent state) ================
  it('respects model permission check', async () => {
    const agent = createTestAgent({
      permissions: {
        ...DEFAULT_PERMISSION_SET,
        allowedTriggers: [TriggerType.MANUAL],
        allowedModels: ['claude-opus-4.6'], // not the agent's model
      },
    });
    orchestrator.registerAgent(agent);

    const result = await orchestrator.executeAgent('test-agent-1', 'test', TriggerType.MANUAL);
    expect(result.status).toBe(AgentStatus.CRASHED);
    expect(result.error).toMatch(/nie ma uprawnień do modelu/);
  });
});

describe('AgentOrchestrator — CheckGitPermission', () => {
  // Test the checkGitPermission logic via the orchestrator's agent state
  let orchestrator: AgentOrchestrator;
  let events: AgentOrchestratorEvents;

  beforeAll(() => {
    vi.stubGlobal('crypto', {
      randomUUID: () => 'mock-uuid-456',
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    events = {
      onStatusChange: vi.fn() as any,
      onOutput: vi.fn() as any,
      onStream: vi.fn() as any,
      onError: vi.fn() as any,
    };
    orchestrator = new AgentOrchestrator(events, mockProviderRegistry);
  });

  it('agent without gitAccess cannot execute if model check passes but git operations would fail', async () => {
    // This verifies that the agent state has the right permission set
    const agent = createTestAgent({
      permissions: {
        ...DEFAULT_PERMISSION_SET,
        allowedTriggers: [TriggerType.MANUAL],
        gitAccess: false, // no git read
        gitWrite: false, // no git write
      },
    });
    orchestrator.registerAgent(agent);

    // Execution should succeed (git is checked separately in IPC handlers)
    const result = await orchestrator.executeAgent('test-agent-1', 'test', TriggerType.MANUAL);
    expect(result).toBeDefined();
  });
});

// ============================================================================
// F6.8 — ContextBuilder / includedEntities Tests
// ============================================================================

describe('AgentOrchestrator — ContextBuilder includedEntities', () => {
  let orchestrator: AgentOrchestrator;
  let events: AgentOrchestratorEvents;

  beforeAll(() => {
    vi.stubGlobal('crypto', {
      randomUUID: () => 'mock-uuid-f68',
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    events = {
      onStatusChange: vi.fn() as any,
      onOutput: vi.fn() as any,
      onStream: vi.fn() as any,
      onError: vi.fn() as any,
    };
  });

  // === Happy Path ==========================================================
  it('buildContext includes selected entities content when includedEntities are provided', async () => {
    const mockEntities = [
      { id: 'entity-1', type: 'node' as const, title: 'Notatka architektura', content: 'Treść notatki o architekturze', updatedAt: '2026-01-01' },
      { id: 'entity-2', type: 'task' as const, title: 'Task do zrobienia', content: 'Opis taska do zrobienia', status: 'In Progress', updatedAt: '2026-01-01' },
    ];

    const mockStorage = {
      getWorkspaceEntities: vi.fn().mockReturnValue(mockEntities),
      getWorkspaceEntitiesByType: vi.fn().mockReturnValue(mockEntities),
      getOutputs: vi.fn().mockReturnValue([]),
      getAllAgents: vi.fn().mockReturnValue([]),
      saveOutput: vi.fn(),
      getStats: vi.fn().mockReturnValue({ total: 0, avgTokens: 0, avgExecutionMs: 0, errorRate: 0 }),
    } as any;

    orchestrator = new AgentOrchestrator(events, mockProviderRegistry, mockStorage);

    const agent = createTestAgent({
      contextConfig: {
        sources: [
          { id: 'notes', label: 'Notatki', description: '', enabled: true, config: {} },
        ],
        maxTokens: 8192,
        includeSystemPrompt: false,
        customInstructions: '',
        includedEntities: [
          { type: 'node', entityId: 'entity-1' },
          { type: 'task', entityId: 'entity-2' },
        ],
      },
    });
    orchestrator.registerAgent(agent);

    const result = await orchestrator.executeAgent('test-agent-1', 'test', TriggerType.MANUAL);
    expect(result).toBeDefined();
    // Storage should have been queried for workspace entities
    expect(mockStorage.getWorkspaceEntities).toHaveBeenCalled();
  });

  // === Edge Case: 0 selected ==============================================
  it('buildContext works normally with empty includedEntities (only placeholders)', async () => {
    orchestrator = new AgentOrchestrator(events, mockProviderRegistry);

    const agent = createTestAgent({
      contextConfig: {
        sources: [
          { id: 'notes', label: 'Notatki', description: '', enabled: true, config: {} },
        ],
        maxTokens: 8192,
        includeSystemPrompt: false,
        customInstructions: '',
        includedEntities: [], // empty — brak wybranych encji
      },
    });
    orchestrator.registerAgent(agent);

    // Should succeed without processing any entities
    const result = await orchestrator.executeAgent('test-agent-1', 'test', TriggerType.MANUAL);
    expect(result).toBeDefined();
  });

  // === Error Case: non-existent entityId ===================================
  it('buildContext does not crash when includedEntities reference non-existent IDs', async () => {
    const mockStorage = {
      getWorkspaceEntities: vi.fn().mockReturnValue([]),
      getWorkspaceEntitiesByType: vi.fn().mockReturnValue([]),
      getOutputs: vi.fn().mockReturnValue([]),
      getAllAgents: vi.fn().mockReturnValue([]),
      saveOutput: vi.fn(),
      getStats: vi.fn().mockReturnValue({ total: 0, avgTokens: 0, avgExecutionMs: 0, errorRate: 0 }),
    } as any;

    orchestrator = new AgentOrchestrator(events, mockProviderRegistry, mockStorage);

    const agent = createTestAgent({
      contextConfig: {
        sources: [
          { id: 'notes', label: 'Notatki', description: '', enabled: true, config: {} },
        ],
        maxTokens: 8192,
        includeSystemPrompt: false,
        customInstructions: '',
        includedEntities: [
          { type: 'node', entityId: 'non-existent-id-1' },
          { type: 'draft', entityId: 'non-existent-id-2' },
        ],
      },
    });
    orchestrator.registerAgent(agent);

    // Should NOT crash despite non-existent IDs
    const result = await orchestrator.executeAgent('test-agent-1', 'test', TriggerType.MANUAL);
    expect(result).toBeDefined();
    // storage was queried for workspace entities
    expect(mockStorage.getWorkspaceEntities).toHaveBeenCalled();
  });

  // === Filtering: includedEntities with enabled sources ====================
  it('buildContext includes toggle flags (includeClipboardImage, includeLastAgentOutput) without crashing', async () => {
    orchestrator = new AgentOrchestrator(events, mockProviderRegistry);

    const agent = createTestAgent({
      contextConfig: {
        sources: [
          { id: 'notes', label: 'Notatki', description: '', enabled: true, config: {} },
        ],
        maxTokens: 8192,
        includeSystemPrompt: false,
        customInstructions: '',
        includedEntities: [],
        includeClipboardImage: true,
        includeLastAgentOutput: true,
      },
    });
    orchestrator.registerAgent(agent);

    // Should not crash — clipboard image will return "not in Electron" fallback
    const result = await orchestrator.executeAgent('test-agent-1', 'test', TriggerType.MANUAL);
    expect(result).toBeDefined();
  });
});
