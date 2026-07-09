# NEXUS — Pełna wizja systemu
**Data: 2026-07-08**
**Status: ETAP 0 — KONCEPCJA**

> ⚠️ **DISCLAIMER: WSZYSTKO SUBJECT TO CHANGE.**
> Ten plik został wygenerowany przez AI podczas rozmowy. Użytkownik nie czytał tego w całości. To są surowe notatki — nic nie jest zatwierdzone, nic nie jest ostateczne. Każda sekcja może zostać wywalona lub przepisana od zera.

---

## CZYM JEST NEXUS

Nexus to **zewnętrzny mózg** — system który odciąża pamięć krótkotrwałą przez zewnętrzne struktury. Im więcej warstw, tym wyżej "podłoga rzeczywistości" — tym więcej możesz przetwarzać bez trzymania wszystkiego w głowie.

**Meta-zasada:** Każda warstwa Nexusa rodzi się z tego samego schematu — coś co obecnie musisz trzymać w głowie, a nie ma gdzie tego odłożyć → dostaje własną warstwę.

---

# 1. DISCOVERY — Warstwa empiryczna

## CYTATY UŻYTKOWNIKA

### O empiryzmie i weryfikacji założeń (2026-07-08)
> "jak w fizyce nazywa sie takie obserwowanie co cos robi. ze reakcje to jedyna prawda swiata, cos co reaguje i to sie dotyczy wszystkiego. i wlasnie takie niescilosci teoretyczne z rzeczywistoscia MUSI badac. i w promptach i w systemach i w plikach zwlaszcza ofertowych itp."

### O tym co EYE ma widzieć (2026-07-08)
> "nawet ma widziec jakie prompty daja jakie wyniki bo wkoncu beda zapisywane racja? ma widziec wadliwe oferty. ma widziec plik jak liczyc ktory mowi zze nie wspiera tego i tego"

### O gradacji pewności (2026-07-08)
> "ai nie ma z gory mowic ze cos jest bledne lub nie. ma byc jak czlowiek i ma stopniowac pewnosc i popierac obserwacja"

### O tym że obserwacje nie zawsze są negatywne (2026-07-08)
> "wkoncu obserwacje nie musza byc zle jesli ktos stanowczo mowi ze WIDZI TO I TO I MOZE TO POWOD TEGO ALBO TO JEST POWOD TEGO"

### O zakresie EYE — wszystko co związane z AI (2026-07-08)
> "raczej mysle ze eye bedzie dogladal wszystkiego co jest zwiazane AI. bo nic innego pewnie nie dal by rady"

### O Discovery jako warstwie rozproszonej i informacjach bezdomnych (2026-07-07)
> "zrob nowy folder tylko dla tego nowego i 1 plik discovery podam przykład. chcialbym miec np cos takiego, wszedzie w calym systemie, czy to funkcje, prompty, pliki z poleceniami dla Ai. zawsze musi byc ktos kto patrzy i sam zbiera tarcie czy np te 5 pomyslow pokrywaja sie z 100% co mnie przytrafia."

> "taki wpis nawet nie ma swojego miejsca w nexusie. nawet nie mam miejsca w ktorym moglbym wrzucic taki ewenement zeby kiedys przebadac bo tutaj w plikach zostanie zapomniany."

---

## 1.1. CZYM JEST DISCOVERY

Discovery to **warstwa dostrzegawcza** Nexusa. Nie jest zakładką. Nie jest funkcją. Jest **rozproszonym systemem obserwacji i wyłapywania sygnałów**, obecnym wszędzie w systemie.

Discovery to **oczy i uszy Nexusa** — stale patrzy, zbiera tarcie, wyłapuje ewenementy i rozbieżności między planem a rzeczywistością.

### Metafora: EYE

Discovery działa jak **EYE** — stale obserwuje cały system. Nie potrzebuje własnego UI (chociaż może mieć miejsce do przeglądania zebranych sygnałów). Jego zadaniem jest **widzieć i informować**, a nie być widocznym.

---

