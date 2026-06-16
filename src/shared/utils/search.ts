// ============================================================================
// NEXUS — Shared Search Utilities
// Współdzielone funkcje fallbackSearch i mapViewMode
// ============================================================================

import { SearchResult, WorkspaceEntity } from '../types/schema';

/**
 * Simple keyword-based search when AI is unavailable.
 */
export function fallbackSearch(query: string, entities: WorkspaceEntity[], maxResults: number = 10): SearchResult[] {
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
        title: e.title || '(no title)',
        snippet: (e.content || '').slice(0, 200),
        relevance,
        viewMode: mapViewMode(e.type),
      });
    }
  }

  results.sort((a, b) => b.relevance - a.relevance);
  return results.slice(0, maxResults);
}

/**
 * Maps entity type to view mode string.
 */
export function mapViewMode(type: string): string {
  switch (type) {
    case 'node': return 'nexus';
    case 'task': return 'lab-todo';
    case 'draft': return 'lab-writing';
    case 'wiki': return 'wiki';
    default: return 'nexus';
  }
}
