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

### FAZA 6 — Warsztat AI (11/12 ✅ ~92%)

**Zrobione:**
| # | Zadanie | Dowód |
|---|---------|--------|
| 6.0 | System agentów (CRUD + execute) | [AgentOrchestrator](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/main/core/AgentOrchestrator.ts) |
| 6.0b | Multi-provider (Gemini/OpenRouter/Ollama) | [ProviderRegistry](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/main/ai/ProviderRegistry.ts) |
| 6.0c | Streaming outputów na żywo | [ChangelogPanel](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/renderer/components/changelog/ChangelogPanel.tsx) |
| 6.4 | DraftZone (RLHF feedback) | [DraftZone.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/DraftZone.tsx) |
| 6.5 | LogViewer (virtual scrolling) | [LogViewer.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/LogViewer.tsx) |
| 6.6 | Approve/reject outputów | [changelogStore.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/renderer/store/changelogStore.ts) |
| 6.7 | Permisje agentów (schema) | [schema.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/shared/types/schema.ts) |
| 6.10 | Wiki / Baza wiedzy | [WikiPanel.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/WikiPanel.tsx) |
| 6.11 | System feedbacku "Brakuje mi..." | [FeedbackModal.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/FeedbackModal.tsx) — #26 Universal Feedback z kontekstem |
| 6.12 | Presety agentów (4 szablony) | [AgentPresets.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/renderer/components/agents/AgentPresets.ts) |
| 6.3 | Magazyny outputów (historia + paginacja) | [AgentHistoryPanel.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/renderer/components/agents/AgentHistoryPanel.tsx) |

**Brakuje:**
| # | Zadanie | Szac. | Opis |
|---|---------|-------|------|
| **6.6** | **Pipeline DAG** | ~30h | Wizualny edytor pipeline'ów — łączenie agentów w łańcuchy |

### Stan techniczny
| Metryka | Wartość |
|---------|---------|
| **Lint (tsc --noEmit)** | **0 błędów** |
| **Testy** | **142/142** (wszystkie komponenty) |
| **Build (electron-vite)** | **exit 0** |
| **Stabilność** | Produkcyjna — instalator istnieje |

---

## 6. Co zostało do zrobienia

### Priorytet 1 — Wysoki (wkrótce)

#### F6.2 Context Builder (~20h)
**Dziś:** agent dostaje tylko to co napiszesz w prompcie.
**Context Builder:** UI z checkboxami gdzie zaznaczasz co agent ma dostać:
- [x] Notatki z mapy (które? — lista z ptaszkami)
- [x] Taski (jakie? — filtr po projekcie)
- [x] Manuskrypty (które? — lista ostatnich)
- [x] Obrazy z schowka
- [x] Outputy innych agentów

Agent widzi tylko to co zaznaczysz. Nowy komponent + IPC + integracja z AgentOrchestrator.

#### F6.6 Pipeline DAG (~30h)
Wizualny edytor gdzie przeciągasz agentów i łączysz ich w łańcuchy.
```
[Screenshot] → [Agent OCR] → [Agent Streszczacz] → [Zapisz do Wiki]
```
- Przeciąganie agentów na płótno
- Łączenie output → input
- Każdy pipeline działa jako osobny "super-agent"
- Monitorowanie postępu w czasie rzeczywistym

### Priorytet 2 — Średni

#### #23 Integracja z Gitem (~40h)
GUI Gita w Nexusie — commit, push, branch, merge jednym klikiem. Bez terminala.
- **Auto-changelog:** "Ksawier dodał workflow, Brat poprawił błąd w zapisie"
- **Analiza diffa dla AI:** każdy agent widzi co się zmieniło od ostatniego pusha
- **Auto-merge AI brancha:** AI działa na osobnym branchu, po skończeniu sam merguje
- **README auto-update:** główny plik architektury aktualizuje się sam

#### #12 Command Palette (~15h)
Ctrl+K → wyszukujesz akcję, widok, ustawienie. Jak w VS Code.
- Szukanie po nazwie: "eksport", "agent", "ustawienia"
- Skróty klawiszowe przy każdej akcji
- Historia ostatnio używanych

#### #5 Diff Viewer (~15h)
Podgląd różnic między wersjami notatek i manuskryptów.
- Kto zmienił, co zmienił, kiedy
- Side-by-side lub inline
- Cofanie zmian do konkretnej wersji

### Priorytet 3 — Niższy

