# Design — 04 Panel i edycja

## Zmiana typu

W trybie edycji, badge typu zamienia się na `<select>`:
```html
<select id="edit-type">
  <option value="rozrzutka">Rozrzutka</option>
  <option value="przeblysk">Przebłysk</option>
  <option value="aksjomat">Aksjomat</option>
  <option value="pewnik">Pewnik</option>
  <option value="problem">Problem</option>
</select>
```

Style selecta: background surface, border, rounded, kolor typu jako accent-left-border.

Po zapisie: `store.updateNode(id, { type: newType })` → `graph.setData(...)`.

## Inline edit tytułu

Double click na `#panel-title`:
1. Zamień `<h2>` na `<input type="text">`
2. Enter → zapisz
3. Blur → zapisz
4. Escape → anuluj (przywróć stary tekst)

## Usuwanie połączeń

W `renderConnections()`, każdy `<li>` dostaje:
```html
<li>
  <span class="conn-title">Tytuł połączonego</span>
  <button class="conn-remove" title="Usuń połączenie">×</button>
</li>
```

CSS: `.conn-remove` ukryty, `.connections-list li:hover .conn-remove` widoczny.
Click → `store.deleteLink(currentNodeId, connectedId)` → re-render.

## Pliki do edycji

| Plik | Co |
|---|---|
| `src/panel.js` | Dropdown typu, inline edit tytułu, delete connection button |
| `src/style.css` | Style selecta, conn-remove hover |
