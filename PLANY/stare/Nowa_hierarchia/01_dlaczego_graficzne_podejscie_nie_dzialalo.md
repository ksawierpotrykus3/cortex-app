# Dlaczego poprzednie graficzne podejście nie zadziałało? (Diagnoza i powiązanie z plikami)

> Zapis ustaleń na podstawie rozmowy i analizy problemów z poprzednim interfejsem graficznym Nexusa. Tylko słowa użytkownika i powiązanie z istniejącymi plikami, bez dodawania nowych wymysłów AI.

---

## 1. Surowy zapis wypowiedzi użytkownika

> nie wiem sam. za duzo pisalem w 1notatKACh. i duzo rzeczy musialem pisac na tym sammy poziomie co inne nody mimo ze sa w tym samym projekcie. i musialem pisac w samej notatce jakies informacje dla AI. albo tworzyc kategoria informacja dla Ai i polaczyc z czyms. t obylo chujowe.
> nic nie mialo hierarchii wszystko mialo ta sama wysokosc i waznosc co inne.
> Dodatkowo nie wspieralo to w ogole tego co pisalem ze cos bylo albo brudne, albo na czysto nie mozna bylo w nexusie bez wy7chodzenia do innego AI zostac i planowac bez usuwania niczego.
> tez zawsze zapominalem co juz pisalem i nie chialo mi siecytac tych dlugich gowien bo wiele tam bylo rzeczy ktore miescili sie z roznych mysl.i itp dzialow i tematow ktore przeplatalem a powinnyh miec swoje miejsca
> jednoczesnie brakuje mi sposobu zeby albo miec miejsce ktore mnie bada albo miec cos co mnie bada na podstawie kazdej interakcji. zbiera te informacje, ale bez poprawnego promptu nie bedzie to robilo dobrze bez drogiego modelu
> 
> ogolnie czuje ze juz to opisalem wiec oczekuje ze w plikach wszystko juz jest na ten temat

---

## 2. Otoczka analityczna — Zestawienie z istniejącymi plikami

Zestawienie diagnozy użytkownika z problemami opisanymi w dokumentacji z folderu `PLANY/nexus_rebranding/`:

### 1. "Brak hierarchii / wszystko na tym samym poziomie"
* **Odnośnik w plikach:** Zapisane w `04_otwarte_problemy.md`: *"Problem hierarchii projektów — obecny canvas to 20 identycznych kwadratów różniących się tylko tekstem."*

### 2. "Za dużo pisania w 1 notatce / przeplatanie tematów / nie chciało mi się tego czytać"
* **Odnośnik w plikach:** Zapisane w `02_jak_dziala_uzytkownik.md`: *"Problem formatu — nawet podsumowania w punktach nie chce czytać"* oraz `01_decyzje.md`: *"Wszystko musi mieć swoje miejsce"* (żeby nie było wrzucane do jednego wora).

### 3. "Musiałem pisać informacje dla AI / tworzyć kategorie"
* **Odnośnik w plikach:** Zapisane w `01_decyzje.md`: *"DITA/sztywne typy — do wyrzucenia"* i `04_otwarte_problemy.md`: *"Kategoria nie oddaje — system kategorii ogólnie nie ogarnia."*

### 4. "Nie wspierało przejścia brudne → na czysto bez usuwania"
* **Odnośnik w plikach:** Zapisane w `01_decyzje.md` (Pkt 8): *"Projekt NIE MOŻE istnieć tylko jako brudny albo wykonany. Nexus musi wspierać ewolucję z brudnego do zaplanowanego BEZ USUWANIA niczego — ze składowaniem staroci."*

### 5. "Brakuje mi sposobu żeby coś mnie badało"
* **Odnośnik w plikach:** Zapisane w `04_otwarte_problemy.md`: *"Meta-problem projektowania Nexusa — potrzebowałby systemu który go monitoruje"* oraz w `03_pomysly_systemowe.md`: *"Chat z boku, który monitoruje to na co patrzy"*.

---

## 3. Główny wniosek (Podsumowanie diagnozy)

Wiemy na 100%, że poprzedni graficzny interfejs wyłożył się na tym, że **zmuszał użytkownika do robienia wszystkiego (zrzutu myśli, instrukcji dla AI, oznaczania stanu, budowania struktury) w jednym, płaskim widoku, w wielkich klocach tekstu.**

Skoro krokiem numer 1 ma być nowa reprezentacja graficzna projektów rozwiązująca te błędy, kluczowym otwartym pytaniem (zgodnie z załączoną sesją) pozostaje punkt wejścia:
* Gdzie fizycznie w nowym Nexusie użytkownik ma wylewać z siebie długie, niepoukładane myśli z przeplatanymi tematami, aby odciążyć sam wykres wizualny (strukturę)?
* Czy ma się to odbywać przez pisanie w "chacie z boku" monitorującym wykres, z którego AI wyciąga elementy na graf, czy też w formie osobnego brudnopisu?
