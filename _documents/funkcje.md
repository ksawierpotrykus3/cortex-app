# NEXUS — FUNKCJE

> Wszystko co widzi użytkownik w Nexusie. Zero kodu, zero technikaliów.
> Ostatnia aktualizacja: 2026-06-13

---

## 1. MAPA MYŚLI (NexusCanvas)

Nieskończone płótno, na którym tworzysz notatki (węzły) i łączysz je liniami (połączenia).

### Węzły (notatki na mapie)
- **Tworzenie**: Dwuklik na płótnie → nowa notatka. Dwuklik w projekcie → notatka w tym projekcie.
- **Edycja tytułu**: Kliknij w tytuł → edytuj inline
- **Treść**: Może zawierać tekst, obrazy (wklejone z schowka), adnotacje
- **Przeciąganie**: Łap za róg → zmiana rozmiaru. Łap za środek → przesuwanie
- **Zwinięcie**: Strzałka w headerze → zwija/rozwija treść
- **Obrazy**: Tryb czystego obrazka (bez UI) — dla screenshotów
- **Kolorowe kropki**: Oznaczenia pewności/typu notatki (ThoughtMarker)
- **Usuwanie**: Najechanie → kosz
- **Teleport**: Kliknięcie notatki w lewym panelu → mapa centruje się na niej

### Połączenia (krawędzie)
- **Tworzenie**: Przeciągnij z jednego węzła na drugi
- **Usuwanie**: Najechanie na linię → klik → usunięta
- **Strzałki**: Kierunek połączenia (A → B)

### Projekty
- Grupowanie notatek w obszary (np. "Q3 Plan", "Research")
- Kliknij projekt → centruje mapę na nim
- Dwuklik w projekcie → nowa notatka w projekcie

---

## 2. ZADANIA (LabTodo / Lab Tasks)

Tablica zadań z sekcjami: Unresolved, In Progress, Resolved.

### Task
- Tytuł, opis, priorytet (Low/Medium/Critical), status, lista
- **Edycja**: Kliknij ołówek → edytuj inline
- **Przełączanie statusu**: Checkbox → cykl Unresolved → Resolved
- **Dodawanie**: Szybki formularz na górze (Enter = dodaj)

### Listy
- Grupowanie tasków (np. "Main to do list", "Shopping")
- **Tworzenie**: Przycisk "New List"
- **Zmiana nazwy**: Kliknij w nazwę listy → edytuj
- **Przełączanie**: Kliknij listę w sidebarze → widzisz jej taski
- **Usuwanie**: Kosz na hover (oprócz głównej listy)

### Filtry
- Dropdown statusu: All / Unresolved / In Progress / Resolved
- Dropdown priorytetu: All / Critical / Medium / Low

---

## 3. PISANIE (LabWriting)

Edytor manuskryptów z zaawansowanym zarządzaniem.

### Manuskrypty
- Osobne dokumenty pisarskie, każdy z własnym tytułem, opisem, tagami
- **Tworzenie**: Przycisk "New Draft"
- **Usuwanie**: Kosz na hover w lewym panelu
- **Auto-resume**: Otwiera ostatnio edytowany manuskrypt

### Zakładki (Tabs)
- Wiele manuskryptów otwartych naraz jako zakładki
- Kliknij zakładkę → przełącz. Kliknij X → zamknij

### Foldery
- Grupowanie manuskryptów w foldery

### Łuki odpowiedzi (Reply)
- Możliwość odpowiedzi na konkretny fragment/akapit
- Wizualne połączenie między odpowiedziami

### Branchowanie / Gablota
- Odsyłacze do źródeł (SourceReference)
- Wiadomość dla AI (aiContext) — kontekst dla agenta przy analizie

### Adnotacje i Kropki
- NexusAnnotation — przypisy do fragmentów
- ThoughtMarker — kolorowe kropki pewności (pewien/niepewien/do sprawdzenia)

---

## 4. WIEDZA (WikiPanel)

Baza wiedzy z tagami i kategoriami.

- Artykuły Wiki: tytuł, treść, tagi, kategoria
- Tworzenie: formularz z polami
- Tagi do grupowania treści
- **Zostanie zastąpione przez agentów + baza outputów**

---

## 5. MAPA (zmiany/ChangesPanel)

Historia zmian w projekcie — co, kto, kiedy zmienił.

- Lista zmian z timestampem
- Podgląd diffa (różnic) dla każdej zmiany
- Filtrowanie po dacie, autorze, typie

---

## 6. AGENCI AI (warsztat AI)

System agentów AI — własne, konfigurowalne modele z promptami i triggerami.

### Lista agentów
- Siatka kart: nazwa, opis, status, kolor, tagi
- Szukaj / filtruj po tagach
- **Włącz/wyłącz** przełącznikiem

