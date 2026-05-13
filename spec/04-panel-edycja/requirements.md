# Dokument Wymagań — 04 Panel i edycja

## Wprowadzenie

Dopracowanie panelu bocznego: zmiana typu node'a (dropdown), lepsza edycja, usuwanie z potwierdzeniem. Bazuje na wymaganiach 5.1-5.5 z oryginalnych requirements.

---

## Wymaganie E1: Zmiana typu node'a

**User Story:** Jako użytkownik, chcę zmienić typ node'a (np. rozrzutka → aksjomat) bezpośrednio w panelu.

### Kryteria akceptacji

1. WHEN panel jest w trybie edycji THEN THE System SHALL wyświetlić dropdown z 5 typami obok badge'a typu.
2. WHEN użytkownik zmieni typ w dropdown THEN THE System SHALL zaktualizować typ w store.
3. WHEN typ jest zmieniony THEN graf SHALL natychmiast odzwierciedlić nowy kolor i rozmiar.

---

## Wymaganie E2: Edycja tytułu inline

**User Story:** Jako użytkownik, chcę edytować tytuł node'a bezpośrednio (klik → input) bez wciskania "Edytuj".

### Kryteria akceptacji

1. WHEN użytkownik double-kliknie na tytuł w panelu THEN THE System SHALL zamienić go na input.
2. WHEN użytkownik naciśnie Enter lub kliknie poza input THEN THE System SHALL zapisać zmianę.
3. WHEN tytuł jest zmieniony THEN etykieta na grafie SHALL się zaktualizować.

---

## Wymaganie E3: Usuwanie połączeń z panelu

**User Story:** Jako użytkownik, chcę usunąć połączenie bezpośrednio z listy połączeń w panelu.

### Kryteria akceptacji

1. WHEN użytkownik hoveruje na połączenie w panelu THEN THE System SHALL pokazać ikonę X po prawej stronie.
2. WHEN użytkownik kliknie X THEN THE System SHALL usunąć połączenie (bez confirm — to nie jest destrukcyjne na poziomie node'a).
3. WHEN połączenie jest usunięte THEN graf SHALL się zaktualizować natychmiast.
