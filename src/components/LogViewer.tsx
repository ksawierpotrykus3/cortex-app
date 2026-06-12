// ================================================================
// NEXUS V2 — LogViewer: Virtual Windowing (Phase 5.2)
// ================================================================
// Komponent renderujący logi agentów AI z użyciem react-window
// (FixedSizeList) do wirtualizacji. Renderuje WYŁĄCZNIE widoczne
// elementy (ok. 20 na monitorze) niezależnie od rozmiaru tablicy.
//
// ARCHITEKTURA:
// - FixedSizeList (react-window) — virtual scrolling
// - .log-item { height: 60px; contain: strict; } — CSS containment
// - Throttling przez requestAnimationFrame przy odbieraniu logów
// - Throttle co 100ms na agregację batchy logów
// - Auto-scroll do dołu gdy nowe logi (opcjonalnie)
// - IntersectionObserver + usePaginatedIPC do nieskończonego scrolla
// ================================================================

import React, { useRef, useCallback, useEffect, useMemo, useReducer } from 'react';
import { FixedSizeList, type ListOnItemsRenderedProps, type ListChildComponentProps } from 'react-window';
import { usePaginatedIPC, type LogEntry } from '../hooks/usePaginatedIPC';

// ==============================================================
// Stałe wymiarowania — twarde granice CSS
// ==============================================================
const LOG_ITEM_HEIGHT = 60; // .log-item { height: 60px; }
const OVERSCAN_COUNT = 5;   // elementy poza viewportem dla płynności
const DEFAULT_LIST_HEIGHT = 600;
const THROTTLE_MS = 100;    // throttle batch co 100ms

// ==============================================================
// Props
// ==============================================================
export interface LogViewerProps {
  height?: number;
  pageSize?: number;
  autoScroll?: boolean;
  filter?: string; // opcjonalny filtr tekstowy
  onEntryClick?: (entry: LogEntry) => void;
}

// ==============================================================
// LogItemRow — pojedynczy wiersz logu (renderowany przez react-window)
// ==============================================================
const LogItemRow = React.memo<{ entry: LogEntry; style: React.CSSProperties; onClick?: (e: LogEntry) => void }>(
  ({ entry, style, onClick }) => {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const payloadStr = typeof entry.payload === 'object'
      ? JSON.stringify(entry.payload).slice(0, 200)
      : String(entry.payload ?? '').slice(0, 200);

    return (
      <div
        className="log-item"
        style={style}
        onClick={() => onClick?.(entry)}
        title={`ID: ${entry.id}\nTime: ${new Date(entry.timestamp).toISOString()}\nSize: ${entry.size}B`}
      >
        <span className="log-item-time">{timestamp}</span>
        <span className="log-item-payload">{payloadStr}</span>
        <span className="log-item-id">{entry.id.slice(-8)}</span>
      </div>
    );
  }
);

LogItemRow.displayName = 'LogItemRow';

// ==============================================================
// InnerElementType — wrapper dla wewnętrznego elementu listy
// zapewniający CSS containment na poziomie kontenera
// ==============================================================
const InnerElementType = React.forwardRef<HTMLDivElement, { style: React.CSSProperties; children: React.ReactNode }>(
  ({ style, ...rest }, ref) => (
    <div ref={ref} style={{ ...style, contain: 'strict' }} {...rest} />
  )
);
InnerElementType.displayName = 'InnerElementType';

