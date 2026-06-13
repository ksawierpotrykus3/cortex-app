# NEXUS — STRUKTURA KODU

> Dla AI które ma programować w Nexusie. Minimalna mapa kodu.
> Ostatnia aktualizacja: 2026-06-13

---

## ARCHITEKTURA

```
┌─────────────────────────────────────────────────────┐
│  RENDERER (React 19)                                 │
│  src/components/*.tsx        — widoki, panele, UI   │
│  src/renderer/store/*.ts     — stan (Zustand)        │
│  src/App.tsx                 — routing widoków       │
├─────────────────────────────────────────────────────┤
│  PRELOAD (most)                                      │
│  src/main/preload.ts         — contextBridge API     │
├─────────────────────────────────────────────────────┤
│  MAIN (Node.js / Electron)                           │
│  src/main/index.ts           — entry point           │
│  src/main/ipc/*.ts           — handlery IPC          │
│  src/main/core/*.ts          — silniki biznesowe     │
│  src/main/ai/*.ts            — adaptery AI           │
│  src/main/storage/*.ts       — baza danych           │
│  src/main/sandbox/*.ts       — izolowane wykonywanie │
└─────────────────────────────────────────────────────┘
```

**Komunikacja:** Renderer ↔ Preload (contextBridge) ↔ Main (ipcMain.handle/invoke)

---

## KLUCZOWE PLIKI

### Główne wejścia
| Plik | Co robi |
|------|---------|
| `src/main/index.ts` | Start Electrona, inicjalizacja silników, rejestracja IPC |
| `src/main/preload.ts` | contextBridge — API dla renderera |
| `src/App.tsx` | Routing widoków, stan główny aplikacji |
| `src/main.tsx` | Bootstrap Reacta |

### Komponenty UI (src/components/)
| Komponent | Opis |
|-----------|------|
| `NexusCanvas.tsx` | Mapa myśli — nieskończone płótno z węzłami i krawędziami |
| `LabTodo.tsx` | Tablica zadań — listy, taski, statusy, priorytety |
| `LabWriting.tsx` | Edytor pisania — manuskrypty, zakładki, foldery, reply |
| `WorkflowEditor.tsx` | Wizualny edytor workflowów (trigger → warunek → akcja) |
| `PipelineEditor.tsx` | DAG pipeline (sekwencje/równoległe) |
| `AgentListPanel.tsx` | Lista agentów AI z kartami |
| `AgentConfigPanel.tsx` | Konfiguracja agenta (prompt, model, trigger, uprawnienia) |
| `GitPanel.tsx` | Panel Git (status, commit, push, pull, branch, log) |
| `GitSettingsPanel.tsx` | Ustawienia Git (URL, token, autor, harmonogram) |
| `TopNavigation.tsx` | Górne menu nawigacyjne |
| `LeftSidebar.tsx` | Lewy panel (projekty, manuskrypty, listy) |
| `CommandPalette.tsx` | Ctrl+K — szybkie komendy |
| `ExportModal.tsx` | Eksport (JSON/MD/PDF) z wyborem zakresu |
| `LogViewer.tsx` | Podgląd logów agentów (wirtualizowany) |
| `DraftZone.tsx` | Human feedback na outputach agentów |
| `ChangesPanel.tsx` | Historia zmian |
| `DiffViewer.tsx` | Podgląd różnic |
| `WikiPanel.tsx` | Baza wiedzy |
| `FeedbackModal.tsx` | "Brakuje mi..." z kontekstem i ratingiem |
| `SettingsModal.tsx` | Ustawienia (API keys, Git, ogólne) |
| `Sandbox.tsx` | UI dla trybu sandbox |
| `SemanticSearch.tsx` | Szukaj semantyczny po notatkach |
| `KeyboardShortcuts.tsx` | Lista skrótów klawiszowych |

### Silniki (src/main/core/)
| Plik | Opis |
|------|------|
| `AgentOrchestrator.ts` | Orkiestracja agentów AI — wykonanie, streaming, context building |
| `WorkflowEngine.ts` | Silnik workflow — triggery, warunki, akcje, rejestry customizable |
| `PipelineExecutor.ts` | Wykonawca pipeline DAG — topologiczne sortowanie, równoległość |
| `ConditionEval.ts` | Ewaluacja bramek logicznych (IF/THEN) |
| `SearchEngine.ts` | Wyszukiwarka semantyczna |
| `KillSwitch.ts` | Awaryjne zatrzymanie wszystkich agentów |

### AI (src/main/ai/)
| Plik | Opis |
|------|------|
| `ProviderRegistry.ts` | Rejestr providerów AI + zarządzanie kluczami API |
| `GeminiAdapter.ts` | Google Gemini API |
| `OpenAIApiAdapter.ts` | OpenAI / OpenRouter API |

### Storage (src/main/storage/)
| Plik | Opis |
|------|------|
| `StorageEngine.ts` | SQLite + JSONL — persystencja outputów agentów, konfiguracji |

