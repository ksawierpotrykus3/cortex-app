# Cortex / Codex project state

Stan dokumentu: 2026-05-15, gałąź `main`, po wdrożeniu `cortex.visible.v2`, projektów, warstw/zoomów, Quality of Life oraz czyszczenia eksportów AI z `null`/root-layer noise.

Ten plik jest kanonicznym kontekstem dla Codexa i innych agentów pracujących nad repo. Ma opisywać faktyczny stan aplikacji, a nie plan sprzed przebudowy. Jeżeli kod i ten plik się rozjadą, najpierw sprawdź kod, potem popraw ten dokument.

## 1. Cel aplikacji

Cortex to lokalna aplikacja webowa do pracy na nieskończonej tablicy semantycznej. Użytkownik łapie luźne myśli, screeny, decyzje, pytania i plany jako widoczne elementy na SVG canvasie. Główny cel obecnej wersji to:

- zapisać to, co człowiek realnie widzi na tablicy,
- eksportować dla AI tylko widzialny, semantyczny kontekst,
- nie wciskać do eksportu AI base64 obrazów, surowych payloadów ani technicznych śmieci,
- zachować pełny backup aplikacji osobno, gdy użytkownik chce pełne dane edytowalne,
- mieć projekty, warstwy/zoomy, rysunki i szybki inbox bez mieszania ich semantyki.

Najważniejsza granica: eksport AI `cortex.visible.v2` nie jest backupem. To czytelny opis widocznej tablicy dla modelu. Full backup nadal zawiera pełny stan aplikacji, w tym obrazy.

## 2. Stack i uruchamianie

Repo aplikacji: `F:\PROJEKTY\CORTEX\cortex-app`

Technologie:

- Vite `8.x`
- Vanilla JavaScript ES modules
- ręcznie tworzony SVG DOM dla canvasu
- CSS bez frameworka
- `localStorage` jako baza lokalna
- Google Gemini API w `src/vision.js`
- `node --test` jako test runner

Komendy:

```powershell
npm install
npm run dev
npm test
npm run build
npm run preview
```

Domyślny dev server Vite: `http://localhost:5173`.

`package.json` ma dependency `d3`, ale obecny canvas nie używa D3 force graph. Render jest ręczny przez SVG.

## 3. Najważniejsze pliki

```text
cortex-app/
  index.html                 UI, top bar, modale, side panel, inbox, flash panel
  CORTEX.md                  ten dokument, kanoniczny opis stanu projektu
  package.json               skrypty dev/test/build
  src/
    main.js                  inicjalizacja aplikacji, seed, eksporty, paste screenshotów, settings
    schema.js                migracja i normalizacja danych, scope, warstwy, link endpoint helper
    store.js                 centralne API danych i localStorage
    semanticExport.js        builder eksportu AI `cortex.visible.v2`
    canvas.js                SVG canvas: pan/zoom, render, drag, multi-select, link mode, layer preview
    panel.js                 prawy panel notki: edycja, projekt, semantyka, warstwa, link picker
    inbox.js                 szybka Zakładka / inbox
    projects.js              scope projektu i layer controls w top barze
    categories.js            CRUD kategorii
    drawing.js               rysowanie i gumka w aktualnym scope
    vision.js                Gemini Flash OCR/opis screenów i text query
    flashchat.js             chat z kontekstem semantycznego eksportu
    filter.js                search przez przyciemnianie niepasujących kart
    parking.js               stary parking: przegląd/przywracanie parked notes
    constants.js             kolory, wymiary kart, zoom, rysowanie, storage key
    seed.js                  dane startowe przy pierwszym uruchomieniu
    cortexData.test.js       testy migracji i eksportu semantycznego
    store.test.js            testy store API, scope, inbox, preview, linki
  Zadanie/
    backup.json
    cortex-ai-2026-05-15.json
    all.json / current.json / project.json / layer.json / select.json
    image.png
    prompt.md
```

Nie ma już `quickadd.js`. Dolny quick-add bar został usunięty z aktywnego UI. Szybkie łapanie myśli robi `Zakładka` / inbox oraz double-click na tle.

## 4. Model danych w `localStorage`

Główny klucz: `cortex-data-v2`.

Stan zawsze przechodzi przez `migrateState()` z `src/schema.js`, więc stare dane dostają domyślne pola.

