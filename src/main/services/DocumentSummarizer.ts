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

  async summarize(content: string, tokenCount: number): Promise<string | null> {
    if (!this.providerRegistry) {
      console.warn('[DocumentSummarizer] ProviderRegistry niedostępny, pomijam streszczanie');
      return null;
    }
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
      const r = await Promise.race([
        adapter.complete({ prompt, model: mc, systemPrompt: 'Jestes asystentem tworzacym zwiezle streszczenia dokumentow.', contextSize: prompt.length }),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout 30s')), 30_000)),
      ]);
      if (r && typeof r === 'object' && 'content' in r) {
        const summary = (r as any).content;
        if (summary) return summary;
      }
      return null;
    } catch (e) {
      console.error('[DocumentSummarizer] Summarization error:', (e as Error).message);
      return null;
    }
  }
}