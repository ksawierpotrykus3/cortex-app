// ============================================================================
// ElectronIpcBridge — Canvas Projekty & AI Supervisor
// Rejestruje IPC handlery dla canvasu oraz modułu nadzoru łańcuchów AI.
// ============================================================================

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { StorageEngine } from '../storage/StorageEngine';
import type {
  Projekt,
  ProjektyNode,
  ProjektyEdge,
  ProjektyNodeAnnotation,
} from '../../types';
import type { Lancuch, DecyzjaPayload } from '../../supervisor/types';

// Ścieżka do katalogu useme_core (sibling cortex-app), gdzie leży chain_executor.py.
// Zakładamy, że proces startuje z katalogu głównego projektu (cortex-app).
const USEME_CORE_DIR = path.join(process.cwd(), '..', 'useme_core');

export class ElectronIpcBridge {
  constructor(
    private ipc: typeof ipcMain,
    private storage: StorageEngine,
  ) {}

  /**
   * Rejestruje wszystkie IPC handlery.
   */
  registerHandlers(): void {
    this.registerProjektyHandlers();
    this.registerSupervisorHandlers();
  }

  // =========================================================================
  // Canvas Projekty Handlers
  // =========================================================================
  private registerProjektyHandlers(): void {
    // Projects
    this.ipc.handle('projekty:project:save', async (_event: IpcMainInvokeEvent, payload: { project?: Projekt } & Projekt) => {
      try {
        const proj = payload?.project || payload;
        if (!proj || !proj.id) {
          throw new Error('Invalid project payload in projekty:project:save: missing id');
        }
        this.storage.saveProjekt(proj);
        return { success: true };
      } catch (err) {
        console.error('[projekty:project:save]', err);
        return { success: false };
      }
    });

    this.ipc.handle('projekty:project:get-all', async () => {
      try {
        return this.storage.getProjekts();
      } catch (err) {
        console.error('[projekty:project:get-all]', err);
        return [];
      }
    });

    this.ipc.handle('projekty:project:get', async (_event: IpcMainInvokeEvent, payload: { id: string }) => {
      try {
        return this.storage.getProjekt(payload.id);
      } catch (err) {
        console.error('[projekty:project:get]', err);
        return null;
      }
    });

    this.ipc.handle('projekty:project:delete', async (_event: IpcMainInvokeEvent, payload: { id: string }) => {
      try {
        this.storage.deleteProjekt(payload.id);
        return { success: true };
      } catch (err) {
        console.error('[projekty:project:delete]', err);
        return { success: false };
      }
    });

    // Nodes
    this.ipc.handle('projekty:node:save', async (_event: IpcMainInvokeEvent, payload: { node: ProjektyNode }) => {
      try {
        this.storage.saveProjektyNode(payload.node);
        return { success: true };
      } catch (err) {
        console.error('[projekty:node:save]', err);
        return { success: false };
      }
    });

    this.ipc.handle('projekty:node:get', async (_event: IpcMainInvokeEvent, payload: { projectId: string }) => {
      try {
        return this.storage.getProjektyNodes(payload.projectId);
      } catch (err) {
        console.error('[projekty:node:get]', err);
        return [];
      }
    });

    this.ipc.handle('projekty:node:delete', async (_event: IpcMainInvokeEvent, payload: { id: string }) => {
      try {
        this.storage.deleteProjektyNode(payload.id);
        return { success: true };
      } catch (err) {
        console.error('[projekty:node:delete]', err);
        return { success: false };
      }
    });

    // Edges
    this.ipc.handle('projekty:edge:save', async (_event: IpcMainInvokeEvent, payload: { edge: ProjektyEdge }) => {
      try {
        this.storage.saveProjektyEdge(payload.edge);
        return { success: true };
      } catch (err) {
        console.error('[projekty:edge:save]', err);
        return { success: false };
      }
    });

    this.ipc.handle('projekty:edge:get', async (_event: IpcMainInvokeEvent, payload: { projectId: string }) => {
      try {
        return this.storage.getProjektyEdges(payload.projectId);
      } catch (err) {
        console.error('[projekty:edge:get]', err);
        return [];
      }
    });

    this.ipc.handle('projekty:edge:delete', async (_event: IpcMainInvokeEvent, payload: { id: string }) => {
      try {
        this.storage.deleteProjektyEdge(payload.id);
        return { success: true };
      } catch (err) {
        console.error('[projekty:edge:delete]', err);
        return { success: false };
      }
    });

    // Node Annotations
    this.ipc.handle('projekty:annotation:save', async (_event: IpcMainInvokeEvent, payload: { annotation: ProjektyNodeAnnotation }) => {
      try {
        this.storage.saveProjektyNodeAnnotation(payload.annotation);
        return { success: true };
      } catch (err) {
        console.error('[projekty:annotation:save]', err);
        return { success: false };
      }
    });

    this.ipc.handle('projekty:annotation:get', async (_event: IpcMainInvokeEvent, payload: { nodeId: string }) => {
      try {
        return this.storage.getProjektyNodeAnnotations(payload.nodeId);
      } catch (err) {
        console.error('[projekty:annotation:get]', err);
        return [];
      }
    });

    this.ipc.handle('projekty:annotation:delete', async (_event: IpcMainInvokeEvent, payload: { id: string }) => {
      try {
        this.storage.deleteProjektyNodeAnnotation(payload.id);
        return { success: true };
      } catch (err) {
        console.error('[projekty:annotation:delete]', err);
        return { success: false };
      }
    });
  }