Top-level shape:

```js
{
  nodes: [],
  links: [],
  parking: [],
  inboxMessages: [],
  strokes: [],
  categories: [],
  semanticConfig: {},
  projects: [],
  layers: [],
  activeProjectId: 'all',
  activeLayerId: 'root'
}
```

### 4.1 Node

Każdy node po migracji ma stabilne pola:

```js
{
  id: 'uuid-or-existing-id',
  title: '',
  content: '',
  type: 'category-id',
  stage: 'robocze' | 'plan',
  planKind: '',
  priority: 1,
  rawState: 'raw' | 'extracted' | 'hidden' | 'archived',
  projectId: null,
  layerId: 'root',
  sourceIds: [],
  x: 200,
  y: 200,
  createdAt: 'ISO',
  updatedAt: 'ISO',

  // opcjonalnie dla screenów:
  image: 'data:image/jpeg;base64,...',
  imageWidth: 1920,
  imageHeight: 1080,
  imageDescription: 'TEKST:\n...\n\nOPIS:\n...',
  cardScale: 1
}
```

Uwagi:

- `type` to ID kategorii, nie osobny enum.
- Domyślna kategoria to ta z `isDefault`, zwykle `rozrzutka`.
- `priority` jest liczbą 1-10.
- `rawState` ma stałe ID zachowania; edytowalne są etykiety w `semanticConfig` (w Ustawieniach).
- `stage='plan'` oznacza przetworzony element planu.
- `planKind` określa cel (np. cel, mechanizm, decyzja). Lista typów jest w pełni edytowalna (CRUD) w panelu Ustawień, podobnie jak Kategorie.
- `sourceIds` służy do śledzenia pochodzenia, np. elementów wyciągniętych ze screena.
- Screeny nadal trzymają obraz w pełnym stanie aplikacji, ale nie w eksporcie AI.

### 4.2 Links

Linki mają prostą strukturę:

```js
{ source: 'node-id', target: 'node-id' }
```

W starszych danych endpoint mógł być obiektem D3 (`{ id: '...' }`). Cały kod powinien używać `getEndpointId()` z `schema.js`, bo to zabezpiecza render, delete, import i export przed zerwanymi relacjami.

`normalizeLinks()`:

- usuwa linki bez istniejących endpointów,
- usuwa self-linki,
- deduplikuje pary niezależnie od kierunku.

### 4.3 Projects

Projekt jest kontenerem roboczym:

```js
{
  id: 'project-id',
  name: 'Projekt',
  createdAt: 'ISO',
  updatedAt: 'ISO'
}
```

Node przypisany do projektu ma `projectId`. Usunięcie projektu nie kasuje notek; odpina im `projectId` i przenosi je na brudną tablicę.

### 4.4 Layers / zoom

Warstwa nie jest projektem. Warstwa to podtablica przypięta do notki lub custom layer.

Root:

```js
{
  id: 'root',
  title: 'Tablica główna',
  titleMode: 'custom',
  parentLayerId: null,
  originNodeId: null,
  fallbackTitle: 'Tablica główna'
}
```

Child layer:

```js
{
  id: 'uuid',
  parentLayerId: 'root-or-parent-layer',
  originNodeId: 'node-id',
  titleMode: 'bound' | 'custom',
  title: '',
  fallbackTitle: 'Tytuł notki w chwili utworzenia',
  projectId: null,
  createdAt: 'ISO',
  updatedAt: 'ISO'
}
```

Zasady:

- Jeśli `titleMode='bound'`, tytuł warstwy jest dynamicznie brany z tytułu notki `originNodeId`.
- Ręczne przemianowanie warstwy przełącza ją na `titleMode='custom'`.
- `buildLayerPath()` buduje breadcrumbs/path.
- Powrót z warstwy (strzałka "wstecz" / `backToParentLayer()`) do Tablicy głównej (`ROOT_LAYER_ID`) automatycznie przywraca jako aktywny projekt ten, do którego przypisana była notatka-źródłowa (`originNodeId`), aby uniknąć gubienia kontekstu i lądowania w widoku `Wszystko`.
- Usunięcie notki będącej `originNodeId` wymaga decyzji w UI: `cancel`, `detach`, albo `delete-layers`.
- `detach` zamraża tytuł warstwy jako custom.
- `_deleteLayer()` kasuje warstwę, child layers, notki w tych warstwach, linki do tych notek i rysunki scope `layer`.

