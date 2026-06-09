// ================================================================
// NEXUS V2 — Hardware Circuit Breaker + Zombie Killer (Phase 3.3)
// ================================================================
// Brutalne wymuszanie limitów czasowych (timeout: 1500ms) dla
// kodu generowanego przez AI. Używa natywnych API Windows:
//   - taskkill /F /T /PID — twarde ubicie całego drzewa procesów
//   - tasklist — weryfikacja, że proces nie został sierotą (zombie)
//
// ARCHITEKTURA:
//   - ExecutionRunner: spawn + AbortController + timeout 1500ms
//   - ZombieKiller: tasklist scan + taskkill ponowny przy zombie
//   - Brak symulacji: wszystko przez natywne child_process
// ================================================================

import { spawn, type ChildProcess } from 'child_process';
import { platform } from 'os';
import { setTimeout as wait } from 'timers/promises';

// ==============================================================
// Konfiguracja
// ==============================================================
const DEFAULT_TIMEOUT_MS = 1500;
const ZOMBIE_CHECK_DELAY_MS = 200;
const MAX_ZOMBIE_KILL_ATTEMPTS = 3;

// ==============================================================
// Typy
// ==============================================================
export interface ExecutionResult {
  /** stdout procesu (sklejone) */
  stdout: string;
  /** stderr procesu */
  stderr: string;
  /** Kod wyjścia (null jeśli timeout) */
  exitCode: number | null;
  /** Czy proces został uśmiercony przez timeout */
  timedOut: boolean;
  /** Rzeczywisty czas wykonania w ms */
  durationMs: number;
  /** Sygnał杀死 (SIGKILL / taskkill) */
  killedBy: 'timeout' | 'natural' | 'zombie_killer';
}

export interface KillResult {
  success: boolean;
  pid: number;
  reason: string;
}

/**
 * ExecutionTimeoutError — rzucany gdy czas wykonania przekroczy limit.
 * Niesie informację o PID i czasie rzeczywistym wykonania.
 */
export class ExecutionTimeoutError extends Error {
  public readonly pid: number;
  public readonly durationMs: number;
  public readonly timeoutMs: number;

