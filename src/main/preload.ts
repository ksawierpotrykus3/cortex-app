// ============================================================================
// NEXUS & SUPERVISOR — Preload Bridge
// ============================================================================

import { contextBridge, ipcRenderer } from 'electron';
import type { NexusBridge } from '../shared/types/ipc';

const nexusBridge: NexusBridge = {
  // Okno (frameless — własne przyciski)
  winMinimize: () => ipcRenderer.invoke('window:minimize'),
  winMaximize: () => ipcRenderer.invoke('window:maximize'),
  winClose: () => ipcRenderer.invoke('window:close'),
  winIsMaximized: () => ipcRenderer.invoke('window:is-maximized'),

  // Canvas Projekty
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

  // Supervisor AI
  supervisorRunChain: (payload) => ipcRenderer.invoke('supervisor:chain:run', payload),
  supervisorRun: (payload) => ipcRenderer.invoke('supervisor:run', payload),
  supervisorGetPipelines: () => ipcRenderer.invoke('supervisor:pipeline:get-all'),
  supervisorGetPipeline: (payload) => ipcRenderer.invoke('supervisor:pipeline:get', payload),
  supervisorSavePipeline: (payload) => ipcRenderer.invoke('supervisor:pipeline:save', payload),
  supervisorSaveDecision: (payload) => ipcRenderer.invoke('supervisor:decision:save', payload),
};

contextBridge.exposeInMainWorld('nexusBridge', nexusBridge);
