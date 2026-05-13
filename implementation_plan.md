# Przebudowa Cortex: Force Graph → Nieskończona Tablica

## Diagnoza: Dlaczego obecna apka nie działa

Obecny Cortex to **D3.js force-directed graph** — kulki latają po fizyce, a każde `setData()` klonuje wszystkie nody od nowa i restartuje symulację z `alpha=1`. Dlatego:
- **Każde połączenie/odłączenie resetuje pozycje** — bo cały graf się przelicza
- **Kulki "takie se"** — bo to abstrakcyjne kółka, a nie widoczne notatki z treścią
- **Brak kontroli nad układem** — bo o pozycjach decyduje fizyka, nie Ty

> [!CAUTION]
> To nie jest refactor — to wyburzenie fundamentu i postawienie nowego. D3 force simulation zostaje wyrzucona. Zachowujemy Vite + localStorage + ogólny data model.

---

## Granica: Co rozmowa definiuje vs. co odkłada na półkę

### ✅ Zabetonowane aksjomaty (budujemy teraz)

| # | Aksjomat | Źródło w rozmowie |
|---|---|---|
| 1 | **Nieskończona Tablica 2D** — pan & zoom, nie fizyka kulek | "lepsza nieskończona tablica" (L85) |
| 2 | **Widoczne notatki** — tytuł + podgląd treści, nie abstrakcyjne kółka | "notatki muszą być widoczne" (L84) |
| 3 | **User-placed pozycje** — przeciągnij i zostaw, nikt nie przesuwa | "juz teraz moge przesuwać wszystko" (L169) |
| 4 | **Modeless UI** — wszystko na raz, zero trybów | "nie powinny byc 2 tryby, tylko wszystko na raz" (L172-173) |
| 5 | **Tab → łączenie** — zachowujemy, działa | "aktualnie łączę notatki tabem" (L737) |
| 6 | **HUD** — skróty widoczne cały czas na ekranie | "UI napisane w widocznym miejscu cały czas" (L175) |
| 7 | **Quick Add** — szybkie łapanie rozrzutek z dołu ekranu | Zachowujemy z obecnej apki |
| 8 | **localStorage** — dane przeżywają reload | Zachowujemy z obecnej apki |
| 9 | **Semantic Zoom (szkielet)** — przy oddaleniu notatki się zmniejszają i pokazują mniej | "rozmiar adekwatny do zooma" (L85) |
| 10 | **Tworzenie notatki double-clickiem** | "Klikasz dwa razy w puste miejsce – tworzy się notatka" (L232) |

### 🚫 Odłożone na później (NIE budujemy teraz)

| Odłożone | Powód |
|---|---|
| AI Integration (Flash army, RAG, soczewki) | "narazie olejmy" (L815), "top level" |
| Syntetyczny mózg (pętle Flash A/B/C/D) | "oczywiście ten mózg co wspomniałem to całkowity poziom top" (L815) |
| ChromaDB / baza wektorowa | Zależna od danych, których jeszcze nie ma |
| Freehand drawing mode | Nie sprecyzowane, "tryb rysowania" wspomniany ale brak detali |
| Semantic Zoom — inteligentne podsumowania | "nie mogę zaplanować teraz bo musiałbym wiedzieć co dokładnie wrzucam" (L738) |
| Quick Capture daemon (hotkey z tła) | Osobna apka, nie ten build |
| Phone PWA | Osobna apka |
| GitHub export | "narazie można zachować jako idea" (L1167) |
| Context-Aware Tag Palette (MRU) | "to tylko potem" (L165) |
| Drag & drop obrazów z pulpitu | Faza 2 |
| Kategorie z auto-listą | "to tylko potem" (L165) |

---

## Proposed Changes

### Faza 1: Nowy fundament — Nieskończona Tablica

Wyrzucamy D3 force simulation. Budujemy od zera renderowanie SVG z ręcznym pan/zoom. Nody mają stałe pozycje X,Y zapisane w store.

---

### Store (Data Model)