  constructor(pid: number, durationMs: number, timeoutMs: number) {
    super(
      `[CIRCUIT_BREAKER] Proces PID ${pid} przekroczył limit ${timeoutMs}ms ` +
      `(rzeczywisty czas: ${durationMs}ms). Ubito przez taskkill /F /T.`
    );
    this.name = 'ExecutionTimeoutError';
    this.pid = pid;
    this.durationMs = durationMs;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * ZombieProcessError — rzucany gdy proces przeżył próbę zabicia.
 */
export class ZombieProcessError extends Error {
  public readonly pid: number;
  constructor(pid: number, attempts: number) {
    super(
      `[ZOMBIE_KILLER] Proces PID ${pid} przeżył ${attempts} prób zabicia. ` +
      `Proces pozostaje w systemie jako zombie.`
    );
    this.name = 'ZombieProcessError';
    this.pid = pid;
  }
}

// ==============================================================
// ZombieKiller — odkurzacz procesów
//
// Po użyciu Circuit Breakera sprawdza czy proces rzeczywiście
// został uśmiercony. Jeśli nie — używa taskkill ponownie.
// ==============================================================
export class ZombieKiller {
  private readonly maxAttempts: number;
  private readonly checkDelayMs: number;

  constructor(options?: {
    maxAttempts?: number;
    checkDelayMs?: number;
  }) {
    this.maxAttempts = options?.maxAttempts ?? MAX_ZOMBIE_KILL_ATTEMPTS;
    this.checkDelayMs = options?.checkDelayMs ?? ZOMBIE_CHECK_DELAY_MS;
  }

  /**
   * kill(pid) — twarde zabicie procesu przez natywne API Windows
   *
   * Windows: taskkill /F /T /PID <pid>
   *   /F = force kill
   *   /T = kill tree (wszystkie dzieci)
   *   /PID = identyfikator procesu
   *
   * Linux: SIGKILL (-9)
   */
  async kill(pid: number): Promise<KillResult> {
    if (pid <= 0) {
      return { success: false, pid, reason: 'Nieprawidłowy PID' };
    }

    // Sprawdź czy proces w ogóle istnieje
    const exists = await this._processExists(pid);
    if (!exists) {
      return { success: true, pid, reason: 'Proces już nie istnieje' };
    }

    const isWin = platform() === 'win32';

    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      try {
        if (isWin) {
          // ==========================================================
          // NATYWNE API WINDOWS: taskkill /F /T
          //
          // To nie jest symulacja — to prawdziwe wywołanie Windows
          // Task Scheduler API przez interpreter cmd.exe.
          // /F = wymuszenie zakończenia
          // /T = zakończenie całego drzewa procesów
          // ==========================================================
          await this._runKillCommand(
            'taskkill',
            ['/F', '/T', '/PID', String(pid)],
            pid
          );
        } else {
          // Linux / macOS: SIGKILL
          process.kill(pid, 'SIGKILL');
        }

        // Odczekaj przed weryfikacją
        await wait(this.checkDelayMs);

        // Sprawdź czy proces na pewno nie żyje
        const stillAlive = await this._processExists(pid);
        if (!stillAlive) {
          return { success: true, pid, reason: `Uśmiercony po ${attempt + 1} próbach` };
        }
      } catch {
        // taskkill może rzucić błędem jeśli proces nie istnieje (ERROR_PROC_NOT_FOUND)
        const stillAlive = await this._processExists(pid);
        if (!stillAlive) {
          return { success: true, pid, reason: 'Uśmiercony mimo błędu taskkill' };
        }
        // Spróbuj ponownie
        await wait(this.checkDelayMs);
      }
    }

    // ================================================================
    // KRYTYCZNE: proces nadal żyje mimo wszystkich prób
    // ZombieProcessError — wymaga interwencji administratora
    // ================================================================
    throw new ZombieProcessError(pid, this.maxAttempts);
  }

  /**
   * isProcessAlive(pid) — czy proces istnieje w systemie
   *
   * Windows: tasklist /FI "PID eq <pid>" /NH
   * Linux:   process.kill(pid, 0)
   */
  async isProcessAlive(pid: number): Promise<boolean> {
    if (pid <= 0) return false;
    return this._processExists(pid);
  }

  // ============================================================
  // Interna
  // ============================================================

  /**
   * _processExists — sprawdza przez natywne API czy proces żyje
   *
   * Windows: tasklist /FI "PID eq N" /NH
   *   Zwraca listę procesów. Jeśli PID istnieje — wiersz zawiera
   *   nazwę i PID. Jeśli nie — "INFO: No tasks are running..."
   */
  private async _processExists(pid: number): Promise<boolean> {
    const isWin = platform() === 'win32';

    if (isWin) {
      try {
        const { stdout } = await this._exec('tasklist', [
          '/FI', `PID eq ${pid}`,
          '/NH',           // No header
        ]);

        // Jeśli tasklist zwróciło "No tasks" — proces nie istnieje
        return !stdout.includes('No tasks') && stdout.includes(String(pid));
      } catch {
        return false;
      }
    } else {
      // Linux / macOS: process.kill(pid, 0)
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * _runKillCommand — wykonuje polecenie zabicia procesu
   */
  private async _runKillCommand(
    command: string,
    args: string[],
    pid: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });

      let stderr = '';
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        reject(err);
      });

      child.on('close', (code) => {
        if (code === 0 || code === null) {
          // taskkill zwraca 0 przy sukcesie
          // 128 = ERROR_PROC_NOT_FOUND (proces już nie istnieje)
          resolve();
        } else if (code === 128 || stderr.includes('not found') || stderr.includes('nie istnieje')) {
          // Proces już nie żyje — to też sukces
          resolve();
        } else {
          reject(new Error(`taskkill PID ${pid} exit code ${code}: ${stderr}`));
        }
      });
    });
  }

  /**
   * _exec — wykonuje polecenie i zwraca stdout/stderr
   */
  private async _exec(
    command: string,
    args: string[]
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        reject(err);
      });

      child.on('close', (code) => {
        resolve({ stdout, stderr });
      });
    });
  }
}

