# 01 - Plan Całkowitego i Trwałego Usunięcia "Workflow Studio"

Zgodnie z wymaganiem usunięcia "tego czegoś" (Workflow Studio) z paska bocznego i całej aplikacji na zawsze. Z racji, że **zawsze zakładam, że coś nie działa i operacja wycięcia tak dużego modułu na 100% popsuje aplikację** (bo powiązania są wszędzie w App.tsx, typach i stanie), plan opiera się na chirurgicznym cięciu i deterministycznej weryfikacji. 

Dopóki nie udowodnimy twardo, że wszystko inne działa stabilnie na rok 2026, zakładamy, że aplikacja jest zepsuta.

## Faza 1: Rozpoznanie (Co na pewno się popsuje)
Workflow Studio jest bardzo głęboko zakorzenione. Wycięcie go spowoduje błędy TypeScript w:
- `DatabaseExplorer.tsx` (będzie wymagał propa `studioCanvas`, którego mu usuniemy z App.tsx).
- `App.tsx` (stan `studioCanvas`, `activeView === 'workflow-studio'`).
- `TopNavigation.tsx` (przycisk wywołujący widok).
- `MermaidPlanPanel.tsx` (przycisk kompilacji do Workflow Studio wywali błąd wywołania).

## Faza 2: Planowane Chirurgiczne Cięcia
1. **Usunięcie komponentów i plików**:
   - Usunięcie w całości pliku `src/components/WorkflowStudioCanvas.tsx` (i ew. powiązanych node'ów).
2. **Czyszczenie `src/components/DatabaseExplorer.tsx`**:
   - Wycięcie sekcji `{ id: 'workflow-studio' }` z listy (ok. linia 112).
   - Usunięcie funkcji `renderStudioSection()` by na zawsze zniknęło z widoku "DATABASE".
   - Usunięcie z interfejsu propsów `studioCanvas`.
3. **Czyszczenie Głównego Stanu (`src/App.tsx`)**:
   - Wycięcie stanu `[studioCanvas, setStudioCanvas]` oraz `studioSelectedNodeId`.
   - Wycięcie warunku renderującego widok `<WorkflowStudioCanvas ... />`.
   - Oczyszczenie efektów (`useEffect`) synchronizujących i wczytujących dane o `studioCanvas`.
4. **Usunięcie z Nawigacji i Skrótów**:
   - `src/components/TopNavigation.tsx`: usunięcie przycisku "Workflow Studio".
   - `src/commands/index.ts` oraz `src/keydir/index.ts`: usunięcie powiązanych akcji/skrótów.
   - `src/components/StatusBar.tsx`: usunięcie tagu dla widoku.
5. **Czyszczenie Typów (`src/types.ts`)**:
   - Usunięcie `StudioCanvas`, węzłów i modeli danych (od ok. 180 linii).
6. **Usunięcie zależnych funkcji**:
   - `src/components/MermaidPlanPanel.tsx` - wyrzucenie integracji i przycisku kompilacji do Workflow Studio.

## Faza 3: Deterministyczna Weryfikacja na rok 2026 (Dowód, że działa)
Ponieważ zakładam, że po tych cięciach projekt "zacznie płonąć", jedynym sposobem na udowodnienie stabilności będzie deterministyczny pipeline:

1. **Weryfikacja Typów (TypeScript to ostateczna wyrocznia)**:
   ```bash
   npm run typecheck
   # lub
   tsc --noEmit
   ```
   **Warunek**: Zero (0) błędów. Nawet jedno ostrzeżenie z TypeScript oznacza, że "coś nie działa" i Workflow Studio zostawiło zgniły ślad.

2. **Weryfikacja Bundlera (Brak martwego kodu)**:
   ```bash
   npm run build
   # lub vite build
   ```
   **Warunek**: Udany build produkcyjny bez błędów rozwiązywania modułów (Missing imports). To dowiedzie, że silnik aplikacji nie potrzebuje już usuniętych plików.

3. **Weryfikacja Uruchomieniowa**:
   Uruchomienie aplikacji w trybie deweloperskim i fizyczne przeklikanie po lewym panelu "DATABASE". 
   **Warunek**: Jeśli nie pojawi się biały ekran śmierci (React Error Boundary), a konsola z logami będzie czysta, **dopiero wtedy uznajemy, że usunięcie się udało i działa stabilnie.**

Zgodnie z pesymistycznym założeniem, dopóki wszystkie trzy powyższe punkty z fazy 3 nie zaświecą się na zielono – uznajemy architekturę za zepsutą.
