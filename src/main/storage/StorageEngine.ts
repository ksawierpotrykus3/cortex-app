// ============================================================================
// NEXUS — StorageEngine (JSON-only)
// Zapis do plików JSON w katalogu data/projekty/{projects,nodes,edges,annotations}
// Atomowy zapis: tmp → rename + backup .bak
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { Projekt, ProjektyNode, ProjektyEdge, ProjektyNodeAnnotation } from '../../types';

/**
 * Atomowy zapis pliku: tmp → rename.
 * Nawet jeśli proces crashe w trakcie writeFileSync, oryginalny plik pozostaje nienaruszony.
 */
function atomicWriteFileSync(filePath: string, data: string, encoding: BufferEncoding = 'utf8'): void {
  // Backup przed zapisem (ochrona danych)
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

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function readJsonDir<T>(dir: string): T[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => readJsonFile<T>(path.join(dir, f)))
    .filter((x): x is T => x !== null);
}

function deleteFileIfExists(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// === StorageEngine =========================================================
export class StorageEngine {
  private _basePath: string;
  private ready: boolean = false;

  /** Publiczny getter — pozwala bezpiecznie sprawdzić ścieżkę */
  get basePath(): string { return this._basePath; }

  constructor(basePath: string) {
    this._basePath = basePath;
  }

  // =========================================================================
  // Init
  // =========================================================================

  async init(): Promise<void> {
    const dataDir = path.join(this.basePath, 'projekty');
    ensureDir(dataDir);
    ensureDir(path.join(dataDir, 'projects'));
    ensureDir(path.join(dataDir, 'nodes'));
    ensureDir(path.join(dataDir, 'edges'));
    ensureDir(path.join(dataDir, 'annotations'));

    this.ready = true;
    console.log('[StorageEngine] JSON storage ready:', this.basePath);
  }

  // =========================================================================
  // Projekty CRUD
  // =========================================================================

  saveProjekt(proj: Projekt): void {
    const dir = path.join(this.basePath, 'projekty', 'projects');
    ensureDir(dir);
    atomicWriteFileSync(path.join(dir, `${proj.id}.json`), JSON.stringify(proj, null, 2));
  }

  getProjekts(): Projekt[] {
    const dir = path.join(this.basePath, 'projekty', 'projects');
    return readJsonDir<Projekt>(dir)
      .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
  }

  getProjekt(id: string): Projekt | null {
    const p = path.join(this.basePath, 'projekty', 'projects', `${id}.json`);
    return readJsonFile<Projekt>(p);
  }

  deleteProjekt(id: string): void {
    const p = path.join(this.basePath, 'projekty', 'projects', `${id}.json`);
    deleteFileIfExists(p);
    // Sprzątanie powiązanych węzłów, krawędzi i adnotacji
    const nodesDir = path.join(this.basePath, 'projekty', 'nodes');
    const edgesDir = path.join(this.basePath, 'projekty', 'edges');
    const annotationsDir = path.join(this.basePath, 'projekty', 'annotations');

    if (fs.existsSync(nodesDir)) {
      fs.readdirSync(nodesDir)
        .filter(f => f.endsWith('.json'))
        .forEach(f => {
          const node = readJsonFile<ProjektyNode>(path.join(nodesDir, f));
          if (node?.project_id === id) deleteFileIfExists(path.join(nodesDir, f));
        });
    }
    if (fs.existsSync(edgesDir)) {
      fs.readdirSync(edgesDir)
        .filter(f => f.endsWith('.json'))
        .forEach(f => {
          const edge = readJsonFile<ProjektyEdge>(path.join(edgesDir, f));
          if (edge?.project_id === id) deleteFileIfExists(path.join(edgesDir, f));
        });
    }
    if (fs.existsSync(annotationsDir)) {
      fs.readdirSync(annotationsDir)
        .filter(f => f.endsWith('.json'))
        .forEach(f => {
          const ann = readJsonFile<ProjektyNodeAnnotation>(path.join(annotationsDir, f));
          if (ann?.project_id === id) deleteFileIfExists(path.join(annotationsDir, f));
        });
    }
  }

  // --- Nodes ---
  saveProjektyNode(node: ProjektyNode): void {
    const dir = path.join(this.basePath, 'projekty', 'nodes');
    ensureDir(dir);
    atomicWriteFileSync(path.join(dir, `${node.id}.json`), JSON.stringify(node, null, 2));
  }

  getProjektyNodes(projectId: string): ProjektyNode[] {
    const dir = path.join(this.basePath, 'projekty', 'nodes');
    return readJsonDir<ProjektyNode>(dir)
      .filter(n => n.project_id === projectId)
      .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  }

  deleteProjektyNode(id: string): void {
    const p = path.join(this.basePath, 'projekty', 'nodes', `${id}.json`);
    deleteFileIfExists(p);
    // Usuwanie krawędzi i adnotacji powiązanych z węzłem
    const edgesDir = path.join(this.basePath, 'projekty', 'edges');
    const annotationsDir = path.join(this.basePath, 'projekty', 'annotations');
    if (fs.existsSync(edgesDir)) {
      fs.readdirSync(edgesDir)
        .filter(f => f.endsWith('.json'))
        .forEach(f => {
          const edge = readJsonFile<ProjektyEdge>(path.join(edgesDir, f));
          if (edge && (edge.source_node_id === id || edge.target_node_id === id)) {
            deleteFileIfExists(path.join(edgesDir, f));
          }
        });
    }
    if (fs.existsSync(annotationsDir)) {
      fs.readdirSync(annotationsDir)
        .filter(f => f.endsWith('.json'))
        .forEach(f => {
          const ann = readJsonFile<ProjektyNodeAnnotation>(path.join(annotationsDir, f));
          if (ann?.node_id === id) deleteFileIfExists(path.join(annotationsDir, f));
        });
    }
  }

  // --- Edges ---
  saveProjektyEdge(edge: ProjektyEdge): void {
    const dir = path.join(this.basePath, 'projekty', 'edges');
    ensureDir(dir);
    atomicWriteFileSync(path.join(dir, `${edge.id}.json`), JSON.stringify(edge, null, 2));
  }

  getProjektyEdges(projectId: string): ProjektyEdge[] {
    const dir = path.join(this.basePath, 'projekty', 'edges');
    return readJsonDir<ProjektyEdge>(dir)
      .filter(e => e.project_id === projectId);
  }

  deleteProjektyEdge(id: string): void {
    const p = path.join(this.basePath, 'projekty', 'edges', `${id}.json`);
    deleteFileIfExists(p);
  }

  // --- Node Annotations ---
  saveProjektyNodeAnnotation(ann: ProjektyNodeAnnotation): void {
    const dir = path.join(this.basePath, 'projekty', 'annotations');
    ensureDir(dir);
    atomicWriteFileSync(path.join(dir, `${ann.id}.json`), JSON.stringify(ann, null, 2));
  }

  getProjektyNodeAnnotations(nodeId: string): ProjektyNodeAnnotation[] {
    const dir = path.join(this.basePath, 'projekty', 'annotations');
    return readJsonDir<ProjektyNodeAnnotation>(dir)
      .filter(a => a.node_id === nodeId)
      .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  }

  deleteProjektyNodeAnnotation(id: string): void {
    const p = path.join(this.basePath, 'projekty', 'annotations', `${id}.json`);
    deleteFileIfExists(p);
  }

  // =========================================================================
  // Cleanup
  // =========================================================================

  destroy(): void {
    this.ready = false;
    console.debug('[StorageEngine] Destroyed');
  }
}