// ============================================================================
// NEXUS & SUPERVISOR — IPC Typed Bridge
// ============================================================================

import type { Projekt, ProjektyNode, ProjektyEdge, ProjektyNodeAnnotation } from '../../types';
import type { Lancuch, DecyzjaPayload } from '../../supervisor/types';

export interface NexusBridge {
  // Okno (frameless — własne przyciski)
  winMinimize: () => Promise<void>;
  winMaximize: () => Promise<boolean>;
  winClose: () => Promise<void>;
  winIsMaximized: () => Promise<boolean>;

  // Canvas Projekty
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

  // Supervisor AI (Real Filesystem data/pipelines)
  supervisorRunChain: (payload: { pipelineId: string; zlecenieDane?: Record<string, unknown> }) => Promise<{ success: boolean; output?: string; error?: string }>;
  supervisorRun: (payload: { pipelineId: string; zlecenieDane?: Record<string, unknown> }) => Promise<{ success: boolean; output?: string; error?: string }>;
  supervisorGetPipelines: () => Promise<Lancuch[]>;
  supervisorGetPipeline: (payload: { id: string }) => Promise<Lancuch | null>;
  supervisorSavePipeline: (payload: { pipeline: Lancuch }) => Promise<{ success: boolean }>;
  supervisorSaveDecision: (payload: DecyzjaPayload) => Promise<{ success: boolean }>;
}
