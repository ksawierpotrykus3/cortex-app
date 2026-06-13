# Prompt dla agenta — Nexus F6 zakończone, testy napisane

## 1. Co się zmieniło

Faza 6 (Warsztat AI) jest w **11/12** — działa całość poza Pipeline DAG.
**Wszystkie testy istnieją i przechodzą (142/142).**

## 2. Stan dokumentacji (główny plik)

Wszystkie dane o projekcie: [NEXUS_PROJECT_STATUS.md](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/NEXUS_PROJECT_STATUS.md)

To jest **jedyny aktualny plik** — czytaj go zamiast starych wersji w `_documents/aktualne/`.

## 3. Testy które istnieją (NIE RUSZAJ)

| Plik | Testy | Status |
|------|-------|--------|
| `src/components/WikiPanel.test.tsx` | 5 testów | ✅ pass |
| `src/renderer/components/agents/AgentHistoryPanel.test.tsx` | 6 testów | ✅ pass |
| `src/renderer/components/agents/AgentPresets.test.ts` | 7 testów | ✅ pass (naprawiony `ACTIVE` zamiast `active`) |
| `src/components/FeedbackModal.test.tsx` | 8 testów | ✅ pass |
| `src/exportEngine.test.ts` | 22 testy | ✅ pass |
| `src/components/ExportModal.test.tsx` | 5 testów | ✅ pass |
| `src/components/ExportScopeSelector.test.tsx` | 9 testów | ✅ pass |
| `src/components/DraftZone.test.tsx` | 11 testów | ✅ pass |
| `src/components/LogViewer.test.tsx` | 5 testów | ✅ pass |
| `src/renderer/components/agents/ContextBuilder.test.tsx` | 12 testów | ✅ pass |
| `src/renderer/components/agents/ContextConfigPanel.test.tsx` | 19 testów | ✅ pass |
| `src/renderer/components/agents/PermissionPanel.test.tsx` | 17 testów | ✅ pass |
| `src/main/core/AgentOrchestrator.test.ts` | 9 testów | ✅ pass |
| **RAZEM** | **142 testy** | ✅ **wszystkie pass** |

## 4. Co jest jeszcze do zrobienia

### F6.12 — Pipeline DAG (jedyna brakująca funkcja)
- Wizualny edytor pipeline'ów — łączenie agentów w łańcuchy
- Szacunek: ~30h
- Nie ma jeszcze kodu

### Ewentualnie: nowe zadania spoza F1-F6
- Workflows (#1)
- Diff Viewer (#5)
- Command Palette (#12)
- Integracja z Gitem (#23)

## 5. WAŻNE — czego NIE robić

- **Nie używaj `npm run lint`** — to jest skonfigurowane jako `tsc --noEmit`, nie jako linter. Używaj bezpośrednio:
  - `npx tsc --noEmit` (typecheck)
  - `npx vitest run` (testy)
- **Nie twórz plików które już istnieją** — sprawdź najpierw czy plik istnieje
- **Nie twórz nowych dokumentów .md** chyba że użytkownik wyraźnie poprosi
- **Nie modyfikuj istniejących testów** — tylko dodawaj nowe jeśli potrzeba
- **Czytaj `NEXUS_PROJECT_STATUS.md` zamiast starych wersji** w `_documents/aktualne/`

## 6. Komendy które działają

```powershell
# TypeScript typecheck
npx tsc --noEmit

# Uruchom wszystkie testy
npx vitest run

# Uruchom konkretny test
npx vitest run src/components/WikiPanel.test.tsx

# Build (tylko Vite, nie Electron)
npx vite build

# Pełny build Electron
npm run build
```
