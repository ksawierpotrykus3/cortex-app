// ============================================================================
// NEXUS — NexusSelfAnalyzer (Plan 02)
// Skanuje architekturę src/ i tworzy projekt "Nexus System" w trybie eksp.
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { StorageEngine } from '../storage/StorageEngine';

interface ArchitectureNode { file: string; exports: string[]; }
interface ArchitectureEdge { from: string; to: string; type: string; }
interface ArchitectureGraph { nodes: ArchitectureNode[]; edges: ArchitectureEdge[]; hash: string; }

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'out', 'data', 'e2e', 'scripts']);
const IGNORE_EXTS = new Set(['.css', '.json', '.png', '.svg', '.ico', '.snap']);

function collectFiles(dir: string, base: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name)) {
          results.push(...collectFiles(full, base));
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!IGNORE_EXTS.has(ext) && (ext === '.ts' || ext === '.tsx' || ext === '.md')) {
          results.push(full);
        }
      }
    }
  } catch { /* permission errors */ }
  return results;
}

function extractImports(filePath: string): { imports: string[]; exports: string[] } {
  const imports: string[] = [];
  const exports: string[] = [];
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const importRegex = /^import\s+.*?\bfrom\s+['"](.+)['"]/gm;
    let m;
    while ((m = importRegex.exec(content)) !== null) {
      const target = m[1];
      if (target.startsWith('.') || target.startsWith('@')) {
        imports.push(target);
      } else if (!target.startsWith('node:')) {
        // Zewnętrzny — pokaż nazwę paczki
        const pkg = target.startsWith('@') ? target.split('/').slice(0, 2).join('/') : target.split('/')[0];
        imports.push(pkg);
      }
    }
    // Extract named exports
    const exportRegex = /^export\s+(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/gm;
    while ((m = exportRegex.exec(content)) !== null) {
      exports.push(m[1]);
    }
    // Also "export { X, Y }" patterns
    const exportBraceRegex = /^export\s+\{([^}]+)\}/gm;
    while ((m = exportBraceRegex.exec(content)) !== null) {
      m[1].split(',').forEach(name => {
        const n = name.trim();
        if (n) exports.push(n);
      });
    }
  } catch { /* read errors */ }
  return { imports, exports };
}

function relativeToSrc(filePath: string, srcPath: string): string {
  const rel = path.relative(srcPath, filePath).replace(/\\/g, '/');
  return rel;
}

export function scanArchitecture(srcPath: string): ArchitectureGraph {
  const files = collectFiles(srcPath, srcPath);
  const nodes: ArchitectureNode[] = [];
  const edges: ArchitectureEdge[] = [];
  const fileMap = new Map<string, string>(); // relative path -> absolute path

  for (const fp of files) {
    const rel = relativeToSrc(fp, srcPath);
    fileMap.set(rel, fp);
    const { imports, exports } = extractImports(fp);
    nodes.push({ file: rel, exports });

    for (const imp of imports) {
      edges.push({ from: rel, to: imp, type: 'import' });
    }
  }

  // Deduplikuj
  const uniqueEdges = edges.filter((e, i, arr) =>
    arr.findIndex(a => a.from === e.from && a.to === e.to) === i
  );

  const hash = crypto.createHash('md5').update(JSON.stringify({ nodes, edges: uniqueEdges })).digest('hex');
  return { nodes, edges: uniqueEdges, hash };
}

export async function initNexusSelfProject(
  storage: StorageEngine,
  srcPath: string,
  stanProjektuPath: string,
): Promise<void> {
  try {
    const graph = scanArchitecture(srcPath);
    let specContent = '';
    try {
      specContent = fs.readFileSync(stanProjektuPath, 'utf-8');
    } catch {
      specContent = '# Nexus System — Architektura\n\nAuto-wygenerowany opis.';
    }

    // Dodaj strukturę plików
    specContent += '\n\n## Struktura kodu źródłowego\n\n';
    for (const node of graph.nodes) {
      specContent += `- \`${node.file}\``;
      if (node.exports.length > 0) {
        specContent += ` — eksportuje: ${node.exports.slice(0, 5).join(', ')}`;
      }
      specContent += '\n';
    }
    specContent += `\nHash architektury: ${graph.hash}\n`;
    specContent += `Ostatnie skanowanie: ${new Date().toISOString()}\n`;

    const projectId = 'nexus-system-self';
    const existing = storage.getExperimentalProject(projectId);
    if (!existing) {
      const proj = {
        id: projectId,
        name: 'Nexus System',
        spec_content: specContent,
        ai_config: '{}',
      };
      storage.saveExperimentalProject(proj);
      console.log('[NexusSelfAnalyzer] Created "Nexus System" project');
    } else {
      // Aktualizuj jeśli hash się zmienił
      const oldHash = (existing.spec_content || '').match(/Hash architektury: ([a-f0-9]+)/)?.[1];
      if (oldHash !== graph.hash) {
        existing.spec_content = specContent;
        storage.saveExperimentalProject(existing);
        console.log('[NexusSelfAnalyzer] Updated "Nexus System" project');
      }
    }

    // Usuń stare nody/krawędzie i zapisz nowe
    const existingNodes = storage.getExperimentalNodes(projectId);
    for (const n of existingNodes) storage.deleteExperimentalNode(n.id);
    const existingEdges = storage.getExperimentalEdges(projectId);
    for (const e of existingEdges) storage.deleteExperimentalEdge(e.id);

    // Zapisz nody
    for (const node of graph.nodes) {
      const nodeId = `sys_${crypto.createHash('sha256').update(node.file).digest('hex').slice(0, 12)}`;
      storage.saveExperimentalNode({
        id: nodeId,
        project_id: projectId,
        title: node.file,
        content: node.exports.join(', ') || '(brak eksportow)',
        node_type: 'component',
        status: 'ready',
        x: Math.random() * 800,
        y: Math.random() * 600,
        width: 240,
        height: 80,
      });
    }

    // Zapisz krawedzie (przez ExperimentalEdge, jesli StorageEngine obsluguje)
    for (const edge of graph.edges) {
      const fromId = `sys_${crypto.createHash('sha256').update(edge.from).digest('hex').slice(0, 12)}`;
      const toId = `sys_${crypto.createHash('sha256').update(edge.to).digest('hex').slice(0, 12)}`;
      const edgeId = `sys_e_${crypto.createHash('sha256').update(`${edge.from}->${edge.to}`).digest('hex').slice(0, 12)}`;
      try {
        const expEdge = {
          id: edgeId,
          project_id: projectId,
          source_node_id: fromId,
          target_node_id: toId,
          label: edge.type,
          relation_type: 'depends_on' as const,
          source_handle: undefined as string | undefined,
          target_handle: undefined as string | undefined,
        };
        storage.saveExperimentalEdge(expEdge);
      } catch { /* edge storage not available */ }
    }

    console.log(`[NexusSelfAnalyzer] Saved ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
  } catch (err) {
    console.error('[NexusSelfAnalyzer] Failed:', err);
  }
}