// ============================================================================
// ElectronIpcBridge — Canvas Projekty
// Rejestruje IPC handlery wyłącznie dla trybu canvas-projekty.
// ============================================================================

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { StorageEngine } from '../storage/StorageEngine';
import type {
  Projekt,
  ProjektyNode,
  ProjektyEdge,
  ProjektyNodeAnnotation,
} from '../../types';

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
  }

  // =========================================================================
  // Canvas Projekty Handlers
  // =========================================================================
  private registerProjektyHandlers(): void {
    // Projects
    this.ipc.handle('projekty:project:save', async (_event: IpcMainInvokeEvent, payload: { project: Projekt }) => {
      try {
        this.storage.saveProjekt(payload.project);
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

  destroy(): void {
    const channels = [
      'projekty:project:save', 'projekty:project:get-all', 'projekty:project:get', 'projekty:project:delete',
      'projekty:node:save', 'projekty:node:get', 'projekty:node:delete',
      'projekty:edge:save', 'projekty:edge:get', 'projekty:edge:delete',
      'projekty:annotation:save', 'projekty:annotation:get', 'projekty:annotation:delete',
    ];

    for (const channel of channels) {
      this.ipc.removeHandler(channel);
    }
  }
}