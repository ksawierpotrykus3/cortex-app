// ============================================================================
// NEXUS — LiveFeed (Plan 02)
// Oś czasu zdarzeń AI LIVE — event bus z main process
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';

interface LiveEvent {
  type: string;
  timestamp: number;
  [key: string]: any;
}

export function LiveFeed() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bridge = (window as any).nexusBridge;
    if (!bridge?.systemSubscribeEvents) return;
    const unsub = bridge.systemSubscribeEvents((event: LiveEvent) => {
      setEvents(prev => {
        const next = [...prev, { ...event, _id: `${event.timestamp}_${Math.random().toString(36).slice(2, 6)}` }];
        if (next.length > 500) return next.slice(-500);
        return next;
      });
    });
    return () => { if (unsub) unsub(); };
  }, []);

  useEffect(() => {
    if (!isPaused && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events, isPaused]);

  const toggleFilter = (type: string) => {
    setFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const filteredEvents = filters.size > 0 ? events.filter(e => filters.has(e.type)) : events;

  const eventColor = (type: string): string => {
    if (type.includes('response') || type.includes('completed')) return '#3fb950';
    if (type.includes('error') || type.includes('crash')) return '#f85149';
    if (type.includes('failover')) return '#d2991d';
    if (type.includes('agent')) return '#58a6ff';
    if (type.includes('health') || type.includes('ping')) return '#8b949e';
    return '#a371f7';
  };

  const formatTime = (ts: number) => {
    try { return new Date(ts).toLocaleTimeString('pl-PL'); } catch { return ts.toString(); }
  };

  const eventTypes = ['ai:prompt-sent', 'ai:response-received', 'ai:error', 'ai:failover', 'agent:started', 'agent:completed', 'agent:error', 'health:ping', 'rate-limit:hit'];

  return (
    <div className="flex flex-col h-full" style={{ background: '#0a0e14', color: '#c9d1d9' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: '#21262d' }}>
        <h3 className="text-xs font-semibold">LIVE FEED</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer ${isPaused ? 'bg-yellow-900/30 text-yellow-400' : 'bg-green-900/20 text-green-400'}`}
          >
            {isPaused ? 'Wstrzymane' : 'LIVE'}
          </button>
          <button onClick={() => { if (window.confirm('Usunąć wszystkie zdarzenia?')) setEvents([]); }} className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer" style={{ color: '#f85149' }}>Wyczyść</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1 px-3 py-1.5 border-b" style={{ borderColor: '#21262d' }}>
        {eventTypes.map(type => (
          <button
            key={type}
            onClick={() => toggleFilter(type)}
            className={`text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
              filters.has(type) ? 'text-white' : ''
            }`}
            style={{
              background: filters.has(type) ? eventColor(type) + '30' : '#1a1f2e',
              borderColor: filters.has(type) ? eventColor(type) : '#30363d',
              borderWidth: '1px',
              color: filters.has(type) ? eventColor(type) : '#8b949e',
            }}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="flex gap-3 px-3 py-1 text-[10px]" style={{ color: '#8b949e' }}>
        <span>Zdarzeń: {events.length}</span>
        <span style={{ color: '#3fb950' }}>Sukcesów: {events.filter(e => e.type.includes('response') || e.type.includes('completed')).length}</span>
        <span style={{ color: '#f85149' }}>Błędów: {events.filter(e => e.type.includes('error')).length}</span>
      </div>

      {/* Event List */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {filteredEvents.length === 0 ? (
          <div className="text-xs text-center py-8" style={{ color: '#484f58' }}>
            Oczekiwanie na zdarzenia...
          </div>
        ) : (
          filteredEvents.map((event, i) => (
            <div
              key={event._id || i}
              className="mb-0.5 py-0.5 px-1.5 rounded text-[10px] cursor-pointer transition-colors hover:bg-opacity-20"
              style={{ background: '#0d1117', borderLeft: `2px solid ${eventColor(event.type)}` }}
              onClick={() => setExpandedId(expandedId === event._id ? null : event._id)}
            >
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: eventColor(event.type) }} />
                <span className="font-mono" style={{ color: '#484f58' }}>{formatTime(event.timestamp)}</span>
                <span style={{ color: eventColor(event.type) }}>{event.type}</span>
                {event.provider && <span style={{ color: '#8b949e' }}>{event.provider}</span>}
              </div>
              {expandedId === event._id && (
                <div className="mt-1 p-1 rounded text-[9px]" style={{ background: '#1a1f2e', color: '#8b949e' }}>
                  <pre className="whitespace-pre-wrap break-all">{JSON.stringify(event, null, 1)}</pre>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}