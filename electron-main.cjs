// ================================================================
// NEXUS V2 — Electron Main Process (Hardened Bootstrap)
// ================================================================
// Ładuje workspace init, sondę uprawnień, PID lock,
// SharedMemoryBuffer, Lonely Author Worker,
// NexusVFS (Phase 3.1), oraz ExecutionRunner (Phase 3.3).
// ================================================================

const { app, BrowserWindow } = require('electron');
const path = require('path');

// ================================================================
// BOOTSTRAP: Workspace Init + Probe + PID Lock
// ================================================================
async function bootstrapWorkspace() {
  // Dynamiczny import ES-modułów z TypeScript — używamy tsx/register
  // w środowisku deweloperskim, lub skompilowanego JS w produkcji
  let workspaceModule;
  try {
    // Próba załadowania skompilowanego modułu (produkcja)
    workspaceModule = require('./dist/backend/io/workspace.js');
  } catch (_) {
    // W dev: użyj tsx do transpilacji w locie
    try {
      require('tsx').register();
      workspaceModule = require('./src/backend/io/workspace.ts');
    } catch (_e) {
      // Jeśli tsx nie jest dostępny, załaduj przez eval-creator
      // To jest ostateczne zabezpieczenie — normalnie nie powinno się zdarzyć
      console.error(
        '[NEXUS] CRITICAL: Nie można załadować workspace.ts. ' +
        'Upewnij się, że tsx ("npm install tsx") jest zainstalowane.'
      );
      throw new Error('Workspace bootstrap failed: no tsx loader');
    }
  }

  const { initializeWorkspace } = workspaceModule;

  try {
    const result = await initializeWorkspace();
    console.log('[NEXUS] Workspace initialized:', JSON.stringify({
      path: result.workspacePath,
      fallback: result.usedFallback,
      pid: result.pid,
      dirs: result.createdDirs.length,
    }));
    return result.workspacePath;
  } catch (err) {
    console.error('[NEXUS] Workspace initialization failed:', err);
    app.quit();
    process.exit(1);
  }
}

// ================================================================
// BOOTSTRAP: Security Modules — VFS + Circuit Breaker (Phase 3.x)
// ================================================================
async function bootstrapSecurity(workspacePath) {
  // Dynamiczny import modułów security przez tsx
  let securityModule;
  try {
    securityModule = require('./dist/backend/security/index.js');
  } catch (_) {
    try {
      require('tsx').register();
      securityModule = require('./src/backend/security/index.ts');
    } catch (_e) {
      console.warn('[NEXUS] Security modules not available — VFS disabled');
      return;
    }
  }

  const { NexusVFS } = securityModule;

  try {
    // Inicjalizacja NexusVFS
    const vfs = new NexusVFS(workspacePath);

    // Zamontuj standardowe węzły workspace
    vfs.mount('agents', path.join(workspacePath, 'Agents'));
    vfs.mount('workflows', path.join(workspacePath, 'Workflows'));
    vfs.mount('context', path.join(workspacePath, 'Context_Pool'));
    vfs.mount('buffers', path.join(workspacePath, 'Buffers'));
    vfs.mount('rlhf', path.join(workspacePath, 'RLHF_Logs'));
    vfs.mount('watched_io', path.join(workspacePath, 'Watched_IO'), true);

    // Eksportuj VFS do globalnego kontekstu Electrona
    global.__NEXUS_VFS__ = vfs;
    global.__NEXUS_WORKSPACE_PATH__ = workspacePath;

    console.log('[NEXUS] Security initialized: VFS with 6 mount points, agents in Default Deny');
  } catch (err) {
    console.error('[NEXUS] Security initialization failed:', err);
    // Nie zabijaj aplikacji — VFS nie jest krytyczny dla startu UI
  }
}

// ================================================================
// CREATE WINDOW
// ================================================================
async function createWindow() {
  // Inicjalizacja workspace przed utworzeniem okna
  const workspacePath = await bootstrapWorkspace();

  // Ustaw zmienną środowiskową dla procesu renderer
  process.env.NEXUS_WORKSPACE_PATH = workspacePath;

  // ================================================================
  // BOOTSTRAP: Security modules (Phase 3.x)
  //   - NexusVFS: Virtual File System z ACL (Default Deny)
  //   - ExecutionRunner: Circuit Breaker + Zombie Killer
  // ================================================================
  await bootstrapSecurity(workspacePath);

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    autoHideMenuBar: true,
    title: 'Nexus System',
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    win.loadFile(indexPath);
  }
}

// ================================================================
// APP LIFECYCLE
// ================================================================
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
