# EKSPLORACJA I PROJEKT: NOWY TRYB EKSPERYMENTALNY NEXUS

**Status:** W trakcie wywiadu z użytkownikiem (`/grill-me`)
**Zasada główna:** Żadne prace kodowe nie startują, dopóki użytkownik nie zatwierdzi pełnej wizji słowami "mamy to" lub równoważnymi (`/goal`).

---

## 1. Założenia Bazowe
* **Stan bazowy:** Obecne UI Nexusa (Topologia, Lab, Cockpit, Git) pozostaje nienaruszone jako warstwa pod spodem.
* **Przełącznik Trybu:** Wywołanie trybu eksperymentalnego ukrywa tradycyjne ciężkie UI i otwiera nową przestrzeń roboczą.

---

## 2. Dziennik Wywiadu i Zbierane Myśli

### Pytanie 1: Jaka jest główna idea i co powinnam zobaczyć na ekranie od razu po włączeniu nowego trybu eksperymentalnego?
**Odpowiedź użytkownika:**
> "To nie 1:1 co opcja 2 (Interaktywny asystent na pełnym ekranie), ale szedłbym w tę stronę. Potrzebuję czegoś w tym stylu. Dopowiem dodatkowo: chcę mieć to co pisałem gdzieś porozrzucane zebrane w 1 pliku. **Nexus aktualnie nie wspiera przejścia z rozpierdolu (chaosu/luźnych myśli) do planu** i nie pozwala mi pracować dynamicznie w nim."

**Wniosek architektoniczny nr 1:** Nowy tryb eksperymentalny ma być interaktywnym mostem (przestrzenią roboczą/czatem z aktywnym dokumentem), który bierze chaotyczne, porozrzucane myśli użytkownika i w sposób dynamiczny pomaga przekuć je w spójny, ustrukturyzowany Plan (zapisywany w jednym pliku/bazie).

### Pytanie 2: Co najbardziej Cię blokuje lub frustruje, gdy teraz próbujesz przenieść swoje myśli do Nexusa?
**Odpowiedź użytkownika:**
> "Zapisuję początkowy plan w Topology (albo innym widoku) i piszę o nim z Gemini w czacie. W trakcie rozmowy z AI całkowicie odchodzimy od początkowych założeń i **nie mam jak potem dynamicznie aktualizować tego planu wizualnego**. Rozmowa z AI żyje swoim życiem, a zapisany w Nexusie plan zostaje w tyle i staje się nieaktualny."

**Wniosek architektoniczny nr 2 (Zasada Żywego Synchronu):** Nowy tryb musi likwidować rozłam między "rozmową z AI" a "zapisem planu/widokiem". Kiedy w trakcie rozmowy z AI zmieniają się założenia lub rodzą nowe pomysły, AI powinno móc w czasie rzeczywistym aktualizować i przebudowywać plan widoczny dla użytkownika, aby zawsze był na bieżąco.

### Pytanie 3: W jaki sposób AI powinno na bieżąco aktualizować Twój plan w tym nowym trybie?
**Odpowiedź użytkownika:**
> "To nie jest tylko jeden problem, problemów jest wiele na raz. Opcja z żywym dokumentem obok czatu wydaje się spoko, opcjonalnie z przyciskiem do manualnego synchronizowania (gdybym chciał oszczędzać tokeny). Wpadłem też na pomysł podziału na 'strony' (1 strona = 1 moduł), ale jeśli nie zrobimy tego super płynnie, woliłbym 1 widok pokazujący wszystko.
> **Kluczowy problem:** Jak AI ma w ogóle tworzyć te notatki i węzły? Na jakim standardzie (np. Mermaid czy innym)? Jak zapewnić, żeby AI robiło to świetnie i uniwersalnie (dla spraw technicznych i nietechnicznych)?"

**Wniosek architektoniczny nr 3:**
1. **Widok:** Preferowany jeden wszechstronny widok ("Żywe Płótno/Dokument" obok czatu) z możliwością kontroli aktualizacji (live vs na kliknięcie).
2. **Kluczowa rozterka technologiczna:** Potrzebny jest uniwersalny, natywny dla modeli język/standard reprezentacji wiedzy i diagramów/notatek, w którym AI bezbłędnie generuje struktury na ekranie.

