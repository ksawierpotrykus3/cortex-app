# NEXUS SYSTEM — Pełny przegląd stanu projektu

> Dokumentacja adresowana do każdego AI. Po wklejeniu tego pliku AI ma kompletne zrozumienie projektu bez potrzeby czytania kodu źródłowego.

---

## 1. Co to jest NEXUS?

**Nexus System** to natywna aplikacja desktopowa (nie webowa) — produktywny workspace użytkownika, który łączy:

- **grafowe mapy myśli** (nodes + edges) na nieskończonym płótnie,
- **zarządzanie zadaniami** (tablica Kanban),
- **edytor pisania** (markdown/manuskrypty),
- **bazę wiedzy** (sandbox),
- **obrazy z analizą AI** (wklejanie z schowka → Gemini OCR).

Technologicznie to monolityczna aplikacja **React 19 + Electron 42 + TypeScript 5.8**, stylowana w **Tailwind CSS v4**, pakowana do instalatorów Windows/macOS/Linux.

---

## 2. Struktura katalogów (ścieżki względne do `nexus/`)

```
├── electron-main.cjs          # Proces główny Electron
├── index.html                 # Szkielet HTML SPA (działa też standalone)
├── package.json               # Manifest, zależności, config electron-builder
├── vite.config.ts             # Konfiguracja bundler (Vite 6 + Tailwind v4)
├── tsconfig.json              # TypeScript (ES2022, noEmit, alias @ -> root)
├── .env.example               # Szablon zmiennych środowiskowych
├── metadata.json              # Metadane AI Studio
├── copy.js                    # Artifakt migracji (można bezpiecznie pominąć)
├── app/applet/
│   ├── copy.cjs                # Artifakt migracji
│   ├── copy.ts                 # Artifakt migracji
├── src/
│   ├── main.tsx                # Bootstrap React — montuje <App/> do #root
│   ├── App.tsx                 # 322 linie — ORCHESTRATOR WSZYSTKIEGO stanu
│   ├── types.ts                # 59 linii — interfejsy TypeScript
│   ├── data.ts                 # Seed/początkowe dane (po polsku)
│   ├── fs.ts                   # 216 linii — persistencja (File System Access API + IndexedDB)
│   ├── exportEngine.ts         # 53 linii — AI-eksport JSON + download utility
├── store.ts                # 4 linie — facade re-export funkcji z fs.ts
│   ├── index.css               # Motyw Tailwind v4 (ciemny, čtvereckový grid)
│   ├── components/
│   │   ├── NexusCanvas.tsx    # ~54 KB — płótno node-graph (pan, zoom, linki, drag-select)
│   │   ├── LabTodo.tsx         # ~15 KB — zadania (status, priority, filtry)
│   │   ├── RightPanel.tsx     # ~17 KB — panel właściwości + "Nexus Axiomy"
│   │   ├── Sandbox.tsx         # ~12 KB — "Baza Wiedzy" (search, kategorie)
│   │   ├── LeftSidebar.tsx    # ~11 KB — drzewo projektów (drag/drop, rename)
│   │   ├── LabWriting.tsx     # ~11 KB — edytor manuskryptów
│   │   ├── RawFragmentsView.tsx ~10 KB — nieustrukturyzowane fragmenty tekstu
│   │   ├── TopNavigation.tsx   # ~6 KB — belka nawigacyjna (zakładki, FS connect)
│   │   ├── ExportModal.tsx    # ~4 KB — modal eksportu
│   │   ├── SettingsModal.tsx  # ~4 KB — ustawienia (Gemini API key)
│   │   └── ImageAttachmentsUI.tsx ~3 KB — podgląd załączników graficznych
│   ├── hooks/
│   │   └── useClipboardPaste.ts # Hook — przechwytuje Ctrl+V i wstawia obrazy na płótno
│   └── utils/
│       ├── ids.ts              # UUID v4 → 8-znakowe ID
│       ├── image.ts            # Kompresja obrazów + File → DataURL
│       ├── geminiVision.ts     # Integracja Gemini 2.5 Flash (prompt w PL)
│       └── dates.ts             # Formatowanie dat po polsku
└── release/                    # Wyniki buildów electron-builder (NSIS, DMG, AppImage)
```

---

## 3. Model danych (interfejsy)

Wszystko zdefiniowane w `src/types.ts`. Stan aplikacji to kolekcje obiektów:

| Typ | Kluczowe pola | Rola |
|---|---|---|
| `NexusNode` | `id`, `title`, `content`, `x`, `y`, `projectId?`, `accent?`, `annotations[]`, `imageAttachments[]` | Węzeł na płótnie |
| `NexusLink` | `source`, `target` | Krawędź między węzłami |
| `Task` | `id`, `title`, `description`, `status`, `priority`, `listId?` | Zadanie (Unresolved/In Progress/Resolved) |
| `WritingDraft` | `id`, `content`, `words`, `manuscriptId?` | Szkic/manuskrypt |
| `ImageAttachment` | `id`, `dataUrl`, `mimeType`, `geminiResponse?`, `isProcessing` | Obraz z analizą AI |
| `NexusAnnotation` | `id`, `category`, `content`, `author`, `timestamp` | Komentarz/issue/fragment na węźle |
| `ViewMode` | `'nexus' \| 'lab-todo' \| 'lab-writing' \| 'sandbox' \| 'raw-fragments'` | Aktywny widok |
| `rightPanel` | `'none' \| 'axioms' \| 'properties'` | Stan prawego panelu |

`axioms` przechowuje obiekty formy `{id: string, text: string}` — jest to lista "aksjomatów użytkownika", czyli fundamentalnych reguł/myśli, które użytkownik widzi i edytuje w prawym panelu.

---

## 4. Architektura stanu i przepływ danych

### 4.1 Główny stan — `App.tsx`

`App.tsx` jest centralnym orchestreatorem. Przechowuje WSZYSTKO w `useState`:

```text
activeView          — który widok jest widoczny
rightPanel          — 'none' | 'axioms' | 'properties'
modal               — 'none' | 'export' | 'settings'
nodes / links       — graf
tasks               — zadania
drafts              — manuskrypty
selectedNodeId      — zaznaczony węzeł
expandedProjects    — lista rozwiniętych projektów
axioms              — aksjomaty użytkownika
geminiKey           — klucz API Gemini
fsConnected         — czy połączono folder
hasStoredFS         — czy istnieje zapisany uchwyt folderu
```

### 4.2 Persistence — `src/fs.ts`

Hybrydowy system zapisu:

1. **File System Access API** (preferowany) — użytkownik wybiera folder, a aplikacja tworzy `nexus.workspace.json` w środku.
2. **IndexedDB** (`idb-keyval`) — fallback, przechowuje uchwyt folderu i stan.
3. **Plik watcher** — co 3 sekundy sprawdza `lastModified` pliku `nexus.workspace.json`; jeśli zmieniony z zewnątrz (np. przez inny edytor), synchronizuje stan z powrotem do React.

Funkcje exportowane z modułu:
- `initFS()` — inicjalizacja, próba odzyskania zapisanego uchwytu
- `connectToLocalFolder()` — wywołanie `showDirectoryPicker`
- `loadWorkspace()` — odczyt `nexus.workspace.json`
- `saveWorkspace(state)` — zapis atomowy (tmp → backup → aktywny plik)
- `useFileSystemWatcher(callback)` — customowy React hook, który nasłuchuje zmian pliku

### 4.3 Auto-save

W `App.tsx` znajduje się efekt z debounce 500ms: każda zmiana stanu → automatyczny `saveWorkspace` + zapis do `window.__nexusState` (globalny obiekt widoczny dla `geminiVision.ts`).

### 4.4 Legacy auto-import (first-run helper)

Przy pierwszym uruchomieniu, jeśli workspace jest pusty, `App.tsx` (linie 56-71) próbuje zaimportować dane z domyślnej ścieżki:
```
~/Documents/nexus/nexus.workspace.json
```
Odczytuje ten plik przez Node.js `fs` (dostępny dzięki Electron `nodeIntegration`), parsuje JSON i zapisuje do IndexedDB. To mechanizm migracji ze starej wersji aplikacji.

### 4.5 Global coupling — `window.__nexusState`

Stan aplikacji jest kopiowany do `window.__nexusState` po każdej zmianie (debounce 500ms). Moduł `geminiVision.ts` odczytuje stamtąd klucz API Gemini, aby uniknąć przekazywania propsów przez wiele poziomów komponentów. Jest to celowe, ale wiąże moduły z globalnym obiektem.

---

## 5. Widoki aplikacji