### 4.5 Strokes / rysunki

Rysunek:

```js
{
  id: 'uuid',
  points: [{ x, y }, ...],
  color: '#ffffff',
  width: 2,
  scope: 'workspace' | 'project' | 'layer',
  projectId: null,
  layerId: null,
  createdAt: 'ISO'
}
```

Rysunki są scope-aware:

- w aktywnej warstwie zapisują `scope='layer'` i `layerId`,
- w aktywnym projekcie zapisują `scope='project'` i `projectId`,
- w widoku root/all/dirty zapisują `scope='workspace'`.

Render rysunków zawsze przechodzi przez `getVisibleStrokes()` i `strokeMatchesScope()`.

### 4.6 Categories

Kategoria:

```js
{
  id: 'rozrzutka',
  name: 'Rozrzutka',
  color: '#7c6cb5',
  order: 3,
  isDefault: true,
  autoTitle: ''
}
```

UI kategorii obsługuje:

- dodawanie,
- zmianę nazwy,
- zmianę koloru,
- zmianę kolejności,
- ustawienie domyślnej kategorii,
- `autoTitle` dla nowych notek,
- usuwanie kategorii z migracją notek do fallbacku.

### 4.7 Inbox / Zakładka

Inbox jest osobny od parkingu:

```js
{
  id: 'uuid',
  text: 'surowa szybka myśl',
  createdAt: 'ISO',
  copiedAt: 'ISO optional'
}
```

Store API:

- `addInboxMessage(text)`
- `deleteInboxMessage(id)`
- `getInboxMessages()`
- `copyInboxContext({ markCopied, onlyUncopied })`

`copyInboxContext()` zwraca tekst zaczynający się od `CORTEX_INBOX_CONTEXT` i JSON `cortex.inbox.v1`.

### 4.8 Parking

Parking jest legacy magazynem `parking: []`. UI panelu notki nie tworzy już nowych parked notes, ale:

- stare dane parkingu są zachowane przez migrację,
- `parking.js` nadal pokazuje modal parkingu,
- `store.parkNode()` i `restoreNode()` nadal istnieją,
- parking nie jest częścią nowego inboxa.

## 5. Scope i widoczność

Scope widoku wynika z `activeLayerId` i `activeProjectId`.

`nodeMatchesView(node, state)`:

1. Najpierw filtruje po aktywnej warstwie.
2. Jeśli `activeProjectId='all'`, pokazuje wszystkie notki w aktywnej warstwie.
3. Jeśli `activeProjectId='dirty'`, pokazuje notki bez `projectId`.
4. Jeśli `activeProjectId` jest ID projektu, pokazuje notki tego projektu.

Warstwa wygrywa nad projektem. `setActiveLayerId(non-root)` ustawia `activeProjectId='all'`.

`currentScope(state)`:

- jeśli aktywna warstwa nie jest root: `{ type: 'layer', layerId }`,
- jeśli aktywny projekt jest konkretny: `{ type: 'project', projectId }`,
- inaczej: `{ type: 'workspace' }`.

To ma znaczenie głównie dla rysunków.

## 6. Eksporty i import

### 6.1 Full backup

`store.exportData({ full: true })` pobiera:

- pełny stan aplikacji,
- pełne `nodes`,
- obrazy base64,
- parking,
- inbox,
- projekty,
- warstwy,
- rysunki,
- kategorie.

Nazwa pliku: `cortex-backup-YYYY-MM-DD.json`.

Full backup jest jedyną właściwą formą do odzyskiwania pełnej aplikacji.

### 6.2 Semantic AI export

`store.exportData(options)` bez `full` pobiera `cortex.visible.v2`.

Nazwa pliku: `cortex-ai-YYYY-MM-DD.json`.

Obsługiwane scope:

- `current`
- `selection`
- `project`
- `layer`
- `all`
- `workspace`
- `backup` jako alias do full backup w prompt UI

`store.buildSemanticContext(options)` zwraca tekst:

```text
CORTEX_VISIBLE_CONTEXT
Czytaj ten JSON jako to, co użytkownik widzi na tablicy...

{ ...cortex.visible.v2... }
```

