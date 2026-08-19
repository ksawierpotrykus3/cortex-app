# Plan czyszczenia Cortex → zostaje istniejący canvas, wylatuje reszta

## Cel

1. **ZOSTAWIĆ istniejący canvas** (`ExperimentalCanvas.tsx`) — projekty, węzły, krawędzie, pan/zoom, przeciąganie, adnotacje, undo. Nie piszemy canvasu od nowa.
2. **Chirurgicznie usunąć z canvasu AI** — czat, planer, spec, ustawienia AI, konwersacje, wiadomości, global context, diff/planner.
3. **Usunąć całą resztę appki** — agenty, useme, wiki, git, pipeline, workflow, research, search, keydir, top navigation, modale.
4. **Zostawić infrastrukturę AI w tle** (provider, rate limit, health monitor) — bez UI, bez kanałów w preload. Gotowa pod przyszłą, nową formę AI.
5. Zostawić warstwę persistencji (StorageEngine + IPC `projekty:*` + preload `proj*`).

**Zasada: NIE budujemy nowego canvasu. Istniejący `ExperimentalCanvas.tsx` odchudzamy do samej kanwy, zostawiając logikę canvasu nietkniętą.**

---

## 1. Pliki do usunięcia (całe)

### Komponenty (src/components — wszystko poza ExperimentalCanvas.tsx)
- src/components/BatchActionBar.tsx
- src/components/ContextBar.tsx
- src/components/CustomCommandsManager.tsx
- src/components/DiffModal.tsx
- src/components/DiffViewer.tsx
- src/components/DiffViewer.test.tsx
- src/components/DocumentPanel.tsx
- src/components/DraftZone.tsx
- src/components/DraftZone.test.tsx
- src/components/DryRunResultModal.tsx
- src/components/ErrorBoundary.tsx
- src/components/ErrorBoundary.test.tsx
- src/components/FloatingAgentPanel.tsx
- src/components/FloatingAgentPanel.test.tsx
- src/components/FolderPicker.tsx
- src/components/GitPanel.tsx
- src/components/GitPanel.test.tsx
- src/components/GitSettingsPanel.tsx
- src/components/HistoryButton.tsx
- src/components/ImageAttachmentsUI.tsx
- src/components/KeyboardShortcuts.tsx
- src/components/LiveFeed.tsx
- src/components/MermaidPlanPanel.tsx
- src/components/RpmIndicator.tsx
- src/components/SettingsModal.tsx
- src/components/TemplateAutocomplete.tsx
- src/components/TopNavigation.tsx
- src/components/TopNavigation.test.tsx
- src/components/WikiPanel.tsx
- src/components/WikiPanel.test.tsx
- src/components/WorkflowSandboxBanner.tsx
- src/components/useme/ExecutionControl.tsx
- src/components/useme/PromptRepository.tsx
- src/components/useme/ReviewQueueModal.tsx
- src/components/useme/UsemeContainer.tsx

### Hooki (src/hooks — cały katalog poza brakiem wyjątków)
- src/hooks/useExperimentalAI.ts
- src/hooks/useAutoLayout.ts
- src/hooks/useAgentContext.ts
- src/hooks/useAgentContext.test.tsx
- src/hooks/useClipboardPaste.ts
- src/hooks/useContextTracker.ts
- src/hooks/useFocusTrap.ts
- src/hooks/usePaginatedIPC.ts

