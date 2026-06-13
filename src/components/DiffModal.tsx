// ============================================================================
// NEXUS — DiffModal (#5)
// Modal overlay z DiffViewer — do integracji z wszystkimi widokami
// ============================================================================

import React, { useMemo } from 'react';
import { DiffViewer } from './DiffViewer';
import { EntitySnapshot } from '../utils/diffEngine';
import { X } from 'lucide-react';

interface DiffModalProps {
  open: boolean;
  onClose: () => void;
  /** Nazwa encji (np. tytuł notatki) */
  title: string;
  /** Aktualna zawartość */
  currentContent: string;
  /** Historyczne snapshoty (od najnowszych) */
  snapshots: EntitySnapshot[];
  /** Callback do przywrócenia wersji */
  onRevert?: (snapshot: EntitySnapshot) => void;
}

export function DiffModal({
  open,
  onClose,
  title,
  currentContent,
  snapshots,
  onRevert,
}: DiffModalProps) {
  const latestSnapshot = snapshots[0];

  // Obsługa cofania — przywraca zawartość snapshotu jako starą wersję
  const handleRevert = useMemo(() => {
    if (!onRevert || !latestSnapshot) return undefined;
    return () => onRevert(latestSnapshot);
  }, [onRevert, latestSnapshot]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[rgb(var(--background))]">
      {/* Close button bar */}
      <div className="absolute top-3 right-3 z-10">
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-[rgb(var(--border))]/50 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>

      {latestSnapshot ? (
        <DiffViewer
          oldTitle={`v${latestSnapshot.version}: ${title}`}
          newTitle="Obecna wersja"
          oldText={latestSnapshot.content}
          newText={currentContent}
          oldTimestamp={latestSnapshot.timestamp}
          newTimestamp={new Date().toISOString()}
          onRevert={handleRevert}
          onClose={onClose}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-[rgb(var(--text-muted))]">
          <div className="text-center">
            <p className="text-sm">Brak poprzednich wersji do porównania.</p>
          </div>
        </div>
      )}
    </div>
  );
}