### 6.3 Schemat `cortex.visible.v2`

Top-level:

```js
{
  schema: 'cortex.visible.v2',
  scope: {},
  ai_context: {},
  board: {},
  types: {},
  items: [],
  projects: [],
  layers: [],
  connections: [],
  externalConnections: [],
  drawings: []
}
```

`projects`, `layers`, `connections`, `externalConnections`, `drawings` i `inbox` są sekcjami opcjonalnymi. Builder dopisuje je tylko wtedy, gdy w danym eksporcie faktycznie istnieje widoczna treść dla tej sekcji.

W eksporcie:

- ID notek są mapowane na lokalne `n1`, `n2`, ... w reading order.
- `scope.selectedIds` w eksporcie selection też używa lokalnych ID `n1`, `n2`, ...; nie eksportuje surowych ID z bazy.
- `items` są sortowane po `y`, potem `x`.
- `board.bounds` opisuje widzialny bounding box.
- `board.counts.projects` i `board.counts.layers` liczą sekcje faktycznie dołączone do eksportu, a nie globalną liczbę projektów/warstw w bazie.
- `board.readingOrder` zachowuje kolejność czytania.
- `where.pos` zawiera pozycję.
- `where.zone`, `row`, `col` pomagają AI rozumieć układ.
- `where.layerId` jest pomijane dla root layer, bo root jest domyślnym widokiem i nie jest zoomem.
- Root layer nie jest dopisywany do sekcji `layers` jako pusta warstwa. `layers` opisuje tylko realne child layers/zoomy widoczne lub istotne dla zakresu.
- Pola `null` nie są zapisywane w `cortex.visible.v2`; brak pola znaczy "nie dotyczy".
- `connections` zawiera tylko relacje między elementami widocznymi w danym scope.
- `externalConnections` opisuje relacje, gdzie tylko jeden endpoint jest w scope.
- `drawings` są uproszczone i przycięte do maksymalnie 24 punktów na ścieżkę.
- Obrazy nigdy nie są osadzane.

Przykład itemu notki:

```js
{
  id: 'n1',
  type: 'problem',
  category: 'problem',
  priority: 5,
  rawState: 'raw',
  stage: 'robocze',
  title: 'Problem',
  text: 'Treść widoczna na notce',
  where: {
    pos: [450, 145],
    zone: 'top-center',
    row: 1,
    col: 2
  },
  chronology: {
    createdAt: 'ISO',
    updatedAt: 'ISO'
  }
}
```

Przykład itemu screena:

```js
{
  id: 'n2',
  kind: 'screen',
  imageSize: [800, 600],
  note: 'własna notatka użytkownika',
  screenText: 'tekst z sekcji TEKST opisu Flash',
  screenDescription: 'opis z sekcji OPIS',
  rawState: 'extracted'
}
```

### 6.4 Statusy `hidden` i `archived` w eksporcie

`hidden` / Schowane:

- UI pokazuje pasek tytułowy bez treści i bez obrazu.
- Panel informuje, że treść/obraz są schowane.
- `cortex.visible.v2` zachowuje tytuł i fakt schowania.
- `cortex.visible.v2` nie eksportuje `text`, `note`, `screenText`, `screenDescription`.
- Full backup nadal zawiera pełną treść i obraz.

`archived` / Archiwum:

- UI renderuje element przygaszony (`opacity` około 0.55).
- Eksport dodaje `visualState: 'archived'` i `visualWeight: 'low'`.
- Treść zostaje w eksporcie, bo archiwum jest widzialne, tylko mniej ważne.

### 6.5 Import

`store.importData(data)`:

- odrzuca `data.schema` zaczynające się od `cortex.visible`, bo eksport semantyczny jest read-only kontekstem dla AI,
- przyjmuje pełny backup z `nodes` i `links`,
- zachowuje aktualne `categories`, `projects`, `layers`, `activeProjectId`, `activeLayerId`, jeśli import ich nie ma,
- przeprowadza `migrateState()`.

## 7. UI i interakcje

### 7.1 Top bar

Główne elementy:

