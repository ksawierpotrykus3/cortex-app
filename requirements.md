# Dokument Wymagań — Cortex

## Wprowadzenie

Cortex to lokalna web aplikacja (Vite + vanilla JS) do wizualizacji osobistej bazy wiedzy jako interaktywnego grafu. Użytkownik ma wiedzę rozproszoną w plikach .md — aksjomaty, przebłyski, rozrzutki, pewniki, otwarte problemy. Cortex łączy je w sieć, pokazuje 100% ogólnego obrazu na jednym ekranie i pozwala szybko dodawać nowe elementy. Zero chmury, zero kont, localhost.

## Słownik

- **Node** — pojedynczy element wiedzy (aksjomat, przebłysk, rozrzutka, pewnik, problem)
- **Aksjomat** — coś co użytkownik uważa za absolutną pewność. Niepodważalne.
- **Przebłysk [!]** — nagły insight, coś ważne co trzeba złapać zanim zniknie
- **Rozrzutka** — luźna myśl, pomysł, obserwacja. Może się połączyć z czymś albo nie.
- **Pewnik** — potwierdzona prawda, zweryfikowana przez doświadczenie
- **Problem** — otwarta dziura, pytanie bez odpowiedzi
- **Połączenie** — relacja między dwoma node'ami (semantyczna, nie hierarchiczna)
- **Parking** — magazyn na rzeczy "nie-teraz" — node'y które nie pasują do aktualnego problemu ale będą potrzebne

---

## Wymaganie 1: Graf wiedzy (widok główny)

**User Story:** Jako użytkownik, chcę widzieć wszystkie moje node'y jako interaktywny graf na jednym ekranie, żeby mieć 100% ogólnego obrazu bez czytania plików.

### Kryteria akceptacji

