# CORTEX V2: Spatial ZUI & AI Subsystem (Technical Design Document)

## 0. Kontekst Filozoficzny i Biznesowy dla AI (ZROZUMIENIE PROJEKTU)
**Przeczytaj to uważnie, zanim napiszesz linijkę kodu.**
Cortex to nie jest zwykły notatnik. To przestrzenny "drugi mózg" (Second Brain) dla użytkownika nietechnicznego, który mapuje w nim złożone lejki sprzedażowe, architekturę wideo na YouTube i pomysły na biznes. 

**Kluczowe filary filozofii Cortexa:**
1. **Pamięć Przestrzenna (ZUI):** Użytkownik nie szuka po tytułach. Pamięta, że "ten pomysł leży w prawym dolnym rogu wielkiego kwadratu Mózg". *Bliskość przestrzenna równa się bliskości semantycznej.* 
2. **Nieskończona Plansza (Minecraft Universe):** Odchodzimy od ukrywania notatek i przeładowywania stron. Wszystko – każdy projekt, każda strefa – istnieje jednocześnie na jednej gigantycznej mapie 2D. Różnica polega tylko na dystansie między nimi. 
3. **AI jako Partner, a nie Sprzątaczka:** Użytkownik nienawidzi, gdy AI przesuwa mu notatki i niszczy jego układ przestrzenny. AI ma "operować" na układzie – analizować go i dorzucać fizyczne, półprzezroczyste karty z pytaniami DOOKOŁA klastra użytkownika (tzw. Krytyk), albo rysować znikające linie między odległymi kartami (Linker).
4. **Intencja (Meta-Notatki):** Konieczne jest dodanie możliwości zostawienia notatki-dziennika (MetaNote) do całego Projektu lub Workspace'a, np. *"Nie wiem co tu się dzieje, na razie to zostawiam"*.

Otrzymasz plik JSON (`cortex-ai-[data].json`). Przestudiuj go. Zachowaj kompatybilność ze standardem `cortex.visible.v2` w logice, ale rozbuduj go o poniższą mechanikę przestrzenną Bounding Boxów.

---

## 1. Architektura Danych: Przejście na Bounding Boxy (`src/schema.js`)
Obecny stan trzymany jest w `store.js` jako duży obiekt z kluczami takimi jak `nodes`, `links`, `projects`. Zmieniamy logikę Projektów z "ukrytych filtrów widoczności" na fizyczne kontenery.

### 1.1 Nowa encja: `workspaces`
Należy dodać normalizację dla nowego klucza `workspaces`.
```javascript
// Oczekiwana struktura dla pojedynczego Workspace
{
  id: string,               // uuid
  name: string,             // "Mózg", "Robocze"
  metaNote: string,         // Długi string z myślami użytkownika na temat tej strefy
  createdAt: ISOString,
  updatedAt: ISOString
}
```

### 1.2 Modyfikacja encji `projects`
Projekty przestają być płaskimi encjami, a stają się węzłami w hierarchii: `Workspace -> Project -> Node`. Należy dodać klucz powiązania przestrzennego i metadane.
```javascript
// Oczekiwana modyfikacja w normalizeProjects
{
  id: string,
  workspaceId: string,      // Do jakiego obszaru należy
  name: string,
  metaNote: string,         // Długi string (intencja/notatka użytkownika)
  createdAt: ISOString,
  updatedAt: ISOString
}
```

---

## 2. Silnik Przestrzenny (Spatial ZUI) w `src/canvas.js` i `src/projects.js`

### 2.1 Koncepcja Bounding Box (Kwadraty Latające)
Każdy element wyższego rzędu NIE MA zapisanych na sztywno koordynatów X, Y ani wielkości w bazie.
Zamiast tego, w locie (na rAF lub po zmianie stanu), silnik wylicza obrysy:

1. **Project Bounding Box (`PBox`):**
   - Weź wszystkie notatki (`nodes`), których `node.projectId === currentProjectId`.
   - Oblicz `minX, maxX, minY, maxY`.
   - Dodaj padding np. `150px`. 
   - Renderuj duży kwadrat z `border` na Canvasie pod notatkami, z etykietą i przyciskiem `metaNote`.

2. **Workspace Bounding Box (`WBox`):**
   - Weź wszystkie `PBox` należące do projektów z danym `workspaceId`.
   - Oblicz globalne `minX, maxX, minY, maxY`.
   - Dodaj padding np. `400px`.
   - Renderuj jeszcze większy kwadrat pod projektami.

### 2.2 Przeciąganie Kontenerów (Drag & Drop)
Kiedy użytkownik w UI kliknie i przeciągnie nagłówek "Projektu":
- Silnik rejestruje przesunięcie wskaźnika myszy o wektor `dx, dy`.
- Zamiast ruszać projekt (bo projekt nie ma zapisanych współrzędnych!), skrypt pod spodem robi: `nodes.filter(n => n.projectId === draggedProject.id).forEach(n => { n.x += dx; n.y += dy; })`.
- Efekt: wszystkie notatki przemieszczają się na ekranie, a `PBox` aktualizuje się natychmiastowo, dając iluzję przeciągania wielkiego kwadratu.

---

## 3. Smart HUD & Location Engine (`src/main.js` / `src/viewport.js`)

