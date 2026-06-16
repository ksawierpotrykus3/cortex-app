// @vitest-environment node
// ============================================================================
// NEXUS — SandboxRunner Tests (#7 MicroVM)
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SandboxRunner } from './SandboxRunner';
import { Agent, AgentStatus, TriggerType, AIProvider } from '../../shared/types/schema';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('child_process', () => ({
  fork: vi.fn(),
}));

// ============================================================================
// Helpers
// ============================================================================

const mockChild = () => ({ on: vi.fn(), send: vi.fn(), kill: vi.fn(), killed: false });

const createMockAgent = (overrides: Partial<Agent> = {}): Agent => ({
  id: 'test-agent-1',
  name: 'Test Agent',
  description: 'Test',
  status: AgentStatus.ACTIVE,
  promptTemplate: 'Test prompt {{SCHOWEK}}',
  trigger: { type: TriggerType.MANUAL, enabled: true, useClipboard: true, useScreenshot: false, hotkey: '' },
  model: { provider: AIProvider.GEMINI, providerLabel: 'Google Gemini', modelName: 'gemini-2.0-flash', temperature: 0.3, maxTokens: 2048, topP: 0.9 },
  maxRetries: 2,
  cooldownSeconds: 15,
  budgetTokens: 50000,
  budgetDepth: 50,
  outputDestinations: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  runCount: 0,
  errorCount: 0,
  rating: 0,
  tags: [],
  ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe('SandboxRunner', () => {
  let runner: SandboxRunner;

  beforeEach(() => {
    vi.clearAllMocks();
    runner = new SandboxRunner();
  });

  it('konstruktor tworzy instancję', () => {
    expect(runner).toBeInstanceOf(SandboxRunner);
  });

  it('runInSandbox zwraca błąd gdy fork rzuca wyjątkiem', async () => {
    const { fork } = await import('child_process');
    (fork as any).mockReturnValue(undefined);
    (fork as any).mockImplementationOnce(() => { throw new Error('spawn ENOENT'); });

    const result = await runner.runInSandbox({
      agent: createMockAgent(),
      context: 'hello',
      providerApiKey: 'test-key',
      providerBaseUrl: '',
      timeoutMs: 5000,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('ENOENT');
  });

  it('runInSandbox zwraca timeout gdy proces się nie odezwie', async () => {
    const { fork } = await import('child_process');
    (fork as any).mockReturnValue(mockChild());

    const result = await runner.runInSandbox({
      agent: createMockAgent(),
      context: 'hello',
      providerApiKey: 'test-key',
      providerBaseUrl: '',
      timeoutMs: 50,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('timeout');
  });

  it('runInSandbox zwraca sukces gdy worker odpowie poprawnie', async () => {
    const { fork } = await import('child_process');
    const childMock = mockChild();
    (fork as any).mockReturnValue(childMock);

    const promise = runner.runInSandbox({
      agent: createMockAgent({ executionMode: 'sandbox' }),
      context: 'test context',
      providerApiKey: 'test-key',
      providerBaseUrl: '',
      timeoutMs: 5000,
    });

    // Simulate worker response
    const onMsgCallback = childMock.on.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];
    expect(onMsgCallback).toBeDefined();
    onMsgCallback({ type: 'result', success: true, output: { content: 'Hello from sandbox', tokensUsed: 50, executionMs: 100 } });

    const result = await promise;
    expect(result.success).toBe(true);
    expect(result.output?.content).toBe('Hello from sandbox');
    expect(result.output?.tokensUsed).toBe(50);
  });

  it('akceptuje sandbox executionMode w konfiguracji agenta', () => {
    const agent = createMockAgent({ executionMode: 'sandbox' });
    expect(agent.executionMode).toBe('sandbox');
  });
});
