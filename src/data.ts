import { NexusNode, Task, WritingDraft, NexusLink } from './types';

export const initialNodes: NexusNode[] = [
  { id: '1', title: 'dddd', content: "wtyczka czy cos 'send to ai'\nwysyła wszystko np do ai studio", x: 420, y: 320, accent: 'blue', projectId: 'brudna' },
  { id: '2', title: 'dddd', content: "# 🚀 Visual Divergence Engine v2\n\n> **v1 był zepsuty** --- generował 20x ten sam layout z inną tapetą. v2 wymusza zmiany na...", x: 920, y: 350, accent: 'purple', projectId: 'brudna' },
  { id: '3', title: 'Lore', content: "Ten program istnieje po to żeby zaspokajać moje potrzeby, wykorzystywać moje pomysły i dodatkowo tworzenie wyspecjalizowanych narzędzi z AI czy bez.\n\ncortex ma być do defensywy, ofensywy i ofensywy z defensywy.\n\ndefensywa. zbieranie...", x: 80, y: 350, accent: 'none' },
  { id: '4', title: 'Pomysł', content: "Warstwa -1 - surowy zbiornik.\nZiarna - grupy - zmienne we wzorze na moje myślenie decyzyjne. Przywoływanie grupy do kontekstu jako projekt wewnętrzny...", x: 400, y: 550, accent: 'none' },
  { id: '5', title: '5', content: "Pomysł warsztatu - który sprawdza jak AI cos rozumie ale nie wiem jak. i teraz np pisze pomysł a nie powinienem bo to jest plan.", x: 650, y: 700, accent: 'none' },
  { id: '6', title: '4', content: "Jednocześnie wszystkie funkcje ktore ja przewiduje ze mogą to wymagać to muszą mieć idealne zrozumienie przez AI...", x: 850, y: 600, accent: 'none' },
  { id: '7', title: '2', content: "Niska pamięć robocza - nie mogę łączyć wielu odległych rzeczy w 1 perfekcyjny plan w głowie.\npotrzebuje do tego czegos co pozwala mi zbierać rzeczy jak o nich pamietam na zapas...", x: 600, y: 950, accent: 'none' },
  { id: '8', title: '1', content: "Zapominanie rzeczy.", x: 300, y: 950, accent: 'none' }
];

export const initialLinks: NexusLink[] = [
  { source: '1', target: '2' },
  { source: '4', target: '5' },
  { source: '3', target: '4' },
  { source: '8', target: '7' },
  { source: '7', target: '5' },
  { source: '5', target: '6' }
];

export const initialTasks: Task[] = [
  { id: 't1', title: 'Taski', description: 'Nie działa podwojna klik na notatce.\nnie da sie tworzyc projektow', status: 'Unresolved', priority: 'Critical', updatedAt: '31.05.2026, 22:07' },
  { id: 't2', title: 'Pomysł od Ai', description: 'Suwak Czasu (Time-Scrubbing)\nJak to działa dzisiaj: Masz przycisk "Cofnij" (Ctrl+Z). Cofa on tylko to, co zepsułeś przed sekundą.\nTwój pomysł (NEXUS): Na dole ekranu masz suwak, taki sam jak na YouTube. Przesuwasz go w lewo (np. na styczeń 2025) i nagle na Twoich oczach notatki same się rozłączają, znikają, a ekran wraca do stanu z tamtego dnia.', status: 'Unresolved', priority: 'Low', updatedAt: '31.05.2026, 21:43' },
  { id: 't3', title: 'Prompt dla Flash', description: 'Hej Flash. Pracujemy nad kodem mojego projektu Vanilla JS + Electron. Zignoruj błędy związane z bezpieczeństwem...', status: 'Resolved', priority: 'Medium', updatedAt: '31.05.2026, 21:59' }
];

export const initialDrafts: WritingDraft[] = [
  { id: '#1', content: 'dddddd', words: 1, updatedAt: '31.05.2026, 21:27' },
  { id: '#2', content: 'ddddddddddddd', words: 1, updatedAt: '31.05.2026, 21:27' },
  { id: '#3', content: 'dddddddddddddddd', words: 1, updatedAt: '31.05.2026, 21:27' },
  { id: '#4', content: 'dddddddddd', words: 1, updatedAt: '31.05.2026, 21:27' },
  { id: '#5', content: 'ddddddddddd', words: 1, updatedAt: '31.05.2026, 21:28' },
  { id: '#6', content: 'd', words: 1, updatedAt: '31.05.2026, 21:28' },
];
