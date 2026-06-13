// ============================================================================
// NEXUS — WORKFLOW (#1) — Typy danych
// ============================================================================

/** Tryb wykonania workflow */
export type WorkflowMode = 'sandbox' | 'live';

/** Trigger uruchamiający workflow */
export type WorkflowTriggerType =
  | 'manual'
  | 'on_approve'         // Gdy output agenta zostanie zaakceptowany
  | 'on_reject'          // Gdy output agenta zostanie odrzucony
  | 'on_rating'          // Gdy rating outputu przekroczy próg
  | 'on_agent_complete'  // Gdy agent zakończy działanie (zawsze)
  | 'scheduled'          // O ustalonej godzinie / interwale cron
  | 'webhook'            // Zewnętrzny webhook woła endpoint
  ;

/** Operator porównania dla warunków */
export type ConditionOperator =
  | 'gt' | 'gte' | 'lt' | 'lte'    // liczbowe: > >= < <=
  | 'eq' | 'neq'                    // równe / nie równe
  | 'contains'                      // string zawiera
  | 'matches'                       // regex dopasowuje
  | 'exists' | 'not_exists'         // czy pole istnieje
  | 'true' | 'false'                // boolean
  ;

/** Źródło wartości dla warunku */
export type ConditionSource =
  | { type: 'output_field'; field: string }     // np. output.rating, output.tokensUsed
  | { type: 'output_content' }                   // treść outputu
  | { type: 'agent_field'; field: string }       // agent.name, agent.model
  | { type: 'constant'; value: any }             // stała wartość
  ;

/** Pojedynczy warunek (bramka logiczna) */
export interface WorkflowCondition {
  id: string;
  source: ConditionSource;
  operator: ConditionOperator;
  value: any;
  label?: string;  // Opis po polsku: "Rating > 7"
}

/** Grupa warunków (AND / OR) */
export interface ConditionGroup {
  id: string;
  logic: 'and' | 'or' | 'not';
  conditions: (WorkflowCondition | ConditionGroup)[];
}

/** Typ akcji workflow */
export type WorkflowActionType =
  | 'webhook'              // POST na URL
  | 'save_file'            // Zapisz do pliku z szablonem
  | 'create_task'          // Utwórz task w LabTodo
  | 'execute_agent'        // Uruchom agenta z outputem jako prompt
  | 'append_to_wiki'       // Dodaj do Wiki jako artykuł
  | 'copy_to_clipboard'    // Kopiuj do schowka
  | 'send_notification'    // Windows notification
  | 'send_email'           // Email (przez SMTP)
  | 'call_api'             // Dowolne API (GET/POST/PUT/DELETE)
  ;

/** Konfiguracja pojedynczej akcji */
export interface WorkflowAction {
  id: string;
  type: WorkflowActionType;
  label: string;
  enabled: boolean;
  config: Record<string, any>;
  /** Szablon do renderowania (dla save_file, webhook body itp.) */
  template?: string;
}

/** Szablon workflow — gotowiec do szybkiego uruchomienia */
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'communication' | 'storage' | 'analysis' | 'automation';
  icon: string;
  defaultConfig: Partial<WorkflowDefinition>;
}

/** Główna definicja workflow */
export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  mode: WorkflowMode;                    // sandbox | live — domyślnie sandbox
  trigger: WorkflowTrigger;
  conditions: ConditionGroup | null;     // Główna bramka logiczna
  actions: WorkflowAction[];
  agentId?: string;                      // Agent który uruchamia ten workflow
  /** Nadpisania konfiguracji per-agent (customizable) */
  agentOverrides?: Record<string, Record<string, any>>;
  createdAt: string;
  updatedAt: string;
  runCount: number;
  lastRunAt: string | null;
}

/** Trigger z konfiguracją */
export interface WorkflowTrigger {
  type: WorkflowTriggerType;
  config?: {
    // Dla 'on_rating'
    ratingThreshold?: number;            // próg ratingu (1-10)
    ratingDirection?: 'above' | 'below'; // powyżej / poniżej progu
    // Dla 'scheduled'
    cron?: string;                       // wyrażenie cron
    intervalMs?: number;                 // lub interwał w ms
    // Dla 'webhook'
    webhookSecret?: string;              // sekret do weryfikacji
  };
}

/** Wynik wykonania workflow */
export interface WorkflowExecutionResult {
  id: string;
  workflowId: string;
  workflowName: string;
  agentId: string;
  agentName: string;
  mode: WorkflowMode;
  triggeredAt: string;
  completedAt: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  conditionsResult: boolean | null;
  actions: WorkflowActionResult[];
  logs: WorkflowLogEntry[];
  error?: string;
}

/** Wynik pojedynczej akcji */
export interface WorkflowActionResult {
  actionId: string;
  actionType: WorkflowActionType;
  label: string;
  status: 'pending' | 'executed' | 'dry_run' | 'failed' | 'skipped';
  dryRunPreview?: string;   // W sandboxie: "co by się stało"
  result?: any;             // W Live: faktyczny wynik
  error?: string;
  durationMs: number;
}

/** Pojedynczy wpis logu */
export interface WorkflowLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'dry_run';
  message: string;
  details?: any;
}
