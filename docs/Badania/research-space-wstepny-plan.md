# RESEARCH SPACE — Wstępny plan funkcji
**Status: WSTĘPNE / MEGA SUBJECT TO CHANGE**
**Data: 2026-07-06**
**Kontekst: Rozmowa Ksawier + AI o nowej zakładce w Nexusie**

---

## ⚠️ WAŻNE — DISCLAIMER
To jest dokument roboczy. **WSZYSTKO SUBJECT TO CHANGE.** Ten plik został wygenerowany przez AI podczas rozmowy. Użytkownik nie czytał tego w całości. To są surowe notatki — nic nie jest zatwierdzone, nic nie jest ostateczne. Każda sekcja może zostać wywalona lub przepisana od zera. Nie jest to specyfikacja techniczna ani plan implementacji.

---

## 1. CYTATY UŻYTKOWNIKA (dosłowne lub sparafrazowane)

### O problemie
> "na portalu useme wystawiaja zlecenia ludzie i trzeba jebnac oferty i ja mam pliki do automatycznego ofertowania ale one nie dzialaja"

> "przegladarkowe Ai jest super ale tylko jalk chce samemu sie edykowac i zapomniec wiekszosc XD" — problem: rozmowa z AI w przeglądarce nie zostawia śladu, nie ma gdzie zapisać danych zlecenia, odpowiedzi AI, wniosków

### O tym co wpływa na jakość ofert (przykład Useme)
> "1. case studies wygranych ofert wktorych ktos odpisal"
> "2. takich ktorych nikt nie odpisal"
> "3. ogolne przemyslenia i obserwacje jakie sobie tylko wymysle i chcialbym przebadac"
> "4. oraz inne rzeczy jak np wziecie ofert z playwrighta i potem analiza np demek ktorem ozna zrobic zeby polepszyc cos"

### O uniwersalności
> "tak jakby dla przykladu bo to nie jest tak ze chce robic 1 badanie space dla tego 1 tylko dla wszystkiego chgyba ze sie nie da ale od szczegolow"

### O strukturze wpisu
> "Mysle ze to powinno byc mieszane razem. i kazdy case study powinny sie potem przeplatac., wkoncu wnioski powinni se dajmy potem laczyc."
> "tressc zawsze musi byc. jakos tresc cyyba ze bym wgral OCR to mogl by byc skrin z playwrigya albo po ptostu skopiowane ale to juz bede zbierac oferty i tak bo bot od useme i tak to powinien robic jaj go odpale, to tym sie nie martwy jak bedziemy zodbywac."
> "zawsze musi byc zrodlo, AI + JA i cos robienie z tym. i potem robienie cos z tymi dajmy wnioskami."

### O niepewnościach
> "nie wszystk otez mowie - 'HMMM TO MA SENS' niektore rzeczy NIE WIEM, i co wtedy? takie nie wiadome chcialbym na inny stół wrzucać"

### O porównywaniu plików i analizie
> "a jakbys przeanalizowal z 40 ofert z 2 kategorii ktore sa najbardziej dochodwe, ktore sa najczestsze, ktore sa najlatwiejsze itp"

### O metodzie pracy nad projektem (2026-07-06)
> "ja se tak ogolnie mysle ze ja nie chce robic po 1 rzeczy. ale tez nie chce calosciktorejnie wiem jak chce wygladac. bedziemy pisac i z kazda wiadomosc krok do calosci bedzie sie zwiekszac, bedziesz zapisywac moje cytaty i jak to zmienia plik."

### O twardych rozwiązaniach vs elastyczności (2026-07-07)
> "za duzo w sumie czegos co jest powiedzmy zmienne i flexible. wole zachowac hardcodowe rozwiazania jak np mechanizm pewnych jak juz bede bardziej pewien takiego rozwiazania."

### O niechodzeniu na łatwiznę (2026-07-07)
> "dodatkowo to chodzenie na latwizne. ja szukam czegos madrzejszego ale przydatnego"

