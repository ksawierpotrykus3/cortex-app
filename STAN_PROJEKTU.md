# RAPORT STANU SYSTEMU NEXUS
**Dokumentacja Techniczna i Architektoniczna (Stan na dzień: 02.07.2026)**
**Przeznaczenie:** Referencja deweloperska dla agentów AI / Systemy RAG

---

## 1. METADANE PROJEKTU
*   **Nazwa aplikacji:** `nexus-system` (w trakcie procesu stabilizacji po audycie i przebudowy fundamentów)
*   **Architektura:** Electron (Main Process) + React 19 (Renderer Process) + Vite + TypeScript
*   **Lokalizacja repozytorium:** `c:/Users/Ksawier/Pictures/Screenshots/nexus`
*   **Główny plik bazy danych:** `nexus.workspace.json` oraz relacyjna baza SQLite (przechowywane lokalnie w wybranym przez użytkownika katalogu roboczym)
*   **Faza projektu:** **STABILIZACJA ARCHITEKTONICZNA & SECURITY HARDENING / WDROŻENIE AUDYTU** (ukończono 100% zaleceń krytycznych i architektonicznych z audytu bezpieczeństwa, wzmocniono potoki tła Playwright i Useme AI Automation)

---

## 2. PROFILE TECHNOLOGICZNE (TECH STACK)

### A. Główne Zależności (Dependencies)
*   **Framework bazowy:** `electron` (v42.3.2)
*   **Biblioteka UI:** `react` & `react-dom` (v19.0.1)
*   **Bundler & Kompilator:** `vite` (v6.2.3) + `electron-vite` (v2.3.0) + `typescript` (~v5.8.2)
*   **Zarządzanie stanem (Zustand):** `zustand` (v5.0.0)
*   **Baza danych:** `better-sqlite3` (v11.8.0) oraz `idb-keyval` (v6.2.5) do persystencji w IndexedDB.
*   **Silnik AI:** `@google/genai` (v2.7.0)
*   **Style CSS:** `tailwindcss` (v4.1.14) + `@tailwindcss/vite` (v4.1.14) + `lightningcss` (v1.32.0)
*   **Animacje:** `motion` (v12.40.0)
*   **Wirtualizacja list:** `react-window` (v1.8.11)
*   **Ikony:** `lucide-react` (v0.546.0)

### B. Środowisko Testowe (Dev Dependencies)
*   **Testy jednostkowe:** `vitest` (v4.1.8) + `@testing-library/react` (v16.3.2) + `jsdom` (v29.1.1)
*   **Testy E2E:** `playwright` (v1.61.0) + `@playwright/test` (v1.60.0)

---

## 3. SCHEMATY DANYCH (DATA MODEL SCHEMAS)
Wszystkie encje są serializowane do jednego pliku `nexus.workspace.json` za pomocą mechanizmów w [src/fs.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/fs.ts).

