// ============================================================================
// NEXUS — HistoryButton (#5)
// Przycisk "Pokaż zmiany" — otwiera DiffModal dla encji
// ============================================================================

import React from 'react';
import { History } from 'lucide-react';
import { useDiffStore } from '../renderer/store/diffStore';
import { EntitySnapshot } from '../utils/diffEngine';

interface HistoryButtonProps {
  entityId: string;
  entityType: EntitySnapshot['entityType'];
  title: string;
  content: string;
  /** Opcjonalna dodatkowa klasa CSS */
  className?: string;
}

export function HistoryButton({
  entityId,
  entityType,
  title,
  content,
  className = '',
}: HistoryButtonProps) {
  const openDiff = useDiffStore((s) => s.openDiff);
  const hasSnapshot = useDiffStore((s) => s.hasSnapshot(entityId));

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        openDiff({
          entityId,
          entityType,
          title,
          currentContent: content,
        });
      }}
      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
        hasSnapshot
          ? 'text-amber-400 hover:bg-amber-500/10 border border-amber-500/30'
          : 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:bg-[rgb(var(--border))] border border-transparent'
      } ${className}`}
      title={hasSnapshot ? 'Pokaż historię zmian' : 'Brak historii zmian'}
    >
      <History size={12} />
      <span>Zmiany</span>
    </button>
  );
}
