// ============================================================================
// NEXUS — StorageEngine (Phase 1)
// SQLite (better-sqlite3) dla konfiguracji + JSONL dla outputów
// ============================================================================
//
// StorageEngine zarządza dwoma systemami:
// 1. SQLite — konfiguracje agentów, workflowy, tagi (lekkie zapisy)
// 2. JSONL — outputy agentów, logi systemowe (append-only, szybkie)
//
// Struktura katalogów:
//   config/nexus.db       ← SQLite (konfiguracje)
//   outputs/run_ID.jsonl  ← JSONL (outputy agentów)
//   logs/sys_YYYYMMDD.jsonl ← JSONL (logi systemowe)
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { Agent, AgentOutput } from '../../shared/types/schema';

// === Database Row Types ====================================================
interface AgentRow {
  id: string;
  name: string;
  description: string;
  status: string;
  config: string; // JSON — cały Agent config
  created_at: string;
  updated_at: string;
}

// === StorageEngine =========================================================
export class StorageEngine {
  private db: any = null; // better-sqlite3 Database
  private basePath: string;
  private ready: boolean = false;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  // =========================================================================
  // Init
  // =========================================================================

  async init(): Promise<void> {
    const configDir = path.join(this.basePath, 'config');
    const outputsDir = path.join(this.basePath, 'outputs');
    const logsDir = path.join(this.basePath, 'logs');

    // Create directories
    for (const dir of [configDir, outputsDir, logsDir]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    // Try loading better-sqlite3 (optional — falls back to JSON-only mode)
    try {
      const Database = require('better-sqlite3');
      this.db = new Database(path.join(configDir, 'nexus.db'));
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      await this.initSchema();
      console.log('[StorageEngine] SQLite initialized');
    } catch (err) {
      console.warn('[StorageEngine] better-sqlite3 not available — using JSON-only mode');
    }

    this.ready = true;
    console.log('[StorageEngine] Ready:', this.basePath);
  }

  private async initSchema(): Promise<void> {
    if (!this.db) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT DEFAULT 'ACTIVE',
        config TEXT NOT NULL,  -- JSON
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS outputs (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        content TEXT,
        tokens_used INTEGER DEFAULT 0,
        execution_ms INTEGER DEFAULT 0,
        trigger_type TEXT DEFAULT 'MANUAL',
        model_name TEXT DEFAULT '',
        rating INTEGER DEFAULT 0,
        approved INTEGER,
        tags TEXT DEFAULT '[]',
        error TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        completed_at TEXT,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      );

      -- FTS5 for full-text search
      CREATE VIRTUAL TABLE IF NOT EXISTS outputs_fts USING fts5(
        content, tags,
        content='outputs',
        content_rowid='rowid'
      );
    `);
  }

  // =========================================================================
  // Agent CRUD
  // =========================================================================

  saveAgent(agent: Agent): void {
    if (this.db) {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO agents (id, name, description, status, config, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `);
      stmt.run(agent.id, agent.name, agent.description, agent.status, JSON.stringify(agent));
    }

    // JSON backup
    const agentDir = path.join(this.basePath, 'agents');
    if (!fs.existsSync(agentDir)) {
      fs.mkdirSync(agentDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(agentDir, `${agent.id}.json`),
      JSON.stringify(agent, null, 2),
      'utf8'
    );
  }

  getAgent(id: string): Agent | null {
    if (this.db) {
      const row = this.db.prepare('SELECT config FROM agents WHERE id = ?').get(id) as AgentRow | undefined;
      if (row) return JSON.parse(row.config) as Agent;
    }

    // Fallback: read from JSON
    const agentPath = path.join(this.basePath, 'agents', `${id}.json`);
    if (fs.existsSync(agentPath)) {
      return JSON.parse(fs.readFileSync(agentPath, 'utf8')) as Agent;
    }

    return null;
  }

