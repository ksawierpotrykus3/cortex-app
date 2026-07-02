# Tryb Eksperymentalny: Baza SQLite, Edytor SPEC i Planowanie z Czatu (Krok 01)

**Status:** Dostosowano do kodu Nexusa (`StorageEngine.ts` + `better-sqlite3`).
**Założenie:** Zapisujemy pełną historię i źródła zmian w bazie relacyjnej, aby eliminować błędy modeli AI i utratę wątków. Każda zmiana na mapie lub w pliku SPEC wymaga zatwierdzenia przez Diff.

---

## 0. Rozbudowa Bazy Danych (`StorageEngine.ts`)

Rozszerzamy schemat w `StorageEngine.ts` o nowe tabele z relacjami i śledzeniem wiadomości (`source_message_id`):

```sql
-- Projekty eksperymentalne
CREATE TABLE IF NOT EXISTS experimental_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  spec_content TEXT DEFAULT '', -- Treść pliku SPEC (JSON/Markdown)
  ai_config TEXT DEFAULT '{}',  -- Wybrane modele i prompty dla agentów AI
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Wiadomości w czacie
CREATE TABLE IF NOT EXISTS experimental_chat_messages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'user' | 'ai' | 'system'
  content TEXT NOT NULL,
  extracted_to_spec INTEGER DEFAULT 0,
  extracted_to_canvas INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES experimental_projects(id) ON DELETE CASCADE
);

-- Nody na mapie
CREATE TABLE IF NOT EXISTS experimental_nodes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  x REAL DEFAULT 0,
  y REAL DEFAULT 0,
  width REAL DEFAULT 240,
  height REAL DEFAULT 120,
  collapsed INTEGER DEFAULT 0,
  source_message_id TEXT, -- ID wiadomości z czatu
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES experimental_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (source_message_id) REFERENCES experimental_chat_messages(id) ON DELETE SET NULL
);

-- Relacje między nodami
CREATE TABLE IF NOT EXISTS experimental_edges (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  source_node_id TEXT NOT NULL,
  target_node_id TEXT NOT NULL,
  label TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES experimental_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (source_node_id) REFERENCES experimental_nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (target_node_id) REFERENCES experimental_nodes(id) ON DELETE CASCADE
);

-- Historia zmian (Changelog)
CREATE TABLE IF NOT EXISTS experimental_changelog (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  action_type TEXT NOT NULL, -- 'CREATE' | 'UPDATE' | 'DELETE'
  entity_type TEXT NOT NULL, -- 'NODE' | 'EDGE' | 'SPEC'
  entity_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  source_message_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES experimental_projects(id) ON DELETE CASCADE
);
```

---

## 1. Architektura UI i Mechanika Działania

### A. Panel SPEC i Analizator SPEC (AI #2)
* **Swobodny edytor:** Zwijany panel boczny z czystym tekstem (JSON lub Markdown).
* **Kontrola tokenów:** Analizator SPEC uruchamia się domyślnie co 10 wiadomości. W UI widoczny jest licznik (`[Bufor SPEC: 6/10]`).
* **Akcje manualne:** Przycisk `[Resetuj bufor]` zeruje licznik do `0/10` po luźnej rozmowie. Przycisk `[Analizuj teraz]` natychmiast sprawdza wiadomości i proponuje dopisanie punktów do SPEC.
* **Akceptacja zmian:** Każda zmiana w pliku SPEC wymaga zatwierdzenia w widoku Diff.

### B. Planowanie z Czatu (AI #1 i AI #3)
* **Dedykowany widok (`ViewMode: experimental`):** Pełnoekranowy układ z selektorem projektów, tablicą, paneli SPEC i czatu.
* **Nowy projekt:** Jeśli brak projektów w bazie, modal wymaga wpisania nazwy przy wejściu.
* **Czat AI (AI #1):** Służy tylko do rozmowy. Nie zmienia mapy samodzielnie. Nad czatem znajduje się przełącznik modeli (`DeepSeek V4 Pro` lub `DeepSeek V4 Flash`).
* **Planer Mapy (AI #3):** Uruchamiany przyciskiem `[Aktualizuj mapę z czatu]`. Analizuje rozmowę i proponuje operacje dodania, modyfikacji lub usunięcia nodów.
* **Kontekst Zaznaczenia:** Zaznaczenie nodów z klawiszem `Shift` lub ramką podświetla je na mapie i wyświetla pasek `[Wybrano: 3 nody]`. Ich treść jest automatycznie dodawana do czatu i planera.
* **Akceptacja Diff:** Propozycje zmian na mapie trafią do bazy dopiero po zatwierdzeniu w oknie Diff (`DiffModal`).

### C. Ustawienia Modeli i Czyszczenie Providerów
* **Czyszczenie w `schema.ts`:** Usuwamy zbędne providery z `DEFAULT_PROVIDERS`. Zostawiamy wyłącznie `DeepSeek V4 Flash` i `DeepSeek V4 Pro` ze skonfigurowanymi kluczami.
* **Ustawienia AI (`[Ustawienia AI]`):** Panel umożliwiający zmianę modelu i edycję promptu systemowego dla każdego z 3 agentów osobno w danym projekcie (zapis w `experimental_projects.ai_config`).

### D. Planer Automatyczny (Tryb 2)
Pełny automat do budowy 15+ nodów na jedno kliknięcie z monologiem Chain of Thought opisano w pliku:
**`PLANY/02_AUTOMATYCZNY_PLANER_TRYB_EKSPERYMENTALNY.md`**

---

## 2. Harmonogram Kodu (Etap 1)

### Zadanie 1: Baza Danych i Widok Główny
* `[MODIFY] src/main/storage/StorageEngine.ts`: Dodanie tabel w `initSchema()` i metod IPC.
* `[MODIFY] src/shared/types/schema.ts`: Zostawienie tylko konfiguracji DeepSeek w `DEFAULT_PROVIDERS`.
* `[MODIFY] src/types.ts`: Typy dla widoku i bazy.
* `[MODIFY] src/components/TopNavigation.tsx`: Przełącznik widoku `experimental`.
* `[NEW] src/components/ExperimentalWorkspace.tsx`: Główny widok z mapą, paneli SPEC i czatem.

### Zadanie 2: Logika SPEC i Zaznaczenia
* Zapis SPEC i konfiguracji AI do bazy.
* Licznik bufora SPEC i przyciski akcji.
* Przekazywanie zaznaczonych nodów (`selectedIds`) do czatu i planera.

---

## 3. Testy Weryfikacyjne
1. Sprawdzenie pragma `table_info` w `nexus.db`.
2. Weryfikacja powiązania `source_message_id` w SQLite po wygenerowaniu noda z czatu.
3. Test wstrzymania zapisu w bazie do momentu zatwierdzenia w oknie Diff.
