# Pomysły systemowe — Nexus

> Zebrane pomysły na ficzery i architkturę. To NIE SĄ decyzje — to przykłady, luźne myśli, hipotetyczne rozwiązania.

---

## Magazynowanie inteligentne

- Auto-kopiarki z folderów pobranych, screenshoty na skróty klawiszowe (częściowo już ma)
- Wszystko musi mieć swoje miejsce — mapa tego
- AI które uzupełnia mapę
- Możliwość podłączenia AI pod wszystkie/wybrane foldery i pliki
- Idealne nazewnictwo — np. screeny po nazwach osób (screeny_monika), transkrypcja wykładu → AI samo wie co to
- Interaktywna mapa — sterowanie z poziomu mapy, przesuwanie folderów
- Może AI będzie idealnie segregować — NIE WIE, to jest pomysł
- Musi wymyślić własny sposób magazynowania

---

## Chat z boku w Nexusie

- Natywnie będzie miał chat z boku który monitoruje to na co patrzy
- Ma załadowany cały kontekst tego co widzi
- Może z nim o tym pisać
- Bo jak sam planuje to końcowo się blokuje i nie wie co robić dalej
- Konwersacje o tym co tam ma mają być archiwizowane
- Potem AI odpowiedzialne za kompresję na podstawie definicji robi z tego notatki do projektu
- Musi połączyć myślenie samodzielne i myślenie z AI — "bo tak się nie da normalnie działać". Stąd chat z boku.

---

## Wizja pisania z AI

- Problem: pisanie z AI produkuje duże bloki tekstu które rozwijają JEGO, ale nie system. Wszystko ważne musiałby manualnie screenshotować (i to robił)
- Z różnych chatów (Nexus, AI Studio ściągnięte i przerobione) → jedno miejsce TYLKO odpowiedzialne za pisanie
- Tam pisze. Procesy potem biorą te chaty i robią z nich punkty. I nawet mapę — ale musi zatwierdzić 1 standard map
- AI samo bierze z 1 chatu np. 3 problemy → tworzy nowe tematy → wszystko co wiadomo o nich z chatów wpierdala tam
- Za pomocą jakiejś definicji (której nie ma jeszcze)
- To jest mega prototyp — widzi kawałek, musi zaplanować więcej

---

## Pipeline AI — kto co widzi

1. AI kompaktujące — widzi TYLKO tyle ile ma kompaktować
2. Inne AI — bierze skompaktowane, widzi resztę, tworzy/zmienia projekty na tej podstawie
3. Użytkownik — wchodzi na projekt, widzi powiadomienie że AI chce coś dodać/zmienić
4. Akceptuje albo daje komentarz (nie edytuje bezpośrednio — komentuje)
5. AI #2 MUSI widzieć wszystkie projekty — inaczej nie dopasuje do istniejącego i stworzy duplikat

---

## Pipeline AI Studio → Nexus

- Kończy się limit na Opusie → przechodzi na Gemini w AI Studio
- Zapisuje rozmowę przez "GET CODE" → brudny plik ląduje w Pobranych
- Nexus ustawiony: jak widzi cokolwiek z "ai_studio" w nazwie → przenosi do specjalnego miejsca
- Program czyści to do czystego .txt
- Czysty plik wyciągany na produkcję — wszystko ważne zabierane wg definicji i kompresowane
- Plik składowany, informacje wyciągane gdzie indziej

---

## Rozproszone AI na blokach danych

- 1 AI nie ogarnie przeszukania całego magazynu
- Pomysł: każdy blok danych ma swojego darmowego Flasha który regularnie go skanuje
- 1 AI wysyła zapytanie do reszty → "nie mam" / "nie mam" / "mam!"
- Nie wie czy to zadziała w praktyce — pomysł

---

## AI koordynator czasowy

- Problemy z orientacją co robić
- AI które doskonale wie wszystko co robi — taski, projekty, praca, wszystko
- Użytkownik składuje wszystko, AI ma limit czasowy tego co ładować + rzeczy oznaczone jako "zawsze wymagane" albo "ładuj tylko jeśli załadujesz tamto"
- AI pomaga koordynować dzień, tydzień

---

## AI do nauki

- Porusza temat z badań/preprintów, pisze z AI w Nexusie → rozmowa się zapisuje (wszystkie rozmowy MUSZĄ być zapisywane)
- Potem AI widzi temat tego badania i linkuje do czegoś co pisał z jakąś osobą miesiąc temu
- Cross-referencja między rozmowami/danymi z różnych źródeł i czasów