### Pytanie 4: Jak AI powinno postąpić w pierwszej sekundzie po wklejeniu chaotycznej myśli?
**Odpowiedź użytkownika:**
> "Myślę że opcja 1 (Propozycja w dialogu z zapytaniem czy podpiąć) lub opcja 3 (Pełny auto-pilot z podświetleniem zmian), zależnie od mojego aktualnego poziomu zaufania do AI / kaprysu."

**Wniosek architektoniczny nr 4 (Suwak Zaufania AI):** Nowy tryb powinien mieć regulowany poziom autonomii AI (np. przełącznik "Proponuj zmiany" vs "Wdrażaj automatycznie").
**Uwaga krytyczna użytkownika:** Dotychczasowe pytania dotknęły dopiero niewielkiego procentu rzeczywistego problemu roboczego. Przed nami wciąż do odkrycia najgłębsze warstwy wyzwania.

### Pytanie 5: Co jest największym, najgłębszym wyzwaniem lub bólem w Twojej pracy z projektami?
**Odpowiedź użytkownika:**
> "Opcja 1 (utrata kontekstu długofalowego) i 2 (bariera planowanie-egzekucja) są dobre i to też są problemy. Np. chcę natywnie w Nexusie mieć rozwiązany problem kontekstu, żebym nie musiał dawać każdemu AI od razu całego kontekstu, ale żeby każdy element miał swój zapisany, idealny, wycinkowy kontekst (bo teraz nie mogę wejść do AI Studio i rozmawiać o Nexusie bez tłumaczenia wszystkiego od zera). Do tego potrzebna baza SQLite i mądry magazyn (SKŁAD), **ale to jest fundament bazy danych, a nie sam tryb eksperymentalny**."

**Wniosek architektoniczny nr 5 (Rozdział Fundamentu od GUI):**
1. **Fundament (Backend SQLite / Mądry Magazyn):** Odpowiada za precyzyjne krojenie kontekstu ("Sliced Context"), by każde zewnętrzne AI dostawało w pigułce dokładnie to, czego potrzebuje o danym elemencie.
2. **Tryb Eksperymentalny (Frontend / GUI):** To interaktywna warstwa wizualna nad tym magazynem. Skupmy się teraz ściśle na tym, czym ma być **samo doświadczenie (sedno) w tym nowym trybie UI**.

### Pytanie 6: Czym w swoim najczystszym sensie ma być to nowe okno po kliknięciu przełącznika?
**Odpowiedź użytkownika:**
> "Po prostu czymś, czym chcę docelowo zastąpić aktualne główne widoki Nexusa (bez usuwania starych dopóki nowy nie będzie w 100% gotowy). Myślę nad wspólnym stołem warsztatowym lub asystentem projektu, ale **zmień wektor pytań** – nie krążmy już wokół samego wyglądu okna."

**Wniosek architektoniczny nr 6 (Zmień Wektor - Przejście do Egzekucji i Rytuału):** Użytkownik jasno określił cel: ten tryb ma być sukcesorem głównych widoków Nexusa. Zamiast pytać o układ graficzny, musimy zbadać **wektor działania (egzekucji) i przepływu pracy**.

### Pytanie 7: W jakich formach chcesz zrzucać myśli do nowego trybu?
**Odpowiedź użytkownika:**
> "Na razie chcę się skupić tylko na tekście, który będę tworzyć w samym Nexusie. A nie danymi z zewnątrz, bo to prostsza sprawa."

**Wniosek architektoniczny nr 7 (Czystszy Scope - Tekst Wewnątrz Nexusa):** Odpadają skomplikowane parsery plików zewnętrznych czy OCR na start. Nowy tryb eksperymentalny to czyste laboratorium tekstowo-myślowe (czat, notatki, plan tworzony natywnie w aplikacji).

