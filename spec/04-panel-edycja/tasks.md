# Plan Implementacji — 04 Panel i edycja

## Przegląd

Zależy od 01-bugfix. Może być robione równolegle z 02-redesign.

## Zadania

---

### Blok 1: Zmiana typu

- [ ] 1. Dodaj dropdown typu do trybu edycji w `panel.js`
  - W `toggleEdit()` → obok badge'a wstaw `<select>` z 5 opcjami
  - Przy zapisie: pobierz `document.getElementById('edit-type').value`
  - `store.updateNode(id, { type })` → `graph.setData(...)`

- [ ] 2. Punkt kontrolny — zmiana typu w panelu zmienia kolor i rozmiar na grafie

---

### Blok 2: Inline edit i usuwanie połączeń

- [ ] 3. Dodaj inline edit tytułu
  - Double click na `#panel-title` → zamień na input
  - Enter/blur → zapisz, Escape → anuluj

- [ ] 4. Dodaj przycisk usuwania połączeń
  - W `renderConnections()`: dodaj `×` button na każdym `<li>`
  - Click → `store.deleteLink()` → re-render panel + graf

- [ ] 5. Punkt kontrolny — double click edytuje tytuł, X usuwa połączenie, graf się aktualizuje