- `Zakładka` - szybki inbox.
- Search input - `Ctrl+F`.
- Project scope select: `Wszystko`, `Brudna tablica`, projekty użytkownika.
- `+` - utwórz projekt.
- `P` - zmień nazwę aktywnego projektu.
- `P-` - usuń aktywny projekt.
- Back layer button - wróć do parent layer.
- Layer title button - tytuł aktywnej warstwy, klik do rename jeśli nie root.
- Parking button - legacy parking view.
- Export button - semantic export, Shift+click full backup.
- `AI` - Kopiuj kontekst dla AI.
- `D-` - usuń rysunki w aktualnym scope.
- Settings - klucz API, edycja etykiet stanów surowych oraz pełny menedżer Typów Planu (dodawanie, edycja, usuwanie, sortowanie).
- Categories - modal kategorii.
- Flash - globalny Flash Chat.
- Reset - wyczyść bazę.
- Help - skróty.

### 7.2 Canvas

Canvas jest SVG.

Interakcje:

- scroll - zoom canvasu,
- `Ctrl`/`Meta` + scroll na notce - resize `cardScale` zaznaczonych lub jednej notki,
- drag tła - pan,
- double-click tła - nowa notka w tym miejscu i od razu edycja w panelu,
- click notki - panel i highlight sąsiedztwa,
- double-click notki - panel w trybie edycji,
- `Shift+click` notki - multi-select,
- `Shift+drag` po tle - selection rectangle,
- drag jednej zaznaczonej notki - przesuwa całą selekcję,
- `Tab` - tryb linkowania po widzialnych notkach,
- `D` - drawing mode,
- `X` w drawing mode - gumka,
- `[` / `]` - rozmiar pędzla,
- `Ctrl+Z` w drawing mode - undo ostatniego widocznego rysunku,
- `E` - expand/collapse notek.

Semantic zoom:

- przy `scale < 0.45` notki przechodzą w title-only,
- przy `scale < 0.2` przechodzą w dot mode.

### 7.3 Warstwy / zoom

W panelu notki jest sekcja `Warstwa / zoom`:

- `Utwórz / otwórz warstwę z tej notki`,
- `Nadaj własny tytuł warstwy` / `Zmień tytuł warstwy`.

Notka z child layer pokazuje badge `Z<count>`. Hover na takiej notce pokazuje mini-preview warstwy:

- tytuł warstwy,
- liczba elementów,
- liczba połączeń,
- mini SVG notek i linków.

Preview jest tylko odczytem:

- nie zmienia aktywnej warstwy,
- nie zapisuje pozycji,
- nie tworzy duplikatów.

### 7.4 Panel notki

Panel pokazuje:

- tytuł,
- kategorię,
- datę,
- projekt,
- warstwę,
- stage,
- priorytet,
- treść lub placeholder,
- screen i opis AI, jeśli node ma obraz i nie jest `hidden`,
- projekt assignment,
- semantykę: priorytet, rawState, planKind,
- warstwę,
- połączenia.

Panel obsługuje:

- edycję tytułu, treści i kategorii,
- przypisanie do projektu,
- przeniesienie `ROBOCZE <-> PLAN`,
- zmianę priorytetu 1-10,
- zmianę `rawState`,
- zmianę `planKind` gdy stage to `plan`,
- reanalizę screena przez Flash,
- ręczną edycję/usunięcie opisu AI screena,
- usuwanie notki,
- obsługę usuwania notki będącej originem warstwy.

### 7.5 Globalny picker linków

Przycisk `Połącz z innym...` w panelu otwiera modal z wyszukiwarką po wszystkich notkach, nie tylko widocznych.

Zachowanie:

- wyszukuje po tytule, treści, typie i nazwie projektu,
- nie pozwala drugi raz wybrać już połączonego targetu,
- link zapisuje się jako zwykłe `{ source, target }`,
- canvas rysuje linię tylko gdy oba endpointy są widoczne,
- panel pokazuje też połączenia zewnętrzne z nazwą projektu i akcją przejścia.

### 7.6 Projekty

Projekty są zarządzane z top bara i panelu:

- tworzenie,
- zmiana nazwy,
- usuwanie,
- przypisywanie pojedynczej notki z panelu,
- przypisywanie wielu notek z batch actions,
- opcjonalne przypisanie także połączonych notek w batch flow,
- eksport projektu przez export prompt.

Projekt nie zastępuje warstw. Projekt filtruje root-layer roboczo; warstwa jest osobnym zoomem/podtablicą.