| # | Funkcja | Szac. | Opis |
|---|---------|-------|------|
| **#1** | **Workflows** | ~25h | Sekwencje operacji: jedno kliknięcie → seria akcji |
| **#6** | **Bramki IF/THEN** | ~20h | Warunki w panelu agenta: jeśli schowek zawiera X → odpal agenta Y |
| **#8** | **KeyDir** | ~10h | Szybki dostęp do najważniejszych notatek |
| **#10** | **Dry-Run** | ~8h | Podgląd co agent zrobi bez faktycznego wykonania |
| **#11** | **Bulk Select / Glob** | ~12h | Zaznaczanie wielu nodów + operacje masowe |
| **#7** | **MicroVM** | ~40h | Izolowany sandbox dla agentów (bezpieczeństwo) |
| **#9** | **Global Kill Switch** | ~5h | Jeden przycisk który zabija wszystkie agenty naraz |

### Zadania techniczne

| # | Zadanie | Priorytet | Opis |
|---|---------|-----------|------|
| **T1** | **Podpiąć Git remote** | HIGH | Repo istnieje tylko lokalnie. Dodać GitHub i push |
| **T2** | **Testy komponentów** | MEDIUM | Rozszerzyć testy na NexusCanvas, LabTodo, LabWriting, ExportModal |
| **T3** | **Czyścić package.json** | LOW | `express`, `idb-keyval` — w dependencies ale nieużywane |

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
| **#26** | **Universal Feedback z kontekstem** | **✅ FeedbackModal** |

### Do zrobienia
| # | Funkcja | Szac. | Priorytet |
|---|---------|-------|-----------|
| #1 | Workflows (kciuki + akcje) | ~25h | P3 |
| #2 | NEXUS jak LEGO (0% hardcodowania) | ~60h | P4 |
| #5 | Diff Viewer | ~15h | P2 |
| #6 | Bramki Logiczne (IF/THEN) | ~20h | P3 |
| #7 | MicroVM (izolacja) | ~40h | P3 |
| #8 | KeyDir (szybki dostęp) | ~10h | P3 |
| #9 | Global Kill Switch | ~5h | P3 |
| #10 | Dry-Run (podgląd) | ~8h | P3 |
| #11 | Bulk Select / Glob | ~12h | P3 |
| #12 | Command Palette (Ctrl+K) | ~15h | P2 |
| #23 | Integracja z Gitem | ~40h | P2 |
| #24 | Agent Template (zmienne, źródła, hotkeye) | ~30h | P3 |
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
                  T1 (Git remote)
                       │
                       ▼
              #23 Integracja z Gitem
                       │
              ┌────────┴────────┐
              │                 │
              ▼                 ▼
      F6.2 Context B.    F6.6 Pipeline DAG
              │                 │
              │                 ▼
              │           #1 Workflows
              │                 
              ▼                 
      #6 Bramki IF/THEN         
                                
Niezależne (mogą iść równolegle):
  #5 Diff Viewer
  #8 KeyDir
  #9 Kill Switch
  #10 Dry-Run
  #11 Bulk Select
  #12 Command Palette
  #26 Universal Feedback
  T2 Testy
  T3 package.json

Po wszystkim:
  #2 LEGO + #25 Algebra (refaktoryzacja)
```

---

## 9. Rekomendowana ścieżka wdrożenia

```
ETAP 1 — Zabezpieczenie (15 min)
  ├── T1: Podpiąć Git remote → kod na GitHub

ETAP 2 — Agent AI pełna moc (~50h)
  ├── F6.2: Context Builder (~20h)
  └── F6.6: Pipeline DAG (~30h)

ETAP 3 — Jakość życia (~30h)
  ├── T2: Testy komponentów
  ├── #12: Command Palette (~15h)
  └── #5: Diff Viewer (~15h)

ETAP 4 — Git w Nexusie (~40h)
  └── #23: Integracja z Gitem

ETAP 5 — Rozszerzenia (~90h)
  ├── #1: Workflows (~25h)
  ├── #6: Bramki IF/THEN (~20h)
  ├── #8: KeyDir (~10h)
  ├── #9: Kill Switch (~5h)
  ├── #10: Dry-Run (~8h)
  ├── #11: Bulk Select (~12h)
  └── #26: Universal Feedback z kontekstem (~10h)

ETAP 6 — Bezpieczeństwo (~40h)
  └── #7: MicroVM (~40h)

ETAP 7 — Refaktoryzacja (~140h)
  ├── #2: LEGO (~60h)
  └── #25: Algebra (~80h)
```

**Łącznie:** ~390h (około 3-4 miesiące pełnego etatu)

---

## 10. Metryki celu

| Metryka | Obecnie | Cel |
|---------|---------|-----|
| Lint (tsc --noEmit) | **0 błędów** | 0 błędów (zawsze) |
| Testy jednostkowe | **142/142** | >50 testów |
| Pokrycie testów | ~15% | >40% |
| Funkcje wdrożone (F1-F6) | 19/21 | 21/21 |
| Funkcje z wishlisty (#1-#26) | 12/26 | 26/26 (docelowo) |
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
