// ============================================================================
// NEXUS — DiffViewer
// Komponent do porównywania wersji tekstu (side-by-side / inline)
// ============================================================================

import React, { useState } from 'react';
import { diffLines, DiffResult, DiffViewMode, diffToSideBySide, DiffLine } from '../utils/diffEngine';
import { FileText, Columns, ArrowLeft, Clock, RotateCcw } from 'lucide-react';

interface DiffViewerProps {
  oldTitle: string;
  newTitle: string;
  oldText: string;
  newText: string;
  oldTimestamp?: string;
  newTimestamp?: string;
  onRevert?: () => void;
  onClose?: () => void;
}

export function DiffViewer({
  oldTitle,
  newTitle,
  oldText,
  newText,
  oldTimestamp,
  newTimestamp,
  onRevert,
  onClose,
}: DiffViewerProps) {
  const [viewMode, setViewMode] = useState<DiffViewMode>('inline');
  const diff = diffLines(oldText, newText);
  const { leftLines, rightLines } = diffToSideBySide(diff);

  const hasChanges = diff.additions > 0 || diff.deletions > 0;

  return (
    <div className="h-full flex flex-col bg-[rgb(var(--background))]">
      {/* Header */}
      <div className="px-4 py-2 border-b border-[rgb(var(--border))] flex items-center gap-3 shrink-0">
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-[rgb(var(--border))]/50 rounded cursor-pointer">
            <ArrowLeft size={16} />
          </button>
        )}

        <div className="flex items-center gap-2 text-xs">
          <span className="text-[rgb(var(--accent))] font-medium">{oldTitle}</span>
          <span className="text-[rgb(var(--text-secondary))]">→</span>
          <span className="text-green-400 font-medium">{newTitle}</span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[rgb(var(--text-secondary))] ml-4">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            +{diff.additions}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            -{diff.deletions}
          </span>
          <span className="flex items-center gap-1 opacity-50">
            <FileText size={12} />
            {diff.unchanged}
          </span>
        </div>

        {oldTimestamp && newTimestamp && (
          <div className="flex items-center gap-1 text-[10px] text-[rgb(var(--text-secondary))] opacity-50">
            <Clock size={10} />
            {new Date(oldTimestamp).toLocaleString('pl-PL')} → {new Date(newTimestamp).toLocaleString('pl-PL')}
          </div>
        )}

        <div className="flex-1" />

        {/* View mode toggle */}
        <div className="flex items-center bg-[rgb(var(--bg-surface))] rounded-lg border border-[rgb(var(--border))] p-0.5">
          <button
            onClick={() => setViewMode('inline')}
            className={`px-2.5 py-1 rounded text-[11px] cursor-pointer transition-colors ${
              viewMode === 'inline'
                ? 'bg-[rgb(var(--accent))] text-white'
                : 'text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-main))]'
            }`}
          >
            Inline
          </button>
          <button
            onClick={() => setViewMode('side_by_side')}
            className={`px-2.5 py-1 rounded text-[11px] cursor-pointer transition-colors flex items-center gap-1 ${
              viewMode === 'side_by_side'
                ? 'bg-[rgb(var(--accent))] text-white'
                : 'text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-main))]'
            }`}
          >
            <Columns size={12} />
            Side-by-side
          </button>
        </div>

        {onRevert && hasChanges && (
          <button
            onClick={onRevert}
            className="flex items-center gap-1 px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg text-xs font-medium hover:bg-yellow-500/30 transition-colors cursor-pointer"
          >
            <RotateCcw size={14} />
            Cofnij zmiany
          </button>
        )}
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'inline' ? (
          <InlineView diff={diff} />
        ) : (
          <SideBySideView leftLines={leftLines} rightLines={rightLines} />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Inline View
// ============================================================================
function InlineView({ diff }: { diff: DiffResult }) {
  return (
    <div className="font-mono text-[13px] leading-6">
      {diff.lines.map((line, i) => {
        const bg =
          line.op === 'add' ? 'bg-green-500/5' :
          line.op === 'delete' ? 'bg-red-500/5' : '';
        const textColor =
          line.op === 'add' ? 'text-green-400' :
          line.op === 'delete' ? 'text-red-400' : 'text-[rgb(var(--text-main))]';

        return (
          <div key={i} className={`flex ${bg} hover:bg-[rgb(var(--border))]/20`}>
            {/* Line numbers */}
            <div className="w-16 text-right pr-3 text-[11px] text-[rgb(var(--text-secondary))] opacity-50 select-none shrink-0 py-0.5">
              {line.oldLineNum && <span className="mr-1">{line.oldLineNum}</span>}
              {line.newLineNum && <span className="ml-1">{line.newLineNum}</span>}
            </div>
            {/* Content */}
            <div className={`flex-1 whitespace-pre-wrap break-all py-0.5 ${textColor}`}>
              {line.op === 'add' && <span className="text-green-400 mr-1">+</span>}
              {line.op === 'delete' && <span className="text-red-400 mr-1">−</span>}
              {line.op === 'equal' && <span className="opacity-30 mr-1"> </span>}
              {line.text}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Side-by-Side View
// ============================================================================
function SideBySideView({
  leftLines,
  rightLines,
}: {
  leftLines: (DiffLine | null)[];
  rightLines: (DiffLine | null)[];
}) {
  return (
    <div className="flex font-mono text-[13px] leading-6">
      {/* Left panel (old) */}
      <div className="flex-1 border-r border-[rgb(var(--border))]">
        <div className="px-3 py-1 bg-red-500/10 text-[11px] text-red-400 font-semibold border-b border-[rgb(var(--border))] sticky top-0">
          Wersja stara: {leftLines.filter(l => l !== null && l.op === 'delete').length} usuniętych
        </div>
        {leftLines.map((line, i) => (
          <div
            key={`left-${i}`}
            className={`flex px-3 ${
              line?.op === 'delete' ? 'bg-red-500/10 text-red-400' : 'text-[rgb(var(--text-main))]'
            } ${line === null ? 'bg-red-500/5 opacity-30' : ''} hover:bg-[rgb(var(--border))]/20`}
          >
            <div className="w-12 text-right pr-2 text-[11px] text-[rgb(var(--text-secondary))] opacity-50 select-none shrink-0 py-0.5">
              {line?.oldLineNum || ''}
            </div>
            <div className="flex-1 whitespace-pre-wrap break-all py-0.5">
              {line?.text || ''}
            </div>
          </div>
        ))}
      </div>

      {/* Right panel (new) */}
      <div className="flex-1">
        <div className="px-3 py-1 bg-green-500/10 text-[11px] text-green-400 font-semibold border-b border-[rgb(var(--border))] sticky top-0">
          Wersja nowa: {rightLines.filter(l => l !== null && l.op === 'add').length} dodanych
        </div>
        {rightLines.map((line, i) => (
          <div
            key={i}
            className={`flex px-3 ${
              line?.op === 'add' ? 'bg-green-500/10 text-green-400' : 'text-[rgb(var(--text-main))]'
            } ${line === null ? 'bg-green-500/5 opacity-30' : ''} hover:bg-[rgb(var(--border))]/20`}
          >
            <div className="w-12 text-right pr-2 text-[11px] text-[rgb(var(--text-secondary))] opacity-50 select-none shrink-0 py-0.5">
              {line?.newLineNum || ''}
            </div>
            <div className="flex-1 whitespace-pre-wrap break-all py-0.5">
              {line?.text || ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
