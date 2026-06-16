// ============================================================================
// NEXUS — Shared Schema Types (Phase 1)
// Współdzielone typy dla Agentów, Outputów, Triggerów i Workflowów
// Używane zarówno przez backend (main), jak i frontend (renderer)
// ============================================================================

// === Agent Lifecycle States ================================================
export enum AgentStatus {
  ACTIVE = 'ACTIVE',       // Agent działa normalnie, przyjmuje triggery
  RUNNING = 'RUNNING',     // Agent aktualnie przetwarza zadanie
  SUSPENDED = 'SUSPENDED', // Agent wstrzymany ręcznie lub przez system
  CRASHED = 'CRASHED',     // Agent padł z powodu błędu
  DISABLED = 'DISABLED',   // Agent wyłączony na stałe (limit restartów)
  COOLDOWN = 'COOLDOWN',   // Agent odpoczywa po crashu przed restartem
  AWAITING_APPROVAL = 'AWAITING_APPROVAL', // Agent czeka na akceptację outputu
}

// === Trigger Types =========================================================
export enum TriggerType {
  MANUAL = 'MANUAL',           // Ręczne uruchomienie z UI
  HOTKEY = 'HOTKEY',           // Skrót klawiszowy
  TIMER = 'TIMER',             // Harmonogram czasowy
  CLIPBOARD = 'CLIPBOARD',     // Schowek ({{SCHOWEK}})
  FILE_WATCH = 'FILE_WATCH',   // Nowy plik w folderze
  AGENT_OUTPUT = 'AGENT_OUTPUT', // Output innego agenta
  WEBHOOK = 'WEBHOOK',         // Webhook z zewnątrz
}

export interface TriggerConfig {
  type: TriggerType;
  enabled: boolean;

  // Hotkey
  hotkey?: string; // np. "Ctrl+Shift+A"

  // Timer / Cron
  cron?: string;        // np. "0 15 * * *" (codziennie o 15:00)
  intervalMs?: number;  // np. 3600000 (co godzinę)

  // File watch
  watchPath?: string;
  watchPattern?: string; // glob pattern, np. "*.md"

  // Clipboard / Context
  useClipboard: boolean;
  useScreenshot: boolean;

  // Agent output trigger
  sourceAgentId?: string;
  condition?: string; // np. "contains 'error'" lub "rating >= 7"

  // Conditional logic (algebra boolowska)
  conditionExpression?: string; // np. "(clipboard contains 'code') AND (rating >= 7)"
  cooldownMs?: number; // opóźnienie przed odpaleniem
}

// === AI Provider / Model ==================================================
export enum AIProvider {
  GEMINI = 'GEMINI',
  OPENROUTER = 'OPENROUTER',  // OpenAI-kompatybilny (OpenRouter, lokalny proxy, cokolwiek)
  OLLAMA = 'OLLAMA',
}

// === Provider Configuration (API keys, endpoint URL) ======================
export interface ProviderAuthConfig {
  provider: AIProvider;
  label: string;               // Nazwa wyświetlana, np. "Mój OpenRouter"
  apiKey?: string;             // Klucz API (Gemini, OpenRouter)
  baseUrl?: string;            // Custom endpoint URL
  models: string[];            // Lista dostępnych modeli
  isBuiltin: boolean;          // True = domyślny (DeepSeek Free), nie do usunięcia
  createdAt: string;
  updatedAt: string;
}

