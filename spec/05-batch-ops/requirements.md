# Dokument Wymagań — 05 Batch Operations

## Wprowadzenie

Multi-select na grafie (Shift+klik) + masowe usuwanie/odłączanie. Z rozmowy o operationalizingu Cortexa — użytkownik chce szybko porządkować graf.

---

## Wymaganie M1: Multi-select

**User Story:** Jako użytkownik, chcę zaznaczyć wiele node'ów naraz (Shift+klik) żeby wykonać na nich operację masową.

### Kryteria akceptacji

1. WHEN użytkownik Shift+kliknie na node THEN THE System SHALL dodać/usunąć go z zaznaczenia.
2. WHEN node jest zaznaczony THEN THE System SHALL oznaczyć go wizualnie (accent stroke, pulsujący).
3. WHEN zaznaczenie nie jest puste THEN THE System SHALL wyświetlić floating batch panel na dole.
4. Batch panel MUSI zawierać: liczbę zaznaczonych, przycisk "Usuń kropki", "Usuń połączenia", "Anuluj".

---

## Wymaganie M2: Mass delete

**User Story:** Jako użytkownik, chcę usunąć wiele node'ów na raz.

### Kryteria akceptacji

1. WHEN użytkownik kliknie "Usuń kropki" THEN THE System SHALL zapytać o potwierdzenie.
2. WHEN potwierdzone THEN THE System SHALL usunąć WSZYSTKIE zaznaczone node'y i ich połączenia.
3. WHEN operacja się skończy THEN batch panel SHALL się ukryć.

---

## Wymaganie M3: Mass unlink

**User Story:** Jako użytkownik, chcę usunąć połączenia MIĘDZY zaznaczonymi node'ami.

### Kryteria akceptacji

1. WHEN użytkownik kliknie "Usuń połączenia" THEN THE System SHALL usunąć wszystkie linki MIĘDZY zaznaczonymi node'ami (nie linki do niezaznaczonych).
2. WHEN operacja się skończy THEN zaznaczenie SHALL zostać wyczyszczone.
