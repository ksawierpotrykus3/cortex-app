# RAPORT STANU SYSTEMU NEXUS
**Dokumentacja Techniczna i Architektoniczna (Stan na dzień: 05.07.2026)**
**Przeznaczenie:** Referencja deweloperska dla agentów AI / Systemy RAG

---

## 1. METADANE PROJEKTU
*   **Nazwa aplikacji:** `nexus-system` (v1.1.1)
*   **Architektura:** Electron (Main Process) + React 19 (Renderer Process) + Vite + TypeScript
*   **Lokalizacja repozytorium:** `c:/Users/Ksawier/Pictures/Screenshots/nexus`
*   **Silnik AI:** DeepSeek V4 Flash / Pro przez lokalne proxy `localhost:4570/v1` (OpenAI-compatible API)
*   **Bazy danych:** `nexus.workspace.json` (główny workspace) + SQLite `workspace.db` (dane eksperymentalne, logi) + IndexedDB (czat)
*   **Faza projektu:** **STABILNA** — audyt 04.07.2026 naprawiony (9 krytycznych/wysokich błędów), wdrożone SUPPORTS v5 (05.07.2026), TypeScript czysty (tsc --noEmit przechodzi)

---

## 2. PROFILE TECHNOLOGICZNE (TECH STACK)

### A. Główne Zależności (Dependencies)
*   **Framework:** `electron` (v42.3.2) + `electron-vite` (v2.3.0)
*   **UI:** `react` & `react-dom` (v19.0.1) + `tailwindcss` (v4.1.14) + `motion` (v12.40.0) + `lucide-react` (v0.546.0)
*   **Stan:** `zustand` (v5.0.0)
*   **Baza danych:** `better-sqlite3` (v11.8.0) + `idb-keyval` (v6.2.5)
*   **AI:** `@google/genai` (v2.7.0) — używany tylko przez GeminiAdapter, główny provider to DeepSeek przez OpenAI-compatible API
*   **Grafy:** `@dagrejs/dagre` (v3.0.0)
*   **Wirtualizacja:** `react-window` (v1.8.11)

### B. Środowisko Testowe (Dev Dependencies)
*   `vitest` (v4.1.8) + `@testing-library/react` (v16.3.2) + `jsdom` (v29.1.1)
*   `playwright` (v1.61.0) + `@playwright/test` (v1.60.0)

### C. Skrypty
*   `npm run dev` — development (electron-vite)
*   `npm run build` — produkcja
*   `npm run lint` — TypeScript check (`tsc --noEmit`)
*   `npm run test` — testy jednostkowe
*   `npm run test:e2e` — testy E2E

---

## 3. CO JEST W SYSTEMIE — PEŁNY KATALOG FUNKCJI

### 3.1. NEXUS CANVAS — Nieskończona mapa myśli (widok `nexus`)
Główny widok aplikacji. Wizualny canvas z nodami i krawędziami.
*   **Komponenty:** `NexusCanvas.tsx`, `LeftSidebar.tsx`, `RightPanel.tsx`
*   **Encje:** `NexusNode`, `NexusLink` — definiowane w [src/types.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/types.ts)
*   **Funkcje:** przeciąganie nodów, zoom (kółko myszy), łączenie krawędziami, tagi, adnotacje, załączniki obrazów, markery myśli (certain/hypothesis/question/answer)
*   **Persystencja:** `nexus.workspace.json` przez [src/fs.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/fs.ts) z auto-zapisem
*   **UWAGA (05.07.2026):** Przyciski "Topology" i "Laboratory" usunięte z TopNavigation. Widok `nexus` dostępny tylko przez bezpośrednią nawigację/Command Palette.

### 3.2. LABORATORY — Taski i pisanie (widoki `lab-todo`, `lab-writing`) — **USUNIĘTE Z UI (05.07.2026)**
*   ~~LabTodo~~ — zarządzanie zadaniami
*   ~~LabWriting~~ — edytor długich tekstów/manuskryptów z metadanymi
*   Komponenty `LabTodo.tsx` i `LabWriting.tsx` nadal istnieją w kodzie, ale nie są już renderowane w `App.tsx`. Przycisk "Laboratory" usunięty z TopNavigation.

