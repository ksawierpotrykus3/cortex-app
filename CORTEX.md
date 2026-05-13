# Cortex — AI-Accelerated Cognitive Workspace

> Jeśli jesteś AI (Codex, Antigravity, Claude, etc.) — ten plik zawiera wszystko co musisz wiedzieć o projekcie.

## Cel projektu

Cortex to osobista baza wiedzy oparta na **nieskończonym canvas SVG**. Użytkownik (Ksawier) wrzuca tam krótkie myśli, obserwacje, pomysły — nazywane "rozrzutkami" — i organizuje je w kategorie, łączy ze sobą liniami, rysuje po canvasie i wkleja screenshoty. Zintegrowany **Gemini Flash** automatycznie analizuje screenshoty i odpowiada na pytania o zawartość notatek.

---

## Stack technologiczny

| Warstwa | Technologia |
|---|---|
| Bundler | **Vite 8.x** (`npm run dev` → `localhost:5173`) |
| Język | Vanilla JS (ES modules), zero frameworków |
| Renderowanie | **SVG** (ręcznie tworzony DOM, nie D3) |
| Style | Vanilla CSS, zmienne CSS (dark theme) |
| Persystencja | `localStorage` (klucz: `cortex-data-v2`) |
| AI | Google Gemini API (`gemini-3.1-flash-lite`) via fetch |
| Czcionka | Inter (Google Fonts) |

---

## Struktura plików

```
cortex-app/
├── index.html          # Główna strona + modale (settings, categories, help)
├── package.json        # Tylko vite jako devDependency
├── src/
│   ├── main.js         # Entry point — inicjalizacja, event listeners, paste handler
│   ├── store.js        # Centralna warstwa danych — CRUD nodes/links/categories + localStorage
│   ├── canvas.js       # Silnik SVG canvas — renderowanie, zoom, pan, drag, selection
│   ├── panel.js        # Prawy panel szczegółów notatki — edycja, połączenia
│   ├── quickadd.js     # Szybkie dodawanie notatek z dolnego paska
│   ├── filter.js       # Filtrowanie notatek po typie/kategorii
│   ├── parking.js      # "Parking" — schowek na notatki usunięte z canvas
│   ├── drawing.js      # Rysowanie odręczne po canvas (tryb D)
│   ├── categories.js   # Modal zarządzania kategoriami (CRUD, kolory, kolejność)
│   ├── vision.js       # Integracja z Gemini Flash — analiza obrazów + text query
│   ├── flashchat.js    # Globalny chat z Flashem — kontekst = wszystkie notatki
│   ├── constants.js    # Stałe konfiguracyjne (kolory, wymiary, klucze storage)
│   ├── seed.js         # Dane startowe (seed) ładowane przy pierwszej wizycie
│   ├── counter.js      # (legacy, nieużywany)
│   └── style.css       # Wszystkie style — ~900 linii
```

---

## Architektura danych

### Schemat `localStorage` (`cortex-data-v2`)

```json
{
  "nodes": [
    {
      "id": "uuid",
      "title": "Tytuł notatki",
      "content": "Treść...",
      "type": "rozrzutka",           // ID kategorii
      "x": 500, "y": 300,           // Pozycja na canvas
      "createdAt": "ISO timestamp",
      // Opcjonalnie (screenshot nodes):
      "image": "data:image/jpeg;base64,...",
      "imageWidth": 1920,
      "imageHeight": 1080,
      "imageDescription": "Opis od Flasha..."
    }
  ],
  "links": [
    { "source": "uuid-1", "target": "uuid-2" }
  ],
  "parking": [ /* ...nodes tymczasowo ukryte */ ],
  "strokes": [
    {
      "id": "uuid",
      "points": [[x,y], [x,y], ...],
      "color": "#ffffff",
      "width": 2,
      "createdAt": "ISO timestamp"
    }
  ],
  "categories": [
    { "id": "aksjomat",  "name": "Aksjomat",  "color": "#e5a54b", "order": 0 },
    { "id": "pewnik",    "name": "Pewnik",    "color": "#c4a43a", "order": 1 },
    { "id": "przeblysk", "name": "Przebłysk", "color": "#4da8a0", "order": 2 },
    { "id": "rozrzutka", "name": "Rozrzutka", "color": "#7c6cb5", "order": 3 },
    { "id": "problem",   "name": "Problem",   "color": "#c45c5c", "order": 4 }
  ]
}
```