### Renderer (src/renderer — cały katalog)
- src/renderer/components/agents/* (wszystkie)
- src/renderer/components/ui/ToggleSwitch.tsx
- src/renderer/store/agentStore.ts
- src/renderer/store/commandStore.ts
- src/renderer/store/diffStore.ts
- src/renderer/store/keydirStore.ts
- src/renderer/store/usemeStore.ts
- src/renderer/store/workflowStore.ts

### KeyDir
- src/keydir/index.ts

### Main core (src/main/core — cały katalog)
- src/main/core/AgentOrchestrator.ts (+ test)
- src/main/core/AutomationEngine.ts (+ test)
- src/main/core/BrowserEngine.ts (+ test)
- src/main/core/ConditionEval.ts (+ test)
- src/main/core/PipelineExecutor.ts (+ test)
- src/main/core/SearchEngine.ts
- src/main/core/WorkflowEngine.ts (+ test)

### Main AI (feature uboczne — adapter Gemini)
- src/main/ai/GeminiAdapter.ts

### Main IPC (Useme)
- src/main/ipc/usemeHandlers.ts
- src/main/ipc/usemeHandlers.test.ts

### Main services (poza SystemEventBus.ts)
- src/main/services/DocumentParser.ts
- src/main/services/DocumentSummarizer.ts
- src/main/services/NexusSelfAnalyzer.ts

### Utils (src/utils — cały katalog)
- src/utils/chatStorage.ts
- src/utils/diffEngine.ts (+ test)
- src/utils/geminiVision.ts
- src/utils/ids.ts
- src/utils/image.ts
- src/utils/searchEngine.ts

### Shared (feature uboczne)
- src/shared/templates/pipelineTemplates.ts
- src/shared/types/capabilities.ts
- src/shared/types/workflow.ts
- src/shared/utils/search.ts
- src/shared/validators/schemas.ts

### Pozostałe
- src/fs.ts
- src/store.ts

---

## 2. Pliki do zmodyfikowania

| Plik | Operacja |
|---|---|
| src/App.tsx | Przepisać na minimalny: `import { ExperimentalCanvas } from "./components/ExperimentalCanvas"; return <ExperimentalCanvas/>`. Usunąć całą nawigację, widoki, modale. |
| src/components/ExperimentalCanvas.tsx | **ZOSTAJE, ale odchudzony chirurgicznie** — patrz sekcja 3. |
| src/main/preload.ts | Zostawić wyłącznie metody `proj*` bez `projInvokeChatLLM`. Żadnego AI w `nexusBridge`. |
| src/main/ipc/ElectronIpcBridge.ts | Zostawić `registerProjektyHandlers()` bez handlera `projekty:chat:llm`. Usunąć wszystkie pozostałe handlery oraz import `../core/KillSwitch` (plik nie istnieje). |
| src/main/index.ts | Usunąć `AgentOrchestrator`, `UsemeHandlerManager`, `NexusSelfAnalyzer`. Zostawić `StorageEngine` + `ElectronIpcBridge` + (opcjonalnie) inicjalizację infrastruktury AI w tle. |
| src/types.ts | Zostawić sekcję "Tryb Projekty": `Projekt`, `ProjektyNode`, `ProjektyEdge`, `ProjektyNodeAnnotation`, `NodeType`, `NodeStatus`, `NodeMetadata`. Usunąć czat/spec/konfigurację AI oraz typy pozostałych feature'ów. |
| src/shared/types/ipc.ts | Zostawić wyłącznie typy `proj*` (bez `projInvokeChatLLM`). Usunąć resztę. |
| src/shared/types/schema.ts | Zostawić `ModelConfig`, `AIProvider`, `ProviderAuthConfig`, `DEFAULT_PROVIDERS` (dla infrastruktury AI w tle). |
| src/global.d.ts | Zostaje — deklaracja `window.nexusBridge` z metodami `proj*`. |
| src/index.css | Zostaje — style canvasu. |

---

## 3. ExperimentalCanvas.tsx — chirurgiczne usunięcie AI (canvas zostaje nietknięty)

### Importy do usunięcia
- `ProjektyConversation`, `ProjektyChatMessage`, `ProjektyAIConfig`, `GlobalContext` (linie 4–13)
- `RelationType` (linia 13)
- `useExperimentalAI`, `PlannerOperation` (linia 15)
- `useAutoLayout` (linia 16)
- `parseAiConfig` (linie 20–23)
- `AI_MODELS` (linia 25)

### Stany do usunięcia
- `conversations`, `activeConversationId` (50–51)
- `specContent` (54)
- `messages` (55)
- `specPanelOpen` (60)
- `chatDrawerOpen` (61)
- `chatModel`, `plannerModel` (64–65)
- `chatSystemPrompt`, `plannerSystemPrompt` (67–70)
- `showSettings` (71)
- `chatInput`, `messagesEndRef`, `chatInputRef` (74–76)
- destrukturyzacja `useExperimentalAI()` (90)
- `useAutoLayout()` / `applyLayout` (91)
- `diffProposal` (92)
- `aiError` (93)
- `plannerPhase` (96)
- `plannerProgress` (97)
- `globalContext` (98)
- `nodePosCounter`, `nextNodePos`, `resetNodePos` (101–109)
- `useEffect` scroll `messagesEndRef` (163–165)

### Funkcje do usunięcia (całe)
- `switchConversation` (283–291)
- `addConversation` (293–307)
- `saveSpec` (312–326)
- `useEffect` auto-zapis SPEC (328–333)
- `sendMessage` (338–380)
- `analyzeSpec` (385–416)
- `runAutoLayout` (421–426)
- `runPhase3Edges` (431–486)
- `runPhase2Decompose` (491–595)
- `runFullPlanFromSpec` (600–664)
- `runPhase4Diff` (669–752)
- `acceptPlannerDiff` (757–834)
- `runPlannerAI` (839–967)
- `saveAiConfig` (1072–1084)

### Funkcje do oczyszczenia (wyciąć wyłącznie fragmenty AI)
- `selectProject` (189–234):
  - usunąć: odczyt `ai_config`, ustawianie modeli/promptów, `global_context`, `setSpecContent`, konwersacje, wiadomości, `setAiError`
  - zostawić: ustawienie `activeProjectId` + localStorage, ładowanie `nodes` (223–226) i `edges` (227–230), obsługę błędu przez `setLoadError`
- `createProject` (239–255):
  - usunąć: `spec_content` (244), `ai_config` (245)
  - zostawić: tworzenie i zapis projektu
- `submitAnnotation` (972–1016):
  - usunąć: fragment budujący prompt AI i wywołujący `invokeChat` (985–1007)
  - zostawić: zapis adnotacji (`projSaveAnnotation`), aktualizację treści węzła (`projSaveNode`), reset `annotationNode`/`annotationText`

### Bloki JSX do usunięcia
- Przyciski: „Specyfikacja" (1161–1164), „Czat" (1165–1168), „Ustawienia AI" (1169–1171)
- Panel SPEC (1178–1207)
- Chat Drawer (1374–1455)
- Modal Ustawienia AI (1459–1487)
- Zmienić/ukryć podpowiedź o czacie/Planerze (linia ~1363)

### Co ZOSTAJE w ExperimentalCanvas.tsx (bez zmian)
- Projekty CRUD: `projects`, `activeProjectId`, `loadProjects`, `selectProject` (oczyszczony), `createProject`, `deleteProject`, `renameProject`, `projectLoaded`, `loadError`, `saveStatus`, `newProjectName`, `renameProjectId`, `renameValue`, `showNewProjectInput`
- Nodes/Edges: `nodes`, `edges`, renderowanie węzłów/krawędzi
- Canvas: `canvasRef`, `canvasOffset`, `canvasScale`, `isPanning`, `panStart`, `dragNode`, `dragStart`
- Handlery canvas (NIETKNIĘTE):
  - `handleCanvasMouseDown` (1021–1026)
  - `handleCanvasMouseMove` (1028–1037)
  - `handleCanvasMouseUp` (1039–1053)
  - `handleWheel` (1055–1059)
  - `handleNodeDragStart` (1061–1067)
- Adnotacje: `annotationNode`, `annotationText`, `submitAnnotation` (oczyszczony), UI adnotacji
- Undo: `undoStack`, `pushUndo`, efekt Ctrl+Z (112–134)
- Auto-zapis dirty nodes (137–156)
- Top Bar projektów, siatka canvasu, wskaźnik zoomu, ekran startowy, obsługa `loadError`

---

## 4. Zostawiamy (celowo)

### Persistencja i IPC (rdzeń canvasu)
- src/main/storage/StorageEngine.ts
- src/main/ipc/ElectronIpcBridge.ts (tylko projekty:*)
- src/main/preload.ts (tylko proj*)
- src/main/index.ts (StorageEngine + ElectronIpcBridge)

### Infrastruktura AI w tle (bez UI, bez IPC w preload)
- src/main/ai/ProviderRegistry.ts
- src/main/ai/IAIProvider.ts
- src/main/ai/OpenAIApiAdapter.ts
- src/main/ai/RateLimiter.ts
- src/main/ai/AiHealthMonitor.ts
- src/main/services/SystemEventBus.ts
- src/main/config.ts

Uwaga: te pliki NIE są wywoływane z renderera. Pozostają jako gotowa warstwa do przyszłej, nowej formy AI. Jeśli po przebudowie nic ich nie importuje, zostają jako moduły nieużywane z main — do zweryfikowania, czy main/index.ts ma je wciąż inicjalizować, czy zostawić "martwe".

---

## 5. Kolejność wykonywania

1. Commit stanu bazowego (git).
2. Usunąć pliki z sekcji 1 (całe katalogi/pliki).
3. Chirurgicznie odchudzić `ExperimentalCanvas.tsx` (sekcja 3).
4. Przepisać `App.tsx` na minimalny (renderuje `ExperimentalCanvas`).
5. Odchudzić `ElectronIpcBridge.ts` → tylko `projekty:*` (bez `chat:llm`).
6. Odchudzić `preload.ts` → tylko `proj*` (bez AI).
7. Odchudzić `main/index.ts` → `StorageEngine` + `ElectronIpcBridge`.
8. Odchudzić `types.ts` / `ipc.ts` / `schema.ts`.
9. Zweryfikować łańcuch importów (usunąć nieużywane).
10. Zbudować projekt (`npm run build`) i naprawić błędy.

---

## 6. Ryzyka

- Usunięcie nieodwracalne poza git → commit przed startem.
- `ElectronIpcBridge.ts` importuje nieistniejący `../core/KillSwitch` → przebudowa to naprawi.
- `StorageEngine.ts` może mieć metody dokumentów zależne od `ProviderRegistry` → sprawdzić i wyciąć lub zostawić w tle.
- Infrastruktura AI zostaje „martwa" do czasu nowej formy AI → upewnić się, że nie jest importowana w rendererze/preload.
- `ExperimentalCanvas.tsx` po odchudzeniu może wymagać drobnych poprawek typów (usunięte importy) — naprawić przy buildzie.