### 3.3. WIKI — Baza wiedzy (widok `wiki`)
*   **Komponent:** [src/components/WikiPanel.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/WikiPanel.tsx)
*   Artykuły z tagami, kategoriami, źródłami (`WikiArticle`). AI może używać jako kontekst RAG.

### 3.4. GIT — Integracja z repozytorium (widok `git`)
*   **Komponent:** [src/components/GitPanel.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/GitPanel.tsx)
*   Status, diff, commit, push, pull, branch, merge, harmonogram auto-commitów
*   Handler w [ElectronIpcBridge.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/main/ipc/ElectronIpcBridge.ts) (linie 1300-1600)

### 3.5. FEEDBACK — System opinii (widok `feedback`)
*   **Komponenty:** `FeedbackPanel.tsx`, `FeedbackModal.tsx`
*   Zbieranie RLHF od użytkownika dla operacji AI

### 3.6. CHANGES — Panel zmian (widok `changes`)
*   **Komponent:** [src/components/ChangesPanel.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/ChangesPanel.tsx)
*   Historia operacji z możliwością zatwierdzania/odrzucania (changelog)

### 3.7. RAW FRAGMENTS — Surowe fragmenty (widok `raw-fragments`)
*   **Komponent:** [src/components/RawFragmentsView.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/RawFragmentsView.tsx)
*   Przeglądarka nieustrukturyzowanych danych

### 3.8. LOGS — Podgląd logów (widok `logs`)
*   **Komponent:** [src/components/LogViewer.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/LogViewer.tsx)

### 3.9. SANDBOX — Środowisko testowe AI (widok `sandbox`)
*   **Komponent:** [src/components/Sandbox.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/Sandbox.tsx)
*   Izolowane wykonanie promptów AI z podglądem wyników
*   Backend: `SandboxRunner.ts` + `SandboxWorker.ts`

### 3.10. USEME — Automatyzacja platformy Useme (widok `useme`)
*   **Komponenty:** `UsemeContainer.tsx`, `ExecutionControl.tsx`, `ReviewQueueModal.tsx`, `PromptRepository.tsx`
*   **Backend:** [src/main/ipc/usemeHandlers.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/main/ipc/usemeHandlers.ts)
*   **Silnik:** zewnętrzny `useme-ai-automation` uruchamiany przez `child_process.spawn`
*   **Tryby:** Dry-run (symulacja) i produkcyjny
*   **Funkcje:** podgląd logów na żywo, edycja promptów, modal human-in-the-loop (zatwierdzanie/odrzucanie/poprawianie ofert)
*   **Uwaga:** `useme:submit-decision` to stub — decyzja nie jest przekazywana do silnika (do naprawy)

### 3.11. EKSPERYMENTALNY TRYB — Czat AI + Planer Architektoniczny (widok `experimental`)
*   **Komponent:** [src/components/ExperimentalCanvas.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/ExperimentalCanvas.tsx) (~1500 linii)
*   **Backend:** SQLite przez `StorageEngine` — dedykowane tabele:
    *   `experimental_projects` — projekty z treścią specyfikacji
    *   `experimental_conversations` — konwersacje AI
    *   `experimental_chat_messages` — wiadomości z czatu (z polem `metadata` dla `processed_by_ai`)
    *   `experimental_nodes` — nody na mapie (z node_type, status, pozycją x/y)
    *   `experimental_edges` — krawędzie między nodami
    *   `experimental_node_annotations` — adnotacje do nodów
    *   `experimental_changelog` — historia zmian
*   **Funkcje:**
    *   Czat z AI (modele DeepSeek V4 Flash/Pro, konfigurowalny system prompt)
    *   **Zunifikowany Planer** (`runUnifiedAI`) — zastąpił stare 4 fazy i przycisk "Przebuduj plan z rozmowy" (wdrożone 05.07.2026, SUPPORTS v5)
    *   **Jeden przycisk `[Aktualizuj plan]`** — dwie ścieżki: pusta plansza → `runFullPlanFromSpec()`, plansza z węzłami → AI analizuje pełny kontekst (SPEC + nodes + edges + historia czatu)
    *   **Panel zatwierdzania zmian** — AI zwraca listę operacji z wyjaśnieniami DLACZEGO, użytkownik zatwierdza lub odrzuca
    *   **Auto-zapis SPEC** — co 500ms bezczynności
    *   **Ostrzeżenie 30%** — przy masowym usuwaniu węzłów
    *   **Oznaczanie wiadomości** — `processed_by_ai` w metadata, AI widzi które wiadomości już przetworzyło
    *   Usunięto przyciski: `[Notatka]` przy AI, `Analizuj z AI`, `Generuj plan ze SPEC`, `Zapisz` z panelu SPEC
    *   Auto-layout nodów przez `useAutoLayout`
    *   Drag & drop nodów, zoom
    *   Wszystkie operacje CRUD przez IPC (`expSave*`, `expGet*`, `expDelete*`)

