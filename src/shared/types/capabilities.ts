// ============================================================================
// NEXUS — Agent Capabilities (pozwolenia dla agentów)
// Każdy agent może mieć przypisane capabilities — co wolno mu robić.
// ============================================================================

/** Kategoria operacji */
export type CapabilityCategory = 
  | 'read:notes'      // Czytanie notatek z mapy myśli
  | 'write:notes'     // Tworzenie/modyfikowanie notatek
  | 'delete:notes'    // Usuwanie notatek
  | 'read:tasks'      // Czytanie tasków
  | 'write:tasks'     // Tworzenie/modyfikowanie tasków
  | 'delete:tasks'    // Usuwanie tasków
  | 'read:manuscripts' // Czytanie manuskryptów
  | 'write:manuscripts' // Tworzenie/modyfikowanie manuskryptów
  | 'read:wiki'       // Czytanie bazy wiedzy
  | 'write:wiki'      // Modyfikowanie bazy wiedzy
  | 'read:agents'     // Czytanie konfiguracji agentów
  | 'write:agents'    // Modyfikowanie agentów
  | 'read:git'        // Czytanie statusu/historii git
  | 'write:git'       // Wykonywanie operacji git (commit, push, merge)
  | 'read:files'      // Czytanie plików z dysku (folder-picker)
  | 'write:files'     // Zapis plików na dysku (folder-picker)
  | 'read:canvas'     // Czytanie całego canvas (wszystkie notatki)
  | 'read:context'    // Widzenie kontekstu użytkownika (na co patrzy)
  | 'read:clipboard'  // Czytanie schowka
  | 'read:selection'  // Czytanie zaznaczonego tekstu
  | 'exec:script'     // Wykonanie kodu JS w sandboxie
  | 'exec:http'       // Wykonanie zapytań HTTP (whitelisted)
  | 'write:workflows'  // Modyfikowanie workflowów
  | 'read:workflows'  // Czytanie workflowów
  | 'admin'           // Wszystko (jak root)

/** Poziom approve — czy agent musi pytać przed akcją */
export type ApprovalLevel = 
  | 'none'      // Wykonuje bez pytania
  | 'notify'    // Wykonuje i informuje
  | 'approve'   // Musi czekać na akceptację przed wykonaniem

/** Pojedyncza capability z poziomem approve */
export interface CapabilityEntry {
  capability: CapabilityCategory;
  approvalLevel: ApprovalLevel;
}

/** Grupa capability dla UI */
export interface CapabilityGroup {
  category: string;
  label: string;
  items: { value: CapabilityCategory; label: string; description: string }[];
}

/** Lista wszystkich capability z opisami */
export const ALL_CAPABILITIES: CapabilityGroup[] = [
  {
    category: 'read',
    label: 'Czytanie',
    items: [
      { value: 'read:notes', label: 'Czytaj notatki', description: 'Dostęp do treści notatek na mapie myśli' },
      { value: 'read:tasks', label: 'Czytaj zadania', description: 'Dostęp do listy zadań i ich opisów' },
      { value: 'read:manuscripts', label: 'Czytaj manuskrypty', description: 'Dostęp do edytora pisma' },
      { value: 'read:wiki', label: 'Czytaj Wiki', description: 'Dostęp do bazy wiedzy' },
      { value: 'read:agents', label: 'Czytaj agentów', description: 'Podgląd konfiguracji innych agentów' },
      { value: 'read:git', label: 'Czytaj Gita', description: 'Status, log, diff, branche' },
      { value: 'read:files', label: 'Czytaj pliki', description: 'Odczyt plików z wybranych folderów' },
      { value: 'read:canvas', label: 'Czytaj cały canvas', description: 'Wszystkie notatki i połączenia' },
      { value: 'read:context', label: 'Widź kontekst', description: 'Na co patrzy użytkownik' },
      { value: 'read:clipboard', label: 'Czytaj schowek', description: 'Zawartość schowka systemowego' },
      { value: 'read:selection', label: 'Czytaj zaznaczenie', description: 'Zaznaczony tekst w UI' },
    ],
  },
  {
    category: 'write',
    label: 'Pisanie',
    items: [
      { value: 'write:notes', label: 'Zapisuj notatki', description: 'Tworzenie i edycja notatek' },
      { value: 'write:tasks', label: 'Zapisuj zadania', description: 'Tworzenie i edycja zadań' },
      { value: 'write:manuscripts', label: 'Zapisuj manuskrypty', description: 'Edycja manuskryptów' },
      { value: 'write:wiki', label: 'Zapisuj Wiki', description: 'Edycja bazy wiedzy' },
      { value: 'write:agents', label: 'Konfiguruj agentów', description: 'Zmiana konfiguracji agentów' },
      { value: 'write:git', label: 'Git write', description: 'Commit, push, merge, branch' },
      { value: 'write:files', label: 'Zapisuj pliki', description: 'Tworzenie i edycja plików na dysku' },
      { value: 'write:workflows', label: 'Zapisuj workflowy', description: 'Edycja workflowów' },
    ],
  },
  {
    category: 'delete',
    label: 'Usuwanie',
    items: [
      { value: 'delete:notes', label: 'Usuwaj notatki', description: 'Usuwanie notatek z canvas' },
      { value: 'delete:tasks', label: 'Usuwaj zadania', description: 'Usuwanie zadań' },
    ],
  },
  {
    category: 'exec',
    label: 'Wykonanie',
    items: [
      { value: 'exec:script', label: 'Wykonaj kod', description: 'Uruchomienie kodu JS w sandboxie' },
      { value: 'exec:http', label: 'Zapytania HTTP', description: 'Wykonanie zapytań sieciowych' },
    ],
  },
  {
    category: 'admin',
    label: 'Administracja',
    items: [
      { value: 'admin', label: 'Admin (wszystko)', description: 'Pełny dostęp do wszystkiego bez ograniczeń' },
    ],
  },
];

/** Domyślna lista — wszystko z approve */
export const DEFAULT_APPROVED_CAPABILITIES: CapabilityEntry[] = [
  { capability: 'read:notes', approvalLevel: 'none' },
  { capability: 'read:tasks', approvalLevel: 'none' },
  { capability: 'read:manuscripts', approvalLevel: 'none' },
  { capability: 'read:wiki', approvalLevel: 'none' },
  { capability: 'read:agents', approvalLevel: 'none' },
  { capability: 'read:git', approvalLevel: 'none' },
  { capability: 'read:files', approvalLevel: 'none' },
  { capability: 'read:canvas', approvalLevel: 'none' },
  { capability: 'read:context', approvalLevel: 'none' },
  { capability: 'read:clipboard', approvalLevel: 'none' },
  { capability: 'read:selection', approvalLevel: 'none' },
  { capability: 'write:notes', approvalLevel: 'approve' },
  { capability: 'write:tasks', approvalLevel: 'approve' },
  { capability: 'write:manuscripts', approvalLevel: 'approve' },
  { capability: 'write:wiki', approvalLevel: 'approve' },
  { capability: 'write:agents', approvalLevel: 'approve' },
  { capability: 'write:git', approvalLevel: 'approve' },
  { capability: 'write:files', approvalLevel: 'approve' },
  { capability: 'write:workflows', approvalLevel: 'approve' },
  { capability: 'delete:notes', approvalLevel: 'approve' },
  { capability: 'delete:tasks', approvalLevel: 'approve' },
  { capability: 'exec:script', approvalLevel: 'approve' },
  { capability: 'exec:http', approvalLevel: 'approve' },
  { capability: 'admin', approvalLevel: 'approve' },
];