## 1.2. PO CO ISTNIEJE

Discovery rozwiązuje problem:
> "Taki wpis nawet nie ma swojego miejsca w Nexusie. Nie mam miejsca w którym mógłbym wrzucić taki ewenement, żeby kiedyś przebadać, bo tutaj w plikach zostanie zapomniany."

Discovery jest **schronieniem dla ewenementów** — rzeczy które:
- Są dziwne, niepasujące, nieoczywiste
- Nie mają jeszcze swojego miejsca w systemie
- W plikach by przepadły

Discovery odpowiada na pytanie:
> "Czy te 5 pomysłów pokrywa się w 100% z tym co mnie przytrafia?"

Czyli: **czy to co myślę = to co się faktycznie dzieje**. Discovery łapie rozbieżności między planem a rzeczywistością.

---

## 1.3. JAK DZIAŁA — TRZY TRYBODY POZYSKIWANIA SYGNAŁÓW

Discovery pozyskuje sygnały na trzy sposoby. Wszystkie trzy trafiają do tego samego zbioru.

### Tryb 1: Automatyczny (EYE Agent) — Empiryczna weryfikacja założeń

EYE działa jak fizyk-eksperymentator. **Jedyną prawdą jest reakcja.** Nie to co założyłeś, nie to co jest w pliku konfiguracyjnym — tylko to co faktycznie się wydarzyło. EYE konfrontuje teorię z eksperymentem i szuka rozbieżności.

**Zasada empiryczna:**
> "Reakcje to jedyna prawda świata. Coś co reaguje — to dotyczy wszystkiego."

EYE nie ocenia czy coś jest "dobre" czy "złe". EYE stopniuje pewność w zależności od danych:
- **Niepewne (mało danych):** "Założenie X, dane pokazują Y — CHYBA coś tu nie gra. Oto obserwacje które to potwierdzają."
- **Pewne (twarde dane):** "Plik deklaruje że nie wspiera X, a system wysłał 5 ofert na X. To nie jest 'chyba' — to jest błąd. Albo plik kłamie, albo system go ignoruje."
- **Pozytywne (dane potwierdzają założenie):** "Widzę że prompt X konsekwentnie generuje oferty z nazwą firmy w 90% przypadków — to działa. I prawdopodobnie TO jest powód wyższej skuteczności tych ofert."

Jak człowiek: potrafi powiedzieć "to jest podejrzane" gdy nie ma pewności, "to jest źle" gdy dane są jednoznaczne, i "to działa, i prawdopodobnie dlatego" gdy widzi pozytywny wzorzec. Obserwacje nie zawsze są negatywne — czasem chodzi o stwierdzenie faktu i jego przyczyny.

**Jak to działa:**
1. EYE ładuje założenia z całego systemu: SPEC, konfiguracje, metadane, prompty
2. Przegląda dane empiryczne: wyniki promptów, oferty Useme i ich rezultaty, logi, zawartość plików, to co użytkownik ręcznie zgłasza do Discovery
3. Porównuje: **"teoria mówi X, ale dane pokazują Y"**
4. Jeśli widzi rozbieżność — wysyła sygnał do Discovery z **poziomem pewności** i **konkretnymi dowodami**

**EYE widzi wszystko:**
- Jakie prompty dają jakie wyniki (bo będą zapisywane w systemie)
- Wadliwe oferty — które dostały odpowiedź, które nie, co je różni
- Pliki które mówią "nie wspieram X" — a mimo to X gdzieś się pojawia
- System jako całość — "założono 5 kategorii, ale z danych wynika że potrzeba ich ~100"

**Przykład — weryfikacja promptu:**
- **Założenie:** Prompt `offer-generator-v2.txt` zawiera instrukcję o nazwie firmy
- **Dane empiryczne:** W wynikach promptu z ostatnich 10 ofert tylko 2 zawierają nazwę firmy
- **EYE:** "Prompt deklaruje użycie nazwy firmy, ale rzeczywiste wyniki pokazują że tylko 20% ofert ją zawiera. Albo prompt jest ignorowany przez model, albo coś nadpisuje tę instrukcję."

