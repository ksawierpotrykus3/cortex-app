// ============================================================================
// NEXUS — Agent History Panel (F6.3)
// Modal 80% szerokości z historią outputów agenta — paginacja, filtry, akcje
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, RotateCcw, Trash2, Search, CheckCircle, XCircle, Clock, Zap, AlertCircle } from 'lucide-react';
import { AgentOutput } from '../../../shared/types/schema';
import { useFocusTrap } from '../../../hooks/useFocusTrap';

// === Props =================================================================
interface AgentHistoryPanelProps {
  agentId: string;
  agentName: string;
  onClose: () => void;
}

// === Constants =============================================================
const PAGE_SIZE = 50;

// === Component =============================================================
export function AgentHistoryPanel({ agentId, agentName, onClose }: AgentHistoryPanelProps) {
  const [outputs, setOutputs] = useState<AgentOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [filterApproved, setFilterApproved] = useState<'all' | 'approved' | 'rejected' | 'pending'>('all');
  const [filterRating, setFilterRating] = useState<'all' | 'low' | 'mid' | 'high'>('all');
  const [stats, setStats] = useState<{ total: number; avgTokens: number; avgExecutionMs: number; errorRate: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const modalRef = useFocusTrap(agentId !== null);

  // Load first page
  useEffect(() => {
    loadPage(0, true);
    loadStats();
  }, [agentId]);

  const loadStats = async () => {
    const bridge = window.nexusBridge;
    if (!bridge?.getOutputStats) return;
    try {
      const s = await bridge.getOutputStats({ agentId });
      setStats(s);
    } catch (e) { console.warn('[AgentHistoryPanel] Failed to load stats', e); }
  };

  const loadPage = async (p: number, reset = false) => {
    const bridge = window.nexusBridge;
    if (!bridge?.getOutputs) return;
    setLoading(true);
    try {
      const results = await bridge.getOutputs({ agentId, limit: PAGE_SIZE, offset: p * PAGE_SIZE });
      if (reset) {
        setOutputs(results);
      } else {
        setOutputs(prev => [...prev, ...results]);
      }
      setHasMore(results.length >= PAGE_SIZE);
      setPage(p);
    } catch (err) {
      console.error('[AgentHistoryPanel] Failed to load outputs:', err);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const bridge = window.nexusBridge;
    if (!bridge?.deleteOutput) return;
    await bridge.deleteOutput({ id });
    setOutputs(prev => prev.filter(o => o.id !== id));
  };

  const handleClear = async () => {
    const bridge = window.nexusBridge;
    if (!bridge?.clearOutputs) return;
    await bridge.clearOutputs({ agentId });
    setOutputs([]);
    setStats(null);
  };

  const handleReRun = async (context?: string) => {
    const bridge = window.nexusBridge;
    if (!bridge?.executeAgent) return;
    await bridge.executeAgent({ id: agentId, context });
  };

  // Infinite scroll
  const handleScroll = useCallback(() => {
    if (!containerRef.current || loading || !hasMore) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    if (scrollHeight - scrollTop - clientHeight < 200) {
      loadPage(page + 1);
    }
  }, [page, loading, hasMore]);

  // Filters
  const filtered = outputs.filter(o => {
    if (search) {
      const q = search.toLowerCase();
      if (!o.content?.toLowerCase().includes(q) && !o.error?.toLowerCase().includes(q) && !o.agentName?.toLowerCase().includes(q)) return false;
    }
    if (filterApproved === 'approved' && o.approved !== true) return false;
    if (filterApproved === 'rejected' && o.approved !== false) return false;
    if (filterApproved === 'pending' && o.approved !== null) return false;
    if (filterRating === 'low' && (o.rating < 0 || o.rating > 3)) return false;
    if (filterRating === 'mid' && (o.rating < 4 || o.rating > 7)) return false;
    if (filterRating === 'high' && (o.rating < 8 || o.rating > 10)) return false;
    return true;
  });

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div ref={modalRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Historia: ${agentName}`}
        className="bg-[rgb(var(--bg-elevated))] border border-[rgb(var(--border))] rounded-xl w-11/12 h-[90%] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[rgb(var(--border))] flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-[rgb(var(--text))]">
              Historia: {agentName}
            </h2>
            {stats && (
              <div className="flex items-center gap-3 mt-1 text-[10px] text-[rgb(var(--text-secondary))]">
                <span>Łącznie: {stats.total}</span>
                <span>Śr. tokenów: {stats.avgTokens}</span>
                <span>Śr. czas: {(stats.avgExecutionMs / 1000).toFixed(1)}s</span>
                <span className={stats.errorRate > 0.1 ? 'text-red-400' : ''}>
                  Błędy: {(stats.errorRate * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>
          <button onClick={onClose} aria-label="Zamknij" className="p-1.5 rounded-lg text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text))] hover:bg-[rgb(var(--border))]/50 transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-[rgb(var(--border))]/50 flex items-center gap-3 shrink-0">
          <div className="flex-1 relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--text-secondary))]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Szukaj w outputach..."
              className="w-full pl-9 pr-3 py-1.5 text-[12px] bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text))] placeholder:text-[rgb(var(--text-secondary))] outline-none focus:border-[rgb(var(--accent))]/50"
            />
          </div>
          <select
            value={filterApproved}
            onChange={e => setFilterApproved(e.target.value as any)}
            className="px-2 py-1.5 text-[11px] bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text-secondary))] outline-none"
          >
            <option value="all">Wszystkie statusy</option>
            <option value="approved">Zatwierdzone</option>
            <option value="rejected">Odrzucone</option>
            <option value="pending">Bez oceny</option>
          </select>
          <select
            value={filterRating}
            onChange={e => setFilterRating(e.target.value as any)}
            className="px-2 py-1.5 text-[11px] bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text-secondary))] outline-none"
          >
            <option value="all">Wszystkie oceny</option>
            <option value="low">0-3</option>
            <option value="mid">4-7</option>
            <option value="high">8-10</option>
          </select>
          {outputs.length > 0 && (
            <button
              onClick={handleClear}
              aria-label="Wyczyść historię"
              className="px-2 py-1.5 text-[11px] text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              Wyczyść
            </button>
          )}
        </div>

        {/* Output List */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto custom-scrollbar"
        >
          {filtered.length === 0 && !loading && (
            <div className="p-12 text-center">
              <Clock className="w-10 h-10 mx-auto mb-3 text-[rgb(var(--text-secondary))] opacity-30" />
              <p className="text-[13px] text-[rgb(var(--text-secondary))] opacity-50">
                {search || filterApproved !== 'all' || filterRating !== 'all'
                  ? 'Brak wyników dla wybranych filtrów'
                  : 'Brak outputów dla tego agenta'}
              </p>
              <p className="text-[11px] text-[rgb(var(--text-secondary))] opacity-30 mt-1">
                Uruchom agenta aby zobaczyć historię
              </p>
            </div>
          )}
          {filtered.map((output) => (
            <div
              key={output.id}
              className="px-6 py-3 border-b border-[rgb(var(--border))]/30 hover:bg-[rgb(var(--bg-surface))]/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Meta row */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-[rgb(var(--text-secondary))]">{formatTime(output.createdAt)}</span>
                    <span className="text-[10px] text-[rgb(var(--text-secondary))] opacity-50">|</span>
                    <span className="text-[10px] text-[rgb(var(--text-secondary))]">{output.modelName}</span>
                    <span className="text-[10px] text-[rgb(var(--text-secondary))] opacity-50">|</span>
                    <span className="text-[10px] text-[rgb(var(--text-secondary))]">{output.tokensUsed} tokenów</span>
                    <span className="text-[10px] text-[rgb(var(--text-secondary))] opacity-50">|</span>
                    <span className="text-[10px] text-[rgb(var(--text-secondary))]">{(output.executionMs / 1000).toFixed(1)}s</span>
                    {output.approved === true && <CheckCircle className="w-3 h-3 text-green-400" />}
                    {output.approved === false && <XCircle className="w-3 h-3 text-red-400" />}
                    {output.error && <span title={output.error}><AlertCircle className="w-3 h-3 text-red-400" /></span>}
                  </div>
                  {/* Content preview */}
                  <p className="text-[12px] text-[rgb(var(--text))] line-clamp-2 font-mono">
                    {output.content?.slice(0, 200) || '(brak treści)'}
                  </p>
                  {output.error && (
                    <p className="text-[11px] text-red-400 mt-1 truncate">{output.error}</p>
                  )}
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleReRun(output.content)}
                    aria-label="Wyślij ponownie"
                    className="p-1.5 rounded text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--accent))] hover:bg-[rgb(var(--border))]/50 transition-colors cursor-pointer"
                    title="Wyślij ponownie"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDelete(output.id)}
                    aria-label="Usuń"
                    className="p-1.5 rounded text-[rgb(var(--text-secondary))] hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
                    title="Usuń"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="p-4 text-center">
              <div className="w-5 h-5 border-2 border-[rgb(var(--accent))] border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-2 border-t border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))]/30 flex items-center justify-between shrink-0">
          <span className="text-[10px] text-[rgb(var(--text-secondary))]">
            Pokazano {filtered.length} z {stats?.total || outputs.length} outputów
          </span>
          <button
            onClick={() => handleReRun()}
            aria-label="Uruchom agenta"
            className="px-3 py-1.5 text-[11px] font-medium bg-[rgb(var(--accent))]/20 text-[rgb(var(--accent))] rounded-lg hover:bg-[rgb(var(--accent))]/30 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Zap className="w-3 h-3" />
            Uruchom agenta
          </button>
        </div>
      </div>
    </div>
  );
}
