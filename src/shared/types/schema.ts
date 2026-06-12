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

// === Changelog Entry (UI) =================================================
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
} as const;
