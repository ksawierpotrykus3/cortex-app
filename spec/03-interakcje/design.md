# Design — 03 Interakcje grafu

## Neighborhood Highlight

W `graph.js` dodaj metodę `highlightNeighborhood(nodeId)`:
1. Pobierz listę connectedIds z linków
2. Ustaw opacity 0.12 na WSZYSTKICH node'ach i linkach
3. Przywróć pełną opacity na: wybranym node, connectedIds, linkach między nimi
4. Wybrany node: stroke accent, stroke-width 2.5
5. Transition: 200ms

Metoda `clearHighlight()` — przywróć wszystko do opacity 1.

Wywołanie: `graph.onNodeClick` → `highlightNeighborhood(node.id)` + `panel.show(node)`
Klik na tło SVG → `clearHighlight()` + `panel.hide()`

## Tab Linking Mode

Aktualnie `panel.js` obsługuje Tab → linking mode. To działa, ale:
1. Brakuje wizualnego indicatora — dodaj CSS class `.linking-mode` na `<body>` → kursor crosshair
2. Dodaj floating indicator: "🔗 TRYB ŁĄCZENIA — klikaj node'y (Tab/Esc aby wyjść)"
3. Indicator pozycjonowany: `position: fixed; top: var(--top-bar-h) + 8px; left: 50%; transform: translateX(-50%)`

## Klik na tło

W `graph.js`, dodaj event listener na SVG:
```js
this.svg.on('click', (event) => {
  if (event.target === this.svg.node()) {
    this.clearHighlight();
    if (this.onBackgroundClickCallback) this.onBackgroundClickCallback();
  }
});
```

W `main.js`, podłącz:
```js
graph.onBackgroundClick(() => panel.hide());
```

## Pliki do edycji

| Plik | Co |
|---|---|
| `src/graph.js` | highlightNeighborhood, clearHighlight, SVG background click, onBackgroundClick |
| `src/panel.js` | Tab linking indicator |
| `src/main.js` | Podłączenie background click → panel.hide |
| `src/style.css` | Styl dla linking indicator |