// === Domyślne konfiguracje providerów =====================================
export const DEFAULT_PROVIDERS: ProviderAuthConfig[] = [
  {
    provider: AIProvider.GEMINI,
    label: 'Google Gemini',
    apiKey: '',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    models: ['gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-1.5-pro'],
    isBuiltin: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    provider: AIProvider.OPENROUTER,
    label: 'DeepSeek v4 Flash (darmowy)',
    apiKey: '',
    baseUrl: 'http://localhost:3458/v1',
    models: ['deepseek-v4-flash-free', 'deepseek-v4-flash'],
    isBuiltin: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    provider: AIProvider.OPENROUTER,
    label: 'OpenRouter BYOK (Claude Opus)',
    apiKey: '',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      'anthropic/claude-opus-4.6', 'anthropic/claude-sonnet-4.6',
      'anthropic/claude-3.5-sonnet', 'openai/gpt-4o',
      'deepseek/deepseek-chat', 'meta-llama/llama-3.3-70b-instruct',
    ],
    isBuiltin: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    provider: AIProvider.OLLAMA,
    label: 'Ollama (lokalny)',
    apiKey: '',
    baseUrl: 'http://localhost:11434/v1',
    models: ['llama3', 'mistral', 'mixtral', 'phi4'],
    isBuiltin: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export interface ModelConfig {
  provider: AIProvider;
  providerLabel: string;     // Która konfiguracja providera (po etykiecie)
  modelName: string;         // np. "gemini-2.0-flash", "claude-opus-4.6"
  temperature: number;       // 0.0 - 1.0
  maxTokens: number;
  topP: number;              // 0.0 - 1.0
}

// === Agent =================================================================
export interface Agent {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  promptTemplate: string;  // Prompt z {{SCHOWEK}}, {{INPUT:file}} itp.

  // Trigger
  trigger: TriggerConfig;

  // AI Model
  model: ModelConfig;

  // Safety
  maxRetries: number;      // Domyślnie 3
  cooldownSeconds: number; // Domyślnie 30
  budgetTokens: number;    // Limit tokenów na uruchomienie
  budgetDepth: number;     // Limit kroków myślenia

  // Output routing
  outputDestinations: OutputDestination[];

  // Metadata
  accentColor?: string;     // Kolor agenta w UI
  createdAt: string;        // ISO timestamp
  updatedAt: string;        // ISO timestamp
  lastRunAt?: string;       // ISO timestamp
  runCount: number;
  errorCount: number;
  rating: number;           // 0-10, średnia ocen

  // Tags
  tags: string[];

  // Context Config (F6.2)
  contextConfig?: ContextConfig;

  // Permissions (F6.1)
  permissions?: PermissionSet;

  // Execution Mode (#7 MicroVM)
  executionMode?: 'live' | 'sandbox';  // Domyślnie 'live'
}

// === Output Routing =======================================================
export enum OutputDestinationType {
  CHANGELOG = 'CHANGELOG',     // Domyślnie — prawa kolumna
  FILE = 'FILE',               // Zapis do pliku na dysku
  WEBHOOK = 'WEBHOOK',         // Wyślij na zewnętrzny URL
  AGENT = 'AGENT',             // Przekaż do innego agenta
  CLIPBOARD = 'CLIPBOARD',     // Kopiuj do schowka
  KNOWLEDGE = 'KNOWLEDGE',     // Dodaj do bazy wiedzy
}

// === Context Config (F6.2) ==================================================
export interface ContextSourceConfig {
  projectId?: string;           // Dla notes: filtr po projekcie
  status?: string;              // Dla tasks: filtr po statusie
  folderId?: string;            // Dla manuscripts: filtr po folderze
  count?: number;               // Dla history: liczba ostatnich outputów
  filePath?: string;            // Dla file: ścieżka
  agentId?: string;             // Dla agent_output: ID agenta źródłowego
  maxTokens?: number;           // Limit tokenów dla tego źródła
}

export interface ContextSelection {
  type: 'all' | 'ids';
  ids: string[];
}

export interface ContextSource {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  config?: ContextSourceConfig;
  selection?: ContextSelection; // NOWE: konkretne ID
}

export interface ContextEntityRef {
  type: 'node' | 'task' | 'draft';
  entityId: string;
}

export interface ContextConfig {
  sources: ContextSource[];
  maxTokens: number;                // limit kontekstu (dom. 8192)
  includeSystemPrompt: boolean;     // czy dołączać system prompt
  customInstructions: string;       // dodatkowe instrukcje dla agenta
  includedEntities?: ContextEntityRef[]; // F6.8: konkretne encje z workspace
  includeClipboardImage?: boolean;  // F6.8: dołącz obraz ze schowka
  includeLastAgentOutput?: boolean; // F6.8: dołącz output ostatniego agenta
}

export const DEFAULT_CONTEXT_CONFIG: ContextConfig = {
  sources: [
    { id: 'notes', label: 'Notatki (NexusNode)', description: 'Wybrane projekty lub wszystkie notatki', enabled: false, config: { projectId: '' } },
    { id: 'tasks', label: 'Zadania (Task)', description: 'Filtrowane po statusie', enabled: false, config: { status: '' } },
    { id: 'manuscripts', label: 'Manuskrypty (WritingDraft)', description: 'Wybrany folder lub wszystkie', enabled: false, config: { folderId: '' } },
    { id: 'history', label: 'Historia outputów agenta', description: 'Ostatnie N outputów', enabled: false, config: { count: 10 } },
    { id: 'clipboard', label: 'Schowek systemowy', description: 'Zawartość schowka systemowego', enabled: false, config: {} },
    { id: 'changelog', label: 'Zmiany od ostatniego uruchomienia', description: 'Z changeloga systemowego', enabled: false, config: {} },
    { id: 'file', label: 'Plik z dysku', description: 'Wczytaj zawartość pliku', enabled: false, config: { filePath: '' } },
    { id: 'agent_output', label: 'Wynik innego agenta', description: 'Output wybranego agenta', enabled: false, config: { agentId: '' } },
  ],
  maxTokens: 8192,
  includeSystemPrompt: true,
  customInstructions: '',
  includeClipboardImage: false,
  includeLastAgentOutput: false,
};

// === Permission Set (F6.1) =================================================
export interface PermissionSet {
  allowedTriggers: TriggerType[];              // [] = żaden trigger dozwolony
  allowedDestinations: OutputDestinationType[]; // [] = tylko changelog
  allowedModels: string[];                      // [] = wszystkie skonfigurowane modele
  maxTokensPerRun: number;                      // domyślnie 8192
  maxRunsPerMinute: number;                     // domyślnie 10
  requireApproval: boolean;                     // domyślnie false

  // Git permissions (#23) — agent ma dostęp do Gita
  gitAccess: boolean;                           // Czy agent może czytać git status/log/diff
  gitWrite: boolean;                            // Czy agent może commitować/pushować/merge'ować
}

export const DEFAULT_PERMISSION_SET: PermissionSet = {
  allowedTriggers: [],
  allowedDestinations: [],
  allowedModels: [],
  maxTokensPerRun: 8192,
  maxRunsPerMinute: 10,
  requireApproval: false,
  gitAccess: false,
  gitWrite: false,
};

export interface OutputDestination {
  type: OutputDestinationType;
  config: Record<string, string>; // np. { path: "/outputs/", url: "https://..." }
}

// === Agent Output (Log Entry) =============================================
export interface AgentOutput {
  id: string;
  agentId: string;
  agentName: string;
  status: AgentStatus;

  // Input
  prompt: string;           // Prompt po substytucji zmiennych
  contextSize: number;      // Liczba znaków kontekstu

  // Output
  content: string;          // Wygenerowany tekst
  tokensUsed: number;
  executionMs: number;      // Czas wykonania w ms

  // Metadata
  triggerType: TriggerType;
  modelName: string;
  rating: number;           // 0-10, thumb up/down
  approved: boolean | null; // true = thumb up, false = thumb down, null = brak oceny

  // Timestamps
  createdAt: string;        // ISO timestamp
  completedAt?: string;

  // Tags (auto-classified)
  tags: string[];

  // Error
  error?: string;           // Jeśli agent zakończył się błędem
  errorStack?: string;
}

// === Pipeline DAG (F6.12) =================================================
export type NodeType = 'llm-agent' | 'human-in-the-loop' | 'accumulator' | 'router' | 'condition' | 'system-reader' | 'system-writer' | 'browser-automate';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  name: string;
  agentId?: string;       // ID agenta do wykonania (dla llm-agent)
  systemPrompt?: string;
  config: Record<string, any>;
  position: { x: number; y: number };
  // #6: Warunki IF/THEN
  condition?: {
    /** Wyrażenie warunku: np. "{{prev.output}} contains 'error'" */
    expression: string;
    /** Gdy warunek jest true — wykonaj ten node. Gdy false — pomiń */
    mode: 'skip-when-false' | 'skip-when-true' | 'always';
  };
}

