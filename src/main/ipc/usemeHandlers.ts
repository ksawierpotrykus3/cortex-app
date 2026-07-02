import { ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as url from 'url';
import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

interface UsemeLogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

interface ReviewRequest {
  jobId: string;
  jobTitle: string;
  price: string;
  proposal: string;
  auditReport: string;
}

interface PromptFile {
  filename: string;
  content: string;
}

/**
 * Zarządza procesem child_process dla backendu useme-ai-automation.
 * Emituje zdarzenia do renderera przez webContents.
 */
export class UsemeHandlerManager {
  private process: ChildProcess | null = null;
  private mainWindow: BrowserWindow | null = null;

  /** Ścieżka do katalogu useme-ai-automation (znajduje się obok nexus/) */
  private getEngineDir(): string {
    // W dev: nexus/../useme-ai-automation
    const nexusDir = path.resolve(__dirname, '..', '..', '..');
    return path.join(nexusDir, 'useme-ai-automation');
  }

  setMainWindow(win: BrowserWindow): void {
    this.mainWindow = win;
  }

  private send(channel: string, data: unknown): void {
    this.mainWindow?.webContents.send(channel, data);
  }

  startExecution(mode: 'dry' | 'prod', headless: boolean): boolean {
    if (this.process) {
      return false; // już działa
    }

    const engineDir = this.getEngineDir();
    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      DRY_RUN: mode === 'dry' ? 'true' : 'false',
      HEADLESS: headless ? 'true' : 'false',
    };

    // Użyj tsx do uruchomienia TypeScript bez kompilacji
    const child = require('child_process').spawn('npx', ['tsx', 'src/index.ts'], {
      cwd: engineDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    this.process = child;

    child.stdout?.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        this.send('useme:log', {
          level: 'info',
          message: line,
          timestamp: new Date().toISOString(),
        } as UsemeLogEntry);
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        this.send('useme:log', {
          level: 'error',
          message: line,
          timestamp: new Date().toISOString(),
        } as UsemeLogEntry);
      }
    });

    child.on('exit', (code: number | null) => {
      this.send('useme:log', {
        level: 'info',
        message: `[Engine] Proces zakończony z kodem ${code}`,
        timestamp: new Date().toISOString(),
      } as UsemeLogEntry);
      this.process = null;
    });

    child.on('error', (err: Error) => {
      this.send('useme:log', {
        level: 'error',
        message: `[Engine] Błąd procesu: ${err.message}`,
        timestamp: new Date().toISOString(),
      } as UsemeLogEntry);
      this.process = null;
    });

    return true;
  }

  stopExecution(): boolean {
    if (!this.process) return false;
    this.process.kill('SIGTERM');
    this.process = null;
    return true;
  }

  isRunning(): boolean {
    return this.process !== null;
  }

  /** Prompts management */

  getPromptFileList(): string[] {
    const engineDir = this.getEngineDir();
    const dirs = ['config/prompts', 'config/knowledge'];
    const files: string[] = [];
    for (const dir of dirs) {
      const absDir = path.join(engineDir, dir);
      if (fs.existsSync(absDir)) {
        const entries = fs.readdirSync(absDir);
        for (const entry of entries) {
          if (entry.endsWith('.md')) {
            files.push(path.join(dir, entry));
          }
        }
      }
    }
    return files.sort();
  }

  readPromptFile(filename: string): string {
    const engineDir = this.getEngineDir();
    const filePath = path.join(engineDir, filename);
    // Prevent path traversal
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(engineDir, 'config'))) {
      throw new Error('Path traversal denied');
    }
    if (!fs.existsSync(resolved)) {
      throw new Error(`File not found: ${filename}`);
    }
    return fs.readFileSync(resolved, 'utf-8');
  }

  savePromptFile(filename: string, content: string): boolean {
    const engineDir = this.getEngineDir();
    const filePath = path.join(engineDir, filename);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(engineDir, 'config'))) {
      throw new Error('Path traversal denied');
    }
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, content, 'utf-8');
    return true;
  }

  destroy(): void {
    this.stopExecution();
  }
}

/**
 * Rejestruje IPC handlery dla Useme.
 */
export function registerUsemeHandlers(
  ipc: typeof ipcMain,
  manager: UsemeHandlerManager
): void {
  ipc.handle('useme:start', async (_event: IpcMainInvokeEvent, payload: { mode: 'dry' | 'prod'; headless: boolean }) => {
    try {
      const started = manager.startExecution(payload.mode, payload.headless);
      return { success: started, error: started ? undefined : 'Proces już uruchomiony' };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipc.handle('useme:stop', async () => {
    try {
      const stopped = manager.stopExecution();
      return { success: stopped, error: stopped ? undefined : 'Brak uruchomionego procesu' };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipc.handle('useme:status', async () => {
    return { running: manager.isRunning() };
  });

  ipc.handle('useme:list-prompts', async () => {
    try {
      return { success: true, files: manager.getPromptFileList() };
    } catch (err) {
      return { success: false, error: String(err), files: [] };
    }
  });

  ipc.handle('useme:read-prompt', async (_event: IpcMainInvokeEvent, payload: { filename: string }) => {
    try {
      const content = manager.readPromptFile(payload.filename);
      return { success: true, content };
    } catch (err) {
      return { success: false, error: String(err), content: '' };
    }
  });

  ipc.handle('useme:save-prompt', async (_event: IpcMainInvokeEvent, payload: { filename: string; content: string }) => {
    try {
      manager.savePromptFile(payload.filename, payload.content);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
}