### API key

Klucz Gemini przechowywany osobno: `localStorage['cortex-vision-api-key']`

---

## Zaimplementowane Feature'y

### 1. Infinite Canvas (SVG)
- **Pan**: klik + drag po tle
- **Zoom**: scroll (zakres 0.08x – 4x)
- **Semantic zoom**: przy dużym oddaleniu notatki pokazują tylko tytuł, przy jeszcze większym — tylko kropkę
- **Siatka**: subtelna siatka 40px w tle
- **Renderowanie**: pełny re-render SVG na każdą zmianę (nie VDOM)

### 2. Notatki (Nodes)
- **Karta**: prostokąt 240px z accent barem (kolor kategorii), tytułem, treścią (max 3 linie)
- **Drag**: pojedyncze i grupowe przeciąganie
- **Tworzenie**: double-click na tle → nowa notatka w trybie edycji
- **Edycja**: panel boczny (tytuł, treść, typ)
- **Usuwanie**: z panelu lub batch delete

### 3. Screenshoty (Ctrl+V)
- **Wklejanie**: Ctrl+V w dowolnym momencie (poza inputami)
- **Format**: JPEG 0.8 quality, **1:1 rozdzielczość** (bez skalowania)
- **Rendering na canvas**: obraz w naturalnym rozmiarze, kolorowa ramka (3px), drop-shadow
- **AI analiza**: cicha, asynchroniczna — jeśli jest API key, Flash opisuje obraz w tle
- **Panel**: podgląd obrazu + opis Flasha

### 4. Kategorie (Dynamic)
- **5 domyślnych**: Aksjomat, Pewnik, Przebłysk, Rozrzutka, Problem
- **CRUD**: modal (🏷️) → dodawanie, edycja nazwy/koloru, usuwanie, zmiana kolejności
- **Dynamiczne kolory**: cały UI (karty, panel, type-picker) pobiera kolory z `store.getCategoryColor()`
- **Fallback**: po usunięciu kategorii, notatki migrują do pierwszej dostępnej

### 5. Połączenia (Links)
- **Tworzenie**: Tab → tryb łączenia → klik w 2 notatki
- **Rendering**: linie SVG między centrami kart
- **Usuwanie**: batch delete links lub z panelu
- **Neighborhood highlight**: klik w notatkę podświetla sąsiadów

### 6. Rysowanie (Drawing Mode)
- **Tryb**: klawisz `D`
- **Pędzel**: rysowanie wolnych linii po canvas
- **Gumka**: klawisz `X` → klik w linię usuwa
- **Rozmiar**: `[` / `]` zmienia grubość
- **Undo**: Ctrl+Z cofa ostatnią linię
- **Persystencja**: strokes zapisywane w localStorage

### 7. Flash Chat (⚡)
- **Globalny**: przycisk ⚡ w top barze → panel w prawym dolnym rogu
- **Kontekst**: automatycznie zbiera WSZYSTKIE notatki (tytuł + treść + opisy screenów) i wysyła do Flasha
- **Model**: `gemini-3.1-flash-lite` via Google Generative Language API v1beta
- **UI**: chat-style bubbles, Enter do wysyłania, Esc do zamknięcia
- **Metody vision.js**: `queryText(prompt)` — text-only, `queryImage(dataUrl, question)` — z obrazem, `analyzeImage(dataUrl)` — automatyczny opis

### 8. Parking (Schowek)
- Notatki można "zaparkować" (ukryć z canvas bez usuwania)
- Przywracanie z panelu Parking

