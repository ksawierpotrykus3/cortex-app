// ============================================================================
// NEXUS — KillSwitch Banner
// Czerwony banner + emergency stop button w headerze
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Shield, ShieldOff } from 'lucide-react';
import { KillSwitchState, DEFAULT_KILLSWITCH } from '../shared/types/schema';

interface KillSwitchBannerProps {
  className?: string;
}

export function KillSwitchBanner({ className = '' }: KillSwitchBannerProps) {
  const [state, setState] = useState<KillSwitchState>(DEFAULT_KILLSWITCH);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const bridge = (window as any).nexusBridge as any;
      if (bridge?.getKillSwitchStatus) {
        const status = await bridge.getKillSwitchStatus();
        setState(status);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleActivate = async () => {
    setLoading(true);
    try {
      const bridge = (window as any).nexusBridge as any;
      if (bridge?.activateKillSwitch) {
        const newState = await bridge.activateKillSwitch({ reason: 'Manual kill from UI' });
        setState(newState);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleDeactivate = async () => {
    setLoading(true);
    try {
      const bridge = (window as any).nexusBridge as any;
      if (bridge?.deactivateKillSwitch) {
        const newState = await bridge.deactivateKillSwitch();
        setState(newState);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  const hasActive = state.activeAgents > 0 || state.activePipelines > 0 || state.activeWorkflows > 0;

  return (
    <>
      {/* Czerwony banner gdy KillSwitch aktywny */}
      {state.active && (
        <div className={`flex items-center gap-3 px-4 py-2 bg-red-600/20 border-b border-red-500/40 ${className}`}>
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-[12px] text-red-300 flex-1">
            <strong>Kill Switch active</strong>
            {state.reason && ` — ${state.reason}`}
            {state.killedAt && ` (${new Date(state.killedAt).toLocaleTimeString()})`}
          </span>
          <button
            onClick={handleDeactivate}
            disabled={loading}
            className="px-3 py-1 text-[11px] font-medium bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <ShieldOff size={14} className="inline mr-1" />
            Deactivate
          </button>
        </div>
      )}

      {/* Kill Switch button in header (always visible) */}
      <button
        onClick={state.active ? handleDeactivate : handleActivate}
        disabled={loading}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
          state.active
            ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
            : hasActive
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'
              : 'bg-[rgb(var(--border))] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] border border-transparent'
        }`}
        title={state.active ? 'Kill Switch active — click to deactivate' : hasActive ? 'Active processes — click to stop all' : 'Emergency stop'}
      >
        {state.active ? (
          <ShieldOff size={14} />
        ) : (
          <Shield size={14} />
        )}
        <span>Kill Switch</span>
        {hasActive && !state.active && (
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        )}
      </button>
    </>
  );
}
