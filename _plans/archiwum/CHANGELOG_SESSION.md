# Changelog — Sesja F3 + F5

> Data: 2026-06-12
> Zakres: Implementacja Fazy 3 (Topologia) + Fazy 5 (Eksport) + Audyt

---

## Faza 3 — Topologia (4/4 ✅)

| ID | Zadanie | Zmiany |
|----|---------|--------|
| F3.1 | **CleanImageMode** | `types.ts` → `cleanImageMode?: boolean` na `NexusNode`. `NexusCanvas.tsx` → wczesny return renderujący tylko obrazek bez UI, overlay tytułu na hover |
| F3.2 | **Freeze/Resize** | `types.ts` → `height?: number`. `NodeCard` → `handleResizeStart` śledzi X i Y, min 200×60, max 1000×1200 |
| F3.3 | **Collapse** | `types.ts` → `collapsed?: boolean`. Strzałka w headerze, warunkowe renderowanie treści/obrazków/annotacji/resize |
| F3.4 | **Teleport** | `NexusCanvasHandle` → `centerOnNode()`. `App.tsx` → `canvasRef` przekazany do `LeftSidebar` przez `onSelectNode` i `onProjectCenter` |

## Faza 5 — Eksport (3/3 ✅)

| ID | Zadanie | Zmiany |
|----|---------|--------|
| F5.1 | **Nazwy plików** | `exportEngine.ts` → `sanitizeFilename()` + `generateExportFilename()`. `ExportModal.tsx` → użycie `generateExportFilename` |
| F5.2 | **Multi-scope + checkboxy** | Nowy `ExportScopeSelector.tsx` z 6 checkboxami + "Zaznacz wszystko". `exportEngine.ts` → `ExportScopeConfig` interface |
| F5.3 | **Export z widoków** | `App.tsx` → `scopeFromView={activeView}`. Auto pre-selection: Todo→tasks, Writing→drafts |

## Nowe pliki

| Plik | Opis | Linie |
|------|------|-------|
| `src/components/ExportScopeSelector.tsx` | Komponent checkboxów do selekcji zakresu eksportu | 112 |
| `_plans/f3-f5/README.md` | Spis planów | 20 |
| `_plans/f3-f5/F3_TOPOLOGIA.md` | Plan Fazy 3 | 100 |
| `_plans/f3-f5/F5_EKSPORT.md` | Plan Fazy 5 | 100 |
| `_plans/f3-f5/IMPLEMENTATION_ORDER.md` | Kolejność implementacji | 80 |

## Zmienione pliki

| Plik | Zmiany |
|------|--------|
| `src/types.ts` | +3 pola: `height`, `collapsed`, `cleanImageMode` |
| `src/components/NexusCanvas.tsx` | Resize 2-osiowe, collapse, clean image, teleport, usunięty martwy interfejs, fix `!` na refach, fix `?.` falsy |
| `src/components/ExportModal.tsx` | tasks/drafts pipeline, scopeFromView, ExportScopeSelector |
| `src/exportEngine.ts` | sanitizeFilename, ExportScopeConfig, tasks/drafts export |
| `src/App.tsx` | canvasRef, tasks/drafts do ExportModal |

## Audyt — naprawione błędy

| # | Problem | Fix |
|---|---------|-----|
| 1 | Martwy interfejs `NexusCanvasInnerProps` | Usunięty |
| 2 | Ghost checkboxes tasks/drafts | Dodany pipeline danych: `ExportModal → generateAIExport` |
| 3 | `!` non-null assertions na refach | `if (ref) ref.current = x` |
| 4 | `node.height ? height : undefined` falsy | `node.height ?? undefined` |

## Status końcowy

- **Lint**: 0 błędów  ✅
- **Testy**: 18/18 passed ✅
- **F3**: 4/4 zadań (100%)
- **F5**: 3/3 zadań (100%)
