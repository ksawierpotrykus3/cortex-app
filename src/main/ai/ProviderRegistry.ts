// ============================================================================
// NEXUS — ProviderRegistry (Phase 2)
// Zarządza instancjami adapterów AI + routuje do właściwego providera
// ============================================================================

import { IAIProvider } from './IAIProvider';
import { OpenAIApiAdapter } from './OpenAIApiAdapter';
import { GeminiAdapter } from './GeminiAdapter';
import { AIProvider, ProviderAuthConfig, ModelConfig, DEFAULT_PROVIDERS } from '../../shared/types/schema';
import { rateLimiter } from './RateLimiter';
import { AiHealthMonitor } from './AiHealthMonitor';

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
  public healthMonitor?: AiHealthMonitor;

  private activeFailovers: Set<string> = new Set();
  private pendingProposals: Map<string, (approved: boolean) => void> = new Map();
  private ipcSender?: (channel: string, data: any) => void;

  /** Zwraca domyślny limit RPM dla danego providera */
  private static getDefaultRpmLimit(label: string): number {
    if (label.includes('Gemini')) return 60;
    if (label.includes('DeepSeek') || label.includes('NVIDIA')) return 40;
    if (label.includes('Ollama')) return 0; // lokalny — bez limitu
    return 30; // domyślny bezpieczny limit
  }

  constructor(healthMonitor?: AiHealthMonitor) {
    this.healthMonitor = healthMonitor;

    // Load defaults
    for (const cfg of DEFAULT_PROVIDERS) {
      this.configs.push({ ...cfg });
      const adapter = createAdapter(cfg);
      if (adapter) {
        this.providers.set(cfg.label, adapter);
      }
      rateLimiter.setLimit(cfg.label, ProviderRegistry.getDefaultRpmLimit(cfg.label));
    }

    if (this.healthMonitor) {
      this.healthMonitor.onStatusChange = (modelName, status) => {
        if (status === 'ONLINE' && this.activeFailovers.has(modelName)) {
          const settings = this.healthMonitor!.getSettings();
          if (settings.mode === 'automatic') {
            console.log(`[ProviderRegistry] Automatic recovery to free model "${modelName}"`);
            this.activeFailovers.delete(modelName);
            if (this.ipcSender) {
              this.ipcSender('ai:status-changed', {
                status: this.healthMonitor!.getStatus(),
                activeFailovers: Array.from(this.activeFailovers),
              });
            }
          } else if (settings.mode === 'interactive') {
            console.log(`[ProviderRegistry] Sending recovery proposal for "${modelName}"`);
            if (this.ipcSender) {
              this.ipcSender('ai:recovery-proposal', { modelName });
            }
          }
        }
        if (this.ipcSender) {
          this.ipcSender('ai:status-changed', {
            status: this.healthMonitor!.getStatus(),
            activeFailovers: Array.from(this.activeFailovers),
          });
        }
      };
    }
  }

  setIpcSender(sender: (channel: string, data: any) => void): void {
    this.ipcSender = sender;
    // Emit initial status
    if (this.healthMonitor && this.ipcSender) {
      this.ipcSender('ai:status-changed', {
        status: this.healthMonitor.getStatus(),
        activeFailovers: Array.from(this.activeFailovers),
      });
    }
  }

  // =========================================================================
  // Failover Interactive Handler
  // =========================================================================

  resolveProposal(proposalId: string, approved: boolean): void {
    const resolve = this.pendingProposals.get(proposalId);
    if (resolve) {
      resolve(approved);
      this.pendingProposals.delete(proposalId);
    }
  }

  resolveRecovery(modelName: string, approved: boolean): void {
    if (approved && this.activeFailovers.has(modelName)) {
      console.log(`[ProviderRegistry] User approved recovery to free model "${modelName}"`);
      this.activeFailovers.delete(modelName);
      if (this.ipcSender && this.healthMonitor) {
        this.ipcSender('ai:status-changed', {
          status: this.healthMonitor.getStatus(),
          activeFailovers: Array.from(this.activeFailovers),
        });
      }
    }
  }

  private async askUserForFailover(modelName: string, timeoutSeconds: number): Promise<boolean> {
    const proposalId = Math.random().toString(36).substring(2, 9);
    return new Promise<boolean>((resolve) => {
      this.pendingProposals.set(proposalId, resolve);

      if (this.ipcSender) {
        this.ipcSender('ai:failover-proposal', {
          proposalId,
          modelName,
          timeoutSeconds,
        });
      }

      setTimeout(() => {
        if (this.pendingProposals.has(proposalId)) {
          console.log(`[ProviderRegistry] Interactive failover proposal ${proposalId} timed out after ${timeoutSeconds}s`);
          resolve(false);
          this.pendingProposals.delete(proposalId);
        }
      }, timeoutSeconds * 1000);
    });
  }

  private getPaidAdapter(modelName: string): { label: string; adapter: IAIProvider } | null {
    for (const cfg of this.configs) {
      // Paid provider is not the Nvidia proxy or default free model
      if (cfg.baseUrl?.includes('localhost:3456') || cfg.label.includes('NVIDIA') || (cfg.label === 'DeepSeek V4 Flash' && cfg.isBuiltin)) {
        continue;
      }
      if (cfg.models.includes(modelName) && cfg.apiKey && cfg.apiKey !== 'not-needed') {
        const adapter = this.providers.get(cfg.label);
        if (adapter && adapter.isConfigured()) {
          return { label: cfg.label, adapter };
        }
      }
    }
    return null;
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

  async getAdapter(modelConfig: ModelConfig, options?: { isPipeline?: boolean }): Promise<IAIProvider> {
    const label = modelConfig.providerLabel;
    const modelName = modelConfig.modelName;

    // Check if this is a free model on the local Nvidia proxy or default free model
    const isFreeModel = (label === 'NVIDIA (DeepSeek / Kimi / Qwen)' || label.includes('NVIDIA') || label === 'DeepSeek V4 Flash') &&
      (modelName === 'deepseek-ai/deepseek-v4-pro' || modelName === 'deepseek-ai/deepseek-v4-flash' || modelName === 'deepseek-v4-flash' || modelName === 'deepseek-v4-pro');

    if (isFreeModel && this.healthMonitor) {
      const settings = this.healthMonitor.getSettings();
      const status = this.healthMonitor.getStatus()[modelName];
      const isOffline = status ? status.status === 'OFFLINE' : false;

      // If offline or already failed over
      if (isOffline || this.activeFailovers.has(modelName)) {
        if (settings.mode === 'strict') {
          throw new Error(`Model darmowy "${modelName}" jest niedostępny w trybie Strict.`);
        } else if (settings.mode === 'automatic' || options?.isPipeline) {
          const paid = this.getPaidAdapter(modelName);
          if (!paid) {
            throw new Error(`Darmowy model "${modelName}" nie odpowiada, a w systemie nie skonfigurowano żadnego płatnego klucza API dla tego modelu.`);
          }
          console.log(`[ProviderRegistry] Failover (Auto/Pipeline) to paid provider "${paid.label}" for model "${modelName}"`);
          this.activeFailovers.add(modelName);
          return paid.adapter;
        } else if (settings.mode === 'interactive') {
          // If already active failover, continue using it
          if (this.activeFailovers.has(modelName)) {
            const paid = this.getPaidAdapter(modelName);
            if (paid) return paid.adapter;
          }

          // Check if paid adapter exists before asking
          const paidExists = this.getPaidAdapter(modelName) !== null;
          if (!paidExists) {
            throw new Error(`Darmowy model "${modelName}" nie odpowiada, a w systemie nie skonfigurowano żadnego płatnego klucza API dla tego modelu.`);
          }

          // Ask user
          console.log(`[ProviderRegistry] Failover (Interactive) proposal for "${modelName}"`);
          const approved = await this.askUserForFailover(modelName, settings.timeoutSeconds);
          if (approved) {
            const paid = this.getPaidAdapter(modelName);
            if (paid) {
              this.activeFailovers.add(modelName);
              return paid.adapter;
            }
          }
          throw new Error(`Model darmowy "${modelName}" nie odpowiada (użytkownik odrzucił/zignorował propozycję użycia płatnego).`);
        }
      }
    }

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
  recordSend(label: string, modelName?: string): void {
    if (modelName && this.activeFailovers.has(modelName) && (label === 'NVIDIA (DeepSeek / Kimi / Qwen)' || label.includes('NVIDIA') || label === 'DeepSeek V4 Flash')) {
      const paid = this.getPaidAdapter(modelName);
      if (paid) {
        rateLimiter.recordSend(paid.label);
        return;
      }
    }
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
