# Design — 05 Batch Operations

## Przegląd

Logika multi-select ISTNIEJE już w `graph.js` (toggleSelection, getSelectedNodes, clearSelection) i `main.js` (batch event listeners). Problem jest TYLKO w tym że HTML elementów brakowało (naprawione w 01-bugfix).

Po 01-bugfix, batch ops powinny działać out of the box. Ten spec to dopracowanie UX.

## Co dopracować

### 1. Visual feedback zaznaczenia

Aktualnie: `.node-container.selected circle` ma `stroke: var(--selected), stroke-width: 4px`. OK ale za gruby.

Zmień na:
```css
.node-container.selected circle {
  stroke: var(--accent) !important;
  stroke-width: 2.5px !important;
  stroke-dasharray: 4 2;
  animation: pulse-select 1.5s ease-in-out infinite;
}

@keyframes pulse-select {
  0%, 100% { stroke-opacity: 1; }
  50% { stroke-opacity: 0.5; }
}
```

### 2. Batch panel styling

Batch panel (`#batch-actions`) ma styl w CSS ale jest za duży. Zmniejsz:
- Padding: 8px 16px
- Font-size: 12px
- Border-radius: 10px
- Pozycja: bottom 80px (nad quick add)

### 3. Escape to clear

Dodaj: Escape → `graph.clearSelection()` (gdy batch panel jest widoczny).

## Pliki do edycji

| Plik | Co |
|---|---|
| `src/style.css` | Poprawa stylu selected nodes i batch panel |
| `src/main.js` | Escape listener dla clearing selection |
