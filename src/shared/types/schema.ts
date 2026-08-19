// ============================================================================
// NEXUS — Shared Schema Types
// Typy współdzielone używane przez moduły AI (src/main/ai)
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
  COMPLETED = 'COMPLETED',         // Agent zakończył zadanie
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

// === AI Provider / Model ==================================================
export enum AIProvider {
  GEMINI = 'GEMINI',
  OPENROUTER = 'OPENROUTER',  // OpenAI-kompatybilny (OpenRouter, lokalny proxy, cokolwiek)
  OLLAMA = 'OLLAMA',
  DEEPSEEK = 'DEEPSEEK',
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
    provider: AIProvider.OPENROUTER,
    label: 'DeepSeek V4 Flash',
    apiKey: 'not-needed',
    baseUrl: 'http://localhost:4570/v1',
    models: ['deepseek-ai/deepseek-v4-flash', 'deepseek-v4-flash', 'deepseek-chat'],
    isBuiltin: true,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
  {
    provider: AIProvider.OPENROUTER,
    label: 'DeepSeek V4 Pro',
    apiKey: 'not-needed',
    baseUrl: 'http://localhost:4570/v1',
    models: ['deepseek-ai/deepseek-v4-pro', 'deepseek-v4-pro', 'deepseek-reasoner'],
    isBuiltin: true,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
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