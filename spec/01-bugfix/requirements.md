# Dokument Wymagań — 01 Bugfix

## Wprowadzenie

Napraw wszystkie aktualne crashe i błędy w Cortex które powstały podczas pierwszej rundy kodowania (Flash). Apka się odpala ale ma JS errory i broken features.

## Słownik

- **Batch actions** — panel do masowych operacji (multi-select + delete/unlink). Istnieje w JS ale nie w HTML.

---

## Wymaganie B1: Crash main.js — brakujące elementy HTML

**User Story:** Jako użytkownik, chcę żeby aplikacja się ładowała bez błędów w konsoli.

### Kryteria akceptacji

1. WHEN aplikacja się ładuje THEN THE System SHALL nie wyrzucać żadnych TypeError w konsoli.
2. IF element DOM nie istnieje THEN THE System SHALL nie rejestrować na nim event listenerów.

### Aktualny bug

`main.js:62` — `document.getElementById('batch-cancel').addEventListener('click', ...)` → **null** bo `batch-actions`, `batch-count`, `batch-cancel`, `batch-delete-nodes`, `batch-delete-links` NIE ISTNIEJĄ w `index.html`.

### Fix

Dodaj brakujący HTML blok `#batch-actions` do `index.html` (floating bar na dole, domyślnie ukryty) LUB przenieś batch logic do osobnego modułu i zainicjuj WARUNKOWO.

---

## Wymaganie B2: Crash graph.js — brakujący import store

**User Story:** Jako użytkownik, chcę żeby prawy klik na node nie crashował apki.

### Kryteria akceptacji

1. WHEN użytkownik kliknie prawym na node THEN THE System SHALL usunąć node BEZ ReferenceError.

### Aktualny bug

`graph.js:111` — `store.deleteNode(d.id)` — `store` nie jest importowane w graph.js. Prawy klik na node = crash.

### Fix

Dodaj `import { store } from './store.js';` na górze graph.js. ALBO lepiej: usuń bezpośrednie delete z contextmenu (zbyt łatwo przypadkiem usunąć) i zamień na otwieranie panelu z opcją usuwania.

---

## Wymaganie B3: Invalid Date w seed data

**User Story:** Jako użytkownik, chcę widzieć poprawne daty w panelu dla seed node'ów.

### Kryteria akceptacji

1. WHEN panel wyświetla datę node'a THEN THE System SHALL pokazać poprawną datę, nigdy "Invalid Date".

### Aktualny bug

`seed.js` — node'y nie mają pola `createdAt`. Panel (`panel.js:70`) robi `new Date(node.createdAt).toLocaleDateString()` → "Invalid Date".

### Fix

Dodaj `createdAt: new Date().toISOString()` do każdego node'a w seed.js. ALBO w panel.js: `node.createdAt ? new Date(node.createdAt).toLocaleDateString('pl-PL') : 'Dane startowe'`.

---

## Wymaganie B4: importData reload loop

**User Story:** Jako użytkownik, chcę żeby pierwsze ładowanie nie triggerowało dziwnego reload.

### Kryteria akceptacji

1. WHEN seed data jest importowane THEN THE System SHALL wyrenderować graf bez reloadu strony.

### Aktualny bug

`store.js:126` — `importData()` robi `location.reload()`. Przy pierwszym ładowaniu (puste localStorage → seed import) to powoduje reload. Nie jest to crash ale jest zbędne.

### Fix

Usuń `location.reload()` z `importData()`. Zamiast tego: po imporcie, graf powinien się odświeżyć przez `graph.setData()`.