1. WHEN aplikacja się ładuje THEN THE System SHALL wyświetlić graf ze wszystkimi node'ami i połączeniami.
2. WHEN użytkownik scrolluje THEN THE System SHALL zoomować graf (scroll = zoom in/out).
3. WHEN użytkownik przeciąga node THEN THE System SHALL przesuwać go z fizyką (inne node'y reagują).
4. WHEN użytkownik przeciąga tło THEN THE System SHALL pannować cały graf.
5. WHEN graf ma więcej niż 50 node'ów THEN THE System SHALL zachować płynność 60fps.
6. Node'y MUSZĄ mieć różne kolory i rozmiary wg typu (aksjomat > pewnik > przebłysk > problem > rozrzutka).
7. Połączenia MUSZĄ być widoczne jako linie między node'ami.

---

## Wymaganie 2: Panel szczegółów

**User Story:** Jako użytkownik, chcę kliknąć na node i zobaczyć jego pełną treść + połączenia, żeby zrozumieć kontekst bez otwierania pliku.

### Kryteria akceptacji

1. WHEN użytkownik kliknie na node THEN THE System SHALL otworzyć panel boczny z: typem, tytułem, pełnym tekstem, datą, listą połączonych node'ów.
2. WHEN użytkownik kliknie na połączony node w panelu THEN THE System SHALL przejść do tego node'a (focus + otworzyć jego panel).
3. WHEN użytkownik kliknie X lub kliknie poza panel THEN THE System SHALL zamknąć panel.
4. WHEN panel jest otwarty THEN THE System SHALL podświetlić wybrany node i jego połączenia na grafie.
5. IF node nie ma treści THEN THE System SHALL wyświetlić placeholder "Brak opisu".

---

## Wymaganie 3: Szybkie dodawanie (Quick Add)

**User Story:** Jako użytkownik, chcę dodać nowy node w 3 sekundy (wpisać tekst + enter), żeby złapać rozrzutkę zanim zniknie.

### Kryteria akceptacji

1. WHEN użytkownik wpisze tekst w input na górze i naciśnie Enter THEN THE System SHALL utworzyć nowy node z automatycznym timestampem.
2. WHEN użytkownik wybierze typ (rozrzutka/przebłysk/aksjomat/pewnik/problem) THEN THE System SHALL oznaczyć node wybranym typem.
3. WHEN nowy node zostanie dodany THEN THE System SHALL animować jego pojawienie się na grafie (fade in + physics settle).
4. WHEN input jest pusty i użytkownik naciśnie Enter THEN THE System SHALL nic nie robić (no-op).
5. Domyślny typ = rozrzutka. Skrót klawiszowy: Ctrl+K → focus na input.

---

## Wymaganie 4: Persystencja danych (localStorage)

**User Story:** Jako użytkownik, chcę żeby moje node'y i połączenia przetrwały zamknięcie przeglądarki, żeby nie stracić pracy.

### Kryteria akceptacji

1. WHEN użytkownik doda/edytuje/usunie node THEN THE System SHALL zapisać stan do localStorage w ciągu 500ms.
2. WHEN aplikacja się ładuje THEN THE System SHALL odczytać dane z localStorage i odtworzyć graf.
3. WHEN localStorage jest puste THEN THE System SHALL załadować dane startowe (seed data z istniejących plików .md).
4. IF localStorage przekroczy 5MB THEN THE System SHALL ostrzec użytkownika.
5. WHEN użytkownik kliknie "Eksportuj" THEN THE System SHALL pobrać plik cortex-data.json z całą bazą.
6. WHEN użytkownik załaduje plik JSON THEN THE System SHALL nadpisać bazę zaimportowanymi danymi (z potwierdzeniem).

---

## Wymaganie 5: Edycja i usuwanie node'ów

**User Story:** Jako użytkownik, chcę edytować treść node'a i usuwać niepotrzebne, żeby baza była czysta.

### Kryteria akceptacji

1. WHEN użytkownik kliknie "Edytuj" w panelu THEN THE System SHALL przełączyć tekst na edytowalny textarea.
2. WHEN użytkownik zapisze edycję THEN THE System SHALL zaktualizować node i zapisać do localStorage.
3. WHEN użytkownik kliknie "Usuń" THEN THE System SHALL usunąć node PO potwierdzeniu (Are you sure?).
4. WHEN node jest usuwany THEN THE System SHALL usunąć też wszystkie jego połączenia.
5. WHEN użytkownik zmieni typ node'a THEN THE System SHALL zaktualizować kolor i rozmiar na grafie.

---

## Wymaganie 6: Tworzenie połączeń

**User Story:** Jako użytkownik, chcę łączyć node'y ze sobą, żeby widzieć relacje między pomysłami.

### Kryteria akceptacji

1. WHEN użytkownik kliknie "Połącz" na node A, a potem kliknie node B THEN THE System SHALL utworzyć połączenie A↔B.
2. WHEN połączenie już istnieje THEN THE System SHALL nie tworzyć duplikatu.
3. WHEN użytkownik kliknie na linię połączenia THEN THE System SHALL podświetlić oba node'y i pokazać opcję usunięcia.
4. IF użytkownik anuluje tryb łączenia (Escape) THEN THE System SHALL wyjść z trybu bez tworzenia połączenia.

---

## Wymaganie 7: Filtrowanie i wyszukiwanie

**User Story:** Jako użytkownik, chcę filtrować graf po typie node'a i szukać po tekście, żeby szybko znaleźć co potrzebuję.

### Kryteria akceptacji

1. WHEN użytkownik kliknie filtr typu (np. "aksjomat") THEN THE System SHALL przyciemnić wszystkie node'y oprócz wybranego typu.
2. WHEN użytkownik wpisze tekst w search THEN THE System SHALL podświetlić node'y których tytuł/tekst pasuje.
3. WHEN żaden node nie pasuje do searcha THEN THE System SHALL wyświetlić "Brak wyników".
4. WHEN użytkownik wyczyści filtry THEN THE System SHALL przywrócić pełny widok grafu.

---

## Wymaganie 8: Parking (magazyn nie-teraz)

**User Story:** Jako użytkownik, chcę przenieść node do "parkingu" żeby nie zaśmiecał grafu ale nie zginął.

### Kryteria akceptacji

1. WHEN użytkownik kliknie "Parkuj" na node THEN THE System SHALL usunąć go z grafu i przenieść do listy Parking.
2. WHEN użytkownik otworzy widok Parking THEN THE System SHALL wyświetlić listę zaparkowanych node'ów (tytuł + data zaparkowania).
3. WHEN użytkownik kliknie "Przywróć" na zaparkowanym node THEN THE System SHALL przywrócić go na graf (bez starych połączeń).
4. Parking NIE jest koszem — zaparkowane node'y żyją w nieskończoność.
