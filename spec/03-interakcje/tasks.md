# Plan Implementacji — 03 Interakcje grafu

## Przegląd

Zależy od 01-bugfix i 02-redesign. Rób PO nich.

## Zadania

---

### Blok 1: Neighborhood highlight

- [ ] 1. Dodaj `highlightNeighborhood(nodeId)` do `graph.js`
  - Pobierz connectedIds z `this.data.links`
  - Transition 200ms: node'y nie w sąsiedztwie → opacity 0.12
  - Wybrany node → stroke accent, stroke-width 2.5
  - Linki w sąsiedztwie → accent color, opacity 0.6
  - Linki poza → opacity 0.05

- [ ] 2. Dodaj `clearHighlight()` do `graph.js`
  - Przywróć wszystko do opacity 1, domyślne stroki

- [ ] 3. Podłącz w `main.js`:
  - `graph.onNodeClick` → `graph.highlightNeighborhood(node.id)` + `panel.show(node)`

- [ ] 4. Punkt kontrolny — klik na node przyciemnia resztę, widać tylko sąsiedztwo

---

### Blok 2: Background click

- [ ] 5. Dodaj klik na tło SVG w `graph.js`
  - Listener na svg: klik gdzie target === svg → callback
  - `graph.onBackgroundClick(callback)`

- [ ] 6. Podłącz w `main.js`:
  - `graph.onBackgroundClick(() => { graph.clearHighlight(); panel.hide(); })`

- [ ] 7. Punkt kontrolny — klik na tło zamyka panel i przywraca pełny graf

---

### Blok 3: Tab Linking indicator

- [ ] 8. Dodaj visual indicator dla Tab linking mode
  - CSS: `.linking-indicator` — fixed, top bar + 8px, centered, accent color bg, rounded
  - W `panel.js` `startLinking()`: dodaj element do DOM
  - W `panel.js` `cancelLinking()`: usuń element

- [ ] 9. Punkt kontrolny — Tab włącza tryb z widocznym indicatorem, node'y się linkują, Tab/Esc wyłącza