  getAllAgents(): Agent[] {
    if (this.db) {
      const rows = this.db.prepare('SELECT config FROM agents ORDER BY updated_at DESC').all() as AgentRow[];
      return rows.map(r => JSON.parse(r.config) as Agent);
    }

    // Fallback: read all JSON files
    const agentDir = path.join(this.basePath, 'agents');
    if (!fs.existsSync(agentDir)) return [];

    return fs.readdirSync(agentDir)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(agentDir, f), 'utf8')) as Agent);
  }

  deleteAgent(id: string): void {
    if (this.db) {
      this.db.prepare('DELETE FROM agents WHERE id = ?').run(id);
    }

    const agentPath = path.join(this.basePath, 'agents', `${id}.json`);
    if (fs.existsSync(agentPath)) {
      fs.unlinkSync(agentPath);
    }
  }

  // =========================================================================
  // Output Storage (JSONL — append-only)
  // =========================================================================

  saveOutput(output: AgentOutput): void {
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const outputDir = path.join(this.basePath, 'outputs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Per-day JSONL file
    const outputFile = path.join(outputDir, `${date}.jsonl`);
    fs.appendFileSync(outputFile, JSON.stringify(output) + '\n', 'utf8');

    // Also save to SQLite
    if (this.db) {
      try {
        const stmt = this.db.prepare(`
          INSERT INTO outputs (id, agent_id, agent_name, content, tokens_used, execution_ms,
            trigger_type, model_name, rating, approved, tags, error, created_at, completed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
          output.id, output.agentId, output.agentName, output.content,
          output.tokensUsed, output.executionMs, output.triggerType,
          output.modelName, output.rating,
          output.approved === null ? null : output.approved ? 1 : 0,
          JSON.stringify(output.tags), output.error || null,
          output.createdAt, output.completedAt || null
        );
      } catch (err) {
        console.warn('[StorageEngine] SQLite output insert failed:', err);
      }
    }
  }

  getOutputs(agentId?: string, limit: number = 100): AgentOutput[] {
    // Primary: read from SQLite
    if (this.db) {
      const query = agentId
        ? this.db.prepare('SELECT * FROM outputs WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?')
        : this.db.prepare('SELECT * FROM outputs ORDER BY created_at DESC LIMIT ?');

      const rows = agentId
        ? query.all(agentId, limit)
        : query.all(limit);

      return rows.map((r: any) => ({
        id: r.id,
        agentId: r.agent_id,
        agentName: r.agent_name,
        status: 'ACTIVE' as any,
        prompt: '',
        contextSize: 0,
        content: r.content || '',
        tokensUsed: r.tokens_used,
        executionMs: r.execution_ms,
        triggerType: r.trigger_type,
        modelName: r.model_name,
        rating: r.rating,
        approved: r.approved === null ? null : r.approved === 1,
        createdAt: r.created_at,
        completedAt: r.completed_at,
        tags: JSON.parse(r.tags || '[]'),
        error: r.error || undefined,
      }));
    }

    // Fallback: read from JSONL
    const outputDir = path.join(this.basePath, 'outputs');
    if (!fs.existsSync(outputDir)) return [];

    const files = fs.readdirSync(outputDir)
      .filter(f => f.endsWith('.jsonl'))
      .sort()
      .reverse();

    const outputs: AgentOutput[] = [];
    for (const file of files) {
      const lines = fs.readFileSync(path.join(outputDir, file), 'utf8').trim().split('\n');
      for (const line of lines) {
        if (!line) continue;
        try {
          const output = JSON.parse(line) as AgentOutput;
          if (!agentId || output.agentId === agentId) {
            outputs.push(output);
            if (outputs.length >= limit) return outputs;
          }
        } catch { /* skip malformed lines */ }
      }
    }

    return outputs;
  }

  // =========================================================================
  // Search (FTS5)
  // =========================================================================

  search(query: string, limit: number = 20): AgentOutput[] {
    if (!this.db) return [];

    const results = this.db.prepare(`
      SELECT o.* FROM outputs_fts f
      JOIN outputs o ON o.rowid = f.rowid
      WHERE outputs_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(query, limit);

    return results.map((r: any) => ({
      id: r.id,
      agentId: r.agent_id,
      agentName: r.agent_name,
      status: 'ACTIVE' as any,
      prompt: '',
      contextSize: 0,
      content: r.content || '',
      tokensUsed: r.tokens_used,
      executionMs: r.execution_ms,
      triggerType: r.trigger_type,
      modelName: r.model_name,
      rating: r.rating,
      approved: r.approved === null ? null : r.approved === 1,
      createdAt: r.created_at,
      completedAt: r.completed_at,
      tags: JSON.parse(r.tags || '[]'),
      error: r.error || undefined,
    }));
  }

  // =========================================================================
  // System Logs
  // =========================================================================

  appendLog(entry: Record<string, any>): void {
    const date = new Date().toISOString().slice(0, 10);
    const logsDir = path.join(this.basePath, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const logFile = path.join(logsDir, `sys_${date}.jsonl`);
    fs.appendFileSync(logFile, JSON.stringify({
      ...entry,
      timestamp: new Date().toISOString(),
    }) + '\n', 'utf8');
  }

  // =========================================================================
  // Cleanup
  // =========================================================================

  destroy(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.ready = false;
    console.log('[StorageEngine] Destroyed');
  }
}
