// ============================================================================
// NEXUS — RateLimiter
// Ogranicza liczbę zapytań na minutę (RPM) dla każdego klucza API

import { systemEventBus } from '../services/SystemEventBus';
// ============================================================================

export class RateLimiter {
  private keys: Map<string, { rpmLimit: number; timestamps: number[] }> = new Map();

  setLimit(key: string, limit: number): void {
    if (!this.keys.has(key)) {
      this.keys.set(key, { rpmLimit: limit, timestamps: [] });
    } else {
      this.keys.get(key)!.rpmLimit = limit;
    }
  }

  /** Atomic: checks rate limit AND records the send in one operation. Returns true if allowed. */
  tryAcquire(key: string): boolean {
    const entry = this.keys.get(key);
    if (!entry) return true;
    // limit=0 means "unlimited" (e.g. Ollama), not "block everything"
    if (entry.rpmLimit <= 0) {
      entry.timestamps.push(Date.now());
      return true;
    }
    const now = Date.now();
    entry.timestamps = entry.timestamps.filter(ts => now - ts < 60000);
    if (entry.timestamps.length < entry.rpmLimit) {
      entry.timestamps.push(now);
      return true;
    }
    systemEventBus.push({ type: 'rate-limit:hit', timestamp: Date.now(), key, used: entry.timestamps.length, limit: entry.rpmLimit });
    return false;
  }

  getUsage(key: string): { used: number; limit: number; remaining: number } {
    const entry = this.keys.get(key);
    if (!entry) return { used: 0, limit: 0, remaining: 0 };
    const now = Date.now();
    const used = entry.timestamps.filter(ts => now - ts < 60000).length;
    return { used, limit: entry.rpmLimit, remaining: Math.max(0, entry.rpmLimit - used) };
  }

  getGlobalUsage(): { totalUsed: number; totalLimit: number; keys: { key: string; used: number; limit: number }[] } {
    let totalUsed = 0, totalLimit = 0;
    const keys: { key: string; used: number; limit: number }[] = [];
    for (const [key] of this.keys) {
      const u = this.getUsage(key);
      totalUsed += u.used;
      totalLimit += u.limit;
      keys.push({ key, used: u.used, limit: u.limit });
    }
    return { totalUsed, totalLimit, keys };
  }

  removeKey(key: string): void {
    this.keys.delete(key);
  }

  reset(): void {
    this.keys.clear();
  }

  /** Periodic cleanup of stale entries (timestamps older than 60s) to prevent memory leaks */
  cleanupStaleEntries(): void {
    const now = Date.now();
    for (const [, entry] of this.keys) {
      entry.timestamps = entry.timestamps.filter(ts => now - ts < 60000);
    }
  }
}

export const rateLimiter = new RateLimiter();
