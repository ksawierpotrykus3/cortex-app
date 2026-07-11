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

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Agent, AgentOutput, Pipeline, WorkspaceEntity, DownloadedFileRecord } from '../../shared/types/schema';
import { WorkflowDefinition, WorkflowExecutionResult } from '../../shared/types/workflow';
import { Projekt, ProjektyChatMessage, ProjektyNode, ProjektyEdge, ProjektyChangelog, ProjektyConversation, ProjektyNodeAnnotation, ThoughtEntry, ThoughtGroup } from '../../types';

/**
 * Atomowy zapis pliku: tmp → rename.
 * Nawet jeśli proces crashe w trakcie writeFileSync, oryginalny plik pozostaje nienaruszony.
 */
function atomicWriteFileSync(filePath: string, data: string, encoding: BufferEncoding = 'utf8'): void {
  // Backup przed zapisem (Faza 2: ochrona danych)
  if (fs.existsSync(filePath)) {
    try {
      fs.copyFileSync(filePath, filePath + '.bak');
    } catch {
      // backup failure is non-fatal
    }
  }
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, data, encoding);
  fs.renameSync(tmpPath, filePath);
}

// Kolejka zapisow (Faza 2: zapobiega race condition i skazeniu kolejki)
class SaveQueue {
  private queue: Promise<void> = Promise.resolve();
  enqueue(fn: () => Promise<void>): Promise<void> {
    this.queue = this.queue.then(fn).catch(() => {});
    return this.queue;
  }
}

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

/** Minimalny interfejs dla better-sqlite3 Database — runtime lazy-loaded. */
interface Database {
  prepare(sql: string): Statement;
  pragma(sql: string, arg?: unknown): unknown;
  exec(sql: string): void;
  transaction<T extends (...args: any[]) => any>(fn: T): T;
  close(): void;
}
interface Statement {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  get<T = unknown>(...params: unknown[]): T | undefined;
  all<T = unknown>(...params: unknown[]): T[];
}

// === StorageEngine =========================================================
export class StorageEngine {
  db: Database | null = null;
  private _basePath: string;
  private ready: boolean = false;

  /** Publiczny getter — pozwala AgentOrchestrator bezpiecznie sprawdzić ścieżkę bez `as any` */
  get basePath(): string { return this._basePath; }

  constructor(basePath: string) {
    this._basePath = basePath;
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
      this.db!.pragma('journal_mode = WAL');
      this.db!.pragma('foreign_keys = ON');
      this.initSchema();
      console.log('[StorageEngine] SQLite initialized');
    } catch (err) {
      console.warn('[StorageEngine] better-sqlite3 not available — using JSON-only mode');
    }