**Przykład — wadliwy plik konfiguracyjny:**
- **Plik `kalkulator.txt`:** "Uwaga: ten kalkulator nie wspiera budżetów poniżej 500zł"
- **Dane empiryczne:** W systemie jest 5 ofert wysłanych na zlecenia z budżetem <500zł
- **EYE:** "Plik deklaruje że nie wspiera małych budżetów, ale system mimo to wysyła na nie oferty. Albo plik jest ignorowany, albo warunek nie jest egzekwowany."

Wyzwalanie: ciągłe lub interwałowe (np. co godzinę).

### Tryb 2: Ręczny (User Input)
Użytkownik w dowolnym momencie, z dowolnego miejsca w Nexusie, może zapisać "tarcie":
- Skrót klawiszowy
- Szybkie pole tekstowe ("co poszło nie tak?")
- Złapanie myśli zanim ucieknie

To jest **manualne zgłaszanie ewenementów** — bez wchodzenia w żadną zakładkę, bez kontekstu. Byle gdzie, byle szybko.

### Tryb 3: Na przycisk / interwał (Pull)
Użytkownik ręcznie wyzwala agenta: "przeanalizuj teraz wszystko i powiedz co widzisz". Albo ustawia interwał: co godzinę, co dzień.

---

## 1.4. CO TRAFIA DO DISCOVERY

Discovery nie ocenia. Discovery przyjmuje wszystko:

| Typ sygnału | Przykład |
|-------------|----------|
| Tarcie | "próbowałem zrobić X, Y nie zadziałało" |
| Ewenement | "to jest dziwne, nie wiem dlaczego tak się stało" |
| Rozbieżność | "myślałem że prompt robi X, a robi Y" |
| Obserwacja agenta | "w 3 z 5 ofert brakuje nazwy firmy" |
| Pomysł | "przydałoby się żeby X robiło Y" |
| Anomalia | "ta oferta dostała odpowiedź mimo że jest słaba" |
| Cokolwiek | "nie wiem co to jest, ale warto zapamiętać" |

---

## 1.5. KLUCZOWY ZAKRES EYE

EYE nie jest ogólnym obserwatorem – jest wyspecjalizowanym agentem AI. Jego dziedziną jest wszystko, co dotyczy interakcji AI w twoim systemie: analiza promptów, wyników modelu, wydajności innych agentów, kontekstu czatów i jakości wyników AI. Chociaż może odczytywać logi systemowe lub dane dotyczące ofert, jego spostrzeżenia są zawsze formułowane z perspektywy rozumienia działania AI, a nie ogólnego debugowania kodu.

---

## 1.6. KLUCZOWA IDEA: ROZPROSZENIE

Discovery nie ma jednego miejsca w UI. Discovery jest **wszędzie**:
- W tle jako agent (EYE)
- Pod skrótem klawiszowym (ręczne zgłoszenie)
- W promptach i plikach (agent analizuje)
- W Useme (agent patrzy na oferty)
- Gdziekolwiek gdzie coś się dzieje

**"WSZĘDZIE CURWA."**

Jedno miejsce do **przeglądania** zebranych sygnałów może istnieć (jakiś widok listy), ale to nie jest wymagane na start. Na start wystarczy że sygnały są gdzieś zapisywane i mogą być potem użyte.

---

## 1.7. INFORMACJE BEZDOMNE (Meta-komentarze)

Istnieje kategoria informacji, która nie pasuje do żadnego istniejącego miejsca w Nexusie:
- "Nie wiem gdzie to zapisać"
- "Zauważyłem że warstwa X rozmawia z warstwą Y — czy to powinno tak działać?"
- Refleksje o samym systemie, o procesie, o interakcjach między warstwami

To są **informacje bezdomne**. Nie pasują do plików (bo znikną).

Discovery jest **domem dla informacji bezdomnych**. Jego kluczowa cecha: przyjmuje sygnał **bez wymagania kategorii, bez wymagania struktury, bez wymagania kontekstu**. Czysty tekst, byle gdzie, byle szybko. To nie jest funkcjonalność poboczna — to jest **główny powód istnienia Discovery**.

