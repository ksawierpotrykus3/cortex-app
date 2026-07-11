// ============================================================================
// NEXUS — DocumentSummarizer (Plan 01)
// Generuje streszczenia dokumentów przez AI dla plików > 2000 tokenów
// ============================================================================

import { ProviderRegistry } from '../ai/ProviderRegistry';

export class DocumentSummarizer {
  private providerRegistry: ProviderRegistry;
  private lastSummarizeTime: number = 0;

  constructor(providerRegistry: ProviderRegistry) {
    this.providerRegistry = providerRegistry;
  }

  async summarize(content: string, tokenCount: number, signal?: AbortSignal): Promise<string | null> {
    if (tokenCount < 500) {
      return null;
    }
    const now = Date.now();
    if (now - this.lastSummarizeTime < 10_000) {
      return null;
    }
    this.lastSummarizeTime = now;
    try {
      const configs = this.providerRegistry.getConfigs();
      const cfg = configs.find(c => c.hasApiKey);
      if (!cfg) {
        console.warn('[DocumentSummarizer] No provider with API key configured');
        return null;
      }
      const mc = { provider: cfg.provider, providerLabel: cfg.label, modelName: cfg.models[0] || '', temperature: 0.3, maxTokens: 1024, topP: 0.95 };
      if (!mc.modelName) return null;
      const adapter = await this.providerRegistry.getAdapter(mc);
      const prompt = `Streszczaj nastepujacy dokument w 3-5 zdaniach po polsku, zachowujac kluczowe informacje:\n\n${content.slice(0, 8000)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30_000);
      const onExternalAbort = () => controller.abort();
      signal?.addEventListener('abort', onExternalAbort, { once: true });
      try {
        const r = await adapter.complete({ prompt, model: mc, systemPrompt: 'Jestes asystentem tworzacym zwiezle streszczenia dokumentow.', contextSize: prompt.length });
        if (signal?.aborted) return null;
        if (r && typeof r === 'object' && 'content' in r) {
          const summary = (r as any).content;
          if (summary) return summary;
        }
        return null;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onExternalAbort);
        controller.abort();
      }
    } catch (e) {
      console.error('[DocumentSummarizer] Summarization error:', (e as Error).message);
      return null;
    }
  }
}