    this.ready = true;
    console.log('[StorageEngine] Ready:', this.basePath);
  }

  private initSchema(): void {
    if (!this.db) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TEXT DEFAULT (datetime('now'))
      );
    `);

    const currentVersion = (this.db.prepare('SELECT MAX(version) as v FROM schema_version').get() as any)?.v || 0;

    if (currentVersion < 1) {
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
        status TEXT DEFAULT 'ACTIVE',
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

      -- Triggers to keep FTS5 in sync with outputs table
      CREATE TRIGGER IF NOT EXISTS outputs_ai AFTER INSERT ON outputs BEGIN
        INSERT INTO outputs_fts(rowid, content, tags) VALUES (new.rowid, new.content, new.tags);
      END;
      CREATE TRIGGER IF NOT EXISTS outputs_ad AFTER DELETE ON outputs BEGIN
        INSERT INTO outputs_fts(outputs_fts, rowid, content, tags) VALUES('delete', old.rowid, old.content, old.tags);
      END;
      CREATE TRIGGER IF NOT EXISTS outputs_au AFTER UPDATE ON outputs BEGIN
        INSERT INTO outputs_fts(outputs_fts, rowid, content, tags) VALUES('delete', old.rowid, old.content, old.tags);
        INSERT INTO outputs_fts(rowid, content, tags) VALUES (new.rowid, new.content, new.tags);
      END;

      -- Projekty eksperymentalne
      CREATE TABLE IF NOT EXISTS projekty_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        spec_content TEXT DEFAULT '',
        ai_config TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Konwersacje (wiele rozmow w jednym projekcie)
      CREATE TABLE IF NOT EXISTS projekty_conversations (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT 'Nowa rozmowa',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projekty_projects(id) ON DELETE CASCADE
      );

      -- Wiadomości w czacie
      CREATE TABLE IF NOT EXISTS projekty_chat_messages (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        conversation_id TEXT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        extracted_to_spec INTEGER DEFAULT 0,
        extracted_to_canvas INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projekty_projects(id) ON DELETE CASCADE,
        FOREIGN KEY (conversation_id) REFERENCES projekty_conversations(id) ON DELETE SET NULL
      );

      -- Nody na mapie (z hierarchia parent_id)
      CREATE TABLE IF NOT EXISTS projekty_nodes (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        content TEXT DEFAULT '',
        node_type TEXT DEFAULT 'task',
        status TEXT DEFAULT 'new',
        metadata TEXT DEFAULT '{}',
        parent_id TEXT,
        x REAL DEFAULT 0,
        y REAL DEFAULT 0,
        width REAL DEFAULT 240,
        height REAL DEFAULT 120,
        collapsed INTEGER DEFAULT 0,
        source_message_id TEXT,
        source_conversation_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projekty_projects(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES projekty_nodes(id) ON DELETE SET NULL,
        FOREIGN KEY (source_message_id) REFERENCES projekty_chat_messages(id) ON DELETE SET NULL
      );

      -- Relacje między nodami
      CREATE TABLE IF NOT EXISTS projekty_edges (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        source_node_id TEXT NOT NULL,
        target_node_id TEXT NOT NULL,
        label TEXT DEFAULT '',
        relation_type TEXT DEFAULT 'depends_on',
        source_handle TEXT,
        target_handle TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projekty_projects(id) ON DELETE CASCADE,
        FOREIGN KEY (source_node_id) REFERENCES projekty_nodes(id) ON DELETE CASCADE,
        FOREIGN KEY (target_node_id) REFERENCES projekty_nodes(id) ON DELETE CASCADE
      );

      -- Adnotacje do wezlow (komentarze uzytkownika)
      CREATE TABLE IF NOT EXISTS projekty_node_annotations (
        id TEXT PRIMARY KEY,
        node_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (node_id) REFERENCES projekty_nodes(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projekty_projects(id) ON DELETE CASCADE
      );

      -- Historia zmian (Changelog)
      CREATE TABLE IF NOT EXISTS projekty_changelog (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        summary TEXT NOT NULL,
        source_message_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projekty_projects(id) ON DELETE CASCADE
      );

      -- Dokumenty projektu (Plan 01)
      CREATE TABLE IF NOT EXISTS project_documents (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        content TEXT NOT NULL,
        summary TEXT,
        token_count INTEGER,
        file_size INTEGER,
        imported_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projekty_projects(id) ON DELETE CASCADE
      );

      -- Research Space
      CREATE TABLE IF NOT EXISTS research_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS research_entries (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
        title TEXT DEFAULT '',
        related_entry_ids TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS research_sources (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL REFERENCES research_entries(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_type TEXT,
        content_text TEXT,
        imported_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS research_chat_messages (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL REFERENCES research_entries(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS research_agent_observations (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL REFERENCES research_entries(id) ON DELETE CASCADE,
        agent_id TEXT,
        observation_type TEXT NOT NULL CHECK(observation_type IN ('ai_finding', 'user_observation', 'unresolved')),
        content TEXT NOT NULL,
        source_message_ids TEXT DEFAULT '[]',
        corrects_observation_id TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS thought_depot (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL DEFAULT '',
        group_id TEXT,
        embedding TEXT,
        source_type TEXT NOT NULL DEFAULT 'manual' CHECK(source_type IN ('manual', 'ai_extract', 'import')),
        source_ref TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS thought_groups (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL DEFAULT '',
        centroid_embedding TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);
      this.db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (1)').run();
    }

    // Future migrations: add more version checks here
    // if (currentVersion < 2) { ... INSERT INTO schema_version (version) VALUES (2); }
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
    atomicWriteFileSync(
      path.join(agentDir, `${agent.id}.json`),
      JSON.stringify(agent, null, 2)
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

    // fix(audyt): JSONL był zapisywany tylko gdy this.db istnieje - w trybie JSON-only outputy były tracone
    // JSONL append-first for crash recovery — zawsze zapisywany
    fs.appendFileSync(outputFile, JSON.stringify(output) + '\n', 'utf8');

    // Also save to SQLite
    if (this.db) {
      try {
        const stmt = this.db.prepare(`
          INSERT OR REPLACE INTO outputs (id, agent_id, agent_name, status, content, tokens_used, execution_ms,
            trigger_type, model_name, rating, approved, tags, error, created_at, completed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
          output.id, output.agentId, output.agentName, output.status || 'ACTIVE', output.content,
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
        status: r.status || 'ACTIVE',
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
  // Output Stats & Management (F6.3)
  // =========================================================================

  getOutputStats(agentId: string): { total: number; avgTokens: number; avgExecutionMs: number; errorRate: number } {
    if (this.db) {
      const row = this.db.prepare(`
        SELECT
          COUNT(*) as total,
          COALESCE(AVG(tokens_used), 0) as avgTokens,
          COALESCE(AVG(execution_ms), 0) as avgExecutionMs,
          CAST(SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) AS REAL) / MAX(COUNT(*), 1) as errorRate
        FROM outputs WHERE agent_id = ?
      `).get(agentId) as any;
      return {
        total: row.total,
        avgTokens: row.avgTokens,
        avgExecutionMs: row.avgExecutionMs,
        errorRate: row.errorRate || 0,
      };
    }

    // Fallback: scan JSONL
    const outputs = this.getOutputs(agentId, 10000);
    const total = outputs.length;
    if (total === 0) return { total: 0, avgTokens: 0, avgExecutionMs: 0, errorRate: 0 };
    const sumTokens = outputs.reduce((s, o) => s + o.tokensUsed, 0);
    const sumMs = outputs.reduce((s, o) => s + o.executionMs, 0);
    const errors = outputs.filter(o => o.error).length;
    return {
      total,
      avgTokens: Math.round(sumTokens / total),
      avgExecutionMs: Math.round(sumMs / total),
      errorRate: errors / total,
    };
  }

  updateOutput(id: string, updates: Partial<AgentOutput>): boolean {
    if (this.db) {
      const existing = this.db.prepare('SELECT * FROM outputs WHERE id = ?').get(id) as any;
      if (!existing) return false;
      const approved = updates.approved === null ? null : updates.approved ? 1 : 0;
      const tags = updates.tags ? JSON.stringify(updates.tags) : existing.tags;
      const content = updates.content !== undefined ? updates.content : existing.content;
      const rating = updates.rating !== undefined ? updates.rating : existing.rating;
      this.db.prepare(`
        UPDATE outputs SET content = ?, rating = ?, approved = ?, tags = ?, completed_at = COALESCE(?, completed_at)
        WHERE id = ?
      `).run(content, rating, approved, tags, updates.completedAt || null, id);
      return true;
    }
    return false;
  }

  deleteOutput(id: string): void {
    if (this.db) {
      this.db.prepare('DELETE FROM outputs WHERE id = ?').run(id);
    }
  }

  clearOutputs(agentId: string): void {
    if (this.db) {
      this.db.prepare('DELETE FROM outputs WHERE agent_id = ?').run(agentId);
    }
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
  // Workspace Entity Storage (F6.2) — przechowuje encje z workspace renderera
  // =========================================================================

  private workspaceEntities: WorkspaceEntity[] = [];

  syncWorkspaceEntities(entities: WorkspaceEntity[]): void {
    this.workspaceEntities = entities;
    // Persist to disk
    const wsDir = path.join(this.basePath, 'workspace');
    if (!fs.existsSync(wsDir)) {
      fs.mkdirSync(wsDir, { recursive: true });
    }
    atomicWriteFileSync(
      path.join(wsDir, 'entities.json'),
      JSON.stringify(entities, null, 2)
    );
  }

  getWorkspaceEntities(): WorkspaceEntity[] {
    if (this.workspaceEntities.length > 0) return this.workspaceEntities;
    // Fallback: read from disk
    const wsPath = path.join(this.basePath, 'workspace', 'entities.json');
    if (fs.existsSync(wsPath)) {
      try {
        this.workspaceEntities = JSON.parse(fs.readFileSync(wsPath, 'utf8')) as WorkspaceEntity[];
        return this.workspaceEntities;
      } catch { /* ignore */ }
    }
    return [];
  }

  getWorkspaceEntitiesByType(type: WorkspaceEntity['type']): WorkspaceEntity[] {
    return this.getWorkspaceEntities().filter(e => e.type === type);
  }

  // =========================================================================
  // Pipeline Storage (F6.12)
  // =========================================================================

  savePipeline(pipeline: Pipeline): void {
    const pipelineDir = path.join(this.basePath, 'pipelines');
    if (!fs.existsSync(pipelineDir)) {
      fs.mkdirSync(pipelineDir, { recursive: true });
    }
    atomicWriteFileSync(
      path.join(pipelineDir, `${pipeline.id}.json`),
      JSON.stringify(pipeline, null, 2)
    );
  }

  getPipeline(id: string): Pipeline | null {
    const pipelinePath = path.join(this.basePath, 'pipelines', `${id}.json`);
    if (fs.existsSync(pipelinePath)) {
      return JSON.parse(fs.readFileSync(pipelinePath, 'utf8')) as Pipeline;
    }
    return null;
  }

  getAllPipelines(): Pipeline[] {
    const pipelineDir = path.join(this.basePath, 'pipelines');
    if (!fs.existsSync(pipelineDir)) return [];
    return fs.readdirSync(pipelineDir)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(pipelineDir, f), 'utf8')) as Pipeline);
  }

  deletePipeline(id: string): void {
    const pipelinePath = path.join(this.basePath, 'pipelines', `${id}.json`);
    if (fs.existsSync(pipelinePath)) {
      fs.unlinkSync(pipelinePath);
    }
  }

  // =========================================================================
  // Thought Depot
  // =========================================================================

  saveThought(entry: ThoughtEntry): void {
    if (!this.db) return;
    this.db.prepare(`
      INSERT OR REPLACE INTO thought_depot (id, content, group_id, embedding, source_type, source_ref, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))
    `).run(entry.id, entry.content, entry.group_id || null, entry.embedding ? JSON.stringify(entry.embedding) : null, entry.source_type, entry.source_ref || null, entry.created_at || null);
  }

  getAllThoughts(): ThoughtEntry[] {
    if (!this.db) return [];
    const rows = this.db.prepare('SELECT * FROM thought_depot ORDER BY created_at DESC').all() as any[];
    return rows.map(r => ({
      id: r.id,
      content: r.content,
      group_id: r.group_id || undefined,
      embedding: r.embedding ? JSON.parse(r.embedding) : undefined,
      source_type: r.source_type,
      source_ref: r.source_ref || undefined,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  }

  saveThoughtGroup(group: ThoughtGroup): void {
    if (!this.db) return;
    this.db.prepare(`
      INSERT OR REPLACE INTO thought_groups (id, label, centroid_embedding, created_at, updated_at)
      VALUES (?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))
    `).run(group.id, group.label, group.centroid_embedding ? JSON.stringify(group.centroid_embedding) : null, group.created_at || null);
  }

  getAllThoughtGroups(): ThoughtGroup[] {
    if (!this.db) return [];
    const rows = this.db.prepare('SELECT * FROM thought_groups ORDER BY created_at DESC').all() as any[];
    return rows.map(r => ({
      id: r.id,
      label: r.label,
      centroid_embedding: r.centroid_embedding ? JSON.parse(r.centroid_embedding) : undefined,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  }

  regroupThoughts(thoughtIds: string[], groupId: string): void {
    if (!this.db) return;
    const stmt = this.db.prepare('UPDATE thought_depot SET group_id = ?, updated_at = datetime(\'now\') WHERE id = ?');
    const tx = this.db.transaction(() => {
      for (const tid of thoughtIds) {
        stmt.run(groupId, tid);
      }
    });
    tx();
  }

  // =========================================================================
  // Workflow Storage (#1)
  // =========================================================================

  saveWorkflow(workflow: WorkflowDefinition): void {
    const workflowDir = path.join(this.basePath, 'workflows');
    if (!fs.existsSync(workflowDir)) {
      fs.mkdirSync(workflowDir, { recursive: true });
    }
    atomicWriteFileSync(
      path.join(workflowDir, `${workflow.id}.json`),
      JSON.stringify(workflow, null, 2)
    );
  }

  getWorkflow(id: string): WorkflowDefinition | null {
    const workflowPath = path.join(this.basePath, 'workflows', `${id}.json`);
    if (fs.existsSync(workflowPath)) {
      return JSON.parse(fs.readFileSync(workflowPath, 'utf8')) as WorkflowDefinition;
    }
    return null;
  }

  getAllWorkflows(): WorkflowDefinition[] {
    const workflowDir = path.join(this.basePath, 'workflows');
    if (!fs.existsSync(workflowDir)) return [];
    return fs.readdirSync(workflowDir)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(workflowDir, f), 'utf8')) as WorkflowDefinition);
  }

  deleteWorkflow(id: string): void {
    const workflowPath = path.join(this.basePath, 'workflows', `${id}.json`);
    if (fs.existsSync(workflowPath)) {
      fs.unlinkSync(workflowPath);
    }
  }

  saveWorkflowResult(result: WorkflowExecutionResult): void {
    const resultsDir = path.join(this.basePath, 'workflow-results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    atomicWriteFileSync(
      path.join(resultsDir, `${result.id}.json`),
      JSON.stringify(result, null, 2)
    );
  }

  getWorkflowResults(workflowId: string): WorkflowExecutionResult[] {
    const resultsDir = path.join(this.basePath, 'workflow-results');
    if (!fs.existsSync(resultsDir)) return [];
    return fs.readdirSync(resultsDir)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(resultsDir, f), 'utf8')) as WorkflowExecutionResult)
      .filter(r => r.workflowId === workflowId);
  }

  // =========================================================================
  // Downloaded Files Storage (#27 Playwright)
  // =========================================================================

  /** Kopiuje plik do storage/files/{id}/ i zapisuje rekord w JSONL */
  saveDownloadedFile(
    sourceUrl: string,
    filePath: string,
    originalName: string,
    mime: string,
    metadata: Record<string, any> = {}
  ): DownloadedFileRecord {
    const filesDir = path.join(this.basePath, 'files');
    if (!fs.existsSync(filesDir)) {
      fs.mkdirSync(filesDir, { recursive: true });
    }

    const id = crypto.randomUUID?.() || `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fileDir = path.join(filesDir, id);
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }

    // Sanitize filename
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedPath = path.join(fileDir, safeName);

    // Copy file to storage
    if (fs.existsSync(filePath) && filePath !== storedPath) {
      fs.copyFileSync(filePath, storedPath);
    } else if (!fs.existsSync(filePath)) {
      throw new Error(`Source file not found: ${filePath}`);
    }

    const stats = fs.statSync(storedPath);
    const record: DownloadedFileRecord = {
      id,
      sourceUrl,
      originalName: safeName,
      storedPath,
      mime,
      sizeBytes: stats.size,
      metadata,
      downloadedAt: new Date().toISOString(),
    };

    // Append to files JSONL
    const filesJsonl = path.join(this.basePath, 'files', 'files.jsonl');
    fs.appendFileSync(filesJsonl, JSON.stringify(record) + '\n', 'utf8');

    console.debug(`[StorageEngine] File saved: ${safeName} (${stats.size} bytes) → ${storedPath}`);
    return record;
  }

  /** Zapisuje wiele plików z outputu BrowserEngine */
  saveDownloadedFiles(
    sourceUrl: string,
    files: Array<{ name: string; path: string; mime: string }>,
    metadata: Record<string, any> = {}
  ): DownloadedFileRecord[] {
    return files.map(f => {
      const mimeType = f.mime || this.guessMime(f.name);
      return this.saveDownloadedFile(sourceUrl, f.path, f.name, mimeType, metadata);
    });
  }

  /** Zwraca wszystkie pobrane pliki (ostatnie N) */
  getDownloadedFiles(limit: number = 50): DownloadedFileRecord[] {
    const filesJsonl = path.join(this.basePath, 'files', 'files.jsonl');
    if (!fs.existsSync(filesJsonl)) return [];

    const lines = fs.readFileSync(filesJsonl, 'utf8').trim().split('\n').reverse();
    const records: DownloadedFileRecord[] = [];
    for (const line of lines) {
      if (!line) continue;
      try {
        records.push(JSON.parse(line) as DownloadedFileRecord);
        if (records.length >= limit) break;
      } catch { /* skip malformed */ }
    }
    return records;
  }

  /** Zwraca pliki po metadanych (np. po agentId) */
  getDownloadedFilesByMetadata(key: string, value: any, limit: number = 50): DownloadedFileRecord[] {
    return this.getDownloadedFiles(1000).filter(r => r.metadata?.[key] === value).slice(0, limit);
  }

  /** Usuwa plik z dysku i z rejestru */
  deleteDownloadedFile(id: string): boolean {
    // Read all records, filter out the deleted one, rewrite JSONL
    const filesJsonl = path.join(this.basePath, 'files', 'files.jsonl');
    if (!fs.existsSync(filesJsonl)) return false;

    const lines = fs.readFileSync(filesJsonl, 'utf8').trim().split('\n');
    const remaining: string[] = [];
    let found = false;

    for (const line of lines) {
      if (!line) continue;
      try {
        const record = JSON.parse(line) as DownloadedFileRecord;
        if (record.id === id) {
          found = true;
          // Delete file from disk
          try {
            if (fs.existsSync(record.storedPath)) {
              fs.unlinkSync(record.storedPath);
            }
            // Try to remove parent dir
            const dir = path.dirname(record.storedPath);
            if (fs.existsSync(dir)) {
              fs.rmdirSync(dir, { recursive: true });
            }
          } catch { /* ignore file delete errors */ }
          continue;
        }
      } catch { /* skip malformed */ }
      remaining.push(line);
    }

    if (found) {
      fs.writeFileSync(filesJsonl, remaining.join('\n') + '\n', 'utf8');
      return true;
    }
    return false;
  }

  /** Proste zgadywanie MIME po rozszerzeniu */
  private guessMime(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.csv': 'text/csv',
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.html': 'text/html',
      '.htm': 'text/html',
      '.zip': 'application/zip',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4',
    };
    return mimeMap[ext] || 'application/octet-stream';
  }

  // =========================================================================
  // Tryb Eksperymentalny CRUD
  // =========================================================================

  runTableInfoPragma(tableName: string): any[] {
    if (!this.db || !tableName) return [];
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      throw new Error(`[StorageEngine] Invalid table name for PRAGMA: ${tableName}`);
    }
    return (this.db.prepare(`PRAGMA table_info(${tableName})`).all() as any[]) || [];
  }

  // --- Projects ---
  saveProjekt(proj: Projekt): void {
    if (this.db) {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO projekty_projects (id, name, spec_content, ai_config, created_at, updated_at)
        VALUES (?, ?, ?, ?, COALESCE((SELECT created_at FROM projekty_projects WHERE id = ?), datetime('now')), datetime('now'))
      `);
      const aiConfigStr = typeof proj.ai_config === 'string' ? proj.ai_config : JSON.stringify(proj.ai_config || {});
      stmt.run(proj.id, proj.name, proj.spec_content || '', aiConfigStr, proj.id);
    }
    const dir = path.join(this.basePath, 'projekty', 'projects');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    atomicWriteFileSync(path.join(dir, `${proj.id}.json`), JSON.stringify(proj, null, 2));
  }

  getProjekts(): Projekt[] {
    if (this.db) {
      const rows = this.db.prepare('SELECT * FROM projekty_projects ORDER BY updated_at DESC').all() as any[];
      return rows.map(r => ({
        id: r.id,
        name: r.name,
        spec_content: r.spec_content || '',
        ai_config: typeof r.ai_config === 'string' ? ((() => { try { return JSON.parse(r.ai_config); } catch { return {}; } })()) : r.ai_config,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));
    }
    const dir = path.join(this.basePath, 'projekty', 'projects');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Projekt);
  }

  getProjekt(id: string): Projekt | null {
    if (this.db) {
      const r = this.db.prepare('SELECT * FROM projekty_projects WHERE id = ?').get(id) as any;
      if (r) {
        return {
          id: r.id,
          name: r.name,
          spec_content: r.spec_content || '',
          ai_config: typeof r.ai_config === 'string' ? ((() => { try { return JSON.parse(r.ai_config); } catch { return {}; } })()) : r.ai_config,
          created_at: r.created_at,
          updated_at: r.updated_at,
        };
      }
    }
    const p = path.join(this.basePath, 'projekty', 'projects', `${id}.json`);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8')) as Projekt;
    return null;
  }

  deleteProjekt(id: string): void {
    if (this.db) {
      this.db.prepare('DELETE FROM projekty_projects WHERE id = ?').run(id);
    }
    const p = path.join(this.basePath, 'projekty', 'projects', `${id}.json`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  // --- Chat Messages ---
  saveProjektyChatMessage(msg: ProjektyChatMessage): void {
    if (this.db) {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO projekty_chat_messages (id, project_id, conversation_id, role, content, extracted_to_spec, extracted_to_canvas, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM projekty_chat_messages WHERE id = ?), datetime('now')))
      `);
      stmt.run(msg.id, msg.project_id, msg.conversation_id || null, msg.role, msg.content, msg.extracted_to_spec ? 1 : 0, msg.extracted_to_canvas ? 1 : 0, msg.id);
    }
    const dir = path.join(this.basePath, 'projekty', 'chat');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    atomicWriteFileSync(path.join(dir, `${msg.id}.json`), JSON.stringify(msg, null, 2));
  }

  getProjektyChatMessages(projectId: string, conversationId?: string): ProjektyChatMessage[] {
    if (this.db) {
      let rows: any[];
      if (conversationId) {
        rows = this.db.prepare('SELECT * FROM projekty_chat_messages WHERE project_id = ? AND conversation_id = ? ORDER BY created_at ASC').all(projectId, conversationId) as any[];
      } else {
        rows = this.db.prepare('SELECT * FROM projekty_chat_messages WHERE project_id = ? ORDER BY created_at ASC').all(projectId) as any[];
      }
      return rows.map(r => ({
        id: r.id,
        project_id: r.project_id,
        conversation_id: r.conversation_id,
        role: r.role,
        content: r.content,
        extracted_to_spec: r.extracted_to_spec,
        extracted_to_canvas: r.extracted_to_canvas,
        created_at: r.created_at,
      }));
    }
    const dir = path.join(this.basePath, 'projekty', 'chat');
    if (!fs.existsSync(dir)) return [];
    const all = fs.readdirSync(dir).filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as ProjektyChatMessage)
      .filter(m => m.project_id === projectId && (!conversationId || m.conversation_id === conversationId))
      .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    return all;
  }

  getProjektyUnprocessedMessages(projectId: string, conversationId?: string): ProjektyChatMessage[] {
    if (this.db) {
      let rows: any[];
      if (conversationId) {
        rows = this.db.prepare('SELECT * FROM projekty_chat_messages WHERE project_id = ? AND conversation_id = ? AND extracted_to_canvas = 0 ORDER BY created_at ASC').all(projectId, conversationId) as any[];
      } else {
        rows = this.db.prepare('SELECT * FROM projekty_chat_messages WHERE project_id = ? AND extracted_to_canvas = 0 ORDER BY created_at ASC').all(projectId) as any[];
      }
      return rows.map(r => ({
        id: r.id,
        project_id: r.project_id,
        conversation_id: r.conversation_id,
        role: r.role,
        content: r.content,
        extracted_to_spec: r.extracted_to_spec,
        extracted_to_canvas: r.extracted_to_canvas,
        created_at: r.created_at,
      }));
    }
    const dir = path.join(this.basePath, 'projekty', 'chat');
    if (!fs.existsSync(dir)) return [];
    const all = fs.readdirSync(dir).filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as ProjektyChatMessage)
      .filter(m => m.project_id === projectId && (!conversationId || m.conversation_id === conversationId) && !m.extracted_to_canvas)
      .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    return all;
  }

  markProjektyMessagesProcessed(messageIds: string[]): void {
    if (this.db && messageIds.length > 0) {
      const stmt = this.db.prepare('UPDATE projekty_chat_messages SET extracted_to_canvas = 1 WHERE id = ?');
      const runAll = this.db.transaction((ids: string[]) => {
        for (const id of ids) {
          stmt.run(id);
        }
      });
      runAll(messageIds);
    }
  }

  deleteProjektyChatMessage(id: string): void {
    if (this.db) {
      this.db.prepare('DELETE FROM projekty_chat_messages WHERE id = ?').run(id);
    }
  }

  // --- Nodes ---
  saveProjektyNode(node: ProjektyNode): void {
    if (this.db) {
      const meta = typeof node.metadata === 'string' ? node.metadata : (node.metadata ? JSON.stringify(node.metadata) : '{}');
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO projekty_nodes (id, project_id, title, content, node_type, status, metadata, parent_id, x, y, width, height, collapsed, source_message_id, source_conversation_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM projekty_nodes WHERE id = ?), datetime('now')), datetime('now'))
      `);
      stmt.run(
        node.id, node.project_id,
        node.title || node.label || '', node.content || node.description || '',
        node.node_type || 'task', node.status || 'new', meta,
        node.parent_id || null,
        node.x ?? 0, node.y ?? 0, node.width ?? 240, node.height ?? 120,
        node.collapsed ? 1 : 0, node.source_message_id || null, node.source_conversation_id || null, node.id
      );
    }
    const dir = path.join(this.basePath, 'projekty', 'nodes');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    atomicWriteFileSync(path.join(dir, `${node.id}.json`), JSON.stringify(node, null, 2));
  }

  getProjektyNodes(projectId: string): ProjektyNode[] {
    if (this.db) {
      const rows = this.db.prepare('SELECT * FROM projekty_nodes WHERE project_id = ? ORDER BY created_at ASC').all(projectId) as any[];
      return rows.map(r => ({
        id: r.id,
        project_id: r.project_id,
        title: r.title,
        content: r.content,
        node_type: r.node_type,
        status: r.status,
        metadata: r.metadata ? (() => { try { return JSON.parse(r.metadata); } catch { return {}; } })() : undefined,
        parent_id: r.parent_id,
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        collapsed: r.collapsed,
        source_message_id: r.source_message_id,
        source_conversation_id: r.source_conversation_id,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));
    }
    const dir = path.join(this.basePath, 'projekty', 'nodes');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as ProjektyNode)
      .filter(n => n.project_id === projectId)
      .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  }

  getProjektyUndecomposedNodes(projectId: string): ProjektyNode[] {
    if (this.db) {
      const rows = this.db.prepare(
        `SELECT * FROM projekty_nodes WHERE project_id = ? AND (node_type = 'root' OR node_type = 'domain' OR node_type = 'component') AND status != 'ready' AND metadata NOT LIKE '%"is_leaf":true%' ORDER BY created_at ASC LIMIT 1`
      ).all(projectId) as any[];
      return rows.map(r => ({
        id: r.id,
        project_id: r.project_id,
        title: r.title,
        content: r.content,
        node_type: r.node_type,
        status: r.status,
        parent_id: r.parent_id,
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        collapsed: r.collapsed,
        source_message_id: r.source_message_id,
        source_conversation_id: r.source_conversation_id,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));
    }
    return [];
  }

  deleteProjektyNode(id: string): void {
    if (this.db) {
      this.db.prepare('DELETE FROM projekty_nodes WHERE id = ?').run(id);
    }
  }

  // --- Conversations ---
  saveProjektyConversation(conv: ProjektyConversation): void {
    if (this.db) {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO projekty_conversations (id, project_id, name, created_at)
        VALUES (?, ?, ?, COALESCE((SELECT created_at FROM projekty_conversations WHERE id = ?), datetime('now')))
      `);
      stmt.run(conv.id, conv.project_id, conv.name, conv.id);
    }
    const dir = path.join(this.basePath, 'projekty', 'conversations');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    atomicWriteFileSync(path.join(dir, `${conv.id}.json`), JSON.stringify(conv, null, 2));
  }

  getProjektyConversations(projectId: string): ProjektyConversation[] {
    if (this.db) {
      const rows = this.db.prepare('SELECT * FROM projekty_conversations WHERE project_id = ? ORDER BY created_at ASC').all(projectId) as any[];
      return rows.map(r => ({
        id: r.id,
        project_id: r.project_id,
        name: r.name,
        enabled: r.enabled ?? true,
        deleted: r.deleted ?? false,
        created_at: r.created_at,
      }));
    }
    const dir = path.join(this.basePath, 'projekty', 'conversations');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as ProjektyConversation)
      .filter(c => c.project_id === projectId)
      .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  }

  deleteProjektyConversation(id: string): void {
    if (this.db) {
      this.db.prepare('DELETE FROM projekty_conversations WHERE id = ?').run(id);
    }
  }

  // =========================================================================
  // Project Documents (Plan 01)
  // =========================================================================

  importDocument(projectId: string, name: string, fileType: string, content: string, tokenCount: number, fileSize: number, summary?: string): any {
    const id = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    if (this.db) {
      try {
        this.db.prepare(`
          INSERT INTO project_documents (id, project_id, name, file_type, content, summary, token_count, file_size, imported_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(id, projectId, name, fileType, content, summary || null, tokenCount, fileSize);
        console.debug('[StorageEngine] Document imported:', name);
      } catch (error) {
        console.error('[StorageEngine] Document import failed:', error);
        throw new Error(`Błąd zapisu dokumentu: ${(error as Error).message}`);
      }
    }
    return { id, project_id: projectId, name, file_type: fileType, content, summary, token_count: tokenCount, file_size: fileSize, imported_at: new Date().toISOString() };
  }

  getDocuments(projectId: string): any[] {
    if (this.db) {
      const rows = this.db.prepare('SELECT * FROM project_documents WHERE project_id = ? ORDER BY imported_at DESC').all(projectId) as any[];
      return rows;
    }
    return [];
  }

  deleteDocument(id: string): void {
    if (this.db) {
      this.db.prepare('DELETE FROM project_documents WHERE id = ?').run(id);
    }
  }

  getDocumentContent(id: string): string | null {
    if (this.db) {
      const row = this.db.prepare('SELECT content FROM project_documents WHERE id = ?').get(id) as any;
      return row ? row.content : null;
    }
    return null;
  }

  updateDocumentSummary(id: string, summary: string): void {
    if (this.db) {
      this.db.prepare('UPDATE project_documents SET summary = ? WHERE id = ?').run(summary, id);
    }
  }

  // --- Node Annotations ---
  saveProjektyNodeAnnotation(ann: ProjektyNodeAnnotation): void {
    if (this.db) {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO projekty_node_annotations (id, node_id, project_id, content, created_at)
        VALUES (?, ?, ?, ?, COALESCE((SELECT created_at FROM projekty_node_annotations WHERE id = ?), datetime('now')))
      `);
      stmt.run(ann.id, ann.node_id, ann.project_id, ann.content, ann.id);
    }
    const dir = path.join(this.basePath, 'projekty', 'annotations');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    atomicWriteFileSync(path.join(dir, `${ann.id}.json`), JSON.stringify(ann, null, 2));
  }

  getProjektyNodeAnnotations(nodeId: string): ProjektyNodeAnnotation[] {
    if (this.db) {
      const rows = this.db.prepare('SELECT * FROM projekty_node_annotations WHERE node_id = ? ORDER BY created_at ASC').all(nodeId) as any[];
      return rows.map(r => ({
        id: r.id,
        node_id: r.node_id,
        project_id: r.project_id,
        content: r.content,
        created_at: r.created_at,
      }));
    }
    const dir = path.join(this.basePath, 'projekty', 'annotations');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as ProjektyNodeAnnotation)
      .filter(a => a.node_id === nodeId)
      .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  }

  deleteProjektyNodeAnnotation(id: string): void {
    if (this.db) {
      this.db.prepare('DELETE FROM projekty_node_annotations WHERE id = ?').run(id);
    }
  }

  // --- Global Context (Faza 1) ---
  saveProjektyGlobalContext(projectId: string, context: any): void {
    if (this.db) {
      const existing = this.db.prepare('SELECT ai_config FROM projekty_projects WHERE id = ?').get(projectId) as any;
      if (existing) {
        let cfg = {};
        try { cfg = existing.ai_config ? JSON.parse(existing.ai_config) : {}; } catch { cfg = {}; }
        cfg = { ...cfg, global_context: context };
        this.db.prepare('UPDATE projekty_projects SET ai_config = ?, updated_at = datetime(\'now\') WHERE id = ?').run(JSON.stringify(cfg), projectId);
      }
    }
  }

  getProjektyGlobalContext(projectId: string): any {
    if (this.db) {
      const r = this.db.prepare('SELECT ai_config FROM projekty_projects WHERE id = ?').get(projectId) as any;
      if (r && r.ai_config) {
        try {
          const cfg = typeof r.ai_config === 'string' ? JSON.parse(r.ai_config) : r.ai_config;
          return cfg.global_context || null;
        } catch { return null; }
      }
    }
    return null;
  }

  // --- Edges ---
  saveProjektyEdge(edge: ProjektyEdge): void {
    if (this.db) {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO projekty_edges (id, project_id, source_node_id, target_node_id, label, relation_type, source_handle, target_handle, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM projekty_edges WHERE id = ?), datetime('now')))
      `);
      stmt.run(edge.id, edge.project_id, edge.source_node_id, edge.target_node_id,
        edge.label || '', edge.relation_type || 'depends_on', edge.source_handle || null, edge.target_handle || null, edge.id);
    }
    const dir = path.join(this.basePath, 'projekty', 'edges');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    atomicWriteFileSync(path.join(dir, `${edge.id}.json`), JSON.stringify(edge, null, 2));
  }

  getProjektyEdges(projectId: string): ProjektyEdge[] {
    if (this.db) {
      const rows = this.db.prepare('SELECT * FROM projekty_edges WHERE project_id = ?').all(projectId) as any[];
      return rows.map(r => ({
        id: r.id,
        project_id: r.project_id,
        source_node_id: r.source_node_id,
        target_node_id: r.target_node_id,
        label: r.label,
        relation_type: r.relation_type,
        source_handle: r.source_handle,
        target_handle: r.target_handle,
        created_at: r.created_at,
      }));
    }
    const dir = path.join(this.basePath, 'projekty', 'edges');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as ProjektyEdge)
      .filter(e => e.project_id === projectId);
  }

  deleteProjektyEdge(id: string): void {
    if (this.db) {
      this.db.prepare('DELETE FROM projekty_edges WHERE id = ?').run(id);
    }
  }

  // --- Changelog ---
  saveProjektyChangelog(entry: ProjektyChangelog): void {
    if (this.db) {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO projekty_changelog (id, project_id, action_type, entity_type, entity_id, summary, source_message_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM projekty_changelog WHERE id = ?), datetime('now')))
      `);
      stmt.run(
        entry.id, entry.project_id, entry.action_type, entry.entity_type, entry.entity_id,
        entry.summary || '', entry.source_message_id || null, entry.id
      );
    }
  }

  getProjektyChangelog(projectId: string): ProjektyChangelog[] {
    if (this.db) {
      const rows = this.db.prepare('SELECT * FROM projekty_changelog WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as any[];
      return rows.map(r => ({
        id: r.id,
        project_id: r.project_id,
        action_type: r.action_type,
        entity_type: r.entity_type,
        entity_id: r.entity_id,
        summary: r.summary,
        source_message_id: r.source_message_id,
        created_at: r.created_at,
      }));
    }
    const dir = path.join(this.basePath, 'projekty', 'changelog');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as ProjektyChangelog)
      .filter(c => c.project_id === projectId)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }

  // =========================================================================
  // Research Space CRUD
  // =========================================================================

  createResearchProject(name: string): any {
    const id = crypto.randomUUID?.() || `rp_${Date.now()}`;
    const now = new Date().toISOString();
    if (this.db) {
      this.db.prepare('INSERT INTO research_projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(id, name, now, now);
    }
    return { id, name, created_at: now, updated_at: now };
  }

  getResearchProjects(): any[] {
    if (this.db) {
      return this.db.prepare('SELECT * FROM research_projects ORDER BY updated_at DESC').all();
    }
    return [];
  }

  getResearchProject(id: string): any | null {
    if (this.db) {
      return this.db.prepare('SELECT * FROM research_projects WHERE id = ?').get(id) || null;
    }
    return null;
  }

  deleteResearchProject(id: string): void {
    if (this.db) {
      this.db.prepare('DELETE FROM research_projects WHERE id = ?').run(id);
    }
  }

  createResearchEntry(projectId: string, title: string): any {
    const id = crypto.randomUUID?.() || `re_${Date.now()}`;
    const now = new Date().toISOString();
    if (this.db) {
      this.db.prepare('INSERT INTO research_entries (id, project_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, projectId, title, now, now);
      this.db.prepare('UPDATE research_projects SET updated_at = ? WHERE id = ?').run(now, projectId);
    }
    return { id, project_id: projectId, title, related_entry_ids: '[]', created_at: now, updated_at: now };
  }

  getResearchEntries(projectId: string): any[] {
    if (this.db) {
      return this.db.prepare('SELECT * FROM research_entries WHERE project_id = ? ORDER BY updated_at DESC').all(projectId);
    }
    return [];
  }

  deleteResearchEntry(id: string): void {
    if (this.db) {
      this.db.prepare('DELETE FROM research_entries WHERE id = ?').run(id);
    }
  }

  addResearchSource(entryId: string, fileName: string, filePath: string, fileType: string, contentText: string | null): any {
    const id = crypto.randomUUID?.() || `rsrc_${Date.now()}`;
    const now = new Date().toISOString();
    if (this.db) {
      this.db.prepare('INSERT INTO research_sources (id, entry_id, file_name, file_path, file_type, content_text) VALUES (?, ?, ?, ?, ?, ?)').run(id, entryId, fileName, filePath, fileType, contentText);
      this.db.prepare('UPDATE research_entries SET updated_at = ? WHERE id = ?').run(now, entryId);
    }
    return { id, entry_id: entryId, file_name: fileName, file_path: filePath, file_type: fileType, content_text: contentText, imported_at: now };
  }

  getResearchSources(entryId: string): any[] {
    if (this.db) {
      return this.db.prepare('SELECT * FROM research_sources WHERE entry_id = ? ORDER BY imported_at DESC').all(entryId);
    }
    return [];
  }

  addResearchChatMessage(entryId: string, role: 'user' | 'assistant' | 'system', content: string): any {
    const id = crypto.randomUUID?.() || `rmsg_${Date.now()}`;
    const now = new Date().toISOString();
    if (this.db) {
      this.db.prepare('INSERT INTO research_chat_messages (id, entry_id, role, content) VALUES (?, ?, ?, ?)').run(id, entryId, role, content);
      this.db.prepare('UPDATE research_entries SET updated_at = ? WHERE id = ?').run(now, entryId);
    }
    return { id, entry_id: entryId, role, content, created_at: now };
  }

  getResearchChatMessages(entryId: string): any[] {
    if (this.db) {
      return this.db.prepare('SELECT * FROM research_chat_messages WHERE entry_id = ? ORDER BY created_at ASC').all(entryId);
    }
    return [];
  }

  addResearchAgentObservation(entryId: string, agentId: string | null, observationType: 'ai_finding' | 'user_observation' | 'unresolved', content: string, sourceMessageIds?: string[], correctsObservationId?: string): any {
    const id = crypto.randomUUID?.() || `robs_${Date.now()}`;
    const now = new Date().toISOString();
    if (this.db) {
      this.db.prepare('INSERT INTO research_agent_observations (id, entry_id, agent_id, observation_type, content, source_message_ids, corrects_observation_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, entryId, agentId, observationType, content, JSON.stringify(sourceMessageIds || []), correctsObservationId || null);
      this.db.prepare('UPDATE research_entries SET updated_at = ? WHERE id = ?').run(now, entryId);
    }
    return { id, entry_id: entryId, agent_id: agentId, observation_type: observationType, content, source_message_ids: JSON.stringify(sourceMessageIds || []), corrects_observation_id: correctsObservationId || null, created_at: now };
  }

  getResearchAgentObservations(entryId: string): any[] {
    if (this.db) {
      return this.db.prepare('SELECT * FROM research_agent_observations WHERE entry_id = ? ORDER BY created_at ASC').all(entryId);
    }
    return [];
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
    console.debug('[StorageEngine] Destroyed');
  }
}
