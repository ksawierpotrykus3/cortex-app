// ============================================================================
// NEXUS — WorkflowSandboxBanner (#1)
// Pasek informacyjny: Sandbox (żółty) / Live (zielony)
// ============================================================================

import React from 'react';
import { WorkflowMode } from '../shared/types/workflow';

interface WorkflowSandboxBannerProps {
  mode: WorkflowMode;
  onChangeMode: (mode: WorkflowMode) => void;
}

export function WorkflowSandboxBanner({ mode, onChangeMode }: WorkflowSandboxBannerProps) {
  if (mode === 'sandbox') {
    return (
      <div className="flex items-center gap-3 px-3 py-2 bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-400 text-xs">
        <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
        <span className="flex-1">
          <strong>TRYB SANDBOX</strong> — Żadne akcje nie są faktycznie wykonywane.
          Wszystko jest symulowane.
        </span>
        <button
          onClick={() => onChangeMode('live')}
          className="px-2.5 py-1 rounded bg-yellow-500/20 hover:bg-yellow-500/30 transition-colors cursor-pointer text-[11px] font-medium"
        >
          Przełącz na LIVE
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-green-500/10 border-b border-green-500/20 text-green-400 text-xs">
      <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
      <span className="flex-1">
        <strong>TRYB LIVE</strong> — Akcje są wykonywane naprawdę.
        Upewnij się że wszystko jest skonfigurowane poprawnie.
      </span>
      <button
        onClick={() => onChangeMode('sandbox')}
        className="px-2.5 py-1 rounded bg-green-500/20 hover:bg-green-500/30 transition-colors cursor-pointer text-[11px] font-medium"
      >
        Przełącz na SANDBOX
      </button>
    </div>
  );
}
