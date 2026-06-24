import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProviderRegistry } from './ProviderRegistry';
import { AiHealthMonitor } from './AiHealthMonitor';
import { ModelConfig, AIProvider } from '../../shared/types/schema';

const { MockAdapter } = vi.hoisted(() => {
  return {
    MockAdapter: class {
      complete = vi.fn().mockResolvedValue({ content: 'response' });
      isConfigured = () => true;
      testConnection = vi.fn().mockResolvedValue({ success: true });
    }
  };
});

vi.mock('./GeminiAdapter', () => ({
  GeminiAdapter: MockAdapter
}));

vi.mock('./OpenAIApiAdapter', () => ({
  OpenAIApiAdapter: MockAdapter
}));

describe('ProviderRegistry Failover Routing', () => {
  let healthMonitor: AiHealthMonitor;
  let registry: ProviderRegistry;

  const freeModel: ModelConfig = {
    provider: AIProvider.OPENROUTER,
    providerLabel: 'NVIDIA (DeepSeek / Kimi / Qwen)',
    modelName: 'deepseek-ai/deepseek-v4-pro',
    temperature: 0.7,
    maxTokens: 100,
    topP: 0.9,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup health monitor
    healthMonitor = new AiHealthMonitor('/tmp');
    vi.spyOn(healthMonitor, 'getSettings').mockReturnValue({
      mode: 'automatic',
      timeoutSeconds: 5,
    });
    vi.spyOn(healthMonitor, 'getStatus').mockReturnValue({
      'deepseek-ai/deepseek-v4-pro': { status: 'ONLINE', ping: 12 },
      'deepseek-ai/deepseek-v4-flash': { status: 'ONLINE', ping: 8 },
    });

    registry = new ProviderRegistry(healthMonitor);

    // Setup configurations: add a paid provider
    registry.upsertConfig({
      provider: AIProvider.OPENROUTER,
      label: 'DeepSeek Paid Provider',
      apiKey: 'sk-deepseek-paid-key',
      baseUrl: 'https://api.deepseek.com/v1',
      models: ['deepseek-ai/deepseek-v4-pro', 'deepseek-ai/deepseek-v4-flash'],
      isBuiltin: false,
      createdAt: '',
      updatedAt: '',
    });
  });

  it('should return the free adapter when model is ONLINE and no failover is active', async () => {
    const adapter = await registry.getAdapter(freeModel);
    expect(adapter).toBeDefined();
    // Should resolve NVIDIA provider (free)
    expect(registry['activeFailovers'].has(freeModel.modelName)).toBe(false);
  });

  it('should automatically failover to paid adapter when model is OFFLINE in automatic mode', async () => {
    vi.spyOn(healthMonitor, 'getStatus').mockReturnValue({
      'deepseek-ai/deepseek-v4-pro': { status: 'OFFLINE', ping: 0 },
      'deepseek-ai/deepseek-v4-flash': { status: 'ONLINE', ping: 8 },
    });

    const adapter = await registry.getAdapter(freeModel);
    expect(adapter).toBeDefined();
    expect(registry['activeFailovers'].has(freeModel.modelName)).toBe(true);
  });

  it('should automatically failover in interactive mode for background pipeline runs', async () => {
    vi.spyOn(healthMonitor, 'getSettings').mockReturnValue({
      mode: 'interactive',
      timeoutSeconds: 5,
    });
    vi.spyOn(healthMonitor, 'getStatus').mockReturnValue({
      'deepseek-ai/deepseek-v4-pro': { status: 'OFFLINE', ping: 0 },
      'deepseek-ai/deepseek-v4-flash': { status: 'ONLINE', ping: 8 },
    });

    const adapter = await registry.getAdapter(freeModel, { isPipeline: true });
    expect(adapter).toBeDefined();
    expect(registry['activeFailovers'].has(freeModel.modelName)).toBe(true);
  });

  it('should throw error in strict mode when model is OFFLINE', async () => {
    vi.spyOn(healthMonitor, 'getSettings').mockReturnValue({
      mode: 'strict',
      timeoutSeconds: 5,
    });
    vi.spyOn(healthMonitor, 'getStatus').mockReturnValue({
      'deepseek-ai/deepseek-v4-pro': { status: 'OFFLINE', ping: 0 },
      'deepseek-ai/deepseek-v4-flash': { status: 'ONLINE', ping: 8 },
    });

    await expect(registry.getAdapter(freeModel)).rejects.toThrow('jest niedostępny w trybie Strict');
  });

  it('should ask user for failover in interactive mode when model is OFFLINE', async () => {
    vi.spyOn(healthMonitor, 'getSettings').mockReturnValue({
      mode: 'interactive',
      timeoutSeconds: 5,
    });
    vi.spyOn(healthMonitor, 'getStatus').mockReturnValue({
      'deepseek-ai/deepseek-v4-pro': { status: 'OFFLINE', ping: 0 },
      'deepseek-ai/deepseek-v4-flash': { status: 'ONLINE', ping: 8 },
    });

    // Mock proposal IPC and respond immediately with approved: true
    const ipcMock = vi.fn().mockImplementation((channel, data) => {
      if (channel === 'ai:failover-proposal') {
        setTimeout(() => {
          registry.resolveProposal(data.proposalId, true);
        }, 10);
      }
    });
    registry.setIpcSender(ipcMock);

    const adapter = await registry.getAdapter(freeModel);
    expect(adapter).toBeDefined();
    expect(registry['activeFailovers'].has(freeModel.modelName)).toBe(true);
  });

  it('should throw error if user rejects interactive failover proposal', async () => {
    vi.spyOn(healthMonitor, 'getSettings').mockReturnValue({
      mode: 'interactive',
      timeoutSeconds: 5,
    });
    vi.spyOn(healthMonitor, 'getStatus').mockReturnValue({
      'deepseek-ai/deepseek-v4-pro': { status: 'OFFLINE', ping: 0 },
      'deepseek-ai/deepseek-v4-flash': { status: 'ONLINE', ping: 8 },
    });

    const ipcMock = vi.fn().mockImplementation((channel, data) => {
      if (channel === 'ai:failover-proposal') {
        setTimeout(() => {
          registry.resolveProposal(data.proposalId, false);
        }, 10);
      }
    });
    registry.setIpcSender(ipcMock);

    await expect(registry.getAdapter(freeModel)).rejects.toThrow('użytkownik odrzucił/zignorował propozycję');
    expect(registry['activeFailovers'].has(freeModel.modelName)).toBe(false);
  });
});