### 3.12. NARZĘDZIA GLOBALNE
*   **Command Palette** (`Ctrl+K`) — [src/components/CommandPalette.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/CommandPalette.tsx)
*   **Keyboard Shortcuts** — [src/components/KeyboardShortcuts.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/KeyboardShortcuts.tsx) + `keydirStore`
*   **Semantic Search** — [src/components/SemanticSearch.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/SemanticSearch.tsx), backend `SearchEngine.ts`
*   **Export** — [src/components/ExportModal.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/ExportModal.tsx) + `exportEngine.ts`
*   **Diff Viewer** — [src/components/DiffViewer.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/DiffViewer.tsx) + `diffEngine.ts`
*   **KillSwitch** — [src/components/KillSwitchBanner.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/KillSwitchBanner.tsx), backend `KillSwitch.ts` — zatrzymuje wszystkie procesy AI
*   **Settings** — [src/components/SettingsModal.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/SettingsModal.tsx)
*   **Onboarding** — [src/components/OnboardingOverlay.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/OnboardingOverlay.tsx)
*   **Status Bar** — [src/components/StatusBar.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/StatusBar.tsx)
*   **Splash Screen** — [src/components/SplashScreen.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/SplashScreen.tsx)
*   **Tag Suggest** — [src/components/TagSuggestDialog.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/TagSuggestDialog.tsx)
*   **At-Mention Autocomplete** — [src/components/AtMentionAutocomplete.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/AtMentionAutocomplete.tsx)
*   **Draft Zone** — [src/components/DraftZone.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/DraftZone.tsx)
*   **Error Boundary** — [src/components/ErrorBoundary.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/ErrorBoundary.tsx)

---

## 4. ARCHITEKTURA MAIN PROCESS

### 4.1. Bootstrap (`src/main/index.ts`)
Sekwencja uruchamiania:
1. `startDeepSeekProxy()` — sprawdza czy proxy działa na `localhost:4570`, jeśli nie — uruchamia
2. `new StorageEngine(DATA_DIR)` + `storage.init()` — inicjalizacja SQLite + JSON
3. `new AiHealthMonitor()` — monitorowanie zdrowia AI
4. `new ProviderRegistry(healthMonitor)` — rejestracja providerów AI
5. `new AgentOrchestrator(...)` — orkiestracja agentów AI
6. `new ElectronIpcBridge(...)` + `ipcBridge.registerHandlers()` — rejestracja ~117 handlerów IPC
7. `new UsemeHandlerManager()` + `registerUsemeHandlers()` — rejestracja handlerów Useme
8. `createMainWindow()` — tworzenie okna Electron

### 4.2. Provider AI (`src/main/ai/`)
*   **ProviderRegistry.ts** — singleton zarządzający adapterami AI, failover, rate limiting
*   **OpenAIApiAdapter.ts** — adapter OpenAI-compatible (używany dla DeepSeek przez `localhost:4570/v1`)
*   **GeminiAdapter.ts** — adapter Google Gemini (używany przez `@google/genai`)
*   **IAIProvider.ts** — interfejs providera
*   **RateLimiter.ts** — ograniczanie RPM
*   **AiHealthMonitor.ts** — monitorowanie zdrowia endpointów AI
*   **Konfiguracja DeepSeek:** Dwa domyślne providery (Flash i Pro) wskazujące na `http://localhost:4570/v1` zdefiniowane w [src/shared/types/schema.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/shared/types/schema.ts) jako `DEFAULT_PROVIDERS`

### 4.3. Core (`src/main/core/`)
*   **AgentOrchestrator.ts** — orkiestracja agentów AI z circuit breakerem
*   **AutomationEngine.ts** — silnik automatyzacji Useme z pamięcią kursorową
*   **BrowserEngine.ts** — integracja z Playwright (scraping, automatyzacja)
*   **PipelineExecutor.ts** — wykonawca potoków DAG (fail-fast)
*   **WorkflowEngine.ts** — silnik workflowów
*   **SearchEngine.ts** — wyszukiwanie semantyczne
*   **KillSwitch.ts** — awaryjne zatrzymywanie procesów
*   **ConditionEval.ts** — ewaluacja warunków w pipeline/workflow

