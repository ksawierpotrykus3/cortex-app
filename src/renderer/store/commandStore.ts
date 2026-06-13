// ============================================================================
// NEXUS — Command Palette Store (#12)
// Zustand store: rejestr komend, custom commands, otwieranie/zamykanie
// ============================================================================

import { create } from 'zustand';

// === Built-in command (z handlerem) =========================================
export interface Command {
  id: string;
  label: string;
  category: string;
  shortcut?: string;
  keywords: string[];
  dangerous?: boolean;
  handler: () => void | Promise<void>;
}

// === Customizable command (serializowalny do JSON) ==========================
export type CustomActionType =
  | 'navigate'      // przejście do widoku
  | 'open-url'      // otwarcie URL
  | 'run-workflow'  // uruchomienie workflow
  | 'run-agent'     // uruchomienie agenta
  | 'shell'         // komenda systemowa (przez IPC)
  | 'run-pipeline'; // uruchomienie pipeline

export interface CustomCommandData {
  id: string;
  label: string;
  category: string;
  shortcut?: string;
  keywords: string[];
  dangerous?: boolean;
  actionType: CustomActionType;
  actionValue: string; // np. "nexus", "https://...", "workflow-id", "agent-id", "echo hello"
}

// === Store ===================================================================
interface CommandState {
  commands: Command[];
  paletteOpen: boolean;
  manageOpen: boolean; // custom commands manager

  // Built-in registry
  registerCommands: (cmds: Command[]) => void;
  unregisterCommands: (ids: string[]) => void;

  // Custom commands
  customCommands: CustomCommandData[];
  setCustomCommands: (cmds: CustomCommandData[]) => void;
  addCustomCommand: (cmd: CustomCommandData) => void;
  updateCustomCommand: (id: string, cmd: Partial<CustomCommandData>) => void;
  removeCustomCommand: (id: string) => void;

  // Palette
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;

  // Manager
  openManage: () => void;
  closeManage: () => void;

  // Execution
  executeCommand: (id: string) => void;
}

export const useCommandStore = create<CommandState>((set, get) => ({
  commands: [],
  paletteOpen: false,
  manageOpen: false,
  customCommands: [],

  // ====================================================================
  // Built-in registry
  // ====================================================================
  registerCommands: (cmds) =>
    set((state) => {
      const existingIds = new Set(state.commands.map((c) => c.id));
      const newCmds = cmds.filter((c) => !existingIds.has(c.id));
      return { commands: [...state.commands, ...newCmds] };
    }),

  unregisterCommands: (ids) =>
    set((state) => ({
      commands: state.commands.filter((c) => !ids.includes(c.id)),
    })),

  // ====================================================================
  // Custom commands — zapisuje dane + rejestruje jako Command z handlerem
  // ====================================================================
  setCustomCommands: (cmds) => {
    set((state) => {
      // Remove old custom commands from commands list
      const withoutOldCustom = state.commands.filter((c) => !c.id.startsWith('custom:'));
      // Build new commands from custom data
      const newCmds = cmds.map((cc) => buildCustomCommand(cc));
      return {
        customCommands: cmds,
        commands: [...withoutOldCustom, ...newCmds],
      };
    });
  },

  addCustomCommand: (cmd) => {
    set((state) => {
      const handler = buildCustomCommand(cmd);
      return {
        customCommands: [...state.customCommands, cmd],
        commands: [...state.commands, handler],
      };
    });
  },

  updateCustomCommand: (id, partial) => {
    set((state) => {
      const existing = state.customCommands.find((c) => c.id === id);
      if (!existing) return state;
      const updated: CustomCommandData = { ...existing, ...partial };
      const handler = buildCustomCommand(updated);
      return {
        customCommands: state.customCommands.map((c) => (c.id === id ? updated : c)),
        commands: state.commands.map((c) => (c.id === `custom:${id}` ? handler : c)),
      };
    });
  },

  removeCustomCommand: (id) => {
    set((state) => ({
      customCommands: state.customCommands.filter((c) => c.id !== id),
      commands: state.commands.filter((c) => c.id !== `custom:${id}`),
    }));
  },

  // ====================================================================
  // Palette
  // ====================================================================
  openPalette: () => set({ paletteOpen: true }),
  closePalette: () => set({ paletteOpen: false }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),

  // ====================================================================
  // Manager
  // ====================================================================
  openManage: () => set({ manageOpen: true }),
  closeManage: () => set({ manageOpen: false }),

  // ====================================================================
  // Execute
  // ====================================================================
  executeCommand: (id) => {
    const cmd = get().commands.find((c) => c.id === id);
    if (cmd) {
      cmd.handler();
      set({ paletteOpen: false });
    }
  },
}));

// ============================================================================
// Build a runtime Command from CustomCommandData
// ============================================================================
function buildCustomCommand(cc: CustomCommandData): Command {
  const type = cc.actionType;
  const val = cc.actionValue;
  let handler: () => void | Promise<void>;

  switch (type) {
    case 'navigate': {
      const viewMode = val as any; // cast — validated at creation
      handler = () => {
        // Import dynamiczne by uniknąć circular deps
        import('../../types').then((m) => {
          const validModes: string[] = [
            'nexus', 'lab-todo', 'lab-writing', 'agents', 'wiki',
            'pipeline', 'workflows', 'changes', 'feedback',
          ];
          if (validModes.includes(val)) {
            const { setActiveView } = getGlobalActions();
            setActiveView?.(val as any);
          }
        });
      };
      break;
    }
    case 'open-url':
      handler = () => { window.open(val, '_blank'); };
      break;
    case 'run-workflow':
      handler = () => {
        import('../../types').then(() => {
          getGlobalActions().runWorkflow?.(val);
        });
      };
      break;
    case 'run-agent':
      handler = () => {
        getGlobalActions().runAgent?.(val);
      };
      break;
    case 'run-pipeline':
      handler = () => {
        getGlobalActions().runPipeline?.(val);
      };
      break;
    case 'shell':
      handler = () => {
        const bridge = window.nexusBridge as any;
        if (bridge?.executeCommand) {
          bridge.executeCommand({ command: val });
        }
      };
      break;
    default:
      handler = () => {};
  }

  return {
    id: `custom:${cc.id}`,
    label: cc.label,
    category: cc.category || 'Custom',
    shortcut: cc.shortcut,
    keywords: cc.keywords || [],
    dangerous: cc.dangerous,
    handler,
  };
}

// === Global actions bridge — App.tsx ustawia referencje =====================
let _globalActions: GlobalActionsRef = {};

export interface GlobalActionsRef {
  setActiveView?: (mode: any) => void;
  runWorkflow?: (id: string) => void;
  runAgent?: (id: string) => void;
  runPipeline?: (id: string) => void;
}

export function setGlobalActions(ref: GlobalActionsRef) {
  _globalActions = ref;
}

export function getGlobalActions(): GlobalActionsRef {
  return _globalActions;
}
