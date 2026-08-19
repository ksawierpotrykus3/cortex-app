// ============================================================================
// NEXUS — Preload (canvas-only bridge)
// ============================================================================

import { contextBridge, ipcRenderer } from 'electron';
import type { NexusBridge } from '../shared/types/ipc';

const nexusBridge: NexusBridge = {
  projSaveProject: (payload) => ipcRenderer.invoke('projekty:project:save', payload),
  projGetProjects: () => ipcRenderer.invoke('projekty:project:get-all'),
  projGetProject: (payload) => ipcRenderer.invoke('projekty:project:get', payload),
  projDeleteProject: (payload) => ipcRenderer.invoke('projekty:project:delete', payload),

  projSaveNode: (payload) => ipcRenderer.invoke('projekty:node:save', payload),
  projGetNodes: (payload) => ipcRenderer.invoke('projekty:node:get', payload),
  projDeleteNode: (payload) => ipcRenderer.invoke('projekty:node:delete', payload),

  projSaveEdge: (payload) => ipcRenderer.invoke('projekty:edge:save', payload),
  projGetEdges: (payload) => ipcRenderer.invoke('projekty:edge:get', payload),
  projDeleteEdge: (payload) => ipcRenderer.invoke('projekty:edge:delete', payload),

  projSaveAnnotation: (payload) => ipcRenderer.invoke('projekty:annotation:save', payload),
  projGetAnnotations: (payload) => ipcRenderer.invoke('projekty:annotation:get', payload),
  projDeleteAnnotation: (payload) => ipcRenderer.invoke('projekty:annotation:delete', payload),
};

contextBridge.exposeInMainWorld('nexusBridge', nexusBridge);