# Plan Implementacji — 02 Redesign

## Przegląd

Najpierw CSS, potem constants, potem graph.js. Testuj po każdym kroku.

## Zadania

---

### Blok 1: CSS redesign

- [ ] 1. Zmień `style.css` — bottom bar na floating
  - Zamień `.bottom-bar` na `position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);`
  - Dodaj `backdrop-filter: blur(12px); border-radius: 14px; box-shadow`
  - Usuń `border-top`, `height: var(--bottom-bar-h)`
  - Quick add container: `width: auto; max-width: 550px;`
  - Zmień `<footer>` na `<div>` w index.html (footer semantycznie nie pasuje do floating)

- [ ] 2. Zmień `style.css` — tło grafu
  - Dodaj `radial-gradient` do `#graph-container`
  - Opcjonalnie: subtelny dot pattern z CSS repeating-radial-gradient

- [ ] 3. Punkt kontrolny — quick add unosi się, tło ma gradient, layout wygląda czysto

---

### Blok 2: Node redesign

- [ ] 4. Zmień `constants.js` — nowe rozmiary
  - `aksjomat: 22, pewnik: 18, przeblysk: 16, problem: 14, rozrzutka: 11`

- [ ] 5. Zmień `graph.js` — node rendering
  - Circle fill: solid kolor z opacity 0.85 (nie 0.15)
  - Circle stroke: ciemniejszy wariant koloru, 1.5px
  - Hover: `brightness(1.15)` + `drop-shadow`
  - Selected: stroke accent, 2.5px
  - Label type: 8px, opacity 0.7
  - Label title: zachowaj 11px, kolor `--text-secondary`

- [ ] 6. Zmień `graph.js` — linie połączeń
  - `stroke-width: 1, stroke-opacity: 0.25, stroke: #333`
  - Hover: `stroke-opacity: 0.6, stroke: accent`
  - Zmniejsz grubość linii contextmenu z 4 na 1

- [ ] 7. Zmień collision radius
  - `forceCollide().radius(d => NODE_SIZES[d.type] + 40)`

- [ ] 8. Punkt kontrolny — node'y wyglądają jak solidne matowe kółka, etykiety czytelne i nie nakładają się, linie subtelne, hover działa z brightness

---

### Blok 3: Panel fixes

- [ ] 9. Upewnij się że panel jest schowany na starcie
  - `index.html`: `<aside id="side-panel" class="side-panel hidden">` — sprawdź czy `hidden` jest
  - Klik na tło SVG → `panel.hide()` (sprawdź czy to działa)

- [ ] 10. Punkt kontrolny końcowy — cała apka wygląda profesjonalnie, zero neonów, quick add floating, panel schowany na starcie
