# WORKFLOWS (#1) — Szczegółowy Plan Implementacji

> **Model bezpieczeństwa**: Domyślnie wszystko w **Sandbox** (dry-run).
> Tylko ręcznie ustawione agenty/workflowy działają w **Live**.
> **Zasada architektoniczna**: **Wszystko customizable** (oprócz wyglądu) — każdy element
> workflowu jest konfigurowalny bez grzebania w kodzie, przez config/UI/JSON.
> **Data**: 2026-06-13 | **Estymacja**: ~37h

---

## Spis treści
1. [Model bezpieczeństwa — Sandbox/Live](#1-model-bezpieczeństwa--sandboxlive)
2. [Zasada: Wszystko customizable](#2-zasada-wszystko-customizable)
3. [Struktura plików](#3-struktura-plików)
4. [Typy danych](#4-typy-danych)
5. [Warstwa 1 — Core Engine (8h)](#5-warstwa-1--core-engine-8h)
6. [Warstwa 2 — Bramki Logiczne #6 (6h)](#6-warstwa-2--bramki-logiczne-6-6h)
7. [Warstwa 3 — Akcje (6h)](#7-warstwa-3--akcje-6h)
8. [Warstwa 4 — Szablony outputu (4h)](#8-warstwa-4--szablony-outputu-4h)
9. [Warstwa 5 — UI (8h)](#9-warstwa-5--ui-8h)
10. [Warstwa 6 — IPC + Storage (4h)](#10-warstwa-6--ipc--storage-4h)
11. [Testy](#11-testy)
12. [Kolejność implementacji](#12-kolejność-implementacji)

---

## 1. Model bezpieczeństwa — Sandbox/Live

### Zasada naczelna
> **Wszystko domyślnie w Sandboxie. Nic nie dzieje się naprawdę, dopóki nie przełączysz na Live.**

Obejmuje to:
- **Każdy workflow** ma atrybut `mode: 'sandbox' | 'live'`, domyślnie `'sandbox'`
- **Każdy agent** (w kontekście workflow) ma `defaultMode: 'sandbox'` — można go nadpisać
- **Każda akcja** w sandboxie loguje "co by się stało" bez faktycznego wykonania
- **Przełącznik w UI**: duży, kolorowy toggle na górze edytora workflow

### Co to znaczy w praktyce

| Stan | Co się dzieje |
|------|---------------|
| 🟡 **Sandbox** | Workflow uruchamia agentów normalnie, generuje output. Ale: webhook nie idzie, plik nie jest zapisywany, task nie jest tworzony. Zamiast tego: **podgląd** każdej akcji. |
| 🟢 **Live** | Wszystkie akcje wykonują się naprawdę. |

### Propagacja
- Workflow dziedziczy mode po agentzie, ale można nadpisać per-workflow
- Workflow w sandboxie → wszystkie jego akcje są dry-run
- Workflow na żywo → akcje wykonują się normalnie
- **Wyjątek**: agent może być `sandbox` a workflow `live` → wtedy tylko ten agent jest symulowany, reszta działa

---

## 2. Zasada: Wszystko customizable

> **Oprócz wyglądu, każdy element workflowu jest konfigurowalny przez Ciebie — bez potrzeby pisania kodu.**

### Co to znaczy w praktyce

| Element | Domyślnie | Ale możesz zmienić |
|---------|-----------|--------------------|
| **Trigger** | On approve, manual, scheduled | Definiujesz własne trigger conditions przez config |
| **Warunki (bramki)** | rating > 7, approved === true | Dowolne pole outputu, agenta, własne wyrażenia |
| **Operatory** | >, >=, ==, contains, matches | Możesz dodać własne operatory w configu (`registerOperator`) |
| **Akcje** | webhook, save_file, create_task | **Własne akcje** — definiujesz przez config co ma się stać, możesz rejestrować nowe typy |
| **Szablony** | `{{output.content}}`, `{{date}}` | **Własne zmienne** — dodajesz przez config: `{name: "myVar", value: "..."}` |
| **Funkcje w szablonach** | uppercase, truncate, json | **Własne funkcje** — rejestrujesz przez config |
| **Workflow Templates** | 6 gotowców | **Zapisujesz własne** — każdy workflow może być zapisany jako template |
| **Format plików** | md, txt, json, html | **Dowolny** — definiujesz rozszerzenie w configu akcji save_file |
| **Webhook payload** | `{"content": "..."}` | **Dowolny** — pełny szablon JSON/XML/zwykły tekst |
| **Audyt / logowanie** | status, czas, błędy | **Dowolny** — wybierasz co i jak ma być logowane (poziom szczegółowości) |
| **Notyfikacje** | tytuł, treść, urgency | **Własny format** — title, body, icon, dźwięk, czas wyświetlania |
| **Nazwy plików** | `raport_{{date}}.md` | **Dowolny pattern** — używasz zmiennych, funkcji, własnych znaczników |
| **Per-agent overrides** | Workflow używa agenta z configu | **Nadpisujesz** config dla konkretnego agenta (np. inny prompt, inna temperatura) |

### Jak to osiągamy technicznie

1. **Pluginowy system akcji** — każda akcja to osobny handler w mapie `Map<ActionType, ActionHandler>`. Ty w configu podajesz typ + dowolną konfigurację. Żeby dodać nową akcję:
   - Nie musisz pisać kodu — możesz zdefiniować ją jako sekwencję istniejących akcji
   - Jak chcesz kod → `workflowEngine.registerAction('my_type', handlerFn)`
   
2. **Wyrażenia zamiast stałych** — każdy warunek to `{source, operator, value}` gdzie:
   - `source` = pole z outputu, agenta, kontekstu lub stała
   - `operator` = jeden z 8 wbudowanych lub własny
   - `value` = wartość do porównania — może być stałą lub zmienną z kontekstu
   - Nic nie jest hardkodowane na sztywno
   
3. **Templates engine z rejestracją** — zmienne i funkcje są w rejestrze:
   ```typescript
   templateEngine.registerVariable('myVar', (ctx) => ctx.output.content + ' - custom');
   templateEngine.registerFunction('bracket', (val) => `[${val}]`);
   // Potem w szablonie: {{bracket(myVar)}} → "[output treść - custom]"
   ```

4. **Każdy workflow to czysty JSON** — nie TypeScript, nie kod. Możesz:
   - Exportować workflow do pliku JSON
   - Importować z pliku
   - Duplikować w UI
   - Modyfikować ręcznie w edytorze tekstu
   - Przechowywać w repo git
   
5. **Brak limitu na liczbę** — triggerów, warunków, akcji, kroków, zagnieżdżeń:
   - Możesz mieć 1 warunek albo 50
   - Możesz mieć 1 akcję albo 20
   - Grupy warunków mogą być zagnieżdżone dowolnie głęboko (AND/OR w AND/OR)

6. **Per-property overrides** — każdy workflow może nadpisać dowolne pole dla konkretnego agenta:
   ```json
   {
     "agentOverrides": {
       "agent_123": { "temperature": 0.8, "maxTokens": 4096 },
       "agent_456": { "promptTemplate": "Alternatywny prompt dla workflow" }
     }
   }
   ```

### Co NIE jest customizable (celowo)
- **Wygląd UI** — układ, kolory, style są stałe (Twoja decyzja)
- **Rdzeń silnika** — kolejność wykonywania (trigger → warunek → akcja) jest niezmienna

---

## 3. Struktura plików

```
src/
  shared/types/
    workflow.ts                 # NOWY — typy Workflow, WorkflowAction, WorkflowCondition, WorkflowTemplate
  main/core/
    WorkflowEngine.ts           # NOWY — silnik wykonawczy workflow
  main/ipc/
    ElectronIpcBridge.ts        # MODIFY — + workflow IPC handlers
  main/storage/
    StorageEngine.ts            # MODIFY — + workflow storage
  main/preload.ts               # MODIFY — + workflow bridge methods
  shared/types/
    ipc.ts                      # MODIFY — + workflow w NexusBridge
  components/
    WorkflowEditor.tsx          # NOWY — edytor workflow z Sandbox/Live toggle
    WorkflowList.tsx            # NOWY — lista workflowów
    WorkflowLog.tsx             # NOWY — audyt log
    WorkflowSandboxBanner.tsx   # NOWY — pasek informacyjny "Jesteś w Sandbox"
  renderer/store/
    workflowStore.ts            # NOWY — Zustand store dla workflowów
  App.tsx                       # MODIFY — + routing + stan
  components/
    TopNavigation.tsx           # MODIFY — + przycisk Workflows (opcjonalnie)
  tests/
    WorkflowEngine.test.ts      # NOWY
    WorkflowEditor.test.tsx     # NOWY
```

---

## 4. Typy danych — `src/shared/types/workflow.ts`

```typescript
// ============================================================================
// WORKFLOW (#1) — Typy danych
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
  template?: string;  // Szablon do renderowania

  // Konfiguracja per-typ akcji
  // webhook:
  //   { url: string; method: 'POST' | 'PUT'; headers: Record<string,string>; body: string }
  // save_file:
  //   { path: string; filename: string; format: 'md' | 'txt' | 'json' | 'html' }
  // create_task:
  //   { title: string; description: string; priority: string; listId?: string }
  // execute_agent:
  //   { agentId: string; promptTemplate: string }
  // send_notification:
  //   { title: string; body: string; urgency: 'low' | 'normal' | 'critical' }
  // call_api:
  //   { url: string; method: string; headers: Record<string,string>; body?: string }
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
```

---

## 4. Warstwa 1 — Core Engine (8h)

### 4.1 WorkflowEngine.ts — główna klasa

```typescript
export class WorkflowEngine {
  private workflowStore: Map<string, WorkflowDefinition>;
  private results: Map<string, WorkflowExecutionResult>;

  constructor(storageEngine: StorageEngine);

  /** Sprawdza czy workflow jest wyzwolony — zwraca listę pasujących workflowów */
  evaluateTriggers(event: {
    type: WorkflowTriggerType;
    agentId?: string;
    output?: AgentOutput;
    rating?: number;
    approved?: boolean;
  }): WorkflowDefinition[];

  /** Wykonuje workflow */
  async execute(workflow: WorkflowDefinition, context: {
    output: AgentOutput;
    agent: Agent;
  }): Promise<WorkflowExecutionResult>;

  /** Ewaluuje grupę warunków (bramki logiczne) */
  evaluateConditions(group: ConditionGroup, context: EvaluationContext): boolean;

  /** Renderuje szablon z kontekstem */
  renderTemplate(template: string, context: TemplateContext): string;

  /** Wykonuje pojedynczą akcję */
  async executeAction(
    action: WorkflowAction,
    context: ActionContext,
    mode: WorkflowMode
  ): Promise<WorkflowActionResult>;

  /** Zatrzymuje działający workflow */
  stop(executionId: string): void;

  /** Zwraca wynik wykonania */
  getResult(executionId: string): WorkflowExecutionResult | null;
}
```

### 4.2 Sandbox-specific logic
- Tryb sandbox: `executeAction()` zwraca `{ status: 'dry_run', dryRunPreview: '...' }` zamiast faktycznie wykonywać
- Tryb live: `executeAction()` wykonuje normalnie
- Każdy log ma `level: 'dry_run'` w sandboxie

### 4.3 Pliki
- **NOWY**: `src/main/core/WorkflowEngine.ts` (~250 linii)
- **NOWY**: `src/main/core/WorkflowEngine.test.ts` (~100 linii, 8 testów)

---

## 5. Warstwa 2 — Bramki Logiczne #6 (6h)

### 5.1 Co obejmuje

```
Warunek: if (rating > 7) AND (approved === true)
  → wyślij webhook

Warunek: if (content contains "ERROR") OR (status === "failed")
  → uruchom agenta "Debugger"

Warunek: NOT (rating >= 5)
  → zapisz do pliku "do_poprawy.md"
```

### 5.2 Operatory

| Operator | Działa na | Przykład |
|----------|-----------|----------|
| `gt` / `gte` | number | `rating > 7` |
| `lt` / `lte` | number | `tokensUsed < 1000` |
| `eq` / `neq` | any | `approved === true` |
| `contains` | string | `content contains "ERROR"` |
| `matches` | string (regex) | `content matches /^# .+/m` |
| `exists` / `not_exists` | any | `error exists` |
| `true` / `false` | boolean | `approved === true` |

### 5.3 Grupowanie
- `AND` — wszystkie muszą być spełnione
- `OR` — wystarczy jeden
- `NOT` — negacja całej grupy
- Zagnieżdżanie: grupa może zawierać podmianki i podgrupy

### 5.4 UI
- Wizualny builder warunków: dropdown z polami → dropdown z operatorem → input z wartością
- "Dodaj warunek" → dodaje nowy wiersz
- "Dodaj grupę" → tworzy podgrupę AND/OR/NOT
- Drzewo warunków renderowane z wcięciami

---

## 6. Warstwa 3 — Akcje (6h)

### 6.1 Lista akcji z konfiguracją

#### Webhook
```typescript
{
  type: 'webhook',
  config: {
    url: 'https://discord.com/api/webhooks/...',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: '{{output.content}}',
      agent: '{{agent.name}}',
      rating: {{output.rating}},
    })
  }
}
```

#### Zapisz plik
```typescript
{
  type: 'save_file',
  config: {
    path: './raporty/',
    filename: 'raport_{{date}}.md',
    format: 'md',
    overwrite: false,
  },
  template: '# Raport z {{date}}\n\n{{output.content}}\n\n---\n*Wygenerowano przez {{agent.name}}*'
}
```

#### Utwórz task
```typescript
{
  type: 'create_task',
  config: {
    title: 'Sprawdź: {{output.title}}',
    description: '{{output.content}}',
    priority: 'medium',
    listId: '',
  }
}
```

#### Uruchom agenta
```typescript
{
  type: 'execute_agent',
  config: {
    agentId: 'agent_xyz',
    promptTemplate: 'Przeanalizuj poniższy output i zaproponuj ulepszenia:\n\n{{output.content}}',
  }
}
```

#### Powiadomienie
```typescript
{
  type: 'send_notification',
  config: {
    title: 'Workflow zakończony: {{workflow.name}}',
    body: 'Agent {{agent.name}} zakończył z ratingiem {{output.rating}}/10',
    urgency: 'normal', // low | normal | critical
  }
}
```

### 6.2 Implementacja
- Każda akcja to osobna metoda w `WorkflowEngine`
- Rejestracja przez mapę typ → handler
- Łatwo dodać nową akcję: `registerAction(type, handler)`

---

## 7. Warstwa 4 — Szablony outputu (4h)

### 7.1 System zmiennych

| Zmienna | Opis | Przykład rezultatu |
|---------|------|--------------------|
| `{{output.content}}` | Treść outputu agenta | "Przeanalizowałem kod..." |
| `{{output.rating}}` | Rating (1-10) | "8" |
| `{{output.tokensUsed}}` | Liczba tokenów | "450" |
| `{{output.executionMs}}` | Czas wykonania (ms) | "1200" |
| `{{output.approved}}` | Czy zatwierdzony | "true" |
| `{{agent.name}}` | Nazwa agenta | "Streszczacz" |
| `{{agent.model}}` | Model | "gemini-2.0-flash" |
| `{{agent.id}}` | ID agenta | "agent_abc123" |
| `{{workflow.name}}` | Nazwa workflow | "Codzienny raport" |
| `{{date}}` | Data ISO | "2026-06-13" |
| `{{time}}` | Czas | "14:30:00" |
| `{{now}}` | Pełna data ISO | "2026-06-13T14:30:00Z" |
| `{{nl}}` | Nowa linia | "\n" |

### 7.2 Funkcje w szablonach (bonus)

| Wyrażenie | Opis | Przykład |
|-----------|------|----------|
| `{{uppercase(content)}}` | Zamień na wielkie litery | "PRZEANALIZOWAŁEM..." |
| `{{lowercase(content)}}` | Zamień na małe litery | "przeanalizowałem..." |
| `{{truncate(content, 100)}}` | Skróć do N znaków | "Przeanalizowałem..." |
| `{{json(output)}}` | Sformatuj jako JSON | `{"content": "...", ...}` |
| `{{date_format(date, "DD-MM-YYYY")}}` | Format daty | "13-06-2026" |

### 7.3 Podgląd na żywo
- W edytorze szablonu: preview panel pokazujący wyrenderowany template
- Używa ostatniego outputu agenta jako kontekstu
- Jeśli brak outputu → pokazuje placeholder

---

## 8. Warstwa 5 — UI (8h)

### 8.1 WorkflowEditor.tsx
- **Header**: nazwa, opis, duży Sandbox/Live toggle (żółty/zielony)
- **Sekcje** (przewijane):
  1. Trigger — wybierz typ triggera + konfiguracja
  2. Agent — przypisz agenta (dropdown z listy)
  3. Warunki — builder bramek logicznych (drzewo AND/OR/NOT)
  4. Akcje — lista akcji, każda z configiem (dodaj/usuń/edytuj)
  5. Szablon — jeśli akcja go wspiera
- **Przyciski**: Zapisz, Uruchom (sandbox), Uruchom (live), Zapisz jako template

### 8.2 WorkflowList.tsx
- Lista workflowów w sidebarze
- Każdy wiersz: nazwa, agent, tryb (🟡 / 🟢), ostatnie uruchomienie
- Filtry: po trybie, po agencie, po triggerze
- Search po nazwie
- Przycisk "+ Nowy workflow"

### 8.3 WorkflowLog.tsx
- Historia wykonania workflow
- Kolumny: data, status, tryb, akcje (liczba), błędy
- Expansion: kliknięcie → szczegóły + logi + dry_run preview
- Filtry: po statusie, po dacie

### 8.4 WorkflowSandboxBanner.tsx
- Żółty pasek u góry edytora:
  ```
  🟡 TRYB SANDBOX — Żadne akcje nie są faktycznie wykonywane.
     Kliknij aby przełączyć na LIVE
  ```
- Zielony pasek dla Live:
  ```
  🟢 TRYB LIVE — Akcje będą wykonane naprawdę.
     Upewnij się że wszystko jest skonfigurowane poprawnie.
  ```

### 8.5 WorkflowTemplates.ts — 6 gotowców
1. **"Zapisz output do Wiki"** — po approve, tworzy artykuł Wiki
2. **"Wyślij powiadomienie"** — po zakończeniu agenta, pokazuje notyfikację
3. **"Utwórz task z outputu"** — po approve, tworzy task w LabTodo
4. **"Wyślij raport na webhook"** — po approve, POST na URL (Discord/Slack)
5. **"Łańcuch agentów"** — po approve, uruchom innego agenta z outputem
6. **"Błąd → Debugger"** — jeśli output zawiera "ERROR", uruchom agenta debuggera

---

## 9. Warstwa 6 — IPC + Storage (4h)

### 9.1 NexusBridge — nowe metody
```typescript
interface NexusBridge {
  // ... istniejące metody ...

  // Workflows (#1)
  saveWorkflow: (payload: { workflow: WorkflowDefinition }) => Promise<{ success: boolean }>;
  deleteWorkflow: (payload: { id: string }) => Promise<{ success: boolean }>;
  getWorkflows: () => Promise<WorkflowDefinition[]>;
  executeWorkflow: (payload: { id: string, mode?: WorkflowMode }) => Promise<WorkflowExecutionResult>;
  getWorkflowResult: (payload: { executionId: string }) => Promise<WorkflowExecutionResult | null>;
  getWorkflowLogs: (payload: { workflowId: string }) => Promise<WorkflowLogEntry[]>;
}
```

### 9.2 StorageEngine — nowe metody
```typescript
class StorageEngine {
  saveWorkflow(workflow: WorkflowDefinition): void;
  getWorkflow(id: string): WorkflowDefinition | null;
  getAllWorkflows(): WorkflowDefinition[];
  deleteWorkflow(id: string): void;
  saveWorkflowResult(result: WorkflowExecutionResult): void;
  getWorkflowResults(workflowId: string): WorkflowExecutionResult[];
}
```

### 9.3 IPC Handlery — 7 nowych
```
workflow:save        → StorageEngine.saveWorkflow
workflow:delete      → StorageEngine.deleteWorkflow
workflow:get-all     → StorageEngine.getAllWorkflows
workflow:execute     → WorkflowEngine.execute (sprawdza mode!)
workflow:result      → WorkflowEngine.getResult
workflow:logs        → StorageEngine.getWorkflowResults → transform
workflow:stop        → WorkflowEngine.stop
```

---

## 10. Testy

### WorkflowEngine.test.ts (12 testów)
| # | Test | Co sprawdza |
|---|------|-------------|
| 1 | evaluateTriggers — manual | Zwraca workflow z triggerem manual |
| 2 | evaluateTriggers — on_approve | Zwraca workflow gdy approved=true |
| 3 | evaluateConditions — AND | `rating>7 AND approved=true` → true |
| 4 | evaluateConditions — OR | `rating>7 OR approved=true` → false gdy oba false |
| 5 | evaluateConditions — NOT | `NOT (rating>=5)` → true gdy rating=3 |
| 6 | evaluateConditions — zagnieżdżone | Grupa w grupie |
| 7 | renderTemplate — podstawowy | `{{output.content}}` → wartość |
| 8 | renderTemplate — funkcje | `{{uppercase(name)}}` → "TEST" |
| 9 | executeAction — webhook (live) | Faktycznie wysyła (mock) |
| 10 | executeAction — webhook (sandbox) | Zwraca dry_run, nie wysyła |
| 11 | executeAction — save_file (sandbox) | Nie tworzy pliku, zwraca preview |
| 12 | Stop — przerywa wykonanie | Status = stopped |

### WorkflowEditor.test.tsx (6 testów)
| # | Test | Co sprawdza |
|---|------|-------------|
| 1 | Renderuje pustą listę | "Brak workflowów" |
| 2 | Wyświetla workflow na liście | Nazwa, agent, tryb |
| 3 | Tworzy nowy workflow | Domyślnie sandbox mode |
| 4 | Przełącznik Sandbox/Live | Zmienia mode po kliknięciu |
| 5 | Dodaje warunek | Builder warunków działa |
| 6 | Dodaje akcję | Nowa akcja z konfiguracją |

---

## 11. Kolejność implementacji

| Krok | Warstwa | Czas | Co powstaje |
|------|---------|------|-------------|
| 1 | Typy | 1h | `workflow.ts` — wszystkie interfejsy |
| 2 | Core Engine | 5h | `WorkflowEngine.ts` — execute, evaluateConditions, renderTemplate |
| 3 | Akcje (podstawowe) | 3h | webhook, save_file, create_task — implementacje handlerów |
| 4 | Sandbox/Live | 2h | Logika trybów w executeAction, dry_run preview |
| 5 | Bramki Logiczne | 4h | Builder warunków, AND/OR/NOT, operatory, UI |
| 6 | Szablony | 3h | Silnik szablonów, zmienne, funkcje, preview |
| 7 | IPC + Storage | 3h | Bridge, StorageEngine, preload, 7 handlerów |
| 8 | UI: WorkflowEditor | 4h | Główny edytor z toggle Sandbox/Live |
| 9 | UI: WorkflowList | 2h | Lista, filtry, search, "+ Nowy" |
| 10 | UI: WorkflowLog | 2h | Historia, audyt, podgląd sandbox |
| 11 | UI: WorkflowTemplates | 2h | 6 gotowców |
| 12 | Testy | 5h | 18 testów (12 engine + 6 UI) |
| 13 | Integracja z App.tsx | 1h | Routing, stan, TopNavigation |
| | **RAZEM** | **~37h** | |

---

## Appendix A: Workflow Templates — konfiguracja gotowców

### Template: "Zapisz output do Wiki"
```typescript
{
  id: 'tpl_wiki',
  name: 'Zapisz output do Wiki',
  description: 'Po zatwierdzeniu outputu tworzy nowy artykuł w Wiki',
  category: 'storage',
  icon: 'BookOpen',
  defaultConfig: {
    trigger: { type: 'on_approve' },
    mode: 'sandbox',
    conditions: null,
    actions: [{
      type: 'append_to_wiki',
      label: 'Dodaj do Wiki',
      config: { category: 'auto', tags: ['agent-output'] },
      template: '# {{agent.name}} — {{date}}\n\n{{output.content}}',
    }],
  },
}
```

### Template: "Wyślij raport na webhook"
```typescript
{
  id: 'tpl_webhook',
  name: 'Wyślij raport na webhook',
  description: 'Po zatwierdzeniu wysyła output na zewnętrzny URL (Discord/Slack)',
  category: 'communication',
  icon: 'Webhook',
  defaultConfig: {
    trigger: { type: 'on_approve' },
    mode: 'sandbox',
    conditions: { id: 'c1', logic: 'and', conditions: [
      { id: 'c1a', source: { type: 'output_field', field: 'rating' }, operator: 'gte', value: 6 },
    ]},
    actions: [{
      type: 'webhook',
      label: 'Wyślij do Discord',
      config: { url: '', method: 'POST', headers: {}, body: '{"content": "{{output.content}}"}' },
    }],
  },
}
```

---

## Appendix B: UI Mockup (WorkflowEditor)

```
┌─────────────────────────────────────────────────────────────┐
│ [Nazwa: Codzienny raport]  [Opis: ...]    🟡 [SANDOX] [▶] │
├─────────────────────────────────────────────────────────────┤
│  TRIGGER                                                     │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ● On approve   ○ On reject   ○ On rating   ○ Manual    ││
│  │   Agent: [Streszczacz ▼]                                ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  WARUNKI (Bramki Logiczne)                                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ AND ─────────────────────────────────────────────────── ││
│  │ ├─ [rating] [≥] [7]                               [×]  ││
│  │ └─ [approved] [===] [true]                        [×]  ││
│  │ [+ Dodaj warunek]  [+ Dodaj grupę OR/NOT]              ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  AKCJE                                                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 1. [Webhook ▼] → Wyślij do Discord              [×]    ││
│  │    URL: https://discord.com/api/webhooks/...             ││
│  │    Body: {"content": "{{output.content}}"}               ││
│  │ ─────────────────────────────────────────────────────── ││
│  │ 2. [Zapisz plik ▼] → Zapisz raport.md            [×]    ││
│  │    Ścieżka: ./raporty/raport_{{date}}.md                 ││
│  │    Szablon: [Wyrenderowany podgląd ▼]                    ││
│  │    # Raport z {{date}}\n\n{{output.content}}...          ││
│  │                                                          ││
│  │ [+ Dodaj akcję]                                          ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Zatwierdzenie planu

Po zatwierdzeniu rozpoczynam implementację w kolejności:

1. **Typy** (`workflow.ts`) → **Core Engine** → **Akcje** → **Sandbox/Live**
2. **Bramki Logiczne** → **Szablony**
3. **IPC + Storage**
4. **UI (Editor, List, Log, Templates)**
5. **Integracja z App.tsx**
6. **Testy**

Każdy krok kończy się działającym kodem + testami + typecheck.