#### [MODIFY] [store.js](file:///c:/Users/Ksawier/Pictures/Screenshots/BazaWiedzy_Cortex/cortex-app/src/store.js)

Rozszerzamy model noda o pozycje przestrzenne:

```diff
 const newNode = {
   id: node.id || crypto.randomUUID(),
   title: node.title || 'Bez tytułu',
   content: node.content || '',
   type: node.type || 'rozrzutka',
+  x: node.x ?? null,     // Pozycja na tablicy (null = auto-place)
+  y: node.y ?? null,
   createdAt: new Date().toISOString(),
 };
```

Dodajemy `updateNodePosition(id, x, y)` — lekki zapis bez pełnego `save()`.

#### [MODIFY] [constants.js](file:///c:/Users/Ksawier/Pictures/Screenshots/BazaWiedzy_Cortex/cortex-app/src/constants.js)

Nowe stałe dla notatek (wymiary kart, nie promienie kółek):

```diff
-export const NODE_SIZES = {
-  aksjomat: 22, pewnik: 18, przeblysk: 16, problem: 14, rozrzutka: 11
-};
+export const NOTE_SIZES = {
+  width: 240,
+  minHeight: 80,
+  maxHeight: 200,
+};
```

---

### Canvas (Silnik renderowania)

#### [DELETE] [graph.js](file:///c:/Users/Ksawier/Pictures/Screenshots/BazaWiedzy_Cortex/cortex-app/src/graph.js)

Cały moduł D3 force graph leci do kosza.

#### [NEW] [canvas.js](file:///c:/Users/Ksawier/Pictures/Screenshots/BazaWiedzy_Cortex/cortex-app/src/canvas.js)

Nowy silnik renderowania — Nieskończona Tablica:

- **Pan** — drag na tle przesuwa widok (transform translate)
- **Zoom** — scroll zmienia skalę (transform scale), wycentrowany na kursorze
- **Notatki jako karty** — SVG `foreignObject` z HTML w środku (tytuł + podgląd)
- **Drag notatki** — przesuwa ją, zapisuje X/Y do store. Żadna inna notatka się nie rusza.
- **Linie połączeń** — SVG `<line>` między kartami, bez fizyki
- **Double-click na tle** — tworzy nową notatkę w tym punkcie
- **Semantic zoom szkielet** — przy zoom < 0.5 karty pokazują tylko tytuł, przy < 0.3 tylko kolorową kropkę z literą

Technologia: **SVG** (nie Canvas2D) — daje nam klikalne elementy bez hit-testingu.

---

### UI Layer

#### [MODIFY] [index.html](file:///c:/Users/Ksawier/Pictures/Screenshots/BazaWiedzy_Cortex/cortex-app/index.html)

- Usuwamy stary side panel (zastąpimy go inline edit bezpośrednio na karcie + lekkim panelem)
- Dodajemy **HUD** — stały mini-panel w rogu z listą skrótów
- Zachowujemy Quick Add bar na dole
- Upraszczamy top bar (usuwamy filtry typu — na tablicy widzisz wszystko naraz)

#### [MODIFY] [style.css](file:///c:/Users/Ksawier/Pictures/Screenshots/BazaWiedzy_Cortex/cortex-app/src/style.css)

Przepisujemy style na:
- **Karty notatek** — zaokrąglone prostokąty z subtelnym cieniem, kolorowy pasek boczny wg typu
- **Animacje** — smooth pan/zoom, hover glow, tworzenie karty (scale-in)
- **HUD** — półprzezroczysty, stały w lewym dolnym rogu
- Zachowujemy design system (paleta kolorów, Inter, dark mode)

#### [MODIFY] [main.js](file:///c:/Users/Ksawier/Pictures/Screenshots/BazaWiedzy_Cortex/cortex-app/src/main.js)

Przepinamy z `graph` na `canvas`. Upraszczamy event wiring.

#### [NEW] [notecard.js](file:///c:/Users/Ksawier/Pictures/Screenshots/BazaWiedzy_Cortex/cortex-app/src/notecard.js)

