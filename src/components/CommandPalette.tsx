// ============================================================================
// NEXUS — CommandPalette (#12)
// Ctrl+K overlay: search + fuzzy + kategorie + shortcut info
// ============================================================================

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Search, Hash, ArrowRight, AlertTriangle, Compass, FileText, CheckSquare, PenTool, Bot, GitBranch, Zap, BookOpen, BarChart, Wrench, Settings } from 'lucide-react';
import { useCommandStore } from '../renderer/store/commandStore';
import type { Command } from '../renderer/store/commandStore';

// === Fuzzy match — prosty algorytm, bez zewnętrznej biblioteki =============
function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let qi = 0;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

function scoreMatch(label: string, category: string, keywords: string[], query: string): number {
  const q = query.toLowerCase();
  let score = 0;
  if (label.toLowerCase().startsWith(q)) score += 10;
  if (label.toLowerCase().includes(q)) score += 5;
  if (category.toLowerCase().includes(q)) score += 3;
  for (const kw of keywords) {
    if (kw.toLowerCase().includes(q)) score += 2;
  }
  return score;
}

// === Category icons =========================================================
const categoryIcons: Record<string, React.ReactNode> = {
  Nawigacja: <Compass className="w-3.5 h-3.5" />,
  Notatki: <FileText className="w-3.5 h-3.5" />,
  Taski: <CheckSquare className="w-3.5 h-3.5" />,
  Pisanie: <PenTool className="w-3.5 h-3.5" />,
  Agenci: <Bot className="w-3.5 h-3.5" />,
  Pipeline: <GitBranch className="w-3.5 h-3.5" />,
  Workflows: <Zap className="w-3.5 h-3.5" />,
  Wiki: <BookOpen className="w-3.5 h-3.5" />,
  Diff: <BarChart className="w-3.5 h-3.5" />,
  Git: <Wrench className="w-3.5 h-3.5" />,
  Akcje: <Settings className="w-3.5 h-3.5" />,
};

// === Confirm modal ===========================================================
function ConfirmDialog({
  command,
  onConfirm,
  onCancel,
}: {
  command: Command;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 rounded-xl"
      onClick={onCancel}
    >
      <div
        className="bg-[rgb(var(--panel))] border border-red-500/40 rounded-xl p-6 shadow-2xl max-w-sm mx-4 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h3 className="text-[14px] font-semibold text-[rgb(var(--text-main))] mb-2">
          {command.label}
        </h3>
        <p className="text-[12px] text-[rgb(var(--text-muted))] mb-4">
          Czy na pewno chcesz wykonać tę akcję?
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-[12px] font-medium bg-[rgb(var(--border))] text-[rgb(var(--text-main))] rounded-lg hover:bg-[rgb(var(--border))]/80 transition-colors cursor-pointer"
          >
            Anuluj
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-[12px] font-medium bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors cursor-pointer"
          >
            Wykonaj
          </button>
        </div>
      </div>
    </div>
  );
}

// === Main component ==========================================================
export function CommandPalette() {
  const { commands, paletteOpen, closePalette, executeCommand } = useCommandStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dangerCmd, setDangerCmd] = useState<Command | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset when opened
  useEffect(() => {
    if (paletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setDangerCmd(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [paletteOpen]);

  // Filter & sort commands
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.trim();
    return commands
      .filter((c) => fuzzyMatch(c.label, q) || fuzzyMatch(c.category, q) || c.keywords.some((k) => fuzzyMatch(k, q)))
      .sort((a, b) => scoreMatch(b.label, b.category, b.keywords, q) - scoreMatch(a.label, a.category, a.keywords, q));
  }, [commands, query]);

  // Clamp selected index
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, selectedIndex]);

  // Scroll into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleSelect = useCallback(
    (cmd: Command) => {
      if (cmd.dangerous) {
        setDangerCmd(cmd);
      } else {
        executeCommand(cmd.id);
      }
    },
    [executeCommand],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (dangerCmd) {
          setDangerCmd(null);
          return;
        }
        closePalette();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault();
        handleSelect(filtered[selectedIndex]);
        return;
      }
    },
    [filtered, selectedIndex, handleSelect, closePalette, dangerCmd],
  );

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, Command[]>();
    for (const cmd of filtered) {
      const arr = map.get(cmd.category) || [];
      arr.push(cmd);
      map.set(cmd.category, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  if (!paletteOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]"
      onClick={closePalette}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Dialog */}
      <div
        className="relative w-full max-w-lg bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[rgb(var(--border))]">
          <Search className="w-4 h-4 text-[rgb(var(--text-muted))] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Szukaj komendy..."
            className="flex-1 bg-transparent border-none outline-none text-[14px] text-[rgb(var(--text-main))] placeholder:text-[rgb(var(--text-muted))]"
          />
          <kbd className="text-[10px] text-[rgb(var(--text-muted))] bg-[rgb(var(--background))] px-1.5 py-0.5 rounded border border-[rgb(var(--border))]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto custom-scrollbar py-2">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-[13px] text-[rgb(var(--text-muted))]">
                Brak wyników dla "<strong>{query}</strong>"
              </p>
              <p className="text-[11px] text-[rgb(var(--text-muted))]/60 mt-1">
                Spróbuj innego zapytania
              </p>
            </div>
          )}

          {grouped.map(([category, cmds]) => (
            <div key={category}>
              <div className="flex items-center gap-2 px-4 py-1.5 text-[10px] font-medium text-[rgb(var(--text-muted))] uppercase tracking-wider">
                <span>{categoryIcons[category] || <Hash className="w-3.5 h-3.5" />}</span>
                <span>{category}</span>
              </div>
              {cmds.map((cmd) => {
                const idx = filtered.indexOf(cmd);
                return (
                  <button
                    key={cmd.id}
                    onClick={() => handleSelect(cmd)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${
                      idx === selectedIndex
                        ? 'bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))]'
                        : 'text-[rgb(var(--text-main))] hover:bg-[rgb(var(--border))]/50'
                    }`}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="text-[13px] font-medium block truncate">
                        {cmd.dangerous && (
                          <AlertTriangle className="w-3.5 h-3.5 inline text-red-400 mr-1" />
                        )}
                        {cmd.label}
                      </span>
                      {cmd.shortcut && (
                        <span className="text-[10px] text-[rgb(var(--text-muted))]">
                          <kbd className="bg-[rgb(var(--background))] px-1 rounded border border-[rgb(var(--border))]">
                            {cmd.shortcut}
                          </kbd>
                        </span>
                      )}
                    </span>
                    <ArrowRight
                      className={`w-3.5 h-3.5 shrink-0 ${
                        idx === selectedIndex ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[rgb(var(--border))] flex items-center gap-4 text-[10px] text-[rgb(var(--text-muted))]">
          <span>↑↓ nawiguj</span>
          <span>↵ wykonaj</span>
          <span>Esc zamknij</span>
        </div>

        {/* Danger confirm overlay */}
        {dangerCmd && (
          <ConfirmDialog
            command={dangerCmd}
            onConfirm={() => {
              executeCommand(dangerCmd.id);
              setDangerCmd(null);
            }}
            onCancel={() => setDangerCmd(null)}
          />
        )}
      </div>
    </div>
  );
}
