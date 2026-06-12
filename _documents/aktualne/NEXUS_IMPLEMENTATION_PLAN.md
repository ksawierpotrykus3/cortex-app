# NEXUS SYSTEM — Kompleksowy Plan Wdrożenia Fazy 3–6

> **Cel**: Dokument stanowi gotowy do implementacji harmonogram pozostałych faz projektu Nexus.
> Wszystkie zadania poniżej są uszeregowane według zależności — każde zadanie może rozpocząć się dopiero
> po zakończeniu poprzedniego w tej samej grupie, chyba że zaznaczono inaczej.
> **Stan wyjściowy**: Fazy 1 i 2 zakończone w 100%. System agentów (F6) częściowo zrealizowany.
> **Data rozpoczęcia**: natychmiast | **Ostatnia aktualizacja**: 2026-06-12

---

## Spis treści

1. [Struktura faz i priorytety](#1-struktura-faz-i-priorytety)
2. [Faza 3 — Topologia Mapy (P1)](#2-faza-3--topologia-mapy-p1)
3. [Faza 4 — Tablica Zmian (P3)](#3-faza-4--tablica-zmian-p3)
4. [Faza 5 — Eksport (P2)](#4-faza-5--eksport-p2)
5. [Faza 6 — Warsztat AI (P1)](#5-faza-6--warsztat-ai-p1)
6. [Warunki końcowe sukcesu](#6-warunki-końcowe-sukcesu)
7. [Słownik pojęć](#7-słownik-pojęć)

---

## 1. Struktura faz i priorytety

### Mapa zależności faz

```
  F3 (Topologia) ─→ F5 (Eksport)
        │
        └────────── bez blokady
        │
  F4 (Tablica Zmian) ── niezależna
  F6 (AI Warsztat) ─── niezależna
```

### Priorytety biznesowe

| Priorytet | Faza | Uzasadnienie |
|-----------|------|--------------|
| **P1** | F3 (Topologia) | Bezpośrednia wartość dla UX mapy myśli — core aplikacji |
| **P2** | F5 (Eksport) | Blokada dla użycia produkcyjnego (brak eksportu = brak backupu) |
| **P3** | F4 (Tablica Zmian) | Zależna od istnienia treści do zmiany — może iść równolegle z F5 |
| **P1** | F6 (AI Warsztat) | Częściowo zrobione, dokończenie odblokowuje pełny workflow AI |

### Łączny zakres

| Faza | Zadania | Stan wyjściowy | Szacowany nakład |
|------|---------|----------------|-----------------|
| F3 | 4 zadania | 0% | 50-70h |
| F4 | 2 podzadania | 0% | 30-40h |
| F5 | 3 zadania | 0% | 20-30h |
| F6 | 6 podzadań | 50% backendu | 80-120h |
| **Suma** | **15** | **~20% całości** | **~180-260h** |

---

## 2. Faza 3 — Topologia Mapy (P1)

**Stan obecny**: 0/4 zadań. Płótno (`NexusCanvas.tsx`) ma podstawowe rysowanie nodów,
przeciąganie, linkowanie, zoom/pan i selekcję. Brakuje zaawansowanej manipulacji wizualnej.

### Zadanie 3.1 — Screenshoty jako czysta grafika

**Scenariusz**: Użytkownik wkleja screenshot → obraz pojawia się jako node
z czystą grafiką (0 tekstu na wierzchu). Tytuł i metadane tylko w prawym panelu.

**Szczegóły implementacji**:
- Modyfikacja [ImageAttachmentsUI.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/ImageAttachmentsUI.tsx) — dodanie trybu "clean overlay"
- Modyfikacja [NexusCanvas.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/NexusCanvas.tsx) — nowy typ wyświetlania noda z obrazem (`image-overlay`)
- Nowy komponent `CleanImageNode.tsx` — wyświetla tylko obraz (bez tytułu, treści)
- Po dwukliku na obraz → otwiera się prawy panel z tytułem i metadanymi
- Typ `NexusNode` w [types.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/types.ts) już obsługuje `imageAttachments`

**Pliki do modyfikacji**:
- `src/components/NexusCanvas.tsx`
- `src/components/ImageAttachmentsUI.tsx`
- `src/components/RightPanel.tsx` (opcjonalnie)

**Testy**:
- Wklejenie obrazu → node pokazuje tylko obraz
- Dwuklik → prawy panel z danymi
- Export JSON → obraz w danych noda

**Kamień milowy**: Screenshot wkleja się, node wyświetla czysty obraz.

---

### Zadanie 3.2 — Freeze/Resize nodów

**Scenariusz**: Przeciągasz za róg noda → ramka rozszerza się ale zawartość zamrożona
(tekst nie zawija się, nie zmienia rozmiaru fontu). Puszczasz → rozmiar fixed.

**Szczegóły implementacji**:
- Dodanie `size?: { width: number; height: number }` do `NexusNode` w [types.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/types.ts)
- Dodanie uchwytu resize w prawym dolnym rogu noda (mały trójkąt)
- Na pointerdown uchwytu → śledzenie ruchu myszy → aktualizacja rozmiaru
- `useRef` + `onPointerMove` na płótnie dla płynności
- Ograniczenie minimalnego rozmiaru (np. 100×60px)

**Pliki do modyfikacji**:
- `src/types.ts` — dodanie `size` do `NexusNode`
- `src/components/NexusCanvas.tsx` — renderowanie z uwzględnieniem rozmiaru + uchwyt
- `src/fs.ts` — uwzględnienie `size` w persistencji
- `src/data.ts` — seed data z rozmiarem domyślnym

**Testy**:
- Przeciągnięcie uchwytu → node zmienia rozmiar
- Minimalny rozmiar nie mniejszy niż 100×60
- Po odświeżeniu rozmiar zachowany

**Kamień milowy**: Node da się przeciągać za róg, rozmiar zapisuje się.

---

### Zadanie 3.3 — Collapse nodów

**Scenariusz**: Przycisk na nodzie (strzałka/górny róg) → zwija do samego tytułu.
Ponowne kliknięcie → rozwija. W stanie zwiniętym node zajmuje ~40px wysokości.

**Szczegóły implementacji**:
- Dodanie `collapsed?: boolean` do `NexusNode` w [types.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/types.ts)
- Przycisk toggle w headerze noda (mała strzałka ▼/▲)
- W stanie zwiniętym: render tylko `div` z tytułem (bez treści, obrazów, przycisków akcji)
- Płynna animacja CSS (transition na max-height)
- Domyślnie wszystkie nodys rozwinięte

**Pliki do modyfikacji**:
- `src/types.ts` — `NexusNode.collapsed`
- `src/components/NexusCanvas.tsx` — warunkowe renderowanie + przycisk toggle
- `src/fs.ts` — persistencja `collapsed`
- `src/data.ts` — seed

**Testy**:
- Kliknięcie przycisku → node zwija/rozwija
- W stanie zwiniętym node ma tylko tytuł
- Stan zachowany po odświeżeniu

**Kamień milowy**: Node zwija się i rozwija, stan persistowany.

---

### Zadanie 3.4 — Teleport z nawigacji (centrowanie na nodzie/projekcie)

**Scenariusz**: Klikasz notatkę w lewym panelu → mapa centruje się na niej.
Klikasz projekt → mapa centruje się na pierwszym nodzie projektu.

**Szczegóły implementacji**:
- Naprawa istniejącego mechanizmu `onProjectCenter`:
  - `LeftSidebar` już woła `onProjectCenter(projectId)`
  - `App.tsx` musi przekazać to do `NexusCanvas` przez ref (użycie `forwardRef`+`useImperativeHandle`)
  - `NexusCanvas` implementuje `panToProject(projectId)` przez `panToProjectRef`
- Dla pojedynczego noda: nowy callback `onNodeClick(id)` → centruje widok na `(n.x, n.y)`
- `NexusCanvas` musi eksponować `centerOnNode(nodeId)` przez ref

**Pliki do modyfikacji**:
- `src/App.tsx` — przywrócenie mechanizmu ref dla NexusCanvas
- `src/components/NexusCanvas.tsx` — implementacja `centerOnNode`, `panToProject`
- `src/components/LeftSidebar.tsx` — click na nodzie → centrowanie
- `src/components/RightPanel.tsx` — przycisk "Pokaż na mapie"

**Testy**:
- Kliknięcie noda w LeftSidebar → canvas centruje się na nim
- Kliknięcie projektu → canvas centruje się na pierwszym nodzie
- Płynna animacja (transition 300ms)

**Kamień milowy**: Kliknięcie w lewym panelu → mapa płynnie centruje się na elemencie.

**Zależność**: Wymaga sprawnej komunikacji przez `ref` (działało wcześniej przez `forwardRef`).

---

### Kryteria sukcesu F3

- [x] Screenshoty jako czysta grafika na mapie
- [x] Node można przeciągać za róg
- [x] Node można zwinąć/rozwinąć
- [x] Teleport z lewego panelu na mapę
- [x] Wszystkie stany są persistowane (zapis/odczyt przez `fs.ts`)
- [x] Testy jednostkowe dla każdej funkcji
- [x] Lint czysty (`npm run lint`)

---

## 3. Faza 4 — Tablica Zmian (P3)

**Stan obecny**: 0%. Nie istnieje widok "changes" w `ViewMode`.

### Zadanie 4.1 — Tablica zmian + "Brakuje mi..."

**Scenariusz**: Nowy widok "Tablica Zmian" dostępny z TopNavigation.
Pokazuje historię zmian (jak changelog ale uproszczony).
Przycisk "Brakuje mi..." otwiera formularz zgłoszeniowy.

**Szczegóły implementacji**:

**Backend (zmiany)**:
- Nowy typ `ChangeEntry`:
  ```typescript
  interface ChangeEntry {
    id: string;
    type: 'create' | 'update' | 'delete' | 'export' | 'ai_output';
    entityType: 'node' | 'task' | 'draft' | 'manuscript' | 'agent_output';
    entityId: string;
    summary: string;      // Krótki opis zmiany
    timestamp: string;    // ISO 8601
    userId?: string;
    metadata?: Record<string, unknown>;
  }
  ```
- Nowy moduł `src/changelog.ts` — prosta kolejka zmian (Circular Buffer max 500 wpisów)
- Integracja z `App.tsx` — wrapowanie setterów `setNodes`, `setTasks`, `setDrafts` itd.
- Persystencja: jako sekcja w `nexus.workspace.json` (przez `fs.ts`)

**Frontend (widok)**:
- Nowy komponent `ChangesPanel.tsx` — lista zmian w formie timeline
- Filtrowanie po typie, dacie
- Przycisk "Brakuje mi..." → modal z formularzem (kategoria, opis, priorytet)
- Zapis zgłoszenia do osobnego pliku `nexus.feedback.json`

**Pliki do utworzenia**:
- `src/components/ChangesPanel.tsx` — nowy komponent
- `src/changelog.ts` — nowy moduł

**Pliki do modyfikacji**:
- `src/types.ts` — `ChangeEntry`, dodanie 'changes' do `ViewMode`
- `src/App.tsx` — integracja changeloga z setterami, routing widoku
- `src/components/TopNavigation.tsx` — przycisk "Tablica Zmian"
- `src/fs.ts` — persistencja zmian + feedbacku
- `src/data.ts` — seed data

**Testy**:
- Dodanie noda → wpis w tablicy zmian
- Filtrowanie po typie działa
- Formularz "Brakuje mi..." zapisuje feedback do pliku
- Circular buffer nie przekracza 500 wpisów

**Kamień milowy**: Widok "Tablica Zmian" działa, formularz zgłoszeniowy zapisuje feedback.

---

### Kryteria sukcesu F4

- [x] Tablica zmian wyświetla historię operacji
- [x] Filtrowanie po typie/dacie
- [x] Formularz "Brakuje mi..." zapisuje feedback
- [x] Circular buffer ogranicza liczbę wpisów
- [x] Lint czysty

---

## 4. Faza 5 — Eksport (P2)

**Stan obecny**: 0/3. `ExportModal.tsx` istnieje ale robi prosty export całego workspace.

### Zadanie 5.1 — Nazwy plików z nazwą projektu

**Scenariusz**: Podczas eksportu, nazwa pliku zawiera nazwę projektu (np.
`Mój Projekt — nexus-export.json` zamiast `nexus.workspace.json`).

**Szczegóły implementacji**:
- Modyfikacja `ExportModal.tsx` — parametr `projectName` do nazwy pliku
- Generowanie timestampa w nazwie (`Projekt_2026-06-12.json`)
- Dla eksportu z widoku "nexus": pobierz nazwę z `projects` (lista unikalnych projectId)

**Pliki do modyfikacji**:
- `src/components/ExportModal.tsx`

**Testy**:
- Eksport → plik nazwany według projektu
- Brak polskich znaków w nazwie pliku (sanitize filename)

**Kamień milowy**: Eksport tworzy plik z nazwą projektu.

---

### Zadanie 5.2 — Multi-scope + ptaszki (UI selekcji zakresu)

**Scenariusz**: Przed eksportem użytkownik zaznacza ptaszki co chce wyeksportować:
- [x] Notatki na mapie (nodes)
- [x] Połączenia (links)
- [x] Zadania (tasks)
- [ ] Manuskrypty (drafts)
- [ ] Metadane AI
- [ ] Tylko zaznaczone notatki

**Szczegóły implementacji**:
- Nowy komponent `ExportScopeSelector.tsx`:
  - Lista checkboxów z kategoriami
  - "Zaznacz wszystko" / "Odznacz wszystko"
  - Opcja "Tylko zaznaczone" (gdy są selectedNodeIds)
- Modyfikacja `ExportModal.tsx` — integracja selektora
- Modyfikacja `exportEngine.ts` — filtrowanie danych według scope

**Pliki do utworzenia**:
- `src/components/ExportScopeSelector.tsx`

**Pliki do modyfikacji**:
- `src/components/ExportModal.tsx`
- `src/exportEngine.ts`

**Testy**:
- Odznaczenie kategorii → nie pojawia się w eksporcie
- "Tylko zaznaczone" → eksportuje tylko wybrane notatki
- "Zaznacz wszystko" → wszystkie checkboxy zaznaczone

**Kamień milowy**: Użytkownik wybiera co eksportuje przez ptaszki.

---

### Zadanie 5.3 — Export z każdego miejsca

**Scenariusz**: Przycisk Export dostępny w każdym widoku (nexus, lab-todo,
lab-writing, sandbox, raw-fragments). Eksport kontekstowy — z widoku Writing
eksportuje tylko manuskrypty, z widoku Todo tylko taski.

**Szczegóły implementacji**:
- `App.tsx` — `ExportModal` przyjmuje `scopeFromView?: ViewMode`
- W `TopNavigation.tsx` — przycisk Export zawsze widoczny (nie tylko w nexus)
- Automatyczne pre-selection ptaszków zależne od widoku:
  - `lab-todo` → pre-check tasks
  - `lab-writing` → pre-check drafts
  - `sandbox` → pre-check nodes (sandbox jest funkcją mapy)

**Pliki do modyfikacji**:
- `src/App.tsx` — przekazanie `activeView` do ExportModal
- `src/components/TopNavigation.tsx` — przycisk exportu dla wszystkich widoków
- `src/components/ExportModal.tsx` — obsługa `scopeFromView`

**Testy**:
- W widoku Writing → przycisk Export działa
- Eksport z Writing → JSON zawiera tylko manuskrypty
- Eksport z Todo → JSON zawiera tylko taski

**Kamień milowy**: Export dostępny i kontekstowy z każdego widoku.

---

### Kryteria sukcesu F5

- [x] Nazwa pliku z nazwą projektu i timestampem
- [x] Selekcja zakresu przez checkboxy
- [x] Export kontekstowy z każdego widoku
- [x] Sanityzacja nazw plików (bez polskich znaków, spacji)
- [x] Testy jednostkowe
- [x] Lint czysty

---

## 5. Faza 6 — Warsztat AI (P1)

**Stan obecny**: 6/12 zadań zrealizowanych.

### Już zrobione ✅

| Zadanie | Gdzie |
|---------|-------|
| System agentów (CRUD + execute) | [AgentOrchestrator](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/main/core/AgentOrchestrator.ts), [agentStore](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/renderer/store/agentStore.ts), IPC Bridge |
| Multi-provider (Gemini/OpenRouter/Ollama) | [ProviderRegistry](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/main/ai/ProviderRegistry.ts), [GeminiAdapter](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/main/ai/GeminiAdapter.ts), [OpenAIApiAdapter](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/main/ai/OpenAIApiAdapter.ts) |
| Streaming outputów | [ChangelogPanel](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/renderer/components/changelog/ChangelogPanel.tsx), [changelogStore](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/renderer/store/changelogStore.ts) |
| DraftZone (RLHF feedback) | [DraftZone.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/DraftZone.tsx) + testy |
| LogViewer | [LogViewer.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/LogViewer.tsx) + testy |
| Approve/reject outputów | [ChangelogStore](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/renderer/store/changelogStore.ts) |

### Do zrobienia ❌

---

### Zadanie 6.1 — System permisji agentów

**Opis**: Agent może mieć ograniczone uprawnienia — które triggery może używać,
które destynacje, które modele.

**Implementacja**:
- Rozszerzenie `schema.ts` — dodanie `PermissionSet` do `Agent`:
  ```typescript
  interface PermissionSet {
    allowedTriggers: TriggerType[];   // domyślnie wszystkie
    allowedDestinations: OutputDestinationType[];  // domyślnie changelog
    allowedModels: string[];           // domyślnie wszystkie skonfigurowane
    maxTokensPerRun: number;           // domyślnie 8192
    maxRunsPerMinute: number;          // domyślnie 10
    requireApproval: boolean;          // domyślnie false
  }
  ```
- UI: sekcja "Permissions" w `AgentConfigPanel.tsx`
- Walidacja w `AgentOrchestrator.ts` przed każdym wykonaniem

**Pliki do modyfikacji**:
- `src/shared/types/schema.ts`
- `src/renderer/components/agents/AgentConfigPanel.tsx`
- `src/main/core/AgentOrchestrator.ts`

**Testy**:
- Agent bez permisji do triggera → nie odpala się
- Przekroczenie maxTokensPerRun → błąd
- requireApproval → output czeka na approve

---

### Zadanie 6.2 — Budowniczy kontekstu (Context Builder)

**Opis**: UI do budowania kontekstu dla agenta przez zaznaczanie ptaszkami
co ma być dołączone (notatki, taski, manuskrypty, obrazy z schowka, outputy innych agentów).

**Implementacja**:
- Nowy komponent `ContextBuilder.tsx`:
  - 3 sekcje: "Nexus Canvas", "Lab Writing", "Lab Tasks"
  - W każdej sekcji lista z checkboxami dla ostatnio używanych elementów
  - Przycisk "Dołącz obraz z schowka"
  - Generuje `Agent.contextContext` (lista `{ type, entityId }`)
- Integracja z `AgentConfigPanel.tsx` — nowa zakładka "Context"
- `AgentOrchestrator.ts` — przed execution pobiera wskazane elementy z workspace

**Pliki do utworzenia**:
- `src/renderer/components/agents/ContextBuilder.tsx`

**Pliki do modyfikacji**:
- `src/shared/types/schema.ts` — `Agent.contextContext`
- `src/renderer/components/agents/AgentConfigPanel.tsx`
- `src/main/core/AgentOrchestrator.ts`
- `src/main/ipc/ElectronIpcBridge.ts` — nowe IPC `agent:get-context` dla głównego procesu

**Testy**:
- Zaznaczenie notatki → agent dostaje jej treść w promptcie
- Odznaczenie → nie ma w promptcie
- Dołączenie obrazu → base64 w kontekście

---

### Zadanie 6.3 — Magazyny (Buffery agentów)

**Opis**: Każdy agent ma bufor outputów (circular buffer, max 1000 wpisów).
Użytkownik może przeglądać historię outputów agenta, filtrować po dacie/ratingu.

**Implementacja**:
- Rozszerzenie `StorageEngine.ts`:
  - Nowa tabela SQLite `agent_outputs` (id, agentId, timestamp, prompt, output, rating, approved)
  - API: `getOutputs(agentId, { limit, offset, filter })`
- Nowy komponent `AgentHistoryPanel.tsx`:
  - Lista outputów z paginacją (Infinite Scroll)
  - Filtrowanie po dacie, ratingu, statusie approve
  - Przycisk "Wyślij ponownie" (re-run z tym samym promptem)

**Pliki do utworzenia**:
- `src/renderer/components/agents/AgentHistoryPanel.tsx`

**Pliki do modyfikacji**:
- `src/main/storage/StorageEngine.ts`
- `src/main/ipc/ElectronIpcBridge.ts` — nowe IPC `agent:outputs`
- `src/renderer/store/agentStore.ts`

**Testy**:
- Wykonanie agenta → output w historii
- Filtrowanie po dacie działa
- Paginacja (100 na stronę)
- Circular buffer nie przekracza 1000

---

### Zadanie 6.4 — Wiki / Baza Wiedzy (CRUD)

**Opis**: Nowa, dedykowana baza wiedzy (nie sandbox). Artykuły z formatowaniem
Markdown, tagami, kategoriami, wyszukiwarką full-text.

**Implementacja**:
- Nowy typ `WikiArticle`:
  ```typescript
  interface WikiArticle {
    id: string;
    title: string;
    content: string;       // Markdown
    tags: string[];
    category: string;
    createdAt: string;
    updatedAt: string;
    sourceRefs: SourceReference[];
    aiContext?: string;
  }
  ```
- Nowy widok 'wiki' w `ViewMode`
- Nowy komponent `WikiPanel.tsx`:
  - Lewy panel: drzewo kategorii + lista artykułów
  - Główny panel: edytor Markdown (textarea + preview)
  - Prawy panel: metadane (tagi, źródła, AI context)
- Export: osobna sekcja 'wiki' w JSON
- Persystencja: przez `fs.ts` (sekcja `wiki` w workspace)

**Pliki do utworzenia**:
- `src/components/WikiPanel.tsx`

**Pliki do modyfikacji**:
- `src/types.ts` — `WikiArticle`, 'wiki' w `ViewMode`
- `src/App.tsx` — routing, stan, settery
- `src/components/TopNavigation.tsx` — przycisk "Wiki"
- `src/fs.ts` — persistencja Wiki
- `src/data.ts` — seed data

**Testy**:
- Tworzenie/edycja/usuwanie artykułu
- Wyszukiwanie full-text po tytule i treści
- Tagowanie i filtrowanie po tagach
- Eksport zawiera sekcję Wiki

---

### Zadanie 6.5 — System feedbacku "Brakuje mi..."

**Opis**: W całej aplikacji (przycisk w prawym dolnym rogu) — szybki feedback:
"Brakuje mi [funkcji], bo [kontekst]". Zapis do osobnego pliku + powiadomienie
w Tablicy Zmian.

**Implementacja**:
- Nowy komponent `FeedbackButton.tsx` — floating button w prawym dolnym rogu
- Modal z formularzem:
  - Pole "Czego brakuje?" (krótki tytuł)
  - Pole "Dlaczego?" (kontekst, opcjonalne)
  - Pole "Jak by to mogło działać?" (opcjonalne)
- Zapis do `nexus.feedback.json`
- Powiadomienie w widoku 'changes' o nowym feedbacku

**Pliki do utworzenia**:
- `src/components/FeedbackButton.tsx`

**Pliki do modyfikacji**:
- `src/App.tsx` — renderowanie FeedbackButton
- `src/fs.ts` — persistencja feedbacku
- `src/components/ChangesPanel.tsx` — sekcja "Sugestie"

**Testy**:
- Przycisk widoczny w każdym widoku
- Zapis feedbacku do pliku JSON
- Feedback pojawia się w Tablicy Zmian

---

### Zadanie 6.6 — Presety agentów

**Opis**: Gotowe szablony agentów (presety) — użytkownik wybiera z listy:
- "Streszczacz" — podsumowuje zaznaczony tekst
- "Korektor" — poprawia gramatykę i styl
- "Brainstormer" — generuje pomysły z kontekstu
- "Analityk" — analizuje notatki i szuka wzorców

**Implementacja**:
- Nowy plik `src/renderer/components/agents/presets.ts`:
  ```typescript
  const AGENT_PRESETS = {
    summarizer: {
      name: 'Streszczacz',
      prompt: 'Streść poniższy tekst w 3-5 zdaniach...',
      modelConfig: { temperature: 0.3, maxTokens: 1024 },
      trigger: { type: 'manual' },
      outputDestination: ['changelog'],
    },
    // ... więcej presetów
  };
  ```
- UI: przycisk "Z presetów" w `AgentListPanel.tsx` → otwiera modala z wyborem
- Po wybraniu → wypełnia formularz w `AgentConfigPanel.tsx`

**Pliki do utworzenia**:
- `src/renderer/components/agents/presets.ts`

**Pliki do modyfikacji**:
- `src/renderer/components/agents/AgentListPanel.tsx`
- `src/renderer/components/agents/AgentConfigPanel.tsx`

**Testy**:
- Wybór presetu → formularz wypełniony danymi
- Preset można edytować przed zapisem
- Zapisany agent działa według preset configuration

---

### Kryteria sukcesu F6

- [x] Permisje agentów (trigger, modele, tokeny)
- [x] Budowniczy kontekstu z ptaszkami
- [x] Magazyny outputów z paginacją
- [x] Wiki / Baza wiedzy (CRUD + search)
- [x] System feedbacku "Brakuje mi..."
- [x] Presety agentów (4+ szablony)
- [x] Wszystkie nowe moduły mają testy
- [x] Lint czysty

---

## 6. Warunki końcowe sukcesu

### Warunki obligatoryjne (100% = koniec fazy)
1. **TypeScript**: `npm run lint` kończy się z kodem 0 (0 błędów)
2. **Testy**: `npm run test` kończy się z kodem 0 (0 failed, 0 skipped)
3. **Nowe testy**: każde nowe zadanie ma min. 3 testy (happy path + edge case + error case)
4. **Build**: `npm run electron:build` tworzy instalator (opcjonalnie dla F3-5, wymagany dla F6)
5. **Dowód**: każdy commit zawiera testy i kod (lub osobny commit z testami)

### Warunki opcjonalne (rekomendowane ale nieblokujące)
- Dokumentacja API dla nowych IPC handlerów
- ESLint bez warningów dla nowego kodu
- Pokrycie testów >70% dla nowych modułów

### Lista kontrolna przed zamknięciem fazy
- [ ] 0 błędów TypeScript
- [ ] 0 failed testów
- [ ] Wszystkie nowe pliki mają testy
- [ ] Istniejący testy wciąż przechodzą (regresja = 0)
- [ ] UI działa w dev mode (`npm run dev`)
- [ ] Zaktualizowano `NEXUS_PROJECT_STATUS.md`

---

## 7. Słownik pojęć

| Pojęcie | Znaczenie |
|---------|-----------|
| `Node` | Pojedynczy węzeł na mapie myśli (notatka, obraz, projekt) |
| `Link` / `Edge` | Połączenie między dwoma nodami |
| `Canvas` | Nieskończone płótno (NexusCanvas.tsx) z zoom/pan |
| `LeftSidebar` | Panel po lewej z drzewem projektów |
| `RightPanel` | Panel właściwości (po prawej, po kliknięciu noda) |
| `ViewMode` | 8 widoków: nexus, lab-todo, lab-writing, sandbox, raw-fragments, logs, draft, agents |
| `IPC` | Inter-Process Communication (Electron main ↔ renderer przez contextBridge) |
| `AgentOrchestrator` | State machine agentów AI (6 stanów, heartbeat, CircuitBreaker) |
| `DraftZone` | RLHF feedback (walidacja Zod + structuredClone + IPC send) |
| `Changelog` | Streaming output agentów z approve/reject |
| `StorageEngine` | SQLite (konfiguracje) + JSONL (outputy) w procesie głównym |
| `CircuitBreaker` | Wzorzec odporności — po 3 błędach 30s cooldown |
| `Workspace` | Główny plik danych: `nexus.workspace.json` (przez File System Access API) |
| `Preset` | Szablon agenta (gotowa konfiguracja promptu, modelu, triggerów) |
| `ContextBuilder` | UI do wybierania co agent ma dostać jako kontekst |
| `Feedback` | Formularz "Brakuje mi..." — zgłoszenia użytkownika |

---

*Koniec dokumentu. Gotowy do implementacji.*
*Ostatnia aktualizacja: 2026-06-12.*