### Pytanie 8: Jak notatki tekstowe mają łączyć się ze sobą w systemie?
**Odpowiedź użytkownika:**
> "Skoro AI ma tworzyć węzły, po co mi ręczna tylda? Zostawię tę funkcję opcjonalnie. Staramy się **minimalizować użycie AI do absolutnego must** (oszczędność tokenów i kosztów). Jestem pewien na 100%, że chcę iść w ścisłą integrację Human-AI z płynnym przejściem z 'chaosu do planu'.
> **Nowe wielkie odkrycie:** Zauważyłem potrzebę istnienia informacji odnośnie CAŁOŚCI projektu. Nie tylko jako luźna notatka do czegoś, ale informacja globalna – **Aksjomaty Projektów**."

**Wniosek architektoniczny nr 8 (Aksjomaty Projektów & Oszczędność Tokenów):**
1. **Aksjomaty Projektu:** W nowym trybie musi istnieć specjalna, nadrzędna warstwa wiedzy ("Aksjomaty" / Konstytucja Projektu), która definiuje żelazne zasady obowiązujące w całym projekcie, niezależnie od pojedynczych notatek czy etapów planu.
2. **Oszczędne AI:** AI nie pracuje w ciągłej pętli w tle na każdy znak klawiatury. Jest wywoływane punktowo (na żądanie lub w kluczowych momentach przejścia z chaosu do struktury).

### Pytanie 9: Kto i gdzie zapisuje Aksjomaty Projektu?
**Odpowiedź użytkownika:**
> "Biorę na siebie odpowiedzialność za zapisywanie tego w konkretnym wyznaczonym miejscu."

**Wniosek architektoniczny nr 9 (Odpowiedzialność Użytkownika za Aksjomaty):** Użytkownik ręcznie definiuje i pielęgnuje Aksjomaty w dedykowanym miejscu, nie oczekując od AI automatycznego zgadywania czy wyłapywania ich z luźnych rozmów.

### Pytanie 10: W którym momencie wywoływać proces przekuwania myśli w plan?
**Odpowiedź użytkownika:**
> "Myślę nad konkretnym przyciskiem pod którym kryje się konkretny model z konkretnym promptem i po prostu to robi. Ale to są dalej mało ważne rzeczy, **cały czas odbiegamy tymi pytaniami od tego co ważne i ciężkie**."

**Wniosek architektoniczny nr 10 (Sygnał Korekty):** Przełączniki, przyciski i prompty to detale implementacyjne. Musimy natychmiast przestać pytać o mechanikę interfejsu i pozwolić użytkownikowi wskazać najcięższy rdzeń problemu.

### Pytanie 11: Co jest najcięższym i najważniejszym rdzeniem problemu?
**Odpowiedź użytkownika:**
> "Opcja 1 i 2 to spore wyzwania, ale głównie chcę móc wziąć pod lupę wszystko co zechcę (od projektu pipeline po pliki używane do zleceń). Chcę w projektach technicznych widzieć wszystkie szczegóły, móc skupić się np. tylko na prawej odnodze planu, widzieć co jest zaplanowane i dodawać nowe szczegóły. **Zmieniać nie tylko z czatu, ale bezpośrednio z tego grafu** (tak jak w Artefakcie planu mogę po nim pisać i dać AI do review, i jednocześnie pisać w czacie). Interesuje mnie też jak zestawić zaawansowany pipeline obok projektu 'totalnego gówna' XD."

**Wniosek architektoniczny nr 11 (Sedno Wizji - Lupa, Edycja Bezpośrednia i Współistnienie Skrajności):**
1. **Lupa na odnogi (Granular Focus):** Możliwość "wycięcia/zbliżenia" (zoom-in) na pojedynczą gałąź grafu lub planu i ukrycia reszty, by skupić się na detalu.
2. **Dwukierunkowa Edycja Bezpośrednia (Interactive Artifact Canvas):** Graf/Plan nie jest obrazkiem „tylko do odczytu z czatu”. Można w niego kliknąć i pisać/edytować ręcznie jak w dokumencie tekstowym lub artefakcie, a następnie oddać zmieniony fragment AI do weryfikacji/rozbudowy.
3. **Przestrzeń Skrajności:** W jednej bazie mogą obok siebie żyć ultra-techniczne schematy rurociągów oraz całkowicie luźne, chaotyczne notatki osobiste.

