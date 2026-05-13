# Design — 01 Bugfix

## Przegląd

Minimalne zmiany — napraw crashe, nic więcej. Zero zmiany designu.

## Pliki do edycji

| Plik | Co zmienić |
|---|---|
| `index.html` | Dodaj `#batch-actions` div (linie ~88, przed zamknięciem `#app`) |
| `src/graph.js` | Dodaj import store ALBO usuń contextmenu delete |
| `src/seed.js` | Dodaj `createdAt` do wszystkich node'ów |
| `src/store.js` | Usuń `location.reload()` z `importData()` |
| `src/panel.js` | Fallback na brak `createdAt` |

## Batch actions HTML (dodać do index.html)

```html
<div id="batch-actions" class="hidden">
  <span id="batch-count">0 zaznaczonych</span>
  <button id="batch-delete-nodes" class="batch-btn danger">Usuń kropki</button>
  <button id="batch-delete-links" class="batch-btn">Usuń połączenia</button>
  <button id="batch-cancel" class="batch-btn">Anuluj</button>
</div>
```

CSS dla tego istnieje już w `style.css` (linie 455-496).

## Decyzja: contextmenu na node

Aktualnie prawy klik = instant delete bez potwierdzenia. To jest niebezpieczne.
**Zmień na:** prawy klik na node = otwórz panel (tak samo jak lewy klik). Usuwanie TYLKO przez panel z potwierdzeniem.
