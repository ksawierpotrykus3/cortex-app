# SKŁAD MYŚLI
**Data: 2026-07-08**
**Status: ETAP 0 — KONCEPCJA**

> ⚠️ **DISCLAIMER: WSZYSTKO SUBJECT TO CHANGE.**
> Ten plik został wygenerowany przez AI podczas rozmowy. Użytkownik nie czytał tego w całości. To są surowe notatki — nic nie jest zatwierdzone, nic nie jest ostateczne.

---

## CYTATY UŻYTKOWNIKA

### O potrzebie przechowywania myśli (2026-07-08)
> "kolejna mysl ktora nie ma domu i nw gdzie ja w przyszlosci użyć"

### O tym że zwykła przechowalnia jest głupia (2026-07-08)
> "ale zwykla przechowalnia jest gupia, zbierze wszystko i jak to potem wykorzystac"

### O tym że myśli muszą czekać na idealny slot (2026-07-08)
> "te mysli chodzi o to ze musze miec je gdzie przetrzymywac zeby potem idealnie wykorzystac jak beddzie idealny slot zeby je użyć"

### O mechanizmie sesyjnym — EYE nie działa ciągle (2026-07-08)
> "mysle ze nie powinno dzialac caly czas, i w sumie nie musi sie przywolywac w ogole. wystarczy ze Ai by idealnie je segregowalo w wieksze grupy XD. zapomnijmy o przywolywaniu. potem se to moze wymysle tak ze wszystkie akcje moje i AI maja date co nie? no to np po prostu daty, robie cos przez godzine to analizuja ta godzine. robie cos 5 minut to tez to analizuje i dopiero kiedy jest przerwa 20 minut miedzy jakimis dzialaniami to on wchodzi i widzi ze mialem taka sesje od tego do tego i patrzy czy cos wchodzi"

---

## 1. CZYM JEST SKŁAD MYŚLI

Skład Myśli to przechowalnia myśli, które obecnie nie mają zastosowania, ale staną się kluczowe w przyszłości.

### Czym JEST:
- Miejscem gdzie myśl czeka na swój idealny slot
- Zbiorem który AI automatycznie segreguje w większe grupy tematyczne
- Zasobem który EYE przeszukuje sesyjnie, a nie ciągle

---

## 2. MECHANIZM DZIAŁANIA: SESYJNY, NIE CIĄGŁY

### Zasada sesji

EYE nie monitoruje wszystkiego na żywo. Zamiast tego:

1. Każda akcja użytkownika i AI ma timestamp
2. Gdy użytkownik robi coś (5 minut, godzinę, cokolwiek) — to jest **sesja**
3. Gdy następuje **przerwa 20 minut** między działaniami — to jest granica sesji
4. EYE wchodzi po zakończeniu sesji i analizuje ją jako zamkniętą całość: "od timestampu X do timestampu Y użytkownik robił to i to"
5. EYE sprawdza czy w Składzie Myśli są myśli pasujące do tej sesji
6. Jeśli tak — segreguje je w większe grupy razem z nowymi myślami

### Dlaczego 20 minut?

To naturalna granica między "robię coś" a "skończyłem". Krótsze przerwy to tylko pauza w ramach tej samej sesji. 20 minut bez aktywności = koniec bloku pracy.

### Bez przywoływania

Użytkownik mówi wprost: "zapomnijmy o przywolywaniu". EYE nie wyświetla powiadomień "hej, 3 miesiące temu zapisałeś coś pasującego". Zamiast tego:
- EYE po cichu segreguje i grupuje
- Użytkownik może sam wejść do Składu Myśli i zobaczyć jak myśli są pogrupowane
- Grupy stają się coraz bardziej użyteczne z czasem

---

## 3. JAK AI SEGREGUJE MYŚLI W WIĘKSZE GRUPY

### Problem

Masz 200 luźnych myśli. Niektóre o rywalizacji z kolegą. Niektóre o promptach Useme. Niektóre o architekturze Nexusa. Niektóre są totalnie losowe. Ręczne tagowanie jest bez sensu — wtedy to nie jest "wrzucam i zapominam".

### Rozwiązanie: Automatyczne grupowanie semantyczne

1. Każda myśl dostaje **embedding** (wektor znaczeniowy) od AI
2. Embeddingi są porównywane między sobą
3. Myśli które są semantycznie blisko siebie — trafiają do tej samej grupy
4. AI nadaje grupie nazwę na podstawie wspólnego tematu

### Przykład

**Myśli wrzucone w różnym czasie:**
- "Chcę przewyższyć kolegę który idzie na studia informatyczne"
- "Muszę być lepszy praktycznie i teoretycznie za 3-5 lat"
- "Jak on skończy studia to ja mam mieć nad nim przewagę"
- "Prompt do ofert nie bierze nazwy firmy"
- "Oferty bez case study mają niższą skuteczność"
- "Może powinienem dodać portfolio do automatyzacji"

**Po automatycznym grupowaniu:**
- **Grupa "Rywalizacja i rozwój"** — 3 myśli o przewyższeniu kolegi
- **Grupa "Ulepszenia ofert Useme"** — 2 myśli o promptach i ofertach
- **Grupa "Nierozpoznane"** — 1 myśl która nie pasuje do niczego

Grupy rosną organicznie. Po roku możesz mieć 15 grup z 200 myślami.

---

## 4. OTWARTE PYTANIA

1. **Jak AI ma wiedzieć że robi to prawidłowo?** — Nie wiadomo. To jest empiryczne. Trzeba testować na małej próbce, sprawdzać czy grupy mają sens, poprawiać prompt. Dokładnie jak z EYE.
2. **Próg podobieństwa dla grupowania** — za niski = wszystko w jednej grupie. Za wysoki = każda myśl w osobnej. Trzeba znaleźć złoty środek.
3. **Co z myślami które nie pasują do żadnej grupy?** — Zostają w "Nierozpoznane". Z czasem mogą utworzyć nową grupę.
4. **Czy grupy mogą się łączyć?** — Prawdopodobnie tak. Dwie małe grupy o podobnym temacie powinny się scalić.
5. **Jak składować technicznie?** — Osobna tabela `thought_depot`? Czy embeddingi w SQLite czy w zewnętrznej bazie wektorowej?

---

---