---

## 1.8. WIELOWĄTKOWOŚĆ JAKO WYMAGANIE SYSTEMOWE

Użytkownik często pisze wiadomości łączące wiele tematów naraz. Jedna wiadomość może zawierać 3-5 różnych wątków, przeskoków, powiązań.

EYE / Discovery musi umieć **rozbijać wielowątkowe wejścia** na pojedyncze sygnały. Jedno wejście (manualne lub z czatu) może wygenerować wiele osobnych obserwacji w Discovery.

---

## 1.9. DECYZJE — DISCOVERY

### Składowanie sygnałów — Osobna tabela SQLite

**Decyzja:** `discovery_signals` — osobna tabela.

```sql
CREATE TABLE discovery_signals (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    source TEXT NOT NULL,           -- 'manual', 'eye_agent', 'interval'
    source_detail TEXT,             -- np. 'chat_message', 'file_analysis', 'useme_offer'
    content TEXT NOT NULL,          -- treść sygnału (surowa)
    tags TEXT DEFAULT '[]',         -- JSON array
    status TEXT DEFAULT 'new',      -- 'new', 'triaged', 'promoted_to_research', 'dismissed'
    research_entry_id TEXT,         -- FK do research_entries jeśli promowany
    thread_id TEXT,                 -- ID oryginalnej wiadomości/jednostki źródłowej
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

### Discovery NIE bada — tylko przechowuje

- **Discovery** = schronienie dla surowych sygnałów. Łapie, trzyma, nie analizuje.

---

## 1.10. NIEROZSTRZYGNIĘTE — DISCOVERY

1. **Co zrobić z sygnałami po zebraniu?** — przeglądanie, filtrowanie, triage (promowanie do Research lub odrzucanie)
2. **Jak EYE agent ma działać technicznie?** — co analizuje, jak często, jak raportuje
3. **Czy Discovery ma własny widok w UI?** — prawdopodobnie tak, minimalistyczna lista sygnałów z filtrami
4. **Jak wygląda ręczne zgłaszanie tarcia?** — globalny skrót? szybkie okienko? (musi być zero-tarciowe — jedno kliknięcie, pole tekstowe, enter, znika)

---

# 2. SKŁAD MYŚLI — Przechowalnia

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

## 2.1. CZYM JEST SKŁAD MYŚLI

Skład Myśli to **czwarta warstwa Nexusa** — przechowalnia myśli, które obecnie nie mają zastosowania, ale staną się kluczowe w przyszłości.

### Czym JEST:
- Miejscem gdzie myśl czeka na swój idealny slot
- Zbiorem który AI automatycznie segreguje w większe grupy tematyczne
- Zasobem który EYE przeszukuje sesyjnie, a nie ciągle

---

## 2.2. MECHANIZM DZIAŁANIA: SESYJNY, NIE CIĄGŁY

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

## 2.3. JAK AI SEGREGUJE MYŚLI W WIĘKSZE GRUPY

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

## 2.4. OTWARTE PYTANIA — SKŁAD MYŚLI

1. **Jak AI ma wiedzieć że robi to prawidłowo?** — Nie wiadomo. To jest empiryczne. Trzeba testować na małej próbce, sprawdzać czy grupy mają sens, poprawiać prompt. Dokładnie jak z EYE.
2. **Próg podobieństwa dla grupowania** — za niski = wszystko w jednej grupie. Za wysoki = każda myśl w osobnej.
3. **Co z myślami które nie pasują do żadnej grupy?** — Zostają w "Nierozpoznane". Z czasem mogą utworzyć nową grupę.
4. **Czy grupy mogą się łączyć?** — Prawdopodobnie tak. Dwie małe grupy o podobnym temacie powinny się scalić.
6. **Jak składować technicznie?** — Osobna tabela `thought_depot`? Embeddingi w SQLite czy w zewnętrznej bazie wektorowej?

---

# 3. RESEARCH SPACE — Laboratorium

## CYTATY UŻYTKOWNIKA

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

### O strukturze wpisu — czat z AI (2026-07-07)
> "a co jesli mialbym czat ktory trwa no tak z 30 tur? a nie 1 zrodlo i 1 odpowiedz?"

### O agentach za plecami (2026-07-07)
> "ten czat albo na żywo albo poprzez wywołanie bedzie obserwowac inny bądź inni agenci z juz promptami. i oni beda brali co z tego Ai wyciagnelo. i co ja zaobserwowałem."

### O tym czego nie wiem — agenci wykrywają (2026-07-07)
> "oni sami maja to wykrywac, ja bede w czacie jawnie pisac to co nie mam pojecia i jesli w rozmowie nie roztrzygniemy np Ai nie powie mi a ja powiem aha no racja to znaczy ze to jest do roztrzygniecia"

### O kosztach AI (2026-07-07)
> "mam darmowego Ai, nawet teraz XD pisze z deepseek pro za darmo w trae wiec no"

### O promptach (2026-07-07)
> "a prompty juz sam ułoże, nie musisz sie tym martwic"

---

## 3.1. DECYZJE — RESEARCH SPACE

| Decyzja | Wybór |
|---------|-------|
| Gdzie w Nexusie? | Nowa zakładka `research` |
| Uniwersalne czy tylko Useme? | Uniwersalne narzędzie badawcze |
| Organizacja? | Osobne projekty badawcze |
| Struktura wpisu? | Czat z AI (wieloturowy) + źródła + agenci w tle |
| Wywołanie agentów? | Przycisk (live do dodania później) |
| Prompty agentów? | Użytkownik układa sam |
| Nierozstrzygnięte? | Agenci wykrywają automatycznie z rozmowy |
| Powiązania między wpisami? | Tagi + opcjonalne ręczne linki, bez grafu |
| Eksport? | Nie (istnieje ExportModal, można rozszerzyć) |
| Edycja wpisów? | Czat i źródła edytowalne. Obserwacje agentów: append-only z mechanizmem korekt |
| Stół niepewnych? | Per wpis + widok zbiorczy per projekt |
| Research Space vs UsemeContainer? | Osobne — `research` to narzędzie analityczne, `useme` to wykonawcze |

---

## 3.2. PROCES BADAWCZY (5 kroków)

1. **Zbieranie dowodów** — wrzucenie plików, oznaczenie rezultatów
2. **AI analizuje obok siebie** — porównuje wiele plików jednocześnie
3. **Użytkownik dodaje obserwacje** — pod analizą AI
4. **Wyciąganie wniosków** — PEWNE / NIE WIEM / POTWIERDZONE DANYMI
5. **Iteracja** — weryfikacja po czasie, łączenie wniosków z różnych wpisów

---

## 3.3. WSTĘPNY SCHEMAT BAZY DANYCH

**Tabele:**
- `research_projects` — kontener na projekty
- `research_entries` — pojedynczy wpis badawczy
- `research_sources` — pliki/źródła (ścieżka + treść)
- `research_chat_messages` — wiadomości czatu (user/assistant/system)
- `research_agent_observations` — co agenci wykryli (ai_finding/user_observation/unresolved)

**Decyzje techniczne:**
- SQLite, TEXT PRIMARY KEY, datetime('now'), snake_case, FK z CASCADE
- Pliki przechowywane jako ścieżka + content_text (opcja C)
- Obserwacje mają `agent_id` (NULL dozwolone) do śledzenia który agent co wykrył

---

> "juz pisalem że nie chce zeby byla 1 droga. bo ja nie tworzylem ich zeby wspolgrały, przypadkowo po prostu pomyslalem o badaniach a potem o feedbacku one nie powinny byc polaczone ale miec mozliwosc wspolpracy. rozumiesz. tak samo skład. latwiej tak nizeli robic polaczenia przez Ai ktorych nie widze w swojej glowie., a jak bede chcial polaczyc to to latwo zrobie"