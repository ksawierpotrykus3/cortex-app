// ============================================================================
// NEXUS — StorageEngine (Phase 1)
// SQLite (better-sqlite3) dla konfiguracji projektów
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { Projekt, ProjektyNode, ProjektyEdge, ProjektyNodeAnnotation } from '../../types';

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

  /** Publiczny getter — pozwala bezpiecznie sprawdzić ścieżkę bez `as any` */
  get basePath(): string { return this._basePath; }

  constructor(basePath: string) {
    this._basePath = basePath;
  }

  // =========================================================================
  // Init
  // =========================================================================

  async init(): Promise<void> {
    const configDir = path.join(this.basePath, 'config');

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
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
      CREATE TABLE IF NOT EXISTS projekty_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        spec_content TEXT DEFAULT '',
        ai_config TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

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
        FOREIGN KEY (parent_id) REFERENCES projekty_nodes(id) ON DELETE SET NULL
      );

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

      CREATE TABLE IF NOT EXISTS projekty_node_annotations (
        id TEXT PRIMARY KEY,
        node_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (node_id) REFERENCES projekty_nodes(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projekty_projects(id) ON DELETE CASCADE
      );
    `);
  }

  // =========================================================================
  // Projekty CRUD
  // =========================================================================

  saveProjekt(proj: Projekt): void {
    if (this.db) {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO projekty_projects (id, name, spec_content, ai_config, created_at, updated_at)
        VALUES (?, ?, ?, ?, COALESCE((SELECT created_at FROM projekty_projects WHERE id = ?), datetime('now')), datetime('now'))
      `);
      stmt.run(proj.id, proj.name, '', '{}', proj.id);
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

  deleteProjektyNode(id: string): void {
    if (this.db) {
      this.db.prepare('DELETE FROM projekty_nodes WHERE id = ?').run(id);
    }
    const p = path.join(this.basePath, 'projekty', 'nodes', `${id}.json`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
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
    const p = path.join(this.basePath, 'projekty', 'edges', `${id}.json`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
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
    const p = path.join(this.basePath, 'projekty', 'annotations', `${id}.json`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
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