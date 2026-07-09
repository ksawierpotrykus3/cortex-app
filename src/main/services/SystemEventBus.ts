// ============================================================================
// NEXUS — SystemEventBus (Plan 02)
// Globalny event bus dla introspekcji i monitorowania systemu
// Używa własnego EventEmitter wewnętrznie, bez eksponowania emit()
// ============================================================================

import { EventEmitter } from 'events';

type SystemEvent =
  | { type: 'ai:prompt-sent'; timestamp: number; provider: string; model: string; tokenCount: number; promptPreview: string }
  | { type: 'ai:response-received'; timestamp: number; provider: string; durationMs: number; tokenCount: number }
  | { type: 'ai:error'; timestamp: number; provider: string; error: string; code?: string }
  | { type: 'ai:failover'; timestamp: number; from: string; to: string; reason: string }
  | { type: 'agent:started'; timestamp: number; agentId: string; agentName: string }
  | { type: 'agent:completed'; timestamp: number; agentId: string; durationMs: number }
  | { type: 'agent:error'; timestamp: number; agentId: string; error: string }
  | { type: 'health:ping'; timestamp: number; model: string; pingMs: number; status: 'ONLINE' | 'OFFLINE' }
  | { type: 'rate-limit:hit'; timestamp: number; key: string; used: number; limit: number }
  | { type: 'process:started'; timestamp: number; id: string }
  | { type: 'process:completed'; timestamp: number; id: string; durationMs: number }
  | { type: string; timestamp: number; [key: string]: any };

interface SystemEventBusEvents {
  event: [SystemEvent];
}

class SystemEventBus extends EventEmitter<SystemEventBusEvents> {
  private buffer: SystemEvent[] = [];
  private readonly MAX_BUFFER = 500;

  push(event: SystemEvent): void {
    this.buffer.push(event);
    if (this.buffer.length > this.MAX_BUFFER) {
      this.buffer = this.buffer.slice(-this.MAX_BUFFER);
    }
    this.emit('event', event);
  }

  getRecent(count: number = 100): SystemEvent[] {
    return this.buffer.slice(-count);
  }

  subscribe(callback: (event: SystemEvent) => void): () => void {
    this.on('event', callback);
    return () => { this.off('event', callback); };
  }
}

export const systemEventBus = new SystemEventBus();