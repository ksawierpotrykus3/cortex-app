# Plan Implementacji — 01 Bugfix

## Przegląd

4 bugi, każdy niezależny. Zrób po kolei, testuj po każdym.

## Zadania

---

### Blok 1: Fix crashe

- [ ] 1. Dodaj brakujący `#batch-actions` HTML do `index.html`
  - Wstaw div z id `batch-actions`, `batch-count`, `batch-delete-nodes`, `batch-delete-links`, `batch-cancel`
  - Umieść PRZED zamknięciem `</div>` (zamykającym `#app`), za `#parking-view`
  - Klasa domyślna: `hidden`

- [ ] 2. Napraw `graph.js` contextmenu
  - Dodaj `import { store } from './store.js';` na górze
  - Zamień contextmenu handler na node (linia 109-113): zamiast instant delete → wywołaj `this.onNodeClickCallback(d)` (otwórz panel)
  - Zachowaj `event.preventDefault()` żeby nie pokazywał się menu przeglądarki

- [ ] 3. Napraw daty w seed data
  - `seed.js`: dodaj `createdAt: '2026-05-08T00:00:00.000Z'` do KAŻDEGO node'a
  - `panel.js` linia 70: dodaj fallback: `node.createdAt ? new Date(node.createdAt).toLocaleDateString('pl-PL') : 'Dane startowe'`

- [ ] 4. Usuń reload z importData
  - `store.js` linia 126: usuń `location.reload();`
  - W `main.js` po `store.importData(SEED_DATA)`: NIE rób reload, po prostu kontynuuj do `graph.setData()`

- [ ] 5. Punkt kontrolny — `npm run dev`, zero błędów w konsoli, graf się ładuje, klik na node otwiera panel z poprawną datą, prawy klik otwiera panel zamiast kasować
