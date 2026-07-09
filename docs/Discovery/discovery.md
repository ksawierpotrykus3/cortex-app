# DISCOVERY
**Data: 2026-07-07**
**Status: ETAP 0 — KONCEPCJA**

> ⚠️ **DISCLAIMER: WSZYSTKO SUBJECT TO CHANGE.**
> Ten plik został wygenerowany przez AI podczas rozmowy. Użytkownik nie czytał tego w całości. To są surowe notatki — nic nie jest zatwierdzone, nic nie jest ostateczne. Każda sekcja może zostać wywalona lub przepisana od zera.

---

## CYTATY UŻYTKOWNIKA (dosłowne)

### O empiryzmie i weryfikacji założeń (2026-07-08)
> "jak w fizyce nazywa sie takie obserwowanie co cos robi. ze reakcje to jedyna prawda swiata, cos co reaguje i to sie dotyczy wszystkiego. i wlasnie takie niescilosci teoretyczne z rzeczywistoscia MUSI badac. i w promptach i w systemach i w plikach zwlaszcza ofertowych itp."

### O tym co EYE ma widzieć (2026-07-08)
> "nawet ma widziec jakie prompty daja jakie wyniki bo wkoncu beda zapisywane racja? ma widziec wadliwe oferty. ma widziec plik jak liczyc ktory mowi zze nie wspiera tego i tego"

### O gradacji pewności (2026-07-08)
> "ai nie ma z gory mowic ze cos jest bledne lub nie. ma byc jak czlowiek i ma stopniowac pewnosc i popierac obserwacja"

### O zakresie EYE — wszystko co związane z AI (2026-07-08)
> "raczej mysle ze eye bedzie dogladal wszystkiego co jest zwiazane AI. bo nic innego pewnie nie dal by rady"

### O Discovery jako warstwie rozproszonej i informacjach bezdomnych (2026-07-07)
> "zrob nowy folder tylko dla tego nowego i 1 plik discovery podam przykład. chcialbym miec np cos takiego, wszedzie w calym systemie, czy to funkcje, prompty, pliki z poleceniami dla Ai. zawsze musi byc ktos kto patrzy i sam zbiera tarcie czy np te 5 pomyslow pokrywaja sie z 100% co mnie przytrafia."

> "taki wpis nawet nie ma swojego miejsca w nexusie. nawet nie mam miejsca w ktorym moglbym wrzucic taki ewenement zeby kiedys przebadac bo tutaj w plikach zostanie zapomniany."

---

## 1. CZYM JEST DISCOVERY

Discovery to **oczy i uszy Nexusa** — stale patrzy, zbiera tarcie, wyłapuje ewenementy i rozbieżności między planem a rzeczywistością.

### Metafora: EYE

Discovery działa jak **EYE** — stale obserwuje cały system. Nie potrzebuje własnego UI (chociaż może mieć miejsce do przeglądania zebranych sygnałów). Jego zadaniem jest **widzieć i informować**, a nie być widocznym.

---

## 2. PO CO ISTNIEJE

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

## 3. JAK DZIAŁA — TRZY TRYBODY POZYSKIWANIA SYGNAŁÓW

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
- Założenia systemowe — "ten wniosek CHYBA jest błędny, bo dane z ostatniego tygodnia pokazują co innego"
- System jako całość — "założono 5 kategorii, ale z danych wynika że potrzeba ich ~100"

**Przykład — weryfikacja założenia:**
- **Założenie (z badania):** "Oferty z personalizacją (nazwa firmy) mają wyższą skuteczność"
- **Dane empiryczne (ostatni tydzień):** 3/5 odpowiedzi przyszło na oferty BEZ nazwy firmy
- **EYE:** "Jest przesłanka że to założenie może być błędne. Pewność: średnia (tylko 5 próbek, ale trend przeciwny do założenia). Proponuję ponowne badanie za 2 tygodnie z większą próbką."

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

## 4. CO TRAFIA DO DISCOVERY

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