### 5.1 `nexus` (płótno node-graph)
- Komponenty: `NexusCanvas` (54 KB — największy plik) + `LeftSidebar` + `TopNavigation`
- Funkcjonalność: przeciąganie węzłów, tworzenie/usuwnanie linków, zoom, pan, selekcja prostokątna, zmiana rozmiaru węzłów, attachowanie obrazów
- Lewy sidebar: drzewo projektów z drag-and-drop, rename, rozwijanie/zwijanie
- Prawy panel: właściwości zaznaczonego węzła lub aksjomaty

### 5.2 `lab-todo` (zarządzanie zadaniami)
- Komponent: `LabTodo`
- Kolumny/statusy: Unresolved / In Progress / Resolved
- Priorytety: Low / Medium / Critical
- Filtry, sortowanie, tworzenie/edycja/usuwanie zadań

### 5.3 `lab-writing` (edytor pisania)
- Komponent: `LabWriting`
- Manuskrypty z licznikiem słów
- Edycja w czasie rzeczywistym
- Auto-save w ramach głównego `saveWorkspace`

### 5.4 `sandbox` (Baza Wiedzy)
- Komponent: `Sandbox`
- Wyszukiwanie po treściach
- Kategorie/tagowanie
- Wykorzystuje ten sam wolumen danych co reszta aplikacji (`drafts`, `axioms`)

### 5.5 `raw-fragments` (fragmenty nieustrukturyzowane)
- Komponent: `RawFragmentsView`
- Prosty edytor tekstowy dla "śmieciowych" notatek
- Brak struktury projektu — szybki notatnik

---

## 6. Integracja AI — Gemini 2.5 Flash

- Moduł: `src/utils/geminiVision.ts`
- SDK: `@google/genai`
- Model: `gemini-2.5-flash`
- Klucz API: najpierw `VITE_GEMINI_API_KEY` (env), potem `localStorage['nexus_gemini_key']`, potem `window.__nexusState.geminiKey`
- Kolejkowanie zadań: żądania są serializowane (jeden request na czas), 500ms odstępu między nimi, timeout 30s
- Prompt systemowy (po polsku) instruuje Gemini:
  1. Opis wizualny w HTML (`<strong>`, `<em>`, `<ul><li>`)
  2. Verbatim OCR w bloku `[TEXT]...[/TEXT]`
- Używane przez: `ImageAttachmentsUI` — użytkownik wkleja obraz z schowka (Ctrl+V) → obraz trafia na płótno → opcjonalnie wysyłany do Gemini

---

## 7. Stylowanie

- **Tailwind CSS v4** z pluginem `@tailwindcss/oxide` (natywny silnik Rust, szybszy)
- **Paleta** (zmienne CSS w `:root`):
  - `--background: rgb(14, 14, 16)` — głęboki anthracite
  - `--panel: rgb(24, 24, 28)`
  - `--border: rgb(38, 38, 44)`
  - `--text-main: rgb(245, 245, 245)`
  - `--text-muted: rgb(156, 163, 175)`
  - `--accent: rgb(167, 139, 250)` — fioletowy (Violet-400)
- **Czcionki**: Inter (sans), Space Grotesk (display), systemowy mono
- **Canvas grid**: klasa `.nexus-grid` — 32px grid z białymi kropkami oprócz radialnego gradientu
- **Scrollbary**: wąskie, półprzezroczyste, customowe dla WebKit i Firefox

---

## 8. Electron — desktop wrapper

Plik: `electron-main.cjs`

- ` BrowserWindow` → 1280×800px, bez menu bar (`autoHideMenuBar: true`)
- `nodeIntegration: true`, `contextIsolation: false` — aplikacja ma pełny dostęp do Node.js
- **Dev mode**: ładuje `http://localhost:3000` + otwiera DevTools
- **Prod mode**: ładuje plik `dist/index.html` zbudowany przez Vite
- Budowanie instalatorów: NSIS (Windows), DMG (macOS), AppImage (Linux)

---

## 9. Zależności (kluczowe)

| Pakiet | Wersja | Rola |
|---|---|---|
| `react` / `react-dom` | ^19.0.1 | UI framework |
| `electron` | ^42.3.2 | Desktop runtime (dev dep) |
| `electron-builder` | ^26.8.1 | Packaging |
| `vite` | ^6.2.3 | Dev server + bundler |
| `@vitejs/plugin-react` | ^5.0.4 | JSX transform |
| `tailwindcss` | ^4.1.14 | CSS framework |
| `@tailwindcss/oxide` | ^4.3.0 | Natywny silnik CSS |
| `@google/genai` | ^2.7.0 | Gemini AI SDK |
| `motion` (Framer Motion) | ^12.40.0 | Animacje |
| `lucide-react` | ^0.546.0 | Ikony |
| `idb-keyval` | ^6.2.5 | Promise-based IndexedDB |
| `lightningcss` | ^1.32.0 | Szybki minifier CSS |
| `express` | ^4.21.2 | Wymieniony w deps, ale NIE używany w kodzie źródłowym |