### O strukturze wpisu — czat z AI, nie pojedyncza odpowiedź (2026-07-07)
> "a co jesli mialbym czat ktory trwa no tak z 30 tur? a nie 1 zrodlo i 1 odpowiedz?"

### O agentach za plecami (2026-07-07)
> "ten czat albo na żywo albo poprzez wywołanie bedzie obserwowac inny bądź inni agenci z juz promptami. i oni beda brali co z tego Ai wyciagnelo. i co ja zaobserwowałem."

### O tym czego nie wiem — agenci wykrywają, nie ja wypełniam (2026-07-07)
> "oni sami maja to wykrywac, ja bede w czacie jawnie pisac to co nie mam pojecia i jesli w rozmowie nie roztrzygniemy np Ai nie powie mi a ja powiem aha no racja to znaczy ze to jest do roztrzygniecia"

### O etapach (2026-07-07)
> "i to jest etap 1 czyli zbieranie"

### O kosztach AI (2026-07-07)
> "mam darmowego Ai, nawet teraz XD pisze z deepseek pro za darmo w trae wiec no"

### O wywołaniu agentów — nierozstrzygnięte (2026-07-07)
> "wpisz ze moze byc albo na zywo albo przez przycisk bo nie zadecydowalem jezcze"

### O promptach (2026-07-07)
> "a prompty juz sam ułoże, nie musisz sie tym martwic"

### O jakości danych i dokumentacji (2026-07-07)
> "o ile kazdy bedzie dostawal wszystko co ma. i wszystko jest jawnie dokumentowane i ladnie ukladane to jest dobrze"

---

## 2. DECYZJE PODJĘTE W ROZMOWIE

| Decyzja | Wybór |
|---------|-------|
| Gdzie w Nexusie? | Nowa zakładka `research` |
| Uniwersalne czy tylko Useme? | Uniwersalne narzędzie badawcze (chyba że się nie da) |
| Organizacja? | Osobne projekty badawcze (np. "Poprawa ofert Useme") |
| Dane? | Zbierane od zera, start od pustego |
| Głębokość analizy? | Z wnioskami i śledzeniem efektów |
| AI wbudowane? | Tak, przez ProviderRegistry Nexus (DeepSeek) |
| Kolejność prac? | Najpierw podstawowe wpisy badawcze, potem analiza wsadowa (2026-07-06) |
| Metoda projektowania? | Iteracyjnie w rozmowie — nie wszystko z góry, obraz rośnie z każdą wiadomością (2026-07-06) |
| Filozofia rozwiązań? | Hardcodowe, konkretne — nie elastyczne frameworki. Mechanizm dopiero gdy jest pewność że tak ma być (2026-07-07) |
| Jakość? | Nie iść na łatwiznę. Szukać mądrzejszych, przydatnych rozwiązań (2026-07-07) |
| Struktura wpisu? | Czat z AI (wieloturowy, jak w przeglądarce), nie pojedyncza odpowiedź (2026-07-07) |
| Wnioski? | Brak obowiązkowych wniosków na tym etapie (2026-07-07) |
| Obserwacje? | Agenci AI w tle wyciągają co AI wykryło i co użytkownik zaobserwował (2026-07-07) |
| Nierozstrzygnięte? | Agenci wykrywają z rozmowy, nie ręczna sekcja (2026-07-07) |
| Wywołanie agentów? | Do decyzji: na żywo albo przycisk (2026-07-07) |
| Prompty agentów? | Użytkownik układa sam (2026-07-07) |
| Etap? | Etap 1 — zbieranie (2026-07-07) |
| Jakość danych? | Każdy element dostaje pełen kontekst, wszystko jawnie udokumentowane i ładnie ułożone (2026-07-07) |

---

## 3. PROPOZYCJA AI: JAK BADAĆ DLACZEGO OFERTY NIE DZIAŁAJĄ

### Proces badawczy (5 kroków)

**Krok 1: Zbieranie dowodów**
- Wrzucenie wielu plików z ofertami naraz do jednego wpisu
- Oznaczenie które dostały odpowiedź, które nie