### Kluczowy zakres: Wszystko, co związane z AI
EYE nie jest ogólnym obserwatorem – jest wyspecjalizowanym agentem AI. Oznacza to, że jego dziedziną jest wszystko, co dotyczy interakcji AI w twoim systemie: analiza promptów, wyników modelu, wydajności innych agentów, kontekstu czatów i jakości wyników AI. Chociaż może odczytywać logi systemowe lub dane dotyczące ofert, jego spostrzeżenia są zawsze formułowane z perspektywy rozumienia działania AI, a nie ogólnego debugowania kodu.
- W tle jako agent (EYE)
- Pod skrótem klawiszowym (ręczne zgłoszenie)
- W promptach i plikach (agent analizuje)
- W Useme (agent patrzy na oferty)
- Gdziekolwiek gdzie coś się dzieje

**"WSZĘDZIE CURWA."**

Jedno miejsce do **przeglądania** zebranych sygnałów może istnieć (jakiś widok listy), ale to nie jest wymagane na start. Na start wystarczy że sygnały są gdzieś zapisywane i mogą być potem użyte.

---

## 7. NAJWAŻNIEJSZY PRZYPADEK: INFORMACJE BEZDOMNE (Meta-komentarze)

Istnieje kategoria informacji, która nie pasuje do żadnego istniejącego miejsca w Nexusie:
- "Nie wiem gdzie to zapisać"
- "Zauważyłem że warstwa X rozmawia z warstwą Y — czy to powinno tak działać?"
- "Ten plik discovery.md jest fajny, ale czy na pewno to jest właściwe miejsce?"
- Refleksje o samym systemie, o procesie, o interakcjach między warstwami

To są **informacje bezdomne**.

Discovery jest **domem dla informacji bezdomnych**. Jego kluczowa cecha: przyjmuje sygnał **bez wymagania kategorii, bez wymagania struktury, bez wymagania kontekstu**. Czysty tekst, byle gdzie, byle szybko. To nie jest funkcjonalność poboczna — to jest **główny powód istnienia Discovery**.

## 8. WIELOWĄTKOWOŚĆ JAKO WYMAGANIE SYSTEMOWE

Użytkownik często pisze wiadomości łączące wiele tematów naraz. Jedna wiadomość może zawierać 3-5 różnych wątków, przeskoków, powiązań.

EYE / Discovery musi umieć **rozbijać wielowątkowe wejścia** na pojedyncze sygnały. Jedno wejście (manualne lub z czatu) może wygenerować wiele osobnych obserwacji w Discovery.

To nie jest tylko problem parsowania — to jest wymaganie architektoniczne. Struktura danych w Discovery musi wspierać relację "wiele sygnałów z jednego źródła".

---

## 9. DECYZJE

### 9.1. Składowanie sygnałów — Osobna tabela SQLite

**Decyzja:** `discovery_signals` — osobna tabela.

Każdy sygnał (z EYE, ręczny, z interwału) trafia do jednej tabeli.

Wstępna struktura:
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

**Kluczowe pola:**
- `source` — skąd przyszedł sygnał
- `source_detail` — doprecyzowanie (np. który plik, który prompt)
- `status` — cykl życia sygnału: nowy → przejrzany → promowany do Research lub odrzucony
- `research_entry_id` — link do Research Space gdy sygnał został rozwinięty w badanie
- `thread_id` — wspólny identyfikator dla sygnałów pochodzących z jednego wielowątkowego wejścia

---

## 10. NIEROZSTRZYGNIĘTE

1. **Co zrobić z sygnałami po zebraniu?** — przeglądanie, filtrowanie, triage (promowanie do Research lub odrzucanie)
2. **Jak EYE agent ma działać technicznie?** — co analizuje, jak często, jak raportuje
3. **Czy Discovery ma własny widok w UI?** — prawdopodobnie tak, minimalistyczna lista sygnałów z filtrami
4. **Jak wygląda ręczne zgłaszanie tarcia?** — globalny skrót? szybkie okienko? (musi być zero-tarciowe — jedno kliknięcie, pole tekstowe, enter, znika)