### Tworzenie agenta
- Z szablonu (12 presetów):
  - **Streszczacz** — Ctrl+Shift+S
  - **Korektor** — Ctrl+Shift+K
  - **Brainstormer** — Ctrl+Shift+B
  - **Analityk** — Ctrl+Shift+A
  - **Tłumacz** — Ctrl+Shift+T
  - **Research** — Ctrl+Shift+R
  - **Code Reviewer** — Ctrl+Shift+Q
  - **Code Generator** — Ctrl+Shift+G
  - **Debugger** — Ctrl+Shift+D
  - **Redaktor** — Ctrl+Shift+E
  - **Formatter** — Ctrl+Shift+F
  - **Nauczyciel** — Ctrl+Shift+H
- Od zera: pusta konfiguracja

### Konfiguracja agenta
- **Nazwa, opis, kolor, tagi**
- **Prompt** (szablon ze zmiennymi):
  - `{{SCHOWEK}}` — zawartość schowka
  - `{{DATA}}` — dzisiejsza data
  - `{{CZAS}}` — aktualny czas
  - `{{NOW}}` — data i czas ISO
  - `{{INPUT:ścieżka}}` — zawartość pliku
  - `{{SCREENSHOT}}` — ostatni screenshot
  - `{{TEXT:nazwa}}` — pole do wypełnienia
  - `{{NODE:tytuł}}` — zawartość notatki
  - `{{OUTPUT:agent_id}}` — output innego agenta
  - `{{BRANCH}}` — nazwa gałęzi git
  - `{{KOD:ścieżka}}` — kod z pliku
  - `{{WEB:URL}}` — treść strony WWW
  - `{{AGENT_NAME}}` — nazwa agenta
  - `{{CONTEXT}}` — kontekst ze źródeł
- **Model AI**: provider (Gemini, OpenRouter, Ollama), model, temperatura, max tokens
- **Trigger**: manualny / hotkey / schowek / screenshot
- **Uprawnienia**: max tokenów na uruchomienie, max depth
- **Źródła kontekstu**: notatki, baza wiedzy, historia outputów, taski
- **Tryb wykonania**: live (normalny) / sandbox (izolowany proces)

### Uruchamianie agenta
- Ręcznie: przycisk "Run" lub hotkey
- Automatycznie: workflow (np. po approve outputu)
- Wynik widoczny w panelu outputów (Changelog)

### Outputy agentów
- Streaming na żywo
- Approve / Reject / Rating
- Historia outputów
- Dry-run (podgląd bez zapisu)

---

## 7. WORKFLOWY (WorkflowEditor)

Automatyzacje: trigger → warunek → akcja.

### Trigger
- Manualny
- Po approve outputu
- Po odrzuceniu outputu
- Po zakończeniu agenta
- Harmonogram (cron)
- Webhook

### Warunki (bramki IF/THEN)
- Rating > X
- Output zawiera "ERROR"
- Tokens > X
- I wiele więcej

### Akcje
- Webhook (POST na URL)
- Zapisz do pliku
- Utwórz task
- Uruchom agenta
- Dodaj do Wiki
- Kopiuj do schowka
- Powiadomienie
- Call API

### Tryby
- **Sandbox** (dry-run) — podgląd co się stanie
- **Live** — faktyczne wykonanie

---

## 8. PIPELINE (PipelineEditor)

DAG (Directed Acyclic Graph) — sekwencje i równoległe wykonywanie agentów.

- Węzły: agenty, webhooki, warunki
- Krawędzie: przepływ danych
- Bulk select / glob
- Dry-run przed wykonaniem

---

## 9. SCHOWEK + SCREENSHOTY

- **Ctrl+V** na płótnie → wkleja obraz z schowka
- Obraz → Gemini OCR → tekst notatki
- Screenshoty jako osobne węzły (tryb clean image)

---

## 10. DRAFT ZONE — Human Feedback

Panel do korygowania outputów agentów.

- Lista outputów do review
- Approve / Reject z komentarzem
- Walidacja formularza
- Zapis feedbacku do pliku JSONL

---

## 11. COMMAND PALETTE (Ctrl+K)

Szybkie komendy:
- Tworzenie agenta, workflowu, pipeline'u
- Przełączanie widoków
- Ustawienia, eksport, git
- 30+ komend

---

## 12. GIT

Integracja z GitHub:
- Status (zmienione pliki, branch)
- Commit + Push
- Pull
- Log (historia commitów)
- Branche (switch, create, merge)
- Harmonogram auto-commit/push
- Ustawienia: URL repo, token, autor

---

## 13. USTAWIENIA (SettingsModal)

- API keys (Gemini, OpenRouter, Ollama)
- Git
- Ogólne (theme, język)

---

## 14. INNE

- **LogViewer** — logi agentów w wirtualizowanej liście
- **Szukaj semantyczny** — wyszukiwanie po treści notatek
- **Eksport** — 3 tryby: JSON, Markdown, PDF z wyborem zakresu
- **Feedback** — "Brakuje mi..." z kontekstem i ratingiem
- **Diff Viewer** — podgląd różnic między wersjami
- **Kill Switch** — awaryjne zatrzymanie wszystkich agentów
- **KeyDir** — szybki dostęp do często używanych rzeczy
- **Sandbox** (MicroVM) — agenty w izolowanym procesie
- **Obrazy z schowka** → OCR → notatka
