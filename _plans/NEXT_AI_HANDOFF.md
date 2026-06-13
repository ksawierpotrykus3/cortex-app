# Handoff dla następnego AI

> **Stan projektu po sesji F3+F5**.
> Wszystkie zmiany zacommitowane. Lint 0 błędów, testy 18/18.

---

## Co zostało zrobione (nie ruszaj)

### Faza 3 — Topologia ✅ (4/4)
- `cleanImageMode` — node z obrazem bez interfejsu UI
- `height` + `collapsed` — resize 2-osiowy i zwijanie nodów
- `centerOnNode()` + `panToProject()` — teleport z LeftSidebar

### Faza 5 — Eksport ✅ (3/3)
- `sanitizeFilename()` + `generateExportFilename()` — nazwy plików
- `ExportScopeSelector.tsx` — checkboxy z selekcją zakresu
- `scopeFromView` — auto pre-selection zależna od widoku

### Plany w `_plans/f3-f5/`
- `F3_TOPOLOGIA.md`, `F5_EKSPORT.md`, `IMPLEMENTATION_ORDER.md`

---

## Co pozostaje do zrobienia

### Faza 4 — Tablica Zmian (P3, ~30-40h)
Widok "Tablica Zmian" dostępny z TopNavigation. Historia zmian + formularz "Brakuje mi...".

**Zadania**:
1. Nowy typ `ChangeEntry` w `types.ts`, nowy moduł `src/changelog.ts` (Circular Buffer 500 wpisów)
2. Nowy komponent `ChangesPanel.tsx` — timeline zmian z filtrowaniem
3. Formularz "Brakuje mi..." → zapis do `nexus.feedback.json`
4. Integracja z setterami w `App.tsx` (wrap `setNodes`, `setTasks`, `setDrafts`)
5. Routing: dodanie 'changes' do `ViewMode`, przycisk w `TopNavigation`

**Szczegóły**: [NEXUS_IMPLEMENTATION_PLAN.md#3-faza-4--tablica-zmian-p3](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/NEXUS_IMPLEMENTATION_PLAN.md#L184)

---

### Faza 6 — Warsztat AI (P1, ~80-120h)
Backend agentów już istnieje (AgentOrchestrator, ProviderRegistry, GeminiAdapter, OpenAIApiAdapter, IPC Bridge, agentStore, changelogStore, DraftZone, LogViewer).

**Zadania do zrobienia**:

| # | Zadanie | Szac. czas | Pliki |
|---|---------|-----------|-------|
| 6.1 | System permisji agentów | ~15-20h | `schema.ts`, `AgentConfigPanel.tsx`, `AgentOrchestrator.ts` |
| 6.2 | Context Builder | ~20-25h | Nowy `ContextBuilder.tsx`, `schema.ts`, `ElectronIpcBridge.ts` |
| 6.3 | Magazyny (buffery) | ~15-20h | `StorageEngine.ts` (nowa tabela SQLite), `AgentHistoryPanel.tsx` |
| 6.4 | Wiki/Baza wiedzy | ~20-25h | Nowy typ `WikiArticle`, CRUD, full-text search |
| 6.5 | Presety agentów + szablony | ~5-10h | `AgentConfigPanel.tsx`, `schema.ts` |
| 6.6 | Dashboard agentów | ~10-15h | Nowy komponent + widok |

**Szczegóły**: [NEXUS_IMPLEMENTATION_PLAN.md#5-faza-6--warsztat-ai-p1](file:///c:/Users/Ksawier/Pictures/Screenshots/nexus/NEXUS_IMPLEMENTATION_PLAN.md#L349)

---

## Zasady pracy

1. **Nie modyfikuj plików F3/F5** — są zamknięte (chyba że znaleziono buga)
2. **Commit po KAŻDYM zadaniu** — osobny commit z prefixem (np. `feat(f4): add ChangeEntry type`)
3. **Lint przed każdym commitem** — `npm run lint` musi przechodzić
4. **Testy po każdej zmianie** — `npm run test` (obecnie 18/18)
5. **Jeśli zmieniasz `types.ts`** — sprawdź czy `fs.ts` i `data.ts` też wymagają aktualizacji
6. **Czytaj NEXUS_IMPLEMENTATION_PLAN.md** przed implementacją — zawiera dokładne specyfikacje

## Pliki krytyczne (nie ruszaj bez potrzeby)

| Plik | Status |
|------|--------|
| `src/types.ts` | Stabilny, tylko dodawaj nowe typy |
| `src/components/NexusCanvas.tsx` | F3 zrobione |
| `src/components/ExportModal.tsx` | F5 zrobione |
| `src/exportEngine.ts` | F5 zrobione |
| `src/components/ExportScopeSelector.tsx` | F5 zrobione |
| `_plans/f3-f5/*.md` | Plany F3+F5 — tylko do odczytu |

## Czego NIE robić

- **Nie usuwaj** istniejących plików F3/F5
- **Nie refaktoruj** starego kodu, chyba że blokuje nową funkcję
- **Nie zmieniaj** API/typów bez sprawdzenia wszystkich konsumentów
- **Nie twórz** plików MD (dokumentacja) bez wyraźnego żądania