### 4.4. Storage (`src/main/storage/`)
*   **StorageEngine.ts** — dualna baza: SQLite (`better-sqlite3`) + JSONL fallback
*   Tabele: outputs, agents, provider_configs, + 7 tabel experimental

### 4.5. Sandbox (`src/main/sandbox/`)
*   **SandboxRunner.ts** — uruchamianie workera w procesie potomnym
*   **SandboxWorker.ts** — izolowane wykonanie promptów AI

### 4.6. IPC Bridge (`src/main/ipc/`)
*   **ElectronIpcBridge.ts** — główny most IPC (~2000 linii), rejestruje handlery dla wszystkich modułów
*   **usemeHandlers.ts** — dedykowane handlery dla automatyzacji Useme
*   **preload.ts** — eksponuje `window.nexusBridge` przez `contextBridge` (~300 linii, ~117 metod)

### 4.7. Konfiguracja (`src/main/config.ts`)
*   `deepseekProxy.enabled: true`
*   `deepseekProxy.baseUrl: 'http://localhost:4570/v1'`
*   `deepseekProxy.healthUrl: 'http://localhost:4570/health'`
*   `deepseekProxy.models: ['deepseek-ai/deepseek-v4-flash', 'deepseek-ai/deepseek-v4-pro']`

---

## 5. AKTYWNE WIDOKI (ViewMode)
Zdefiniowane w [src/types.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/types.ts):
```
'nexus' | 'lab-todo' | 'lab-writing' | 'sandbox' | 'raw-fragments' |
'logs' | 'agents' | 'mermaid-plan' | 'changes' | 'wiki' | 'git' |
'feedback' | 'useme' | 'experimental'
```
**Wszystkie 14 widoków** jest zdefiniowanych w typie. `agents`, `mermaid-plan`, `lab-todo` i `lab-writing` są w typie ale nieaktywne w UI (zakomentowane/usunięte z [App.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/App.tsx)).

---

## 6. SCHEMATY DANYCH

### 6.1. NexusState (główny workspace — `nexus.workspace.json`)
Definiowany w [src/fs.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/fs.ts):
```typescript
interface NexusState {
  nodes: NexusNode[];           // Węzły na canvasie
  links: NexusLink[];           // Połączenia między węzłami
  tasks: Task[];                // Zadania
  drafts: WritingDraft[];       // Drafty tekstowe
  geminiKey: string;            // Klucz API Gemini
  manuscriptFolders?: ManuscriptFolder[];
  manuscriptTabs?: ManuscriptTab[];
  manuscriptMetas?: ManuscriptMeta[];
  changelog?: ChangeEntry[];    // Dziennik zmian
  feedback?: FeedbackEntry[];   // Opinie użytkownika
  wiki?: WikiArticle[];         // Artykuły Wiki
  pipelines?: Pipeline[];       // Definicje potoków DAG
  workflows?: WorkflowDefinition[];
  snapshots?: EntitySnapshot[];
  customCommands?: CustomCommandData[];
  shortcutOverrides?: ShortcutOverride[];
  studioCanvas?: any;
  mermaidDrafts?: any[];
}
```

### 6.2. Baza SQLite (Experimental Mode — `workspace.db`)
7 tabel z pełnym CRUD:
| Tabela | Opis |
|--------|------|
| `experimental_projects` | Projekty z treścią specyfikacji |
| `experimental_conversations` | Konwersacje AI |
| `experimental_chat_messages` | Wiadomości z czatu |
| `experimental_nodes` | Nody na mapie |
| `experimental_edges` | Krawędzie między nodami |
| `experimental_node_annotations` | Adnotacje do nodów |
| `experimental_changelog` | Historia zmian |

---

## 7. CO JEST NIEKTYWNE (zakomentowane/usunięte z UI)

Wszystkie poniższe są **celowo wyłączone** w [App.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/App.tsx):