### 9. Multi-Select & Batch Actions
- **Shift+Click**: zaznaczanie wielu notatek
- **Batch panel**: masowe usuwanie notek, usuwanie linków między zaznaczonymi
- **Grupowe przeciąganie**: drag zaznaczonych przesuwa wszystkie

### 10. Quick Add Bar
- Dolny pasek z inputem — szybkie dodawanie notatki z wybraną kategorią
- Type-picker przebudowuje się dynamicznie po zmianach kategorii

### 11. Search & Filter
- **Ctrl+F**: fokus na pole wyszukiwania
- **Filtrowanie**: po typie kategorii — ukrywa/pokazuje notatki na canvas

### 12. Import / Export
- **Export**: przycisk → pobiera `cortex-export-YYYY-MM-DD.json`
- **Import**: `store.importData(data)` — ładuje z JSON, zachowuje kategorie

---

## Konfiguracja (constants.js)

```js
NOTE_CONFIG.width = 240       // Szerokość karty notatki
NOTE_CONFIG.minHeight = 80    // Min wysokość
CANVAS_CONFIG.zoomRange = [0.08, 4]
CANVAS_CONFIG.gridSize = 40   // Rozmiar siatki
DRAW_CONFIG.defaultWidth = 2  // Domyślna grubość pędzla
STORAGE_KEY = 'cortex-data-v2'
```

---

## Skróty klawiszowe

| Klawisz | Akcja |
|---|---|
| `Ctrl+V` | Wklej screenshot |
| `Ctrl+F` | Szukaj |
| `Ctrl+Z` | Cofnij (w trybie rysowania) |
| `Tab` | Tryb łączenia notatek |
| `D` | Tryb rysowania |
| `E` | Rozwiń/zwiń notatki |
| `X` | Gumka (w trybie rysowania) |
| `[` / `]` | Zmień rozmiar pędzla |
| `Delete` | Usuń zaznaczone |
| `Escape` | Zamknij panel/modal |
| `Shift+Click` | Multi-select |
| `Dbl-click tło` | Nowa notatka |
| `Dbl-click notatkę` | Edycja |

---

## Uruchomienie

```bash
cd cortex-app
npm install          # Tylko vite
npm run dev          # → http://localhost:5173
```

---

## Znane ograniczenia

1. **localStorage ~5-10MB** — screenshoty 1:1 szybko zjadają miejsce. Przy dużej ilości zdjęć rozważ IndexedDB
2. **Gemini free tier** — quota resetuje się o 9:00 PL (midnight Pacific). Model `gemini-2.0-flash` ma `limit: 0` na tym kluczu — używamy `gemini-3.1-flash-lite`
3. **Brak VDOM** — re-render przebudowuje cały SVG. Przy 200+ notkach może zwalniać
4. **Brak undo** na operacjach na notkach (tylko na rysowaniu)

---

## Jak modyfikować

- **Nowa kategoria domyślna**: `store.js` → `_defaultCategories()`
- **Zmiana modelu AI**: `vision.js` linia 2 → `VISION_MODEL`
- **Nowy typ notatki (np. z plikiem)**: dodaj pola w `store.addNode()`, nową metodę renderowania w `canvas._renderScreenshotNote()`, obsługę w `panel.show()`
- **Style**: `style.css` — zmienne CSS na górze pliku (`:root`)

---

## Historia zmian (sesja maj 2026)

1. **Bazowy system** — canvas, notatki, połączenia, rysowanie, parking, import/export
2. **Redesign** — przejście z D3 force-graph na ręczny SVG, mat-solid design
3. **Screenshoty** — Ctrl+V paste, kompresja JPEG, renderowanie 1:1 na canvas
4. **AI Vision** — integracja Gemini Flash, automatyczny opis screenów
5. **Kategorie dynamiczne** — CRUD modal, dynamiczne kolory w całym UI
6. **Flash Chat** — globalny asystent AI z kontekstem wszystkich notatek