Aplikacja musi wiedzieć, "nad czym" obecnie przelatuje kamera, aby dostosować UI, eksport i Inbox.
1. Oblicz `viewportCenter = { x: camera.x + windowWidth/2/zoom, y: camera.y + windowHeight/2/zoom }`.
2. Odszukaj najmniejszy obrys, w którym mieści się `viewportCenter`:
   - Jeśli środek wpada w obrys jakiegoś `PBox` -> `store.setActiveContext({ type: 'project', id: p.id })`.
   - Jeśli nie, ale wpada w `WBox` -> `store.setActiveContext({ type: 'workspace', id: w.id })`.
   - W przeciwnym wypadku -> `store.setActiveContext(null)`.
3. Nagłówek HTML na górze strony (`#smart-hud`) subskrybuje ten kontekst i płynnie pokazuje np. **"Jesteś w: Projekt YouTube"**.

---

## 4. Contextual Inbox 2.0 (`src/inbox.js`)

System czatów powiązany z obszarami na mapie.
1. Zamiast jednej tablicy `inboxMessages`, w bazie pojawia się:
   `state.chats = [{ id, scopeType, scopeId, title, messages: [{id, text, role}], createdAt }]`.
2. Kiedy użytkownik ląduje kamerą nad "Projekt 1", boczny panel automatycznie ukrywa inne rozmowy i ładuje listę czatów przypisanych do `scopeId === 'projekt_1'`.
3. Podpięcie AI: Gdy po założeniu nowego czatu ilość wiadomości dobije do 2, w tle uderzamy do Gemini 3.1 Flash z system promptem: *"Stwórz z tego 2-słowny tytuł"*. Zwrócony ciąg nadpisuje domyślny `title` w `state.chats`.

---

## 5. Inteligentny Eksport (`src/store.js` -> `exportData`)

Rozszerzenie logiki eksportu na bazie kamery (Smart HUD):
- Klawisz Eksportu "Current" -> Eksportuje dane pasujące do obecnego `store.getActiveContext()`. Naming convention: `cortex-ai-[type]-[name]-[data].json` (np. `cortex-ai-workspace-mozg-2026-05-15.json`).
- Shift + Klawisz Eksportu -> Funkcja **Master Backup**. Eksportuje absolutnie wszystkie `nodes, projects, workspaces, links` – pełny stan, bez pytania, nazywany `cortex-universe-backup-YYYY-MM-DD.json`.

---

## 6. AI Subsystem & Automatyzacja (`src/aiEngine.js`)

Mechanizmy do asynchronicznego modyfikowania przestrzeni opisanego wyżej modelu. Należą do nich "Krytyk" oraz "Wykrywacz Ukrytych Połączeń" operujące na współrzędnych.

### 6.1 Ustawienia AI w UI (`index.html` i `src/settings.js`)
Pojawia się nowa zakładka konfiguracyjna, która na twardo wstrzykuje parametry do silnika:
- **Scope Limit:** Selector definiujący, co algorytm może wziąć pod uwagę (np. "Tylko obecny projekt", "Tylko zaznaczone obiekty", "Dowolny węzeł na całej planszy").
- **Node Batch Size (Hardcoded logic):** Zmienna `maxNodesPerCall` (np. max 20 notatek per prompt).
- **Interval (Hardcoded logic):** Zmienna opóźnienia, np. `AI_DELAY_MS = 15000` między kolejnymi zapytaniami z kolejki.
- **System Prompts:** Dwa textareas (edycja promptu `Krytyka` i `Linkera`).

### 6.2 Architektura Kolejki Operacji (AI Queue)
Użytkownik ma na głównym pasku menu z przyciskiem akcji (np. "Zaskocz mnie – Krytyk"). 
Z każdym kliknięciem tego przycisku, nowa instancja "zadania" wpada do asynchronicznej kolejki, aby nie zablokować i nie spalić limitów API.
```javascript
// Schemat algorytmiczny, do pełnego zaimplementowania w kodzie
class AIQueueManager {
  constructor() {
    this.queue = [];
    this.intervalMs = 15000; // Opóźnienie pomiędzy strzałami (synchronizowane z ustawieniami)
    this.isProcessing = false;
  }
  
  enqueueTask(type) {
    this.queue.push(type);
    this.processNext();
  }
  
  async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    
    while(this.queue.length > 0) {
      const taskType = this.queue.shift();
      // 1. Wyciąga notatki z bazy zgodnie ze Scope Limitem
      // 2. Formatuje JSON do wysłania do Gemini Flash Lite
      // 3. Odbiera odpowiedź
      await this.executePayload(taskType);
      
      // Twarde wymuszenie oczekiwania na kolejny cykl
      await new Promise(r => setTimeout(r, this.intervalMs));
    }
    this.isProcessing = false;
  }
}
```

### 6.3 Logika Wykonawcza (Execute Payload)
Gdy `executePayload` (np. Krytyk) otrzyma poprawny JSON od Gemini, uruchamia twardą mutację stanu:
1. Pobiera geometrię poddanych analizie węzłów (oblicza ich `minX, maxX, minY, maxY`).
2. Tworzy nowy obiekt Node (`type: 'problem'` lub `type: 'pytanie'`).
3. Wstawia ten Node do bazy z fizycznymi współrzędnymi X, Y leżącymi o `+50px` na wschód lub zachód od obliczonego Bounding Boxa, by karta pojawiła się obok klastra. Silnik przerysuje widok.

---
**Uwaga dla AI wykonującego:** Twoim obowiązkiem podczas implementacji jest ścisłe trzymanie się tego dokumentu. Architektura Cortex to absolutne pozycjonowanie na planszy - nie psuj CSS `transform` dla węzłów, tylko rozbuduj system wizualnego zamykania ich w Boxy. Używaj przesłanego Ci eksportu `cortex.visible.v2` jako kanonicznego źródła wiedzy o stanie aplikacji.
