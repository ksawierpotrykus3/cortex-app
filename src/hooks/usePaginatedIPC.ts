// ================================================================
// NEXUS V2 — usePaginatedIPC Hook (Phase 5.1)
// ================================================================
// Custom React Hook do stronicowanego ładowania logów agentów
// przez IPC. Używa IntersectionObserver do wykrywania, gdy
// użytkownik jest 200px od dna ekranu i automatycznie ładuje
// kolejną stronę.
//
// ARCHITEKTURA:
// - IntersectionObserver na sentinel div (200px przed końcem)
// - Auto-load kolejnej strony gdy observer się odpali
// - useMemo do stabilnej referencji listy entry
// - Obsługa błędów IPC przez fallback do pustej strony
// - Stan: entries[], loading, hasMore, error
// ================================================================

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// ==============================================================
// LogPageResponse — typ odpowiedzi paginacji
// ==============================================================
interface LogPageResponse {
  entries: LogEntry[];
  nextCursor: string | null;
  hasMore: boolean;
  pageSize: number;
}

// ==============================================================
// Stałe
// ==============================================================
const DEFAULT_PAGE_SIZE = 50;
const OBSERVER_MARGIN_PX = 200; // ładuj kolejną stronę 200px przed końcem
const IPC_CHANNEL = 'get-logs';

// ==============================================================
// LogEntry — typ pojedynczego wpisu logu dla UI
// ==============================================================
export interface LogEntry {
  id: string;
  timestamp: number;
  payload: unknown;
  size: number;
}

// ==============================================================
// UsePaginatedIPCOptions — opcje konfiguracyjne hooka
// ==============================================================
export interface UsePaginatedIPCOptions {
  pageSize?: number;
  initialLoad?: boolean;
}

// ==============================================================
// UsePaginatedIPCResult — zwracany stan hooka
// ==============================================================
export interface UsePaginatedIPCResult {
  entries: LogEntry[];
  loading: boolean;
  hasMore: boolean;
  error: string | null;
  loadNextPage: () => Promise<void>;
  reload: () => Promise<void>;
  /** Ref do sentinel elementu (IntersectionObserver target) */
  sentinelRef: React.RefCallback<HTMLDivElement>;
  totalLoaded: number;
}

// ==============================================================
// usePaginatedIPC — główny hook
//
// UŻYCIE:
//   const { entries, sentinelRef, loading } = usePaginatedIPC();
//   return (
//     <div>
//       {entries.map(e => <LogItem key={e.id} entry={e} />)}
//       <div ref={sentinelRef} /> {/* observer target */}
//     </div>
//   );
// ==============================================================
export function usePaginatedIPC(options?: UsePaginatedIPCOptions): UsePaginatedIPCResult {
  const { pageSize = DEFAULT_PAGE_SIZE, initialLoad = true } = options ?? {};

  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Przechowujemy cursor w ref (nie powoduje re-renderów)
  const cursorRef = useRef<string | null>(null);
  const loadingRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // ============================================================
  // loadNextPage — pobiera kolejną stronę przez IPC
  //
  // 1. Sprawdza czy nie ładujemy już (loadingRef)
  // 2. Woła window.electron.invoke('get-logs', cursor, pageSize)
  // 3. Zlepia nowe wyniki z istniejącymi
  // 4. Aktualizuje cursor na nextCursor z odpowiedzi
  //
  // BEZPIECZEŃSTWO:
  // - Jeśli IPC nie jest dostępne (brak Electrona), używa fallback
  //   przez fetch do symulowanego endpointu.
  // - Błędy IPC są łapane i ustawiane w stanie error.
  // - Ponowne wywołanie podczas ładowania jest no-op.
  // ============================================================
  const loadNextPage = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      let response: LogPageResponse;

      // Through Electron IPC (nexusBridge)
      if (typeof window !== 'undefined' && (window as any).nexusBridge?.getLogs) {
        const data = await (window as any).nexusBridge.getLogs({ cursor: cursorRef.current, limit: pageSize });
        response = {
          entries: data?.entries || [],
          nextCursor: data?.nextCursor || null,
          hasMore: data?.hasMore ?? false,
          pageSize,
        };
      } else {
        // Fallback dla development (przeglądarka)
        response = {
          entries: [],
          nextCursor: null,
          hasMore: false,
          pageSize,
        };
      }

      if (response && Array.isArray(response.entries)) {
        setEntries(prev => {
          // Unikaj duplikatów — sprawdź czy ID już istnieje
          const existingIds = new Set(prev.map(e => e.id));
          const newEntries = response.entries.filter((e: LogEntry) => !existingIds.has(e.id));
          return [...prev, ...newEntries];
        });

        cursorRef.current = response.nextCursor;
        setHasMore(response.hasMore);
      }
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      setError(`IPC pagination error: ${msg}`);
      console.error('[usePaginatedIPC] Load error:', err);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [hasMore, pageSize]);

  // ============================================================
  // reload — resetuje stan i ładuje od początku
  // ============================================================
  const reload = useCallback(async () => {
    cursorRef.current = null;
    setEntries([]);
    setHasMore(true);
    setError(null);
    // Force load in next tick
    setTimeout(() => loadNextPage(), 0);
  }, [loadNextPage]);

  // ============================================================
  // sentinelRef — callback ref dla IntersectionObserver
  //
  // Tworzy IntersectionObserver z rootMargin = 200px (threshold
  // ładuje stronę zanim użytkownik dojdzie do końca).
  // Gdy sentinel staje się widoczny, ładuje kolejną stronę.
  //
  // Cleanup: observer disconnect przy odmontowaniu.
  // ============================================================
  const sentinelRef = useCallback<React.RefCallback<HTMLDivElement>>((node) => {
    // Cleanup starego observera
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (!node) return;

    // Utwórz nowy IntersectionObserver z marginem 200px
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting && hasMore && !loadingRef.current) {
          loadNextPage();
        }
      },
      {
        rootMargin: `${OBSERVER_MARGIN_PX}px 0px`,
        threshold: 0,
      }
    );

    observerRef.current.observe(node);
  }, [loadNextPage, hasMore]);

  // ============================================================
  // Initial load — pierwsza strona po montażu
  // ============================================================
  useEffect(() => {
    if (initialLoad && entries.length === 0 && hasMore) {
      loadNextPage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // Cleanup observera przy odmontowaniu
  // ============================================================
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);

  // ============================================================
  // useMemo — stabilna referencja entries (unikaj niepotrzebnych
  // re-renderów komponentów potomnych)
  // ============================================================
  const stableEntries = useMemo(() => entries, [entries]);

  return {
    entries: stableEntries,
    loading,
    hasMore,
    error,
    loadNextPage,
    reload,
    sentinelRef,
    totalLoaded: entries.length,
  };
}