  // =========================================================================
  // AI Supervisor Handlers (Real Filesystem data/pipelines)
  // =========================================================================
  private registerSupervisorHandlers(): void {
    this.ipc.handle('supervisor:pipeline:get-all', async () => {
      try {
        return this.storage.getPipelines();
      } catch (err) {
        console.error('[supervisor:pipeline:get-all]', err);
        return [];
      }
    });

    this.ipc.handle('supervisor:pipeline:get', async (_event: IpcMainInvokeEvent, payload: { id: string }) => {
      try {
        return this.storage.getPipeline(payload.id);
      } catch (err) {
        console.error('[supervisor:pipeline:get]', err);
        return null;
      }
    });

    this.ipc.handle('supervisor:pipeline:save', async (_event: IpcMainInvokeEvent, payload: { pipeline: Lancuch }) => {
      try {
        this.storage.savePipeline(payload.pipeline);
        return { success: true };
      } catch (err) {
        console.error('[supervisor:pipeline:save]', err);
        return { success: false };
      }
    });

    this.ipc.handle('supervisor:decision:save', async (_event: IpcMainInvokeEvent, payload: DecyzjaPayload) => {
      try {
        this.storage.saveDecision(payload);
        return { success: true };
      } catch (err) {
        console.error('[supervisor:decision:save]', err);
        return { success: false };
      }
    });

    this.ipc.handle('supervisor:chain:run', async (_event: IpcMainInvokeEvent, payload: { pipelineId: string; zlecenieDane?: Record<string, unknown> }) => {
      try {
        const output = await this.runPythonChain(payload.pipelineId, payload.zlecenieDane);
        return { success: true, output };
      } catch (err) {
        console.error('[supervisor:chain:run]', err);
        return { success: false, error: String(err) };
      }
    });

    // Uniwersalne uruchomienie automatyzacji — czyta pole `uruchom` z definicji
    // i odpala dowolną komendę (python, .bat, node, .exe itd.). Bez tego pola
    // fallback do domyślnego silnika łańcucha AI (chain_executor.py).
    this.ipc.handle('supervisor:run', async (_event: IpcMainInvokeEvent, payload: { pipelineId: string; zlecenieDane?: Record<string, unknown> }) => {
      try {
        const output = await this.runAutomation(payload.pipelineId, payload.zlecenieDane);
        return { success: true, output };
      } catch (err) {
        console.error('[supervisor:run]', err);
        return { success: false, error: String(err) };
      }
    });
  }

