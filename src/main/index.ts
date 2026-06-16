// ============================================================================
// NEXUS — Main Process (electron-vite entry)
// Bezpieczny BrowserWindow z contextIsolation: true + preload.ts
// Inicjalizuje AgentOrchestrator + StorageEngine + ElectronIpcBridge
// ============================================================================

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
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
let bridgeProcess: ChildProcess | null = null;

// === Trae-Bridge (darmowe modele AI) =========================================
const TRAE_BRIDGE_PORT = 3458;
const TRAE_BRIDGE_BASE_URL = `http://localhost:${TRAE_BRIDGE_PORT}/v1`;

/** Uruchamia serwer trae-bridge (jeśli nie jest już uruchomiony) */
async function startTraeBridge(): Promise<void> {
  const bridgeScript = path.join(ROOT_DIR, '..', 'trae', 'server.mjs');
  if (!fs.existsSync(bridgeScript)) {
    console.debug('[Trae-Bridge] server.mjs nie znaleziony — pomijam');
    return;
  }

  // Sprawdź czy już działa
  try {
    const resp = await fetch(`${TRAE_BRIDGE_BASE_URL}/models`);
    if (resp.ok) {
      console.debug('[Trae-Bridge] już uruchomiony na', TRAE_BRIDGE_BASE_URL);
      return;
    }
  } catch { /* nie działa — trzeba uruchomić */ }

  console.debug('[Trae-Bridge] Uruchamianie...');
  bridgeProcess = spawn('node', [bridgeScript], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    windowsHide: true,
  });

  bridgeProcess.stdout?.on('data', (data: Buffer) => {
    console.debug('[Trae-Bridge]', data.toString().trim());
  });
  bridgeProcess.stderr?.on('data', (data: Buffer) => {
    console.debug('[Trae-Bridge:err]', data.toString().trim());
  });
  bridgeProcess.on('exit', (code) => {
    console.debug(`[Trae-Bridge] Zakończony (kod ${code})`);
    bridgeProcess = null;
  });

  // Poczekaj aż odpali — healthcheck przez max 5s
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const resp = await fetch(`${TRAE_BRIDGE_BASE_URL}/models`);
      if (resp.ok) {
        console.debug('[Trae-Bridge] Gotowy!');
        return;
      }
    } catch { /* czekamy */ }
  }
  console.warn('[Trae-Bridge] Nie odpowiada po 5s — kontynuuję bez');
}

/** Zatrzymuje trae-bridge */
function stopTraeBridge(): void {
  if (bridgeProcess) {
    console.debug('[Trae-Bridge] Zatrzymywanie...');
    bridgeProcess.kill('SIGTERM');
    bridgeProcess = null;
  }
}

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
    title: 'NEXUS — Agent Orchestration System',
    backgroundColor: '#0a0e14',
    show: false,
    webPreferences: {
      // === SECURITY ================================================
      contextIsolation: true,   // Renderer ISOLATED from Node.js
      nodeIntegration: false,   // No require() in renderer
      sandbox: false,           // false because preload needs more
      webSecurity: true,        // CORS
      preload: preloadPath,
      // ====================================================================
    },
  });

  // Content Security Policy
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self'; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "font-src 'self' https://fonts.gstatic.com; " +
          "img-src 'self' data: blob:; " +
          "connect-src 'self' ws: http://localhost:*; " +
          "frame-src 'none'; " +
          "object-src 'none'; ",
        ],
      },
    });
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
  console.log('  NEXUS — Agent Orchestration System');
  console.log('  Phase 1: Agents + UI');
  console.log('====================================================\n');

  // === Trae-Bridge (darmowe modele) ===
  await startTraeBridge();

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
  stopTraeBridge();
});
