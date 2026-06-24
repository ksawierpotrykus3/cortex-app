// ============================================================================
// NEXUS — Main Process (electron-vite entry)
// Bezpieczny BrowserWindow z contextIsolation: true + preload.ts
// Inicjalizuje AgentOrchestrator + StorageEngine + ElectronIpcBridge
// ============================================================================

import { app, BrowserWindow, ipcMain, clipboard } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { AgentOrchestrator } from './core/AgentOrchestrator';
import { StorageEngine } from './storage/StorageEngine';
import { ElectronIpcBridge } from './ipc/ElectronIpcBridge';
import { ProviderRegistry } from './ai/ProviderRegistry';
import { AiHealthMonitor } from './ai/AiHealthMonitor';
import { AgentOutput, AgentStatus } from '../shared/types/schema';

// === Constants =============================================================
const IS_DEV = !app.isPackaged;
// ROOT_DIR zawsze względem __dirname — w dev to src/main/, w production to asar/out/main/
const ROOT_DIR = path.join(__dirname, '..', '..');
const RESOURCE_DIR = !IS_DEV
  ? path.join(process.resourcesPath, 'app.asar.unpacked')
  : ROOT_DIR;
const DATA_DIR = !IS_DEV
  ? path.join(app.getPath('userData'), 'NexusData')
  : path.join(ROOT_DIR, 'data');

// === State =================================================================
let mainWindow: BrowserWindow | null = null;
let orchestrator: AgentOrchestrator | null = null;
let storage: StorageEngine | null = null;
let ipcBridge: ElectronIpcBridge | null = null;
let providerRegistry: ProviderRegistry | null = null;
let nvidiaProcess: ChildProcess | null = null;

// === NVIDIA-Bridge (własne proxy z rotacją kluczy) ===========================
const NVIDIA_BRIDGE_PORT = 3456;
const NVIDIA_BRIDGE_BASE_URL = `http://localhost:${NVIDIA_BRIDGE_PORT}/v1`;
const NVIDIA_KEYS_DIR = path.join(DATA_DIR, 'nvidia-keys');
const NVIDIA_KEYS_PATH = path.join(NVIDIA_KEYS_DIR, 'keys.json');
const NVIDIA_PROXY_SCRIPT = path.join(__dirname, 'services', 'nvidia-bridge', 'proxy.cjs');

async function startNvidiaBridge(): Promise<void> {
  if (!fs.existsSync(NVIDIA_PROXY_SCRIPT)) {
    console.debug('[NVIDIA-Bridge] proxy.js nie znaleziony — pomijam');
    return;
  }
  // Upewnij się że katalog na klucze istnieje
  if (!fs.existsSync(NVIDIA_KEYS_DIR)) {
    fs.mkdirSync(NVIDIA_KEYS_DIR, { recursive: true });
  }
  // Inicjalizuj pusty keys.json jeśli nie istnieje
  if (!fs.existsSync(NVIDIA_KEYS_PATH)) {
    fs.writeFileSync(NVIDIA_KEYS_PATH, '[]', 'utf-8');
  }

  try {
    const resp = await fetch(`${NVIDIA_BRIDGE_BASE_URL}/models`);
    if (resp.ok) { /* console.debug('[NVIDIA-Bridge] już działa'); */ return; }
  } catch { /* ok */ }

  // Kopiuj proxy.js do data/nvidia-keys żeby czytało keys.json z tego samego folderu
  const proxyInData = path.join(NVIDIA_KEYS_DIR, 'proxy.cjs');
  if (!fs.existsSync(proxyInData) || fs.statSync(NVIDIA_PROXY_SCRIPT).mtimeMs > fs.statSync(proxyInData).mtimeMs) {
    fs.copyFileSync(NVIDIA_PROXY_SCRIPT, proxyInData);
  }

  console.debug('[NVIDIA-Bridge] Uruchamianie...');
  nvidiaProcess = spawn('node', [proxyInData], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false, windowsHide: true,
  });
  nvidiaProcess.stdout?.on('data', (d: Buffer) => { /* console.debug('[NVIDIA-Bridge]', d.toString().trim()); */ });
  nvidiaProcess.stderr?.on('data', (d: Buffer) => { /* console.debug('[NVIDIA-Bridge:err]', d.toString().trim()); */ });
  nvidiaProcess.on('exit', (code) => { /* console.debug(`[NVIDIA-Bridge] exit ${code}`); */ nvidiaProcess = null; });
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    try { const r = await fetch(`${NVIDIA_BRIDGE_BASE_URL}/models`); if (r.ok) { /* console.debug('[NVIDIA-Bridge] Gotowy!'); */ return; } } catch { /* wait */ }
  }
  // console.warn('[NVIDIA-Bridge] Nie odpowiada po 10s');
}
function stopNvidiaBridge(): void {
  if (nvidiaProcess) { console.debug('[NVIDIA-Bridge] Stop'); nvidiaProcess.kill('SIGTERM'); nvidiaProcess = null; }
}

// ============================================================================
// Create Window
// ============================================================================
function createMainWindow(): BrowserWindow {
  const preloadPath = path.join(__dirname, '..', 'preload', 'index.js');

  // console.log('[NEXUS] preload path:', preloadPath);
  // console.log('[NEXUS] preload exists:', fs.existsSync(preloadPath));

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

  // === AI Bridge ===
  await startNvidiaBridge(); // NVIDIA key rotator proxy

  // === Storage ===
  storage = new StorageEngine(DATA_DIR);
  await storage.init();

  // === Provider Registry ===
  const healthMonitor = new AiHealthMonitor(DATA_DIR);
  await healthMonitor.init();
  providerRegistry = new ProviderRegistry(healthMonitor);
  providerRegistry.setIpcSender((channel, data) => {
    mainWindow?.webContents.send(channel, data);
  });
  // console.log('[NEXUS] ProviderRegistry:', providerRegistry.getConfigs().map(c => c.label).join(', '));

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
  }, providerRegistry, storage, clipboard);

  // === IPC Bridge ===
  ipcBridge = new ElectronIpcBridge(ipcMain, orchestrator, storage, providerRegistry, ROOT_DIR, NVIDIA_KEYS_PATH);
  ipcBridge.registerHandlers();

  // console.log('[NEXUS] System gotowy — AI Providers:', providerRegistry.getConfigs().length);
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
  stopNvidiaBridge();
});