  /**
   * Uniwersalne uruchomienie automatyzacji.
   * Czyta pole `uruchom` z definicji potoku (data/pipelines/<id>.json) i odpala
   * wskazaną komendę. Jeśli pola nie ma — fallback do chain_executor.py.
   */
  private async runAutomation(pipelineId: string, zlecenieDane?: Record<string, unknown>): Promise<string> {
    const pipeline = this.storage.getPipeline(pipelineId);
    const uruchom = pipeline?.uruchom;

    if (!uruchom) {
      return this.runPythonChain(pipelineId, zlecenieDane);
    }

    const args = uruchom.args ? [...uruchom.args] : [];
    let tmpDataPath: string | null = null;
    if (zlecenieDane) {
      const cwd = uruchom.cwd || USEME_CORE_DIR;
      tmpDataPath = path.join(cwd, `.zlecenie-${pipelineId}-${Date.now()}.json`);
      fs.writeFileSync(tmpDataPath, JSON.stringify(zlecenieDane, null, 2), 'utf-8');
      args.push(tmpDataPath);
    }

    return new Promise((resolve, reject) => {
      const child = spawn(uruchom.komenda, args, {
        cwd: uruchom.cwd || USEME_CORE_DIR,
        windowsHide: true,
        shell: process.platform === 'win32',
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      child.on('error', (err) => {
        if (tmpDataPath && fs.existsSync(tmpDataPath)) fs.unlinkSync(tmpDataPath);
        reject(err);
      });

      child.on('close', (code) => {
        if (tmpDataPath && fs.existsSync(tmpDataPath)) fs.unlinkSync(tmpDataPath);
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(stderr.trim() || `Proces zakończony kodem ${code}`));
        }
      });
    });
  }

  /**
   * Odpala łańcuch AI: python chain_executor.py <pipelineId> [dane.json].
   * Dane zlecenia (opcjonalne) zapisujemy do tymczasowego pliku JSON.
   */
  private runPythonChain(pipelineId: string, zlecenieDane?: Record<string, unknown>): Promise<string> {
    return new Promise((resolve, reject) => {
      const executorPath = path.join(USEME_CORE_DIR, 'chain_executor.py');
      if (!fs.existsSync(executorPath)) {
        reject(new Error(`Nie znaleziono chain_executor.py w ${USEME_CORE_DIR}`));
        return;
      }

      const args = [executorPath, pipelineId];

      let tmpDataPath: string | null = null;
      if (zlecenieDane) {
        tmpDataPath = path.join(USEME_CORE_DIR, `.zlecenie-${pipelineId}-${Date.now()}.json`);
        fs.writeFileSync(tmpDataPath, JSON.stringify(zlecenieDane, null, 2), 'utf-8');
        args.push(tmpDataPath);
      }

      const child = spawn('python', args, {
        cwd: USEME_CORE_DIR,
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      child.on('error', (err) => {
        if (tmpDataPath && fs.existsSync(tmpDataPath)) fs.unlinkSync(tmpDataPath);
        reject(err);
      });

      child.on('close', (code) => {
        if (tmpDataPath && fs.existsSync(tmpDataPath)) fs.unlinkSync(tmpDataPath);
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(stderr.trim() || `Proces zakończony kodem ${code}`));
        }
      });
    });
  }

  destroy(): void {
    const channels = [
      'projekty:project:save', 'projekty:project:get-all', 'projekty:project:get', 'projekty:project:delete',
      'projekty:node:save', 'projekty:node:get', 'projekty:node:delete',
      'projekty:edge:save', 'projekty:edge:get', 'projekty:edge:delete',
      'projekty:annotation:save', 'projekty:annotation:get', 'projekty:annotation:delete',
      'supervisor:pipeline:get-all', 'supervisor:pipeline:get', 'supervisor:pipeline:save', 'supervisor:decision:save', 'supervisor:chain:run', 'supervisor:run',
    ];

    for (const channel of channels) {
      this.ipc.removeHandler(channel);
    }
  }
}
