# NEXT TASK — PRZEKAŹNIK DLA AI

## Projekt: Nexus (Electron + Vite + React 19 + TypeScript)
## Lokalizacja: `c:\Users\Ksawier\Pictures\Screenshots\nexus\`
## Zadanie: **#23 Integracja z Gitem** (~40h)

---

## WAŻNE ZASADY PRACY
- Zanim COKOLWIEK zmienisz — PRZECZYTAJ plik który zamierzasz edytować
- Po każdej zmianie: `npx tsc --noEmit` — musi być **0 błędów**
- Potem: `npx vitest run` — musi być **wszystko zielone**
- **NIGDY nie zmieniaj konfiguracji** (package.json, tsconfig, electron-vite, tailwind)
- **NIGDY nie zmieniaj typów w shared/types** — dodaj tylko jeśli absolutnie konieczne
- Po zakończeniu zadania zapytaj użytkownika słowami: **"#23 zrobione. Robimy #24?"**
- Jeśli natrafisz na błąd który Cię blokuje >15min — zapytaj usera a nie kombinuj na ślepo

---

## STAN OBECNY

### Co jest zrobione:

1. **GitPanel.tsx** — panel UI z: statusem, commit, push, pull, log, branch (switch, create, merge), harmonogram
   - [src/components/GitPanel.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/GitPanel.tsx)

2. **GitSettingsPanel.tsx** — ustawienia: URL repo, token, autor, auto-commit, harmonogram
   - [src/components/GitSettingsPanel.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/components/GitSettingsPanel.tsx)

3. **Handlery IPC** — kompletne (linie 819-1150):
   - git:get-config, git:set-config, git:test-connection
   - git:status, git:log
   - git:commit, git:push, git:pull
   - git:branch-list, git:branch-switch, git:branch-create, git:merge
   - git:diff, git:schedule-status, git:schedule-toggle
   - [src/main/ipc/ElectronIpcBridge.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/main/ipc/ElectronIpcBridge.ts)

4. **Preload bridge** — git API zdefiniowane (linie 91-105)
   - [src/main/preload.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/main/preload.ts)

5. **Typy IPC** — kanały zdefiniowane (linie 62-77)
   - [src/shared/types/ipc.ts](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/shared/types/ipc.ts)

6. **Integracja z App.tsx** — GitPanel renderowany w widoku 'git'
   - [src/App.tsx](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/src/App.tsx)

### Czego brakuje / co wymaga uwagi:

1. **Brak testów** — GitPanel.tsx i GitSettingsPanel.tsx nie mają testów
2. **Nieużywany import** w ElectronIpcBridge.ts — sprawdzić `idb-keyval` i `del`
3. **key={i}** w .map() w GitPanel.tsx — stable keys zamiast index (entry.path, entry.hash, branch.name)
4. **console.log → console.debug** — logi produkcyjne
5. **Możliwe bugi** w handlerach IPC — nie były testowane end-to-end
6. **Niespójne zmienne CSS** — GitPanel i GitSettingsPanel mogą używać --panel zamiast --bg-surface

---

## KOLEJNOŚĆ DZIAŁANIA (krok po kroku)

### Krok 1 — Audyt GitPanel.tsx
- Przeczytaj cały plik
- Sprawdź czy komponent jest w pełni funkcjonalny:
  - Czy przycisk Commit działa? (formularz + wysyłka przez bridge)
  - Czy przycisk Push działa?
  - Czy Pull działa?
  - Czy przełączanie branchy działa?
  - Czy merge działa?
  - Czy harmonogram pull/push działa?
- Sprawdź czy `key={i}` jest wszędzie zastąpione stable keys
- Sprawdź czy `console.log` jest zamienione na `console.debug`

### Krok 2 — Audyt GitSettingsPanel.tsx
- Przeczytaj cały plik
- Sprawdź czy zapis ustawień działa przez IPC
- Sprawdź czy test połączenia (`test-connection`) działa
- Sprawdź czy harmonogram (schedule) się zapisuje

### Krok 3 — Sprawdź handlery IPC
- Przeczytaj ElectronIpcBridge.ts (linie 819-1150)
- Sprawdź czy każdy handler ma poprawne `try/catch` i zwraca błąd a nie rzuca
- Sprawdź czy funkcje git są wywoływane przez `simple-git` lub `child_process.exec`
- Jeśli używają `simple-git` — sprawdź czy pakiet jest w package.json
- Jeśli używają `child_process.exec` — sprawdź czy ścieżka do gita jest wykrywana

### Krok 4 — Napraw problemy
- Wszystkie `key={i}` → stable keys
- Wszystkie `console.log` → `console.debug`
- Dodaj brakujące `try/catch` w handlerach
- Ujednolić zmienne CSS jeśli potrzeba

### Krok 5 — Dodaj testy
- Stwórz `src/components/GitPanel.test.tsx` (jeśli nie istnieje)
- Przynajmniej testy: renderowanie, przyciski, stany

### Krok 6 — Zweryfikuj
- `npx tsc --noEmit` → 0 błędów
- `npx vitest run` → wszystkie testy zielone

---

## SZCZEGÓŁY TECHNICZNE

### Git w main process
Git operacje są wykonywane w ElectronIpcBridge.ts przez `child_process.exec` lub `simple-git`.
Sprawdź importy — jeśli używa `simple-git`, upewnij się że działa.

### Typy danych
```ts
interface GitStatus {
  branch: string;
  entries: GitStatusEntry[];
}

interface GitStatusEntry {
  path: string;
  status: string; // 'M' | 'A' | 'D' | 'R' | '?'
  staged: boolean;
}

interface GitLogEntry {
  hash: string;
  author: string;
  date: string;
  message: string;
}

interface GitBranchInfo {
  name: string;
  current: boolean;
}
```

### IPC Kanały
- `git:get-config` → `{ repoUrl, token, authorName, authorEmail, autoCommit, scheduleInterval }`
- `git:set-config` → `{ config }` → `{ success }`
- `git:test-connection` → `{ url, token }` → `{ success, error? }`
- `git:status` → `{ }` → `GitStatus`
- `git:log` → `{ maxCount? }` → `GitLogEntry[]`
- `git:commit` → `{ message, files? }` → `{ success, hash? }`
- `git:push` → `{ }` → `{ success }`
- `git:pull` → `{ }` → `{ success }`
- `git:branch-list` → `{ }` → `GitBranchInfo[]`
- `git:branch-switch` → `{ name }` → `{ success }`
- `git:branch-create` → `{ name }` → `{ success }`
- `git:merge` → `{ branch }` → `{ success }`

---

## PO ZAKOŃCZENIU

Zapytaj użytkownika: **"#23 zrobione. Robimy #24?"**

Jeśli user powie "tak" → zrób #24 Agent Template
Jeśli user powie "nie" → czekaj na dalsze instrukcje
