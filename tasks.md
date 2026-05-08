# Plan Implementacji — Cortex

## Przegląd

Budowa od fundamentów w górę: store → graf → panel → quick add → filtry → parking → polish.
Każdy blok kończy się checkpointem — weryfikuj zanim przejdziesz dalej.

## Zadania

---

### Blok 1: Projekt i fundament

- [x] 1. Zainicjuj projekt Vite (`npx -y create-vite@latest ./ --template vanilla`)
- [x] Zainstaluj D3.js: `npm install d3`
- [ ] Dodaj Inter font z Google Fonts do index.html
- [ ] 2. Stwórz `style.css` z pełnym design systemem
  - Paleta kolorów (zmienne CSS), typografia, reset
  - Layout: top bar (52px) + main area + bottom bar (48px)
  - Panel boczny (360px, position fixed right, domyślnie schowany)
  - Wszystkie kolory node'ów jako CSS custom properties
  - Patrz design.md → sekcja "Design System"
- [ ] 3. Stwórz `src/constants.js`
  - Eksportuj kolory, rozmiary node'ów, config grafu
- [ ] 4. Punkt kontrolny — projekt się odpala, `npm run dev` działa, widać pusty layout z top/bottom bar

---

### Blok 2: Store + Seed Data

- [ ] 5. Stwórz `src/store.js` — CRUD na localStorage
  - `getNodes()`, `addNode(node)`, `updateNode(id, data)`, `deleteNode(id)`
  - `getLinks()`, `addLink(sourceId, targetId)`, `deleteLink(sourceId, targetId)`
  - `getParking()`, `parkNode(id)`, `restoreNode(id)`
  - `exportJSON()`, `importJSON(json)`
  - Auto-save: każda mutacja → `localStorage.setItem("cortex-data", JSON.stringify(state))`
- [ ] 6. Stwórz `src/seed.js` — dane startowe
  - Hardcode node'y z workspace_problem_x.md i MAPA_ROZUMIENIA.md (te same co w prototypie)
  - Hardcode połączenia między nimi
- [ ] 7. Punkt kontrolny — `store.getNodes()` zwraca dane, `addNode()` zapisuje do localStorage, reload → dane wracają

---

### Blok 3: Graf (D3.js)

- [ ] 8. Stwórz `src/graph.js` — inicjalizacja D3 force graph
  - SVG na pełny main area (window resize → re-render)
  - Force simulation: forceLink, forceManyBody, forceCenter, forceCollide
  - Renderuj node'y jako circle z kolorami/rozmiarami wg typu (constants.js)
  - Renderuj połączenia jako linie
  - Etykiety: typ (uppercase, mały) nad node'em, tytuł (skrócony do 30 znaków) w środku
- [ ] 9. Dodaj interakcje do grafu
  - Zoom: scroll → d3.zoom, scale 0.3–4
  - Pan: drag na tle → przesuwanie
  - Drag node: d3.drag z fixyką (fx/fy)
  - Hover: node brightness(1.15) + subtelny box-shadow
- [ ] 10. Dodaj kliknięcie na node → callback do panelu
  - `graph.onNodeClick(callback)` — panel module podłączy się tutaj
  - Klik na tło → zamknięcie panelu
- [ ] 11. Punkt kontrolny — graf wyświetla seed data, zoom/pan/drag działa, node'y mają poprawne kolory i rozmiary

---

### Blok 4: Panel boczny

- [ ] 12. Stwórz `src/panel.js` — panel szczegółów
  - `showPanel(node)` → slide-in z prawej (250ms ease-out)
  - Wyświetl: badge typu (kolorowy), tytuł, pełny tekst, data, lista połączeń
  - Każde połączenie klikalne → `showPanel(connectedNode)`
  - Przycisk zamknij (X) + klik poza panel = zamknij
- [ ] 13. Dodaj podświetlenie wybranego node'a na grafie
  - Wybrany node: stroke grubszy + accent color
  - Połączone node'y: pełna jasność
  - Reszta: opacity 0.2
  - Połączenia wybranego: accent color + grubsze
- [ ] 14. Punkt kontrolny — klik na node otwiera panel z danymi, klik na połączenie przeskakuje, podświetlenie działa

---

### Blok 5: Quick Add

- [ ] 15. Stwórz `src/quickadd.js` — bottom bar input
  - Input + type picker (5 przycisków: rozrzutka/[!]/aksjomat/pewnik/problem)
  - Enter → `store.addNode()` → `graph.addNode()` (animacja fade+scale 300ms)
  - Domyślny typ = rozrzutka
  - Ctrl+K → focus na input
- [ ] 16. Punkt kontrolny — wpisanie tekstu + enter dodaje node na graf, node animuje się, przetrwa reload

---

### Blok 6: Edycja i usuwanie

- [ ] 17. Dodaj edycję w panelu
  - Przycisk "Edytuj" → textarea zamiast tekstu
  - "Zapisz" → `store.updateNode()` → update label na grafie
  - Zmiana typu node'a → dropdown, update koloru/rozmiaru
- [ ] 18. Dodaj usuwanie
  - Przycisk "Usuń" → confirm dialog → `store.deleteNode()` → remove z grafu
  - Usuwanie kasuje też wszystkie połączenia tego node'a
- [ ] 19. Punkt kontrolny — edycja zmienia tekst i typ, usuwanie działa z potwierdzeniem

---

### Blok 7: Tworzenie połączeń

- [ ] 20. Dodaj tryb łączenia
  - Przycisk "Połącz" w panelu → tryb łączenia (kursor zmienia się)
  - Klik na drugi node → `store.addLink()` → rysuje linię
  - Duplikat → no-op
  - Escape → anuluj tryb
- [ ] 21. Dodaj usuwanie połączeń
  - Klik na linię połączenia → podświetl oba node'y + opcja "Usuń połączenie"
- [ ] 22. Punkt kontrolny — tworzenie i usuwanie połączeń działa, persystuje

---

### Blok 8: Filtrowanie i search

- [ ] 23. Stwórz `src/filter.js`
  - Toggle buttons w top bar: aksjomat / pewnik / przebłysk / rozrzutka / problem
  - Klik na filtr → reszta node'ów opacity 0.15 (200ms)
  - Wiele filtrów naraz (OR logic)
- [ ] 24. Dodaj search
  - Input w top bar → highlight pasujących node'ów (tytuł + pełny tekst)
  - Nie-pasujące → dim
  - Brak wyników → mały napis "Brak wyników"
- [ ] 25. Punkt kontrolny — filtrowanie po typach i search działają

---

### Blok 9: Parking

- [ ] 26. Stwórz `src/parking.js`
  - Przycisk "Parkuj" in panelu → node znika z grafu, wpada na listę
  - Widok parking: lista zaparkowanych (tytuł + data zaparkowania)
  - "Przywróć" → node wraca na graf (bez starych połączeń)
- [ ] 27. Punkt kontrolny — parkuj/przywróć działa, zaparkowane przetrwają reload

---

### Blok 10: Export/Import + Polish

- [ ] 28. Dodaj eksport/import
  - Przycisk "Eksportuj" → pobranie cortex-data.json
  - Przycisk "Importuj" → file input + confirm → nadpisanie bazy
- [ ] 29. Polish UI
  - Sprawdź wszystkie animacje (panel, node appear, hover, filter)
  - Sprawdź responsywność (min-width: 1024px, warning na mniejszych)
  - Sprawdź kolory — wszystko wg design.md palety
- [ ] 30. Punkt kontrolny końcowy — pełna aplikacja działa, wszystkie 8 wymagań spełnione