### Sandbox (src/main/sandbox/)
| Plik | Opis |
|------|------|
| `SandboxRunner.ts` | Uruchamianie agentów w izolowanym procesie (child_process.fork) |
| `SandboxWorker.ts` | Proces potomny — lekki fetch AI, timeout, limit pamięci |

### IPC (src/main/ipc/)
| Plik | Opis |
|------|------|
| `ElectronIpcBridge.ts` | Wszystkie handlery IPC — ~1150 linii, ~40 kanałów |

### Typy współdzielone (src/shared/types/)
| Plik | Opis |
|------|------|
| `schema.ts` | Wszystkie typy danych: Agent, Task, NexusNode, GitConfig, itp. |
| `ipc.ts` | Typy kanałów IPC: CommandChannels, TelemetryMessage, FirehoseMessage |
| `workflow.ts` | Typy workflow: WorkflowDefinition, WorkflowAction, ConditionGroup |

### Store (src/renderer/store/)
| Plik | Opis |
|------|------|
| `agentStore.ts` | Stan agentów (CRUD) |
| `workflowStore.ts` | Stan workflowów + szablony |
| `changelogStore.ts` | Stan changeloga/outputów |
| `commandStore.ts` | Stan command palette |
| `diffStore.ts` | Stan diffa (snapshoty przed zmianą) |
| `keydirStore.ts` | Stan KeyDir |

### Inne
| Plik | Opis |
|------|------|
| `src/types.ts` | Lokalne typy renderera (Task, WritingDraft, NexusNode, itp.) |
| `src/store.ts` | Główny store aplikacji (useAppStore) |
| `src/fs.ts` | Operacje na plikach (zapis/odczyt JSON) |
| `src/exportEngine.ts` | Silnik eksportu (JSON/MD/PDF) |
| `src/index.css` | Style globalne + Tailwind |
| `src/commands/index.ts` | Rejestr komend (30+ do Command Pallette) |

---

## TYPY DANYCH (najważniejsze)

### Agent
```ts
interface Agent {
  id: string;
  name: string;
  promptTemplate: string;   // prompt ze zmiennymi {{SCHOWEK}} itp.
  trigger: TriggerConfig;   // manual/hotkey/clipboard/screenshot
  model: ModelConfig;       // provider, modelName, temperature, maxTokens
  status: AgentStatus;      // ACTIVE | PAUSED | ERROR
  maxRetries: number;
  cooldownSeconds: number;
  budgetTokens: number;
  contextConfig?: ContextConfig;   // źródła kontekstu
  executionMode?: 'live' | 'sandbox'; // #7 MicroVM
  outputDestinations: OutputDestination[];
}
```

### Task
```ts
interface Task {
  id: string;
  title: string;
  description: string;
  status: 'Unresolved' | 'In Progress' | 'Resolved';
  priority: 'Critical' | 'Medium' | 'Low';
  listId: string;       // która lista
  annotations: NexusAnnotation[];
  thoughtMarkers: ThoughtMarker[];
}
```

### NexusNode (węzeł na mapie)
```ts
interface NexusNode {
  id: string;
  title: string;
  content: string;
  x: number; y: number;   // pozycja na płótnie
  projectId?: string;     // w którym projekcie
  imageData?: string;     // base64 obrazka
  cleanImageMode?: boolean;
  collapsed?: boolean;
  height?: number;
}
```

### Workflow
```ts
interface WorkflowDefinition {
  id: string;
  name: string;
  mode: 'sandbox' | 'live';
  trigger: WorkflowTrigger;
  conditions: ConditionGroup | null;   // IF/THEN
  actions: WorkflowAction[];
}
```

---

## IPC — JAK DZIAŁA KOMUNIKACJA

Renderer woła przez `window.nexusBridge.xxx(payload)`:
```ts
// preload.ts rejestruje:
window.nexusBridge = {
  getAgent: (id) => ipcRenderer.invoke('agent:get', id),
  executeAgent: (payload) => ipcRenderer.invoke('agent:execute', payload),
  saveFeedback: (payload) => ipcRenderer.invoke('feedback:save', payload),
  // ... ~40 metod
};

// main/ipc/ElectronIpcBridge.ts nasłuchuje:
ipcMain.handle('agent:get', async (event, id) => { ... });
ipcMain.handle('agent:execute', async (event, payload) => { ... });
```

---

## KONFIGURACJA

- `package.json` — zależności
- `electron.vite.config.ts` — build
- `tsconfig.json` — TypeScript
- `vitest.config.ts` — testy
- `.env` — klucze API (Gemini, OpenRouter)

---

## TESTY

Framework: **Vitest** + **@testing-library/react**

```bash
npx tsc --noEmit      # 0 błędów
npx vitest run         # wszystkie testy
```

Stan: **249 testów, 23 pliki testowe** (2026-06-13)

---

## CO MOŻNA DODAĆ (pomysły po master planie)

1. **Browser/Playwright** — nowa akcja workflow: otwieranie stron, automatyzacja, research
2. **Discovery template** — workflow do researchowania stron (link + prompt → AI)
3. **Quick Automate** — prosty panel do szybkich makr Playwright
4. **Więcej testów** — NexusCanvas, ExportModal, WorkflowEditor
