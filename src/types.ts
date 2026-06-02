export type ViewMode = 'nexus' | 'lab-todo' | 'lab-writing' | 'sandbox' | 'raw-fragments';
export type RightPanelState = 'none' | 'axioms' | 'properties';
export type ModalState = 'none' | 'export' | 'settings';

export interface NexusAnnotation {
  id: string;
  category: 'comment' | 'raw-fragment' | 'issue';
  content: string;
  author: 'user' | 'ai';
  timestamp: string;
}

export interface NexusNode {
  id: string;
  title: string;
  content: string;
  x: number;
  y: number;
  width?: number;
  fontFamily?: 'sans' | 'serif' | 'mono';
  projectId?: string;
  layerId?: string;
  accent?: 'blue' | 'purple' | 'none';
  annotations?: NexusAnnotation[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'Unresolved' | 'In Progress' | 'Resolved';
  priority: 'Low' | 'Medium' | 'Critical';
  updatedAt: string;
  listId?: string;
}

export interface WritingDraft {
  id: string;
  content: string;
  words: number;
  updatedAt: string;
  manuscriptId?: string;
}

export interface NexusLink {
  source: string;
  target: string;
}