---

## Komora testowa

- Np. "AI robi lepiej jak mu powiesz że zapłacisz $100" → bierze do specjalnej komory na rzeczy do sprawdzenia
- Albo sprawdza sam na żywo, albo AI robi to za niego (jeśli ufa)
- AI robi 10 testów i daje argumenty — wg definicji których nie ma (→ Wiki)

---

## System pobierania z Reddita

- Ściąga posty, omawia, wyciąga 100% przydatnych rzeczy
- Potrzebna definicja "przydatności" — której nie ma

---

## R&D z social media

- Na FB, Reddicie, YT jest w chuj pomysłów — to byłoby podjednostką R&D
- Potrzebuje zebrać pliki tego co uznaje za dobry pomysł
- AI automatycznie wykrywa to czego on nie wie (brak wiedzy technicznej) + inna wiedza
- Ma ciekawe posty tam zawsze — "a to całkowicie effortless"
- Odpalanie playwrightów na pisanie ofert itp

---

## Suwak oszczędności AI

- Folder z przykładami — ustawia że AI ładuje np. tylko 2 przykłady
- Jak widzi że za mało → zwiększa suwak
- Kontrolowanie oszczędności z poziomu interfejsu
- Oszczędność kosztów AI jest wymagana

---

## Model switching / badania promptów

- Widzi że lepszy model coś robi dobrze → zapisuje cały log, kontekst → bierze do badań żeby wyciągnąć DLACZEGO
- Może z tego zrobić lepszy prompt dla tańszego modelu (np. Flash)

---

## Model orchestrator

- Miejsce do badania tego jaki model AI używa — wiedzieć od razu jaki model do czego
- Zapisywać wyniki żeby orchestrator mógł za pomocą wyników samemu zmieniać modele

---

## Głosówki z telefonu do Nexusa

- Wysyła głosówkę lub wiadomość z telefonu → Nexus szuka w bazie danych

---

## Pliki RLHF

- Powinien mieć dziesiątki plików RLHF, każdy ładowany do konkretnych zadań
- Tworzone na poziomie feedbacku — jak poprawia AI, to poprawka staje się częścią pliku

---

## Wiki

- AI zawsze potrzebuje definicji i przykładów
- Miejsce na definicje już ma (Wiki) — musiałby tylko linkować to co już napisał raz do promptów
- Stworzenie idealnej definicji wymaga R&D — jakiś sposób tworzenia za pomocą przykładów i tego co pisze
- Wiki może powinno mieć miejsce na przykłady? Nie wie jak to powinno wyglądać

---

## Departament R&D w Nexusie

- Nie wie czy jako oddzielne miejsce czy warstwa która działa zawsze
- Jedyne moduły które mógłby zrobić to workflowy AI

---

## Prowizoryczna lista co Nexus musi robić (NA PEWNO niekompletna)

1. Zbierać (screeny, głosówki, pliki, rozmowy, bodźce)
2. Składować (wszystko ma swoje miejsce, mapa, nazewnictwo)
3. Łączyć (cross-referencja między rzeczami z różnych czasów i źródeł)
4. Kompaktować (AI wyciąga esencję, buduje definicje z przykładów)
5. Odzyskiwać (szukasz czegoś → znajdujesz, rozproszone AI)
6. Wykorzystywać (zgodnie z przeznaczeniem — nie tylko leży)

---

## Inne pomysły

- **Przeplatanie się** ⚠️ POMYSŁ nie muss — chce żeby w Nexusie dużo się mieszało i wykorzystywało już istniejące rozwiązania, nie oddzielne tablice do badania 1 rzeczy. Ale NIE WIE czy to na pewno chce.
- "Mega wymóg żeby coś było mądre" — rzeczy muszą się przenikać
- **Marzenie**: Nexus ma przyspieszać przejście z fazy brudnych myśli do fazy zaprojektowane
- "Stary Nexus nie miał przejścia z fazy brudnych myśli do fazy zaprojektowane. Nowy powinien umożliwiać to wszystko nie usuwając nic."
- Musi być suitable na wszystkie zachcianki — od projektów na useme po najróżniejsze głupoty
- "Kompresja działa bo tydzień temu nie wiedziałem tego tak jak teraz" — ale nikt nie daje tyle czasu
