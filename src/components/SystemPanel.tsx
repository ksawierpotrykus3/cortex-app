// ============================================================================
// NEXUS — SystemPanel (Plan 02)
// Zakładka System: prowidery, handlery, agenty + mapa architektury
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

export function SystemPanel() {
  const [status, setStatus] = useState<any>(null);
  const [handlers, setHandlers] = useState<any[]>([]);
  const [lastRefresh, setLastRefresh] = useState<string>('');

  const fetchStatus = useCallback(async () => {
    try {
      const bridge = (window as any).nexusBridge;
      if (bridge?.systemGetStatus) {
        const s = await bridge.systemGetStatus();
        setStatus(s);
        setLastRefresh(new Date().toLocaleTimeString('pl-PL'));
      }
      if (bridge?.systemGetHandlers) {
        const h = await bridge.systemGetHandlers();
        setHandlers(h || []);
      }
    } catch (err) {
      console.error('[SystemPanel] Fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const statusDot = (online: boolean) => (
    <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${online ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]' : 'bg-red-400'}`} />
  );

  const handlerGroups = handlers.reduce((acc: Record<string, any[]>, h: any) => {
    const group = h.group || 'other';
    if (!acc[group]) acc[group] = [];
    acc[group].push(h);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#0a0e14', color: '#c9d1d9' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#21262d' }}>
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold tracking-wide">System Nexus</h2>
          {status?.version && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#1a1f2e', color: '#8b949e' }}>v{status.version}</span>}
          {status?.uptime !== undefined && (
            <span className="text-xs" style={{ color: '#8b949e' }}>Uptime: {formatUptime(status.uptime)}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: '#484f58' }}>Odświeżono: {lastRefresh}</span>
          <button onClick={fetchStatus} className="text-xs px-2 py-1 rounded cursor-pointer" style={{ background: '#1a1f2e', color: '#58a6ff' }}>Odśwież</button>
        </div>
      </div>

      {/* 3-column grid */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-3" style={{ minHeight: 0 }}>
        {/* Column 1: Providers */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#58a6ff' }}>Providery</h3>
          {status?.providers?.map((p: any, i: number) => (
            <div key={i} className="p-2 rounded border text-xs" style={{ background: '#1a1f2e', borderColor: '#21262d' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">{p.label}</span>
                {statusDot(p.status === 'ONLINE')}
              </div>
              <div className="flex flex-col gap-0.5" style={{ color: '#8b949e' }}>
                <span>Modele: {(p.models || []).join(', ') || '—'}</span>
                {p.ping !== undefined && <span>Ping: {p.ping}ms</span>}
                {p.rpm !== undefined && <span>RPM: {typeof p.rpm === 'object' ? `${p.rpm.used}/${p.rpm.limit}` : p.rpm}</span>}
              </div>
            </div>
          ))}
          {(!status?.providers || status.providers.length === 0) && (
            <div className="text-xs" style={{ color: '#484f58' }}>Brak providerów</div>
          )}
        </div>

        {/* Column 2: Handlers */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#3fb950' }}>Handlery IPC</h3>
          {Object.entries(handlerGroups).map(([group, items]) => (
            <div key={group} className="mb-1">
              <div className="text-[10px] font-semibold uppercase mb-0.5" style={{ color: '#8b949e' }}>{group}</div>
              {items.map((h, j) => (
                <div key={j} className="text-[11px] py-0.5 px-1.5 rounded mb-0.5" style={{ background: '#0d1117', color: '#c9d1d9' }}>
                  {h.channel}
                  {h.description && <span className="ml-1" style={{ color: '#484f58' }}>— {h.description}</span>}
                </div>
              ))}
            </div>
          ))}
          {handlers.length === 0 && (
            <div className="text-xs" style={{ color: '#484f58' }}>Brak handlerów</div>
          )}
        </div>

        {/* Column 3: Agents */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#d2991d' }}>Agenci</h3>
          {status?.agents?.map((a: any, i: number) => (
            <div key={i} className="p-2 rounded border text-xs" style={{ background: '#1a1f2e', borderColor: '#21262d' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">{a.name}</span>
                <span className={`text-[10px] px-1 py-0.5 rounded ${a.status === 'ACTIVE' ? 'text-green-400 bg-green-900/20' : 'text-gray-400 bg-gray-700'}`}>{a.status}</span>
              </div>
              <div style={{ color: '#8b949e' }}>
                {a.model?.modelName && <span>Model: {a.model.modelName}</span>}
              </div>
            </div>
          ))}
          {(!status?.agents || status.agents.length === 0) && (
            <div className="text-xs" style={{ color: '#484f58' }}>Brak agentów</div>
          )}
        </div>
      </div>

      {/* Architecture Canvas Placeholder */}
      <div className="border-t p-3" style={{ borderColor: '#21262d', minHeight: '200px' }}>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#a371f7' }}>Mapa Architektury</h3>
        <div className="flex items-center justify-center h-40 rounded border" style={{ borderColor: '#21262d', background: '#0d1117' }}>
          <div className="text-center">
            <span className="text-xs block mb-2" style={{ color: '#8b949e' }}>
              Mapa architektury generowana automatycznie przy starcie.
            </span>
            <span className="text-xs" style={{ color: '#484f58' }}>
              Przejdz do trybu Eksperymentalnego i otworz projekt "Nexus System" aby zobaczyc pelna mape.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}