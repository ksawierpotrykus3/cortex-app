export type ViewMode = 'nexus' | 'lab-todo' | 'lab-writing' | 'sandbox' | 'raw-fragments' | 'logs' | 'agents' | 'mermaid-plan' | 'changes' | 'wiki' | 'git' | 'feedback' | 'useme' | 'experimental' | 'system';
export type RightPanelState = 'none' | 'properties';
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
  feedbackType?: 'idea' | 'problem';
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

// --- Tryb Eksperymentalny Types ---

export interface ExperimentalAIConfig {
  chatModel?: string; // e.g. 'DeepSeek V4 Pro' | 'DeepSeek V4 Flash'
  plannerModel?: string; // osobny model dla Planera
  chatSystemPrompt?: string; // AI #1
  mapPlannerSystemPrompt?: string; // AI #3
}

export interface ExperimentalProject {
  id: string;
  name: string;
  spec_content: string;
  ai_config: ExperimentalAIConfig | string;
  created_at?: string;
  updated_at?: string;
}

export interface ExperimentalConversation {
  id: string;
  project_id: string;
  name: string;
  created_at?: string;
}

export interface ExperimentalChatMessage {
  id: string;
  project_id: string;
  conversation_id?: string;
  role: 'user' | 'ai' | 'system';
  content: string;
  extracted_to_spec?: number;
  extracted_to_canvas?: number;
  created_at?: string;
  metadata?: Record<string, unknown>;
}

export type NodeType = 'root' | 'domain' | 'component' | 'task' | 'integration' | 'note';
export type NodeStatus = 'new' | 'in_progress' | 'ready' | 'deprecated';
export type RelationType = 'requires' | 'depends_on' | 'data_flow' | 'sync' | 'supports';

export interface NodeMetadata {
  is_leaf?: boolean;
  stack?: string[];
  author?: 'user' | 'ai';
  associated_task_id?: string;
  timestamp?: string;
}

export interface ExperimentalNode {
  id: string;
  project_id: string;
  title: string;
  content: string;
  // Nowe pola z protokolu
  label?: string;
  description?: string;
  node_type?: NodeType;
  status?: NodeStatus;
  metadata?: NodeMetadata | string;
  parent_id?: string | null;
  x: number;
  y: number;
  width?: number;
  height?: number;
  collapsed?: number;
  source_message_id?: string | null;
  source_conversation_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ExperimentalEdge {
  id: string;
  project_id: string;
  source_node_id: string;
  target_node_id: string;
  label?: string;
  // Nowe pola z protokolu
  relation_type?: RelationType;
  source_handle?: string;
  target_handle?: string;
  created_at?: string;
}

// Kontekst globalny z Fazy 1 (analiza SPEC)
export interface GlobalContext {
  project_name: string;
  mandatory_stack: string[];
  out_of_scope: string[];
  actors: { role: string; description: string }[];
  integrations: { system: string; type: string; purpose: string }[];
  data_io: { inputs: string[]; outputs: string[] };
}

// Wynik generatora notatek
export interface NoteGenerationResult {
  node: {
    id: string;
    parent_id: string | null;
    type: 'note';
    status: 'ready';
    label: string;
    description: string;
    metadata: NodeMetadata;
  };
  edge?: {
    id: string;
    source: string;
    target: string;
    relation_type: 'supports';
  };
}

export interface ExperimentalChangelog {
  id: string;
  project_id: string;
  action_type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity_type: 'NODE' | 'EDGE' | 'SPEC';
  entity_id: string;
  summary: string;
  source_message_id?: string | null;
  created_at?: string;
}

export interface ExperimentalNodeAnnotation {
  id: string;
  node_id: string;
  project_id: string;
  content: string;
  created_at?: string;
}

