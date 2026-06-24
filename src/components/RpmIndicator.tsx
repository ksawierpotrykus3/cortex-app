// ============================================================================
// NEXUS — RpmIndicator
// Pokazuje aktualne zużycie RPM (Requests Per Minute) dla providerów AI
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

interface RpmUsage {
  totalUsed: number;
  totalLimit: number;
  keys: { key: string; used: number; limit: number }[];
}

export function RpmIndicator() {
  const [usage, setUsage] = useState<RpmUsage>({ totalUsed: 0, totalLimit: 0, keys: [] });
  const [expanded, setExpanded] = useState(false);

  const fetchUsage = useCallback(async () => {
    try {
      const data = await window.nexusBridge?.getRpmUsage();
      if (data) setUsage(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchUsage();
    const interval = setInterval(fetchUsage, 5000);
    return () => clearInterval(interval);
  }, [fetchUsage]);

  if (usage.totalLimit === 0) return null;

  const pct = Math.min(100, Math.round((usage.totalUsed / usage.totalLimit) * 100));
  const barColor = pct >= 90 ? 'rgb(var(--danger))' : pct >= 70 ? 'rgb(var(--warning))' : 'rgb(var(--success))';

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[11px] text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-main))] transition-colors cursor-pointer"
        title="Zużycie RPM"
      >
        <span>RPM: {usage.totalUsed}/{usage.totalLimit}</span>
        <div className="w-12 h-1.5 rounded-full bg-[rgb(var(--border))] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: barColor }}
          />
        </div>
      </button>

      {expanded && (
        <>
          {/* Overlay do zamykania kliknięciem poza */}
          <div className="fixed inset-0 z-40" onClick={() => setExpanded(false)} />
          <div className="absolute bottom-full right-0 mb-2 z-50 min-w-[200px] bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-lg shadow-xl p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--text-tertiary))] mb-2">
              RPM — szczegóły
            </div>
            <div className="space-y-2">
              {usage.keys.map((k) => {
                const kPct = k.limit > 0 ? Math.min(100, Math.round((k.used / k.limit) * 100)) : 0;
                const kColor = kPct >= 90 ? 'rgb(var(--danger))' : kPct >= 70 ? 'rgb(var(--warning))' : 'rgb(var(--success))';
                return (
                  <div key={k.key} className="flex items-center gap-2">
                    <span className="text-[11px] text-[rgb(var(--text-main))] flex-1 truncate">{k.key}</span>
                    <span className="text-[10px] text-[rgb(var(--text-tertiary))] whitespace-nowrap">
                      {k.used}/{k.limit}
                    </span>
                    <div className="w-12 h-1 rounded-full bg-[rgb(var(--border))] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${kPct}%`, backgroundColor: kColor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
