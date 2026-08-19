// ============================================================================
// NEXUS — IPC Typed Bridge (canvas-only)
// ============================================================================

import type { Projekt, ProjektyNode, ProjektyEdge, ProjektyNodeAnnotation } from '../../types';

export interface NexusBridge {
  projSaveProject: (payload: { project: Projekt }) => Promise<{ success: boolean }>;
  projGetProjects: () => Promise<Projekt[]>;
  projGetProject: (payload: { id: string }) => Promise<Projekt | null>;
  projDeleteProject: (payload: { id: string }) => Promise<{ success: boolean }>;

  projSaveNode: (payload: { node: ProjektyNode }) => Promise<{ success: boolean }>;
  projGetNodes: (payload: { projectId: string }) => Promise<ProjektyNode[]>;
  projDeleteNode: (payload: { id: string }) => Promise<{ success: boolean }>;

  projSaveEdge: (payload: { edge: ProjektyEdge }) => Promise<{ success: boolean }>;
  projGetEdges: (payload: { projectId: string }) => Promise<ProjektyEdge[]>;
  projDeleteEdge: (payload: { id: string }) => Promise<{ success: boolean }>;

  projSaveAnnotation: (payload: { annotation: ProjektyNodeAnnotation }) => Promise<{ success: boolean }>;
  projGetAnnotations: (payload: { nodeId: string }) => Promise<ProjektyNodeAnnotation[]>;
  projDeleteAnnotation: (payload: { id: string }) => Promise<{ success: boolean }>;
}