### 7.7 Inbox / Zakładka

`Zakładka` otwiera panel jak szybki chat/inbox.

Zachowanie:

- Enter dodaje wpis,
- Shift+Enter daje nową linię,
- wpis trafia do `inboxMessages`,
- wpisy można usuwać,
- `Kopiuj inbox dla AI` kopiuje `CORTEX_INBOX_CONTEXT` i oznacza wpisy `copiedAt`,
- inbox nie tworzy notek automatycznie,
- inbox nie miesza się z parkingiem.

### 7.8 Kategorie i settings

Modal kategorii obsługuje pełny CRUD i default category.

Settings obsługuje:

- Gemini API key,
- etykiety raw state,
- typy planu w formacie `id: label`,
- wejście do modalu kategorii.

Uwaga: edytowalne są etykiety/statusy i plan kind definitions. Zachowania `raw`, `extracted`, `hidden`, `archived` są stałe.

### 7.9 Screenshoty

Paste flow w `main.js`:

- `Ctrl+V` poza input/textarea łapie pierwszy obraz z clipboarda,
- `vision.compressImage(file)` konwertuje do JPEG i zachowuje oryginalne wymiary,
- nowy node dostaje `image`, `imageWidth`, `imageHeight`,
- pozycja screena jest wycentrowana w aktualnym viewport,
- jeśli jest API key, `vision.analyzeImage()` odpala asynchronicznie i zapisuje `imageDescription`.

Prompt do Gemini wymusza format:

```text
TEKST:
...

OPIS:
...
```

`semanticExport.parseVisionDescription()` rozcina `imageDescription` na `screenText` i `screenDescription`.

### 7.10 Flash Chat

Flash Chat używa `store.buildSemanticContext()` jako kontekstu, czyli tego samego widzialnego eksportu co `Kopiuj kontekst dla AI`.

Nie wysyła obrazów base64. Wysyła tekstowy JSON widocznej tablicy, opisy screenów i układ.

Model w kodzie: `gemini-3.1-flash-lite`.

API key: `localStorage['cortex-vision-api-key']`.

## 8. Testy

Test command:

```powershell
npm test
```

Obecnie testy obejmują między innymi:

- migracja starego stanu i usuwanie broken links,
- eksport `cortex.visible.v2` bez osadzonych obrazów,
- dynamiczny tytuł bound layer w eksporcie,
- eksport selection z tylko widocznymi relacjami,
- eksport selection z lokalnymi ID `n1`, `n2`, bez surowych ID bazy w `scope.selectedIds`,
- brak `null` i root-only layer noise w semantycznym eksporcie,
- scoped counts projektów/warstw liczone z eksportowanych sekcji, a nie globalnej bazy,
- eksport current all-project view zgodny z widokiem root,
- hidden export bez treści i bez opisu screena,
- archived export z `visualWeight: low`,
- external project links jako `externalConnections`,
- delete object-endpoint links,
- detach bound layer przy usuwaniu origin node,
- scoping nodes/strokes po layer/project,
- dynamiczny tytuł warstwy do czasu ręcznego rename,
- inbox osobno od parkingu,
- rectangle selection i group move,
- all connections dla node z widocznymi i zewnętrznymi targetami,
- non-mutating child layer preview,
- update semantic config bez zmiany behavioral IDs.

Build:

```powershell
npm run build
```

Ostatni znany stan przed tym dokumentem: `npm test` i `npm run build` przechodziły po merge na `main`.

## 9. Zasady dla kolejnych zmian

Przy każdej zmianie patrz jednocześnie jednostkowo i systemowo:

- UI lokalne,
- store,
- migracja,
- import/export,
- scope projektu,
- scope warstwy,
- rysunki,
- linki,
- hidden/archive,
- full backup vs semantic AI export,
- stare dane w `localStorage`.

Nie importuj `cortex.visible.v2` jako pełnej bazy. To tylko kontekst AI.

Nie osadzaj obrazów w eksporcie AI. Obraz ma być reprezentowany przez:

- tytuł,
- notatkę użytkownika,
- `imageSize`,
- `screenText`,
- `screenDescription`,
- `rawState`,
- źródła / `sourceIds`.

Nie mieszaj:

- `parking` z `inboxMessages`,
- `projectId` z `layerId`,
- full backup z semantic export,
- visible links z external links.

Przy pracy z linkami zawsze używaj `getEndpointId()`.

Przy dodawaniu pól do danych:

- dopisz migrację w `schema.js`,
- dopisz test w `cortexData.test.js` albo `store.test.js`,
- sprawdź semantic export,
- sprawdź full backup/import.

## 10. Znane ograniczenia i dług techniczny

1. `panel.js` zawiera martwe legacy bloki po `return` w `renderConnections()` i `renderSemanticControls()`. Nie wykonują się, build przechodzi, ale warto je usunąć przy najbliższym porządku.

2. `store.updateNodePosition()` zapisuje pozycje debounce przez bezpośrednie `storage.setItem()`, bez pełnego `migrateState()` i bez `_notify()`. To jest celowe dla drag performance, ale przy nowych polach trzeba uważać.

3. `SCREENSHOT_CONFIG` w `constants.js` jest częściowo legacy. Aktualny paste path używa `vision.compressImage(file, quality = 0.8)` i zachowuje oryginalny rozmiar.

4. `d3` zostaje w `package.json`, ale nie jest aktywnym silnikiem renderowania.

5. Search w `filter.js` działa przez bezpośrednie ustawianie opacity DOM. Może tymczasowo nadpisać opacity archived/highlight, bo nie przechodzi przez wspólny model visual state.

6. Parking UI nadal istnieje, ale panel notki nie ma już przycisku `Parkuj`. `store.parkNode()` zostaje dla zgodności ze starymi danymi.

7. `CORTEX.md` jest obecnie kanonicznym dokumentem projektu. Starszy `codex.md` nie istnieje po ostatnim pullu.

8. Brak pełnego undo dla operacji na notkach/projektach/warstwach. Undo jest tylko dla rysunków.

9. Full backup trzyma obrazy base64 w `localStorage`; przy dużej liczbie screenshotów baza może szybko urosnąć.

10. Brak walidacji schematu przez zewnętrzną bibliotekę. Walidacja i migracja są ręczne w `schema.js`.

## 11. Aktualny mental model dla AI

Jeżeli AI czyta eksport Cortex:

- Czytaj tylko to, co jest w JSON.
- Nie zakładaj ukrytych obrazów ani dodatkowych payloadów.
- `ROBOCZE` to surowiec: screeny, chaotyczne notki, fragmenty rozmów, pomysły.
- `PLAN` to przetworzony fundament: cel, mechanizm, feature, decyzja, pytanie lub next step.
- Pozycje i kolejność mają znaczenie.
- Projekty grupują pracę, ale nie są zoomami.
- Warstwy/zoomy są podtablicami, często pochodzącymi z jednej notki.
- Link widoczny w `connections` oznacza relację w aktualnym scope.
- Link w `externalConnections` oznacza relację poza aktualnym scope.
- `hidden` mówi, że człowiek i AI widzą tylko fakt ukrycia, nie treść.
- `archived` mówi, że treść jest widoczna, ale o niskiej wadze.

## 12. Szybka checklista przed pushem

```powershell
git status --short --branch
npm test
npm run build
```

Dla zmian UI:

- uruchom dev server,
- sprawdź konsolę przeglądarki,
- sprawdź tworzenie notki,
- edycję panelu,
- scope projekt/layer,
- eksport AI,
- full backup jeśli dotykasz danych.

## 13. Ostatni ważny kontekst użytkownika

Użytkownik chce, żeby eksporty nie ważyły absurdalnie dużo tokenów. Zasada nadrzędna: JSON dla AI ma odzwierciedlać 1:1 to, co człowiek widzi na tablicy. Screeny mają opisy Flash/OCR, więc nie wolno wkładać obrazów/base64 do eksportu semantycznego. Celem jest czysty, widzialny, semantyczny zapis tablicy, a nie backup techniczny aplikacji.

Aktualny audyt z folderu `Zadanie` poprawił trzy konkretne rzeczy w `semanticExport.js`: selection nie pokazuje już surowych ID bazy w `scope.selectedIds`, małe eksporty nie liczą globalnych projektów/warstw jako lokalnego kontekstu, a `cortex.visible.v2` nie dopisuje `null` ani root-layer metadata, gdy element nie ma realnego zoomu.