**Krok 2: AI analizuje je obok siebie**
- AI dostaje wszystkie pliki jednocześnie i widzi pełny kontekst
- Porównuje: "te zadziałały, te nie — dlaczego?"
- To jest coś czego nie da się zrobić w przeglądarkowym AI (tam jeden plik na raz)

**Krok 3: Użytkownik dodaje obserwacje**
- Pod analizą AI użytkownik pisze swoje myśli
- "Faktycznie, bot nie sprawdza nazwy firmy przed wysłaniem"

**Krok 4: Wyciąganie wniosków**
- Każdy wniosek ma status:
  - PEWNE — AI potwierdziło + użytkownik się zgadza
  - NIE WIEM — do zweryfikowania później
  - POTWIERDZONE DANYMI — zweryfikowane na większej próbce
- Wnioski NIE WIEM trafiają na "Stół niepewnych"

**Krok 5: Iteracja**
- Po tygodniu, mając więcej danych, weryfikacja wniosków
- Rzeczy ze stołu niepewnych dostają potwierdzenie lub są odrzucane
- Wnioski z różnych wpisów się łączą

---

## 4. PROPOZYCJA AI: STRUKTURA INTERFEJSU

```
┌─────────────────────────────────────────────────────────┐
│ PROJEKT: Poprawa ofert Useme                            │
│                                                         │
│ [+ Nowy wpis]  [Porównaj pliki]  [Stół niepewnych (3)] │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  ┌── WPIS: Porównanie 4 ofert (2026-07-06) ──────────┐ │
│  │  📎 Pliki: oferta_1.txt, oferta_2.txt, ...         │ │
│  │  🤖 AI: analiza porównawcza                        │ │
│  │  🧠 Ja: moje obserwacje                            │ │
│  │  WNIOSKI: ✅ PEWNE / ❓ NIE WIEM                   │ │
│  │  🔗 Powiązane: WPIS #2, WPIS #5                    │ │
│  └─────────────────────────────────────────────────────┘ │
│  ┌── STÓŁ NIEPEWNYCH ─────────────────────────────────┐ │
│  │  ❓ Auto-wykrywanie nazwy firmy                     │ │
│  │  ❓ Czy formatowanie HTML ma znaczenie              │ │
│  │  ❓ Czy pora wysłania wpływa na odzew               │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 5. KLUCZOWE FUNKCJE RESEARCH SPACE

| Funkcja | Po co |
|---|---|
| Wpisy mieszane | Źródło + AI + Twoje myśli + wnioski w jednym |
| Wiele plików naraz | AI porównuje je obok siebie |
| Statusy wniosków | PEWNE / NIE WIEM / POTWIERDZONE DANYMI |
| Stół niepewnych | Rzeczy do sprawdzenia później, osobna lista |
| Powiązania między wpisami | Wnioski z różnych wpisów się łączą |
| Efekty / follow-up | Widzisz co faktycznie zadziałało po czasie |
| Porównaj pliki | Przycisk: wybierz 2-10 plików, AI porówna je i wskaże najlepszy |
| Czat z AI w kontekście | AI widzi cały projekt, nie tylko jeden plik |

---

## 6. NOWY POMYSŁ: ANALIZA WIELU OFERT WEDŁUG KRYTERIÓW

Użytkownik rzucił pomysł analizy 40 ofert z 2 kategorii pod kątem:
- Które kategorie są najbardziej dochodowe?
- Które zlecenia są najczęstsze?
- Które są najłatwiejsze do wykonania?
- Itp.

### Jak to może działać w Research Space:
1. Użytkownik wrzuca 40 plików z ofertami (lub bot Useme zbiera je automatycznie)
2. Wybiera tryb "Analiza wsadowa"
3. AI przetwarza wszystkie oferty i generuje raport:
   - Kategorie wg dochodowości
   - Kategorie wg częstotliwości
   - Kategorie wg trudności/skali
   - Rekomendacje: w które kategorie warto iść
4. Raport zostaje jako wpis w projekcie
5. Można go aktualizować co miesiąc z nowymi danymi

---

## 7. DECYZJE ROZSTRZYGAJĄCE OTWARTE PYTANIA (2026-07-07)

| # | Pytanie | Decyzja | Uzasadnienie |
|---|---------|---------|--------------|
| 1 | Czy wpisy można edytować po czasie? | **Tak** — czat i źródła edytowalne. Obserwacje agentów: **append-only z mechanizmem korekt** (jak faktura korygująca). Agent nie nadpisuje starej obserwacji — tworzy nową z polem `corrects_observation_id` wskazującym na poprzednią. Pełny ślad myślowy. | Etap 1 to zbieranie — potrzebna swoboda dodawania plików i kontynuowania rozmowy. Ale obserwacje to fakty historyczne z danej chwili. |
| 2 | Czy stół niepewnych jest globalny czy per wpis? | **Per wpis + widok zbiorczy per projekt.** Każde nierozstrzygnięte jest przypięte do konkretnego wpisu (skąd się wzięło), ale przez query `observation_type='unresolved'` + JOIN po `project_id` można zobaczyć wszystkie w projekcie. | Nierozstrzygnięte "formatowanie HTML" powstało w konkretnym kontekście — bez tego to luźne hasło. Widok zbiorczy daje pełny obraz projektu. |
| 3 | Jak działają powiązania między wpisami? | **Tagi** (istniejący mechanizm Nexusa: `NexusNode.tags`, `WikiArticle.tags`) + opcjonalne pole `related_entry_ids TEXT DEFAULT '[]'` w `research_entries` dla ręcznych linków. **Bez grafu.** | Graf powiązań na etapie zbierania to overengineering. Tagi są już w systemie. Ręczne linki to hardcodowe, konkretne rozwiązanie. |
| 4 | Czy Research Space zastępuje UsemeContainer? | **Nie. Osobna zakładka `research` obok `useme`.** Dwa różne ViewMode, dwa zestawy komponentów, dwie tabele. | Research Space to narzędzie **analityczne** (uniwersalne badanie), UsemeContainer to narzędzie **wykonawcze** (automatyzacja wysyłania ofert). Uzupełniają się. |
| 5 | Co pierwsze — wpisy czy analiza wsadowa? | **Podstawowe wpisy.** Analiza wsadowa później (etap 2 lub 3). | Wpis to podstawowa jednostka — kontener na źródła + czat + obserwacje agentów. Bez tego analiza wsadowa nie ma gdzie zapisać wyniku. |
| 6 | Czy potrzeba eksportu? | **Nie.** System już ma ExportModal i exportEngine — jeśli będzie potrzebny, rozszerzy się istniejący mechanizm. | Na etapie zbierania dane tylko wchodzą do systemu. Eksport będzie potrzebny przy łączeniu wniosków. |
| 7 | Wywołanie agentów — live czy przycisk? | **Przycisk.** Regulacja automatyczna (co godzinę, co N wiadomości) do dodania w przyszłości. | Przycisk daje pełną kontrolę na etapie zbierania. Jeden handler IPC, prostsza implementacja. Live mode można dodać później.

---

## 8. UWAGI TECHNICZNE (kontekst Nexus)

- Nexus to Electron + React 19 + TypeScript + Vite
- Backend: DeepSeek V4 Flash/Pro przez `localhost:4570/v1`
- Baza: SQLite przez `StorageEngine` (nowe tabele dla research)
- Istniejący kod Useme: `UsemeContainer.tsx`, `usemeHandlers.ts`, `usemeStore.ts`
- Nowa zakładka wymaga dodania `'research'` do `ViewMode` w `types.ts`
- IPC przez `ipcMain.handle()` + `ipcRenderer.invoke()`
- Wszystko musi przechodzić `tsc --noEmit`

---

## 9. NASTĘPNE KROKI

1. Użytkownik przegląda ten dokument i mówi co OK a co nie
2. Ustalamy co jest priorytetem
3. Robimy plan techniczny (schemat bazy, komponenty, IPC)
4. Zaczynamy implementację

---

## 10. WSTĘPNE ZAŁOŻENIA — SCHEMAT BAZY DANYCH (2026-07-07)

**Status: PROPOZYCJA — do zatwierdzenia przez użytkownika**

Na podstawie wizji użytkownika (czat z AI + agenci w tle + automatyczne wykrywanie nierozstrzygniętych) oraz istniejących konwencji StorageEngine (SQLite, TEXT PRIMARY KEY, datetime('now'), snake_case, FK z CASCADE).

### Tabele

**1. `research_projects`** — kontener na projekty badawcze
```
id          TEXT PRIMARY KEY
name        TEXT NOT NULL
created_at  TEXT DEFAULT (datetime('now'))
updated_at  TEXT DEFAULT (datetime('now'))
```

**2. `research_entries`** — pojedynczy wpis badawczy
```
id            TEXT PRIMARY KEY
project_id    TEXT NOT NULL → FK do research_projects (CASCADE)
title         TEXT DEFAULT ''
created_at    TEXT DEFAULT (datetime('now'))
updated_at    TEXT DEFAULT (datetime('now'))
```

**3. `research_sources`** — pliki/źródła przypięte do wpisu
```
id            TEXT PRIMARY KEY
entry_id      TEXT NOT NULL → FK do research_entries (CASCADE)
file_name     TEXT NOT NULL        -- oryginalna nazwa pliku
file_path     TEXT NOT NULL        -- ścieżka do skopiowanego pliku (zawsze obecna jako backup)
file_type     TEXT                 -- rozszerzenie / MIME
content_text  TEXT                 -- pełna treść do analizy (dla plików tekstowych; NULL dla binarnych)
imported_at   TEXT DEFAULT (datetime('now'))
```
> **Decyzja (2026-07-07): Opcja C** — przechowujemy i ścieżkę (`file_path`), i treść (`content_text`).
> Dla plików tekstowych treść w bazie (ułatwia wyszukiwanie FTS5 i analizę AI), dla binarnych `content_text = NULL`.
> Ścieżka zawsze zostaje jako backup.

**4. `research_chat_messages`** — wiadomości czatu z AI (wzór: `experimental_chat_messages`)
```
id            TEXT PRIMARY KEY
entry_id      TEXT NOT NULL → FK do research_entries (CASCADE)
role          TEXT NOT NULL        -- 'user' | 'assistant' | 'system'
content       TEXT NOT NULL
created_at    TEXT DEFAULT (datetime('now'))
```

**5. `research_agent_observations`** — co agenci w tle wykryli z rozmowy
```
id                  TEXT PRIMARY KEY
entry_id            TEXT NOT NULL → FK do research_entries (CASCADE)
agent_id            TEXT                  -- NULL dozwolone: który agent Nexus wygenerował tę obserwację
observation_type    TEXT NOT NULL         -- 'ai_finding' | 'user_observation' | 'unresolved'
content             TEXT NOT NULL         -- treść obserwacji
source_message_ids  TEXT DEFAULT '[]'     -- JSON: które wiadomości z czatu są źródłem
created_at          TEXT DEFAULT (datetime('now'))
```
> **Decyzja (2026-07-07): Opcja B** — dodajemy `agent_id` (NULL dozwolone).
> Użytkownik planuje wielu agentów z różnymi promptami — pole umożliwia śledzenie który agent co wykrył.
> NULL na starcie (zanim agenci zaczną działać). Bez tego nie da się później rozróżnić obserwacji od różnych agentów.

### Dlaczego tak?

- **Osobna tabela na źródła** — wiele plików na jeden wpis (np. 40 ofert)
- **Czat jako osobne wiadomości** — sprawdzony wzór z `experimental_chat_messages`
- **Obserwacje w jednej tabeli** — `observation_type` rozróżnia typ, bez mnożenia tabel
- **Brak tabeli "nierozstrzygnięte"** — agenci wykrywają automatycznie, lądują jako `observation_type = 'unresolved'`

### Otwarte pytania

- Czy przechowywać pełną treść pliku w `content_text`, czy tylko ścieżkę?
- Czy obserwacje agentów potrzebują pola `agent_id` (który agent wykrył)?