export interface PortConnection {
  id: string;
  sourceNodeId: string;
  sourcePort: string;
  targetNodeId: string;
  targetPort: string;
  condition?: string;
}

export interface Pipeline {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  connections: PortConnection[];
  createdAt: string;
  updatedAt: string;
  isHeadless: boolean;
}

// === Workspace Entity (F6.2) ==============================================
export interface WorkspaceEntity {
  id: string;
  type: 'node' | 'task' | 'draft' | 'wiki';
  title: string;
  content: string;
  projectId?: string;
  folderId?: string;
  status?: string;
  updatedAt: string;
}

// === Changelog Entry (UI) =================================================

// === KillSwitch (#9) =======================================================
export interface KillSwitchState {
  active: boolean;
  reason?: string;
  killedAt?: string;
  activeAgents: number;
  activePipelines: number;
  activeWorkflows: number;
}

export const DEFAULT_KILLSWITCH: KillSwitchState = {
  active: false,
  activeAgents: 0,
  activePipelines: 0,
  activeWorkflows: 0,
};

// === Semantic Search (AI) ==================================================
export interface SearchResult {
  entityId: string;
  entityType: 'node' | 'task' | 'draft' | 'wiki';
  title: string;
  snippet: string;
  relevance: number; // 0-1, jakie AI ocenia trafność
  viewMode: string;  // np. 'nexus', 'lab-todo', 'lab-writing', 'wiki'
}