---

## 10. Skrypty startowe

| Komenda | Co robi |
|---|---|
| `npm run dev` | Uruchamia Vite na porcie 3000 |
| `npm run electron` | Czeka na Vite (`wait-on`), uruchamia Electron |
| `npm run electron:dev` | Równoległe uruchomienie Vite + Electron |
| `npm run electron:build` | Vite build + electron-builder → instalator |
| `npm run build` | Tylko Vite build |
| `npm run lint` | `tsc --noEmit` — typycheck |

---

## 11. Sposób uruchomienia

```bash
npm install
npm run electron:dev     # dev: Vite + Electron razem
npm run electron:build   # build: tworzy instalator w release/
```

Wymagany klucz Gemini: `GEMINI_API_KEY` jako env var lub ustawiony w Settings Modal aplikacji.

---

## 12. Konwencje i wzorce

- **Brak biblioteki stanu** — cały stan w `useState` w `App.tsx`, podnoszony w górę (lifting state up)
- **Debounced persistence** — 500ms po każdej zmianie → zapis na dysk
- **Lazy loading** — `import('./fs')` w efekcie `useEffect` (pierwszy mount)
- **Ref + `useImperativeHandle`** — `NexusCanvas` eksponuje metody dla `App.tsx` (np. `panToProject`)
- **Globalny obiekt `window.__nexusState`** — shared mutable state dla modułów zewnętrznych (np. `geminiVision`)
- **Customowy hook `useClipboardPaste`** — abstrakuje obsługę wklejania obrazów ze schowka
- **Interfejsy TypeScript** — pełna typizacja modelu danych
- **Lokalizacja** — wszystkie napisy użytkownika po polsku, formatowanie dat po polsku
- **Path alias `@/`** — mapuje na root projektu (działający zarówno w TS jak i Vite)

---

## 13. Wymagania systemowe (runtime)

- Node.js 18+ (dla `crypto.randomUUID()` i ESNext)
- Windows 10+ / macOS 10.15+ / Linux x64
- Przeglądarka z File System Access API (Chromium/Electron — spełnione domyślnie)
- Opcjonalnie: klucz API Google Gemini dla funkcji OCR/analizy obrazów

---

## 14. Znane artefakty / uwagi

- Plik `copy.js` i `app/applet/copy.*` są artefaktami migracji z innego folderu (`/nowe/nowe/src`). Nie są używane w runtime.
- `express` jest wymieniony w `dependencies` ale nie jest importowany nigdzie w kodzie źródłowym.
- Brak pliku `README.md` w projekcie.
- Electron używa `nodeIntegration: true` + `contextIsolation: false` — potencjalne ryzyko bezpieczeństwa, ale akceptowalne dla aplikacji desktopowej uruchamianej lokalnie.
- W kodzie występują fragmenty na polskim (komentarze, UI, prompty AI) oraz fragmenty na angielskim (zmienne, typy).

---

## 15. Rozmiary kluczowych plików (dla referencji)

| Plik | Rozmiar |
|---|---|
| `src/App.tsx` | 322 lines |
| `src/components/NexusCanvas.tsx` | ~1600 lines (największy) |
| `src/components/LabTodo.tsx` | ~500 lines |
| `src/fs.ts` | 216 lines |
| `src/fs.ts` | 216 lines |
| `exportEngine.ts` | 53 lines |
| `store.ts` | 4 lines (facade re-export) |
| `hooks/useClipboardPaste.ts` | 44 lines |
| `src/utils/geminiVision.ts` | 121 lines |
| `src/types.ts` | 59 lines |
| `electron-main.cjs` | 28 lines |

Największy plik to **NexusCanvas.tsx** (~1215 linii, ~54 KB) — zawiera całą logikę interaktywnego płótna (drag, zoom, linkowanie, prostokątna selekcja, podgląd obrazów).

---

*Ten plik jest samowystarczalny — AI że wklei ten plik do kontekstu ma pełne zrozumienie projektu NEXUS System.*
*Nie aktualny w 100%