// ==============================================================
// LogViewer — główny komponent
// ==============================================================
export function LogViewer({
  height = DEFAULT_LIST_HEIGHT,
  pageSize = 50,
  autoScroll = true,
  filter,
  onEntryClick,
}: LogViewerProps) {
  const listRef = useRef<FixedSizeList>(null);
  const itemsRenderedRef = useRef<ListOnItemsRenderedProps | null>(null);
  const autoScrollRef = useRef(autoScroll);
  autoScrollRef.current = autoScroll;

  // Paginowany stan logów przez IPC
  const {
    entries,
    loading,
    hasMore,
    error,
    sentinelRef,
    totalLoaded,
  } = usePaginatedIPC({ pageSize, initialLoad: true });

  // ============================================================
  // Filtrowanie — useMemo dla stabilności
  // ============================================================
  const filteredEntries = useMemo(() => {
    if (!filter || !filter.trim()) return entries;
    const lower = filter.toLowerCase();
    return entries.filter(e => {
      const payloadStr = typeof e.payload === 'object'
        ? JSON.stringify(e.payload)
        : String(e.payload ?? '');
      return payloadStr.toLowerCase().includes(lower) || e.id.toLowerCase().includes(lower);
    });
  }, [entries, filter]);

  // ============================================================
  // Auto-scroll do dołu gdy nowe logi
  // ============================================================
  const prevLengthRef = useRef(0);
  useEffect(() => {
    if (autoScrollRef.current && filteredEntries.length > prevLengthRef.current) {
      // Scroll to bottom po dodaniu nowych logów
      requestAnimationFrame(() => {
        if (listRef.current) {
          listRef.current.scrollToItem(filteredEntries.length - 1, 'smart');
        }
      });
    }
    prevLengthRef.current = filteredEntries.length;
  }, [filteredEntries.length]);

  // ============================================================
  // itemsRendered — callback z react-window
  // ============================================================
  const handleItemsRendered = useCallback((props: ListOnItemsRenderedProps) => {
    itemsRenderedRef.current = props;
  }, []);

  // ============================================================
  // Row renderer — react-window wymaga komponentu z ListChildComponentProps
  // ============================================================
  const Row = useCallback(
    ({ index, style }: ListChildComponentProps) => {
      const entry = filteredEntries[index];
      if (!entry) return <div style={style} />;
      return <LogItemRow entry={entry} style={style} onClick={onEntryClick} />;
    },
    [filteredEntries, onEntryClick]
  );

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="log-viewer-container" style={{ height }}>
      {/* Nagłówek z licznikiem */}
      <div className="log-viewer-header">
        <span className="log-viewer-title">Agent Logs</span>
        <span className="log-viewer-count">
          {totalLoaded} loaded
          {loading && ' (loading...)'}
          {!hasMore && ' • all loaded'}
        </span>
        {error && <span className="log-viewer-error">{error}</span>}
      </div>

      {/* Virtual Lista */}
      <div className="log-viewer-list-wrapper">
        {filteredEntries.length === 0 && !loading ? (
          <div className="log-viewer-empty">
            {error ? 'Error loading logs' : 'No log entries yet'}
          </div>
        ) : (
          <FixedSizeList
            ref={listRef}
            height={height - 40} // minus header height
            itemCount={filteredEntries.length}
            itemSize={LOG_ITEM_HEIGHT}
            width="100%"
            overscanCount={OVERSCAN_COUNT}
            onItemsRendered={handleItemsRendered}
            innerElementType={InnerElementType}
          >
            {Row}
          </FixedSizeList>
        )}

        {/* Sentinel do IntersectionObserver — 200px przed końcem */}
        <div
          ref={sentinelRef}
          className="log-viewer-sentinel"
          style={{ height: 1 }}
        />
      </div>
    </div>
  );
}

// ==============================================================
// Throttle utility — używany przez hook do batchowania logów
// ==============================================================
export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  delayMs: number
): T & { cancel: () => void } {
  let lastCall = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const throttled = function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    const remaining = delayMs - (now - lastCall);

    lastArgs = args;

    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      lastCall = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastCall = Date.now();
        timer = null;
        if (lastArgs) {
          fn.apply(this, lastArgs);
          lastArgs = null;
        }
      }, remaining);
    }
  };

  throttled.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    lastArgs = null;
  };

  return throttled as unknown as T & { cancel: () => void };
}
