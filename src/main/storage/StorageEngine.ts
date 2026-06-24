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
import { Agent, AgentOutput, Pipeline, WorkspaceEntity, DownloadedFileRecord } from '../../shared/types/schema';
import { WorkflowDefinition, WorkflowExecutionResult } from '../../shared/types/workflow';

/**
 * Atomowy zapis pliku: tmp → rename.
 * Nawet jeśli proces crashe w trakcie writeFileSync, oryginalny plik pozostaje nienaruszony.
 */
function atomicWriteFileSync(filePath: string, data: string, encoding: BufferEncoding = 'utf8'): void {
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, data, encoding);
  fs.renameSync(tmpPath, filePath);
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
  close(): void;
}
interface Statement {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  get<T = unknown>(...params: unknown[]): T | undefined;
  all<T = unknown>(...params: unknown[]): T[];
}

// === StorageEngine =========================================================
export class StorageEngine {
  private db: Database | null = null;
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

    // Also save to SQLite
    if (this.db) {
      try {
        // JSONL append-first for crash recovery
        fs.appendFileSync(outputFile, JSON.stringify(output) + '\n', 'utf8');
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
