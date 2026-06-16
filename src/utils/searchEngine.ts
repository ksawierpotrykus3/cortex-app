// ============================================================================
// NEXUS — SearchEngine (Renderer-side)
// Bridge to main process search via IPC
// ============================================================================

import { SearchResult, SearchConfig, WorkspaceEntity } from '../shared/types/schema';
import { fallbackSearch } from '../shared/utils/search';

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
