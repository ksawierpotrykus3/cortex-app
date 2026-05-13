# Dokument Wymagań — 03 Interakcje grafu

## Wprowadzenie

Dopracowanie interakcji na grafie: podświetlenie sąsiedztwa po kliknięciu, zamknięcie panelu na klik tła, Tab linking mode (ciągły tryb łączenia). Bazuje na wymaganiach 2.4, 6.1-6.4 z oryginalnych requirements.

---

## Wymaganie I1: Podświetlenie sąsiedztwa (neighborhood highlight)

**User Story:** Jako użytkownik, chcę żeby po kliknięciu na node widzieć TYLKO jego bezpośrednie połączenia wyraźnie, a reszta się przyciemniła.

### Kryteria akceptacji

1. WHEN użytkownik kliknie na node THEN THE System SHALL:
   - Podświetlić wybrany node (stroke accent, jasniejszy fill)
   - Podświetlić bezpośrednio połączone node'y (pełna jasność)
   - Podświetlić linie między nimi (accent color, grubsze)
   - Przyciemnić RESZTĘ node'ów i linii (opacity 0.12)
2. WHEN użytkownik kliknie na tło THEN THE System SHALL przywrócić pełną jasność wszystkim node'om i zamknąć panel.
3. Animacja przejścia: 200ms ease-out.

---

## Wymaganie I2: Tab Linking Mode (ciągły tryb łączenia)

**User Story:** Jako użytkownik, chcę szybko łączyć wiele node'ów po kolei bez zamykania trybu łączenia.

### Kryteria akceptacji

1. WHEN użytkownik naciśnie Tab THEN THE System SHALL włączyć tryb ciągłego łączenia.
2. WHEN tryb jest aktywny THEN kursor SHALL zmienić się na crosshair.
3. WHEN użytkownik kliknie node A, potem node B THEN THE System SHALL utworzyć połączenie A→B.
4. WHEN połączenie jest utworzone THEN B staje się nowym źródłem — klik na C → łączy B→C (chainowanie).
5. WHEN użytkownik naciśnie Tab ponownie LUB Escape THEN THE System SHALL wyłączyć tryb.
6. WHEN tryb jest aktywny THEN THE System SHALL wyświetlić widoczny indicator (np. "TRYB ŁĄCZENIA" w top bar).

---

## Wymaganie I3: Klik na tło zamyka panel

**User Story:** Jako użytkownik, chcę zamknąć panel klikając gdziekolwiek na tle grafu.

### Kryteria akceptacji

1. WHEN użytkownik kliknie na puste tło SVG (nie na node ani linię) THEN THE System SHALL zamknąć panel boczny.
2. WHEN panel jest zamknięty THEN neighborhood highlight SHALL zostać usunięty.
3. IF tryb łączenia jest aktywny THEN klik na tło SHALL NIE zamykać trybu.
