# Audyt Kompleksowy — Nexus Workflow Studio 2.0

> **Data:** 2026-06-22
> **Workspace:** c:\Users\Ksawier\Pictures\Screenshots\nexus
> **Autor:** Trae AI (2 tury audytu: wstępna + głęboka)

---

## Spis treści

1. [TURA 1 — Audyt wstępny](#tura-1--audyt-wstępny)
   - [1. Błędy kompilacji TypeScript](#1-błędy-kompilacji-typescript)
   - [2. Stan komponentów frontendu](#2-stan-komponentów-frontendu)
   - [3. Stan typów (types.ts)](#3-stan-typów-typests)
   - [4. Backend / IPC](#4-backend--ipc)
   - [5. Storage / Persystencja](#5-storage--persystencja)
   - [6. Nieużywane / Dead Code](#6-nieużywane--dead-code)
   - [Podsumowanie i rekomendacje (Tura 1)](#podsumowanie-i-rekomendacje-tura-1)

2. [TURA 2 — Audyt głęboki](#tura-2--audyt-głęboki)
   - [7. Zależności i importy](#7-zależności-i-importy)
   - [8. Przepływ danych IPC](#8-przepływ-danych-ipc)
   - [9. Bezpieczeństwo i bugi runtime](#9-bezpieczeństwo-i-bugi-runtime)
   - [10. Spójność nazewnictwa i architektury](#10-spójność-nazewnictwa-i-architektury)
   - [11. Testy i coverage](#11-testy-i-coverage)

3. [Plan naprawczy — wszystkie priorytety](#plan-naprawczy--wszystkie-priorytety)

---

# TURA 1 — Audyt wstępny

## 1. Błędy kompilacji TypeScript

**Łącznie: 15 błędów** w 4 plikach.

### Pre-existing (11 błędów — nie związane z WF Studio 2.0)

| Plik | Błędy | Problem |
|------|-------|---------|
| `FeedbackPanel.tsx` | 6 | `feedbackType` nie istnieje w `FeedbackEntry` z `types.ts` (ale istnieje w `schema.ts`) |
| `FeedbackPanel.test.tsx` | 3 | Ten sam konflikt `feedbackType` |
| `exportEngine.ts` | 2 | Brak `axioms` w presecie `ExportScope` |

### Nowe — integracja WF Studio (4 błędy)

| Plik:Linia | Problem |
|---|---|
| `App.tsx:955` | `feedbackType` missing in `FeedbackEntry` from types.ts |
| `App.tsx:959` | `feedbackType` does not exist on type |
| `App.tsx:962` | `feedbackType` does not exist on type |
| `App.tsx:966` | `feedbackType` does not exist on type |

> **Źródło:** Dwie definicje interfejsu `FeedbackEntry` — w `types.ts` (bez `feedbackType`) i w `schema.ts` (z `feedbackType`). IPC używa tej z `schema.ts`.

---

## 2. Stan komponentów frontendu

### WorkflowStudioCanvas.tsx ✅ (903 linie — dobry stan)

- **11 typów węzłów:** `llm-agent`, `condition`, `router`, `accumulator`, `human-in-the-loop`, `browser-automate`, `local-executor`, `action`, `action-chain`, `system-reader`, `system-writer`
- Manhattan routing dla krawędzi
- Zoom/Pan/Drag & drop
- Porty z warunkami (in/out/out-true/out-false)
- **Panel AdvancedNodePanel** z dwuwarstwowym trybem Intuitive/Advanced (temperatura, max tokenów)
- **ResultPanel** przez RMB (prawy przycisk myszy) na węźle
- **Brak implementacji wykonawczej** dla `local-executor`, `action-chain`, `system-reader`, `system-writer` (tylko UI)
- **Martwe importy:** `Clipboard`, `Eye`, `EyeOff` z lucide-react (zaimportowane, nieużywane)

### MermaidPlanPanel.tsx ✅ (497 linii — bardzo dobry)

- Własny parser Mermaid → SVG inline (bez zewnętrznej biblioteki)
- Interaktywne komentowanie przez kliknięcie węzła → czat
- Kompilacja na płótno Workflow Studio
- Custom prompt edytowalny przez użytkownika
- Fullscreen, generowanie przez AI
- **⚠️ XSS:** `edge.label` nie jest sanityzowany przez `esc()` przed wstawieniem do SVG przez `dangerouslySetInnerHTML`

### FloatingAgentPanel.tsx ✅ (495 linii — dobry)

- W pełni zintegrowany z `chatStorage.ts` (IndexedDB) — auto-zapis debounced 1s, wczytywanie przy otwarciu panelu
- System capability (R - read / N - notify / A - approve)
- Context tracker (zaznaczony tekst, schowek, aktywny widok)
- **Problem:** `onSaveFeedback` w propsach zdefiniowany ale nieużywany wewnątrz komponentu

### TopNavigation.tsx ✅ (255 linii — bardzo dobry)

- Workflow Studio jako główny przycisk z ikonką `Bot` i fioletowym akcentem
- Mermaid w dropdown "More"
- KillSwitch button z pollingiem co 3s
- Czytelny `NavGroup` z subviews

### StatusBar.tsx ✅ (98 linii — czysty)

- Wszystkie `ViewMode` w mapie — w tym `workflow-studio` i `mermaid-plan`

---

## 3. Stan typów (types.ts)

### Konflikty i niespójności

| Problem | Opis | Ryzyko |
|---------|------|--------|
| **Dwie definicje `FeedbackEntry`** | `types.ts` (bez `feedbackType`) vs `schema.ts` (z `feedbackType`) — IPC używa z `schema.ts` | 🔴 Wysokie — powoduje 10/15 błędów TS |
| **`ExportScope.axioms`** | Pole istnieje w types.ts ale brak w presecie `exportEngine.ts` | 🟡 Średnie |
| **Legacy `WorkflowNode`** | Nadal istnieje obok `StudioNode` — może powodować confusion | 🟢 Niskie |
| **`Pipeline`** | Używa starego `WorkflowNode` — nie jest zastąpiony przez `StudioCanvas` | 🟡 Średnie — dwie ścieżki danych |

---

## 4. Backend / IPC

### AutomationEngine.ts ✅ (349 linii — dobry)

- Izolacja profili (`getOrCreateBrowserProfile`)
- Pamięć kursorowa (`CursorState` z `Set<string>` max 1000)
- Fuzzy matching nazw plików (regex na "(1)", " - Copy", "_copy")
- Multi-persona pipeline config
- Auth Guard dla dashboardu
- **Brak integracji z ElectronIpcBridge** — nie ma handlerów IPC dla `automation:*`

### BrowserEngine.ts ✅ (379 linii — dobry)

- `executeWithProfile()` — izolacja przez `userDataDir`
- `extractListWithCursor()` — pamięć kursorowa na liście elementów
- Detekcja `authLost`
- Pełen zestaw akcji (GOTO, CLICK, TYPE, EXTRACT, DOWNLOAD, SCREENSHOT, EVALUATE)
- **⚠️ RCE:** `page.evaluate(step.script)` — brak walidacji skryptu

### ElectronIpcBridge.ts / StorageEngine.ts

- Nie były modyfikowane w ramach WF Studio 2.0 — nadal operują na starych `Pipeline`/`WorkflowDefinition`
- **Brak handlerów dla `studio:*` i `mermaid:*` kanałów IPC**

---

## 5. Storage / Persystencja

### chatStorage.ts ✅ (95 linii — bardzo dobry)

- IndexedDB przez `idb-keyval` z dedykowanym storem `nexus-chats/sessions`
- Indeks agent IDs przez klucz `__agent_ids__`
- `saveChatSessions`, `loadChatSessions`, `deleteChatSession`, `clearAllChatSessions`
- Integracja w `FloatingAgentPanel` — wczytywanie przy otwarciu, auto-zapis debounced

### StudioCanvas persistence ❌

- **Brak** — `studioCanvas` istnieje tylko w `useState` w `App.tsx`, nie jest zapisywany do workspace. Po odświeżeniu strony cały workflow znika.

### MermaidDrafts persistence ❌

- **Brak** — wszystkie szkice Mermaid giną po odświeżeniu.

---

## 6. Nieużywane / Dead Code

| Plik / Komponent | Status | Uwaga |
|---|---|---|
| `PipelineEditor.tsx` (~686 linii) | **Dead code** | Zastąpiony przez WorkflowStudioCanvas, tylko test go importuje |
| `WorkflowEditor.tsx` (~400 linii) | **Dead code** | Zero importów |
| `WorkflowList.tsx` (91 linii) | **Dead code** | Zero importów |
| `AgentListPanel.tsx` (~200 linii) | **Dead code** | Zero importów |
| `AgentConfigPanel.tsx` (~400 linii) | **Dead code** | Zero importów |
| `ChangelogPanel.tsx` | **Dead code** | Nadal w repo |
| `AgentsView` (funkcja w App.tsx) | **Dead code** | Zdefiniowana, nigdy nie wywołana |

---

## Podsumowanie i rekomendacje (Tura 1)

| Priorytet | Co zrobić |
|---|---|
| 🔴 **Krytyczne** | Naprawić konflikt `FeedbackEntry` między `types.ts` a `schema.ts` |
| 🔴 **Krytyczne** | Ujednolicić dwie definicje `FeedbackEntry` |
| 🟡 **Wysoki** | Zapisywać `StudioCanvas` do workspace |
| 🟡 **Wysoki** | Dodać IPC handlery dla `mermaid:*` i `studio:*` |
| 🟡 **Wysoki** | Dodać `ExportScope.axioms` do presetów w `exportEngine.ts` |
| 🟢 **Średni** | Usunąć dead code (5+ komponentów) |
| 🟢 **Średni** | Dodać handler dla `local-executor` w PipelineExecutor |
| 🟢 **Niski** | Dodać testy dla nowych komponentów |

---

# TURA 2 — Audyt głęboki

## 7. Zależności i importy

### 7.1 Cykle zależności

| Cykl | Opis | Ryzyko |
|------|------|--------|
| `App.tsx` → `commands/index` → `renderer/store/commandStore` → (dynamic) `types.ts` | Potencjalny cykl przy dynamicznym imporcie | 🟡 Średnie |
| `keydir/index` → `renderer/store/keydirStore` → (przez App.tsx) → `keydir/index` | Quasi-cykl przez App.tsx | 🟢 Niskie |
| `fs.ts` → `renderer/store/commandStore` → (dynamic) `types.ts` → (App.tsx) → `fs.ts` | **Faktyczny cykl:** fs.ts importuje z renderer/store | 🟡 Średnie |

### 7.2 Martwe importy

**App.tsx:**
- `defaultState` z `./fs` (linia 22) — nieużywany
- `AgentStatus` z `./shared/types/schema` (linia 42) — nieużywany bezpośrednio
- `StudioNode` z `./types` (linia 60) — nieużywany bezpośrednio

**WorkflowStudioCanvas.tsx:**
- `Clipboard`, `Eye`, `EyeOff` z lucide-react (linia 12) — zaimportowane, nieużywane

### 7.3 Cross-layer importy (łamią separację warstw)

| Plik | Importuje z | Problem |
|------|-------------|---------|
| `commands/index.ts` (linia 6) | `renderer/store/commandStore` | Plik w src/ importuje z renderer/ |
| `keydir/index.ts` (linia 6) | `renderer/store/keydirStore` | Plik w src/ importuje z renderer/ |
| `fs.ts` (linie 6-7) | `renderer/store/commandStore`, `renderer/store/keydirStore` | Plik core'owy zależny od renderer store |

### 7.4 Nieużywane legacy komponenty (DO USUNIĘCIA)

1. `src/components/PipelineEditor.tsx` (~686 linii)
2. `src/components/WorkflowEditor.tsx` (~400 linii)
3. `src/components/WorkflowList.tsx` (91 linii)
4. `src/renderer/components/agents/AgentConfigPanel.tsx` (~400 linii)
5. `src/renderer/components/agents/AgentListPanel.tsx` (~200 linii)

### 7.5 Nieużywane exporty

- `src/main/sandbox/index.ts` — barrel export `SandboxRunner`, nigdzie niezaimportowany
- `src/utils/image.ts`, `src/utils/geminiVision.ts` — potencjalnie nieużywane

---

## 8. Przepływ danych IPC

### 8.1 Brakujące handlery IPC

Frontend wywołuje, ale backend nie obsługuje:

| Wywołanie frontendu | Oczekiwany handler | Status |
|---|---|---|
| `bridge.searchQuery({ query, entities })` | `search:query` lub podobny | ❌ Nie istnieje w ElectronIpcBridge |
| `bridge.executeAgent({ id })` | `agent:execute` | ✅ Istnieje |
| `bridge.saveFeedback({ feedback })` | `feedback:save` | ✅ Istnieje |
| `bridge.getKillSwitchStatus()` | `killswitch:status` | ✅ Istnieje |

### 8.2 `as any` — pomijanie type safety

Zlokalizowane miejsca gdzie `window.nexusBridge` jest rzutowane przez `as any`:

| Plik | Kontekst |
|------|----------|
| `App.tsx:723` | `const bridge = window.nexusBridge as any;` — w onExecuteNode |
| `App.tsx:850` | `const bridge = window.nexusBridge as any;` — w onGenerateMermaid |
| `TopNavigation.tsx:201` | `(window as any).nexusBridge as any` — w KillSwitchTopButton |

### 8.3 Metody preload nieużywane we frontendzie

Metody w `preload.ts` które nie są wywoływane w żadnym komponencie frontendu:
- `getAvailableModels`
- `getKillSwitchStatus`, `activateKillSwitch`, `deactivateKillSwitch`
- `getOutputStats`
- `saveFeedback`
- `getGitBranches`, `getGitStatus`, `getGitLog`, `gitCheckout`, `gitPull`, `gitFetch`

---

## 9. Bezpieczeństwo i bugi runtime

### 🔴 KRYTYCZNE

#### 9.1 XSS w MermaidPlanPanel
- **Plik:** [MermaidPlanPanel.tsx:413](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/MermaidPlanPanel.tsx#L413)
- `dangerouslySetInnerHTML={{ __html: svg }}` z SVG, a `edge.label` (linia 133) NIE jest przepuszczany przez `esc()`. Tylko `node.label` jest sanityzowany.

#### 9.2 RCE w BrowserEngine
- **Plik:** [BrowserEngine.ts:299-302](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/main/core/BrowserEngine.ts#L299-L302)
- `page.evaluate(step.script)` — dowolny JS w kontekście Playwright bez walidacji.

#### 9.3 Klucze API w repozytorium
- **Plik:** `src/main/services/nvidia-bridge/keys.json`
- Plik z kluczami API NVIDIA w repo. Jeśli repo jest/j będzie publiczne — wyciek.

### 🟠 WYSOKIE

#### 9.4 Memory leak w useContextTracker
- **Plik:** [useContextTracker.ts:118](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/hooks/useContextTracker.ts#L118)
- `document.addEventListener('keyup', ...)` jako inline arrow — brak `removeEventListener`. Listener narasta przy każdym rerenderze.

#### 9.5 Utrata danych — StudioCanvas
- **Plik:** [App.tsx:98](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/App.tsx#L98)
- `studioCanvas` nie zapisywany do workspace. Po odświeżeniu cały workflow znika.

#### 9.6 Utrata danych — MermaidDrafts
- **Plik:** [App.tsx:102](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/App.tsx#L102)
- To samo — wszystkie szkice Mermaid giną po odświeżeniu.

### 🟡 ŚREDNIE

#### 9.7 Brak optional chaining na bridge
- `PipelineEditor.tsx:222`: `bridge.browserTestMacro(...)` — jeśli bridge null, rzuci TypeError
- `KillSwitchBanner.tsx:22`: `bridge.getKillSwitchStatus()` — j.w.

#### 9.8 ReDoS w ConditionEval
- **Plik:** [ConditionEval.ts:82](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/main/core/ConditionEval.ts#L82)
- `new RegExp(regexMatch[1])` na regex z user input — możliwy ReDoS.

---

## 10. Spójność nazewnictwa i architektury

### 10.1 WorkflowNode2Type (11 typów) vs NodeType (8 typów)

| Typ | W `WorkflowNode2Type` | W `NodeType` (legacy) |
|-----|----------------------|----------------------|
| `llm-agent` | ✅ | ✅ |
| `human-in-the-loop` | ✅ | ✅ |
| `accumulator` | ✅ | ✅ |
| `router` | ✅ | ✅ |
| `system-reader` | ✅ | ✅ |
| `system-writer` | ✅ | ✅ |
| `condition` | ✅ | ✅ |
| `browser-automate` | ✅ | ✅ |
| `local-executor` | ✅ | ❌ |
| `action` | ✅ | ❌ |
| `action-chain` | ✅ | ❌ |

### 10.2 Mieszanka polsko-angielska w UI

| Komponent | Przykłady |
|-----------|-----------|
| TopNavigation | "Topology", "Laboratory", "Knowledge Base", "More" (ang) |
| WorkflowStudioCanvas | "Dodaj węzeł", "Nowy Workflow", "Eksekutor", "Przeglądarka" (pol) |
| MermaidPlanPanel | "Nowy szkic", "Kompiluj na płytę", "Do Wiki" (pol) |
| FloatingAgentPanel | "Agenci", "Dodaj agenta", "Pozwolenia" (pol) |

### 10.3 Duplikacje typów

| Typ | Definicja 1 | Definicja 2 | Różnice |
|-----|-------------|-------------|---------|
| `FeedbackEntry` | `types.ts:32` | `schema.ts:528` | `schema.ts` ma `feedbackType` |
| `WorkflowNode` | `types.ts:335` | `schema.ts:195` | `types.ts` ma `role?: AgentRole` |
| `Pipeline` | `types.ts:359` | `schema.ts:245` | Identyczne |
| `PortConnection` | `types.ts:350` | `schema.ts:231` | Identyczne |

### 10.4 StudioEdge.sourcePort: string zamiast NodePort

```typescript
// types.ts:241 — obecnie:
sourcePort: string;  // powinno być: sourcePort: NodePort
```

### 10.5 Niespójność lastResult

W `StudioNode`:
```typescript
lastResult?: {
  output?: string;    // tekstowy output
  data?: any;         // parsed JSON
  error?: string;
  tokensUsed?: number;
  durationMs?: number;
};
```
Brak jasnej konwencji kiedy używać `output` a kiedy `data`.

---

## 11. Testy i coverage

### 11.1 Istniejące testy

| Plik testowy | Testuje | Czy component w użyciu? |
|---|---|---|
| `FloatingAgentPanel.test.tsx` | FloatingAgentPanel | ✅ Tak |
| `FeedbackModal.test.tsx` | FeedbackModal | ✅ Tak |
| `TopNavigation.test.tsx` | TopNavigation | ✅ Tak |
| `PipelineEditor.test.tsx` | PipelineEditor | ❌ **Dead code** |
| `FeedbackPanel.test.tsx` | FeedbackPanel | ✅ Tak (ale ma błędy TS) |
| `WikiPanel.test.tsx` | WikiPanel | ✅ Tak |
| `AgentHistoryPanel.test.tsx` | AgentHistoryPanel | ❌ Nieużywany? |
| `PermissionPanel.test.tsx` | PermissionPanel | ❌ Nieużywany? |
| `ContextConfigPanel.test.tsx` | ContextConfigPanel | ❌ Nieużywany? |
| `AgentPresets.test.ts` | AgentPresets | ❌ Nieużywany? |
| `DiffViewer.test.tsx` | DiffViewer | ✅ Tak |
| `DraftZone.test.tsx` | DraftZone | ✅ Tak |
| `LabTodo.test.tsx` | LabTodo | ✅ Tak |
| `ExportModal.test.tsx` | ExportModal | ✅ Tak |
| `ExportScopeSelector.test.tsx` | ExportScopeSelector | ✅ Tak |
| `LogViewer.test.tsx` | LogViewer | ✅ Tak |
| `SandboxRunner.test.ts` | SandboxRunner | ✅ Tak |
| `WorkflowEngine.test.ts` | WorkflowEngine | ✅ Tak |
| `PipelineExecutor.test.ts` | PipelineExecutor | ✅ Tak |
| `ConditionEval.test.ts` | ConditionEval | ✅ Tak |
| `tagEngine.test.ts` | tagEngine | ✅ Tak |
| `diffEngine.test.ts` | diffEngine | ✅ Tak |
| `exportEngine.test.ts` | exportEngine | ✅ Tak |

### 11.2 Brak testów dla krytycznych komponentów

| Komponent | Linie | Priority testów |
|-----------|-------|-----------------|
| `WorkflowStudioCanvas` | ~903 | 🔴 Krytyczny |
| `MermaidPlanPanel` | ~497 | 🟠 Wysoki |
| `NexusCanvas` | ~1400+ | 🔴 Krytyczny |
| `RightPanel` | ~300 | 🟡 Średni |
| `LeftSidebar` | ~300 | 🟡 Średni |
| `SettingsModal` | ~200 | 🟢 Niski |
| `CommandPalette` | ~200 | 🟢 Niski |
| `SemanticSearch` | ~200 | 🟢 Niski |

### 11.3 Testy dead code

Testy które testują nieużywane komponenty (do usunięcia razem z komponentem):
- `PipelineEditor.test.tsx`
- `AgentHistoryPanel.test.tsx`
- `PermissionPanel.test.tsx`
- `ContextConfigPanel.test.tsx`
- `AgentPresets.test.ts`

---

## Plan naprawczy — wszystkie priorytety

| # | Co naprawić | Kategoria | Priorytet | Szac. czas |
|---|---|---|---|---|
| 1 | XSS w MermaidPlanPanel — dodać `esc()` na `edge.label` | Bezpieczeństwo | 🔴 Krytyczny | 5 min |
| 2 | Memory leak w useContextTracker — `removeEventListener` | Bug runtime | 🔴 Krytyczny | 10 min |
| 3 | Klucze API w keys.json — dodać template + gitignore | Bezpieczeństwo | 🔴 Krytyczny | 5 min |
| 4 | Ujednolicenie FeedbackEntry — dodać `feedbackType` do types.ts | Kompilacja | 🟠 Wysoki | 10 min |
| 5 | Persystencja StudioCanvas — dodać do workspace | Utrata danych | 🟠 Wysoki | 30 min |
| 6 | Persystencja MermaidDrafts — dodać do workspace | Utrata danych | 🟠 Wysoki | 15 min |
| 7 | RCE w BrowserEngine — walidacja `step.script` | Bezpieczeństwo | 🟠 Wysoki | 15 min |
| 8 | Usunięcie dead code (5 komponentów + testy) | Porządki | 🟡 Średni | 15 min |
| 9 | Fix martwych importów (App.tsx, WorkflowStudioCanvas) | Porządki | 🟡 Średni | 10 min |
| 10 | Przekazanie context do AI w onSendToAgent | Funkcjonalność | 🟡 Średni | 10 min |
| 11 | Dodanie brakujących pól ExportScope w exportEngine.ts | Kompilacja | 🟡 Średni | 5 min |
| 12 | Oczyszczenie cyklu fs.ts → commandStore | Architektura | 🟢 Niski | 20 min |
| 13 | Ujednolicenie StudioEdge.sourcePort na NodePort | Typowanie | 🟢 Niski | 5 min |
| 14 | Dodanie testów dla WorkflowStudioCanvas | Testy | 🟢 Niski | 2-3h |
| 15 | Dodanie testów dla MermaidPlanPanel | Testy | 🟢 Niski | 1-2h |

**Razem (krytyczne + wysokie):** ~1.5h  
**Razem (wszystko):** ~5-8h

### Priorytety podziału prac

**Faza 1 — Stabilność i bezpieczeństwo (natychmiast):**
- #1 XSS fix (5 min)
- #2 Memory leak fix (10 min)
- #3 Klucze API (5 min)
- #4 FeedbackEntry fix (10 min)

**Faza 2 — Ochrona danych użytkownika:**
- #5 StudioCanvas persistence (30 min)
- #6 MermaidDrafts persistence (15 min)

**Faza 3 — Czyszczenie i porządki:**
- #8 Usunięcie dead code (15 min)
- #9 Martwe importy (10 min)
- #11 ExportScope fix (5 min)

**Faza 4 — Architektura i testy:**
- #7 RCE fix (15 min)
- #10 Context do AI (10 min)
- #12 Cykl zależności (20 min)
- #13 Typowanie (5 min)
- #14-15 Testy (3-5h)

---

*Koniec raportu. Oba audyty (wstępny + głęboki) scalone w jeden dokument.*