export interface SearchConfig {
  searchPrompt: string;
  maxResults: number;
}

export const DEFAULT_SEARCH_CONFIG: SearchConfig = {
  searchPrompt: `Jesteś asystentem wyszukiwania w systemie Nexus.
Użytkownik zadaje pytanie lub wpisuje frazę.
Masz listę encji (notatki, taski, manuskrypty, artykuły wiki) z tytułami i treściami.
Zwróć tylko encje które są RELEVANT do zapytania użytkownika.
Dla każdej relevantnej encji podaj: jej ID, krótki snippet (2-3 zdania) dlaczego pasuje, i relevance score (0.0-1.0).
Odpowiadaj w formacie JSON: [{"entityId":"...","entityType":"...","title":"...","snippet":"...","relevance":0.0}]
Jeśli żadna encja nie pasuje, zwróć pustą tablicę [].`,
  maxResults: 10,
};

// === Dry-Run (#10) ==========================================================
export interface DryRunResult {
  pipelineId: string;
  nodes: DryRunNodeResult[];
  status: 'success' | 'failed';
  totalDuration: number; // ms
}

export interface DryRunNodeResult {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  condition?: string;
  conditionResult?: boolean | null;
  skipped: boolean;
  /** Symulowany output — opis co by się stało */
  simulatedOutput: string;
  estimatedTokens: number;
  estimatedDuration: number; // ms
}

export interface DryRunConfig {
  /** Jeśli true — symuluj output agentów (zamiast "no LLM") */
  simulateAgentOutput: boolean;
  /** Jeśli true — przerywaj na pierwszym błędzie */
  stopOnFirstError: boolean;
}

export const DEFAULT_DRY_RUN_CONFIG: DryRunConfig = {
  simulateAgentOutput: true,
  stopOnFirstError: false,
};

export interface ChangelogEntry {
  id: string;
  agentId: string;
  agentName: string;
  agentColor?: string;

  // Stream
  isStreaming: boolean;
  streamedContent: string;  // Aktualna treść podczas streamowania

  // Final
  output?: AgentOutput;

  // Timestamp
  createdAt: string;
}

// === Triage ===============================================================
export enum TriagePriority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export interface TriageItem {
  id: string;
  output: AgentOutput;
  priority: TriagePriority;
  tags: string[];
  status: 'pending' | 'approved' | 'rejected' | 'routed';
  routedTo?: string;
  createdAt: string;
}

// === Git Integration (#23) =================================================
export interface GitConfig {
  remoteUrl: string;
  accessToken: string;
  authorName: string;
  authorEmail: string;
  autoCommit: boolean;
  autoCommitMessage: string; // Template, np. "Auto-commit: {{summary}}"
  aiBranchName: string;      // Branch dla AI, np. "ai-agent"
  enabled: boolean;
  // Schedule / cyclic
  pullIntervalMs: number;    // 0 = wyłączone, np. 300000 = co 5 min
  pushIntervalMs: number;    // 0 = wyłączone
  scheduleOnlyOnBranch: string; // "" = wszystkie branche
}

export interface GitStatusEntry {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
  staged: boolean;
}

export interface GitStatusResult {
  branch: string;
  clean: boolean;
  entries: GitStatusEntry[];
  ahead: number;
  behind: number;
}

export interface GitLogEntry {
  hash: string;
  author: string;
  message: string;
  date: string;
  refs: string; // np. "HEAD -> master, origin/master"
}

export interface GitBranchInfo {
  name: string;
  current: boolean;
  upstream?: string;
  ahead: number;
  behind: number;
}

export const DEFAULT_GIT_CONFIG: GitConfig = {
  remoteUrl: '',
  accessToken: '',
  authorName: '',
  authorEmail: '',
  autoCommit: false,
  autoCommitMessage: 'Nexus AI: {{summary}}',
  aiBranchName: 'ai-agent',
  enabled: false,
  pullIntervalMs: 0,
  pushIntervalMs: 0,
  scheduleOnlyOnBranch: '',
};

