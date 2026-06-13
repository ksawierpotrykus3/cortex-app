// ============================================================================
// NEXUS — Semantic Search Engine (AI)
// Agent AI który szuka encji po znaczeniu, nie po słowach kluczowych
// ============================================================================

import { WorkspaceEntity, SearchResult, SearchConfig, DEFAULT_SEARCH_CONFIG, AIProvider } from '../../shared/types/schema';
import { IAIProvider } from '../ai/IAIProvider';

export class SearchEngine {
  private config: SearchConfig = { ...DEFAULT_SEARCH_CONFIG };
  private provider: IAIProvider;

  constructor(provider: IAIProvider) {
    this.provider = provider;
  }

  setConfig(config: Partial<SearchConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): SearchConfig {
    return { ...this.config };
  }

  /**
   * Główna metoda: zadaj pytanie AI, dostajesz listę pasujących encji.
   * Działa w 2 krokach:
   *   1. Kompiluje kontekst ze wszystkich encji
   *   2. Pyta AI → parsuje JSON odpowiedzi
   */
  async search(
    query: string,
    entities: WorkspaceEntity[],
    configOverride?: Partial<SearchConfig>,
  ): Promise<SearchResult[]> {
    const cfg = { ...this.config, ...configOverride };

    if (!query.trim() || entities.length === 0) return [];

    // === Krok 1: Kompilacja kontekstu =======================================
    const contextChunks: string[] = [];

    for (const e of entities) {
      const typeLabel =
        e.type === 'node' ? 'Notatka' :
        e.type === 'task' ? 'Task' :
        e.type === 'draft' ? 'Manuskrypt' :
        'Wiki';
      const content = (e.content || '').slice(0, 1000);
      contextChunks.push(
        `[${typeLabel}] ID: ${e.id} | Tytuł: ${e.title || '(bez tytułu)'}\nTreść: ${content}\n`
      );
    }

    const fullContext = contextChunks.join('\n---\n');
    const truncatedContext = fullContext.slice(0, 60000); // 60k znaków max dla kontekstu

    // === Krok 2: Zapytanie AI ===============================================
    const prompt = `${cfg.searchPrompt}\n\n=== Zapytanie użytkownika ===\n${query}\n\n=== Encje w workspace (${entities.length} sztuk) ===\n${truncatedContext}\n\n=== Odpowiedź JSON ===`;

    let raw: string;
    try {
      const result = await this.provider.complete({
        prompt,
        model: {
          provider: AIProvider.GEMINI,
          providerLabel: this.provider.name,
          modelName: 'gemini-2.5-flash',
          temperature: 0.1,
          maxTokens: 4096,
          topP: 0.9,
        },
        contextSize: truncatedContext.length + query.length,
      });
      raw = result.content.trim();
    } catch (err) {
      console.error('[SearchEngine] AI query failed:', err);
      return [];
    }

    // === Krok 3: Parsowanie JSON ============================================
    // AI może zwrócić czysty JSON lub JSON w markdown block
    const jsonStr = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    try {
      const parsed = JSON.parse(jsonStr) as any[];
      if (!Array.isArray(parsed)) return [];

      const results: SearchResult[] = [];
      for (const item of parsed) {
        if (item && item.entityId) {
          results.push({
            entityId: String(item.entityId),
            entityType: (item.entityType as any) || 'node',
            title: String(item.title || ''),
            snippet: String(item.snippet || ''),
            relevance: typeof item.relevance === 'number' ? item.relevance : 0.5,
            viewMode: mapViewMode(item.entityType),
          });
        }
      }

      // Sort by relevance descending, limit
      results.sort((a, b) => b.relevance - a.relevance);
      return results.slice(0, cfg.maxResults);
    } catch (err) {
      console.warn('[SearchEngine] Failed to parse AI response as JSON:', raw.slice(0, 200));
      // Fallback: jeśli AI zwróciło tekst zamiast JSON, spróbuj wyciągnąć ID
      return this.fallbackParse(raw, entities);
    }
  }

  /**
   * Fallback — AI nie zwróciło JSON. Próbujemy zgadnąć po ID w tekście.
   */
  private fallbackParse(text: string, entities: WorkspaceEntity[]): SearchResult[] {
    const results: SearchResult[] = [];
    for (const e of entities) {
      if (text.includes(e.id)) {
        results.push({
          entityId: e.id,
          entityType: e.type,
          title: e.title || '',
          snippet: 'Znaleziono przez referencję ID w odpowiedzi AI',
          relevance: 0.5,
          viewMode: mapViewMode(e.type),
        });
      }
    }
    return results.slice(0, this.config.maxResults);
  }
}

function mapViewMode(type: string): string {
  switch (type) {
    case 'node': return 'nexus';
    case 'task': return 'lab-todo';
    case 'draft': return 'lab-writing';
    case 'wiki': return 'wiki';
    default: return 'nexus';
  }
}
