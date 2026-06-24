// ============================================================================
// NEXUS — FeedbackPanel (#26)
// Lista feedbackow (pomysly i problemy) z podgladem kontekstu,
// filtrowaniem i przyciskiem do AI analizy.
// ============================================================================

import React, { useState, useMemo } from "react";
import { Lightbulb, Bug, Trash2, Check, X, Search } from "lucide-react";
import { FeedbackEntry } from "../types";

interface FeedbackPanelProps {
  feedback: FeedbackEntry[];
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: FeedbackEntry['status']) => void;
}

function viewLabel(mode?: string): string {
  const labels: Record<string, string> = {
    nexus: 'Mapa mysli',
    'lab-todo': 'Zadania',
    'lab-writing': 'Pisanie',
    sandbox: 'Baza Wiedzy',
    agents: 'Panel agentow',
    changes: 'Zmiany',
    wiki: 'Wiki',
    git: 'Git',
    feedback: 'Feedback',
  };
  return (mode && labels[mode]) || mode || 'nieznany';
}

export function FeedbackPanel({
  feedback,
  onDelete,
  onStatusChange,
}: FeedbackPanelProps) {
  const [filter, setFilter] = useState<'all' | 'idea' | 'problem'>('all');
  const [statusFilter, setStatusFilter] = useState<FeedbackEntry['status'] | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    return feedback.filter(entry => {
      if (filter !== 'all' && entry.feedbackType !== filter) return false;
      if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          entry.title.toLowerCase().includes(q) ||
          entry.context?.toLowerCase().includes(q)
        );
      }
      return true;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [feedback, filter, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const ideas = feedback.filter(e => e.feedbackType === 'idea').length;
    const problems = feedback.filter(e => e.feedbackType === 'problem').length;
    const unread = feedback.filter(e => e.status === 'new').length;
    return { ideas, problems, unread, total: feedback.length };
  }, [feedback]);

  const statusBadge = (status: FeedbackEntry['status']) => {
    const map: Record<FeedbackEntry['status'], { color: string; label: string }> = {
      'new': { color: 'text-blue-400 bg-blue-500/10 border-blue-500/30', label: 'Nowy' },
      'read': { color: 'text-[rgb(var(--text-muted))] bg-[rgb(var(--border))]/30 border-[rgb(var(--border))]', label: 'Przeczytany' },
      'in-progress': { color: 'text-amber-400 bg-amber-500/10 border-amber-500/30', label: 'W trakcie' },
      'done': { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', label: 'Zrobione' },
    };
    const s = map[status];
    return (
      <span className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border ${s.color}`}>
        {s.label}
      </span>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[rgb(var(--border))]">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold">Feedback</h1>
          <div className="flex items-center gap-3 text-[11px] text-[rgb(var(--text-muted))]">
            <span className="flex items-center gap-1">
              <Lightbulb size={12} className="text-[rgb(var(--accent))]" />
              {stats.ideas}
            </span>
            <span className="flex items-center gap-1">
              <Bug size={12} className="text-red-400" />
              {stats.problems}
            </span>
            <span className="w-px h-3 bg-[rgb(var(--border))]" />
            <span className={stats.unread > 0 ? 'text-blue-400 font-medium' : ''}>
              {stats.unread} nieprzeczytanych
            </span>
            <span className="text-[rgb(var(--text-tertiary))]">({stats.total})</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--text-muted))]" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj w feedbacku..."
            className="w-full pl-9 pr-3 py-1.5 text-[13px] bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text-main))] placeholder:text-[rgb(var(--text-muted))] focus:outline-none focus:border-[rgb(var(--text-secondary))] transition-colors"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <div className="flex bg-[rgb(var(--background))] rounded-lg p-0.5 border border-[rgb(var(--border))]">
            {(['all', 'idea', 'problem'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                  filter === f
                    ? 'bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))]'
                    : 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))]'
                }`}
              >
                {f === 'all' ? 'Wszystkie' : f === 'idea' ? 'Pomysly' : 'Problemy'}
              </button>
            ))}
          </div>

          <div className="flex bg-[rgb(var(--background))] rounded-lg p-0.5 border border-[rgb(var(--border))]">
            {(['all', 'new', 'read', 'in-progress', 'done'] as const).map(s => {
              const labels: Record<string, string> = {
                all: 'Wszystkie', new: 'Nowy', read: 'Przeczytany',
                'in-progress': 'W trakcie', done: 'Zrobione'
              };
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                    statusFilter === s
                      ? 'bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))]'
                      : 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))]'
                  }`}
                >
                  {labels[s]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-[rgb(var(--text-muted))]">
            {feedback.length === 0
              ? 'Brak feedbacku. Kliknij przycisk w prawym dolnym rogu, aby dodac.'
              : 'Brak wynikow dla wybranych filtrow.'}
          </div>
        ) : (
          <div className="divide-y divide-[rgb(var(--border))]">
            {filtered.map(entry => (
              <div
                key={entry.id}
                className={`px-6 py-3 hover:bg-[rgb(var(--background))]/20 transition-colors ${
                  entry.status === 'new' ? 'bg-[rgb(var(--accent))]/[0.02]' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Type icon */}
                  <div className={`mt-0.5 ${entry.feedbackType === 'idea' ? 'text-[rgb(var(--accent))]' : 'text-red-400'}`}>
                    {entry.feedbackType === 'idea' ? <Lightbulb size={16} /> : <Bug size={16} />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[13px] font-medium truncate">{entry.title}</span>
                      {statusBadge(entry.status)}
                    </div>

                    <p className="text-[11px] text-[rgb(var(--text-secondary))] leading-relaxed line-clamp-3 mb-1">
                      {entry.context}
                    </p>

                    {entry.contextSnapshot && (
                      <div className="text-[10px] font-mono text-[rgb(var(--text-tertiary))]">
                        {viewLabel(entry.contextSnapshot.viewMode)}
                        {entry.contextSnapshot.projectId && ` / ${entry.contextSnapshot.projectId}`}
                      </div>
                    )}

                    <div className="text-[10px] font-mono text-[rgb(var(--text-tertiary))] mt-1">
                      {new Date(entry.timestamp).toLocaleString('pl-PL')}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    {entry.status !== 'done' && (
                      <button
                        onClick={() => onStatusChange(entry.id, 'done')}
                        className="p-1.5 text-[rgb(var(--text-muted))] hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Oznacz jako zrobione"
                      >
                        <Check size={14} />
                      </button>
                    )}
                    {entry.status === 'new' && (
                      <button
                        onClick={() => onStatusChange(entry.id, 'read')}
                        className="p-1.5 text-[rgb(var(--text-muted))] hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Oznacz jako przeczytane"
                      >
                        <X size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(entry.id)}
                      className="p-1.5 text-[rgb(var(--text-muted))] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Usun"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
