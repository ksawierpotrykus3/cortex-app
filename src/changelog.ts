import { ChangeEntry, ChangeType, ChangeEntityType } from "./types";

const MAX_ENTRIES = 500;

export class ChangeLog {
  private entries: ChangeEntry[];

  constructor(initial: ChangeEntry[] = []) {
    this.entries = initial.slice(-MAX_ENTRIES);
  }

  add(
    type: ChangeType,
    entityType: ChangeEntityType,
    entityId: string,
    summary: string,
    metadata?: Record<string, unknown>,
    userId?: "user" | "ai"
  ): ChangeEntry {
    const entry: ChangeEntry = {
      id: (typeof crypto !== "undefined" && crypto.randomUUID?.()) || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      entityType,
      entityId,
      summary,
      timestamp: new Date().toISOString(),
      userId: userId || "user",
      metadata,
    };
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.shift();
    }
    return entry;
  }

  getAll(): ChangeEntry[] {
    return [...this.entries];
  }

  getRecent(limit: number = 50): ChangeEntry[] {
    return this.entries.slice(-limit).reverse();
  }

  getByType(type: ChangeType): ChangeEntry[] {
    return this.entries.filter((e) => e.type === type);
  }

  getSince(date: Date): ChangeEntry[] {
    return this.entries.filter((e) => new Date(e.timestamp) >= date);
  }

  getByEntity(entityType: ChangeEntityType, entityId: string): ChangeEntry[] {
    return this.entries.filter((e) => e.entityType === entityType && e.entityId === entityId);
  }

  clear(): void {
    this.entries = [];
  }

  toJSON(): ChangeEntry[] {
    return this.entries;
  }

  static fromJSON(data: ChangeEntry[]): ChangeLog {
    return new ChangeLog(data);
  }

  get length(): number {
    return this.entries.length;
  }
}
