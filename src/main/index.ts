// ============================================================================
// CORTEX — Main Process (electron-vite entry)
// Bezpieczny BrowserWindow z contextIsolation: true + preload.ts
// Inicjalizuje StorageEngine + ElectronIpcBridge
// ============================================================================

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { StorageEngine } from './storage/StorageEngine';
import { ElectronIpcBridge } from './ipc/ElectronIpcBridge';

// === Constants =============================================================
const IS_DEV = !app.isPackaged;
const ROOT_DIR = path.join(__dirname, '..', '..');
const DATA_DIR = !IS_DEV
  ? path.join(app.getPath('userData'), 'CortexData')
  : path.join(ROOT_DIR, 'data');

// === State =================================================================
let mainWindow: BrowserWindow | null = null;
let storage: StorageEngine | null = null;
let ipcBridge: ElectronIpcBridge | null = null;

// ============================================================================
// Create Window
// ============================================================================
function createMainWindow(): BrowserWindow {
  const preloadPath = path.join(__dirname, '..', 'preload', 'index.cjs');

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'Cortex — Agent Orchestration System',
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
          "script-src 'self' " + (IS_DEV ? "'unsafe-inline' " : "") + "; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "font-src 'self' https://fonts.gstatic.com; " +
          "img-src 'self' data: blob:; " +
          "connect-src 'self' ws: http://localhost:* https://generativelanguage.googleapis.com https://api.deepseek.com https://openrouter.ai; " +
          "frame-src 'none'; " +
          "object-src 'none'; ",
        ],
      },
    });
  });

  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[RENDERER:${level}] ${message} (${sourceId}:${line})`);
  });
  win.webContents.on('did-fail-load', (_event, code, desc) => {
    console.error(`[RENDERER FAIL] ${code}: ${desc}`);
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[RENDERER GONE] ${details.reason}`);
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
  console.log('  Cortex — Notatki');
  console.log('====================================================\n');

  storage = new StorageEngine(DATA_DIR);
  await storage.init();
  ipcBridge = new ElectronIpcBridge(ipcMain, storage);
  ipcBridge.registerHandlers();
  mainWindow = createMainWindow();
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
      console.error('[CORTEX] Bootstrap failed:', err);
      dialog.showErrorBox('Cortex Bootstrap Error', String(err));
      app.quit();
      return;
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow();
      }
    });
  }).catch(err => {
    console.error('[CORTEX] App ready failed:', err);
    dialog.showErrorBox('Cortex Error', String(err));
    app.quit();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    storage?.destroy();
    ipcBridge?.destroy();
  });
}