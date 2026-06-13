// ============================================================================
// NEXUS — KeyDir Panel (#8)
// Lista skrótów klawiszowych + konfiguracja custom skrótów
// ============================================================================

import React, { useState, useMemo } from 'react';
import { X, Pencil, RotateCcw } from 'lucide-react';
import { useKeydirStore, KeyBinding } from '../renderer/store/keydirStore';

export function KeyDirPanel() {
  const { showPanel, closePanel, bindings, overrides, setOverride, removeOverride } = useKeydirStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [filter, setFilter] = useState('');

  const grouped = useMemo(() => {
    const map = new Map<string, KeyBinding[]>();
    for (const b of bindings) {
      const ctx = b.context === '*' ? 'Globalne' : b.context;
      const arr = map.get(ctx) || [];
      arr.push(b);
      map.set(ctx, arr);
    }
    return Array.from(map.entries());
  }, [bindings]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return grouped;
    const q = filter.toLowerCase();
    return grouped
      .map(([ctx, bindings]) => [ctx, bindings.filter(b => b.label.toLowerCase().includes(q) || b.keys.toLowerCase().includes(q))] as [string, KeyBinding[]])
      .filter(([, bs]) => bs.length > 0);
  }, [grouped, filter]);

  if (!showPanel) return null;

  const handleStartRecord = (id: string) => {
    setEditingId(id);
    setRecording(true);
  };

  const handleKeyCapture = (e: React.KeyboardEvent) => {
    if (!recording || !editingId) return;
    e.preventDefault();
    e.stopPropagation();

    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      parts.push(key);
    }
    if (parts.length > 0) {
      const combo = parts.join('+');
      setOverride(editingId, combo);
      setEditingId(null);
      setRecording(false);
    }
  };

  const getEffectiveKeys = (binding: KeyBinding): string => {
    const override = overrides.find(o => o.actionId === binding.id);
    return override?.keys || binding.keys;
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={closePanel} tabIndex={-1} onKeyDown={(e) => { if (e.key === 'Escape') closePanel(); }}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-xl bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl shadow-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgb(var(--border))]">
          <div className="flex items-center gap-3 flex-1">
            <h2 className="text-[14px] font-semibold text-[rgb(var(--text-main))]">Skróty klawiszowe</h2>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtruj..."
              className="w-36 bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded px-2 py-1 text-[11px] text-[rgb(var(--text-main))] placeholder:text-[rgb(var(--text-muted))] outline-none focus:border-[rgb(var(--accent))]"
              autoFocus
            />
          </div>
          <button onClick={closePanel} className="p-1 rounded-lg hover:bg-[rgb(var(--border))]/50 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-2" onKeyDown={handleKeyCapture} tabIndex={0} role="application">
          {recording && (
            <div className="mx-4 mb-3 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[12px] text-amber-400 text-center">
              Naciśnij kombinację klawiszy...
            </div>
          )}

          {filtered.map(([context, bindings]) => (
            <div key={context}>
              <div className="px-4 py-1.5 text-[10px] font-medium text-[rgb(var(--text-muted))] uppercase tracking-wider">
                {context}
              </div>
              {bindings.map((b) => {
                const effectiveKeys = getEffectiveKeys(b);
                const isOverridden = overrides.some(o => o.actionId === b.id);
                return (
                  <div key={b.id} className="flex items-center gap-3 px-4 py-2 hover:bg-[rgb(var(--border))]/30 group">
                    <span className="flex-1 text-[13px] text-[rgb(var(--text-main))]">{b.label}</span>
                    <span className="flex items-center gap-1">
                      {editingId === b.id ? (
                        <span className="text-[11px] text-amber-400 animate-pulse">...nagrywanie</span>
                      ) : (
                        <kbd className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                          isOverridden
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : 'bg-[rgb(var(--background))] text-[rgb(var(--text-muted))] border-[rgb(var(--border))]'
                        }`}>
                          {effectiveKeys}
                        </kbd>
                      )}
                      {isOverridden && (
                        <button
                          onClick={() => removeOverride(b.id)}
                          className="p-0.5 text-[rgb(var(--text-muted))] hover:text-red-400 opacity-0 group-hover:opacity-100 cursor-pointer"
                          title="Przywróć domyślny"
                        >
                          <RotateCcw size={10} />
                        </button>
                      )}
                    </span>
                    <button
                      onClick={() => handleStartRecord(b.id)}
                      className="p-1 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--accent))] opacity-0 group-hover:opacity-100 cursor-pointer"
                      title="Zmień skrót"
                    >
                      <Pencil size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[rgb(var(--border))] flex items-center justify-between text-[10px] text-[rgb(var(--text-muted))]">
          <span>{bindings.length} skrótów</span>
          <span><Pencil className="w-3 h-3 inline mr-1" />Kliknij by zmienić skrót</span>
        </div>
      </div>
    </div>
  );
}
