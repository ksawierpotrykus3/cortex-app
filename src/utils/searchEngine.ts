// ============================================================================
// NEXUS — SearchEngine (Renderer-side)
// Bridge do SearchEngine w main process przez IPC
// ============================================================================

import { SearchResult, SearchConfig, WorkspaceEntity } from '../shared/types/schema';

export class SearchEngine {
  static async search(
    query: string,
    entities: WorkspaceEntity[],
    config?: Partial<SearchConfig>,
  ): Promise<SearchResult[]> {
    try {
      const bridge = (window as any).nexusBridge as any;
      if (bridge?.searchQuery) {
        return await bridge.searchQuery({ query, entities, config });
      }
    } catch (err) {
      console.warn('[SearchEngine] IPC search failed, using fallback:', err);
    }
    return fallbackSearch(query, entities);
  }
}

/**
 * Fallback — proste wyszukiwanie po słowach kluczowych gdy AI niedostępne
 */
function fallbackSearch(query: string, entities: WorkspaceEntity[]): SearchResult[] {
  const q = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (q.length === 0) return [];

  const results: SearchResult[] = [];

  for (const e of entities) {
    const text = `${e.title} ${e.content}`.toLowerCase();
    let matchCount = 0;
    for (const word of q) {
      if (text.includes(word)) matchCount++;
    }
    if (matchCount > 0) {
      const relevance = Math.min(matchCount / q.length, 1);
      results.push({
        entityId: e.id,
        entityType: e.type,
        title: e.title || '(bez tytułu)',
        snippet: (e.content || '').slice(0, 200),
        relevance,
        viewMode: mapViewMode(e.type),
      });
    }
  }

  results.sort((a, b) => b.relevance - a.relevance);
  return results.slice(0, 10);
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