// === Feedback (#26) ========================================================
export interface FeedbackEntry {
  id: string;
  title: string;
  context?: string;
  suggestion?: string;
  timestamp: string;
  entityType: 'agent' | 'node' | 'task' | 'manuscript' | 'general';
  entityId?: string;
  entityLabel?: string;
  contextSnapshot?: {
    viewMode: string;
    selectedAgentId: string | null;
    selectedNodeId: string | null;
    selectedTaskId: string | null;
    selectedManuscriptId: string | null;
    projectId: string | null;
    lastAction: string;
  };
  rating?: number;
  status: 'new' | 'read' | 'in-progress' | 'done';
}

// === Downloaded Files (#27 Playwright) ======================================
export interface DownloadedFileRecord {
  id: string;
  /** URL strony z której pobrano plik */
  sourceUrl: string;
  /** Oryginalna nazwa pliku */
  originalName: string;
  /** Ścieżka gdzie plik został skopiowany (storage/files/{id}/{name}) */
  storedPath: string;
  /** MIME type pliku */
  mime: string;
  /** Rozmiar w bajtach */
  sizeBytes: number;
  /** Dodatkowe metadane (np. agentId, pipelineId, workflowId) */
  metadata: Record<string, any>;
  /** ISO timestamp */
  downloadedAt: string;
  /** SHA256 checksum */
  checksum?: string;
}

// === IPC Event Names ======================================================
export const IPC_EVENTS = {
  // Agent commands (Renderer → Main)
  EXECUTE_AGENT: 'agent:execute',
  STOP_AGENT: 'agent:stop',
  CREATE_AGENT: 'agent:create',
  UPDATE_AGENT: 'agent:update',
  DELETE_AGENT: 'agent:delete',
  GET_AGENTS: 'agent:get-all',
  GET_AGENT: 'agent:get',

  // Agent output (Main → Renderer)
  AGENT_OUTPUT: 'agent:output',
  AGENT_STATUS: 'agent:status',
  AGENT_STREAM: 'agent:stream',

  // Changelog
  CHANGELOG_NEW: 'changelog:new',
  CHANGELOG_APPROVE: 'changelog:approve',
  CHANGELOG_REJECT: 'changelog:reject',

  // Storage
  STORAGE_SAVE: 'storage:save',
  STORAGE_LOAD: 'storage:load',

  // Context Builder (F6.2)
  CONTEXT_GET_OPTIONS: 'context:get-options',
  CONTEXT_FETCH: 'context:fetch',
  CONTEXT_SEARCH_NODES: 'context:search-nodes',
  CONTEXT_SEARCH_TASKS: 'context:search-tasks',

  // Context Builder (F6.8)
  GET_WORKSPACE_ENTITIES: 'agent:get-workspace-entities',

  // Context Builder (F6.2) — sync
  WORKSPACE_SYNC: 'workspace:sync',
  WORKSPACE_GET_ALL: 'workspace:get-all',

  // KillSwitch (#9)
  KILLSWITCH_STATUS: 'killswitch:status',
  KILLSWITCH_ACTIVATE: 'killswitch:activate',
  KILLSWITCH_DEACTIVATE: 'killswitch:deactivate',

  // Git (#23)
  GIT_GET_CONFIG: 'git:get-config',
  GIT_SET_CONFIG: 'git:set-config',
  GIT_TEST_CONNECTION: 'git:test-connection',
  GIT_STATUS: 'git:status',
  GIT_LOG: 'git:log',
  GIT_COMMIT: 'git:commit',
  GIT_PUSH: 'git:push',
  GIT_PULL: 'git:pull',
  GIT_BRANCH_LIST: 'git:branch-list',
  GIT_BRANCH_SWITCH: 'git:branch-switch',
  GIT_BRANCH_CREATE: 'git:branch-create',
  GIT_MERGE: 'git:merge',
  GIT_DIFF: 'git:diff',
  GIT_SCHEDULE_STATUS: 'git:schedule-status',
  GIT_SCHEDULE_TOGGLE: 'git:schedule-toggle',

  // Browser (#27 Playwright)
  BROWSER_EXTRACT_DOM: 'browser:extract-dom',
  BROWSER_TEST_MACRO: 'browser:test-macro',
  BROWSER_DOWNLOAD_AND_SAVE: 'browser:download-and-save',
  BROWSER_SAVE_FILES: 'browser:save-files',
  BROWSER_GET_DOWNLOADED_FILES: 'browser:get-downloaded-files',
  BROWSER_DELETE_FILE: 'browser:delete-file',
} as const;
