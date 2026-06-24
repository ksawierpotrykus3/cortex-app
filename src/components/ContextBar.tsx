// ============================================================================
// NEXUS — ContextBar
// Pasek kontekstu — pokazuje co system widzi.
// Uzywany w FloatingAgentPanel, FeedbackModal — wszedzie ten sam.
// ============================================================================

import React from 'react';
import { Eye, Scissors, ClipboardList, FileText, GitBranch, Users, Settings } from 'lucide-react';
import { TrackerState } from '../hooks/useContextTracker';

interface ContextBarProps {
  tracker: TrackerState;
}

/** Ikona dla kazdego widoku */
function viewIcon(view: string) {
  switch (view) {
    case 'nexus': return <FileText size={11} />;
    case 'git': return <GitBranch size={11} />;
    case 'agents': return <Users size={11} />;
    case 'feedback': return <ClipboardList size={11} />;
    default: return <Settings size={11} />;
  }
}

export function ContextBar({ tracker }: ContextBarProps) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-[rgb(var(--text-muted))]">
      <Eye size={11} className="shrink-0" />
      <span className="truncate">{tracker.label}</span>
      {tracker.selectedText && (
        <>
          <span className="w-px h-3 bg-[rgb(var(--border))]" />
          <span className="flex items-center gap-1 shrink-0 text-blue-400">
            <Scissors size={10} />
            Zaznaczono
          </span>
        </>
      )}
      {tracker.clipboardContent && (
        <>
          <span className="w-px h-3 bg-[rgb(var(--border))]" />
          <span className="flex items-center gap-1 shrink-0 text-amber-400">
            <ClipboardList size={10} />
            Schowek
          </span>
        </>
      )}
    </div>
  );
}
