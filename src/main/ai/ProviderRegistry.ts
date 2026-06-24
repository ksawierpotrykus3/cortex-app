// ============================================================================
// NEXUS — ProviderRegistry (Phase 2)
// Zarządza instancjami adapterów AI + routuje do właściwego providera
// ============================================================================

import { IAIProvider } from './IAIProvider';
import { OpenAIApiAdapter } from './OpenAIApiAdapter';
import { GeminiAdapter } from './GeminiAdapter';
import { AIProvider, ProviderAuthConfig, ModelConfig, DEFAULT_PROVIDERS } from '../../shared/types/schema';
import { rateLimiter } from './RateLimiter';

// === Provider Factory ======================================================
function createAdapter(config: ProviderAuthConfig): IAIProvider | null {
  const baseUrl = config.baseUrl || '';
  const apiKey = config.apiKey || '';

  switch (config.provider) {
    case AIProvider.GEMINI:
      return new GeminiAdapter(apiKey);

    case AIProvider.OPENROUTER:
    case AIProvider.OLLAMA:
      return new OpenAIApiAdapter(config.label, baseUrl, apiKey);

    default:
      console.warn(`[ProviderRegistry] Unknown provider: ${config.provider}`);
      return null;
  }
}

// === ProviderRegistry (Singleton) ==========================================
export class ProviderRegistry {
  private providers: Map<string, IAIProvider> = new Map();
  private configs: ProviderAuthConfig[] = [];

  /** Zwraca domyślny limit RPM dla danego providera */
  private static getDefaultRpmLimit(label: string): number {
    if (label.includes('Gemini')) return 60;
    if (label.includes('DeepSeek') || label.includes('NVIDIA')) return 40;
    if (label.includes('Ollama')) return 0; // lokalny — bez limitu
    return 30; // domyślny bezpieczny limit
  }

  constructor() {
    // Load defaults
    for (const cfg of DEFAULT_PROVIDERS) {
      this.configs.push({ ...cfg });
      const adapter = createAdapter(cfg);
      if (adapter) {
        this.providers.set(cfg.label, adapter);
      }
      rateLimiter.setLimit(cfg.label, ProviderRegistry.getDefaultRpmLimit(cfg.label));
    }
  }

  // =========================================================================
  // Provider Configuration Management
  // =========================================================================

  getConfigs(): ProviderAuthConfig[] {
    return [...this.configs];
  }

  getConfig(label: string): ProviderAuthConfig | undefined {
    return this.configs.find(c => c.label === label);
  }

  upsertConfig(config: ProviderAuthConfig): void {
    const idx = this.configs.findIndex(c => c.label === config.label);
    if (idx >= 0) {
      this.configs[idx] = config;
    } else {
      this.configs.push(config);
    }

    // Re-create adapter
    const adapter = createAdapter(config);
    if (adapter) {
      this.providers.set(config.label, adapter);
    }

    rateLimiter.setLimit(config.label, ProviderRegistry.getDefaultRpmLimit(config.label));
  }

  removeConfig(label: string): void {
    const cfg = this.configs.find(c => c.label === label);
    if (cfg?.isBuiltin) {
      throw new Error(`Nie można usunąć wbudowanego providera: ${label}`);
    }
    this.configs = this.configs.filter(c => c.label !== label);
    this.providers.delete(label);
  }

  setApiKey(label: string, apiKey: string): void {
    const cfg = this.configs.find(c => c.label === label);
    if (!cfg) throw new Error(`Provider not found: ${label}`);
    cfg.apiKey = apiKey;

    // Re-create adapter with new key
    const adapter = createAdapter(cfg);
    if (adapter) {
      this.providers.set(label, adapter);
    }

    rateLimiter.setLimit(label, ProviderRegistry.getDefaultRpmLimit(label));
  }

  // =========================================================================
  // Resolve adapter for a model config
  // =========================================================================

  getAdapter(modelConfig: ModelConfig): IAIProvider {
    const label = modelConfig.providerLabel;
    const adapter = this.providers.get(label);
    if (!adapter) {
      throw new Error(`Provider "${label}" nie jest skonfigurowany. Dodaj klucz API w ustawieniach.`);
    }
    if (!adapter.isConfigured()) {
      throw new Error(`Provider "${label}" nie ma klucza API. Skonfiguruj go w ustawieniach.`);
    }
    // Sprawdź limit RPM przed wysłaniem
    if (!rateLimiter.canSend(label)) {
      const usage = rateLimiter.getUsage(label);
      throw new Error(`Przekroczono limit RPM dla "${label}" (${usage.used}/${usage.limit}). Odczekaj przed następnym zapytaniem.`);
    }
    return adapter;
  }

  /** Rejestruje udane wysłanie zapytania do RateLimiter */
  recordSend(label: string): void {
    rateLimiter.recordSend(label);
  }

  // =========================================================================
  // Get available models for UI
  // =========================================================================

  getAvailableModels(): Array<{ label: string; modelName: string; providerLabel: string }> {
    const result: Array<{ label: string; modelName: string; providerLabel: string }> = [];
    for (const cfg of this.configs) {
      for (const model of cfg.models) {
        result.push({
          label: `${cfg.label} → ${model}`,
          modelName: model,
          providerLabel: cfg.label,
        });
      }
    }
    return result;
  }

  // =========================================================================
  // Test
  // =========================================================================

  async testConnection(label: string): Promise<{ success: boolean; error?: string }> {
    const adapter = this.providers.get(label);
    if (!adapter) return { success: false, error: `Provider "${label}" not found` };
    return adapter.testConnection();
  }

  destroy(): void {
    this.providers.clear();
    this.configs = [];
  }
}
