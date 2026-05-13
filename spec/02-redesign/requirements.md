# Dokument Wymagań — 02 Redesign

## Wprowadzenie

Obecny design wygląda za bardzo "futurystycznie/neonowo" — kolorowe kółka z niskim fill opacity i neonowymi borderami. Użytkownik chce profesjonalny, stonowany design jak Linear/Notion/Vercel. Animacje zostają ale mniej sci-fi.

## Słownik

- **Professional-neutral** — ciemny, stonowany, bez neonów. Paleta z design.md.

---

## Wymaganie D1: Profesjonalna paleta i node styling

**User Story:** Jako użytkownik, chcę żeby graf wyglądał profesjonalnie jak Linear, nie jak cyberpunk dashboard.

### Kryteria akceptacji

1. WHEN graf się renderuje THEN node'y SHALL mieć wypełniony kolor (nie transparent z neonowym strokem).
2. Node'y MUSZĄ mieć stonowane kolory z design.md (amber, złoto, teal, fiolet, czerwień — NIE neonowe).
3. Tło MUSI być ciepłe ciemne (#111113 lub bliskie), nie czysto czarne.
4. Linie połączeń MUSZĄ być subtelne (1px, opacity 0.3), nie grube (4px).
5. WHEN node jest zaznaczony THEN THE System SHALL podświetlić go subteknie (jasniejszy fill + accent border), nie neonowym strokiem.

---

## Wymaganie D2: Quick Add floating

**User Story:** Jako użytkownik, chcę żeby quick add bar unosił się na środku dołu ekranu, nie był dokowany do krawędzi.

### Kryteria akceptacji

1. Quick add container MUSI unosić się nad grafem (position absolute/fixed, bottom 24px, center).
2. Quick add MUSI mieć zaokrąglone rogi, subtelny cień, tło surface z blur.
3. Quick add NIE MOŻE być pełnej szerokości — max 550px, centered.
4. WHEN panel boczny jest otwarty THEN quick add SHALL pozostać widoczny i centered (nie przesuwać się).

---

## Wymaganie D3: Lepsze etykiety node'ów

**User Story:** Jako użytkownik, chcę czytelne etykiety które się nie nakładają i nie wyglądają jak stara gra.

### Kryteria akceptacji

1. Typ node'a (uppercase label nad kółkiem) MUSI być mały (8px), stonowany (kolor typu z opacity 0.7), nie krzyczący.
2. Tytuł pod node'em MUSI być czytelny (11px), kolor text-secondary.
3. WHEN node'y są blisko siebie THEN etykiety NIE MOGĄ się nakładać (collision radius musi uwzględniać label).
4. WHEN node jest hoverowany THEN etykieta SHALL się podświetlić (text-primary).

---

## Wymaganie D4: Panel boczny — schowany domyślnie

**User Story:** Jako użytkownik, chcę żeby panel boczny NIE pokazywał się na starcie z placeholder danymi.

### Kryteria akceptacji

1. WHEN aplikacja się ładuje THEN panel boczny SHALL być ukryty (klasa `hidden`).
2. WHEN użytkownik kliknie na tło grafu THEN panel SHALL się zamknąć.