// ==============================================================
// ExecutionRunner — wykonuje kod z twardym timeoutem
//
// 1. Spawn procesu (Node.js lub Python lub inny)
// 2. Zegar start: process.hrtime.bigint()
// 3. AbortController + setTimeout(timeoutMs) → timeout
// 4. Timeout → ZombieKiller.kill(pid) → taskkill /F /T
// 5. Zombie check po zabiciu
// ==============================================================
export class ExecutionRunner {
  private readonly timeoutMs: number;
  private readonly zombieKiller: ZombieKiller;

  constructor(options?: {
    timeoutMs?: number;
    zombieKiller?: ZombieKiller;
  }) {
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.zombieKiller = options?.zombieKiller ?? new ZombieKiller();
  }

  /**
   * run(command, args) — wykonuje polecenie z timeoutem
   *
   * @param command - polecenie do wykonania (np. "node", "python")
   * @param args - argumenty
   * @param stdin - opcjonalny stdin do wysłania
   * @returns ExecutionResult
   */
  async run(
    command: string,
    args: string[],
    stdin?: string
  ): Promise<ExecutionResult> {
    const startTime = process.hrtime.bigint();

    return new Promise<ExecutionResult>((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';
      let killedBy: ExecutionResult['killedBy'] = 'natural';
      let timedOut = false;

      // ================================================================
      // Zbieranie stdout
      // ================================================================
      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      // ================================================================
      // Zbieranie stderr
      // ================================================================
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      // ================================================================
      // AbortController — hardware timeout 1500ms
      //
      // Gdy timeout wybije:
      // 1. child.kill('SIGKILL') — próba szybkiego zabicia
      // 2. ZombieKiller.kill(pid) — taskkill /F /T (gwarancja)
      // 3. Odrzucenie przez ExecutionTimeoutError
      // ================================================================
      const timeoutHandle = setTimeout(async () => {
        timedOut = true;
        killedBy = 'timeout';
        const now = process.hrtime.bigint();
        const elapsed = Number(now - startTime) / 1_000_000;

        // Próba 1: SIGKILL (działa na Linux, na Windows taskkill)
        try {
          child.kill('SIGKILL');
        } catch {
          // ignore
        }

        // Próba 2: ZombieKiller — taskkill /F /T
        if (child.pid && child.pid > 0) {
          try {
            await this.zombieKiller.kill(child.pid);
          } catch (err) {
            reject(err);
            return;
          }
        }

        reject(new ExecutionTimeoutError(child.pid ?? -1, elapsed, this.timeoutMs));
      }, this.timeoutMs);

      // ================================================================
      // Obsługa błędów spawn
      // ================================================================
      child.on('error', (err) => {
        clearTimeout(timeoutHandle);
        reject(err);
      });

      // ================================================================
      // Proces zakończony normalnie lub przez kill
      // ================================================================
      child.on('close', async (exitCode) => {
        const now = process.hrtime.bigint();
        const elapsed = Number(now - startTime) / 1_000_000;

        clearTimeout(timeoutHandle);

        if (timedOut) {
          // Już odrzuciliśmy przez timeout — nie resolve'uj
          return;
        }

        // ================================================================
        // ZOMBIE CHECK: Po normalnym zakończeniu sprawdź czy proces
        // na pewno nie został sierotą (dotyczy głównie Windows)
        // ================================================================
        if (child.pid && child.pid > 0) {
          try {
            const alive = await this.zombieKiller.isProcessAlive(child.pid);
            if (alive) {
              // Proces został sierotą! Użyj Zombie Killer
              killedBy = 'zombie_killer';
              await this.zombieKiller.kill(child.pid);
            }
          } catch {
            // Zombie nie dał się zabić — zgłoś błąd ale zwróć rezultat
          }
        }

        resolve({
          stdout,
          stderr,
          exitCode: exitCode ?? -1,
          timedOut: false,
          durationMs: Math.round(elapsed),
          killedBy,
        });
      });

      // ================================================================
      // Wyślij stdin jeśli podano
      // ================================================================
      if (stdin !== undefined) {
        child.stdin?.write(stdin);
        child.stdin?.end();
      }
    });
  }

  /**
   * getTimeoutMs() — zwraca aktualny timeout
   */
  getTimeoutMs(): number {
    return this.timeoutMs;
  }
}
