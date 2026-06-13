# NEXUS SYSTEM — MASTER PLAN

> **Jeden dokument który mówi wszystko.**
> Przeczytaj to, a wiesz o Nexusie wszystko — co to jest, co umie, czego brakuje, co będzie, w jakiej kolejności i dlaczego.
> **Data utworzenia**: 2026-06-12 | **Autor**: Ksawier + AI

---

## Spis treści

1. [Czym jest Nexus?](#1-czym-jest-nexus)
2. [Filozofia systemu — Mózg i Algebra](#2-filozofia-systemu--mózg-i-algebra)
3. [Struktura — Obszary życia](#3-struktura--obszary-życia)
4. [Architektura techniczna (dla AI)](#4-architektura-techniczna-dla-ai)
5. [Co jest zrobione — wszystkie fazy](#5-co-jest-zrobione--wszystkie-fazy)
6. [Co zostało do zrobienia](#6-co-zostało-do-zrobienia)
7. [Wishlista — wszystkie pomysły (#1-#25)](#7-wishlista--wszystkie-pomysły-1-25)
8. [Mapa zależności i priorytety](#8-mapa-zależności-i-priorytety)
9. [Rekomendowana ścieżka wdrożenia](#9-rekomendowana-ścieżka-wdrożenia)
10. [Metryki celu](#10-metryki-celu)
11. [Słownik pojęć](#11-słownik-pojęć)

---

## 1. Czym jest Nexus?

**Nexus System** to natywna aplikacja desktopowa (Electron + Vite + React 19 + TypeScript) która jest **drugim mózgiem użytkownika**. Nie osobny notatnik, task manager, ani klient AI — wszystko w jednym.

Łączy:
- **Grafowe mapy myśli** (nieskończone płótno z węzłami i połączeniami)
- **Zarządzanie zadaniami** (statusy, priorytety, filtry)
- **Edytor pisania** (manuskrypty z folderami, zakładkami, łukami odpowiedzi, branchowaniem)
- **Bazę wiedzy** (Wiki z tagami, kategoriami, full-text search)
- **Obrazy z analizą AI** (wklejanie screenshotów → Gemini OCR)
- **System orkiestracji agentów AI** (własne agenty z promptami, triggerami, routingiem, permisjami)
- **Changelog na żywo** (streaming outputów agentów z approve/reject)
- **DraftZone** (human feedback dla AI z walidacją)
- **LogViewer** (wirtualizowane logi)

Działa na **Windows, macOS i Linux** jako natywna aplikacja.

---

## 2. Filozofia systemu — Mózg i Algebra

### Zasada Mózgu
Mózg: ten sam neuron powtarza się 100 miliardów razy. Żaden neuron nie jest "specjalny". Funkcja powstaje przez **połączenia**, nie przez rodzaj neuronu.

**W Nexusie:** wszystko jest zrobione z tych samych, uniwersalnych klocków. Nie ma "specjalnych przypadków".

### Zasada Algebry
Algebra: 2+3=5 działa w każdej dziedzinie. Nie ma wyjątków.

**W Nexusie:** jeśli coś działa jako źródło "schowek" dla agenta, działa tak samo dla workflow, eksportu, notatki i webhooka. Bez wyjątku.

### Zasada Zamrożonego Kontekstu (audytowalność)
Każda operacja agenta, pipeline'u lub workflowu musi zachować **kopię wszystkich plików i danych wejściowych** w takiej postaci w jakiej były w momencie wykonania. Żaden plik do którego agent miał dostęp nie może być później podmieniony, usunięty, ani zmodyfikowany — wszystko zostaje zamrożone w **snapshocie kontekstu**.

**Po co:**
- Możliwość odtworzenia dlaczego agent podjął konkretną decyzję za 6 miesięcy
- Debugowanie: "pokaż mi co dokładnie agent widział gdy to robił"
- Audit: każda decyzja → zamrożony kontekst → weryfikowalny

**W praktyce:**
- Każde wykonanie agenta/pipeline'u/workflowu dostaje unikalny snapshot ID (uuid)
- Wszystkie pliki wejściowe (schowek, screenshot, pliki, outputy poprzednich agentów) są kopiowane do katalogu `data/snapshots/{snapshotId}/`
- Snapshot zawiera też metadane: timestamp, wersja Nexusa, konfiguracja agenta, trigger
- Snapshoty są czyszczone dopiero po ręcznym potwierdzeniu (lub konfigurowalnym TTL)
- UI: przy każdym logu/outpućie agenta link "Zobacz kontekst" → otwiera zamrożony snapshot

### 8 uniwersalnych klocków (przyszłość)
Docelowo wszystko w Nexusie ma być złożone z tych 8 klocków:

| # | Klocek | Opis |
|---|--------|------|
| 1 | **ŹRÓDŁO** | Skąd pochodzą dane (schowek, screenshot, plik, timer, webhook, output agenta) |
| 2 | **PRZETWARZANIE** | Co się dzieje z danymi (agent, filtr, konwersja, analiza) |
| 3 | **WARUNEK** | IF/THEN — jeśli dane spełniają warunek → akcja A, jeśli nie → akcja B |
| 4 | **WYJŚCIE** | Gdzie trafia wynik (plik, agent, powiadomienie, webhook, changelog) |
| 5 | **KOLEJKA** | Sekwencyjne wykonanie (najpierw A, potem B, potem C) |
| 6 | **RÓWNOLEGLE** | Wiele rzeczy naraz, niezależnie od siebie |
| 7 | **AGREGACJA** | Zbieranie wyników z wielu źródeł w jedno |
| 8 | **INTERFEJS** | UI dla każdego klocka — przeciągnij i upuść |

**Nie wszystko się da zrobić klockami.** To co musi być hardcodowane — będzie. Ale to minimum.

---

## 3. Struktura — Obszary życia

Nexus dzieli się na 3 obszary które mieszają się w jednym interfejsie:

| Obszar | Opis | Przykłady |
|--------|------|-----------|
| **PRACA** | Projekty, kod, zadania, dokumentacja | Notatki na mapie, taski, manuskrypty, agenty AI |
| **QUALITY OF LIFE** | Organizacja życia, notatki, pomysły | Wiki, baza wiedzy, sandbox, feedback |
| **R&D** | Badania, eksperymenty, własny zespół AI | Pipeline DAG, workflowy, budowniczy kontekstu |

---

## 4. Architektura techniczna (dla AI)

### Stack technologiczny

| Warstwa | Technologia |
|---------|------------|
| Framework UI | React 19 + TypeScript |
| Stylowanie | Tailwind CSS v4 (@tailwindcss/oxide — natywny Rust) |
| Desktop runtime | Electron 42 (contextIsolation: true, nodeIntegration: false) |
| Bundler | Vite 6 + electron-vite |
| State management | React useState (App.tsx) + Zustand (agenty) |
| Persystencja | File System Access API (preferowany) + IndexedDB/idb-keyval (fallback) |
| Silnik agentów | SQLite (better-sqlite3) + JSONL (StorageEngine) |
| Testy | Vitest |
| AI SDK | @google/genai (Gemini), OpenAI-kompatybilny adapter |
| Ikony | lucide-react |
| Walidacja | Zod |
| Virtual scrolling | react-window (LogViewer) |

### Struktura katalogów

```
nexus/
├── electron.vite.config.ts      # Konfiguracja builda
├── index.html                   # Szkielet HTML
├── package.json                 # Manifest
├── tsconfig.json                # TypeScript
├── NEXUS_MASTER_PLAN.md         # → TEN PLIK
│
├── src/
│   ├── main.tsx                 # Bootstrap React
│   ├── App.tsx                  # ~420 linii — ORCHESTRATOR WSZYSTKIEGO
│   ├── types.ts                 # 173 linie — WSZYSTKIE interfejsy
│   ├── data.ts                  # Seed danych
│   ├── fs.ts                    # Persistencja (File System Access API)
│   ├── exportEngine.ts          # Engine eksportu JSON
│   ├── changelog.ts             # Rejestr zmian (Circular Buffer)
│   │
│   ├── components/              # Frontend UI (17 komponentów)
│   │   ├── NexusCanvas.tsx      # Główne płótno node-graph
│   │   ├── LabTodo.tsx          # Zadania
│   │   ├── LabWriting.tsx       # Manuskrypty
│   │   ├── TopNavigation.tsx    # Belka nawigacyjna
│   │   ├── LeftSidebar.tsx      # Drzewo projektów
│   │   ├── RightPanel.tsx       # Panel właściwości
│   │   ├── ExportModal.tsx      # Modal eksportu
│   │   ├── ExportScopeSelector.tsx # Wybór zakresu eksportu
│   │   ├── ChangesPanel.tsx     # Tablica zmian
│   │   ├── FeedbackButton.tsx   # "Brakuje mi..."
│   │   ├── WikiPanel.tsx        # Baza wiedzy
│   │   ├── SettingsModal.tsx    # Ustawienia
│   │   ├── Sandbox.tsx          # Szybki notatnik
│   │   ├── RawFragmentsView.tsx # Fragmenty nieustrukturyzowane
│   │   ├── DraftZone.tsx        # RLHF feedback + testy
│   │   ├── LogViewer.tsx        # Podgląd logów + testy
│   │   └── ImageAttachmentsUI.tsx # Podgląd obrazów
│   │
│   ├── main/                    # Backend Electron (proces główny)
│   │   ├── index.ts            # Entry point
│   │   ├── preload.ts          # Preload (context bridge)
│   │   ├── ai/
│   │   │   ├── IAIProvider.ts          # Interfejs providera AI
│   │   │   ├── GeminiAdapter.ts        # Google Gemini
│   │   │   ├── OpenAIApiAdapter.ts     # OpenAI / OpenRouter / Ollama
│   │   │   └── ProviderRegistry.ts     # Rejestr providerów
│   │   ├── core/
│   │   │   └── AgentOrchestrator.ts    # State machine agenta
│   │   ├── ipc/
│   │   │   └── ElectronIpcBridge.ts    # IPC handlery
│   │   └── storage/
│   │       └── StorageEngine.ts        # SQLite + JSONL
│   │
│   ├── renderer/               # Frontend agentów
│   │   ├── store/
│   │   │   ├── agentStore.ts          # Zustand store agentów
│   │   │   └── changelogStore.ts      # Zustand store changeloga
│   │   └── components/
│   │       ├── agents/
│   │       │   ├── AgentListPanel.tsx     # Lista agentów
│   │       │   ├── AgentConfigPanel.tsx   # Konfiguracja agenta
│   │       │   ├── AgentHistoryPanel.tsx  # Historia outputów
│   │       │   ├── AgentPresets.ts        # Presety agentów
│   │       │   ├── PromptEditor.tsx       # Edytor promptu
│   │       │   ├── ProviderSettingsPanel.tsx # Ustawienia providera
│   │       │   └── TriggerConfig.tsx      # Konfiguracja triggerów
│   │       └── changelog/
│   │           ├── ChangelogPanel.tsx     # Panel changeloga
│   │           └── LogEntry.tsx           # Pojedynczy wpis
│   │
│   └── shared/                  # Współdzielone
│       ├── types/
│       │   ├── schema.ts        # Agent, AgentOutput, TriggerConfig itd.
│       │   └── ipc.ts           # Typy IPC
│       └── validators/
│           └── schemas.ts       # Walidacja Zod
│
├── _documents/                  # Dokumentacja projektu
│   ├── aktualne/
│   │   ├── NEXUS_PROJECT_STATUS.md
│   │   ├── NEXUS_IMPLEMENTATION_PLAN.md
│   │   └── plan_uzytkownika.md
│   └── nieaktualne/             # Archiwum
│
├── _plans/                      # Plany faz
├── out/                         # Build output
└── release/                     # Instalatory
```

### Przepływ danych

```
Render (React) ──IPC (contextBridge)──> Main (Electron)
     │                                         │
     │                                         ├── AI Provider (Gemini/OpenAI/Ollama)
     │                                         ├── AgentOrchestrator (state machine)
     │                                         ├── StorageEngine (SQLite + JSONL)
     │                                         └── File System (workspace.json)
     │
     └────────────< streaming (webContents.send) <──┘
```

### Widoki aplikacji (8 widoków)

| Widok | Komponent | Funkcja |
|-------|-----------|---------|
| `nexus` | NexusCanvas + LeftSidebar | Mapa myśli (płótno, węzły, linki, obrazy) |
| `lab-todo` | LabTodo | Zarządzanie zadaniami (statusy, priorytety, filtry) |
| `lab-writing` | LabWriting | Edytor manuskryptów (foldery, zakładki, łuki, branchowanie) |
| `sandbox` | Sandbox | Szybki notatnik |
| `raw-fragments` | RawFragmentsView | Fragmenty nieustrukturyzowane |
| `logs` | LogViewer | Podgląd logów agentów (virtual scrolling) |
| `draft` | DraftZone | Human feedback dla AI (Zod + structuredClone) |
| `agents` | AgentListPanel + AgentConfigPanel + ChangelogPanel | Panel agentów AI (3-kolumnowy layout) |
| `changes` | ChangesPanel | Tablica zmian (historia operacji) |
| `wiki` | WikiPanel | Baza wiedzy (artykuły, tagi, kategorie) |

---

## 5. Co jest zrobione — wszystkie fazy

### FAZA 1 — Bugfixy (9/9 ✅ 100%)
| # | Zadanie | Dowód |
|---|---------|--------|
| 1.1 | Edycja notatek w Writing | [LabWriting.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/LabWriting.tsx) |
| 1.2 | Edycja tasków inline | [LabTodo.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/LabTodo.tsx) |
| 1.3 | Usuwanie manuskryptów | LabWriting.tsx — kosz na hover |
| 1.4 | Usuwanie task list | LabTodo.tsx — kosz na hover |
| 1.5 | Filtrowanie tasków dropdown | LabTodo.tsx — dropdowny status/priority |
| 1.6 | Pomarańczowa kropka usunięta | [TopNavigation.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/TopNavigation.tsx) |
| 1.7 | Projekty domyślnie schowane | [LeftSidebar.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/LeftSidebar.tsx) |
| 1.8 | Dwuklik → notatka w projekcie | [NexusCanvas.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/NexusCanvas.tsx) |
| 1.9 | Usuwanie połączeń kliknięciem | NexusCanvas.tsx |

### FAZA 2 — Zarządzanie treścią (9/9 ✅ 100%)
| # | Zadanie | Dowód |
|---|---------|--------|
| 2.1 | Sortowanie messengerowe | [types.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/types.ts) — `updatedAt` |
| 2.2 | Auto-resume w Writing | App.tsx — `lastManuscriptId` |
| 2.3 | Foldery manuskryptów | types.ts — `ManuscriptFolder` |
| 2.4 | Zakładki w manuskryptach | types.ts — `ManuscriptTab` |
| 2.5 | Łuki odpowiedzi (replyTo) | types.ts — `WritingDraft.replyTo` |
| 2.6 | Branchowanie + Gablota | types.ts — `SourceReference`, `ManuscriptMeta.sourceRefs` |
| 2.7 | Wiadomość dla AI (aiContext) | types.ts — `ManuscriptMeta.aiContext` |
| 2.8 | Adnotacje w Lab | types.ts — `NexusAnnotation` na Task/WritingDraft |
| 2.9 | Kolorowe kropki pewności | types.ts — `ThoughtMarker` |

### FAZA 3 — Topologia mapy (4/4 ✅ 100%)
| # | Zadanie | Dowód |
|---|---------|--------|
| 3.1 | Clean image mode (screenshot bez tekstu) | [NexusCanvas.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/NexusCanvas.tsx#L1070-L1099) |
| 3.2 | Resize nodów (2 osie) | [NexusCanvas.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/NexusCanvas.tsx#L1047-L1064) |
| 3.3 | Collapse nodów (zwijanie do tytułu) | [NexusCanvas.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/NexusCanvas.tsx#L1148-L1159) |
| 3.4 | Teleport (centrowanie na elemencie z panelu) | [NexusCanvas.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/NexusCanvas.tsx#L13-L28) |

### FAZA 4 — Tablica Zmian (3/3 ✅ 100%)
| # | Zadanie | Dowód |
|---|---------|--------|
| 4.1 | ChangeLog engine (Circular Buffer 500 wpisów) | [changelog.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/changelog.ts) |
| 4.2 | ChangesPanel timeline | [ChangesPanel.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/ChangesPanel.tsx) |
| 4.3 | Feedback "Brakuje mi..." | [FeedbackModal.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/FeedbackModal.tsx) — #26 Universal Feedback z kontekstem |

### FAZA 5 — Eksport (3/3 ✅ 100%)
| # | Zadanie | Dowód |
|---|---------|--------|
| 5.1 | Nazwy plików z nazwą projektu (sanitize) | [exportEngine.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/exportEngine.ts#L102-L118) |
| 5.2 | Multi-scope + checkboxy | [ExportScopeSelector.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/ExportScopeSelector.tsx) |
| 5.3 | Export kontekstowy z każdego widoku | [ExportModal.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/ExportModal.tsx#L29-L37) |

### FAZA 6 — Warsztat AI (13/13 ✅ 100%) 🎉

| # | Zadanie | Dowód |
|---|---------|--------|
| 6.0 | System agentów (CRUD + execute) | [AgentOrchestrator](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/main/core/AgentOrchestrator.ts) |
| 6.0b | Multi-provider (Gemini/OpenRouter/Ollama) | [ProviderRegistry](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/main/ai/ProviderRegistry.ts) |
| 6.0c | Streaming outputów na żywo | [ChangelogPanel](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/renderer/components/changelog/ChangelogPanel.tsx) |
| 6.2 | Context Builder (checkboxy, źródła, limit tokenów) | [ContextBuilder.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/renderer/components/agents/ContextBuilder.tsx) + [ContextConfigPanel.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/renderer/components/agents/ContextConfigPanel.tsx) |
| 6.3 | Magazyny outputów (historia + paginacja) | [AgentHistoryPanel.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/renderer/components/agents/AgentHistoryPanel.tsx) |
| 6.4 | DraftZone (RLHF feedback) | [DraftZone.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/DraftZone.tsx) |
| 6.5 | LogViewer (virtual scrolling) | [LogViewer.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/LogViewer.tsx) |
| 6.6 | Approve/reject outputów | [changelogStore.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/renderer/store/changelogStore.ts) |
| 6.7 | Permisje agentów (schema) | [schema.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/shared/types/schema.ts) |
| 6.8 | Pipeline DAG (wizualny edytor + executor) | [PipelineEditor.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/PipelineEditor.tsx) + [PipelineExecutor.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/main/core/PipelineExecutor.ts) |
| 6.10 | Wiki / Baza wiedzy | [WikiPanel.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/WikiPanel.tsx) |
| 6.11 | System feedbacku "Brakuje mi..." | [FeedbackModal.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/FeedbackModal.tsx) |
| 6.12 | Presety agentów (4 szablony) | [AgentPresets.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/renderer/components/agents/AgentPresets.ts) |

### Stan techniczny
| Metryka | Wartość |
|---------|---------|
| **Lint (tsc --noEmit)** | **0 błędów** |
| **Testy** | **196/196** (wszystkie komponenty) |
| **Build (electron-vite)** | **exit 0** |
| **Stabilność** | Produkcyjna — instalator istnieje |

---

## 6. Co zostało do zrobienia

**Wszystkie fazy F1-F6 są w 100% zrobione.** Wszystkie funkcje z wishlisty #1-#26 są zrobione oprócz refaktoryzacji (#2, #25).

Zostały 2 kategorie:

### Priorytet 1 — Pozostałe funkcje

| # | Funkcja | Szac. | Opis |
|---|---------|-------|------|
| **#7** | **MicroVM** | ~40h | Izolowany sandbox dla agentów (bezpieczeństwo) — obecny Sandbox to panel pomocy, nie MicroVM |
| **#23** | **Integracja z Gitem** | ~40h | GUI Gita (commit, push, branch, merge) — kod istnieje, ale wymaga testów i dopieszczenia |
| **#24** | **Agent Template** | ~30h | Zaawansowane szablony agentów — rozszerzyć obecne 4 presety o zmienne, źródła, hotkeye |

### Priorytet 2 — Refaktoryzacja (po wszystkim)

| # | Funkcja | Szac. | Opis |
|---|---------|-------|------|
| **#2** | **NEXUS jak LEGO** | ~60h | 0% hardcodowania — wszystko z uniwersalnych klocków |
| **#25** | **Zasada Algebry (8 klocków)** | ~80h | Przepisanie całego systemu na 8 uniwersalnych komponentów |

### Zadania techniczne

| # | Zadanie | Priorytet | Opis |
|---|---------|-----------|------|
| **T1** | **Podpiąć Git remote** | HIGH | Repo istnieje tylko lokalnie. Dodać GitHub i push |
| **T2** | **Testy komponentów** | MEDIUM | Rozszerzyć testy na NexusCanvas, LabTodo, LabWriting, ExportModal (obecnie 196) |

### Łącznie
- **Funkcje do zrobienia:** ~110h (MicroVM + Git + Agent Template)
- **Refaktoryzacja:** ~140h (LEGO + Algebra)
- **Tech debt:** ~10h (testy)
- **Git remote:** 15 min
- **Razem:** ~260h

---

## 7. Wishlista — wszystkie pomysły (#1-#25)

Pełna lista 25 funkcji które kiedykolwiek padły w rozmowach o Nexusie. Nie wszystkie są do zrobienia — część to koncepcje które spełniły swoją rolę jako inspiracja.

### Zrobione (z wishlisty)
| # | Funkcja | Status |
|---|---------|--------|
| #13 | Baza Wiedzy / Wiki | ✅ WikiPanel |
| #14 | "Brakuje mi..." | ✅ FeedbackButton |
| #15 | Łuki odpowiedzi | ✅ LabWriting.replyTo |
| #16 | Branchowanie / Gablota | ✅ SourceReference |
| #17 | Wiadomość dla AI | ✅ aiContext |
| #18 | Kolorowe kropki | ✅ ThoughtMarker |
| #19 | Tablica Zmian | ✅ ChangesPanel |
| #20 | Export 3 tryby | ✅ ExportModal + ExportScopeSelector |
| #21 | Agent ogólny (Meta-Agent) | ✅ AgentOrchestrator |
| #22 | Baza danych outputów AI | ✅ StorageEngine (SQLite + JSONL) |
| #3 | Auto-Resume + Foldery + Zakładki | ✅ LabWriting |
| #4 | Warsztat AI (3 kolumny) | ✅ agents view |
| #1 | Workflows | ✅ WorkflowEditor + WorkflowEngine |
| #5 | Diff Viewer | ✅ DiffViewer + DiffModal + diffEngine |
| #6 | Bramki IF/THEN | ✅ ConditionEval + UI w Pipeline/Workflow |
| #8 | KeyDir (szybki dostęp) | ✅ KeyDirPanel + keydirStore |
| #9 | Global Kill Switch | ✅ KillSwitch + banner + IPC |
| #10 | Dry-Run (podgląd) | ✅ DryRunResultModal + PipelineExecutor.dryRun() |
| #11 | Bulk Select / Glob | ✅ BatchActionBar + selectedNodeIds |
| #12 | Command Palette (Ctrl+K) | ✅ CommandPalette + 30+ komend |
| #13 | Baza Wiedzy / Wiki | ✅ WikiPanel |
| #14 | "Brakuje mi..." | ✅ FeedbackButton |
| #15 | Łuki odpowiedzi | ✅ LabWriting.replyTo |
| #16 | Branchowanie / Gablota | ✅ SourceReference |
| #17 | Wiadomość dla AI | ✅ aiContext |
| #18 | Kolorowe kropki | ✅ ThoughtMarker |
| #19 | Tablica Zmian | ✅ ChangesPanel |
| #20 | Export 3 tryby | ✅ ExportModal + ExportScopeSelector |
| #21 | Agent ogólny (Meta-Agent) | ✅ AgentOrchestrator |
| #22 | Baza danych outputów AI | ✅ StorageEngine (SQLite + JSONL) |
| #26 | Universal Feedback z kontekstem | ✅ FeedbackModal z IPC + JSONL |

### Do zrobienia
| # | Funkcja | Szac. | Priorytet |
|---|---------|-------|-----------|
| #7 | MicroVM (izolacja) | ~40h | P1 |
| #23 | Integracja z Gitem | ~40h | P1 |
| #24 | Agent Template (zmienne, źródła, hotkeye) | ~30h | P1 |
| #2 | NEXUS jak LEGO (0% hardcodowania) | ~60h | P4 |
| #25 | Zasada Algebry (8 klocków) | ~80h | P4 |

### #26 — Universal Feedback z kontekstem (✅ ZROBIONE)

**Cel:** Zastąpić prosty przycisk "Brakuje mi..." pełnym systemem feedbacku, który zbiera **pełny kontekst** + zapisuje do dedykowanego pliku.

**Dziś:** FeedbackModal — rozszerzony formularz z entity pickerem, auto-kontekstem, ratingiem 1-5, zapisem przez IPC do `data/feedback.jsonl`. Zastąpił FeedbackButton.tsx.

**Docelowo:**

```
┌─ Przekaż pomysł / zgłoś problem ────────────┐
│                                              │
│  Dotyczy: [▼ wybierz co]                     │
│    • Agent: "Streszczacz"                    │
│    • Notatka: "Q3 plan"                     │
│    • Task: "Zrobić X"                       │
│    • Manuskrypt: "Rozdział 3"              │
│    • Ogólny pomysł (brak konkretnego bytu)  │
│                                              │
│  Dołączany kontekst (auto):                  │
│  ┌─────────────────────────────────────────┐ │
│  │ Widok: agents                            │ │
│  │ Agent: Streszczacz (prompt, model,       │ │
│  │         triggery, outputy)              │ │
│  │ Projekt: Q3 Planning                     │ │
│  │ Ostatnia akcja: uruchomienie agenta      │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  Tytuł: [________________________________]  │
│  Opis: [________________________________]   │
│  Sugestia: [______________________________] │
│                                              │
│  [Automatycznie zapisz do pliku feedback.json]│
│                                              │
│  [Anuluj]                    [Wyślij/Zapisz] │
└──────────────────────────────────────────────┘
```

**Kluczowe funkcje:**
1. **Entity picker** — klikasz na przycisk i możesz wskazać czego dotyczy feedback (agent, node, task, manuskrypt, lub ogólny pomysł). UI pokazuje małą listę z checkboxami/radio.
2. **Auto-kontekst** — system sam zbiera: aktualny widok, zaznaczony agent/node/task, ostatnią akcję, projekt.
3. **Zapis do pliku** — feedback trafia do `data/feedback.jsonl` (append-only, dedykowany plik), a nie tylko do stanu w pamięci. Plik łatwo znaleźć i wysłać.
4. **Bogatsze pola** — FeedbackEntry rozszerzone o: `entityType`, `entityId`, `contextSnapshot` (pełny stan UI w momencie zgłoszenia).
5. **Przycisk zawsze widoczny** — fixed bottom-right, niezależnie od widoku.

**Zapis do pliku:**
- Lokalizacja: `{workspace}/feedback/feedback.jsonl` (obok `data/` i `outputs/`)
- Format: JSONL, każda linia to jeden feedback z pełnym kontekstem
- Łatwy do znalezienia przez użytkownika i wysłania do developera ("Brata")

**Implementacja (✅ zrobione):**
1. ✅ Rozszerzyć `FeedbackEntry` w `types.ts` o: `entityType`, `entityId`, `entityLabel`, `contextSnapshot`, `rating`
2. ✅ Przepisać `FeedbackButton.tsx` na `FeedbackModal.tsx` z entity pickerem i auto-kontekstem
3. ✅ Dodać IPC handler `feedback:save` w `ElectronIpcBridge.ts` + `preload.ts` + typy w `ipc.ts`
4. ✅ Zapis do `data/feedback.jsonl` przez IPC handler w main process
5. ✅ Przycisk renderowany w `App.tsx` na stałe, przekazuje aktualny stan (viewMode, selectedAgentId, selectedNodeId itp.)

### Dlaczego #24 i #25 są w P4 (refaktoryzacja)?
Bo to nie są nowe funkcje — to **przepisanie całego systemu** na nowo. Obecny kod działa dobrze. Refaktoryzacja na uniwersalne klocki ma sens dopiero gdy:
1. Wszystkie funkcje są stabilne
2. Widać dokładnie które klocki się powtarzają
3. Jest czas na duże zmiany bez presji

---

## 8. Mapa zależności i priorytety

```
                  #23 Git
                      │
                      ▼
              #24 Agent Template
                      
Niezależne (mogą iść równolegle):
  #7 MicroVM

Po wszystkim:
  #2 LEGO + #25 Algebra (refaktoryzacja)
```

---

## 9. Rekomendowana ścieżka wdrożenia

```
ETAP 1 — Zabezpieczenie (15 min)
  ├── T1: Podpiąć Git remote → kod na GitHub

ETAP 2 — Ostatnie funkcje (~110h)
  ├── #7: MicroVM (~40h)
  ├── #23: Integracja z Gitem (~40h)
  └── #24: Agent Template (~30h)

ETAP 3 — Refaktoryzacja (~140h)
  ├── #2: LEGO (~60h)
  └── #25: Algebra (~80h)
```

**Łącznie:** ~250h (około 2-3 miesiące pół etatu)

---

## 10. Metryki celu

| Metryka | Obecnie | Cel |
|---------|---------|-----|
| Lint (tsc --noEmit) | **0 błędów** | 0 błędów (zawsze) |
| Testy jednostkowe | **196/196** | >200 testów |
| Pokrycie testów | ~15% | >40% |
| Funkcje wdrożone (F1-F6) | 41/41 | 41/41 |
| Funkcje z wishlisty (#1-#26) | 21/26 | 26/26 (docelowo) |
| Git remote | brak | GitHub |
| Instalator | Windows (.exe) | Windows + macOS + Linux |

---

## 11. Słownik pojęć

| Pojęcie | Znaczenie |
|---------|-----------|
| **Node** | Pojedynczy węzeł na mapie myśli (notatka, obraz, projekt) |
| **Link / Edge** | Połączenie między dwoma nodami |
| **Canvas** | Nieskończone płótno (NexusCanvas.tsx) z zoom/pan |
| **ViewMode** | 10 widoków: nexus, lab-todo, lab-writing, sandbox, raw-fragments, logs, draft, agents, changes, wiki |
| **IPC** | Inter-Process Communication (Electron main ↔ renderer) |
| **Agent** | Konfigurowalny agent AI z promptem, modelem, triggerem |
| **Trigger** | Co odpala agenta: manual, hotkey, timer, clipboard, file_watch, agent_output, webhook |
| **Orchestrator** | State machine agentów (6 stanów, heartbeat 5s, CircuitBreaker) |
| **Changelog** | Streaming output agentów z approve/reject na żywo |
| **DraftZone** | RLHF human feedback (walidacja Zod + structuredClone + IPC send) |
| **StorageEngine** | Silnik bazy danych: SQLite (konfiguracje) + JSONL (outputy agentów) |
| **CircuitBreaker** | Wzorzec odporności — po 3 błędach 30s cooldown |
| **Workspace** | Główny plik danych: `nexus.workspace.json` (File System Access API) |
| **Preset** | Szablon agenta (gotowa konfiguracja: Streszczacz, Korektor, Brainstormer, Analityk) |
| **Context Builder** | UI do wybierania co agent ma dostać jako kontekst (checkboxy) |
| **Pipeline DAG** | Wizualny edytor łączenia agentów w łańcuchy przetwarzania |
| **Feedback** | Formularz "Brakuje mi..." — zgłoszenia użytkownika |
| **DAG** | Directed Acyclic Graph — graf bez cykli, używany w pipeline'ach |
| **RLHF** | Reinforcement Learning from Human Feedback — człowiek ocenia output AI |
| **Zod** | Biblioteka walidacji danych w TypeScript |
| **Zustand** | Lekki state management dla React (używany w store'ach agentów) |

---

> **Koniec dokumentu.**
> 
> Ten plik jest **jedynym źródłem prawdy** o Nexusie. 
> Jeśli coś jest w tym pliku — istnieje, jest zaplanowane, lub było rozważane.
> Jeśli czegoś w tym pliku nie ma — nie istnieje w kontekście Nexusa.
> 
> *"Mózg: ten sam neuron powtarza się 100 miliardów razy. Funkcja powstaje przez połączenia, nie przez rodzaj neuronu."*
