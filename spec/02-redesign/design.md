# Design — 02 Redesign

## Przegląd

Przepisanie CSS + modyfikacja D3 renderingu żeby wygląd był profesjonalny-neutralny.

## Kluczowe zmiany

### 1. Node rendering (graph.js)

BYŁO:
```
circle: fill opacity 0.15, stroke colored, stroke-width 2-4px
```
MA BYĆ:
```
circle: fill SOLID kolor z lekką opacity (0.85), stroke CIEMNIEJSZY wariant koloru, stroke-width 1.5px
hover: brightness(1.15), subtle shadow (0 0 20px rgba(kolor, 0.3))
selected: stroke accent (#4f46e5), stroke-width 2.5px
```

Node'y mają wyglądać jak solidne, matowe kółka — nie jak neonowe pierścienie.

### 2. Rozmiary node'ów (constants.js)

AKTUALNIE za duże (45, 36, 32, 28, 24). Zmniejsz:
```
aksjomat: 22
pewnik: 18
przeblysk: 16
problem: 14
rozrzutka: 11
```

### 3. Linie połączeń (graph.js)

BYŁO: `stroke-width 4, opacity 0.4, color border`
MA BYĆ: `stroke-width 1, opacity 0.25, color #333`
Hover: `opacity 0.6, color accent`

### 4. Quick add (CSS + index.html)

Zamień `footer.bottom-bar` na floating element:
```css
.bottom-bar {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  height: auto;
  background: rgba(23, 23, 28, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 8px 12px;
  z-index: 100;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}
```
Usuń `border-top`. Quick add ma się unosić, nie dokować.

### 5. Collision radius (graph.js)

Zwiększ forceCollide radius żeby etykiety się nie nakładały:
```js
.force('collision', d3.forceCollide().radius(d => NODE_SIZES[d.type] + 40))
```

### 6. Tło grafu

Dodaj subtelny radial gradient lub dot pattern żeby graf nie był na płaskim czarnym:
```css
#graph-container {
  background: radial-gradient(circle at 50% 50%, #16161b 0%, #0f0f12 70%);
}
```

## Pliki do edycji

| Plik | Co zmienić |
|---|---|
| `src/style.css` | Redesign bottom-bar, node colors, graph background |
| `src/constants.js` | Nowe NODE_SIZES, nowe COLORS (fill vs stroke) |
| `src/graph.js` | Node rendering (fill solid, stroke subtle), link styling, collision |
