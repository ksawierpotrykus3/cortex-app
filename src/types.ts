export type ViewMode = 'nexus' | 'lab-todo' | 'lab-writing' | 'sandbox' | 'raw-fragments' | 'logs' | 'draft' | 'agents' | 'changes' | 'wiki' | 'git' | 'pipeline' | 'workflows';
export type RightPanelState = 'none' | 'axioms' | 'properties';
export type ModalState = 'none' | 'export' | 'settings';

export type ThoughtMarker = 'certain' | 'hypothesis' | 'question' | 'answer';

export type ChangeType = 'create' | 'update' | 'delete' | 'export' | 'ai_output';
export type ChangeEntityType = 'node' | 'task' | 'draft' | 'manuscript' | 'agent_output';

export interface ChangeEntry {
  id: string;
  type: ChangeType;
  entityType: ChangeEntityType;
  entityId: string;
  summary: string;
  description?: string;
  timestamp: string;
  userId?: 'user' | 'ai';
  metadata?: Record<string, unknown>;
}

export interface ContextSnapshot {
  viewMode: ViewMode;
  selectedAgentId: string | null;
  selectedNodeId: string | null;
  selectedTaskId: string | null;
  selectedManuscriptId: string | null;
  projectId: string | null;
  lastAction: string;
}

export interface FeedbackEntry {
  id: string;
  title: string;
  context?: string;
  suggestion?: string;
  timestamp: string;
  entityType: 'agent' | 'node' | 'task' | 'manuscript' | 'general';
  entityId?: string;
  entityLabel?: string;
  contextSnapshot?: ContextSnapshot;
  rating?: number; // 1-5
  status: 'new' | 'read' | 'in-progress' | 'done';
}

export interface WikiArticle {
  id: string;
  title: string;
  content: string;
  tags: string[];
  category: string;
  createdAt: string;
  updatedAt: string;
  sourceRefs?: SourceReference[];
  aiContext?: string;
}

export interface ImageAttachment {
  id: string;
  dataUrl: string;
  mimeType: string;
  geminiResponse?: string;
  geminiError?: string;
  isProcessing: boolean;
  createdAt: string;
}

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
  height?: number;
  collapsed?: boolean;
  cleanImageMode?: boolean;
  fontFamily?: 'sans' | 'serif' | 'mono';
  projectId?: string;
  layerId?: string;
  accent?: 'blue' | 'purple' | 'none';
  annotations?: NexusAnnotation[];
  imageAttachments?: ImageAttachment[];
  thoughtMarkers?: ThoughtMarker[];
  tags?: string[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'Unresolved' | 'In Progress' | 'Resolved';
  priority: 'Low' | 'Medium' | 'Critical';
  updatedAt: string;
  listId?: string;
  annotations?: NexusAnnotation[];
  thoughtMarkers?: ThoughtMarker[];
}

export interface WritingDraft {
  id: string;
  content: string;
  words: number;
  updatedAt: string;
  manuscriptId?: string;
  folderId?: string;
  tabId?: string;
  replyTo?: string;
  annotations?: NexusAnnotation[];
  thoughtMarkers?: ThoughtMarker[];
}

export interface NexusLink {
  source: string;
  target: string;
}

export interface ManuscriptFolder {
  id: string;
  name: string;
  parentId?: string;
  order: number;
}

export interface ManuscriptTab {
  id: string;
  manuscriptId: string;
  name: string;
  order: number;
  createdAt: string;
}

export interface SourceReference {
  id: string;
  originalDraftId?: string;
  originalText: string;
  createdAt: string;
}

export interface ManuscriptMeta {
  manuscriptId: string;
  aiContext?: string;
  sourceRefs?: SourceReference[];
}

// --- Export Types (F5.2) ---
export interface ExportScope {
  nodes: boolean;
  links: boolean;
  tasks: boolean;
  drafts: boolean;
  axioms: boolean;
  images: boolean;
  onlySelected: boolean;
}

export const DEFAULT_EXPORT_SCOPE: ExportScope = {
  nodes: true,
  links: true,
  tasks: false,
  drafts: false,
  axioms: true,
  images: true,
  onlySelected: false,
};

// --- NXS-ENG-001 (Node-Based AI Engine Types) ---

export type AgentRole = 'writer' | 'researcher' | 'critic' | 'auditor' | 'tool-executor';
export type NodeType = 'llm-agent' | 'human-in-the-loop' | 'accumulator' | 'router' | 'system-reader' | 'system-writer' | 'condition' | 'browser-automate';

export interface PipelinePayload<T = unknown> {
  data: T; // Structured JSON object passed between nodes
  metadata: {
    hopCount: number;
    tokensUsed: number;
    correlationId: string;
    sourceNodeId: string;
  };
  contextSelection?: {
    tags: string[];
    specificNoteIds: string[];
  };
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  name: string;
  role?: AgentRole;
  agentId?: string;
  systemPrompt?: string;
  config: Record<string, any>;
  position: { x: number; y: number };
  condition?: {
    expression: string;
    mode: 'skip-when-false' | 'skip-when-true' | 'always';
  };
}

export interface PortConnection {
  id: string;
  sourceNodeId: string;
  sourcePort: string;
  targetNodeId: string;
  targetPort: string;
  condition?: string; // Optional evaluation expression for routers
}

export interface Pipeline {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  connections: PortConnection[];
  createdAt: string;
  updatedAt: string;
  isHeadless: boolean; // true if running via EventBus (Zbrojownia)
}

// Time Travel & IndexedDB Types
export interface NodeSnapshot {
  id: string;             // Primary Key (UUIDv7)
  pipelineId: string;
  parentId: string | null; // For DAG Pruner (Fork and Resume)
  nodeId: string;
  state: PipelinePayload;
  timestamp: number;
  logs: string[];
}

// HitL Communication Protocol
export interface HitLPayload {
  targetPath: string;
  originalSource: string;
  proposedSource: string;
  diffSummary?: string;
}

export interface HitLMessage {
  type: 'HITL_FILE_EDIT_REQUEST' | 'HITL_RESPONSE';
  correlationId: string;
  payload?: HitLPayload;
  status?: 'APPROVED' | 'DENIED' | 'TIMEOUT';
  error?: string;
}