Komponent karty notatki:
- Renderuje HTML wewnątrz SVG foreignObject
- Kolorowy pasek boczny wg typu
- Tytuł (bold) + content preview (2-3 linie, truncated)
- Hover: subtelny glow
- Click: otwiera panel edycji (lub inline edit)
- Rezizowanie (drag za róg → zmiana rozmiaru karty)

#### [MODIFY] [panel.js](file:///c:/Users/Ksawier/Pictures/Screenshots/BazaWiedzy_Cortex/cortex-app/src/panel.js)

Uproszczony panel — teraz służy głównie do edycji (textarea na content, zmiana typu, lista połączeń). Otwiera się kliknięciem na kartę.

---

### Moduły do zachowania (z minimalnymi zmianami)

#### [MODIFY] [quickadd.js](file:///c:/Users/Ksawier/Pictures/Screenshots/BazaWiedzy_Cortex/cortex-app/src/quickadd.js)

Zachowujemy logikę, ale nowy node dostaje pozycję:
- Jeśli zoom jest blisko widoku → wstaw na środku widocznego obszaru
- Drobne przesunięcie losowe żeby się nie nakładały

#### [KEEP] [filter.js](file:///c:/Users/Ksawier/Pictures/Screenshots/BazaWiedzy_Cortex/cortex-app/src/filter.js)

Zachowujemy search. Filtry po typie mogą zostać (opcjonalnie).

#### [KEEP] [parking.js](file:///c:/Users/Ksawier/Pictures/Screenshots/BazaWiedzy_Cortex/cortex-app/src/parking.js)

Bez zmian.

#### [MODIFY] [seed.js](file:///c:/Users/Ksawier/Pictures/Screenshots/BazaWiedzy_Cortex/cortex-app/src/seed.js)

Dodajemy X, Y do seed data (rozłożone w siatce).

---

## Architektura po przebudowie

```mermaid
graph TD
    UI[HTML/CSS Layer] --> CV[Canvas Module - SVG pan/zoom]
    UI --> NC[Notecard Component]
    UI --> PA[Panel Module - edycja]
    UI --> QA[Quick Add]
    UI --> HUD[HUD - skróty]
    CV --> DS[Data Store - localStorage]
    NC --> DS
    PA --> DS
    QA --> DS
    DS --> SEED[Seed Data]
```

## Open Questions

> [!IMPORTANT]
> **Side panel vs. inline edit?**
> Rozmowa mówi "klikasz dwa razy w puste miejsce — tworzy się notatka". Ale co z edycją istniejącej? Dwie opcje:
> - **A:** Zachowujemy side panel (klik na kartę → otwiera panel po prawej z pełną treścią i opcjami)
> - **B:** Inline edit — double-click na kartę zamienia ją w textarea bezpośrednio na tablicy
> 
> Rekomenduję **A+B hybrid**: single click = side panel (podgląd + połączenia), double click na tytuł/treść = inline edit bezpośrednio na karcie.

> [!IMPORTANT]
> **Rezisowanie kart?**
> Rozmowa mówi o "powiększaniu/zmniejszaniu notatek na zawołanie" (L175). Czy to priorytet na Fazę 1, czy wystarczy fixed-size karty z auto-scroll na treść?

---

## Verification Plan

### Automated Tests
1. `npm run dev` → apka się odpala bez crashy
2. Otwórz w przeglądarce → widoczne karty z treścią (nie kółka)
3. Scroll → zoom działa (płynnie, centrowany na kursorze)
4. Drag kartę → zostaje na miejscu po puszczeniu
5. Reload → pozycje kart zachowane (localStorage)
6. Double-click na tle → nowa karta w tym punkcie
7. Tab → tryb łączenia → klik karta A → klik karta B → linia
8. Quick Add (Enter) → nowa karta na widocznym obszarze

### Manual Verification
- Sprawdzić wizualnie czy notatki są **widoczne** (tytuł + treść) a nie abstrakcyjne kulki
- Sprawdzić czy connect/disconnect **NIE resetuje** pozycji innych kart
- Sprawdzić czy HUD jest czytelny i nieinwazyjny