*   **Agenci AI** — `FloatingAgentPanel`, `useAgentStore`, `useChangelogStore`, IPC hooks dla agentów (oznaczone `// [AI] Phase 1`)
*   **Pipeliny / Workflowy** — `useWorkflowStore`, widoki pipeline/workflow (oznaczone `// [AI] Phase 1`)
*   **Mermaid Plan** — `MermaidPlanPanel`, generator diagramów (oznaczone `// [AI] Phase 1`)
*   **Workflow Studio 2.0** — usunięte całkowicie
*   **Laboratory (lab-todo, lab-writing)** — usunięte z UI 05.07.2026. Komponenty `LabTodo.tsx`, `LabWriting.tsx` nadal istnieją.
*   **Topology (przycisk nawigacyjny)** — usunięty z TopNavigation 05.07.2026. Widok `nexus` nadal dostępny.

Kod źródłowy tych funkcji **istnieje** w repozytorium, jest tylko zakomentowany/usunięty z warstwy UI/nawigacji.

---

## 8. ZNANE PROBLEMY (stan na 05.07.2026)

### 8.1. Błędy TypeScriptu (`tsc --noEmit` nie przechodzi)
| Plik | Problem |
|------|---------|
| `UsemeContainer.tsx` | `addReview` nie istnieje w typie `UsemeActions` |
| `OpenAIApiAdapter.ts` | `reader.locked` nie istnieje w typie ReadableStream |
| `AgentOrchestrator.ts` | `AgentStatus.COMPLETED` nie istnieje w enumie |
| `BrowserEngine.test.ts` | Porównanie `"down"` vs `"up"` |
| `index.ts` | `config.deepseekProxy.port` i `.startupTimeoutMs` nie istnieją |
| `preload.ts` | Brak `usemeSubmitDecision` w typie `NexusBridge` |
| `TopNavigation.tsx` | Martwe importy: `Bot`, `ScrollText`, `Network`, `Workflow` (ikony nieużywane po usunięciu przycisków Topology/Laboratory) |

### 8.2. Useme: submit-decision
`useme:submit-decision` w [ElectronIpcBridge.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/main/ipc/ElectronIpcBridge.ts) (linia ~775) to stub — zawsze zwraca `{ success: true }` ignorując payload. Decyzja użytkownika nie trafia do silnika automatyzacji. Modal recenzji działa wizualnie, ale bez wpływu na proces.

### 8.3. Naprawione w audycie 04-05.07.2026
9 błędów krytycznych/wysokich naprawionych z komentarzami `// fix(audyt):`:
*   `state` undefined w `callAIStreaming` (AgentOrchestrator)
*   8-znakowe UUID → pełne 36-znakowe (ids.ts)
*   `send()` → `invoke()` dla changelog approve/reject (preload.ts)
*   Zdefiniowano `nextNodePos()` i `resetNodePos()` (ExperimentalCanvas)
*   Kolizje kluczy IndexedDB — klucz z timestampem (chatStorage.ts)
*   JSONL outputów zapisywany zawsze, nie tylko gdy SQLite (StorageEngine.ts)
*   `browser.close()` w `finally` (PipelineExecutor.ts)
*   `browserLaunching` resetowany po udanym połączeniu (BrowserEngine.ts)
*   `dashboardSelector` bezpiecznie wstrzykiwany przez JSON.stringify (AutomationEngine.ts)

---

## 9. WYTYCZNE DLA AI PRACUJĄCYCH NAD KODEM

1. **Nie usuwaj zakomentowanego kodu** — bloki oznaczone `// [AI] Phase 1` są celowo zachowane do przyszłego przywrócenia.
2. **Nie usuwaj komentarzy `// fix(audyt):`** — dokumentują naprawione błędy krytyczne i chronią przed regresją.
3. **TypeScript first** — wszystkie zmiany muszą przechodzić `tsc --noEmit`. Cel: wyczyścić 7 pozostałych błędów.
4. **SQLite dla nowych funkcji** — każda nowa encja powinna iść do `workspace.db` przez `StorageEngine`, nie do monolitycznego JSON.
5. **IPC tylko przez `ipcMain.handle()` + `ipcRenderer.invoke()`** — nie używaj `send()`/`on()`.
6. **Nowe providery tylko przez `ProviderAuthConfig`** — nie hardcoduj URL-i ani kluczy API.
7. **Każda nowa funkcja w UI musi mieć wpis w `ViewMode`** w `types.ts`.