### A. Stan Główny Aplikacji (`NexusState`)
Definiowany w [src/fs.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/fs.ts#L14-L33):
```typescript
export interface NexusState {
  nodes: NexusNode[];                 // Węzły na trójwymiarowym / płaskim canvasie topologii
  links: NexusLink[];                 // Połączenia (relacje) między węzłami
  tasks: Task[];                      // Taski (wycofywane w obecnej fazie)
  drafts: WritingDraft[];             // Drafty tekstowe w sekcji Laboratory -> Writing
  geminiKey: string;                  // Klucz API Gemini
  manuscriptFolders?: ManuscriptFolder[];
  manuscriptTabs?: ManuscriptTab[];
  manuscriptMetas?: ManuscriptMeta[];
  changelog?: ChangeEntry[];          // Dziennik zmian (zatwierdzanie/odrzucanie operacji AI)
  feedback?: FeedbackEntry[];         // Informacje zwrotne i dane RLHF od użytkownika
  wiki?: WikiArticle[];               // Artykuły Wiki (Persistent Context dla modeli)
  pipelines?: Pipeline[];             // Definicje potoków DAG
  workflows?: WorkflowDefinition[];   // Definicje workflowów AI
  snapshots?: EntitySnapshot[];       // Zrzuty stanów do wersjonowania
  customCommands?: CustomCommandData[];
  shortcutOverrides?: ShortcutOverride[];
  studioCanvas?: any;
  mermaidDrafts?: any[];              // Szkice diagramów Mermaid
}
```

### B. Struktury Podstawowe (`src/types.ts`)
Definiowane w [src/types.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/types.ts):
```typescript
export type ThoughtMarker = 'certain' | 'hypothesis' | 'question' | 'answer';

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

export interface NexusLink {
  source: string;                     // ID węzła źródłowego (NexusNode.id)
  target: string;                     // ID węzła docelowego (NexusNode.id)
  // W planach: dodanie pola 'reason: string' opisującego powód połączenia
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
```

---

## 4. ANALIZA ZMIAN W KODZIE (ODŁĄCZONE ELEMENTY SYSTEMU)
Wiele funkcjonalności zostało **deaktywowanych w warstwie UI/nawigacji**, ale ich pliki i logika kodu źródłowego pozostały nienaruszone, aby ułatwić ich późniejsze zaadaptowanie w nowej architekturze.

### A. Wdrożone modyfikacje i deaktywacje (Git Diff)

| Plik | Typ Modyfikacji | Opis Techniczny | Cel Biznesowy |
| :--- | :--- | :--- | :--- |
| [src/App.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/App.tsx) | Zakomentowanie kodu / zmiana JSX | 1. Zakomentowano `useEffect` nasłuchujący agentów przez IPC (`onAgentOutput`, `onAgentStream`, `onAgentStatus`).<br>2. Usunięto z renderowania komponenty `<DraftZone>`, `<MermaidPlanPanel>` oraz `<FloatingAgentPanel>`.<br>3. Podmieniono sekcję `agents` na statyczny placeholder `"Agenci AI (W przebudowie)"`. | Zablokowanie niepotrzebnych procesów tła i uproszczenie widoku do czasu zdefiniowania nowej architektury. |
| [src/commands/index.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/commands/index.ts) | Zakomentowanie komend | Zakomentowano rejestrację komendy nawigacji do agentów (`nav:agents`) oraz niebezpiecznej komendy czyszczenia outputów (`danger:clear-outputs`). | Ograniczenie opcji Command Palette do widoków aktywnych. |
| [src/components/StatusBar.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/StatusBar.tsx) | Zakomentowanie komponentu & typów | 1. Wyłączono import i renderowanie komponentu `<RpmIndicator />`.<br>2. Usunięto z mapowania widoków (`viewLabels`) etykiety dla `sandbox`, `logs`, `draft`, `agents`, `mermaid-plan`. | Ukrycie nieaktywnych statystyk i zakładek na dolnym pasku. |
| [src/components/TopNavigation.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/TopNavigation.tsx) | Zmiana struktury menu | Usunięto przycisk "Knowledge Base" oraz opcje "Agent Logs", "RLHF Draft", "Diagram (Mermaid)" z dropdownu "More". | Uproszczenie nawigacji górnej dla użytkownika. |
| [src/types.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/types.ts) | Zmiana typu | Usunięto wartość `'draft'` z typu `ViewMode`. | Synchronizacja typów TypeScript z wyłączonymi widokami. |
| [src/renderer/components/agents/AgentPresets.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/renderer/components/agents/AgentPresets.ts) | Zmiana konfiguracji | Usunięto `OutputDestinationType.KNOWLEDGE` z tablicy `allowedDestinations`. | Zabezpieczenie przed samowolnym zapisem agentów do Bazy Wiedzy. |

---

## 4.1. HARDENING BEZPIECZEŃSTWA I ARCHITEKTURY (REALIZACJA AUDYTU 02.07.2026)
W ramach kompleksowego audytu bezpieczeństwa, stabilności i architektury potoków tła (przeprowadzonego zgodnie z rygorystyczną zasadą pesymizmu `<RULE[user_global]>`), zidentyfikowano i deterministycznie wyeliminowano 8 kluczowych podatności oraz wad projektowych. Poniżej znajduje się wyczerpująca dokumentacja techniczna wdrożonych rozwiązań:

### A. Krytyczne Poprawki Bezpieczeństwa (Security Hardening)

#### 1. Wyciek Kluczy API DeepSeek ([schema.ts:81-82](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/shared/types/schema.ts#L81-82))
* **Diagnoza:** W pliku definicji typów wpisane były otwartym tekstem produkcyjne klucze API (`sk-754d...`). Naruszało to podstawowe zasady bezpieczeństwa (OWASP Top 10 - Hardcoded Secrets).
* **Rozwiązanie Architektoniczne:** Usunięcie stałych tekstowych z kodu źródłowego i przekierowanie odczytu do systemowych zmiennych środowiskowych `process.env`.
```diff
- export const DEFAULT_DEEPSEEK_FLASH_KEY = 'sk-754d3f...';
- export const DEFAULT_DEEPSEEK_PRO_KEY = 'sk-beaffc...';
+ export const DEFAULT_DEEPSEEK_FLASH_KEY = process.env.DEEPSEEK_FLASH_API_KEY || '';
+ export const DEFAULT_DEEPSEEK_PRO_KEY = process.env.DEEPSEEK_PRO_API_KEY || '';
```

#### 2. Podatność SQL Injection w zapytaniach PRAGMA ([StorageEngine.ts:771-776](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/main/storage/StorageEngine.ts#L771-776))
* **Diagnoza:** Metoda sprawdzająca strukturę tabeli wykonywała surowe zapytanie interpolowane `PRAGMA table_info(${tableName})` bez walidacji wejścia, co umożliwiało wstrzyknięcie złośliwego kodu SQL przy manipulacji nazwą tabeli.
* **Rozwiązanie Architektoniczne:** Wdrożono rygorystyczny strażnik oparty na białej liście znaków (wyrażenie regularne `^[a-zA-Z0-9_]+$`).
```typescript
if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
  throw new Error(`[StorageEngine] Invalid table name for PRAGMA: ${tableName}`);
}
const stmt = this.db.prepare(`PRAGMA table_info(${tableName})`);
```

#### 3. Podatność Command Injection w silniku Useme ([usemeHandlers.ts:62-68](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/main/ipc/usemeHandlers.ts#L62-68))
* **Diagnoza:** Uruchamianie zewnętrznego skryptu automatyzacji odbywało się przy użyciu `exec` z włączoną powłoką (`shell: true`), co na platformie Windows otwarło wektor ataków przez wstrzykiwanie znaków sterujących powłoki (`&`, `|`, `;`).
* **Rozwiązanie Architektoniczne:** Wyłączenie powłoki (`shell: false`) oraz przejście na bezpieczny proces wywołania `spawn` z natywnym uwzględnieniem pliku wykonywalnego `npx.cmd` dla Windowsa.
```typescript
const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
this.childProcess = require('child_process').spawn(cmd, ['tsx', 'src/index.ts'], {
  cwd: engineDir,
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: false, // Całkowita izolacja od powłoki systemowej
});
```

---

### B. Niezawodność Procesów AI i Stanu UI (Core Reliability)

#### 4. Zapobieganie awariom w strumieniowaniu AI ([OpenAIApiAdapter.ts:89-93,134-135](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/main/ai/OpenAIApiAdapter.ts#L89-93))
* **Diagnoza:** Przerwanie połączenia HTTP w trakcie odczytu strumienia powodowało wywołanie `reader.releaseLock()` na nieistniejącym lub niezainicjowanym obiekcie `reader`, co rzucało nieschwytany wyjątek fatalny w Main Processie.
* **Rozwiązanie Architektoniczne:** Wprowadzenie wczesnego powrotu (`early return`) przy braku `res.body` oraz bezpiecznego strażnika w bloku `finally`.
```typescript
const reader = res.body?.getReader();
if (!reader) {
  yield { token: '', done: true, error: `[${this.name}] Brak body stream` };
  return;
}
// ...
} finally {
  if (reader) reader.releaseLock(); // Bezpieczne zwolnienie blokady
}
```

#### 5. Wyeliminowanie Race Condition w Panelu Recenzji Useme ([usemeStore.ts:98-103](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/renderer/store/usemeStore.ts#L98-103))
* **Diagnoza:** Podczas akceptacji lub odrzucenia zlecenia (`submitReviewDecision`), wyliczanie statusu robota opierało się na starej długości tablicy przed jej przefiltrowaniem, przez co robot zawieszał się w stanie `AWAITING_REVIEW` po obsłużeniu ostatniej oferty.
* **Rozwiązanie Architektoniczne:** Uporządkowanie operacji atomowych w stanie Zustand:
```typescript
set((state) => {
  const updatedReviews = state.pendingReviews.filter((r) => r.jobId !== jobId);
  return {
    pendingReviews: updatedReviews,
    status: updatedReviews.length === 0 ? 'RUNNING' : 'AWAITING_REVIEW',
  };
});
```

---

### C. Hardening Silnika Automatyzacji i Potoków DAG (`src/main/core/`)

#### 6. Persystencja Pamięci Kursorowej ([AutomationEngine.ts:67-110](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/main/core/AutomationEngine.ts#L67-110))
* **Diagnoza:** Historia przetworzonych zleceń (`cursorStore`) była przechowywana wyłącznie w ulotnej strukturze `new Map<string, CursorState>()` w pamięci RAM. Każdy restart aplikacji czy ponowne uruchomienie komputera powodowało wyczyszczenie zbioru `processedIds`, co narażało bota na ponowne wysyłanie ofert na te same zlecenia Useme.
* **Rozwiązanie Architektoniczne:** Wdrożenie automatycznego odczytu i relacyjnego zapisu pamięci kursorowej do trwałego pliku na dysku (`data/cursor_store.json`) po każdej operacji wywołanej przez `advanceCursor()` lub `resetCursor()`.
```typescript
const getCursorStorePath = () => path.resolve(process.cwd(), 'data', 'cursor_store.json');

function saveCursorStore(): void {
  const file = getCursorStorePath();
  const obj: Record<string, any> = {};
  for (const [k, v] of cursorStore.entries()) {
    obj[k] = { ...v, processedIds: Array.from(v.processedIds) };
  }
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf-8');
}
```

#### 7. Iteracyjne Czyszczenie Nazw Plików we Fuzzy Matching ([AutomationEngine.ts:186-200](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/main/core/AutomationEngine.ts#L186-200))
* **Diagnoza:** Funkcja `cleanBase` usuwała dopiski systemowe plików (`(1)`, `- Copy`) przy użyciu jednorazowego łańcucha `.replace()`. W przypadku zagnieżdżonych kopii generowanych przez Windows (np. `raport - Copy (2).pdf`), jednokrotny prześcig nie usuwał pełnego narostu, prowadząc do błędów dopasowywania załączników.
* **Rozwiązanie Architektoniczne:** Zastosowanie pętlącej weryfikacji idempotencji (`while (prev !== cleaned)`), która powtarza czyszczenie aż do osiągnięcia czystej nazwy bazowej.
```typescript
const cleanBase = (base: string): string => {
  let prev = '';
  let cleaned = base;
  while (prev !== cleaned) {
    prev = cleaned;
    cleaned = cleaned
      .replace(/\s*\(\d+\)\s*$/, '')              // Usuwa " (1)", "(99)"
      .replace(/\s*-\s*Copy(\s*\(\d+\))?$/i, '')  // Usuwa " - Copy", " - Copy (2)"
      .replace(/\s*\(\d+\)$/, '')                  // Usuwa "(1)" bez spacji
      .replace(/\s*_copy\d*$/i, '')                // Usuwa "_copy", "_copy2"
      .trim();
  }
  return cleaned;
};
```

#### 8. Fail-Fast w Potoku Wykonawczym DAG ([PipelineExecutor.ts:310-320](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/main/core/PipelineExecutor.ts#L310-320))
* **Diagnoza:** Węzły wykonawcze (`llm-agent`, `browser-automate`) w przypadku błędu zapisywały komunikat `[ERROR]` do `runState.nodeResults`, po czym pętla topologiczna potoku kontynuowała przetwarzanie kolejnych węzłów, które operowały na błędnych danych wejściowych.
* **Rozwiązanie Architektoniczne:** Wdrożenie rygorystycznego natychmiastowego przerwania potoku (`fail-fast`) zaraz po wyjściu z bloku wykonawczego węzła, z uwzględnieniem flagi `abortOnError`.
```typescript
if (runState.errors.has(node.id)) {
  if (node.config?.abortOnError !== false) {
    runState.status = 'failed';
    return {
      success: false,
      error: `Node "${node.name || node.id}" failed: ${runState.errors.get(node.id)}`
    };
  }
}
```

---

## 5. SPECYFIKACJA INTERFEJSU IPC (`nexusBridge`)
Komunikacja IPC przebiega za pomocą mostka `window.nexusBridge` zarejestrowanego w kontekście renderera przez `contextBridge`. Typy wejść i wyjść definiuje interfejs `NexusBridge` w [src/shared/types/ipc.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/shared/types/ipc.ts).

Poniżej wybrane, kluczowe sygnatury metod istotne dla agenta AI:

```typescript
export interface NexusBridge {
  // Kontrola procesów Agentów AI
  executeAgent: (payload: { id: string; context?: string; triggerType?: TriggerType }) => Promise<{ success: boolean }>;
  stopAgent: (payload: { id: string }) => Promise<{ success: boolean }>;
  getAgents: () => Promise<Agent[]>;
  onAgentOutput: (callback: (output: AgentOutput) => void) => () => void;
  onAgentStatus: (callback: (data: { agentId: string; status: AgentStatus }) => void) => () => void;
  onAgentStream: (callback: (data: { agentId: string; token: string }) => void) => () => void;

  // Integracja z Git (Śledzenie i persystencja)
  getGitStatus: (payload?: { agentId?: string }) => Promise<GitStatusResult>;
  getGitDiff: (payload?: { file?: string; from?: string; to?: string; agentId?: string }) => Promise<string>;
  gitCommit: (payload: { message: string; all?: boolean; agentId?: string }) => Promise<{ success: boolean; error?: string }>;

  // Integracja z Playwright (Scraping i automatyzacja)
  browserExtractDom: (payload: { url: string }) => Promise<{ success: boolean; title?: string; cleanText?: string; error?: string }>;
  browserDownloadAndSave: (payload: { url: string; steps: any[]; inputs?: Record<string, any> }) => Promise<{ success: boolean; files?: any[] }>;

  // Wyszukiwanie semantyczne i RAG
  searchQuery: (payload: { query: string; entities: WorkspaceEntity[]; config?: Partial<SearchConfig> }) => Promise<SearchResult[]>;
  fetchContext: (payload: { agentId: string; contextConfig: ContextConfig }) => Promise<{ context: string; tokensUsed: number }>;

  // Integracja z potokiem Useme AI Automation (usemeHandlers.ts)
  usemeStart: (payload: { mode: 'dry' | 'prod'; headless: boolean }) => Promise<boolean>;
  usemeStop: () => Promise<boolean>;
  usemeGetPrompts: () => Promise<{ filename: string; content: string }[]>;
  usemeSavePrompt: (payload: { filename: string; content: string }) => Promise<boolean>;
  onUsemeLog: (callback: (data: { level: string; message: string; timestamp: string }) => void) => () => void;
  onUsemeReviewRequest: (callback: (data: any) => void) => () => void;
}

---

## 5.1. MODUŁ INTEGRACJI USEME (`src/components/useme/` & `src/main/ipc/usemeHandlers.ts`)
System Nexus posiada wbudowany, dedykowany interfejs graficzny do zarządzania zewnętrznym rurociągiem CLI `useme-ai-automation`:
*   **Zarządzanie procesem (`ExecutionControl.tsx`):** Uruchamianie bota w trybie `DRY_RUN` lub produkcyjnym z podglądem logów na żywo emitowanych przez `child_process`.
*   **Edytor Promptów (`PromptRepository.tsx`):** Bezpośredni odczyt i zapis szablonów promptów (`config/prompts/`) z poziomu GUI Electrona.
*   **Kolejka Audytu (`ReviewQueueModal.tsx`):** Graficzny interfejs Human-In-The-Loop pozwalający użytkownikowi zatwierdzać, odrzucać lub poprawiać oferty przed ich ostateczną wysyłką na Useme.
```

---

## 6. KONCEPCJA REBRANDINGOWA: "SKŁAD" & WYTYCZNE DLA AI
System przechodzi proces upraszczania w celu osiągnięcia maksymalnej elastyczności. Poniższe wytyczne muszą być bezwzględnie przestrzegane przez każdy model AI pracujący nad kodem:

1.  **Fundament ponad wszystko (SKŁAD):** Najważniejszy jest system gromadzenia luźnych myśli i ich łączenia. System nie powinien wymuszać struktury na starcie.
2.  **Unikanie sztywnej taksonomii (DITA/XML = NIE):** Nie wprowadzaj sztywnych klocków czy kategorii. Struktura danych musi rosnąć z połączeń definiowanych powodem.
3.  **Zasada łączenia z powodem (Tilde `~`):** Każdy proces dodawania relacji lub tworzenia powiązanych węzłów musi zawierać metadane `reason: string` opisujące sens połączenia.
4.  **Projekty jako Fazy:** Uznaj, że projekt nie kończy się binarnie (0/1). Wspieraj mechanizmy ewolucji od fazy `manual` do `auto`.
5.  **Nie niszcz zakomentowanego kodu:** Kod starych komponentów (np. `<MermaidPlanPanel>`, `<FloatingAgentPanel>`) jest cenny. Zmiany koncepcyjne należy nanosić poprzez jego adaptację lub kontrolowane zastępowanie, a nie usuwanie.
6.  **Zapis ustaleń:** AI nie podejmuje samodzielnych decyzji o wdrożeniu zmian bez wcześniejszego zapisu ustaleń i potwierdzenia użytkownika.
7.  **Jedna Baza Prawdy (SQLite / `better-sqlite3`):** System jest przygotowany pod masowe ilości danych (Wiki, encyklopedia projektowa, tysiące węzłów SKŁAD, logi AI). Każda nowa funkcja, encja lub mechanizm dodający dane do edycji/zapisu w Nexusie **MUSI** być docelowo projektowany pod relacyjną bazę SQLite (`workspace.db`), a nie dokładany do monolitycznego pliku JSON. Wszystko co jest tworzone w Nexusie musi mieć możliwość relacyjnego podpięcia (z powodem `reason`) do pozostałych encji w bazie.
