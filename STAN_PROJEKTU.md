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
W ramach kompleksowego audytu bezpieczeństwa i stabilności systemu Nexus wdrożono deterministyczne poprawki wyeliminowujące podatności krytyczne oraz wady architektoniczne procesów tła:

### A. Poprawki Bezpieczeństwa (Security Fixes)
1. **Wyciek Kluczy API ([src/shared/types/schema.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/shared/types/schema.ts#L81-82)):** Usunięto wpisane otwartym tekstem klucze API DeepSeek. Aplikacja pobiera je wysoce bezpiecznie z systemowych zmiennych środowiskowych (`process.env.DEEPSEEK_FLASH_API_KEY`, `process.env.DEEPSEEK_PRO_API_KEY`).
2. **Podatność SQL Injection ([src/main/storage/StorageEngine.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/main/storage/StorageEngine.ts)):** Wdrożono rygorystyczny strażnik wyrażeń regularnych (`^[a-zA-Z0-9_]+$`) weryfikujący nazwy tabel przed wykonaniem zapytania `PRAGMA table_info()`.
3. **Zagrożenie Command Injection ([src/main/ipc/usemeHandlers.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/main/ipc/usemeHandlers.ts)):** Zastąpiono niestabilne `exec(..., { shell: true })` bezpiecznym wywołaniem `spawn(cmd, ['tsx', 'src/index.ts'], { shell: false })` z automatyczną detekcją powłoki Windows (`npx.cmd`).

### B. Poprawki Niezawodności i Stanu (Core & UI Reliability)
4. **Zabezpieczenie przed Crashem Streamingu AI ([src/main/ai/OpenAIApiAdapter.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/main/ai/OpenAIApiAdapter.ts)):** Dodano weryfikację istnienia readera (`if (reader) reader.releaseLock();`) w bloku `finally` oraz wczesny powrót przy braku strumienia body HTTP.
5. **Kolejność Operacji w Panelu Recenzji Useme ([src/renderer/store/usemeStore.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/renderer/store/usemeStore.ts)):** Naprawiono błąd race condition wyliczania statusu robota – najpierw odfiltrowywana jest lista `pendingReviews`, a dopiero na podstawie nowo wyliczonego rozmiaru wyznaczany jest stan `RUNNING` lub `AWAITING_REVIEW`.

### C. Hardening Silnika Automatyzacji i Potoków DAG (`src/main/core/`)
6. **Persystencja Pamięci Kursorowej ([src/main/core/AutomationEngine.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/main/core/AutomationEngine.ts)):** Przemodelowano `cursorStore` z czystej pamięci RAM na trwały zapis relacyjny do pliku na dysku (`data/cursor_store.json`). Zapewnia to odporność na resety aplikacji i eliminuje ryzyko ponownego wysyłania ofert na te same zlecenia Useme.
7. **Iteracyjne Dopasowywanie Nazw Plików ([src/main/core/AutomationEngine.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/main/core/AutomationEngine.ts)):** Zaktualizowano algorytm `cleanBase` o pętlę `while (prev !== cleaned)`, która całkowicie oczyszcza wielokrotne, zagnieżdżone dopiski systemowe plików (np. `raport - Copy (2).pdf`).
8. **Fail-Fast w Potoku Wykonawczym ([src/main/core/PipelineExecutor.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/main/core/PipelineExecutor.ts)):** Dodano rygorystyczne przerywanie pętli topologicznej DAG natychmiast po wystąpieniu błędu w dowolnym węźle (gdy `abortOnError !== false`), chroniąc potok przed kaskadowym błędnym przetwarzaniem.

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
