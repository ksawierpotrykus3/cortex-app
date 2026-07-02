# Planer Automatyczny: Chain of Thought i Skryptowy Changelog (Krok 02)

**Status:** Wydzielony etap 2 (Automat do szybkiego tworzenia mapy dla projektów z Useme).
**Założenie:** AI przy generowaniu 15+ nodów na raz popełnia błędy i sprzeczności. Wymuszamy monolog Chain of Thought przed wypluciem JSON-a, a historię zmian zapisuje wyłącznie skrypt w TypeScript.

---

## 1. Dlaczego standardowe AI gubi się przy planowaniu?
Standardowe AI gubi kontekst, kiedy musi wymyślić całą mapę i wygenerować gotowy obiekt JSON w jednym zapytaniu. Bez wcześniejszego wypisania kroków model zapomina o warunkach z pliku SPEC i zapętla relacje między nodami.

---

## 2. Rozwiązanie: Wymuszenie Chain of Thought
Przed wygenerowaniem operacji na mapie model (np. DeepSeek V4 Pro) ma wymuszony blok analityczny w XML:

```xml
<spec_analysis>
Wypisanie kluczowych warunków z pliku SPEC (np. limity budżetu, wymóg bazy SQLite).
</spec_analysis>

<logic_draft>
Kolejność kroków na mapie: Krok 1 -> Krok 2 -> Krok 3.
</logic_draft>

<conflict_check>
Sprawdzenie spójności: Czy Krok 2 ma wejście z Kroku 1? Czy plan nie łamie zasad ze SPEC?
</conflict_check>
```

Dopiero po zamknięciu `</conflict_check>` AI generuje JSON z listą operacji dla mapy.

---

## 3. Wywołanie na Kliknięcie
* **Czat:** Pisanie na czacie nie zmienia mapy.
* **Przycisk `[Generuj mapę]`:** Kliknięcie zbiera treść pliku SPEC, historię czatu oraz aktualne nody na mapie i wysyła zapytanie do planera.

---

## 4. Akceptacja w widoku Diff
Wygenerowane nody nie pojawiają się od razu na mapie. Wyświetla się podgląd zmian:

```text
[+ DODAJE] Węzeł: Integracja API KRS (Powód: Weryfikacja przychodów)
           └─ Źródło: Wiadomość #msg_102
[+ DODAJE] Relacja: API KRS -> Baza SQLite
[- USUWA]  Węzeł: Ręczna weryfikacja
```

Zatwierdzenie zmian (`[Zatwierdź]`) zapisuje operacje w bazie SQLite i odświeża mapę.

---

## 5. Changelog pisany przez skrypt (a nie przez AI)

### Zasada: AI nie pisze historii zmian
AI pozostawione same sobie zmyśla sygnatury czasowe i pomija usunięcia nodów.

### Rozwiązanie: Kod w TypeScript
Zapis do historii (`experimental_changelog`) wykonuje wyłącznie skrypt systemowy po zatwierdzeniu widoku Diff:
1. **Transakcja w SQLite:** Skrypt aktualizuje tabele `experimental_nodes` i `experimental_edges`.
2. **Wpis w Changelogu:** Skrypt dodaje dokładny log operacji z powiązaniem do wiadomości źródłowej (`source_message_id`).
3. **Śledzenie w czacie:** Przy wiadomości `#msg_102` pojawia się oznaczenie: `[Węzeł: Integracja API KRS]`. Nawet jeśli węzeł zostanie później usunięty z mapy, ślad w historii pozostaje na stałe.

---

## 6. Harmonogram Kodu (Etap 2)

### Zadanie 1: Silnik Planera i Parser CoT
* `[NEW] src/main/ai/PlannerEngine.ts`: Obsługa zapytania z wymuszeniem znaczników XML oraz wycinanie czystego JSON-a.

### Zadanie 2: Skryptowy Diff i Changelog
* `[NEW] src/main/core/DiffEngine.ts`: Weryfikacja propozycji AI, zapis transakcyjny w SQLite i generowanie logów w `experimental_changelog`.

### Zadanie 3: Widok Diff i oznaczenia w czacie
* `[NEW] src/components/experimental/PlannerDiffModal.tsx`: Widok akceptacji zmian na mapie.
* `[MODIFY] src/components/ExperimentalWorkspace.tsx`: Podłączenie akcji generowania i wyświetlanie oznaczeń przy wiadomościach w czacie.
