// ============================================================================
// NEXUS — KeyboardShortcuts
// Overlay z listą skrótów klawiszowych, wywoływany przez klawisz `?`
// ============================================================================

import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface KeyboardShortcutsProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { category: 'Nawigacja', keys: [
    { combo: 'Ctrl+1-6', desc: 'Przełącz widok (Nexus, Pisanie, Zadania, Zmiany, Wiki, Pipeline)' },
    { combo: 'Ctrl+Tab', desc: 'Następny widok' },
    { combo: 'Ctrl+Shift+Tab', desc: 'Poprzedni widok' },
    { combo: '?', desc: 'Pokaż skróty klawiszowe' },
  ]},
  { category: 'Edycja', keys: [
    { combo: 'Ctrl+N', desc: 'Nowa notatka' },
    { combo: 'Ctrl+Shift+N', desc: 'Nowy projekt' },
    { combo: 'Ctrl+Z', desc: 'Cofnij' },
    { combo: 'Ctrl+Shift+Z', desc: 'Ponów' },
    { combo: 'Ctrl+S', desc: 'Zapisz' },
    { combo: 'Ctrl+A', desc: 'Zaznacz wszystko na mapie' },
    { combo: 'Delete / Backspace', desc: 'Usuń zaznaczone notatki' },
  ]},
  { category: 'Widok mapy (Nexus)', keys: [
    { combo: 'Ctrl+Scroll', desc: 'Zoom' },
    { combo: 'Ctrl+0', desc: 'Reset zoomu' },
    { combo: 'Ctrl+F', desc: 'Szukaj / Glob filter' },
    { combo: 'Ctrl+klik', desc: 'Zaznacz wiele notatek' },
    { combo: 'Shift+klik', desc: 'Zaznacz zakres' },
    { combo: 'Przeciągnij', desc: 'Przesuń notatkę / płótno (tło)' },
  ]},
  { category: 'Panele', keys: [
    { combo: 'Ctrl+B', desc: 'Lewy sidebar (projekty)' },
    { combo: 'Ctrl+J', desc: 'Prawy panel' },
    { combo: 'Ctrl+K', desc: 'Command Palette' },
    { combo: 'Ctrl+T', desc: 'Tagowanie notatek' },
    { combo: 'Ctrl+,', desc: 'Ustawienia' },
    { combo: 'Ctrl+E', desc: 'Eksport' },
  ]},
  { category: 'Akcje', keys: [
    { combo: 'Ctrl+Enter', desc: 'Uruchom pipeline / workflow' },
    { combo: 'Ctrl+Shift+D', desc: 'Dry-Run' },
    { combo: 'Ctrl+Shift+K', desc: 'Kill Switch (zamroź agenty)' },
    { combo: 'Ctrl+L', desc: 'Toggle changelog' },
    { combo: 'Ctrl+P', desc: 'Przełącz tryb sandbox' },
  ]},
];

export function KeyboardShortcuts({ open, onClose }: KeyboardShortcutsProps) {
  const focusTrapRef = useFocusTrap(open);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Skróty klawiszowe"
        className="relative w-full max-w-2xl bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-xl shadow-2xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgb(var(--border))]">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-[rgb(var(--accent))]" />
            <h2 className="text-[14px] font-semibold text-[rgb(var(--text-main))]">
              Skróty klawiszowe
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Zamknij"
            className="p-1.5 rounded-lg text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:bg-[rgb(var(--bg-elevated))] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-4 px-5 space-y-5">
          {SHORTCUTS.map(cat => (
            <div key={cat.category}>
              <h3 className="text-[10px] font-semibold text-[rgb(var(--accent))] uppercase tracking-wider mb-2">
                {cat.category}
              </h3>
              <div className="space-y-1">
                {cat.keys.map(k => (
                  <div
                    key={k.combo}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[rgb(var(--bg-elevated))] transition-colors"
                  >
                    <span className="text-[12px] text-[rgb(var(--text-secondary))]">
                      {k.desc}
                    </span>
                    <kbd className="text-[10px] font-mono bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded px-1.5 py-0.5 text-[rgb(var(--text-main))]">
                      {k.combo}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[rgb(var(--border))] text-[10px] text-[rgb(var(--text-muted))] text-center">
          Naciśnij <kbd className="bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded px-1.5 py-0.5 font-mono">?</kbd> aby ponownie otworzyć
        </div>
      </div>
    </div>
  );
}
