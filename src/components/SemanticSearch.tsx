// ============================================================================
// NEXUS — SemanticSearch (AI Semantic Search)
// AI-powered search — wpisz frazę, AI znajduje pasujące encje
// ============================================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Sparkles, ExternalLink, Loader2, Settings } from 'lucide-react';
import { SearchResult, DEFAULT_SEARCH_CONFIG, WorkspaceEntity } from '../shared/types/schema';
import { SearchEngine } from '../utils/searchEngine';

interface SemanticSearchProps {
  entities: WorkspaceEntity[];
  /** Callback — gdy użytkownik kliknie wynik, przełącz widok */
  onNavigate: (result: SearchResult) => void;
}

export function SemanticSearch({ entities, onNavigate }: SemanticSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [searchPrompt, setSearchPrompt] = useState(DEFAULT_SEARCH_CONFIG.searchPrompt);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Open/close via custom event from TopNavigation
  useEffect(() => {
    const handler = () => setOpen((p) => !p);
    window.addEventListener('nx:toggle-search', handler);
    return () => window.removeEventListener('nx:toggle-search', handler);
  }, []);

  // Esc to close
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  // Esc to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setOpen((p) => !p);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || !open) {
      setResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await SearchEngine.search(query, entities, { searchPrompt });
        setResults(res);
      } catch (err) {
        console.error('[SemanticSearch] Error:', err);
        setResults([]);
      }
      setLoading(false);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, entities, searchPrompt, open]);

  // Save config
  const handleSaveConfig = useCallback(async () => {
    try {
      const bridge = (window as any).nexusBridge as any;
      if (bridge?.updateSearchConfig) {
        await bridge.updateSearchConfig({ config: { searchPrompt, maxResults: 10 } });
      }
    } catch (e) { console.warn('[SemanticSearch] Failed to save search config', e); }
    setShowConfig(false);
  }, [searchPrompt]);

  // Load config
  useEffect(() => {
    (async () => {
      try {
        const bridge = (window as any).nexusBridge as any;
        if (bridge?.getSearchConfig) {
          const cfg = await bridge.getSearchConfig();
          setSearchPrompt(cfg.searchPrompt);
        }
      } catch (e) { console.warn('[SemanticSearch] Failed to load search config', e); }
    })();
  }, []);

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:bg-[rgb(var(--background))] transition-colors cursor-pointer"
        title="Szukaj AI (Ctrl+Shift+F)"
      >
        <Sparkles size={14} />
        <span>Szukaj AI</span>
      </button>

      {/* Search overlay */}
      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh]"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full max-w-xl bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search bar */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[rgb(var(--border))]">
              {loading ? (
                <Loader2 className="w-4 h-4 text-[rgb(var(--accent))] animate-spin shrink-0" />
              ) : (
                <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
              )}
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Szukaj po znaczeniu — np. &quot;notatka o hookach w Reakcie&quot;"
                className="flex-1 bg-transparent border-none outline-none text-[14px] text-[rgb(var(--text-main))] placeholder:text-[rgb(var(--text-muted))]"
              />
              <button
                onClick={() => setShowConfig(true)}
                className="p-1 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] cursor-pointer"
                aria-label="Ustawienia promptu"
                title="Ustawienia promptu wyszukiwania"
              >
                <Settings size={14} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] cursor-pointer"
                aria-label="Zamknij wyszukiwanie"
              >
                <X size={16} />
              </button>
            </div>

            {/* Results */}
            {results.length > 0 && (
              <div className="max-h-[40vh] overflow-y-auto custom-scrollbar py-2">
                {results.map((r, i) => (
                  <button
                    key={`${r.entityId}-${i}`}
                    onClick={() => { onNavigate(r); setOpen(false); }}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[rgb(var(--border))]/30 transition-colors cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-[rgb(var(--text-main))] truncate">{r.title || '(bez tytułu)'}</span>
                        <span className="text-[10px] px-1 py-0.5 rounded bg-[rgb(var(--border))]/50 text-[rgb(var(--text-muted))] shrink-0">{r.entityType}</span>
                      </div>
                      <p className="text-[11px] text-[rgb(var(--text-muted))] mt-1 line-clamp-2">{r.snippet}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center gap-1 text-[10px] text-[rgb(var(--text-muted))]">
                        <span>{Math.round(r.relevance * 100)}%</span>
                        <ExternalLink size={10} />
                      </div>
                      <div className="w-12 h-1 rounded-full bg-[rgb(var(--border))] overflow-hidden">
                        <div
                          className="h-full bg-purple-400 rounded-full transition-all"
                          style={{ width: `${r.relevance * 100}%` }}
                        />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Empty / loading state */}
            {query.trim() && !loading && results.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-[13px] text-[rgb(var(--text-muted))]">Brak wyników</p>
                <p className="text-[11px] text-[rgb(var(--text-muted))]/60 mt-1">Spróbuj inaczej sformułować zapytanie</p>
              </div>
            )}

            {/* Footer */}
            <div className="px-4 py-2 border-t border-[rgb(var(--border))] flex items-center justify-between text-[10px] text-[rgb(var(--text-muted))]">
              <span className="flex items-center gap-1">
                <Sparkles size={10} className="text-purple-400" />
                Szukanie AI — rozumie znaczenie, nie słowa kluczowe
              </span>
              <span>Ctrl+Shift+F</span>
            </div>
          </div>
        </div>
      )}

      {/* Config modal */}
      {showConfig && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center" onClick={() => setShowConfig(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-lg bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[14px] font-semibold text-[rgb(var(--text-main))] mb-3">Prompt wyszukiwania AI</h3>
            <textarea
              value={searchPrompt}
              onChange={(e) => setSearchPrompt(e.target.value)}
              className="w-full h-40 bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-lg p-3 text-[12px] text-[rgb(var(--text-main))] outline-none focus:border-[rgb(var(--accent))] resize-none"
            />
            <div className="flex gap-2 mt-3">
              <button onClick={() => { setSearchPrompt(DEFAULT_SEARCH_CONFIG.searchPrompt); }} className="px-3 py-1.5 text-[11px] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] cursor-pointer">Przywróć domyślny</button>
              <button onClick={handleSaveConfig} className="ml-auto px-4 py-1.5 text-[12px] font-medium bg-[rgb(var(--accent))] text-white rounded-lg hover:opacity-90 cursor-pointer">Zapisz</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
