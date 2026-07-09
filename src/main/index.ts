// ============================================================================
// NEXUS — Main Process (electron-vite entry)
// Bezpieczny BrowserWindow z contextIsolation: true + preload.ts
// Inicjalizuje AgentOrchestrator + StorageEngine + ElectronIpcBridge
// ============================================================================

import { app, BrowserWindow, ipcMain, clipboard, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { AgentOrchestrator } from './core/AgentOrchestrator';
import { StorageEngine } from './storage/StorageEngine';
import { ElectronIpcBridge } from './ipc/ElectronIpcBridge';
import { ProviderRegistry } from './ai/ProviderRegistry';
import { AiHealthMonitor } from './ai/AiHealthMonitor';
import { AgentOutput, AgentStatus } from '../shared/types/schema';
import { UsemeHandlerManager, registerUsemeHandlers } from './ipc/usemeHandlers';
import { config } from './config';
import { initNexusSelfProject } from './services/NexusSelfAnalyzer';

// === Constants =============================================================
const IS_DEV = !app.isPackaged;
const ROOT_DIR = path.join(__dirname, '..', '..');
const RESOURCE_DIR = !IS_DEV
  ? path.join(process.resourcesPath, 'app.asar.unpacked')
  : ROOT_DIR;
const DATA_DIR = !IS_DEV
  ? path.join(app.getPath('userData'), 'NexusData')
  : path.join(ROOT_DIR, 'data');

const DEEPSEEK_PROXY_DIR = path.join(ROOT_DIR, '..', 'deepseek-proxy-clean');

// === State =================================================================
let mainWindow: BrowserWindow | null = null;
let orchestrator: AgentOrchestrator | null = null;
let storage: StorageEngine | null = null;
let ipcBridge: ElectronIpcBridge | null = null;
let providerRegistry: ProviderRegistry | null = null;
let usemeManager: UsemeHandlerManager | null = null;
let deepSeekProxyProcess: ChildProcess | null = null;

// ============================================================================
// DeepSeek Proxy
// ============================================================================
async function startDeepSeekProxy(): Promise<void> {
  if (!config.deepseekProxy.enabled) return;

  const healthUrl = config.deepseekProxy.healthUrl;
  try {
    const res = await fetch(healthUrl);
    if (res.ok) {
      console.log('[NEXUS] DeepSeek proxy already running on port', config.deepseekProxy.port);
      return;
    }
  } catch { /* not running, start it */ }

  const proxyScript = path.join(DEEPSEEK_PROXY_DIR, 'server.py');
  if (!fs.existsSync(proxyScript)) {
    console.warn('[NEXUS] DeepSeek proxy script not found at', proxyScript);
    return;
  }

  console.log('[NEXUS] Starting DeepSeek proxy...');
  const proc = spawn('python', ['-u', proxyScript], {
    cwd: DEEPSEEK_PROXY_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  deepSeekProxyProcess = proc;

  proc.stdout?.on('data', (data: Buffer) => {
    console.log(`[deepseek-proxy] ${data.toString().trim()}`);
  });
  proc.stderr?.on('data', (data: Buffer) => {
    console.error(`[deepseek-proxy] ${data.toString().trim()}`);
  });
  proc.on('exit', (code) => {
    console.log(`[NEXUS] DeepSeek proxy exited with code ${code}`);
    deepSeekProxyProcess = null;
  });

  for (let i = 0; i < config.deepseekProxy.startupTimeoutMs / 1000; i++) {
    try {
      const res = await fetch(healthUrl);
      if (res.ok) {
        console.log('[NEXUS] DeepSeek proxy ready');
        return;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  console.warn('[NEXUS] DeepSeek proxy did not start within timeout');
}

function stopDeepSeekProxy(): void {
  const proc = deepSeekProxyProcess;
  if (!proc) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/F', '/T', '/PID', String(proc.pid)], { shell: false });
  } else {
    proc.kill('SIGTERM');
  }
  deepSeekProxyProcess = null;
}

// ============================================================================
// Create Window
// ============================================================================
function createMainWindow(): BrowserWindow {
  const preloadPath = path.join(__dirname, '..', 'preload', 'index.js');

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'NEXUS — Agent Orchestration System',
    backgroundColor: '#0a0e14',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      preload: preloadPath,
    },
  });

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
  console.log('====================================================\n');

  await startDeepSeekProxy();

  storage = new StorageEngine(DATA_DIR);
  await storage.init();

  const healthMonitor = new AiHealthMonitor(DATA_DIR, config.deepseekProxy.healthUrl);
  await healthMonitor.init();
  providerRegistry = new ProviderRegistry(healthMonitor);
  providerRegistry.setIpcSender((channel, data) => {
    mainWindow?.webContents.send(channel, data);
  });

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

  ipcBridge = new ElectronIpcBridge(ipcMain, orchestrator, storage, providerRegistry, ROOT_DIR);
  ipcBridge.registerHandlers();

  initNexusSelfProject(storage!, path.join(ROOT_DIR, 'src'), path.join(ROOT_DIR, 'STAN_PROJEKTU.md')).catch(err => console.warn('[NexusSelfAnalyzer] init error:', err));

  usemeManager = new UsemeHandlerManager();
  if (mainWindow) usemeManager.setMainWindow(mainWindow);
  registerUsemeHandlers(ipcMain, usemeManager);

  mainWindow = createMainWindow();
  if (usemeManager && mainWindow) {
    usemeManager.setMainWindow(mainWindow);
  }
}

// ============================================================================
// App Lifecycle
// ============================================================================

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    try {
      await bootstrap();
    } catch (err) {
      console.error('[NEXUS] Bootstrap failed:', err);
      dialog.showErrorBox('Nexus Bootstrap Error', String(err));
      app.quit();
      return;
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow();
      }
    });
  }).catch(err => {
    console.error('[NEXUS] App ready failed:', err);
    dialog.showErrorBox('Nexus Error', String(err));
    app.quit();
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
    usemeManager?.destroy();
    stopDeepSeekProxy();
  });
}