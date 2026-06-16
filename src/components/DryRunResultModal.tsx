// ============================================================================
// NEXUS — DryRunResultModal (#10)
// Modalny panel z wynikami symulacji pipeline'u lub workflowu
// ============================================================================

import React from "react";
import { X, CheckCircle2, SkipForward, AlertTriangle, Clock, Cpu, Activity } from "lucide-react";
import type { DryRunResult } from "../shared/types/schema";
import { useFocusTrap } from "../hooks/useFocusTrap";

interface DryRunResultModalProps {
  result: DryRunResult | null;
  open: boolean;
  onClose: () => void;
}

export function DryRunResultModal({ result, open, onClose }: DryRunResultModalProps) {
  if (!open || !result) return null;

  const focusTrapRef = useFocusTrap(open && !!result);

  const completedNodes = result.nodes.filter(n => !n.skipped).length;
  const skippedNodes = result.nodes.filter(n => n.skipped).length;
  const totalTokens = result.nodes.reduce((s, n) => s + n.estimatedTokens, 0);

  return (
    <div ref={focusTrapRef} className="fixed inset-0 z-[200] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Wynik symulacji"
        className="relative w-full max-w-2xl bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-xl shadow-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgb(var(--border))]">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[rgb(var(--accent))]" />
            <h2 className="text-[14px] font-semibold text-[rgb(var(--text-main))]">
              Dry-Run: {result.pipelineId.slice(0, 8)}...
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

        {/* Summary bar */}
        <div className="flex items-center gap-6 px-5 py-3 border-b border-[rgb(var(--border))] bg-[rgb(var(--bg-canvas))]/50">
          <div className="flex items-center gap-2 text-[12px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[rgb(var(--success))]" />
            <span className="text-[rgb(var(--text-secondary))]">
              Wykonane: <span className="text-[rgb(var(--text-main))] font-medium">{completedNodes}</span>
            </span>
          </div>
          {skippedNodes > 0 && (
            <div className="flex items-center gap-2 text-[12px]">
              <SkipForward className="w-3.5 h-3.5 text-[rgb(var(--warning))]" />
              <span className="text-[rgb(var(--text-secondary))]">
                Pominięte: <span className="text-[rgb(var(--text-main))] font-medium">{skippedNodes}</span>
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 text-[12px]">
            <Clock className="w-3.5 h-3.5 text-[rgb(var(--text-muted))]" />
            <span className="text-[rgb(var(--text-secondary))]">
              Est. czas: <span className="text-[rgb(var(--text-main))] font-medium">{result.totalDuration}ms</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-[12px]">
            <Cpu className="w-3.5 h-3.5 text-[rgb(var(--text-muted))]" />
            <span className="text-[rgb(var(--text-secondary))]">
              Tokeny: <span className="text-[rgb(var(--text-main))] font-medium">~{totalTokens}</span>
            </span>
          </div>
        </div>

        {/* Node results list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
          {result.nodes.map((node) => (
            <div
              key={node.nodeId}
              className={`mx-3 px-4 py-3 my-1 rounded-lg border ${
                node.skipped
                  ? 'bg-amber-500/5 border-amber-500/20'
                  : 'bg-[rgb(var(--bg-elevated))] border-[rgb(var(--border))]'
              }`}
            >
              {/* Node header */}
              <div className="flex items-center gap-2 mb-1.5">
                {node.skipped ? (
                  <SkipForward className="w-3.5 h-3.5 text-[rgb(var(--warning))]" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[rgb(var(--success))]" />
                )}
                <span className="text-[13px] font-medium text-[rgb(var(--text-main))]">
                  {node.nodeName}
                </span>
                <span className="text-[10px] text-[rgb(var(--text-muted))] font-mono">
                  {node.nodeType}
                </span>
                {node.condition && (
                  <span className="text-[10px] text-[rgb(var(--warning))] ml-auto">
                    IF: {node.condition}
                  </span>
                )}
              </div>

              {/* Simulated output */}
              <p className="text-[12px] text-[rgb(var(--text-secondary))] leading-relaxed pl-5">
                {node.simulatedOutput}
              </p>

              {/* Stats row */}
              <div className="flex items-center gap-3 mt-2 pl-5">
                <span className="text-[10px] text-[rgb(var(--text-muted))]">
                  ⏱ ~{node.estimatedDuration}ms
                </span>
                <span className="text-[10px] text-[rgb(var(--text-muted))]">
                  🪙 ~{node.estimatedTokens} tokenów
                </span>
                {node.conditionResult !== undefined && node.conditionResult !== null && (
                  <span className={`text-[10px] ${node.conditionResult ? 'text-[rgb(var(--success))]' : 'text-[rgb(var(--text-muted))]'}`}>
                    Warunek: {node.conditionResult ? '✅ spełniony' : '❌ niespełniony'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[rgb(var(--border))] flex items-center justify-between text-[10px] text-[rgb(var(--text-muted))]">
          <span>Status: {result.status === 'success' ? '✅ Symulacja zakończona' : '❌ Wystąpił błąd'}</span>
          <span>{result.nodes.length} nodów w pipeline'ie</span>
        </div>
      </div>
    </div>
  );
}
