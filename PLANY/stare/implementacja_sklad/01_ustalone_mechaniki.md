# Zmiany do zrobienia — Implementacja SKŁAD

> Co będzie zrobione w kodzie. Aktualizowane na bieżąco.

---

## 1. Tab/Tylda — tworzenie połączonej notatki

**Plik:** `src/components/NexusCanvas.tsx`

Masz wybrany nod, wciskasz `Tab` lub `~`:
- Tworzy się nowy nod obok wybranego
- Automatycznie powstaje link między nimi
- Piszesz nową notatkę
- Opcjonalnie dopisujesz powód połączenia (nie musisz)

---

## 2. `reason` na linkach

**Plik:** `src/types.ts` → `NexusLink`

Dodanie pola `reason?: string` do interfejsu `NexusLink`. Powód jest wyświetlany jako tekst BEZPOŚREDNIO NA LINII łączącej — nie w popupie, nie w tooltipie. Patrzysz na canvas i widzisz relacje bez klikania.

---

## 3. Nowy design linii łączących

**Pliki:** `src/components/NexusCanvas.tsx`, `src/index.css`

Całkowita zmiana wyglądu linii między nodami. Linie muszą:
- Wyświetlać tekst powodu (`reason`) bezpośrednio na sobie
- Mieć nowy wygląd (obecny design do wyrzucenia)
- Klik na linię = usunięcie (zachowane)

---

## 4. Przestrzeń badawcza (Obserwatorium / robocza nazwa)

**Nowy widok w Nexusie.** Osobna przestrzeń (nie projekt na canvasie) do:
- Zbierania obserwacji o sobie — jak myślę, jak reaguję, w jakich sytuacjach potrzebuję jakiej funkcji
- Szybkiego zapisywania gdy coś się przypomni — wpis w sekundach
- Kumulowania danych z których POTEM (nie z góry) wynikają kategorie, wzorce, zasady
- NIE może być: listą luźnych chaotycznych tekstów, ścianą tekstu do czytania, nerdowskim narzędziem

**Design:** Czuć respekt. Jak narzędzie faktycznego badacza. Ktokolwiek spojrzy — widzi coś poważnego. Szczegóły designu do zaprojektowania (mockup).

**Pliki:** Nowy komponent, nowy ViewMode, zmiany w `App.tsx`, `TopNavigation.tsx`, `types.ts`

---

## ~~`parentId` na nodach~~ — ODRZUCONE

Myśli nie są drzewem — są siecią. `parentId` narzuca sztywną hierarchię jednego rodzica. Struktura ma wynikać z linków i ich powodów, nie z parent-child.

---

## Status

| Zmiana | Status |
|--------|--------|
| Tab/~ tworzenie połączonej notatki | ⬜ Do zrobienia |
| `reason` na NexusLink | ⬜ Do zrobienia |
| Nowy design linii (z tekstem na linii) | ⬜ Do zrobienia |
| Przestrzeń badawcza (koncept + design) | ⬜ Do zaprojektowania |
| ~~parentId na NexusNode~~ | ❌ Odrzucone |
