// ============================================================================
// NEXUS — Changelog Panel (Phase 1)
// Prawa kolumna: wpisy na żywo, streamowanie tokenów, approve/reject
// ============================================================================

import React, { useRef, useEffect, useState } from 'react';
import { ScrollText, Trash2, Search } from 'lucide-react';
import { useChangelogStore } from '../../store/changelogStore';
import { LogEntry } from './LogEntry';

// === Component =============================================================
export function ChangelogPanel() {
  const { entries, clearEntries } = useChangelogStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAgent, setFilterAgent] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll na dół przy nowych wpisach
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [entries.length]);

  // Get unique agent names for filter
  const agentNames = Array.from(new Set(entries.map(e => e.agentName)));

  // Filter entries
  const filteredEntries = entries.filter((entry) => {
    if (searchQuery && !entry.agentName.toLowerCase().includes(searchQuery.toLowerCase())) {
      // Also search in content
      const content = entry.output?.content || entry.streamedContent || '';
      if (!content.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
    }
    if (filterAgent && entry.agentName !== filterAgent) return false;
    return true;
  });

  const streamingCount = entries.filter(e => e.isStreaming).length;

  return (
    <div className="w-96 border-l border-[rgb(var(--border))] flex flex-col h-full bg-[rgb(var(--bg-surface))] overflow-hidden shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))]/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-[rgb(var(--text-secondary))]" />
          <h2 className="text-[13px] font-medium tracking-wider text-[rgb(var(--text))] uppercase">
            Changelog
          </h2>
          {streamingCount > 0 && (
            <span className="px-1.5 py-0.5 text-[9px] bg-blue-500/20 text-blue-400 rounded-full animate-pulse">
              {streamingCount} live
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearEntries}
            className="p-1.5 rounded-lg text-[rgb(var(--text-muted))] hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
            title="Wyczyść changelog"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="px-4 py-2 border-b border-[rgb(var(--border))]/50 bg-[rgb(var(--bg-elevated))]/30">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-[rgb(var(--text-secondary))]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj w changelogu..."
              className="w-full pl-7 pr-2 py-1.5 text-[11px] bg-[rgb(var(--bg-canvas))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text))] placeholder:text-[rgb(var(--text-tertiary))] outline-none focus:border-[rgb(var(--accent))]/50 transition-colors"
            />
          </div>
          {agentNames.length > 1 && (
            <select
              value={filterAgent || ''}
              onChange={(e) => setFilterAgent(e.target.value || null)}
              className="px-2 py-1.5 text-[11px] bg-[rgb(var(--bg-canvas))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text-secondary))] outline-none"
            >
              <option value="">Wszyscy</option>
              {agentNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-4 py-1.5 border-b border-[rgb(var(--border))]/30 bg-[rgb(var(--bg-elevated))]/20 flex items-center justify-between">
        <span className="text-[9px] text-[rgb(var(--text-secondary))]">
          {filteredEntries.length} wpisów
          {streamingCount > 0 && ` (${streamingCount} streamuje)`}
        </span>
        <span className="text-[9px] text-[rgb(var(--text-secondary))] opacity-50">
          {entries.filter(e => e.output?.approved === true).length} zatwierdzonych
        </span>
      </div>

      {/* Entries */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto custom-scrollbar"
      >
        {filteredEntries.length === 0 ? (
          <div className="p-6 text-center">
            <ScrollText className="w-8 h-8 mx-auto mb-3 text-[rgb(var(--text-secondary))] opacity-30" />
            <p className="text-[12px] text-[rgb(var(--text-secondary))] opacity-50">
              {searchQuery ? 'Brak wyników wyszukiwania' : 'Brak wpisów w changelogu'}
            </p>
            <p className="text-[10px] text-[rgb(var(--text-secondary))] opacity-30 mt-1">
              Uruchom agenta aby zobaczyć wyniki
            </p>
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <LogEntry key={entry.id} entry={entry} />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-1.5 border-t border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))]/30 flex items-center justify-between">
        <span className="text-[9px] text-[rgb(var(--text-secondary))] opacity-50">
          Live streaming
        </span>
      </div>
    </div>
  );
}
