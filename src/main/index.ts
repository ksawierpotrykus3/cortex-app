// ============================================================================
// NEXUS — Main Process (electron-vite entry)
// Bezpieczny BrowserWindow z contextIsolation: true + preload.ts
// Inicjalizuje AgentOrchestrator + StorageEngine + ElectronIpcBridge
// ============================================================================

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { AgentOrchestrator } from './core/AgentOrchestrator';
import { StorageEngine } from './storage/StorageEngine';
import { ElectronIpcBridge } from './ipc/ElectronIpcBridge';
import { ProviderRegistry } from './ai/ProviderRegistry';
import { AgentOutput, AgentStatus } from '../shared/types/schema';

// === Constants =============================================================
const IS_DEV = !app.isPackaged;
const ROOT_DIR = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

// === State =================================================================
let mainWindow: BrowserWindow | null = null;
let orchestrator: AgentOrchestrator | null = null;
let storage: StorageEngine | null = null;
let ipcBridge: ElectronIpcBridge | null = null;
let providerRegistry: ProviderRegistry | null = null;

// ============================================================================
// Create Window
// ============================================================================
function createMainWindow(): BrowserWindow {
  const preloadPath = path.join(__dirname, '..', 'preload', 'index.js');

  console.log('[NEXUS] preload path:', preloadPath);
  console.log('[NEXUS] preload exists:', fs.existsSync(preloadPath));

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'NEXUS — System Orkiestracji Agentów',
    backgroundColor: '#0a0e14',
    show: false,
    webPreferences: {
      // === BEZPIECZEŃSTWO ================================================
      contextIsolation: true,   // Renderer ODDZIELONY od Node.js
      nodeIntegration: false,   // Żaden require() nie działa w renderer
      sandbox: false,           // false bo preload potrzebuje więcej
      webSecurity: true,        // CORS
      preload: preloadPath,
      // ====================================================================
    },
  });

  win.once('ready-to-show', () => {
    win.show();
    if (IS_DEV) {
      win.webContents.openDevTools();
    }
  });

  // Load
  if (IS_DEV) {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(path.join(ROOT_DIR, 'out', 'renderer', 'index.html'));
  }

  return win;
}

// ============================================================================
// Bootstrap
// ============================================================================
async function bootstrap(): Promise<void> {
  console.log('====================================================');
  console.log('  NEXUS — System Orkiestracji Agentów');
  console.log('  Faza 1: Agenci + UI');
  console.log('====================================================\n');

  // === Storage ===
  storage = new StorageEngine(DATA_DIR);
  await storage.init();

  // === Provider Registry ===
  providerRegistry = new ProviderRegistry();
  console.log('[NEXUS] ProviderRegistry:', providerRegistry.getConfigs().map(c => c.label).join(', '));

  // === Agent Orchestrator ===
  orchestrator = new AgentOrchestrator({
    onStatusChange: (agentId, status) => {
      console.log(`[Orchestrator] ${agentId} → ${status}`);
      mainWindow?.webContents.send('agent:status', { agentId, status });
    },
    onOutput: (output) => {
      storage?.saveOutput(output);
      mainWindow?.webContents.send('agent:output', output);
    },
    onStream: (agentId, token) => {
      mainWindow?.webContents.send('agent:stream', { agentId, token });
    },
    onError: (agentId, error) => {
      console.error(`[Orchestrator] Error ${agentId}:`, error);
      storage?.appendLog({ level: 'error', agentId, message: error });
    },
  }, providerRegistry, storage);

  // === IPC Bridge ===
  ipcBridge = new ElectronIpcBridge(ipcMain, orchestrator, storage, providerRegistry, ROOT_DIR);
  ipcBridge.registerHandlers();

  console.log('[NEXUS] System gotowy — AI Providers:', providerRegistry.getConfigs().length);
}

// ============================================================================
// App Lifecycle
// ============================================================================
app.whenReady().then(async () => {
  // Ensure data directories exist
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  mainWindow = createMainWindow();
  try {
    await bootstrap();
  } catch (err) {
    console.error('[NEXUS] Bootstrap failed:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
}).catch(err => {
  console.error('[NEXUS] App ready failed:', err);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  orchestrator?.destroy();
  storage?.destroy();
  ipcBridge?.destroy();
});