### Pytanie 12: Jak ma wyglądać proces 'AI Review' na grafie?
**Odpowiedź użytkownika:**
> "Muszę stworzyć system, w którym w ogóle nie martwię się gdzie zapisuję informacje – chcę maksymalnie przyspieszyć moje myślenie bez stresu 'czy zapisane w dobrym pliku'.
> Co do samego grafu: ja nie zmieniałbym surowej treści węzła ręcznie, tylko pisałbym o niej (adnotacje/komentarze w stylu: 'to chcę inaczej, dodaj to, usuń to'). Wszystko powinno być jawne od razu.
> **Krytyczna zasada współpracy (Meta-Aksjomat):** W tematach, na których się nie znam, AI nie powinno kazać mi wybierać z wariantów. AI ma przedstawiać **konkretną argumentację co jest najlepsze i dlaczego**, aktywnie dyskutować i doradzać, wiedząc, że użytkownik nie jest ekspertem technicznym."

**Wniosek architektoniczny nr 12 (Bezstresowy Zapis, Adnotacje i Aktywne Doradztwo AI):**
1. **Adnotacje zamiast edycji surowego JSON:** Użytkownik klikając na węzeł, zostawia na nim wytyczne ("zmodyfikuj to tak i tak"), a AI w locie przebudowuje węzeł.
2. **Meta-Aksjomat Proaktywności:** AI bierze na siebie ciężar rekomendacji architektonicznej i jasno uzasadnia wybory techniczne, zamiast zrzucać ciężar decyzji na nietechnicznego użytkownika.

### Pytanie 13: Zsyntetyzowanie wizji
**Odpowiedź użytkownika:**
> "Nic nie rozumiem stary, z wszystkich odpowiedzi wybrałeś najgorszą."

### Pytanie 14: Jak ma wyglądać idealna praca ludzkimi słowami?
**Odpowiedź użytkownika:**
> "Wchodzę, zrzucam myśli, układa się plan. Ale sztuczna 'lupa' nie jest potrzebna – skupienie na jednym etape to po prostu przesunięcie widoku planu w wybraną stronę.
> Dwie najważniejsze rzeczy: **widzenie wszystkiego na raz** oraz **możliwość komentowania wszystkiego**, by rozwijać system i jednocześnie samemu się rozwijać. Komentarz ma od razu trafiać do odpowiedniego miejsca bez mojego zastanawiania się, żeby zaraz móc go wykorzystać."

**Wniosek architektoniczny nr 14 (Sedno Doświadczenia w Prostych Słowach):**
1. **Wielka Tablica Wszystkiego (Pan & Zoom):** Cały projekt leży przed użytkownikiem jak mapa na stole. Skupienie na jednym etapie to po prostu przesunięcie mapy w lewo lub prawo.
2. **Komentowanie Jako Napęd Rozwoju:** Użytkownik może kliknąć i skomentować dowolny element ("tutaj zróbmy tak", "ten etap ma błąd"). System sam zapisuje ten komentarz we właściwym miejscu i na jego podstawie rozwija projekt.

### Pytanie 15: Czy mamy pełną zgodność koncepcji?
**Odpowiedź użytkownika:**
> "Tak i każdy projekt wiadomo jest oddzielny. Bo np. mam sytuację gdzie piszę ważną rzecz na czacie z AI i ona znika wraz z dłuższym pisaniem, a na takiej tablicy miałbym większą kontrolę przy jednoczesnym dalszym pisaniu z AI. Chyba mamy zgodność."

**Wniosek architektoniczny nr 15 (Trwałość Wiedzy na Tablicy - Koniec z Uciekającym Czatem):**
1. **Ochrona przed zgubieniem w czacie:** W tradycyjnym czacie cenne ustalenia z AI uciekają w górę historii i giną. Na wielkiej tablicy roboczej każdy kluczowy pomysł zostaje przypięty w widocznym miejscu, dając użytkownikowi 100% kontroli i podglądu podczas dalszej rozmowy z AI.
2. **Rozdzielność Projektów:** Każdy projekt to oddzielna, niezależna przestrzeń na tablicy.

---


