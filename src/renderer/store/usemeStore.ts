import { create } from 'zustand';

export interface ReviewItem {
  jobId: string;
  jobTitle: string;
  price: string;
  proposal: string;
  auditReport: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface PromptFile {
  relativePath: string;
  filename: string;
}

export interface UsemeState {
  status: 'IDLE' | 'RUNNING' | 'AWAITING_REVIEW' | 'ERROR';
  mode: 'dry' | 'prod';
  logs: LogEntry[];
  pendingReviews: ReviewItem[];
  activeTab: 'execution' | 'repository';
  promptFiles: PromptFile[];
  selectedPrompt: string | null;
  promptContent: string;
  isPromptDirty: boolean;
  error: string | null;
}

export interface UsemeActions {
  startExecution: (mode: 'dry' | 'prod', headless: boolean) => Promise<void>;
  stopExecution: () => Promise<void>;
  submitReviewDecision: (jobId: string, decision: 'approve' | 'update_and_approve' | 'discard', proposal?: string) => Promise<void>;
  setActiveTab: (tab: 'execution' | 'repository') => void;
  loadPromptFiles: () => Promise<void>;
  selectPrompt: (relativePath: string) => Promise<void>;
  savePrompt: (relativePath: string, content: string) => Promise<void>;
  setPromptContent: (content: string) => void;
  addLog: (entry: LogEntry) => void;
  clearLogs: () => void;
}

const bridge = () => (window as any).nexusBridge;

async function getBridge(): Promise<any> {
  const b = bridge();
  if (!b) throw new Error('nexusBridge not available');
  return b;
}

export const useUsemeStore = create<UsemeState & UsemeActions>((set, get) => ({
  // State
  status: 'IDLE',
  mode: 'dry',
  logs: [],
  pendingReviews: [],
  activeTab: 'execution',
  promptFiles: [],
  selectedPrompt: null,
  promptContent: '',
  isPromptDirty: false,
  error: null,

  // Actions
  startExecution: async (mode, headless) => {
    try {
      set({ status: 'RUNNING', mode, error: null });
      const b = await getBridge();
      const result = await b.usemeStart({ mode, headless });
      if (!result.success) {
        set({ status: 'ERROR', error: result.error || 'Failed to start' });
      }
    } catch (err) {
      set({ status: 'ERROR', error: String(err) });
    }
  },

  stopExecution: async () => {
    try {
      const b = await getBridge();
      await b.usemeStop();
      set({ status: 'IDLE' });
    } catch (err) {
      set({ status: 'ERROR', error: String(err) });
    }
  },

  submitReviewDecision: async (jobId, decision, proposal?) => {
    try {
      const b = await getBridge();
      await b.usemeSubmitDecision({ jobId, decision, proposal });

      set((state) => ({
        pendingReviews: state.pendingReviews.filter((r) => r.jobId !== jobId),
        status: state.pendingReviews.length <= 1 ? 'RUNNING' : 'AWAITING_REVIEW',
      }));
    } catch (err) {
      set({ error: String(err) });
    }
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  loadPromptFiles: async () => {
    try {
      const b = await getBridge();
      const result = await b.usemeListPrompts();
      if (result.success && result.files) {
        const files: PromptFile[] = result.files.map((f: string) => ({
          relativePath: f,
          filename: f.replace(/^config\/(prompts|knowledge)\//, ''),
        }));
        set({ promptFiles: files });
      }
    } catch (err) {
      console.error('[UsemeStore] loadPromptFiles:', err);
    }
  },

  selectPrompt: async (relativePath) => {
    try {
      const b = await getBridge();
      const result = await b.usemeReadPrompt({ filename: relativePath });
      if (result.success) {
        set({
          selectedPrompt: relativePath,
          promptContent: result.content,
          isPromptDirty: false,
        });
      }
    } catch (err) {
      console.error('[UsemeStore] selectPrompt:', err);
    }
  },

  savePrompt: async (relativePath, content) => {
    try {
      const b = await getBridge();
      const result = await b.usemeSavePrompt({ filename: relativePath, content });
      if (result.success) {
        set({ isPromptDirty: false });
      }
    } catch (err) {
      console.error('[UsemeStore] savePrompt:', err);
    }
  },

  setPromptContent: (content) => set({ promptContent: content, isPromptDirty: true }),

  addLog: (entry) => {
    set((state) => ({
      logs: [...state.logs.slice(-499), entry],
    }));
  },

  clearLogs: () => set({ logs: [] }),
}));
